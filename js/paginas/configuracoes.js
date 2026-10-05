/**
 * paginas/configuracoes.js — perfil, alertas, integração, backup,
 * exportação, exclusão de dados e reset (sempre com confirmação).
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
      <div class="campo campo-inline"><label for="cfg_copo">Tamanho do copo de água</label><input id="cfg_copo" type="number" min="50" max="2000" step="50" value="${d.config.copoAgua || 250}" data-mudar="cfg-copo"> <span>ml</span></div>
    </div>` });
  }

  function backup(d) {
    const ult = d.config.ultimoBackup ? new Date(d.config.ultimoBackup).toLocaleString("pt-BR") : "nunca";
    return UI.card({ titulo: "Backup e restauração", sub: "seus dados ficam só neste navegador — guarde uma cópia", corpo: `<div class="pad">
      <div class="botoes-linha">
        <button class="btn primario" data-acao="exportar-backup">${UI.svg("download")}Fazer backup (.json)</button>
        <button class="btn" data-acao="importar-backup">${UI.svg("upload")}Restaurar backup</button>
        <button class="btn" data-acao="copiar-backup">${UI.svg("copiar")}Copiar como texto</button>
        <button class="btn" data-acao="colar-backup">Colar texto de backup</button>
      </div>
      <p class="ajuda">Último backup: <b>${ult}</b>. Restaurar substitui todos os dados atuais (o sistema pede confirmação). Backups da versão anterior do sistema também são aceitos e convertidos automaticamente.</p>
      <div class="sechead">Exportação</div>
      <div class="botoes-linha"><button class="btn" data-acao="exportar-planilha">${UI.svg("download")}Exportar tudo em Excel (.xlsx)</button><button class="btn" data-acao="ir" data-secao="relatorios">Relatórios (PDF / CSV / Excel)</button></div>
    </div>` });
  }

  function exclusao(d) {
    const grupos = A.GRUPOS_EXCLUSAO;
    return UI.card({ titulo: "Excluir dados", sub: "apague só uma parte — sempre com confirmação", corpo: `<div class="lista-exclusao">${Object.keys(grupos).map((k) => {
      const n = grupos[k].colecoes.reduce((s, c) => s + d[c].length, 0);
      return `<div class="kv"><span><b>${grupos[k].rotulo}</b><small class="dim">${grupos[k].ajuda}</small></span><b><span class="dim">${n} ${UI.plural(n, "registro", "registros")}</span> <button class="btn pequeno perigo" data-acao="apagar-grupo" data-k="${k}"${n ? "" : " disabled"}>Excluir</button></b></div>`;
    }).join("")}</div>
      <div class="pad zona-perigo"><div><b>Reset completo</b><p class="ajuda">Apaga absolutamente tudo (perfil, registros, metas e configurações) e volta à tela inicial.</p></div><button class="btn perigo" data-acao="reset-completo">${UI.svg("lixo")}Resetar o sistema</button></div>` });
  }

  function exemplo(d) {
    return UI.card({ titulo: "Dados de exemplo", sub: d.demo ? "você está vendo dados fictícios" : "os dados atuais são seus", corpo: `<div class="pad">
      ${d.demo ? `<button class="btn perigo" data-acao="remover-demo">Apagar exemplo e começar do zero</button>` : `<button class="btn" data-acao="carregar-demo">Carregar dados de exemplo</button>`}
      <p class="ajuda">O exemplo é fictício e serve só para conhecer o sistema. Carregá-lo substitui os dados atuais.</p></div>` });
  }

  function registros(d) {
    const nomes = { alimentos: "Alimentos", refeicoes: "Refeições", refeicaoItens: "Itens de refeição", favoritas: "Favoritas", agua: "Registros de água", compras: "Itens de compra", estoque: "Itens em estoque",
      fichas: "Fichas", exercicios: "Exercícios das fichas", treinos: "Treinos", series: "Exercícios registrados", planoSemanal: "Plano semanal", pesagens: "Pesagens", medidas: "Medições", metas: "Metas" };
    const kb = A.usoArmazenamento() / 1024;
    return UI.card({ titulo: "Privacidade e armazenamento", corpo: `<div class="pad texto-integ">
        <p><b>100% local.</b> Os dados ficam no armazenamento do seu navegador (<code>localStorage</code>). Nada é enviado para nenhum servidor — o sistema não tem servidor.</p>
        <p>Limpar os dados de navegação apaga tudo, e outro navegador ou aparelho começa vazio. Use o backup para levar seus dados.</p>
        <p class="dim">Espaço usado: ${kb < 1024 ? UI.numAuto(kb, 0) + " KB" : UI.num(kb / 1024, 1) + " MB"} · versão ${App.VERSAO_APP} · dados v${d.versao}</p></div>
      <div class="grade-registros">${Object.keys(nomes).map((k) => `<div class="kv"><span>${nomes[k]}</span><b>${d[k].length}</b></div>`).join("")}</div>` });
  }

  App.registrarPagina("configuracoes", {
    titulo: "Configurações",
    render(d) {
      return `<div class="cabecalho-pagina"><div><h1>Configurações</h1><p class="sub">Perfil, alertas, integração e seus dados</p></div></div>
        <div class="grid"><div class="c5">${perfil(d)}<div class="espaco"></div>${exemplo(d)}</div><div class="c7">${backup(d)}</div></div>
        <div class="grid"><div class="c6">${integracao(d)}</div><div class="c6">${alertas(d)}</div></div>
        <div class="grid"><div class="c7">${exclusao(d)}</div><div class="c5">${registros(d)}</div></div>`;
    },
    depois(d, rota) {
      if (rota.param) { const el = document.getElementById("sec-" + rota.param); if (el) { el.scrollIntoView({ block: "start" }); el.classList.add("destaque"); } }
    }
  });

  App.registrarAcoes({
    "exportar-backup": () => { A.exportarDados(); App.renderizar(); UI.toast("Backup salvo — verifique seus downloads."); },
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
    "reset-completo": () => UI.confirmar({ titulo: "Resetar o sistema", html: "Isso apaga <b>TODOS</b> os dados deste navegador: perfil, registros, metas e configurações. Não há como desfazer. Faça um backup antes se quiser guardar alguma coisa.", rotulo: "Apagar tudo", digitar: "APAGAR",
      aoConfirmar: () => { App.substituirDados(A.resetCompleto()); App.ir("dashboard"); UI.toast("Sistema resetado."); } })
  });
  App.registrarMudancas({
    "alerta-toggle": (el) => { App.dados().config.alertas[el.dataset.k] = el.checked; App.salvar(null, { semIntegracao: true }); },
    "integ-toggle": (el) => { App.dados().config.integracao[el.dataset.k] = el.checked; App.salvar(el.dataset.k === "listaAutomatica" ? (el.checked ? "Lista automática ligada." : "Lista automática desligada (itens automáticos pendentes continuam até você removê-los).") : "Configuração salva."); },
    "cfg-dias-peso": (el) => { App.dados().config.diasSemPesagem = Math.max(1, Number(el.value) || 7); App.salvar(null, { semIntegracao: true }); },
    "cfg-dias-plan": (el) => { App.dados().config.integracao.diasPlanejamento = Number(el.value) || 7; App.salvar("Configuração salva."); },
    "cfg-copo": (el) => { App.dados().config.copoAgua = Math.max(50, Number(el.value) || 250); App.salvar(null, { semIntegracao: true }); }
  });
})();
