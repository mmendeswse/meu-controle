/**
 * tutorial.js
 * -----------------------------------------------------------------------
 * Tutoriais guiados: na primeira visita a cada tela aparece um convite
 * ("Quer ver como funciona?") e, se a pessoa aceitar, um passo a passo que
 * destaca as partes reais da tela, uma de cada vez, com um balão
 * explicando. O botão "?" no título de cada tela mostra de novo, e em
 * Ajustes → Tutoriais dá para rever qualquer um ou ligar/desligar o convite.
 *
 * Alvos dos passos: seletor CSS, "card:Título" (o cartão com esse título)
 * ou uma lista deles (vale o primeiro visível). Passo sem alvo visível vira
 * um balão no meio da tela — ou é pulado, se for "opcional".
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const UI = global.UI, A = global.Armazenamento;
  const esc = UI.esc;
  const App = () => global.App;
  const celular = () => global.matchMedia("(max-width: 860px)").matches;

  const ABAS = ".cabecalho-pagina .abas";
  const NAV = ["#tabBar", "#navPrincipal"];
  const navTexto = () => celular() ? "As abas de baixo levam às outras partes do app. O que não cabe nelas fica em <b>Mais</b>." : "O menu ao lado leva às outras partes do app.";

  const TOURS = {
    dashboard: {
      nome: "Tela Hoje", icone: "🏠",
      intro: "Tudo do seu dia num lugar só: comida, água, treino, remédios e hábitos.",
      passos: [
        { alvo: ".boas-vindas", titulo: "Primeiros passos", texto: "Enquanto o app está vazio, este cartão sugere por onde começar. Ele some sozinho quando você tiver registros.", opcional: true },
        { alvo: "card:Sua semana", titulo: "Sua semana", texto: "Cada anel é um dia: quanto mais cheio, mais perto das suas metas você ficou.", opcional: true },
        { alvo: "card:Resumo do dia", titulo: "Resumo do dia", texto: "Calorias, proteína e água de hoje comparadas com as suas metas. O botão de água soma um copo com um toque.", opcional: true },
        { alvo: "card:Seu dia", titulo: "Seu dia", texto: "Refeições, remédios e hábitos na ordem da sua rotina. Toque num item para marcar como feito.", opcional: true },
        { alvo: ".tiles-saude", titulo: "Seus números", texto: "Treinos, peso, sono e outros. Toque num cartão para abrir a tela dele.", opcional: true },
        { alvo: "#fab", titulo: "Registro rápido", texto: "O botão <b>+</b> aparece em todas as telas: registre refeição, água, peso, treino ou humor sem procurar o lugar certo." },
        { alvo: NAV, titulo: "Navegação", texto: navTexto },
        { alvo: [".cab-hoje .avatar", "#avatarBarra", "#perfilLateral"], titulo: "Seu avatar", texto: "Toque na sua foto para trocar: personagens de anime, emojis ou uma foto sua.", opcional: true },
        { alvo: "#btnNotificacoes", titulo: "Alertas", texto: "O sino avisa quando algo precisa de atenção: remédio acabando, meta fora do caminho, backup atrasado.", opcional: true },
        { titulo: "Pronto!", texto: "Em cada tela, o botão <b class=\"tour-q\">?</b> ao lado do título mostra a explicação dela. Bom uso!" }
      ]
    },
    alimentacao: {
      nome: "Alimentação", icone: "🍽️",
      intro: "Aqui você registra o que come e acompanha calorias e proteína.",
      passos: [
        { alvo: ABAS, titulo: "Três abas", texto: "<b>Diário</b>: o que você comeu no dia. <b>Semana</b>: cardápio planejado e as compras dele. <b>Alimentos</b>: sua tabela com as calorias de cada alimento." },
        { alvo: ".barra-ferramentas", titulo: "Escolher o dia", texto: "Use as setas para ver ou registrar outros dias.", opcional: true },
        { alvo: "card:Resumo do dia", titulo: "Resumo do dia", texto: "Quanto você já comeu de calorias, proteína, carboidratos e gorduras.", opcional: true },
        { alvo: '[data-acao="nova-refeicao"]', titulo: "Nova refeição", texto: "Adicione café, almoço, jantar… e escolha os alimentos. A refeição que se repete pode virar favorita e entra depois com um toque." },
        { alvo: '[data-acao="agua-rapida"]', titulo: "Água", texto: "Cada toque soma um copo.", opcional: true }
      ]
    },
    academia: {
      nome: "Treino", icone: "🏋️",
      intro: "Planeje e registre seus treinos, série por série.",
      passos: [
        { alvo: ABAS, titulo: "Quatro abas", texto: "<b>Treinos</b>: o de hoje e o histórico. <b>Fichas</b>: seus treinos A, B, C e o plano da semana. <b>Calendário</b> e <b>Carga</b>: como os pesos evoluem." },
        { alvo: ".kpi-row", titulo: "Sua semana de treino", texto: "Treinos feitos, dias seguidos e volume levantado.", opcional: true },
        { alvo: ['[data-acao="novo-treino"]', '[data-acao="rapido-treino"]'], titulo: "Começar um treino", texto: "Escolha uma ficha ou faça um treino livre. Durante o treino, marque cada série — o app mostra a carga que você usou da última vez." },
        { titulo: "Dica", texto: "Monte suas fichas primeiro na aba <b>Fichas</b>. Depois é só tocar em <b>Iniciar</b> e seguir." }
      ]
    },
    bemestar: {
      nome: "Bem-estar", icone: "💚",
      intro: "Sono, humor, hábitos, remédios e jejum.",
      passos: [
        { alvo: ABAS, titulo: "As partes do Bem-estar", texto: "<b>Resumo</b>: check-in e gráficos. <b>Hábitos</b>: o que você quer fazer todo dia. <b>Remédios</b>: horários, lembretes e estoque. <b>Jejum</b>: cronômetro e histórico.", opcional: true },
        { alvo: ['[data-acao="checkin"]', "card:Check-in de hoje"], titulo: "Check-in do dia", texto: "Leva 10 segundos: como dormiu, humor, energia e passos. Com o tempo, o app mostra o que mais influencia o seu bem-estar.", opcional: true },
        { alvo: ".kpi-row", titulo: "Suas médias", texto: "Sono, humor, energia e passos dos últimos 7 dias.", opcional: true },
        { alvo: "card:Calendário do humor", titulo: "Calendário do humor", texto: "Cada dia ganha a cor do seu humor. Toque num dia para registrar como você estava.", opcional: true },
        { titulo: "Remédios", texto: "Na aba <b>Remédios</b>, cadastre horários e quantidade em casa: o app lembra a hora de tomar e avisa quando estiver acabando." }
      ]
    },
    compras: {
      nome: "Compras", icone: "🛒",
      intro: "Lista de compras, o que tem em casa e quanto você gasta com comida.",
      passos: [
        { alvo: ABAS, titulo: "Três abas", texto: "<b>Lista</b>: o que comprar no mês. <b>Em casa</b>: o estoque, com aviso quando algo está acabando. <b>Gastos</b>: quanto foi por mês, categoria e mercado." },
        { alvo: ".barra-mes", titulo: "Mês", texto: "Cada mês tem a sua lista. Dá para copiar a lista do mês anterior.", opcional: true },
        { alvo: '[data-acao="nova-compra"]', titulo: "Adicionar item", texto: "Coloque o nome, a quantidade e o preço. Quando comprar, marque o item: ele entra no estoque e nos gastos." }
      ]
    },
    evolucao: {
      nome: "Corpo", icone: "📈",
      intro: "Peso, gordura, músculo e medidas ao longo do tempo.",
      passos: [
        { alvo: '[data-acao="rapido-peso"]', titulo: "Só o peso", texto: "Registre o peso em dois toques. Melhor de manhã, sempre no mesmo horário." },
        { alvo: '[data-acao="rapido-medida"]', titulo: "Medição completa", texto: "Peso, bioimpedância (gordura, músculo, água) e medidas como cintura e braço." },
        { alvo: "card:Evolução corporal", titulo: "Comparação", texto: "A primeira medição comparada com a mais recente.", opcional: true },
        { alvo: "card:Gráficos", titulo: "Gráficos", texto: "Escolha o que ver e o período. A linha da meta aparece quando você cria uma em Metas.", opcional: true }
      ]
    },
    metas: {
      nome: "Metas", icone: "🎯",
      intro: "Defina objetivos com prazo e veja se você está no caminho.",
      passos: [
        { alvo: ABAS, titulo: "Metas e Conquistas", texto: "Em <b>Conquistas</b> ficam as medalhas que você ganha registrando com constância." },
        { alvo: '[data-acao="nova-meta"]', titulo: "Nova meta", texto: "Peso, calorias, proteína, água, treinos por semana, sono… escolha o tipo, o valor e o prazo." },
        { alvo: ".kpi-row", titulo: "Como estão as metas", texto: "🟢 no caminho, 🟡 atenção, 🔴 fora. A conta usa a tendência dos seus registros, não só o último valor.", opcional: true }
      ]
    },
    relatorios: {
      nome: "Relatórios", icone: "📊",
      intro: "Resumo da semana, do mês ou do trimestre comparado ao período anterior.",
      passos: [
        { alvo: [".barra-ferramentas:has([data-acao='rel-tipo'])", '[data-acao="rel-tipo"]'], titulo: "Período", texto: "Escolha semanal, mensal ou trimestral e navegue com as setas." },
        { alvo: [".barra-ferramentas:has([data-acao='rel-pdf'])", '[data-acao="rel-pdf"]'], titulo: "Levar para a consulta", texto: "Gere um PDF para imprimir ou mostrar ao nutricionista ou médico, ou uma planilha.", opcional: true },
        { alvo: "#sec-insights", titulo: "Insights", texto: "Observações automáticas a partir dos seus registros.", opcional: true }
      ]
    },
    configuracoes: {
      nome: "Ajustes", icone: "⚙️",
      intro: "Deixe o app com a sua cara e mantenha seus dados seguros.",
      passos: [
        { alvo: ".atalhos-ajustes", titulo: "Atalhos", texto: "Vá direto para a parte que quer mudar." },
        { alvo: "#sec-aparencia", titulo: "Aparência", texto: "Tema claro ou escuro, cor, tamanho da letra e o seu avatar." },
        { alvo: "#sec-areas", titulo: "O que você usa", texto: "Desligue o que não usa: o app fica mais simples e as abas se ajustam." },
        { alvo: "#sec-sync", titulo: "Sincronização", texto: "Use o app no celular e no computador com os mesmos dados: crie uma conta aqui e leia o QR code no outro aparelho.", opcional: true },
        { alvo: "#sec-seguranca", titulo: "Segurança", texto: "Crie um PIN de 6 dígitos (com Face ID ou digital, se o aparelho tiver) para ninguém abrir o app se pegar o seu celular.", opcional: true },
        { alvo: "#sec-backup", titulo: "Backup — importante!", texto: "Os dados ficam só neste aparelho. Ative o backup para não perder nada se trocar ou perder o celular." },
        { alvo: "#sec-tutoriais", titulo: "Tutoriais", texto: "Reveja qualquer explicação quando quiser.", opcional: true }
      ]
    }
  };

  // ---------------------------------------------------------------------
  // encontrar alvos
  // ---------------------------------------------------------------------
  function visivel(e) {
    if (!e || !e.getClientRects().length) return false;
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(e);
    return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05;
  }
  function achar(alvo) {
    if (!alvo) return null;
    const lista = Array.isArray(alvo) ? alvo : [alvo];
    for (const s of lista) {
      let els = [];
      try {
        if (s.indexOf("card:") === 0) {
          const t = s.slice(5).toLowerCase();
          els = Array.from(document.querySelectorAll("#conteudo .card")).filter((c) => { const h = c.querySelector("h2"); return h && h.textContent.trim().toLowerCase().indexOf(t) === 0; });
        } else els = Array.from(document.querySelectorAll(s));
      } catch (e) { els = []; } // seletor sem suporte neste navegador (ex.: :has)
      const v = els.find(visivel);
      if (v) return v;
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // o passo a passo
  // ---------------------------------------------------------------------
  const st = { k: null, i: 0, passos: [], el: null, alvo: null, voltaPropria: false };
  function ativo() { return !!st.k; }

  function montar() {
    let el = document.getElementById("tour");
    if (!el) {
      el = document.createElement("div");
      el.id = "tour"; el.className = "tour";
      el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Tutorial");
      el.innerHTML = `<div class="tour-foco"></div><div class="tour-balao"><i class="tour-seta"></i><div class="tour-conteudo" aria-live="polite"></div></div>`;
      // a tela por baixo não rola nem recebe toques durante o tutorial
      ["wheel", "touchmove"].forEach((ev) => el.addEventListener(ev, (e) => { if (!e.target.closest(".tour-balao")) e.preventDefault(); }, { passive: false }));
      // fora do <body>: o "tamanho da letra" usa zoom no body, e as posições
      // dos alvos (getBoundingClientRect) já vêm na escala da tela
      document.documentElement.appendChild(el);
    }
    return el;
  }

  // k: tela; opc.convite: começa com o convite "Quer ver como funciona?"
  function iniciar(k, opc) {
    opc = opc || {};
    const t = TOURS[k];
    if (!t) return;
    if (ativo()) fechar(false, true);
    const go = () => {
      const passos = t.passos.filter((p) => !p.opcional || achar(p.alvo));
      st.k = k; st.i = 0;
      st.passos = (opc.convite ? [{ convite: true }] : [{ intro: true }]).concat(passos);
      st.el = montar();
      document.body.classList.add("tour-on");
      requestAnimationFrame(() => st.el.classList.add("on"));
      UI.aposVoltar(() => { if (ativo()) { try { history.pushState({ tour: true }, "", location.href); } catch (e) { /* sem histórico */ } } });
      mostrar();
    };
    // abre na primeira aba da tela (é ela que os passos explicam)
    const rota = App().rota ? App().rota() : null;
    if (rota && rota.secao === k && rota.param && k !== "configuracoes") { App().ir(k); setTimeout(go, 380); } else go();
  }

  function mostrar() {
    const p = st.passos[st.i], t = TOURS[st.k];
    if (!p) { concluir(); return; }
    const reais = st.passos.filter((x) => !x.convite && !x.intro).length;
    const n = st.passos.slice(0, st.i + 1).filter((x) => !x.convite && !x.intro).length;
    const ultimo = st.i === st.passos.length - 1;
    let html;
    if (p.convite || p.intro) {
      html = `<div class="tour-cab"><span class="tour-ic">${t.icone}</span><div><small>${p.convite ? "Primeira vez aqui?" : "Como funciona"}</small><b>${esc(t.nome)}</b></div></div>
        <p>${t.intro}${p.convite ? " Quer que eu mostre as partes principais? Leva uns 30 segundos." : ""}</p>
        <div class="tour-botoes">${p.convite ? `<button class="btn" data-acao="tour-fechar">Agora não</button><button class="btn primario" data-acao="tour-proximo">Mostrar</button>`
          : `<button class="btn fantasma" data-acao="tour-fechar">Fechar</button><button class="btn primario" data-acao="tour-proximo">Começar</button>`}</div>`;
    } else {
      const texto = typeof p.texto === "function" ? p.texto() : p.texto;
      html = `<div class="tour-topo"><span class="tour-pontos">${Array.from({ length: reais }, (_, j) => `<i class="${j < n - 1 ? "feito" : j === n - 1 ? "ativo" : ""}"></i>`).join("")}</span><small>${n} de ${reais}</small></div>
        <b class="tour-titulo">${esc(p.titulo)}</b><p>${texto}</p>
        <div class="tour-botoes">${ultimo ? "" : `<button class="btn fantasma tour-pular" data-acao="tour-fechar">Pular</button>`}
          ${n > 1 ? `<button class="btn" data-acao="tour-voltar">Voltar</button>` : ""}
          <button class="btn primario" data-acao="tour-proximo">${ultimo ? "Entendi" : "Próximo"}</button></div>`;
    }
    st.el.querySelector(".tour-conteudo").innerHTML = html;
    st.alvo = p.convite || p.intro ? null : achar(p.alvo);
    if (st.alvo && getComputedStyle(st.alvo).position !== "fixed" && !st.alvo.closest("#tabBar, .sidebar")) {
      const r = st.alvo.getBoundingClientRect(), vh = global.innerHeight;
      const margemBaixo = celular() ? 90 : 20;
      const alto = r.height > vh * 0.4;
      // alvos altos sobem para o topo (sobra lugar para o balão embaixo)
      if (alto ? (r.top < 60 || r.top > vh * 0.3) : (r.top < 70 || r.bottom > vh - margemBaixo)) {
        st.alvo.style.scrollMarginTop = (celular() ? 76 : 24) + "px";
        st.alvo.scrollIntoView({ block: alto ? "start" : "center", behavior: "auto" });
      }
    }
    posicionar();
    const b = st.el.querySelector("[data-acao='tour-proximo']");
    if (b) b.focus({ preventScroll: true });
  }

  function posicionar() {
    if (!ativo()) return;
    const el = st.el, foco = el.querySelector(".tour-foco"), balao = el.querySelector(".tour-balao"), seta = el.querySelector(".tour-seta");
    const vw = global.innerWidth, vh = global.innerHeight;
    const w = Math.min(380, vw - 24);
    balao.style.width = w + "px";
    if (!st.alvo || !visivel(st.alvo)) {
      el.classList.add("sem-alvo");
      Object.assign(foco.style, { top: vh / 2 + "px", left: vw / 2 + "px", width: "0px", height: "0px" });
      const h = balao.offsetHeight;
      Object.assign(balao.style, { left: (vw - w) / 2 + "px", top: Math.max(16, (vh - h) / 2) + "px" });
      seta.className = "tour-seta";
      return;
    }
    el.classList.remove("sem-alvo");
    const r0 = st.alvo.getBoundingClientRect(), pad = 6;
    // só a parte visível do alvo (cartões compridos)
    const r = { top: Math.max(r0.top, 8), left: Math.max(r0.left, 8), bottom: Math.min(r0.bottom, vh - 8), right: Math.min(r0.right, vw - 8) };
    Object.assign(foco.style, { top: r.top - pad + "px", left: r.left - pad + "px", width: r.right - r.left + pad * 2 + "px", height: r.bottom - r.top + pad * 2 + "px" });
    const h = balao.offsetHeight, gap = 16;
    let embaixo = vh - r.bottom - pad - gap, emcima = r.top - pad - gap;
    const direita = vw - r.right - pad - gap, esquerda = r.left - pad - gap;
    let top, left, lado;
    const cxDe = () => (r.left + r.right) / 2;
    if (embaixo < h + 8 && emcima < h + 8 && (direita >= w + 8 || esquerda >= w + 8)) {
      // alvo alto e estreito (menu lateral, cartão no PC): balão ao lado
      left = direita >= w + 8 ? r.right + pad + gap : r.left - pad - gap - w;
      top = Math.min(Math.max(12, r.top), vh - h - 12);
      lado = direita >= w + 8 ? "esq" : "dir";
    } else {
      if (embaixo < h + 8 && emcima < h + 8) {
        // alvo maior que a tela: destaca só o começo dele e põe o balão embaixo
        r.bottom = Math.max(r.top + 56, vh - h - gap - pad - (celular() ? 20 : 16));
        Object.assign(foco.style, { height: r.bottom - r.top + pad * 2 + "px" });
        embaixo = vh - r.bottom - pad - gap;
      }
      if (embaixo >= h + 8 || emcima < h + 8) { top = Math.min(r.bottom + pad + gap, vh - h - 12); lado = "cima"; }
      else { top = r.top - pad - gap - h; lado = "baixo"; }
      left = Math.min(Math.max(12, cxDe() - w / 2), vw - w - 12);
    }
    Object.assign(balao.style, { left: left + "px", top: top + "px" });
    seta.className = "tour-seta " + lado;
    if (lado === "esq" || lado === "dir") { seta.style.left = ""; seta.style.top = Math.min(Math.max(22, (r.top + Math.min(r.bottom, r.top + 120)) / 2 - top), h - 22) + "px"; }
    else { seta.style.top = ""; seta.style.left = Math.min(Math.max(22, cxDe() - left), w - 22) + "px"; }
  }

  function marcarVisto(k) {
    const d = App().dados();
    if (!d) return;
    d.config.tutoriais = d.config.tutoriais || {};
    if (d.config.tutoriais[k]) return;
    d.config.tutoriais[k] = new Date().toISOString().slice(0, 10);
    A.salvarDados(d, true, true);
  }
  function fechar(peloVoltar, semMarcar) {
    if (!ativo()) return;
    const k = st.k;
    st.k = null; st.alvo = null;
    st.el.classList.remove("on");
    document.body.classList.remove("tour-on");
    if (!semMarcar) marcarVisto(k);
    if (!peloVoltar && history.state && history.state.tour) { st.voltaPropria = true; try { history.back(); } catch (e) { st.voltaPropria = false; } }
  }
  function concluir() { fechar(); }

  UI.aoVoltar(() => {
    if (st.voltaPropria) { st.voltaPropria = false; return true; }
    if (ativo()) { fechar(true); return true; }
    return false;
  });
  document.addEventListener("keydown", (e) => {
    if (!ativo()) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); proximo(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); voltar(); }
  }, true);
  let timerPos = null;
  global.addEventListener("resize", () => { if (!ativo()) return; clearTimeout(timerPos); timerPos = setTimeout(() => { st.alvo = st.alvo && visivel(st.alvo) ? st.alvo : achar((st.passos[st.i] || {}).alvo); posicionar(); }, 120); });

  function proximo() { if (st.i >= st.passos.length - 1) { concluir(); return; } st.i++; mostrar(); }
  function voltar() { if (st.i > 0) { st.i--; if (st.passos[st.i].convite || st.passos[st.i].intro) st.i++; mostrar(); } }

  // ---------------------------------------------------------------------
  // convite automático na primeira visita e botão "?" no título
  // ---------------------------------------------------------------------
  const api = { auto: true };
  let novidadesPendentes = false;
  let timerAuto = null;
  function podeConvidar(d, k) {
    if (!api.auto || !TOURS[k] || ativo() || novidadesPendentes) return false;
    const c = d.config;
    if (c.dicasAuto === false || (c.tutoriais || {})[k]) return false;
    if (!c.onboardingFeito && !d.demo) return false; // as boas-vindas vêm primeiro
    return true;
  }
  function ocupado() {
    return document.documentElement.classList.contains("travado") || UI.modalAberto() || document.body.classList.contains("av-aberta") || document.querySelector(".abertura") || document.body.classList.contains("mais-aberto") || document.body.classList.contains("fab-aberto") || document.body.classList.contains("tour-on");
  }
  App().aoRenderizar((d, rota) => {
    const k = rota && rota.secao;
    // botão "?" ao lado do título
    if (TOURS[k]) {
      const lugar = document.querySelector("#conteudo .cabecalho-pagina h1, #conteudo .cab-hoje .cab-direita");
      if (lugar && !lugar.querySelector(".tour-ajuda")) {
        const b = `<button class="tour-ajuda" data-acao="tour" data-k="${k}" aria-label="Como funciona esta tela" title="Como funciona esta tela">?</button>`;
        if (lugar.tagName === "H1") lugar.insertAdjacentHTML("beforeend", b); else lugar.insertAdjacentHTML("afterbegin", b);
      }
    }
    clearTimeout(timerAuto);
    if (!podeConvidar(d, k)) return;
    // espera a tela assentar (e o "olá" de abertura sair)
    const tentar = (n) => {
      timerAuto = setTimeout(() => {
        const r = App().rota();
        if (!r || r.secao !== k || !podeConvidar(App().dados(), k)) return;
        if (ocupado()) { if (n < 20) tentar(n + 1); return; }
        iniciar(k, { convite: true });
      }, n ? 700 : 900);
    };
    tentar(0);
  });

  // cartão em Ajustes
  function cartaoAjustes(d) {
    const vistos = d.config.tutoriais || {};
    return UI.card({ titulo: "Tutoriais", sub: "o passo a passo de cada tela", id: "sec-tutoriais", corpo: `<div class="pad">
      <div class="tour-lista">${Object.keys(TOURS).map((k) => `<button class="tour-item" data-acao="tour" data-k="${k}"><span class="tour-ic">${TOURS[k].icone}</span><span><b>${esc(TOURS[k].nome)}</b><small>${vistos[k] ? "✓ visto" : "não visto"}</small></span><i>›</i></button>`).join("")}</div>
      ${global.Personalizar.interruptor("tour_auto", "Mostrar ao abrir uma tela pela primeira vez", d.config.dicasAuto !== false, "Um convite rápido; dá para dizer “Agora não”.", 'data-mudar="tour-auto"')}
      <div class="botoes-linha"><button class="btn pequeno" data-acao="tour-zerar">Mostrar todos de novo</button><button class="btn pequeno" data-acao="primeiro-uso">✨ Configuração inicial</button></div>
    </div>` });
  }

  App().registrarAcoes({
    "tour": (el) => {
      const k = el.dataset.k;
      if (App().rota().secao !== k) { App().ir(k); setTimeout(() => iniciar(k), 420); } else iniciar(k);
    },
    "tour-proximo": proximo,
    "tour-voltar": voltar,
    "tour-fechar": () => fechar(),
    "tour-zerar": () => { const d = App().dados(); d.config.tutoriais = {}; d.config.dicasAuto = true; App().salvar("Pronto! As explicações aparecem de novo na primeira visita a cada tela."); }
  });
  App().registrarMudancas({
    "tour-auto": (el) => { const d = App().dados(); d.config.dicasAuto = el.checked; App().salvar(el.checked ? "Convites ligados." : "Convites desligados — use o ? de cada tela quando quiser."); }
  });

  // ---------------------------------------------------------------------
  // "O que há de novo": aparece uma vez depois de uma atualização
  // ---------------------------------------------------------------------
  const NOVIDADES = {
    versao: "3.8",
    itens: [
      ["🎨", "Mais jeitos de personalizar", "Em Ajustes → Aparência: seu nome, como o app te chama, o nome do próprio app, saudação, tema escuro suave, fundo degradê ou aurora, cantos e espaçamento."],
      ["✨", "Transições entre as telas", "As telas deslizam ao navegar e, no celular, o título sobe para a barra do topo ao rolar — como nos apps de saúde."],
      ["📅", "Google Agenda", "Em Ajustes → Google Agenda: remédios, treinos e jejum viram eventos com alerta na sua agenda — tocam mesmo com o app fechado, até no relógio."],
      ["🔄", "Sincronização entre aparelhos", "Em Ajustes → Sincronização: celular, tablet e computador com os mesmos dados, guardados criptografados no seu GitHub. Um QR code liga cada aparelho."],
      ["🔒", "Bloqueio com PIN", "Em Ajustes → Segurança: o app pede um PIN (ou Face ID/digital) ao abrir, para ninguém ver seus dados se pegar o seu celular."],
      ["⚡", "Avatares abrem na hora", "A lista de personagens agora vem junto com o app — sem esperar o servidor de anime."],
      ["❓", "Tutoriais em cada tela", "Na primeira visita a cada tela, um passo a passo mostra como ela funciona. O botão <b>?</b> ao lado do título mostra de novo."]
    ]
  };
  function abrirNovidades() {
    const d = App().dados();
    UI.abrirModal(`<div class="nov"><span class="nov-selo">Novidades · versão ${NOVIDADES.versao}</span><h3>O app ficou melhor 🎉</h3>
      <ul class="nov-lista">${NOVIDADES.itens.map((x) => `<li><span class="nov-ic">${x[0]}</span><span><b>${esc(x[1])}</b><small>${x[2]}</small></span></li>`).join("")}</ul>
      <div class="pu-rodape"><button class="btn" data-acao="nov-fechar">Fechar</button><button class="btn primario" data-acao="nov-tour">Ver o tour da tela Hoje</button></div></div>`,
    { largo: true, semFoco: true, aoFechar: () => {
      d.config.novidadesVistas = NOVIDADES.versao; A.salvarDados(d, true, true);
      novidadesPendentes = false;
      // a tela atual pode ter um convite esperando
      setTimeout(() => { const r = App().rota(); if (r && podeConvidar(App().dados(), r.secao) && !ocupado()) iniciar(r.secao, { convite: true }); }, 700);
    } });
    document.getElementById("modal").classList.add("modal-pu");
  }
  App().aoSalvar((d, abertura) => {
    if (!abertura) return;
    const c = d.config;
    if (c.novidadesVistas === NOVIDADES.versao) return;
    const antigo = c.onboardingFeito || (global.Backup && global.Backup.temDados(d));
    // quem está chegando agora não precisa das novidades: já começa com tudo
    if (!antigo || d.demo) { if (!c.onboardingFeito && !d.demo) return; c.novidadesVistas = NOVIDADES.versao; A.salvarDados(d, true, true); return; }
    if (!api.auto) return;
    novidadesPendentes = true;
    const tentar = (n) => setTimeout(() => {
      if (App().dados().config.novidadesVistas === NOVIDADES.versao) { novidadesPendentes = false; return; }
      if (ocupado() || ativo()) { if (n < 30) tentar(n + 1); else novidadesPendentes = false; return; }
      clearTimeout(timerAuto);
      abrirNovidades();
    }, n ? 600 : 1700);
    tentar(0);
  });
  App().registrarAcoes({
    // quem fechou já leu sobre o "?" — a tela Hoje não precisa do convite agora
    "nov-fechar": () => { UI.fecharModal(); marcarVisto("dashboard"); },
    "nov-tour": () => { UI.fecharModal(); App().ir("dashboard"); setTimeout(() => UI.aposVoltar(() => iniciar("dashboard")), 450); }
  });

  Object.assign(api, { TOURS, iniciar, fechar, ativo, cartaoAjustes, achar, abrirNovidades, NOVIDADES });
  global.Tutorial = api;
})(window);
