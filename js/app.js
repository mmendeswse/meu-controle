/**
 * app.js — Meu Controle
 * -----------------------------------------------------------------------
 * Núcleo da interface: carrega os dados, roteia entre as páginas,
 * distribui os cliques (delegação por data-acao), salva e redesenha.
 *
 * Cada página vive em js/paginas/<nome>.js e se registra assim:
 *
 *   App.registrarPagina("compras", {
 *     titulo: "Compras",
 *     render(d, rota)  { return "<html>"; },   // obrigatório
 *     depois(d, rota)  { ...gráficos... },     // opcional
 *   });
 *   App.registrarAcoes({ "marcar-comprado": (el, ev) => { ... } });
 *   App.registrarMudancas({ "filtro-mercado": (el) => { ... } });
 *
 * Salvar sempre passa por App.salvar(), que antes de gravar roda a
 * integração (lista de compras automática a partir do planejamento e do
 * estoque mínimo) — assim as telas nunca ficam dessincronizadas.
 * -----------------------------------------------------------------------
 */
(function () {
  "use strict";

  const A = window.Armazenamento;
  const N = window.Nucleo;
  const UI = window.UI;
  const G = window.Graficos;

  const VERSAO_APP = "2.0.0";
  let DADOS = null;
  let ROTA = { secao: "dashboard", param: null };
  const PAGINAS = {};
  const ACOES = {};
  const MUDANCAS = {};
  const estado = {}; // estado de interface por página (filtros, datas…) — não é salvo

  const MENU = ["dashboard", "alimentacao", "refeicoes", "compras", "estoque", "academia", "evolucao", "metas", "relatorios", "configuracoes"];

  function registrarPagina(id, def) { PAGINAS[id] = def; }
  function registrarAcoes(mapa) { Object.assign(ACOES, mapa); }
  function registrarMudancas(mapa) { Object.assign(MUDANCAS, mapa); }

  // ---------------------------------------------------------------------
  // dados
  // ---------------------------------------------------------------------
  function dados() { return DADOS; }
  function salvar(mensagem, opc) {
    opc = opc || {};
    if (window.Compras && !opc.semIntegracao) window.Compras.sincronizarAutomaticos(DADOS);
    A.salvarDados(DADOS, true);
    renderizar();
    if (mensagem) UI.toast(mensagem, opc.desfazer);
  }
  // executa uma alteração oferecendo "Desfazer" no aviso
  function comDesfazer(mensagem, alteracao) {
    const antes = JSON.stringify(DADOS);
    alteracao();
    salvar(mensagem, { desfazer: () => { DADOS = A.substituir(JSON.parse(antes)); renderizar(); UI.toast("Alteração desfeita."); } });
  }
  function substituirDados(novo) { DADOS = novo; renderizar(); }

  // ---------------------------------------------------------------------
  // rotas
  // ---------------------------------------------------------------------
  function ir(secao, param, opc) {
    if (!PAGINAS[secao]) secao = "dashboard";
    ROTA = { secao, param: param || null };
    const hash = "#/" + secao + (param ? "/" + encodeURIComponent(param) : "");
    if (location.hash !== hash) history.replaceState(null, "", hash);
    UI.fecharModal();
    renderizar();
    if (!opc || !opc.manterRolagem) window.scrollTo(0, 0);
  }
  function lerHash() {
    const m = (location.hash || "").match(/^#\/([\w-]+)(?:\/(.+))?$/);
    return m ? { secao: m[1], param: m[2] ? decodeURIComponent(m[2]) : null } : null;
  }
  function rota() { return ROTA; }

  function renderizar() {
    const pag = PAGINAS[ROTA.secao] || PAGINAS.dashboard;
    const secaoMenu = pag.menu || ROTA.secao;
    document.querySelectorAll("#navPrincipal button").forEach((b) => b.classList.toggle("ativo", b.dataset.secao === secaoMenu));
    document.title = (pag.titulo ? pag.titulo + " · " : "") + "Meu Controle";
    G.destruirTodos();
    const cont = document.getElementById("conteudo");
    try {
      cont.innerHTML = faixaDemo() + pag.render(DADOS, ROTA);
      if (pag.depois) pag.depois(DADOS, ROTA);
    } catch (e) {
      console.error(e);
      cont.innerHTML = `<div class="vazio"><b>Algo deu errado ao montar esta tela.</b><p>${UI.esc(e.message)}</p><button class="btn" data-acao="ir" data-secao="dashboard">Voltar ao Dashboard</button></div>`;
    }
    atualizarBadge();
    atualizarRodape();
  }

  function faixaDemo() {
    if (!DADOS.demo || estado.demoOculto) return "";
    return `<div class="faixa-demo">
      <div><b>Você está vendo dados de exemplo.</b> Todos os registros são fictícios, só para mostrar o sistema funcionando.</div>
      <div class="acoes">
        <button class="btn pequeno" data-acao="ocultar-demo">Continuar explorando</button>
        <button class="btn pequeno perigo" data-acao="remover-demo">Apagar exemplo e começar do zero</button>
      </div></div>`;
  }

  // ---------------------------------------------------------------------
  // notificações
  // ---------------------------------------------------------------------
  const COR_NIVEL = { perigo: "var(--down)", aviso: "var(--acc)", sucesso: "var(--up)", info: "var(--azul)" };
  const ICONE_NIVEL = { perigo: "alerta", aviso: "aviso", sucesso: "ok", info: "info" };
  function atualizarBadge() {
    const n = window.Insights.naoLidas(DADOS).length;
    const b = document.getElementById("badgeNotificacoes");
    b.textContent = n > 9 ? "9+" : n;
    b.style.display = n ? "flex" : "none";
  }
  function preencherNotificacoes() {
    const drop = document.getElementById("dropdownNotificacoes");
    const lista = window.Insights.gerarAlertas(DADOS);
    const lidas = window.Insights.lidas(DADOS);
    drop.innerHTML = `<div class="dropdown-topo"><b>Notificações</b><button class="link-acao" data-acao="ir" data-secao="configuracoes" data-param="alertas">Configurar</button></div>` +
      (!lista.length ? `<div class="dropdown-vazio">Nenhum alerta agora. Tudo em ordem.</div>` :
        lista.map((a) => `<button class="dropdown-item${lidas[a.chave] ? " lida" : ""}" data-acao="ir" data-secao="${a.rota}">
          <span class="ic" style="color:${COR_NIVEL[a.nivel]};background:color-mix(in srgb, ${COR_NIVEL[a.nivel]} 16%, transparent)">${UI.svg(ICONE_NIVEL[a.nivel])}</span>
          <span><b>${UI.esc(a.titulo)}</b><p>${UI.esc(a.texto)}</p></span></button>`).join(""));
    window.Insights.marcarLidas(DADOS);
    A.salvarDados(DADOS, true, true);
    atualizarBadge();
  }
  function ligarNotificacoes() {
    const btn = document.getElementById("btnNotificacoes");
    const drop = document.getElementById("dropdownNotificacoes");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      fecharFab();
      drop.classList.toggle("on");
      btn.setAttribute("aria-expanded", drop.classList.contains("on"));
      if (drop.classList.contains("on")) preencherNotificacoes();
    });
    document.addEventListener("click", (e) => {
      if (!drop.contains(e.target) && !btn.contains(e.target)) drop.classList.remove("on");
    });
  }

  // ---------------------------------------------------------------------
  // botão "+" (registro rápido)
  // ---------------------------------------------------------------------
  const RAPIDO = [
    { acao: "rapido-peso", icone: "⚖️", rotulo: "Registrar peso" },
    { acao: "rapido-refeicao", icone: "🍽️", rotulo: "Registrar refeição" },
    { acao: "rapido-agua", icone: "💧", rotulo: "Registrar água" },
    { acao: "rapido-treino", icone: "🏋️", rotulo: "Registrar treino" },
    { acao: "rapido-alimento", icone: "🥦", rotulo: "Adicionar alimento" },
    { acao: "rapido-compra", icone: "🛒", rotulo: "Adicionar compra" },
    { acao: "rapido-medida", icone: "📏", rotulo: "Registrar medidas" }
  ];
  function montarFab() {
    const menu = document.getElementById("fabMenu");
    menu.innerHTML = RAPIDO.map((r) => `<button class="fab-item" data-acao="${r.acao}" role="menuitem"><span>${r.icone}</span>${r.rotulo}</button>`).join("");
    document.getElementById("fab").addEventListener("click", (e) => {
      e.stopPropagation();
      const aberto = document.body.classList.toggle("fab-aberto");
      document.getElementById("fab").setAttribute("aria-expanded", aberto);
    });
    document.addEventListener("click", (e) => { if (!e.target.closest("#fabMenu") && !e.target.closest("#fab")) fecharFab(); });
  }
  function fecharFab() {
    document.body.classList.remove("fab-aberto");
    const f = document.getElementById("fab");
    if (f) f.setAttribute("aria-expanded", "false");
  }

  // ---------------------------------------------------------------------
  // delegação de eventos
  // ---------------------------------------------------------------------
  function ligarDelegacao() {
    document.addEventListener("click", (e) => {
      const el = e.target.closest("[data-acao]");
      if (!el || el.disabled) return;
      const acao = el.dataset.acao;
      const fn = ACOES[acao];
      if (!fn) return;
      if (el.tagName === "A") e.preventDefault();
      if (el.closest("#fabMenu")) fecharFab();
      if (el.closest("#dropdownNotificacoes")) document.getElementById("dropdownNotificacoes").classList.remove("on");
      try { fn(el, e); } catch (err) { console.error(err); UI.toast("Erro: " + err.message); }
    });
    // selos e itens com role=button respondem ao teclado
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { UI.fecharModal(); fecharFab(); document.getElementById("dropdownNotificacoes").classList.remove("on"); return; }
      if ((e.key === "Enter" || e.key === " ") && e.target.matches("[role=button][data-acao]")) { e.preventDefault(); e.target.click(); }
    });
    document.addEventListener("change", (e) => {
      const el = e.target.closest("[data-mudar]");
      if (!el) return;
      const fn = MUDANCAS[el.dataset.mudar];
      if (fn) fn(el, e);
    });
    document.addEventListener("input", (e) => {
      const el = e.target.closest("[data-digitar]");
      if (!el) return;
      const fn = MUDANCAS[el.dataset.digitar];
      if (fn) fn(el, e);
    });
    document.getElementById("scrim").addEventListener("click", UI.fecharModal);
  }

  // ações globais
  registrarAcoes({
    "ir": (el) => ir(el.dataset.secao, el.dataset.param || el.dataset.id),
    "fechar-modal": () => UI.fecharModal(),
    "ocultar-demo": () => { estado.demoOculto = true; renderizar(); },
    "remover-demo": () => UI.confirmar({
      titulo: "Apagar dados de exemplo", texto: "Todos os registros fictícios serão apagados e o sistema começa do zero, pronto para os seus dados.",
      rotulo: "Apagar exemplo", aoConfirmar: () => { DADOS = A.resetCompleto(); DADOS.config.boasVindas = true; A.salvarDados(DADOS, true); ir("dashboard"); UI.toast("Pronto! Sistema zerado."); }
    }),
    "carregar-demo": () => UI.confirmar({
      titulo: "Carregar dados de exemplo", texto: "Os dados de exemplo SUBSTITUEM todos os dados atuais deste navegador. Exporte um backup antes se quiser guardar o que já registrou.",
      rotulo: "Carregar exemplo", aoConfirmar: () => { DADOS = A.carregarExemplo(); ir("dashboard"); UI.toast("Dados de exemplo carregados."); }
    })
  });

  function iniciarRelogio() {
    const rel = document.getElementById("relogioTopbar"), dat = document.getElementById("dataTopbar");
    let diaAnterior = N.hoje(0);
    const tick = () => {
      const d = new Date();
      rel.textContent = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      dat.textContent = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).replace(/\./g, "");
      // virou o dia com o app aberto: redesenha (o "hoje" mudou)
      if (N.hoje(0) !== diaAnterior) { diaAnterior = N.hoje(0); if (!UI.modalAberto()) renderizar(); }
    };
    tick();
    setInterval(tick, 15000);
  }
  function atualizarRodape() {
    const el = document.getElementById("rodapeAtualizado");
    if (el) el.textContent = DADOS.atualizadoEm ? "Atualizado " + new Date(DADOS.atualizadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Sem alterações ainda";
    const v = document.getElementById("rodapeVersao");
    if (v) v.textContent = "Meu Controle v" + VERSAO_APP;
  }
  // compacta a barra de guias até todas caberem
  function ajustarBarraGuias() {
    const sb = document.getElementById("sidebar"), nav = document.getElementById("navPrincipal");
    if (!sb || !nav) return;
    for (let n = 0; n <= 7; n++) {
      if (n) sb.setAttribute("data-compacta", String(n)); else sb.removeAttribute("data-compacta");
      if (nav.scrollWidth <= nav.clientWidth + 1) return;
    }
  }

  // dicas (tooltips): posicionadas no body para não serem cortadas pelos cards
  function ligarDicas() {
    const tip = document.createElement("div");
    tip.className = "tooltip";
    tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);
    let atual = null;
    const mostrar = (el) => {
      atual = el;
      tip.textContent = el.dataset.dica;
      tip.classList.add("on");
      const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
      let x = r.left + r.width / 2 - t.width / 2;
      x = Math.max(8, Math.min(x, window.innerWidth - t.width - 8));
      let y = r.top - t.height - 8;
      if (y < 8) y = r.bottom + 8;
      tip.style.left = x + "px"; tip.style.top = y + "px";
    };
    const esconder = () => { atual = null; tip.classList.remove("on"); };
    document.addEventListener("mouseover", (e) => { const el = e.target.closest(".dica"); if (el) mostrar(el); else if (atual) esconder(); });
    document.addEventListener("focusin", (e) => { const el = e.target.closest(".dica"); if (el) mostrar(el); });
    document.addEventListener("focusout", (e) => { if (e.target.closest(".dica")) esconder(); });
    document.addEventListener("click", (e) => { const el = e.target.closest(".dica"); if (el) { e.preventDefault(); e.stopPropagation(); if (atual === el) esconder(); else mostrar(el); } else if (atual) esconder(); }, true);
    window.addEventListener("scroll", esconder, { passive: true });
  }

  function iniciar() {
    DADOS = A.carregarDados();
    // a integração roda uma vez ao abrir (o "hoje" pode ter mudado desde a última vez)
    if (window.Compras) { window.Compras.sincronizarAutomaticos(DADOS); A.salvarDados(DADOS, true, true); }
    document.getElementById("navPrincipal").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-secao]");
      if (b) ir(b.dataset.secao);
    });
    document.getElementById("btnLogo").addEventListener("click", () => ir("dashboard"));
    document.getElementById("inputImportarBackup").addEventListener("change", (e) => {
      const arq = e.target.files[0];
      if (!arq) return;
      e.target.value = "";
      UI.confirmar({
        titulo: "Restaurar backup", texto: "Restaurar este backup SUBSTITUI todos os dados atuais deste navegador. Continuar?", rotulo: "Restaurar",
        aoConfirmar: () => A.importarDados(arq).then((d) => { DADOS = d; renderizar(); UI.toast("Backup restaurado."); }).catch((err) => UI.toast(err.message))
      });
    });
    ligarDelegacao();
    ligarNotificacoes();
    ligarDicas();
    montarFab();
    iniciarRelogio();
    ajustarBarraGuias();
    window.addEventListener("resize", ajustarBarraGuias);
    window.addEventListener("hashchange", () => { const h = lerHash(); if (h && (h.secao !== ROTA.secao || h.param !== ROTA.param)) ir(h.secao, h.param); });
    const h = lerHash();
    ir(h && PAGINAS[h.secao] ? h.secao : "dashboard", h && h.param);
  }

  window.App = { VERSAO_APP, MENU, estado, dados, salvar, comDesfazer, substituirDados, ir, rota, renderizar, registrarPagina, registrarAcoes, registrarMudancas, fecharFab };
  document.addEventListener("DOMContentLoaded", iniciar);
})();
