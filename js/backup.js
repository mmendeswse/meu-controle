/**
 * backup.js
 * -----------------------------------------------------------------------
 * Protege os dados em três camadas, todas sem servidor:
 *
 * 1. Armazenamento persistente — pede ao navegador para não apagar os
 *    dados sozinho (limpeza automática por falta de espaço ou de uso).
 * 2. Cópias automáticas no aparelho — uma por dia (as últimas 14) e uma
 *    antes de qualquer operação que substitui ou apaga dados (restaurar,
 *    reset, excluir um grupo, carregar o exemplo). Ficam no IndexedDB,
 *    separadas dos dados do app, e podem ser restauradas em Ajustes.
 *    Protegem contra "apaguei sem querer"; não contra perder o aparelho.
 * 3. Backup fora do aparelho:
 *    - computador (Chrome/Edge): uma pasta escolhida uma vez — de
 *      preferência a do Google Drive / OneDrive / Dropbox no PC — onde o
 *      app grava o backup sozinho depois das alterações;
 *    - celular: backup em 1 toque pelo "compartilhar" (Drive, iCloud,
 *      WhatsApp…), com um lembrete no intervalo escolhido.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo, UI = global.UI, A = global.Armazenamento;
  const esc = UI.esc;
  const BANCO = "meu-controle-backup", VERSAO_BANCO = 1;
  const MAX_DIARIAS = 14, MAX_SEGURANCA = 6, MAX_ARQUIVOS_PASTA = 7;
  const estado = { persistente: null, pasta: null, permissaoPasta: null, ultimaGravacaoPasta: null, erroPasta: null, copias: null };

  // ---------------------------------------------------------------------
  // IndexedDB (promessas simples)
  // ---------------------------------------------------------------------
  let bancoPromessa = null;
  function banco() {
    if (bancoPromessa) return bancoPromessa;
    bancoPromessa = new Promise((ok, erro) => {
      if (!("indexedDB" in global)) { erro(new Error("sem IndexedDB")); return; }
      const req = indexedDB.open(BANCO, VERSAO_BANCO);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("copias")) db.createObjectStore("copias", { keyPath: "chave" });
        if (!db.objectStoreNames.contains("ajustes")) db.createObjectStore("ajustes");
      };
      req.onsuccess = () => {
        const db = req.result;
        // se o navegador fechar a conexão, a próxima operação abre de novo
        db.onclose = () => { bancoPromessa = null; };
        db.onversionchange = () => { db.close(); bancoPromessa = null; };
        ok(db);
      };
      req.onerror = () => erro(req.error);
    });
    bancoPromessa.catch(() => { bancoPromessa = null; });
    return bancoPromessa;
  }
  function tx(loja, modo, fn) {
    return banco().then((db) => new Promise((ok, erro) => {
      let t;
      try { t = db.transaction(loja, modo); } catch (e) { bancoPromessa = null; erro(e); return; }
      const s = t.objectStore(loja);
      let res;
      Promise.resolve(fn(s)).then((r) => { res = r; });
      t.oncomplete = () => ok(res);
      t.onerror = () => erro(t.error);
      t.onabort = () => erro(t.error);
    }));
  }
  const pedido = (r) => new Promise((ok, erro) => { r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error); });

  // ---------------------------------------------------------------------
  // resumo de um conjunto de dados (para a lista de cópias)
  // ---------------------------------------------------------------------
  function contar(d) {
    const n = ["pesagens", "medidas", "refeicoes", "agua", "compras", "treinos", "series", "metas", "bemEstar", "habitoRegistros", "doses", "jejuns"].reduce((s, k) => s + ((d[k] || []).length), 0);
    return { registros: n, nome: (d.usuarios && d.usuarios[0] && d.usuarios[0].nome) || "" };
  }
  function temDados(d) { return !d.demo && contar(d).registros + (d.alimentos || []).length + (d.habitos || []).length + (d.remedios || []).length > 0; }
  function nomeArquivo(data) { return "meu-controle-backup-" + (data || N.hoje(0)) + ".json"; }
  function textoDados(d) { return JSON.stringify(d); }

  // ---------------------------------------------------------------------
  // 1. armazenamento persistente
  // ---------------------------------------------------------------------
  function protegerArmazenamento() {
    if (!navigator.storage || !navigator.storage.persist) { estado.persistente = "indisponivel"; return Promise.resolve(estado.persistente); }
    return navigator.storage.persisted().then((ja) => ja ? true : navigator.storage.persist())
      .then((r) => { estado.persistente = !!r; return r; }).catch(() => { estado.persistente = false; });
  }

  // ---------------------------------------------------------------------
  // 2. cópias automáticas no aparelho
  // ---------------------------------------------------------------------
  function gravarCopia(chave, tipo, texto, d) {
    const c = contar(d);
    return tx("copias", "readwrite", (s) => { s.put({ chave, tipo, quando: new Date().toISOString(), texto, tamanho: texto.length, registros: c.registros, nome: c.nome }); })
      .then(limparAntigas).then(() => { estado.copias = null; })
      .catch((e) => console.warn("Cópia automática não gravada:", e));
  }
  function listar() {
    return tx("copias", "readonly", (s) => pedido(s.getAll())).then((l) => {
      l = (l || []).map((x) => ({ chave: x.chave, tipo: x.tipo, quando: x.quando, tamanho: x.tamanho, registros: x.registros, nome: x.nome }))
        .sort((a, b) => b.quando.localeCompare(a.quando));
      estado.copias = l;
      return l;
    }).catch(() => { estado.copias = []; return []; });
  }
  function limparAntigas() {
    return tx("copias", "readwrite", (s) => pedido(s.getAll()).then((l) => {
      const ord = (t) => l.filter((x) => x.tipo === t).sort((a, b) => b.quando.localeCompare(a.quando));
      ord("diaria").slice(MAX_DIARIAS).concat(ord("seguranca").slice(MAX_SEGURANCA)).forEach((x) => s.delete(x.chave));
    }));
  }
  // a cópia do dia guarda o estado da PRIMEIRA abertura/alteração do dia:
  // se algo for apagado hoje, a cópia de hoje ainda tem tudo
  function copiaDoDia(d) {
    if (!temDados(d)) return Promise.resolve();
    const chave = "dia-" + N.hoje(0);
    return tx("copias", "readonly", (s) => pedido(s.get(chave))).then((ja) => ja ? null : gravarCopia(chave, "diaria", textoDados(d), d)).catch(() => {});
  }
  function copiaDeSeguranca(motivo) {
    const d = A.carregarDados();
    if (!temDados(d)) return Promise.resolve();
    return gravarCopia("seg-" + Date.now(), "seguranca", textoDados(d), Object.assign({}, d, { usuarios: [Object.assign({}, d.usuarios[0], { nome: motivo })] }));
  }
  function lerCopia(chave) { return tx("copias", "readonly", (s) => pedido(s.get(chave))); }

  // antes de substituir ou apagar dados, guarda uma cópia de segurança
  A.substituirSemCopia = A.substituir; // usado pelo "Desfazer" (não gasta as cópias de segurança)
  [["substituir", "antes de restaurar"], ["resetCompleto", "antes do reset"], ["limparRegistros", "antes de limpar"], ["carregarExemplo", "antes do exemplo"]].forEach((x) => {
    const orig = A[x[0]];
    A[x[0]] = function () { copiaDeSeguranca(x[1]); return orig.apply(this, arguments); };
  });
  const apagarGrupoOrig = A.apagarGrupo;
  A.apagarGrupo = function (d, chave) {
    const g = A.GRUPOS_EXCLUSAO[chave];
    if (temDados(d)) gravarCopia("seg-" + Date.now(), "seguranca", textoDados(d), Object.assign({}, d, { usuarios: [{ nome: "antes de excluir " + (g ? g.rotulo.toLowerCase() : chave) }] }));
    return apagarGrupoOrig.apply(this, arguments);
  };

  // ---------------------------------------------------------------------
  // 3a. pasta automática (Chrome/Edge no computador)
  // ---------------------------------------------------------------------
  const suportaPasta = () => "showDirectoryPicker" in global && global.isSecureContext;
  function carregarPasta() {
    if (!suportaPasta()) return Promise.resolve(null);
    return tx("ajustes", "readonly", (s) => pedido(s.get("pasta"))).then((h) => {
      estado.pasta = h || null;
      if (!h) { estado.permissaoPasta = null; return null; }
      return h.queryPermission({ mode: "readwrite" }).then((p) => { estado.permissaoPasta = p; return h; });
    }).catch(() => null);
  }
  function escolherPasta() {
    if (!suportaPasta()) { UI.toast("Este navegador não grava em pastas. Use o backup em 1 toque."); return; }
    global.showDirectoryPicker({ id: "meu-controle", mode: "readwrite", startIn: "documents" }).then((h) => {
      estado.pasta = h; estado.permissaoPasta = "granted";
      return tx("ajustes", "readwrite", (s) => { s.put(h, "pasta"); }).then(() => gravarNaPasta(true));
    }).then(() => {
      const d = global.App.dados();
      d.config.backup = Object.assign({}, d.config.backup, { pasta: estado.pasta ? estado.pasta.name : null });
      global.App.salvar(`Backup automático ligado na pasta “${estado.pasta.name}”.`, { semIntegracao: true });
    }).catch((e) => { if (e && e.name !== "AbortError") UI.toast("Não consegui usar essa pasta: " + e.message); });
  }
  function reativarPasta() {
    if (!estado.pasta) { escolherPasta(); return; }
    estado.pasta.requestPermission({ mode: "readwrite" }).then((p) => {
      estado.permissaoPasta = p;
      if (p === "granted") return gravarNaPasta(true).then(() => { UI.toast("Backup automático reativado."); global.App.renderizar(); });
      UI.toast("Sem permissão, o backup automático fica pausado.");
    }).catch(() => {});
  }
  function desligarPasta() {
    tx("ajustes", "readwrite", (s) => { s.delete("pasta"); }).catch(() => {}).then(() => {
      estado.pasta = null; estado.permissaoPasta = null;
      const d = global.App.dados();
      d.config.backup = Object.assign({}, d.config.backup, { pasta: null });
      global.App.salvar("Backup automático na pasta desligado.", { semIntegracao: true });
    });
  }
  let gravandoPasta = null;
  function gravarNaPasta(forcar) {
    const d = A.carregarDados();
    if (!estado.pasta || estado.permissaoPasta !== "granted" || (!forcar && !temDados(d))) return Promise.resolve(false);
    if (gravandoPasta) return gravandoPasta;
    const texto = JSON.stringify(Object.assign({}, d, { config: Object.assign({}, d.config, { ultimoBackup: new Date().toISOString() }) }), null, 1);
    const escrever = (nome) => estado.pasta.getFileHandle(nome, { create: true }).then((f) => f.createWritable()).then((w) => w.write(texto).then(() => w.close()));
    gravandoPasta = escrever("meu-controle-backup.json")
      .then(() => escrever(nomeArquivo()))
      .then(() => limparPasta())
      .then(() => {
        estado.ultimaGravacaoPasta = new Date(); estado.erroPasta = null;
        // os dados podem ter sido trocados enquanto gravava (restaurar, reset, desfazer):
        // marca a data nos dados de AGORA, nunca regrava o objeto antigo
        const atual = A.carregarDados();
        if (atual !== d) return true;
        atual.config.ultimoBackup = estado.ultimaGravacaoPasta.toISOString();
        atual.config.backup = Object.assign({}, atual.config.backup, { ultimoAuto: atual.config.ultimoBackup, pasta: estado.pasta.name });
        A.salvarDados(atual, true, true);
        return true;
      })
      .catch((e) => { estado.erroPasta = e.message; if (e.name === "NotAllowedError") estado.permissaoPasta = "prompt"; return false; })
      .finally(() => { gravandoPasta = null; });
    return gravandoPasta;
  }
  // mantém só os backups diários mais recentes na pasta
  async function limparPasta() {
    const nomes = [];
    for await (const [nome] of estado.pasta.entries()) if (/^meu-controle-backup-\d{4}-\d{2}-\d{2}\.json$/.test(nome)) nomes.push(nome);
    nomes.sort().reverse().slice(MAX_ARQUIVOS_PASTA).forEach((n) => estado.pasta.removeEntry(n).catch(() => {}));
  }

  // ---------------------------------------------------------------------
  // 3b. backup em 1 toque (celular: compartilhar; computador: baixar)
  // ---------------------------------------------------------------------
  function backupAgora() {
    const d = global.App.dados();
    const agora = new Date().toISOString();
    // o arquivo já leva a data do backup; nos dados, ela só é marcada se der certo
    const texto = JSON.stringify(Object.assign({}, d, { config: Object.assign({}, d.config, { ultimoBackup: agora }) }), null, 1);
    const marcar = (msg) => { d.config.ultimoBackup = agora; d.config.backup = Object.assign({}, d.config.backup, { adiadoAte: null }); global.App.salvar(msg, { semIntegracao: true }); };
    let arquivo = null;
    try { arquivo = new File([texto], nomeArquivo(), { type: "application/json" }); } catch (e) { /* navegador antigo */ }
    const celular = window.matchMedia("(pointer: coarse)").matches;
    if (celular && arquivo && navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      navigator.share({ files: [arquivo], title: "Backup do Meu Controle", text: "Backup do Meu Controle de " + UI.dataBR(N.hoje(0)) })
        .then(() => marcar("Backup enviado. Guarde no Drive, no iCloud ou numa conversa sua."))
        .catch((e) => { if (!e || e.name !== "AbortError") { A.baixarArquivo(nomeArquivo(), texto, "application/json"); marcar("Backup salvo nos downloads."); } });
      return;
    }
    A.baixarArquivo(nomeArquivo(), texto, "application/json");
    marcar("Backup salvo — veja a pasta de downloads.");
  }
  function adiar(dias) {
    const d = global.App.dados();
    d.config.backup = Object.assign({}, d.config.backup, { adiadoAte: N.hoje(dias || 1) });
    global.App.salvar(null, { semIntegracao: true });
  }
  function intervalo(d) { return Number((d.config.backup || {}).intervalo) || 7; }
  function diasDesde(d) {
    if (!d.config.ultimoBackup) return null;
    return N.diasEntre(N.isoLocal(new Date(d.config.ultimoBackup)), N.hoje(0));
  }
  // o lembrete aparece quando passou o intervalo e não há pasta automática funcionando
  function precisaLembrar(d) {
    if (!temDados(d)) return false;
    const b = d.config.backup || {};
    if (b.intervalo === 0) return false;
    if (b.adiadoAte && b.adiadoAte > N.hoje(0)) return false;
    if (estado.pasta && estado.permissaoPasta === "granted") return false;
    const dias = diasDesde(d);
    return dias == null ? contar(d).registros >= 5 : dias >= intervalo(d);
  }
  function cartaoHoje(d) {
    if (!precisaLembrar(d)) return "";
    const dias = diasDesde(d);
    const pausada = estado.pasta && estado.permissaoPasta !== "granted";
    return `<section class="card aviso-backup">
      <span class="ab-ic">🛟</span>
      <div class="ab-txt"><b>${pausada ? "Backup automático pausado" : dias == null ? "Faça o primeiro backup" : `Último backup há ${dias} dias`}</b>
        <small>${pausada ? "O navegador pediu para confirmar o acesso à pasta de backup." : "Seus dados ficam só neste aparelho. Uma cópia fora dele evita perder tudo se o aparelho sumir ou for formatado."}</small></div>
      <div class="botoes-linha">${pausada ? `<button class="btn primario" data-acao="backup-reativar-pasta">Reativar</button>` : `<button class="btn primario" data-acao="backup-agora">${UI.svg("download")}Fazer backup</button>`}<button class="btn" data-acao="backup-adiar">Amanhã</button></div>
    </section>`;
  }

  // ---------------------------------------------------------------------
  // cartão de Ajustes
  // ---------------------------------------------------------------------
  function fmtQuando(iso) {
    const dt = new Date(iso);
    return UI.rotuloRelativo(N.isoLocal(dt)) + ", " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function cartaoAjustes(d) {
    if (estado.copias == null) { estado.copias = []; listar().then(() => { if (global.App.rota().secao === "configuracoes") global.App.renderizar(); }); }
    const b = d.config.backup || {};
    const ult = d.config.ultimoBackup ? fmtQuando(d.config.ultimoBackup) : "nunca";
    const pastaOk = estado.pasta && estado.permissaoPasta === "granted";
    const copias = estado.copias || [];
    const persist = estado.persistente === true ? "✅ Ativa — o navegador não apaga os dados sozinho." : estado.persistente === "indisponivel" ? "Não disponível neste navegador." : "O navegador ainda não concedeu (no iPhone, instale o app para ficar protegido).";
    return UI.card({ titulo: "Backup e restauração", sub: `último backup: ${ult}`, id: "sec-backup", corpo: `<div class="pad bk">
      <div class="bk-camadas">
        <div class="bk-camada"><span>🛡️</span><div><b>Proteção do navegador</b><small>${persist}</small></div></div>
        <div class="bk-camada"><span>🗂️</span><div><b>Cópias automáticas neste aparelho</b><small>${copias.length ? `${copias.length} ${UI.plural(copias.length, "cópia guardada", "cópias guardadas")} — uma por dia e antes de restaurar ou apagar algo.` : "Começam a ser feitas a partir de hoje."}</small></div></div>
        <div class="bk-camada${pastaOk ? " ok" : ""}"><span>☁️</span><div><b>Backup automático numa pasta</b><small>${!suportaPasta() ? "Disponível no Chrome ou Edge do computador. No celular, use o backup em 1 toque." : pastaOk ? `Ligado em “${esc(estado.pasta.name)}”. Grava sozinho depois das alterações${b.ultimoAuto ? " · último: " + fmtQuando(b.ultimoAuto) : ""}.` : estado.pasta ? "Pausado: o navegador pede para confirmar o acesso à pasta." : "Escolha a pasta do Google Drive, OneDrive ou Dropbox do computador e o backup vai para a nuvem sozinho."}</small>
          ${suportaPasta() ? `<div class="botoes-linha">${pastaOk ? `<button class="btn pequeno" data-acao="backup-pasta">Trocar pasta</button><button class="btn pequeno" data-acao="backup-desligar-pasta">Desligar</button>` : estado.pasta ? `<button class="btn pequeno primario" data-acao="backup-reativar-pasta">Reativar</button><button class="btn pequeno" data-acao="backup-desligar-pasta">Desligar</button>` : `<button class="btn pequeno primario" data-acao="backup-pasta">Escolher pasta</button>`}</div>` : ""}</div></div>
      </div>
      <div class="botoes-linha">
        <button class="btn primario" data-acao="backup-agora">${UI.svg("download")}Fazer backup agora</button>
        <button class="btn" data-acao="importar-backup">${UI.svg("upload")}Restaurar de um arquivo</button>
        <button class="btn" data-acao="copiar-backup">${UI.svg("copiar")}Copiar como texto</button>
        <button class="btn" data-acao="colar-backup">Colar texto</button>
      </div>
      <label class="linha-sel"><span><b>Lembrar de fazer backup</b><small>Um aviso na tela Hoje (some quando a pasta automática está ligada).</small></span>
        <select class="sel" data-mudar="backup-intervalo">${UI.opcoes([{ v: 3, r: "a cada 3 dias" }, { v: 7, r: "toda semana" }, { v: 14, r: "a cada 2 semanas" }, { v: 30, r: "todo mês" }, { v: 0, r: "não lembrar" }], b.intervalo == null ? 7 : b.intervalo)}</select></label>
      ${copias.length ? `<details class="bk-copias"><summary>Restaurar uma cópia automática (${copias.length})</summary>
        <ul>${copias.map((c) => `<li><div><b>${c.tipo === "diaria" ? "Início do dia" : "Cópia de segurança"}</b><small>${fmtQuando(c.quando)}${c.tipo === "seguranca" ? " · " + esc(c.nome) : ""} · ${c.registros} registros · ${UI.numAuto(c.tamanho / 1024, 0)} KB</small></div>
          <span><button class="btn pequeno" data-acao="backup-baixar-copia" data-k="${esc(c.chave)}" title="Baixar como arquivo">${UI.svg("download")}</button><button class="btn pequeno" data-acao="backup-restaurar-copia" data-k="${esc(c.chave)}">Restaurar</button></span></li>`).join("")}</ul></details>` : ""}
      <div class="sechead">Exportação</div>
      <div class="botoes-linha"><button class="btn" data-acao="exportar-planilha">${UI.svg("download")}Tudo em Excel (.xlsx)</button><button class="btn" data-acao="ir" data-secao="relatorios">Relatório do período</button></div>
    </div>` });
  }

  // ---------------------------------------------------------------------
  // ganchos
  // ---------------------------------------------------------------------
  let timerPasta = null;
  global.App.aoSalvar((d, abertura) => {
    copiaDoDia(d);
    if (estado.pasta && estado.permissaoPasta === "granted") {
      clearTimeout(timerPasta);
      // grava 20 s depois da última alteração (várias marcações seguidas viram uma gravação só)
      timerPasta = setTimeout(() => gravarNaPasta(), abertura ? 3000 : 20000);
    }
  });
  // ao sair/minimizar, grava o que estiver pendente
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && timerPasta) { clearTimeout(timerPasta); timerPasta = null; gravarNaPasta(); }
  });

  global.App.registrarAcoes({
    "backup-agora": backupAgora,
    "backup-adiar": () => adiar(1),
    "backup-pasta": escolherPasta,
    "backup-reativar-pasta": reativarPasta,
    "backup-desligar-pasta": () => UI.confirmar({ titulo: "Desligar backup na pasta", texto: "O app para de gravar na pasta. Os arquivos que já estão lá continuam.", rotulo: "Desligar", perigo: false, aoConfirmar: desligarPasta }),
    "backup-restaurar-copia": (el) => lerCopia(el.dataset.k).catch(() => null).then((c) => {
      if (!c) { UI.toast("Não consegui ler essa cópia. Recarregue o app e tente de novo."); return; }
      UI.confirmar({ titulo: "Restaurar cópia", html: `Voltar todos os dados para a cópia de <b>${esc(fmtQuando(c.quando))}</b> (${c.registros} registros)? Os dados de agora ficam guardados numa cópia de segurança, caso mude de ideia.`, rotulo: "Restaurar",
        aoConfirmar: () => { try { global.App.substituirDados(A.substituir(JSON.parse(c.texto))); UI.toast("Cópia restaurada."); } catch (e) { UI.toast("Cópia danificada: " + e.message); } } });
    }),
    "backup-baixar-copia": (el) => lerCopia(el.dataset.k).catch(() => null).then((c) => { if (!c) { UI.toast("Não consegui ler essa cópia."); return; } A.baixarArquivo("meu-controle-copia-" + c.quando.slice(0, 10) + ".json", c.texto, "application/json"); })
  });
  global.App.registrarMudancas({
    "backup-intervalo": (el) => { const d = global.App.dados(); d.config.backup = Object.assign({}, d.config.backup, { intervalo: Number(el.value) }); global.App.salvar(null, { semIntegracao: true }); }
  });

  protegerArmazenamento();
  carregarPasta().then(() => { if (global.App.dados()) global.App.renderizar(); });

  global.Backup = { estado, protegerArmazenamento, copiaDoDia, copiaDeSeguranca, listar, lerCopia, escolherPasta, gravarNaPasta, backupAgora, precisaLembrar, cartaoHoje, cartaoAjustes, suportaPasta, temDados };
})(window);
