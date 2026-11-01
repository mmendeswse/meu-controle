/**
 * areas.js
 * -----------------------------------------------------------------------
 * O que cada pessoa usa: áreas ligadas/desligadas, as 4 abas da barra do
 * celular, perfis prontos (completo, saúde e remédios, criança, fitness)
 * e a montagem da tela Hoje (quais cartões, em que ordem).
 *
 * Desligar uma área esconde o menu, a aba, o atalho do botão +, os itens
 * do roteiro, os cartões e os alertas dela. Os dados não são apagados.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo, UI = global.UI, A = global.Armazenamento;
  const esc = UI.esc;

  // seções do menu e a área que controla cada uma (Hoje e Ajustes sempre aparecem)
  const SECOES = [
    { k: "dashboard", r: "Hoje", s: "Roteiro e números do dia" },
    { k: "evolucao", r: "Corpo", s: "Peso, medidas e composição", area: "evolucao" },
    { k: "alimentacao", r: "Alimentação", curto: "Comer", s: "Diário, cardápio e alimentos", area: "alimentacao" },
    { k: "academia", r: "Treino", s: "Treinos, fichas e cargas", area: "academia" },
    { k: "bemestar", r: "Bem-estar", s: "Sono, humor, hábitos, remédios e jejum", area: "bemestar" },
    { k: "compras", r: "Compras", s: "Lista, estoque e gastos com comida", area: "compras" },
    { k: "metas", r: "Metas", s: "Metas e conquistas", area: "metas" },
    { k: "relatorios", r: "Relatórios", s: "Insights e resumos do período", area: "relatorios" },
    { k: "configuracoes", r: "Ajustes", s: "Aparência, rotina, backup e dados" }
  ];
  const AREAS = [
    { k: "evolucao", r: "⚖️ Corpo", s: "peso, medidas, IMC" },
    { k: "alimentacao", r: "🍽️ Alimentação", s: "calorias, macros, cardápio e água" },
    { k: "academia", r: "🏋️ Treino", s: "fichas, treinos e cargas" },
    { k: "bemestar", r: "💚 Bem-estar", s: "a tela com as partes abaixo", filhos: ["checkin", "habitos", "remedios", "jejum"] },
    { k: "checkin", r: "😴 Sono e humor", s: "check-in diário", pai: "bemestar" },
    { k: "habitos", r: "✅ Hábitos e desafios", s: "", pai: "bemestar" },
    { k: "remedios", r: "💊 Remédios e suplementos", s: "", pai: "bemestar" },
    { k: "jejum", r: "⏳ Jejum", s: "", pai: "bemestar" },
    { k: "compras", r: "🛒 Compras", s: "lista do mês, estoque e gastos" },
    { k: "metas", r: "🎯 Metas e conquistas", s: "" },
    { k: "relatorios", r: "📊 Relatórios", s: "resumos e exportação" }
  ];
  const tudo = (v) => { const o = {}; AREAS.forEach((a) => { o[a.k] = v; }); return o; };
  const PRESETS = [
    { k: "completo", ic: "🌟", r: "Completo", s: "Tudo ligado: corpo, alimentação, treino, bem-estar, compras e metas.",
      areas: tudo(true), abas: ["dashboard", "alimentacao", "academia", "evolucao"], peso: "diario" },
    { k: "saude", ic: "🩺", r: "Saúde e remédios", s: "Remédios, sono e humor, hábitos e peso uma vez por semana. Ótimo para os avós.",
      areas: Object.assign(tudo(false), { evolucao: true, bemestar: true, checkin: true, habitos: true, remedios: true, metas: true }), abas: ["dashboard", "bemestar", "evolucao", "metas"], peso: "semanal", fonte: "grande" },
    { k: "crianca", ic: "🧒", r: "Criança ou adolescente", s: "Hábitos, água, sono, humor e conquistas — sem peso, calorias, dietas ou jejum.",
      areas: Object.assign(tudo(false), { bemestar: true, checkin: true, habitos: true, metas: true }), abas: ["dashboard", "bemestar", "metas", "configuracoes"], peso: "nao", crianca: true },
    { k: "fitness", ic: "💪", r: "Fitness", s: "Treino, alimentação, corpo, jejum e compras — sem a parte de remédios.",
      areas: Object.assign(tudo(true), { remedios: false }), abas: ["dashboard", "alimentacao", "academia", "evolucao"], peso: "diario" }
  ];

  function area(d, k) {
    const a = (d.config && d.config.areas) || {};
    if (a[k] === false) return false;
    const def = AREAS.find((x) => x.k === k);
    if (def && def.pai && a[def.pai] === false) return false;
    return true;
  }
  function secaoVisivel(d, k) { const s = SECOES.find((x) => x.k === k); return !s || !s.area || area(d, s.area); }
  // tipo de alerta → área (alertas de áreas desligadas não aparecem)
  const AREA_ALERTA = { treinoNaoRealizado: "academia", pesoSemRegistro: "evolucao", estoqueBaixo: "compras", itemImportante: "compras", metaAtrasada: "metas",
    refeicaoPlanejada: "alimentacao", aguaAbaixo: "alimentacao", proteinaAbaixo: "alimentacao", mudancaRelevante: "evolucao",
    remedioAtrasado: "remedios", remedioEstoque: "remedios", jejumMeta: "jejum", checkinPendente: "checkin", conquistaNova: "metas" };
  // rota de um insight → área
  function areaDaRota(rota) {
    const r = String(rota || "");
    if (r.indexOf("bemestar/remedios") === 0) return "remedios";
    if (r.indexOf("bemestar/habitos") === 0) return "habitos";
    if (r.indexOf("bemestar/jejum") === 0) return "jejum";
    if (r.indexOf("bemestar") === 0) return "checkin";
    if (r === "estoque" || r === "compras") return "compras";
    if (r === "refeicoes") return "alimentacao";
    const s = SECOES.find((x) => x.k === r);
    return s ? s.area : null;
  }

  // ---------------------------------------------------------------------
  // navegação: barra lateral, abas do celular, menu "Mais" e botão +
  // ---------------------------------------------------------------------
  function iconeDe(k) {
    const b = document.querySelector(`#navPrincipal button[data-secao="${k}"] svg`);
    return b ? b.outerHTML : "";
  }
  let assinatura = "";
  function aplicarNavegacao(d) {
    const nav = document.getElementById("navPrincipal");
    if (!nav) return;
    const visiveis = SECOES.filter((s) => secaoVisivel(d, s.k)).map((s) => s.k);
    let abas = (d.config.abas || []).filter((k) => visiveis.indexOf(k) !== -1).slice(0, 4);
    visiveis.forEach((k) => { if (abas.length < 4 && abas.indexOf(k) === -1 && k !== "configuracoes") abas.push(k); });
    const ass = visiveis.join(",") + "|" + abas.join(",");
    global.Areas.abasAtuais = abas;
    global.Areas.maisAtuais = visiveis.filter((k) => abas.indexOf(k) === -1);
    if (ass === assinatura) return;
    assinatura = ass;
    nav.querySelectorAll("button[data-secao]").forEach((b) => { b.hidden = visiveis.indexOf(b.dataset.secao) === -1; });
    const tab = document.getElementById("tabBar");
    if (tab) tab.innerHTML = abas.map((k) => { const s = SECOES.find((x) => x.k === k); return `<button data-secao="${k}" class="tab-${k}">${iconeDe(k)}<span>${esc(s.curto || s.r)}</span></button>`; }).join("") +
      `<button data-mais class="tab-mais" aria-haspopup="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></svg><span>Mais</span></button>`;
    const sheet = document.getElementById("maisSheet");
    if (sheet) {
      const instalar = sheet.querySelector("[data-instalar]");
      sheet.innerHTML = `<div class="mais-alca"></div>` + global.Areas.maisAtuais.map((k) => { const s = SECOES.find((x) => x.k === k); return `<button data-secao="${k}" class="mais-item it-${k}"><i>${iconeDe(k)}</i><span><b>${esc(s.r)}</b><small>${esc(s.s)}</small></span></button>`; }).join("");
      if (instalar) sheet.insertBefore(instalar, sheet.querySelector(".it-configuracoes"));
    }
  }
  // atalhos do botão + que dependem de cada área
  const AREA_RAPIDO = { "rapido-peso": "evolucao", "rapido-refeicao": "alimentacao", "rapido-agua": null, "rapido-treino": "academia", "rapido-checkin": "checkin", "rapido-jejum": "jejum", "rapido-compra": "compras", "rapido-alimento": "alimentacao" };
  function rapidoVisivel(d, acao) { const a = AREA_RAPIDO[acao]; return !a || area(d, a); }

  // ---------------------------------------------------------------------
  // tela Hoje: cartões e destaques
  // ---------------------------------------------------------------------
  const CARTOES = {
    semana: { r: "Sua semana", s: "um anel por dia com quanto foi cumprido" },
    aneis: { r: "Resumo do dia", s: "calorias, proteína e água", area: "alimentacao" },
    destaques: { r: "Cartões de destaque", s: "treinos, peso, sono, gastos…" },
    seudia: { r: "Seu dia", s: "o roteiro em ordem de horário" },
    insights: { r: "Insights", s: "observações dos seus registros" },
    progresso: { r: "Progresso do corpo", s: "primeiro → atual → meta", area: "evolucao" }
  };
  const TILES = {
    treinos: { r: "🏋️ Treinos", area: "academia" }, peso: { r: "⚖️ Peso", area: "evolucao" }, sono: { r: "😴 Sono", area: "checkin" },
    gasto: { r: "🛒 Gasto no mês", area: "compras" }, estoque: { r: "📦 Estoque baixo", area: "compras" }, conquistas: { r: "🏆 Conquistas", area: "metas" }
  };
  function cartoesHoje(d) {
    const h = d.config.hoje;
    return h.cartoes.filter((k) => CARTOES[k] && h.ocultos.indexOf(k) === -1 && (!CARTOES[k].area || area(d, CARTOES[k].area)));
  }
  function tilesHoje(d) {
    const h = d.config.hoje;
    return h.tiles.filter((k) => TILES[k] && h.tilesOcultos.indexOf(k) === -1 && area(d, TILES[k].area));
  }

  // ---------------------------------------------------------------------
  // cartões de Ajustes
  // ---------------------------------------------------------------------
  const P = () => global.Personalizar;
  function cartaoAreas(d) {
    const atual = d.config.perfilUso;
    return UI.card({ titulo: "O que você usa", sub: "desligue o que não faz sentido para você — os dados não são apagados", id: "sec-areas", corpo: `<div class="pad">
      <div class="ap-rot" style="margin-top:0">Perfis prontos</div>
      <div class="presets">${PRESETS.map((p) => `<button class="preset${atual === p.k ? " ativo" : ""}" data-acao="aplicar-perfil" data-k="${p.k}"><span class="pr-ic">${p.ic}</span><span><b>${esc(p.r)}</b><small>${esc(p.s)}</small></span></button>`).join("")}</div>
      <div class="ap-rot">Áreas</div>
      <div class="lista-interruptores areas-lista">${AREAS.map((a) => `<div class="${a.pai ? "area-filho" : ""}${a.pai && d.config.areas[a.pai] === false ? " desligado" : ""}">${P().interruptor("ar_" + a.k, a.r, d.config.areas[a.k] !== false, a.s, `data-mudar="area" data-k="${a.k}"${a.pai && d.config.areas[a.pai] === false ? " disabled" : ""}`)}</div>`).join("")}</div>
      <div class="ap-rot">Abas da barra do celular</div>
      <p class="ajuda" style="margin-top:0">Escolha 4. O resto fica em “Mais”.</p>
      <div class="chips abas-escolha" id="abasEscolha">${SECOES.filter((s) => secaoVisivel(d, s.k)).map((s) => `<label class="chip"><input type="checkbox" value="${s.k}" data-mudar="abas"${(global.Areas.abasAtuais || d.config.abas).indexOf(s.k) !== -1 ? " checked" : ""}><span>${esc(s.r)}</span></label>`).join("")}</div>
    </div>` });
  }
  function cartaoHoje(d) {
    const h = d.config.hoje;
    const linha = (k, def, i, total, oculto, tipo) => {
      const desl = def.area && !area(d, def.area);
      return `<li class="${oculto || desl ? "oculto" : ""}"><span class="ord-txt"><b>${esc(def.r)}</b><small>${desl ? "área desligada" : esc(def.s || "")}</small></span>
        <span class="ord-botoes"><button class="btn fantasma pequeno" data-acao="hoje-mover" data-tipo="${tipo}" data-k="${k}" data-d="-1"${i === 0 ? " disabled" : ""} aria-label="Subir">↑</button><button class="btn fantasma pequeno" data-acao="hoje-mover" data-tipo="${tipo}" data-k="${k}" data-d="1"${i === total - 1 ? " disabled" : ""} aria-label="Descer">↓</button>
        <label class="interruptor sem-txt" title="${oculto ? "Mostrar" : "Esconder"}"><input type="checkbox" data-mudar="hoje-mostrar" data-tipo="${tipo}" data-k="${k}"${oculto ? "" : " checked"}${desl ? " disabled" : ""}><span class="int-trilho"><i></i></span></label></span></li>`;
    };
    return UI.card({ titulo: "Tela Hoje", sub: "quais cartões aparecem e em que ordem", id: "sec-hoje", corpo: `<div class="pad">
      <ul class="ordenaveis">${h.cartoes.filter((k) => CARTOES[k]).map((k, i, l) => linha(k, CARTOES[k], i, l.length, h.ocultos.indexOf(k) !== -1, "cartao")).join("")}</ul>
      <div class="ap-rot">Cartões de destaque</div>
      <ul class="ordenaveis">${h.tiles.filter((k) => TILES[k]).map((k, i, l) => linha(k, TILES[k], i, l.length, h.tilesOcultos.indexOf(k) !== -1, "tile")).join("")}</ul>
      <div class="lista-interruptores" style="margin-top:14px">${P().interruptor("hj_rec", "Recolher o que já foi feito", h.recolherFeitos !== false, "No “Seu dia”, os itens concluídos ficam guardados num botão — a lista mostra só o que falta.", 'data-mudar="hoje-recolher"')}</div>
      <p class="rodape-card"><button class="link-acao" data-acao="hoje-padrao">Voltar ao padrão</button></p>
    </div>` });
  }

  // ---------------------------------------------------------------------
  // ações
  // ---------------------------------------------------------------------
  const App = () => global.App;
  const salvarCfg = (msg) => App().salvar(msg || null, { semIntegracao: true });
  function aplicarPerfil(k, silencioso) {
    const p = PRESETS.find((x) => x.k === k);
    if (!p) return;
    const d = App().dados();
    d.config.areas = Object.assign({}, p.areas);
    d.config.abas = p.abas.slice();
    d.config.perfilUso = k;
    d.config.rotina.mostrar.peso = p.peso;
    if (p.fonte && (d.config.aparencia.fonte || "normal") === "normal") d.config.aparencia.fonte = p.fonte;
    if (p.crianca) { d.config.alertas.pesoSemRegistro = false; d.config.alertas.mudancaRelevante = false; }
    if (!silencioso) salvarCfg(`Perfil “${p.r}” aplicado. Dá para ajustar cada área abaixo.`);
  }
  global.App.registrarAcoes({
    "aplicar-perfil": (el) => aplicarPerfil(el.dataset.k),
    "hoje-mover": (el) => {
      const h = App().dados().config.hoje, lista = el.dataset.tipo === "tile" ? h.tiles : h.cartoes;
      const i = lista.indexOf(el.dataset.k), j = i + Number(el.dataset.d);
      if (i < 0 || j < 0 || j >= lista.length) return;
      lista.splice(j, 0, lista.splice(i, 1)[0]);
      salvarCfg();
    },
    "hoje-padrao": () => { App().dados().config.hoje = A.hojePadrao(); salvarCfg("Tela Hoje voltou ao padrão."); },
    "hoje-mostrar-feitos": () => { App().estado.hojeMostrarFeitos = !App().estado.hojeMostrarFeitos; App().renderizar(); }
  });
  global.App.registrarMudancas({
    "area": (el) => {
      const d = App().dados();
      d.config.areas[el.dataset.k] = el.checked;
      d.config.perfilUso = null;
      // ligar uma parte do Bem-estar liga a tela; desligar todas, desliga
      const be = AREAS.find((a) => a.k === "bemestar");
      if (be.filhos.indexOf(el.dataset.k) !== -1 && el.checked) d.config.areas.bemestar = true;
      salvarCfg();
    },
    "abas": (el) => {
      const marcadas = UI.chips("abasEscolha");
      if (marcadas.length > 4) { el.checked = false; UI.toast("São 4 abas — desmarque uma antes."); return; }
      App().dados().config.abas = marcadas;
      salvarCfg();
    },
    "hoje-mostrar": (el) => {
      const h = App().dados().config.hoje, lista = el.dataset.tipo === "tile" ? h.tilesOcultos : h.ocultos;
      const i = lista.indexOf(el.dataset.k);
      if (el.checked && i !== -1) lista.splice(i, 1);
      if (!el.checked && i === -1) lista.push(el.dataset.k);
      salvarCfg();
    },
    "hoje-recolher": (el) => { App().dados().config.hoje.recolherFeitos = el.checked; salvarCfg(); }
  });

  global.Areas = { SECOES, AREAS, PRESETS, CARTOES, TILES, AREA_ALERTA, area, secaoVisivel, areaDaRota, aplicarNavegacao, rapidoVisivel, cartoesHoje, tilesHoje, cartaoAreas, cartaoHoje, aplicarPerfil, abasAtuais: null, maisAtuais: null };
})(window);
