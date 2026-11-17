/**
 * paginas/configuracoes.js — "Ajustes", na ordem em que se usa: perfil,
 * integração, alertas, backup, e por fim exclusão de dados e reset
 * (sempre com confirmação).
 */
(function () {
  "use strict";

  const N = window.Nucleo, UI = window.UI, A = window.Armazenamento, F = window.Fitness, App = window.App;
  const esc = UI.esc;

  function interruptor(id, ligado, rotulo, ajuda, mudar, dados) {
    return `<label class="interruptor"><input type="checkbox" id="${id}"${ligado ? " checked" : ""} data-mudar="${mudar}" ${dados || ""}><span class="int-trilho"><i></i></span>
      <span class="int-txt"><b>${rotulo}</b>${ajuda ? `<small>${ajuda}</small>` : ""}</span></label>`;
  }

  function perfil(d) {
    const u = d.usuarios[0];
    const imc = F.atual(d, "imc");
    return UI.card({ titulo: "Meu perfil", acoes: UI.botao("editar-perfil", "Editar", { icone: "editar" }), corpo: `
      <div class="kv"><span>Nome</span><b>${esc(u.nome || "—")}</b></div>
      <div class="kv"><span>Objetivo</span><b>${esc(u.objetivo || "—")}</b></div>
      <div class="kv"><span>Altura</span><b>${u.altura ? UI.num(u.altura, 2) + " m" : "—"}</b></div>
      <div class="kv"><span>Peso inicial</span><b>${u.pesoInicial ? UI.kg(u.pesoInicial) : F.pesoInicial(d) != null ? UI.kg(F.pesoInicial(d)) + " <small class='dim'>(1ª pesagem)</small>" : "—"}</b></div>
      <div class="kv"><span>IMC atual</span><b>${imc ? UI.num(imc.valor, 1) + " · " + F.classificacaoIMC(imc.valor) : "—"}</b></div>
      <div class="kv"><span>Início do acompanhamento</span><b>${UI.dataBR(u.dataInicio)}</b></div>` });
  }

  function alertas(d) {
    const cfg = d.config.alertas;
    return UI.card({ titulo: "Alertas", sub: "escolha o que deve aparecer no sino de notificações", id: "sec-alertas", corpo: `<div class="pad lista-interruptores">
      ${Object.keys(A.TIPOS_ALERTA).map((k) => interruptor("al_" + k, cfg[k] !== false, A.TIPOS_ALERTA[k], "", "alerta-toggle", `data-k="${k}"`)).join("")}
      <div class="campo campo-inline"><label for="cfg_dias">Avisar quando ficar sem pesar por</label><input id="cfg_dias" type="number" min="1" max="60" value="${d.config.diasSemPesagem || 7}" data-mudar="cfg-dias-peso"> <span>dias</span></div>
    </div>` });
  }

  function integracao(d) {
    const i = d.config.integracao;
    return UI.card({ titulo: "Integração", sub: "como alimentação, compras e estoque conversam", id: "sec-integracao", corpo: `<div class="pad lista-interruptores">
      ${interruptor("in_lista", i.listaAutomatica, "Lista de compras automática", "O que faltar para as refeições planejadas (e para manter o estoque mínimo) entra sozinho na lista, marcado como “auto”.", "integ-toggle", 'data-k="listaAutomatica"')}
      <div class="campo campo-inline"><label for="cfg_diasplan">Olhar o planejamento dos próximos</label><select id="cfg_diasplan" data-mudar="cfg-dias-plan">${UI.opcoes([3, 5, 7, 10, 14].map((v) => ({ v, r: String(v) })), i.diasPlanejamento)}</select> <span>dias</span></div>
      ${interruptor("in_comer", i.baixarEstoqueAoComer, "Refeição realizada desconta do estoque", "Ao marcar uma refeição como realizada, os alimentos saem do estoque (e voltam se desmarcar).", "integ-toggle", 'data-k="baixarEstoqueAoComer"')}
      ${interruptor("in_comprar", i.somarEstoqueAoComprar, "Item comprado entra no estoque", "Ao marcar um item da lista como comprado, a quantidade é somada ao estoque do alimento.", "integ-toggle", 'data-k="somarEstoqueAoComprar"')}
    </div>` });
  }

  function backup(d) { return window.Backup.cartaoAjustes(d); }

  function exclusao(d) {
    const grupos = A.GRUPOS_EXCLUSAO;
    return UI.card({ titulo: "Excluir dados", sub: "apague só uma parte — sempre com confirmação", corpo: `<div class="lista-exclusao">${Object.keys(grupos).map((k) => {
      const n = grupos[k].colecoes.reduce((s, c) => s + d[c].length, 0);
      return `<div class="kv"><span><b>${grupos[k].rotulo}</b><small class="dim">${grupos[k].ajuda}</small></span><b><span class="dim">${n} ${UI.plural(n, "registro", "registros")}</span> <button class="btn pequeno perigo" data-acao="apagar-grupo" data-k="${k}"${n ? "" : " disabled"}>Excluir</button></b></div>`;
    }).join("")}</div>
      <div class="pad zona-perigo"><div><b>Reset completo</b><p class="ajuda">Apaga absolutamente tudo (perfil, registros, metas e configurações) e volta à tela inicial.</p></div><button class="btn perigo" data-acao="reset-completo">${UI.svg("lixo")}Resetar o sistema</button></div>` });
  }

  function privacidade(d) {
    const kb = A.usoArmazenamento() / 1024;
    return UI.card({ titulo: "Privacidade e exemplo", corpo: `<div class="pad texto-integ">
        <p><b>100% local.</b> Os dados ficam só neste navegador (<code>localStorage</code>) — nada é enviado para servidor. Limpar os dados de navegação apaga tudo; use o backup para levar seus dados.</p>
        <p>${d.demo ? `<button class="btn perigo pequeno" data-acao="remover-demo">Apagar exemplo e começar do zero</button>` : `<button class="btn pequeno" data-acao="carregar-demo">Carregar dados de exemplo</button>`} <span class="dim">o exemplo é fictício e substitui os dados atuais</span></p>
        <p class="dim">Espaço usado: ${kb < 1024 ? UI.numAuto(kb, 0) + " KB" : UI.num(kb / 1024, 1) + " MB"} · versão ${App.VERSAO_APP} · dados v${d.versao}</p></div>` });
  }

  // -------------------------------------------------------------------
  // Ajustes em categorias: uma lista (como os Ajustes do celular) e, ao
  // tocar, a página só daquele assunto. No computador, lista e página
  // ficam lado a lado. Cada item tem palavras-chave para a busca.
  // -------------------------------------------------------------------
  const PZ = () => window.Personalizar, AR = () => window.Areas;
  const GRUPOS = [
    { r: "Você", itens: [
      { k: "aparencia", ic: "🎨", r: "Aparência", s: "Temas, cores, letra, fundo e avatar", p: "tema claro escuro cor fonte letra tamanho fundo cantos avatar nome saudacao animacoes vibrar contraste copo", cartoes: (d) => [PZ().cartaoAparencia(d)] },
      { k: "perfil", ic: "👤", r: "Meu perfil", s: "Nome, altura, objetivo e peso inicial", p: "nome altura objetivo imc peso inicial idade sexo", cartoes: (d) => [perfil(d)] }
    ] },
    { r: "O app do seu jeito", itens: [
      { k: "areas", ic: "🧩", r: "O que você usa", s: "Ligue só as áreas que fazem sentido", p: "areas perfis prontos desligar esconder treino alimentacao compras remedios jejum crianca", cartoes: (d) => [AR().cartaoAreas(d)] },
      { k: "navegacao", ic: "🧭", r: "Navegação", s: "Menu, abas, botão + e tela inicial", p: "menu ordem abas barra celular botao mais registro rapido tela inicial atalhos teclado esquerda canhoto", cartoes: (d) => [window.Navegacao.cartaoAjustes(d)] },
      { k: "hoje", ic: "🏠", r: "Tela Hoje", s: "Quais cartões aparecem e em que ordem", p: "cartoes destaque ordem esconder dica do dia concluidos recolher", cartoes: (d) => [AR().cartaoHoje(d)] },
      { k: "rotina", ic: "🕒", r: "Rotina do dia", s: "Horários, refeições e o roteiro", p: "horarios acordar dormir refeicoes pesagem roteiro seu dia", cartoes: (d) => [PZ().cartaoRotina(d)] }
    ] },
    { r: "Avisos", itens: [
      { k: "lembretes", ic: "🔔", r: "Lembretes", s: "Notificações de remédios, hábitos e água", p: "notificacoes avisos remedio agua habito checkin calendario ics", cartoes: (d) => [window.Lembretes.cartaoAjustes(d)] },
      { k: "alertas", ic: "🛎️", r: "Alertas do sino", s: "O que aparece nas notificações do app", p: "sino alertas estoque meta backup pesagem", cartoes: (d) => [alertas(d)] },
      { k: "agenda", ic: "📅", r: "Google Agenda", s: "Alertas mesmo com o app fechado", p: "google calendario agenda eventos relogio", se: () => !!window.Agenda, cartoes: (d) => [window.Agenda.cartaoAjustes(d)] }
    ] },
    { r: "Seus dados", itens: [
      { k: "backup", ic: "🛟", r: "Backup", s: "Cópia de segurança e restauração", p: "backup restaurar exportar importar planilha copia seguranca pasta", cartoes: (d) => [backup(d)] },
      { k: "sync", ic: "🔄", r: "Sincronização", s: "Os mesmos dados em todos os aparelhos", p: "sincronizar aparelhos github qr code conta celular computador", se: () => !!window.Sync, cartoes: () => [window.Sync.cartaoAjustes()] },
      { k: "seguranca", ic: "🔒", r: "Segurança", s: "Bloqueio com PIN, Face ID ou digital", p: "pin senha bloqueio face id digital biometria travar", se: () => !!window.Trava, cartoes: () => [window.Trava.cartaoAjustes()] },
      { k: "integracao", ic: "🔗", r: "Integração", s: "Como comida, compras e estoque conversam", p: "lista automatica estoque planejamento desconta", cartoes: (d) => [integracao(d)] },
      { k: "dados", ic: "🗑️", r: "Excluir dados e exemplo", s: "Apagar partes, resetar ou ver o exemplo", p: "excluir apagar reset zerar dados exemplo demo privacidade espaco", cartoes: (d) => [privacidade(d), exclusao(d)] }
    ] },
    { r: "Ajuda", itens: [
      { k: "ajuda", ic: "💡", r: "Central de ajuda", s: "Como fazer cada coisa, dicas e glossário", p: "ajuda como faco duvidas perguntas glossario dicas", rota: "ajuda" },
      { k: "tutoriais", ic: "❓", r: "Tutoriais", s: "O passo a passo de cada tela", p: "tutorial tour passo a passo configuracao inicial novidades", cartoes: (d) => [window.Tutorial.cartaoAjustes(d)] },
      { k: "instalar", ic: "📲", r: "Instalar o app", s: "Ícone na tela de início e uso offline", p: "instalar pwa icone tela de inicio offline", se: () => !!window.Instalar, cartoes: () => [window.Instalar.cartaoAjustes()] }
    ] }
  ];
  const itens = () => GRUPOS.reduce((l, g) => l.concat(g.itens.filter((i) => !i.se || i.se())), []);
  // nomes antigos (links e alertas já salvos) → categoria atual
  const APELIDOS = { exclusao: "dados", privacidade: "dados", abas: "navegacao", sincronizar: "sync" };
  function itemDe(param) {
    const k = APELIDOS[param] || param;
    return itens().find((i) => i.k === k && !i.rota) || null;
  }
  const semAcento = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  function lista(d, atual) {
    return `<nav class="aj-lista" aria-label="Categorias de ajustes">
      <label class="aj-busca">${UI.svg("buscar")}<input type="search" placeholder="Buscar nos ajustes" data-digitar="aj-busca" autocomplete="off" aria-label="Buscar nos ajustes"></label>
      ${GRUPOS.map((g) => { const l = g.itens.filter((i) => !i.se || i.se()); return l.length ? `<div class="aj-grupo"><span class="aj-rot">${g.r}</span><div class="aj-itens">${l.map((i) => `<button class="aj-item${atual && atual.k === i.k ? " ativo" : ""}" data-acao="ir" data-secao="${i.rota || "configuracoes"}"${i.rota ? "" : ` data-param="${i.k}"`} data-p="${esc(semAcento(i.r + " " + i.s + " " + i.p))}"><span class="aj-ic">${i.ic}</span><span class="aj-txt"><b>${i.r}</b><small>${i.s}</small></span><i class="aj-seta">›</i></button>`).join("")}</div></div>` : ""; }).join("")}
      <p class="aj-vazio" hidden>Nada encontrado nos ajustes. <button class="link-acao" data-acao="busca-abrir">Buscar no app todo</button></p>
      <div class="aj-rodape"><button class="btn pequeno" data-acao="primeiro-uso">✨ Configuração inicial</button><span class="dim">Meu Controle v${App.VERSAO_APP}</span></div>
    </nav>`;
  }

  App.registrarPagina("configuracoes", {
    titulo: "Ajustes",
    render(d, rota) {
      const sel = rota.param ? itemDe(rota.param) : null;
      const item = sel || itemDe("aparencia");
      return `<div class="cabecalho-pagina cab-ajustes${sel ? " com-item" : ""}"><div><h1>Ajustes</h1><p class="sub">Deixe o app do seu jeito e mantenha seus dados seguros</p></div></div>
        <div class="aj${sel ? " com-item" : " sem-item"}">
          ${lista(d, sel || item)}
          <section class="aj-detalhe" aria-label="${esc(item.r)}">
            <button class="voltar aj-voltar" data-acao="ir" data-secao="configuracoes">${UI.svg("voltar")}Ajustes</button>
            <h2 class="aj-titulo"><span>${item.ic}</span>${esc(item.r)}</h2>
            <div class="aj-cartoes">${item.cartoes(d).join("")}</div>
          </section>
        </div>`;
    },
    depois(d, rota) {
      // deixa os personagens de anime prontos para quando abrir "Editar avatar"
      if (window.Avatar) setTimeout(() => window.Avatar.preaquecer(), 1500);
      // o item escolhido fica à vista na lista (computador)
      const at = document.querySelector(".aj-item.ativo");
      if (at && rota.param && at.scrollIntoView && window.matchMedia("(min-width: 861px)").matches) { try { at.scrollIntoView({ block: "nearest" }); } catch (e) { /* navegador antigo */ } }
    }
  });
  window.Ajustes = { GRUPOS, itens, itemDe };

  App.registrarAcoes({
    "exportar-backup": () => window.Backup.backupAgora(),
    "importar-backup": () => document.getElementById("inputImportarBackup").click(),
    "exportar-planilha": () => { window.Relatorios.exportarTudoXLSX(App.dados()); UI.toast("Planilha exportada."); },
    "copiar-backup": () => {
      const texto = JSON.stringify(App.dados());
      const m = UI.abrirModal(`<h3>Copiar backup</h3><p class="ajuda" style="margin-top:0">Guarde este texto num arquivo ou nota. Para restaurar, use “Colar texto de backup”.</p>
        <div class="campo"><textarea id="f_backup" rows="8" readonly class="mono">${esc(texto)}</textarea></div>
        <div class="modal-acoes"><button class="btn primario salvar" id="btnCopiar">Copiar</button><button class="btn" data-acao="fechar-modal">Fechar</button></div>`, { largo: true, semFoco: true });
      m.querySelector("#btnCopiar").onclick = () => {
        const ta = m.querySelector("#f_backup");
        const sel = () => { ta.select(); UI.toast("Texto selecionado: use Ctrl/⌘ + C."); };
        try { navigator.clipboard.writeText(texto).then(() => UI.toast("Backup copiado.")).catch(sel); } catch (e) { sel(); }
      };
    },
    "colar-backup": () => {
      const m = UI.abrirModal(`<h3>Colar backup</h3><p class="ajuda" style="margin-top:0">Cole o texto copiado antes. Isso <b>substitui todos os dados atuais</b>.</p>
        <div class="campo"><textarea id="f_backup" rows="8" class="mono" placeholder='{"versao":2,…}'></textarea></div>
        <div class="modal-acoes"><button class="btn perigo salvar" id="btnRestaurar">Restaurar</button><button class="btn" data-acao="fechar-modal">Cancelar</button></div>`, { largo: true });
      m.querySelector("#btnRestaurar").onclick = () => {
        let obj;
        try { obj = JSON.parse(m.querySelector("#f_backup").value); } catch (e) { obj = null; }
        if (!A.validarBackup(obj)) { UI.toast("Esse texto não é um backup do Meu Controle."); return; }
        UI.confirmar({ titulo: "Restaurar backup", texto: "Substituir TODOS os dados atuais pelo backup colado?", rotulo: "Restaurar", aoConfirmar: () => { App.substituirDados(A.substituir(obj)); UI.toast("Backup restaurado."); } });
      };
    },
    "apagar-grupo": (el) => {
      const g = A.GRUPOS_EXCLUSAO[el.dataset.k];
      const d = App.dados();
      const n = g.colecoes.reduce((s, c) => s + d[c].length, 0);
      UI.confirmar({ titulo: "Excluir " + g.rotulo.toLowerCase(), texto: `Isso apaga ${n} ${UI.plural(n, "registro", "registros")} (${g.ajuda.toLowerCase()}) e não pode ser desfeito depois que você sair desta tela. Exporte um backup antes se quiser guardar.`, rotulo: "Excluir",
        aoConfirmar: () => App.comDesfazer(g.rotulo + " excluídos.", () => A.apagarGrupo(d, el.dataset.k)) });
    },
    "reset-completo": () => UI.confirmar({ titulo: "Resetar o sistema", html: "Isso apaga <b>TODOS</b> os dados deste navegador: perfil, registros, metas, fotos e configurações. Não há como desfazer. Faça um backup antes se quiser guardar alguma coisa.", rotulo: "Apagar tudo", digitar: "APAGAR",
      aoConfirmar: () => { if (window.Imagens) window.Imagens.limparTudo(); App.substituirDados(A.resetCompleto()); App.ir("dashboard"); UI.toast("Sistema resetado."); setTimeout(() => window.PrimeiroUso && window.PrimeiroUso.abrir(), 400); } })
  });
  App.registrarMudancas({
    "aj-busca": (el) => {
      const q = semAcento(el.value.trim()).split(/\s+/).filter(Boolean);
      let n = 0;
      document.querySelectorAll(".aj-lista .aj-item").forEach((b) => { const ok = q.every((t) => b.dataset.p.indexOf(t) !== -1); b.hidden = !ok; if (ok) n++; });
      document.querySelectorAll(".aj-lista .aj-grupo").forEach((g) => { g.hidden = !g.querySelector(".aj-item:not([hidden])"); });
      const v = document.querySelector(".aj-lista .aj-vazio"); if (v) v.hidden = n > 0;
    },
    "alerta-toggle": (el) => { App.dados().config.alertas[el.dataset.k] = el.checked; App.salvar(null, { semIntegracao: true }); },
    "integ-toggle": (el) => { App.dados().config.integracao[el.dataset.k] = el.checked; App.salvar(el.dataset.k === "listaAutomatica" ? (el.checked ? "Lista automática ligada." : "Lista automática desligada (itens automáticos pendentes continuam até você removê-los).") : "Configuração salva."); },
    "cfg-dias-peso": (el) => { App.dados().config.diasSemPesagem = Math.max(1, Number(el.value) || 7); App.salvar(null, { semIntegracao: true }); },
    "cfg-dias-plan": (el) => { App.dados().config.integracao.diasPlanejamento = Number(el.value) || 7; App.salvar("Configuração salva."); },
    "cfg-copo": (el) => { App.dados().config.copoAgua = Math.max(50, Number(el.value) || 250); App.salvar(null, { semIntegracao: true }); }
  });
})();
