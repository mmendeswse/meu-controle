/**
 * graficos.js
 * -----------------------------------------------------------------------
 * Toda a comunicação com o Chart.js fica isolada aqui. O app.js só chama
 * Graficos.renderX(idDoCanvas, dados) — não sabe nada sobre a biblioteca.
 *
 * Cada gráfico é registrado por id de canvas e destruído antes de ser
 * recriado (as telas são recriadas via innerHTML ao trocar de seção).
 *
 * Paleta: ciano como cor de marca, verde para "bom" (treino feito, peso
 * caindo quando o objetivo é emagrecer), rosa para alertas e gastos,
 * azul para informação, roxo e laranja para categorias extras.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  var CORES = {
    cy: "#00E5FF",
    up: "#2EE59D",
    down: "#FF5C6A",
    azul: "#38B6FF",
    vi: "#A66BFF",
    acc: "#FFA726",
    rosa: "#FF2E92",
    dim: "#6E8494",
    grade: "rgba(110,132,148,0.14)",
    texto: "#8FA3B3",
    painel: "#0B141C"
  };
  var PALETA_CATEGORIAS = [CORES.cy, CORES.up, CORES.acc, CORES.azul, CORES.vi, CORES.down, CORES.rosa, CORES.dim, "#7ED957", "#F5D76E"];

  var instancias = {};

  function moeda(v) { return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function kg(v) { return (Number(v) || 0).toFixed(1).replace(".", ",") + " kg"; }
  function fonte(tam) { return { family: "'Segoe UI', Roboto, Inter, sans-serif", size: tam || 11, weight: "600" }; }
  function abreviaR(v) {
    var a = Math.abs(v);
    if (a >= 1000) return "R$ " + (v / 1000).toFixed(1).replace(".", ",") + "k";
    return "R$ " + Math.round(v);
  }
  function dataCurta(iso) {
    return iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "";
  }

  function destruir(id) {
    if (instancias[id]) { instancias[id].destroy(); delete instancias[id]; }
  }
  function destruirTodos() { Object.keys(instancias).forEach(destruir); }
  function ctxOf(canvasId) {
    var el = document.getElementById(canvasId);
    return el ? el.getContext("2d") : null;
  }
  function tooltipPadrao(extra) {
    return Object.assign({
      backgroundColor: "#0F1B26", borderColor: "#1F3440", borderWidth: 1,
      titleColor: "#EDF2FA", bodyColor: "#EDF2FA", padding: 10,
      titleFont: fonte(11), bodyFont: fonte(11), displayColors: true, boxPadding: 4
    }, extra || {});
  }
  function eixoX(extra) {
    return Object.assign({ grid: { display: false }, border: { display: false }, ticks: { color: CORES.texto, font: fonte(10.5) } }, extra || {});
  }
  function eixoY(extra) {
    return Object.assign({ grid: { color: CORES.grade }, border: { display: false, dash: [3, 3] }, ticks: { color: CORES.texto, font: fonte(10.5) } }, extra || {});
  }
  function criar(id, config) {
    var ctx = ctxOf(id);
    if (!ctx || !global.Chart) return null;
    destruir(id);
    instancias[id] = new global.Chart(ctx, config);
    return instancias[id];
  }
  function gradiente(ctx, cor) {
    var g = ctx.createLinearGradient(0, 0, 0, 220);
    g.addColorStop(0, cor + "55");
    g.addColorStop(1, cor + "00");
    return g;
  }

  // ---------------------------------------------------------------------
  // linha de evolução do peso — uma série por pessoa
  // series: [{ nome, cor, pontos: [{data, peso}] }]
  // ---------------------------------------------------------------------
  function renderEvolucaoPeso(id, series, metaKg) {
    var ctx = ctxOf(id);
    if (!ctx) return;
    var datasets = series.filter(function (s) { return s.pontos.length; }).map(function (s, i) {
      var cor = s.cor || PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length];
      return {
        label: s.nome,
        data: s.pontos.map(function (p) { return { x: p.data, y: p.peso }; }),
        borderColor: cor, backgroundColor: series.length === 1 ? gradiente(ctx, cor) : "transparent",
        fill: series.length === 1, tension: 0.3, borderWidth: 2.2,
        pointRadius: 3.5, pointBackgroundColor: cor, pointBorderColor: CORES.painel, pointBorderWidth: 1.5
      };
    });
    if (metaKg && datasets.length === 1) {
      var xs = datasets[0].data.map(function (p) { return p.x; });
      datasets.push({ label: "Meta", data: xs.map(function (x) { return { x: x, y: metaKg }; }), borderColor: CORES.acc, borderDash: [5, 5], borderWidth: 1.4, pointRadius: 0, fill: false });
    }
    // eixo X como categoria (datas em texto) para não depender de adaptador de datas
    var rotulos = [];
    datasets.forEach(function (ds) { ds.data.forEach(function (p) { if (rotulos.indexOf(p.x) === -1) rotulos.push(p.x); }); });
    rotulos.sort();
    datasets.forEach(function (ds) {
      var mapa = {}; ds.data.forEach(function (p) { mapa[p.x] = p.y; });
      ds.data = rotulos.map(function (r) { return mapa[r] == null ? null : mapa[r]; });
      ds.spanGaps = true;
    });
    criar(id, {
      type: "line",
      data: { labels: rotulos.map(dataCurta), datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: datasets.length > 1, labels: { color: CORES.texto, font: fonte(11), boxWidth: 10, usePointStyle: true } },
          tooltip: tooltipPadrao({ callbacks: { label: function (c) { return " " + c.dataset.label + ": " + kg(c.parsed.y); } } })
        },
        scales: { x: eixoX(), y: eixoY({ ticks: { color: CORES.texto, font: fonte(10.5), callback: function (v) { return v + " kg"; } } }) }
      }
    });
  }

  // barras: treinos realizados por mês
  function renderTreinosMes(id, serie) {
    criar(id, {
      type: "bar",
      data: {
        labels: serie.map(function (s) { return s.rotulo; }),
        datasets: [{ label: "Treinos realizados", data: serie.map(function (s) { return s.valor; }), backgroundColor: CORES.up + "CC", borderRadius: 4, maxBarThickness: 34 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: tooltipPadrao() },
        scales: { x: eixoX(), y: eixoY({ beginAtZero: true, ticks: { stepSize: 1, color: CORES.texto, font: fonte(10.5) } }) }
      }
    });
  }

  // rosca genérica (grupos musculares, categorias de gasto, locais…)
  function renderRosca(id, itens, formatador) {
    var fmt = formatador || function (v) { return v; };
    criar(id, {
      type: "doughnut",
      data: {
        labels: itens.map(function (i) { return i.nome || i.grupo || i.status; }),
        datasets: [{ data: itens.map(function (i) { return i.valor; }), backgroundColor: itens.map(function (i, k) { return i.cor || PALETA_CATEGORIAS[k % PALETA_CATEGORIAS.length]; }), borderColor: CORES.painel, borderWidth: 2, hoverOffset: 4 }]
      },
      options: {
        responsive: false, cutout: "72%",
        plugins: { legend: { display: false }, tooltip: tooltipPadrao({ callbacks: { label: function (c) { return " " + c.label + ": " + fmt(c.parsed); } } }) }
      }
    });
  }

  // barras: gasto real x estimado por mês
  function renderGastosMes(id, serie) {
    criar(id, {
      type: "bar",
      data: {
        labels: serie.map(function (s) { return s.rotulo; }),
        datasets: [
          { label: "Gasto", data: serie.map(function (s) { return s.gasto; }), backgroundColor: CORES.down + "CC", borderRadius: 4, maxBarThickness: 26 },
          { label: "Previsto", data: serie.map(function (s) { return s.estimado; }), backgroundColor: CORES.cy + "66", borderRadius: 4, maxBarThickness: 26 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: CORES.texto, font: fonte(11), boxWidth: 10, usePointStyle: true } },
          tooltip: tooltipPadrao({ callbacks: { label: function (c) { return " " + c.dataset.label + ": " + moeda(c.parsed.y); } } })
        },
        scales: { x: eixoX(), y: eixoY({ beginAtZero: true, ticks: { color: CORES.texto, font: fonte(10.5), callback: abreviaR } }) }
      }
    });
  }

  // barras horizontais (gasto por categoria / local / produto)
  function renderBarrasHorizontais(id, itens, cor, formatador) {
    var fmt = formatador || moeda;
    criar(id, {
      type: "bar",
      data: {
        labels: itens.map(function (i) { return i.nome; }),
        datasets: [{ data: itens.map(function (i) { return i.valor; }), backgroundColor: itens.map(function (i, k) { return i.cor || cor || PALETA_CATEGORIAS[k % PALETA_CATEGORIAS.length]; }), borderRadius: 4, maxBarThickness: 22 }]
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: tooltipPadrao({ callbacks: { label: function (c) { return " " + fmt(c.parsed.x); } } }) },
        scales: { x: eixoY({ beginAtZero: true, ticks: { color: CORES.texto, font: fonte(10.5), callback: function (v) { return fmt === moeda ? abreviaR(v) : v; } } }), y: eixoX() }
      }
    });
  }

  // linha: evolução da carga de um exercício
  function renderCarga(id, pontos) {
    var ctx = ctxOf(id);
    if (!ctx) return;
    criar(id, {
      type: "line",
      data: {
        labels: pontos.map(function (p) { return dataCurta(p.data); }),
        datasets: [{ label: "Carga (kg)", data: pontos.map(function (p) { return p.carga; }), borderColor: CORES.cy, backgroundColor: gradiente(ctx, CORES.cy), fill: true, tension: 0.3, borderWidth: 2.2, pointRadius: 4, pointBackgroundColor: CORES.cy, pointBorderColor: CORES.painel, pointBorderWidth: 1.5 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: tooltipPadrao({ callbacks: { label: function (c) { return " " + kg(c.parsed.y); } } }) },
        scales: { x: eixoX(), y: eixoY({ ticks: { color: CORES.texto, font: fonte(10.5), callback: function (v) { return v + " kg"; } } }) }
      }
    });
  }

  global.Graficos = {
    CORES: CORES,
    PALETA_CATEGORIAS: PALETA_CATEGORIAS,
    destruir: destruir,
    destruirTodos: destruirTodos,
    renderEvolucaoPeso: renderEvolucaoPeso,
    renderTreinosMes: renderTreinosMes,
    renderRosca: renderRosca,
    renderGastosMes: renderGastosMes,
    renderBarrasHorizontais: renderBarrasHorizontais,
    renderCarga: renderCarga
  };
})(window);
