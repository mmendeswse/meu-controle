/**
 * graficos.js
 * -----------------------------------------------------------------------
 * Toda a comunicação com o Chart.js fica isolada aqui. As páginas só
 * chamam Graficos.renderX(idDoCanvas, dados).
 *
 * Regras de desenho (iguais em todos os gráficos):
 *   - um eixo Y só; linhas de 2px; grade discreta; tooltip em tudo
 *   - ciano = série principal; tracejado âmbar = meta
 *   - verde/vermelho/âmbar ficam reservados para status (feito/perdido/atenção)
 *   - categorias: ordem fixa ciano → violeta → laranja → azul (nunca ciclada
 *     além disso — o resto vira "Outros")
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const CORES = {
    cy: "#00E5FF", up: "#2EE59D", down: "#FF5C6A", azul: "#38B6FF", vi: "#A66BFF", acc: "#FFA726",
    dim: "#6E8494", grade: "rgba(110,132,148,0.14)", texto: "#8FA3B3", painel: "#0B141C"
  };
  const PALETA_CATEGORIAS = [CORES.cy, CORES.vi, CORES.acc, CORES.azul, "#7E93A6"];

  const instancias = {};
  function brl(v) { return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function fmtNum(v, casas) { return Number(v).toLocaleString("pt-BR", { maximumFractionDigits: casas == null ? 1 : casas }); }
  function fonte(tam) { return { family: "-apple-system, 'Segoe UI', Roboto, Inter, sans-serif", size: tam || 11, weight: "600" }; }
  function abreviaR(v) { return Math.abs(v) >= 1000 ? "R$ " + (v / 1000).toFixed(1).replace(".", ",") + "k" : "R$ " + Math.round(v); }
  function dataCurta(iso) { return iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : ""; }

  function destruir(id) { if (instancias[id]) { instancias[id].destroy(); delete instancias[id]; } }
  function destruirTodos() { Object.keys(instancias).forEach(destruir); }
  function ctxOf(id) { const el = document.getElementById(id); return el ? el.getContext("2d") : null; }
  function tooltip(extra) {
    return Object.assign({
      backgroundColor: "#0F1B26", borderColor: "#1F3440", borderWidth: 1, titleColor: "#EDF2FA", bodyColor: "#EDF2FA",
      padding: 10, titleFont: fonte(11), bodyFont: fonte(11), displayColors: true, boxPadding: 4, mode: "index", intersect: false
    }, extra || {});
  }
  function eixoX(extra) { return Object.assign({ grid: { display: false }, border: { display: false }, ticks: { color: CORES.texto, font: fonte(10.5), maxRotation: 0, autoSkipPadding: 12 } }, extra || {}); }
  function eixoY(extra) { return Object.assign({ grid: { color: CORES.grade }, border: { display: false }, ticks: { color: CORES.texto, font: fonte(10.5), maxTicksLimit: 6 } }, extra || {}); }
  function legenda(mostrar) { return { display: !!mostrar, labels: { color: CORES.texto, font: fonte(11), boxWidth: 10, boxHeight: 10, usePointStyle: true } }; }
  function criar(id, config) {
    const ctx = ctxOf(id);
    if (!ctx || !global.Chart) return null;
    destruir(id);
    instancias[id] = new global.Chart(ctx, config);
    return instancias[id];
  }
  function gradiente(ctx, cor) {
    const g = ctx.createLinearGradient(0, 0, 0, 240);
    g.addColorStop(0, cor + "44"); g.addColorStop(1, cor + "00");
    return g;
  }
  const BASE = { responsive: true, maintainAspectRatio: false, animation: { duration: 250 }, interaction: { mode: "index", intersect: false } };

  // ---------------------------------------------------------------------
  // linha de uma métrica ao longo do tempo (peso, gordura, cintura…)
  // pontos: [{data, valor}] · opc: {un, cor, meta, rotulo, casas}
  // ---------------------------------------------------------------------
  function renderMetrica(id, pontos, opc) {
    opc = opc || {};
    const ctx = ctxOf(id);
    if (!ctx) return;
    const cor = opc.cor || CORES.cy;
    const un = opc.un ? " " + opc.un : "";
    const ds = [{
      label: opc.rotulo || "Valor", data: pontos.map((p) => p.valor), borderColor: cor, backgroundColor: gradiente(ctx, cor),
      fill: true, tension: 0.3, borderWidth: 2, pointRadius: pontos.length > 40 ? 0 : 3, pointHoverRadius: 5,
      pointBackgroundColor: cor, pointBorderColor: CORES.painel, pointBorderWidth: 2, spanGaps: true
    }];
    if (opc.meta != null) ds.push({ label: "Meta", data: pontos.map(() => opc.meta), borderColor: CORES.acc, borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0, fill: false });
    criar(id, {
      type: "line",
      data: { labels: pontos.map((p) => dataCurta(p.data)), datasets: ds },
      options: Object.assign({}, BASE, {
        plugins: { legend: legenda(opc.meta != null), tooltip: tooltip({ callbacks: { label: (c) => " " + c.dataset.label + ": " + fmtNum(c.parsed.y, opc.casas) + un } }) },
        scales: { x: eixoX(), y: eixoY({ ticks: { color: CORES.texto, font: fonte(10.5), maxTicksLimit: 6, callback: (v) => fmtNum(v, 1) + un } }) }
      })
    });
  }

  // várias linhas no mesmo eixo (ex.: braço direito × esquerdo)
  // series: [{nome, cor, pontos:[{data, valor}]}]
  function renderMultiplas(id, series, opc) {
    opc = opc || {};
    const un = opc.un ? " " + opc.un : "";
    const datas = [];
    series.forEach((s) => s.pontos.forEach((p) => { if (datas.indexOf(p.data) === -1) datas.push(p.data); }));
    datas.sort();
    const ds = series.map((s, i) => {
      const m = {}; s.pontos.forEach((p) => { m[p.data] = p.valor; });
      const cor = s.cor || PALETA_CATEGORIAS[i];
      return { label: s.nome, data: datas.map((x) => m[x] == null ? null : m[x]), borderColor: cor, backgroundColor: cor, fill: false, tension: 0.3, borderWidth: 2,
        pointRadius: 3, pointBorderColor: CORES.painel, pointBorderWidth: 2, spanGaps: true, borderDash: s.tracejado ? [5, 5] : undefined };
    });
    criar(id, {
      type: "line",
      data: { labels: datas.map(dataCurta), datasets: ds },
      options: Object.assign({}, BASE, {
        plugins: { legend: legenda(ds.length > 1), tooltip: tooltip({ callbacks: { label: (c) => " " + c.dataset.label + ": " + (c.parsed.y == null ? "—" : fmtNum(c.parsed.y, opc.casas) + un) } }) },
        scales: { x: eixoX(), y: eixoY({ ticks: { color: CORES.texto, font: fonte(10.5), maxTicksLimit: 6, callback: (v) => fmtNum(v, 1) + un } }) }
      })
    });
  }

  // barras por dia com linha de meta (calorias, água…)
  // itens: [{rotulo, valor}] · opc: {meta, un, cor}
  function renderBarrasMeta(id, itens, opc) {
    opc = opc || {};
    const un = opc.un ? " " + opc.un : "";
    const ds = [{ type: "bar", label: opc.rotulo || "Consumido", data: itens.map((i) => i.valor), backgroundColor: (opc.cor || CORES.cy) + "B3", borderRadius: 4, borderSkipped: "bottom", maxBarThickness: 28 }];
    if (opc.meta) ds.push({ type: "line", label: "Meta", data: itens.map(() => opc.meta), borderColor: CORES.acc, borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0, fill: false });
    criar(id, {
      type: "bar",
      data: { labels: itens.map((i) => i.rotulo), datasets: ds },
      options: Object.assign({}, BASE, {
        plugins: { legend: legenda(!!opc.meta), tooltip: tooltip({ callbacks: { label: (c) => " " + c.dataset.label + ": " + fmtNum(c.parsed.y, 0) + un } }) },
        scales: { x: eixoX(), y: eixoY({ beginAtZero: true }) }
      })
    });
  }

  // treinos por semana: realizados (verde) × perdidos (vermelho), empilhados
  function renderTreinosSemana(id, serie) {
    criar(id, {
      type: "bar",
      data: {
        labels: serie.map((s) => s.rotulo),
        datasets: [
          { label: "Realizados", data: serie.map((s) => s.realizados), backgroundColor: CORES.up + "CC", borderRadius: 4, maxBarThickness: 26, borderColor: CORES.painel, borderWidth: { top: 2 } },
          { label: "Perdidos", data: serie.map((s) => s.perdidos), backgroundColor: CORES.down + "99", borderRadius: 4, maxBarThickness: 26 }
        ]
      },
      options: Object.assign({}, BASE, {
        plugins: { legend: legenda(true), tooltip: tooltip() },
        scales: { x: eixoX({ stacked: true }), y: eixoY({ stacked: true, beginAtZero: true, ticks: { stepSize: 1, color: CORES.texto, font: fonte(10.5) } }) }
      })
    });
  }

  // rosca (macros, categorias de gasto…) — itens: [{nome, valor, cor?}]
  function renderRosca(id, itens, formatador) {
    const fmt = formatador || ((v) => v);
    criar(id, {
      type: "doughnut",
      data: { labels: itens.map((i) => i.nome), datasets: [{ data: itens.map((i) => i.valor), backgroundColor: itens.map((i, k) => i.cor || PALETA_CATEGORIAS[Math.min(k, PALETA_CATEGORIAS.length - 1)]), borderColor: CORES.painel, borderWidth: 2, hoverOffset: 4 }] },
      options: { responsive: false, cutout: "72%", animation: { duration: 250 }, plugins: { legend: { display: false }, tooltip: tooltip({ mode: "nearest", intersect: true, callbacks: { label: (c) => " " + c.label + ": " + fmt(c.parsed) } }) } }
    });
  }

  // gasto real × estimado por mês
  function renderGastosMes(id, serie) {
    criar(id, {
      type: "bar",
      data: {
        labels: serie.map((s) => s.rotulo),
        datasets: [
          { label: "Pago", data: serie.map((s) => s.gasto), backgroundColor: CORES.cy + "CC", borderRadius: 4, maxBarThickness: 22 },
          { label: "Estimado", data: serie.map((s) => s.estimado), backgroundColor: CORES.vi + "80", borderRadius: 4, maxBarThickness: 22 }
        ]
      },
      options: Object.assign({}, BASE, {
        plugins: { legend: legenda(true), tooltip: tooltip({ callbacks: { label: (c) => " " + c.dataset.label + ": " + brl(c.parsed.y) } }) },
        scales: { x: eixoX(), y: eixoY({ beginAtZero: true, ticks: { color: CORES.texto, font: fonte(10.5), maxTicksLimit: 6, callback: abreviaR } }) }
      })
    });
  }

  // evolução da carga de um exercício — pontos: [{data, carga}]
  function renderCarga(id, pontos) {
    renderMetrica(id, pontos.map((p) => ({ data: p.data, valor: p.carga })), { un: "kg", rotulo: "Carga máxima", casas: 1 });
  }

  global.Graficos = { CORES, PALETA_CATEGORIAS, destruir, destruirTodos, renderMetrica, renderMultiplas, renderBarrasMeta, renderTreinosSemana, renderRosca, renderGastosMes, renderCarga };
})(window);
