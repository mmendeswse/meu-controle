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

  const VERSAO_APP = "3.4.0";
  let DADOS = null;
  let ROTA = { secao: "dashboard", param: null };
  const PAGINAS = {};
  const ACOES = {};
  const MUDANCAS = {};
  const estado = {}; // estado de interface por página (filtros, datas…) — não é salvo

  // menu na ordem do dia: o roteiro de hoje, depois cada área na ordem em que é usada
  const MENU = ["dashboard", "evolucao", "alimentacao", "academia", "bemestar", "compras", "metas", "relatorios", "configuracoes"];
  // telas antigas que viraram abas (links salvos e alertas continuam funcionando)
  const ALIAS = { refeicoes: ["alimentacao", "semana"], estoque: ["compras", "estoque"], habitos: ["bemestar", "habitos"], remedios: ["bemestar", "remedios"],
    jejum: ["bemestar", "jejum"], conquistas: ["metas", "conquistas"] };
  const POS_RENDER = []; // funções chamadas depois de cada tela desenhada (tutoriais…)
  const POS_SALVAR = []; // funções chamadas depois de cada salvamento (lembretes, conquistas…)

  function registrarPagina(id, def) { PAGINAS[id] = def; }
  function registrarAcoes(mapa) { Object.assign(ACOES, mapa); }
  function registrarMudancas(mapa) { Object.assign(MUDANCAS, mapa); }
  function aoSalvar(fn) { POS_SALVAR.push(fn); }
  function aoRenderizar(fn) { POS_RENDER.push(fn); }

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
    POS_SALVAR.forEach((fn) => { try { fn(DADOS); } catch (e) { console.error(e); } });
  }
  // executa uma alteração oferecendo "Desfazer" no aviso
  function comDesfazer(mensagem, alteracao) {
    const antes = JSON.stringify(DADOS);
    alteracao();
    salvar(mensagem, { desfazer: () => { DADOS = (A.substituirSemCopia || A.substituir)(JSON.parse(antes)); renderizar(); UI.toast("Alteração desfeita."); } });
  }
  function substituirDados(novo) { DADOS = novo; if (window.Personalizar) window.Personalizar.aplicar(DADOS); renderizar(); POS_SALVAR.forEach((fn) => { try { fn(DADOS); } catch (e) { console.error(e); } }); }

  // ---------------------------------------------------------------------
  // rotas
  // ---------------------------------------------------------------------
  function ir(secao, param, opc) {
    if (secao && secao.indexOf("/") !== -1 && !param) { const p = secao.split("/"); secao = p[0]; param = p.slice(1).join("/"); }
    if (ALIAS[secao]) { param = ALIAS[secao][1]; secao = ALIAS[secao][0]; }
    if (!PAGINAS[secao]) secao = "dashboard";
    ROTA = { secao, param: param || null };
    const hash = "#/" + secao + (param ? "/" + encodeURIComponent(param) : "");
    // mudar de seção entra no histórico (o "voltar" do celular volta à tela anterior); trocar de aba não.
    // Se um formulário acabou de fechar, espera o "voltar" dele terminar antes de mexer no histórico.
    UI.aposVoltar(() => {
      if (location.hash === hash) return;
      const atual = lerHash();
      if (atual && atual.secao !== secao && !(opc && opc.substituir)) history.pushState(null, "", hash);
      else history.replaceState(null, "", hash);
    });
    UI.fecharModal();
    // volta ao topo antes de desenhar: a tela pode querer rolar até uma parte dela (ex.: Ajustes → Backup)
    if (!opc || !opc.manterRolagem) window.scrollTo(0, 0);
    renderizar();
  }
  function lerHash() {
    const m = (location.hash || "").match(/^#\/([\w-]+)(?:\/(.+))?$/);
    return m ? { secao: m[1], param: m[2] ? decodeURIComponent(m[2]) : null } : null;
  }
  function rota() { return ROTA; }

  function renderizar() {
    if (window.Personalizar) window.Personalizar.aplicar(DADOS);
    if (window.Areas) { window.Areas.aplicarNavegacao(DADOS); montarItensFab(); }
    const pag = PAGINAS[ROTA.secao] || PAGINAS.dashboard;
    const secaoMenu = pag.menu || ROTA.secao;
    document.querySelectorAll("#navPrincipal button, #tabBar button[data-secao], #maisSheet button[data-secao]").forEach((b) => b.classList.toggle("ativo", b.dataset.secao === secaoMenu));
    const btnMais = document.querySelector("#tabBar [data-mais]");
    if (btnMais) btnMais.classList.toggle("ativo", (window.Areas && window.Areas.maisAtuais ? window.Areas.maisAtuais : SECOES_MAIS).indexOf(secaoMenu) !== -1);
    document.body.dataset.secao = secaoMenu;
    fecharMais();
    document.title = (pag.titulo ? pag.titulo + " · " : "") + "Meu Controle";
    G.destruirTodos();
    const cont = document.getElementById("conteudo");
    try {
      cont.innerHTML = faixaDemo() + pag.render(DADOS, ROTA);
      if (pag.depois) pag.depois(DADOS, ROTA);
    } catch (e) {
      console.error(e);
      cont.innerHTML = `<div class="vazio"><b>Algo deu errado ao montar esta tela.</b><p>${UI.esc(e.message)}</p><button class="btn" data-acao="ir" data-secao="dashboard">Voltar para Hoje</button></div>`;
    }
    atualizarBadge();
    atualizarRodape();
    POS_RENDER.forEach((fn) => { try { fn(DADOS, ROTA); } catch (e) { console.error(e); } });
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
  // na ordem do dia: pesar ao acordar, comer, beber água, treinar, comprar
  const RAPIDO = [
    { acao: "rapido-peso", icone: "⚖️", rotulo: "Peso e medidas" },
    { acao: "rapido-refeicao", icone: "🍽️", rotulo: "Refeição" },
    { acao: "rapido-agua", icone: "💧", rotulo: "Água" },
    { acao: "rapido-treino", icone: "🏋️", rotulo: "Treino" },
    { acao: "rapido-checkin", icone: "🙂", rotulo: "Check-in: sono, humor, passos" },
    { acao: "rapido-jejum", icone: "⏳", rotulo: "Jejum" },
    { acao: "rapido-compra", icone: "🛒", rotulo: "Item na lista de compras" },
    { acao: "rapido-alimento", icone: "🥦", rotulo: "Novo alimento" }
  ];
  // os atalhos do botão + seguem as áreas ligadas em Ajustes
  let assinaturaFab = "";
  function montarItensFab() {
    const menu = document.getElementById("fabMenu");
    if (!menu || !DADOS) return;
    const itens = RAPIDO.filter((r) => !window.Areas || window.Areas.rapidoVisivel(DADOS, r.acao));
    const ass = itens.map((r) => r.acao).join(",");
    if (ass === assinaturaFab) return;
    assinaturaFab = ass;
    menu.innerHTML = itens.map((r) => `<button class="fab-item" data-acao="${r.acao}" role="menuitem"><span>${r.icone}</span>${r.rotulo}</button>`).join("");
  }
  function montarFab() {
    montarItensFab();
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
    "abrir-mais": () => abrirMais(),
    "remover-demo": () => UI.confirmar({
      titulo: "Apagar dados de exemplo", texto: "Todos os registros fictícios serão apagados e o sistema começa do zero, pronto para os seus dados.",
      rotulo: "Apagar exemplo", aoConfirmar: () => { DADOS = A.resetCompleto(); DADOS.config.boasVindas = true; A.salvarDados(DADOS, true); ir("dashboard"); UI.toast("Pronto! Sistema zerado."); setTimeout(() => window.PrimeiroUso && window.PrimeiroUso.abrir(), 400); }
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
  // a navegação agora é uma barra lateral (computador/iPad) ou uma barra
  // de abas embaixo (celular) — não precisa mais compactar as guias
  function ajustarBarraGuias() {
    const sb = document.getElementById("sidebar");
    if (sb) sb.removeAttribute("data-compacta");
  }

  // menu "Mais" da barra de abas (seções que não cabem nas 4 abas)
  const SECOES_MAIS = ["bemestar", "compras", "metas", "relatorios", "configuracoes"];
  function abrirMais() {
    document.body.classList.add("mais-aberto");
    const b = document.querySelector("#tabBar [data-mais]");
    if (b) b.setAttribute("aria-expanded", "true");
  }
  function fecharMais() {
    document.body.classList.remove("mais-aberto");
    const b = document.querySelector("#tabBar [data-mais]");
    if (b) b.setAttribute("aria-expanded", "false");
  }
  function ligarTabBar() {
    const tab = document.getElementById("tabBar"), sheet = document.getElementById("maisSheet"), scrim = document.getElementById("maisScrim");
    if (!tab) return;
    tab.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-mais")) { document.body.classList.contains("mais-aberto") ? fecharMais() : abrirMais(); return; }
      if (b.dataset.secao) ir(b.dataset.secao);
    });
    if (sheet) sheet.addEventListener("click", (e) => { const b = e.target.closest("button[data-secao]"); if (b) ir(b.dataset.secao); });
    if (scrim) scrim.addEventListener("click", fecharMais);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharMais(); });
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

  // ---------------------------------------------------------------------
  // puxar para atualizar (iPad/iPhone como app da tela de início não têm
  // o gesto nativo): no topo da página, segurar e puxar para baixo mostra
  // a seta circular; soltar depois do limite recarrega o app (e busca a
  // versão nova pelo service worker)
  // ---------------------------------------------------------------------
  function ligarPuxarParaAtualizar() {
    if (!("ontouchstart" in window)) return;
    const LIMITE = 70, MAX = 110;
    const ind = document.createElement("div");
    ind.className = "puxar";
    ind.setAttribute("aria-hidden", "true");
    ind.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></svg>`;
    document.body.appendChild(ind);
    let y0 = null, dist = 0, atualizando = false;
    const noTopo = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
    // não disputa o gesto com quadros que rolam por dentro
    const roladoPorDentro = (el) => {
      for (; el && el !== document.body; el = el.parentElement) if (el.scrollTop > 0) return true;
      return false;
    };
    const posicionar = (d, animar) => {
      ind.style.transition = animar ? "transform .25s ease, opacity .25s ease" : "none";
      ind.style.opacity = d > 4 ? Math.min(1, d / LIMITE) : 0;
      ind.style.transform = `translate(-50%, ${d - 50}px) rotate(${d * 3.2}deg)`;
      ind.classList.toggle("pronto", d >= LIMITE);
    };
    document.addEventListener("touchstart", (e) => {
      if (atualizando || e.touches.length !== 1 || UI.modalAberto() || document.body.classList.contains("fab-aberto") || !noTopo() || roladoPorDentro(e.target)) { y0 = null; return; }
      y0 = e.touches[0].clientY; dist = 0;
    }, { passive: true });
    document.addEventListener("touchmove", (e) => {
      if (y0 == null) return;
      const dy = e.touches[0].clientY - y0;
      if (dy <= 0 || !noTopo()) { if (dist) posicionar(0, true); y0 = dy <= 0 ? y0 : null; dist = 0; return; }
      dist = Math.min(MAX, dy * 0.5); // resistência: o indicador anda metade do dedo
      if (e.cancelable) e.preventDefault();
      posicionar(dist);
    }, { passive: false });
    document.addEventListener("touchend", () => {
      if (y0 == null) return;
      y0 = null;
      if (dist < LIMITE) { posicionar(0, true); dist = 0; return; }
      atualizando = true;
      ind.classList.add("girando");
      ind.style.transition = "transform .2s ease";
      ind.style.transform = `translate(-50%, ${LIMITE - 40}px)`;
      const recarregar = () => location.reload();
      const reg = "serviceWorker" in navigator && location.protocol.indexOf("http") === 0 ? navigator.serviceWorker.getRegistration() : Promise.resolve(null);
      Promise.race([reg.then((r) => r && r.update()), new Promise((ok) => setTimeout(ok, 1500))]).catch(() => {}).then(() => setTimeout(recarregar, 350));
    });
    document.addEventListener("touchcancel", () => { y0 = null; dist = 0; posicionar(0, true); });
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
    ligarTabBar();
    ligarNotificacoes();
    ligarDicas();
    ligarPuxarParaAtualizar();
    montarFab();
    iniciarRelogio();
    ajustarBarraGuias();
    window.addEventListener("resize", ajustarBarraGuias);
    const seguirHash = () => { if (UI.modalAberto()) return; const h = lerHash(); if (h && (h.secao !== ROTA.secao || h.param !== ROTA.param)) ir(h.secao, h.param, { substituir: true }); };
    window.addEventListener("hashchange", seguirHash);
    window.addEventListener("popstate", () => setTimeout(seguirHash, 0));
    const h = lerHash();
    ir(h && (PAGINAS[h.secao] || ALIAS[h.secao]) ? h.secao : "dashboard", h && h.param);
    POS_SALVAR.forEach((fn) => { try { fn(DADOS, true); } catch (e) { console.error(e); } });
    // a página pode ficar aberta de um dia para o outro: redesenha quando o dia muda
    let diaAberto = N.hoje(0);
    setInterval(() => { if (N.hoje(0) !== diaAberto) { diaAberto = N.hoje(0); renderizar(); POS_SALVAR.forEach((fn) => { try { fn(DADOS, true); } catch (e) { console.error(e); } }); } }, 60000);
  }

  window.App = { VERSAO_APP, MENU, estado, dados, salvar, comDesfazer, substituirDados, ir, rota, renderizar, registrarPagina, registrarAcoes, registrarMudancas, aoSalvar, aoRenderizar, fecharFab };
  document.addEventListener("DOMContentLoaded", iniciar);
})();
