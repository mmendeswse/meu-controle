/**
 * descanso.js
 * -----------------------------------------------------------------------
 * Cronômetro de descanso do treino. Aparece na tela de um treino aberto:
 * começa sozinho quando um exercício é marcado como feito (dá para
 * desligar), usa o descanso cadastrado no exercício da ficha quando há um,
 * e no fim vibra e apita. Enquanto conta, uma pílula flutuante mostra o
 * tempo em qualquer tela do app.
 *
 * Preferências em config.descanso: segundos, auto (início automático), som.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const UI = global.UI, A = global.Armazenamento;
  const App = () => global.App;
  const PRESETS = [30, 45, 60, 90, 120, 180];
  const cfg = () => { const d = App().dados(); return d.config.descanso || (d.config.descanso = A.configPadrao().descanso); };
  const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.max(0, s % 60)).padStart(2, "0");
  const rot = (s) => s < 60 ? s + " s" : (s % 60 ? fmt(s) : s / 60 + " min");

  const st = { fim: 0, total: 0, timer: null, audio: null, trava: null };
  const rodando = () => st.fim > Date.now();
  const resta = () => Math.max(0, Math.ceil((st.fim - Date.now()) / 1000));

  // "90s", "1min", "1:30", "2 min" → segundos
  function lerDescanso(txt) {
    const t = String(txt || "").trim().toLowerCase();
    let m;
    if ((m = t.match(/^(\d+):(\d{1,2})$/))) return Number(m[1]) * 60 + Number(m[2]);
    if ((m = t.match(/^(\d+(?:[.,]\d+)?)\s*(min|m)\b/))) return Math.round(Number(m[1].replace(",", ".")) * 60);
    if ((m = t.match(/^(\d+)\s*(s|seg)?/))) return Number(m[1]);
    return null;
  }

  function bip() {
    if (cfg().som === false || !st.audio) return;
    try {
      const ctx = st.audio, t0 = ctx.currentTime;
      [0, 0.22, 0.44].forEach((dt, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.value = i === 2 ? 1175 : 880;
        g.gain.setValueAtTime(0.0001, t0 + dt); g.gain.exponentialRampToValueAtTime(0.25, t0 + dt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.18);
        o.connect(g); g.connect(ctx.destination); o.start(t0 + dt); o.stop(t0 + dt + 0.2);
      });
    } catch (e) { /* sem áudio */ }
  }
  function prepararAudio() {
    if (cfg().som === false) return;
    try {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      if (!st.audio) st.audio = new AC();
      if (st.audio.state === "suspended") st.audio.resume();
    } catch (e) { /* sem áudio */ }
  }
  function manterTela(ligar) {
    try {
      if (ligar && navigator.wakeLock && !st.trava) navigator.wakeLock.request("screen").then((w) => { st.trava = w; w.addEventListener("release", () => { st.trava = null; }); }).catch(() => {});
      if (!ligar && st.trava) { st.trava.release().catch(() => {}); st.trava = null; }
    } catch (e) { /* sem suporte */ }
  }

  function iniciar(seg) {
    seg = Math.max(5, Math.round(seg || cfg().segundos || 60));
    st.total = seg; st.fim = Date.now() + seg * 1000;
    prepararAudio(); manterTela(true);
    clearInterval(st.timer);
    st.timer = setInterval(tique, 250);
    desenhar();
  }
  function parar(terminou) {
    clearInterval(st.timer); st.timer = null; st.fim = 0;
    manterTela(false);
    if (terminou) {
      const ap = App().dados().config.aparencia || {};
      if (ap.vibrar !== false && navigator.vibrate) { try { navigator.vibrate([220, 120, 220]); } catch (e) { /* sem suporte */ } }
      bip();
      UI.toast("⏱️ Descanso terminou — próxima série!");
    }
    desenhar();
  }
  function tique() {
    if (!rodando()) { parar(true); return; }
    const s = resta(), p = st.total ? (1 - s / st.total) * 100 : 0;
    document.querySelectorAll("[data-ds='tempo']").forEach((e) => { e.textContent = fmt(s); });
    document.querySelectorAll("[data-ds='barra']").forEach((e) => { e.style.width = p.toFixed(1) + "%"; });
  }

  function htmlBarra() {
    const c = cfg(), on = rodando(), s = on ? resta() : c.segundos;
    return `<span class="ds-ic">⏱️</span>
      <div class="ds-txt"><small>${on ? "Descansando" : "Descanso"}</small><b data-ds="tempo">${fmt(s)}</b></div>
      ${on ? `<span class="ds-trilho"><i data-ds="barra" style="width:${(st.total ? (1 - s / st.total) * 100 : 0).toFixed(1)}%"></i></span>
        <div class="ds-botoes"><button class="btn pequeno" data-acao="descanso-mais">+15 s</button><button class="btn pequeno" data-acao="descanso-parar">Parar</button></div>`
      : `<div class="ds-presets" role="radiogroup" aria-label="Tempo de descanso">${PRESETS.map((p) => `<button role="radio" aria-checked="${p === c.segundos}" class="${p === c.segundos ? "ativo" : ""}" data-acao="descanso-tempo" data-s="${p}">${rot(p)}</button>`).join("")}</div>
        <div class="ds-botoes"><button class="btn pequeno primario" data-acao="descanso-iniciar">Iniciar</button></div>
        <div class="ds-opcoes"><label class="ds-auto"><input type="checkbox" data-mudar="descanso-auto"${c.auto !== false ? " checked" : ""}> começar ao marcar um exercício</label>
          <label class="ds-auto"><input type="checkbox" data-mudar="descanso-som"${c.som !== false ? " checked" : ""}> som no fim</label></div>`}`;
  }
  function desenhar() {
    const noTreino = App().rota().secao === "treino";
    let barra = document.querySelector("#conteudo .descanso");
    if (noTreino && !barra) {
      const kpis = document.querySelector("#conteudo .kpi-row");
      if (kpis) { barra = document.createElement("section"); barra.className = "descanso"; barra.setAttribute("aria-label", "Cronômetro de descanso"); kpis.insertAdjacentElement("beforebegin", barra); }
    }
    if (barra) { barra.classList.toggle("rodando", rodando()); barra.innerHTML = htmlBarra(); }
    // pílula flutuante: o tempo à vista em qualquer tela enquanto conta
    let pil = document.getElementById("descansoPilula");
    if (rodando()) {
      if (!pil) { pil = document.createElement("div"); pil.id = "descansoPilula"; pil.className = "descanso-pilula"; document.body.appendChild(pil); }
      pil.innerHTML = `<button class="dp-tempo" data-acao="descanso-ver" aria-label="Descanso — ver o treino">⏱️ <b data-ds="tempo">${fmt(resta())}</b></button><button class="dp-x" data-acao="descanso-parar" aria-label="Parar o descanso">✕</button>`;
    } else if (pil) pil.remove();
  }
  App().aoRenderizar(() => desenhar());

  // começa sozinho quando um exercício pendente é marcado como feito
  // (este ouvinte roda antes do app trocar o status)
  document.addEventListener("click", (e) => {
    const b = e.target.closest('[data-acao="ciclar-serie"]');
    if (!b || !App().dados()) return;
    const d = App().dados(), c = cfg();
    if (c.auto === false) return;
    const s = d.series.find((x) => x.id === b.dataset.id);
    if (!s || s.status !== "Pendente") return;
    const t = d.treinos.find((x) => x.id === s.treinoId);
    const ex = t && t.fichaId ? d.exercicios.find((x) => x.fichaId === t.fichaId && x.nome === s.exercicio) : null;
    const seg = (ex && lerDescanso(ex.descanso)) || c.segundos;
    setTimeout(() => iniciar(seg), 0);
  });

  App().registrarAcoes({
    "descanso-iniciar": () => iniciar(cfg().segundos),
    "descanso-parar": () => parar(false),
    "descanso-mais": () => { if (rodando()) { st.fim += 15000; st.total += 15; tique(); } },
    "descanso-tempo": (el) => { cfg().segundos = Number(el.dataset.s) || 60; A.salvarDados(App().dados(), true, true); desenhar(); },
    "descanso-ver": () => { if (App().rota().secao !== "treino") { const d = App().dados(), hj = global.Nucleo.hoje(0); const t = d.treinos.filter((x) => x.data === hj && x.status !== "Cancelado").pop(); if (t) App().ir("treino", t.id); else App().ir("academia"); } }
  });
  App().registrarMudancas({
    "descanso-auto": (el) => { cfg().auto = el.checked; A.salvarDados(App().dados(), true, true); },
    "descanso-som": (el) => { cfg().som = el.checked; A.salvarDados(App().dados(), true, true); }
  });

  global.Descanso = { iniciar, parar, rodando, lerDescanso };
})(window);
