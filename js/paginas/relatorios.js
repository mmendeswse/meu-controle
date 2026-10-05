/**
 * paginas/relatorios.js — relatórios diário/semanal/mensal/trimestral com
 * exportação (PDF, CSV, Excel) e a área de Insights.
 */
(function () {
  "use strict";

  const N = window.Nucleo, UI = window.UI, R = window.Relatorios, I = window.Insights, G = window.Graficos, App = window.App;
  const esc = UI.esc;
  const st = App.estado.relatorios = { tipo: "semanal", ancora: N.hoje(0) };
  let ultimo = null; // último relatório gerado (para exportar)

  function comparar(atual, anterior, menorMelhor, fmt) {
    if (atual == null || anterior == null || !anterior) return "";
    const p = ((atual - anterior) / Math.abs(anterior)) * 100;
    if (Math.abs(p) < 0.5) return `<span class="dim">igual ao período anterior</span>`;
    return UI.deltaPill(UI.sinal(p, 0, "%"), menorMelhor == null ? null : menorMelhor ? p < 0 : p > 0) + ` <span class="dim">vs anterior${fmt ? " (" + fmt(anterior) + ")" : ""}</span>`;
  }

  function relatorio(d) {
    const r = ultimo = R.gerar(d, st.tipo, st.ancora);
    const p = r.periodo, n = r.nutricao, mt = r.metas;
    const futuro = p.ini > N.hoje(0);
    const nav = `<div class="nav-data"><button class="btn pequeno" data-acao="rel-nav" data-delta="-1" aria-label="Período anterior">‹</button><span class="nav-rotulo">${esc(p.rotulo)}</span><button class="btn pequeno" data-acao="rel-nav" data-delta="1" aria-label="Próximo período">›</button><button class="btn pequeno" data-acao="rel-nav" data-hoje="1">Atual</button></div>`;
    const exp = `<div class="exportar"><span class="dim">Exportar relatório:</span>
      <button class="btn pequeno" data-acao="rel-pdf" title="Abre a impressão — escolha “Salvar como PDF”">${UI.svg("download")}PDF</button>
      <button class="btn pequeno" data-acao="rel-csv">${UI.svg("download")}CSV</button>
      <button class="btn pequeno" data-acao="rel-xlsx">${UI.svg("download")}Excel</button></div>`;
    const pesoTxt = r.peso ? UI.kg(r.peso.media) : UI.SEM_DADOS;
    const kcalSub = n.kcal.media != null ? `${n.kcal.dias} ${UI.plural(n.kcal.dias, "dia", "dias")} com registro${mt.kcal ? " · meta " + UI.numAuto(mt.kcal, 0) : ""}` : "";
    const secao = (titulo, kpis) => `<div class="sechead">${titulo}</div><div class="kpi-row">${kpis.join("")}</div>`;
    const html = `
      <div class="barra-ferramentas">${UI.abas(Object.keys(R.TIPOS).map((k) => ({ k, r: R.TIPOS[k] })), st.tipo, "rel-tipo", "abas-sec")}${nav}</div>
      <div class="barra-ferramentas">${exp}</div>
      <div class="so-impressao"><h1>Meu Controle — Relatório ${R.TIPOS[st.tipo].toLowerCase()}</h1><p>${esc(p.rotulo)} (${UI.dataBR(p.ini)} a ${UI.dataBR(p.fim)}) · gerado em ${new Date().toLocaleString("pt-BR")}</p></div>
      ${futuro ? `<div class="vazio"><p>Este período ainda não começou.</p></div>` : `
      ${secao("CORPO", [
        UI.kpi({ rotulo: "Peso médio", valor: pesoTxt, sub: r.peso ? r.peso.registros + " " + UI.plural(r.peso.registros, "pesagem", "pesagens") : "", delta: r.peso ? comparar(r.peso.media, r.anterior.pesoMedio, null, UI.kg) : "" }),
        UI.kpi({ rotulo: "Variação de peso", valor: r.peso && r.peso.delta != null ? UI.sinal(r.peso.delta, 1, "kg") : UI.SEM_DADOS, sub: r.peso && r.peso.delta != null ? UI.dataCurta(r.peso.inicio.data) + " → " + UI.dataCurta(r.peso.fim.data) : "" }),
        UI.kpi({ rotulo: "Massa muscular", valor: r.massa ? UI.kg(r.massa.fim.valor) : UI.SEM_DADOS, sub: r.massa && r.massa.delta != null ? UI.sinal(r.massa.delta, 1, "kg") + " no período" : "" }),
        UI.kpi({ rotulo: "Gordura corporal", valor: r.gordura ? UI.num(r.gordura.fim.valor, 1) + "%" : UI.SEM_DADOS, sub: r.gordura && r.gordura.delta != null ? UI.sinal(r.gordura.delta, 1, "p.p.") + " no período" : "" })
      ])}
      ${secao("TREINOS", [
        UI.kpi({ rotulo: "Realizados", valor: String(r.treinos.realizados), delta: comparar(r.treinos.realizados, r.anterior.realizados, false) }),
        UI.kpi({ rotulo: "Perdidos", valor: String(r.treinos.perdidos), dica: "Planejados (inclusive pelo plano semanal) que passaram sem ser feitos, ou cancelados." }),
        UI.kpi({ rotulo: "Frequência", valor: r.treinos.taxa == null ? UI.SEM_DADOS : UI.pct(r.treinos.taxa), gauge: r.treinos.taxa, cor: "var(--up)" }),
        UI.kpi({ rotulo: "Volume", valor: UI.numAuto(r.volume, 0) + " <small>kg</small>" })
      ])}
      ${secao("ALIMENTAÇÃO", [
        UI.kpi({ rotulo: "Calorias médias", valor: n.kcal.media == null ? UI.SEM_DADOS : UI.numAuto(n.kcal.media, 0) + " <small>kcal/dia</small>", sub: kcalSub, delta: comparar(n.kcal.media, r.anterior.kcal, null) }),
        UI.kpi({ rotulo: "Proteína média", valor: n.proteina.media == null ? UI.SEM_DADOS : UI.numAuto(n.proteina.media, 0) + " <small>g/dia</small>", sub: mt.proteina ? "meta " + UI.numAuto(mt.proteina, 0) + " g" : "", gauge: mt.proteina && n.proteina.media != null ? (n.proteina.media / mt.proteina) * 100 : null }),
        UI.kpi({ rotulo: "Água média", valor: n.agua.media == null ? UI.SEM_DADOS : UI.litros(n.agua.media) + " <small>/dia</small>", sub: mt.agua ? "meta " + UI.litros(mt.agua) : "", gauge: mt.agua && n.agua.media != null ? (n.agua.media / mt.agua) * 100 : null, cor: "var(--azul)" }),
        UI.kpi({ rotulo: "Carb. / Gord. médios", valor: n.carbo.media == null ? UI.SEM_DADOS : `${UI.numAuto(n.carbo.media, 0)} <small>g</small> / ${UI.numAuto(n.gordura.media, 0)} <small>g</small>` })
      ])}
      ${secao("COMPRAS", [
        UI.kpi({ rotulo: "Gastos", valor: UI.brl(r.gastos), delta: comparar(r.gastos, r.anterior.gastos, true, UI.brl) }),
        UI.kpi({ rotulo: "Itens comprados", valor: String(r.comprados.length) }),
        UI.kpi({ rotulo: "Economia", valor: UI.brl(r.economia), sub: "estimado − pago" }),
        UI.kpi({ rotulo: "Custo do que comeu", valor: r.custoComido.refeicoes ? UI.brl(r.custoComido.total) : UI.SEM_DADOS, dica: "Estimativa pelos preços cadastrados nos alimentos das refeições realizadas." })
      ])}
      <div class="grid">
        ${st.tipo !== "diario" ? `<div class="c8">${UI.card({ titulo: "Calorias por dia", sub: "refeições realizadas", corpo: n.kcal.dias ? `<div class="grafico" style="height:220px"><canvas id="graf-rel-kcal" aria-label="Calorias por dia no período"></canvas></div>` : `<div class="vazio"><p>Sem refeições realizadas no período.</p></div>` })}</div>` : ""}
        <div class="${st.tipo !== "diario" ? "c4" : "c12"}">${UI.card({ titulo: "Evolução das medidas", sub: "no período", corpo: r.medidas.length ? r.medidas.map((m) => `<div class="kv"><span>${m.metrica.rotulo}</span><b>${UI.num(m.fim.valor, 1)} ${m.metrica.un} ${m.delta != null ? `<small class="dim">(${UI.sinal(m.delta, 1)})</small>` : ""}</b></div>`).join("") : `<div class="vazio"><p>Nenhuma medida registrada no período.</p></div>` })}</div>
      </div>
      <div class="grid">
        <div class="c6">${UI.card({ titulo: "Gastos por categoria", corpo: `<div class="pad">${UI.barList(r.gastoPorCategoria, "var(--cy)")}</div>` })}</div>
        <div class="c6">${UI.card({ titulo: "Grupos musculares treinados", corpo: `<div class="pad">${UI.barList(r.grupos, "var(--up)", (v) => v + " " + UI.plural(v, "treino", "treinos"))}</div>` })}</div>
      </div>
      <div class="grid"><div class="c12">${UI.card({ titulo: "Dia a dia", corpo: tabelaDias(r) })}</div></div>`}`;
    return html;
  }
  function tabelaDias(r) {
    const dias = r.dias.filter((x) => x.data <= N.hoje(0));
    if (!dias.length) return `<div class="vazio"><p>Sem dias no período.</p></div>`;
    const gr = "grid-template-columns:96px 80px 70px 70px 70px 76px minmax(140px,1.5fr) 70px 90px";
    const nz = (v, f) => v ? f(v) : `<span class="dim">—</span>`;
    return `<div class="tabela-scroll"><div class="hd" style="${gr}"><i>Data</i><i class="r">kcal</i><i class="r">Prot.</i><i class="r">Carb.</i><i class="r">Gord.</i><i class="r">Água</i><i>Treino</i><i class="r">Peso</i><i class="r">Gasto</i></div>` +
      dias.slice().reverse().map((x) => `<div class="rw" style="${gr}"><div class="dim">${N.DIA_CURTO[N.diaSemana(x.data)]} ${UI.dataCurta(x.data)}</div>
        <div class="r big">${nz(x.kcal, (v) => UI.numAuto(v, 0))}</div><div class="r">${nz(x.proteina, (v) => UI.numAuto(v, 0))}</div><div class="r">${nz(x.carbo, (v) => UI.numAuto(v, 0))}</div><div class="r">${nz(x.gordura, (v) => UI.numAuto(v, 0))}</div>
        <div class="r">${nz(x.agua, UI.litros)}</div><div class="celula-texto">${x.treino ? esc(x.treino) : `<span class="dim">—</span>`}</div><div class="r">${x.peso ? UI.num(x.peso, 1) : `<span class="dim">—</span>`}</div><div class="r">${nz(x.gasto, UI.brl)}</div></div>`).join("") + `</div>`;
  }

  function insights(d) {
    const lista = I.gerarInsights(d);
    const alertas = I.gerarAlertas(d);
    const COR = { positivo: "sucesso", atencao: "aviso", info: "info" };
    const NIVEL = { perigo: "perigo", aviso: "aviso", sucesso: "sucesso", info: "info" };
    return `<div class="grid">
      <div class="c7">${UI.card({ titulo: "Insights", sub: "observações geradas somente a partir dos seus registros",
        dica: "Cada observação só aparece quando há registros suficientes para afirmá-la. Nada é estimado ou inventado: se faltar dado, a observação simplesmente não aparece.",
        corpo: lista.length ? `<div class="alertas-lista">${lista.map((x) => `<button class="alerta-card ${COR[x.tipo]}" data-acao="ir" data-secao="${x.rota}"><span class="ic ic-emoji">${x.icone}</span><div><p>${esc(x.texto)}</p></div></button>`).join("")}</div>`
          : UI.vazio({ icone: "💡", titulo: "Sem dados suficientes", texto: "Registre peso, refeições, treinos e compras por alguns dias. As observações aparecem conforme os dados permitem." }) })}</div>
      <div class="c5">${UI.card({ titulo: "Alertas ativos", sub: "configure em Configurações → Alertas", corpo: alertas.length ? `<div class="alertas-lista">${alertas.map((a) => `<button class="alerta-card ${NIVEL[a.nivel]}" data-acao="ir" data-secao="${a.rota}"><span class="ic">${UI.svg(a.nivel === "perigo" ? "alerta" : a.nivel === "sucesso" ? "ok" : a.nivel === "aviso" ? "aviso" : "info")}</span><div><b>${esc(a.titulo)}</b><p>${esc(a.texto)}</p></div></button>`).join("")}</div>`
        : `<div class="vazio"><p>Nenhum alerta agora. Tudo em ordem. ✓</p></div>` })}</div>
    </div>`;
  }

  App.registrarPagina("relatorios", {
    titulo: "Relatórios",
    render(d, rota) {
      const aba = rota.param === "insights" ? "insights" : "relatorio";
      return `<div class="cabecalho-pagina"><div><h1>Relatórios</h1><p class="sub">Resumo por período, exportação e insights</p></div>
        ${UI.abas([{ k: "relatorio", r: "Relatório" }, { k: "insights", r: "Insights" }], aba, "rel-aba")}</div>
        ${aba === "insights" ? insights(d) : relatorio(d)}`;
    },
    depois(d) {
      if (document.getElementById("graf-rel-kcal") && ultimo) {
        const dias = ultimo.dias.filter((x) => x.data <= N.hoje(0));
        G.renderBarrasMeta("graf-rel-kcal", dias.map((x) => ({ rotulo: st.tipo === "trimestral" ? UI.dataCurta(x.data) : N.DIA_CURTO[N.diaSemana(x.data)] + " " + x.data.slice(8, 10), valor: Math.round(x.kcal) })), { meta: ultimo.metas.kcal, un: "kcal" });
      }
    }
  });

  App.registrarAcoes({
    "rel-aba": (el) => App.ir("relatorios", el.dataset.k === "insights" ? "insights" : null),
    "rel-tipo": (el) => { st.tipo = el.dataset.k; App.renderizar(); },
    "rel-nav": (el) => { st.ancora = el.dataset.hoje ? N.hoje(0) : R.deslocar(st.tipo, st.ancora, Number(el.dataset.delta)); App.renderizar(); },
    "rel-csv": () => { if (ultimo) { R.exportarCSV(ultimo); UI.toast("CSV exportado — verifique seus downloads."); } },
    "rel-xlsx": () => { if (ultimo) { R.exportarXLSX(ultimo); UI.toast("Planilha Excel exportada."); } },
    "rel-pdf": () => { document.body.classList.add("imprimindo"); setTimeout(() => { window.print(); document.body.classList.remove("imprimindo"); }, 50); }
  });
})();
