/**
 * paginas/evolucao.js — peso, composição corporal e medidas: comparação
 * primeira → atual → meta (com tendência), gráficos e histórico.
 */
(function () {
  "use strict";

  const N = window.Nucleo, UI = window.UI, F = window.Fitness, M = window.Metas, G = window.Graficos, App = window.App;
  const esc = UI.esc;
  const st = App.estado.evolucao = { periodo: "90", metrica: "peso" };
  const PERIODOS = [{ k: "7", r: "7 dias" }, { k: "30", r: "30 dias" }, { k: "90", r: "3 meses" }, { k: "180", r: "6 meses" }, { k: "365", r: "1 ano" }, { k: "tudo", r: "Tudo" }];
  const GRAFICOS = [
    { k: "peso", r: "Peso", series: ["peso"], meta: "peso" },
    { k: "massaMuscular", r: "Massa muscular", series: ["massaMuscular"], meta: "massaMuscular" },
    { k: "gorduraPct", r: "Gordura", series: ["gorduraPct"], meta: "gordura" },
    { k: "cintura", r: "Cintura", series: ["cintura"], meta: "cintura" },
    { k: "braco", r: "Braço", series: ["bracoD", "bracoE"] },
    { k: "peito", r: "Peito", series: ["peito"] }
  ];
  const COMPARAR = [["peso", "peso"], ["massaMuscular", "massaMuscular"], ["gorduraPct", "gordura"], ["cintura", "cintura"]];

  function inicioPeriodo() { return st.periodo === "tudo" ? null : N.hoje(-Number(st.periodo)); }

  function kpis(d) {
    const p = F.atual(d, "peso"), v = F.variacao(d, "peso", 30);
    const mm = F.atual(d, "massaMuscular"), gc = F.atual(d, "gorduraPct"), ci = F.atual(d, "cintura");
    const imc = F.atual(d, "imc");
    const vf = (k, dias, un) => { const x = F.variacao(d, k, dias); return x ? UI.sinal(x.delta, 1, un) + " desde " + UI.dataCurta(x.de.data) : ""; };
    return `<div class="kpi-row">
      ${UI.kpi({ rotulo: "Peso atual", valor: p ? UI.kg(p.valor) : UI.SEM_DADOS, sub: v ? UI.sinal(v.delta, 1, "kg") + " em " + v.dias + " dias" : p ? "em " + UI.dataCurta(p.data) : "" })}
      ${UI.kpi({ rotulo: "Massa muscular", dica: F.METRICA.massaMuscular.dica, valor: mm ? UI.kg(mm.valor) : UI.SEM_DADOS, sub: vf("massaMuscular", 60, "kg") })}
      ${UI.kpi({ rotulo: "Gordura corporal", dica: F.METRICA.gorduraPct.dica, valor: gc ? UI.num(gc.valor, 1) + "%" : UI.SEM_DADOS, sub: vf("gorduraPct", 60, "p.p.") })}
      ${UI.kpi({ rotulo: "IMC", dica: F.METRICA.imc.dica, valor: imc ? UI.num(imc.valor, 1) : UI.SEM_DADOS, sub: imc ? F.classificacaoIMC(imc.valor) : F.altura(d) ? "" : "informe a altura no perfil" })}
      ${UI.kpi({ rotulo: "Cintura", dica: F.METRICA.cintura.dica, valor: ci ? UI.num(ci.valor, 1) + " cm" : UI.SEM_DADOS, sub: vf("cintura", 60, "cm") })}
    </div>`;
  }

  function comparacao(d) {
    const blocos = COMPARAR.map(([chave, tipoMeta]) => {
      const m = F.METRICA[chave];
      const s = F.serie(d, chave);
      const meta = M.metaDoTipo(d, tipoMeta);
      const av = meta ? M.avaliar(d, meta) : null;
      if (!s.length) return `<div class="comp-bloco"><h3>${m.rotulo.toUpperCase()}</h3><div class="comp-vazio">${UI.SEM_DADOS}</div>
        <button class="btn pequeno" data-acao="registrar-corpo" data-foco="${chave === "peso" ? "peso" : "medidas"}">Registrar</button></div>`;
      const ini = s[0], atu = s[s.length - 1];
      const seta = (a, b) => b > a ? "↑" : b < a ? "↓" : "→";
      const un = m.un === "%" ? "%" : " " + m.un;
      return `<div class="comp-bloco ${av ? "st-" + M.STATUS[av.status].classe : ""}">
        <h3>${m.rotulo.toUpperCase()}</h3>
        <div class="comp-linha"><span class="comp-rot">Primeira</span><b>${UI.num(ini.valor, 1)}${un}</b><small>${UI.dataCurta(ini.data)}</small></div>
        ${s.length > 1 ? `<div class="comp-seta">${seta(ini.valor, atu.valor)} ${UI.sinal(atu.valor - ini.valor, 1, m.un === "%" ? "p.p." : m.un)}</div>
        <div class="comp-linha atual"><span class="comp-rot">Atual</span><b>${UI.num(atu.valor, 1)}${un}</b><small>${UI.dataCurta(atu.data)}</small></div>` : `<div class="comp-seta dim">só 1 registro</div>`}
        ${meta ? `<div class="comp-seta">${seta(atu.valor, Number(meta.valorAlvo))}</div>
          <div class="comp-linha meta"><span class="comp-rot">Meta</span><b>${UI.num(meta.valorAlvo, 1)}${un}</b><small>${meta.prazo ? "até " + UI.dataCurta(meta.prazo) : ""}</small></div>
          <div class="comp-status">${UI.statusMeta(av.status)}${av.progresso != null ? `<span class="dim">${Math.round(av.progresso)}%</span>` : ""}</div>
          ${UI.barra(av.progresso || 0, av.status === "fora" ? "var(--down)" : av.status === "atencao" ? "var(--acc)" : av.status === "semdados" ? "var(--dim)" : "var(--up)", true)}
          <p class="comp-exp">${esc(av.explicacao)}${av.detalhe ? " " + esc(av.detalhe) : ""}</p>`
        : `<div class="comp-semmeta"><button class="link-acao" data-acao="nova-meta" data-tipo="${tipoMeta}">+ definir meta</button></div>`}
      </div>`;
    }).join("");
    return UI.card({ titulo: "Evolução corporal", sub: "primeira medição → atual → meta",
      dica: "O status de cada meta considera a TENDÊNCIA dos registros recentes (regressão linear), não só o último valor: 🟢 no ritmo para chegar no prazo; 🟡 na direção certa mas devagar, ou estável; 🔴 na direção contrária ou prazo vencido.",
      corpo: `<div class="comparacao">${blocos}</div>` });
  }

  function grafico(d) {
    const g = GRAFICOS.find((x) => x.k === st.metrica) || GRAFICOS[0];
    const ini = inicioPeriodo();
    const temDados = g.series.some((k) => F.serie(d, k, ini).length >= 2);
    const total = g.series.reduce((s, k) => s + F.serie(d, k).length, 0);
    const abasM = UI.abas(GRAFICOS.map((x) => ({ k: x.k, r: x.r })), g.k, "metrica-evo", "abas-sec");
    const abasP = UI.abas(PERIODOS, st.periodo, "periodo-evo", "abas-sec");
    return UI.card({ titulo: "Gráficos", acoes: abasP, corpo: `<div class="pad-x">${abasM}</div>` + (temDados ? `<div class="grafico" style="height:280px"><canvas id="graf-evo" aria-label="Gráfico de ${esc(g.r)}"></canvas></div>`
      : UI.vazio({ icone: "📈", titulo: "Sem dados suficientes", texto: total ? `Há ${total} ${UI.plural(total, "registro", "registros")} de ${g.r.toLowerCase()}, mas menos de 2 neste período. Tente um período maior.` : `Registre ${g.r.toLowerCase()} pelo menos duas vezes para ver a evolução.`, acao: "registrar-corpo", rotulo: "Registrar", dados: `data-foco="${g.k === "peso" ? "peso" : "medidas"}"` })) });
  }

  function historico(d) {
    const h = F.historicoCorporal(d);
    if (!h.length) return UI.card({ titulo: "Histórico", corpo: UI.vazio({ icone: "📒", titulo: "Nenhum registro ainda.", texto: "Registre peso, composição corporal e medidas — nenhum campo é obrigatório.", acao: "rapido-medida", rotulo: "Registrar medição" }) });
    const cols = ["peso", "massaMuscular", "gorduraPct", "massaGordura", "cintura", "abdomen", "peito", "bracoD", "bracoE", "coxaD", "quadril"]
      .filter((k) => k === "peso" || h.some((x) => x.medida && N.temValor(x.medida[k])));
    const gr = `grid-template-columns:96px repeat(${cols.length}, minmax(76px,1fr)) 60px`;
    return UI.card({ titulo: "Histórico", sub: `${h.length} ${UI.plural(h.length, "registro", "registros")} · clique para editar`, corpo: `<div class="tabela-scroll"><div class="hd" style="${gr}"><i>Data</i>${cols.map((k) => `<i class="r">${F.METRICA[k].rotulo}${F.METRICA[k].un ? ` <small>(${F.METRICA[k].un})</small>` : ""}</i>`).join("")}<i></i></div>` +
      h.map((x) => `<div class="rw clicavel" style="${gr}" data-acao="registrar-corpo" data-data="${x.data}" data-foco="medidas">
        <div class="dim">${UI.dataBR(x.data)}</div>
        ${cols.map((k) => {
          const v = k === "peso" ? (x.pesagem ? x.pesagem.peso : null) : x.medida ? x.medida[k] : null;
          return `<div class="r ${k === "peso" ? "big" : ""}">${N.temValor(v) ? UI.num(v, 1) : `<span class="dim">—</span>`}</div>`;
        }).join("")}
        <div class="r">${UI.botaoIcone("excluir-corpo", "excluir", "Excluir", `data-data="${x.data}"`, "perigo-txt")}</div>
      </div>`).join("") + `</div>` });
  }

  App.registrarPagina("evolucao", {
    titulo: "Evolução",
    render(d) {
      return `<div class="cabecalho-pagina"><div><h1>Evolução</h1><p class="sub">Peso, composição corporal e medidas</p></div>
        <div class="acoes-cab">${UI.botao("rapido-peso", "Peso", { icone: "mais" })}${UI.botao("rapido-medida", "Medição completa", { classe: "primario", icone: "mais" })}</div></div>
        ${kpis(d)}
        <div class="grid"><div class="c12">${comparacao(d)}</div></div>
        <div class="grid"><div class="c12">${grafico(d)}</div></div>
        <div class="grid"><div class="c12">${historico(d)}</div></div>
        <p class="ajuda">O IMC (peso ÷ altura²) e as medidas de bioimpedância são informativos e não substituem uma avaliação profissional.</p>`;
    },
    depois(d) {
      if (!document.getElementById("graf-evo")) return;
      const g = GRAFICOS.find((x) => x.k === st.metrica) || GRAFICOS[0];
      const ini = inicioPeriodo();
      if (g.series.length === 1) {
        const m = F.METRICA[g.series[0]];
        const meta = g.meta ? M.metaDoTipo(d, g.meta) : null;
        G.renderMetrica("graf-evo", F.serie(d, g.series[0], ini), { un: m.un, rotulo: m.rotulo, meta: meta ? Number(meta.valorAlvo) : null, casas: 1 });
      } else {
        G.renderMultiplas("graf-evo", g.series.map((k, i) => ({ nome: F.METRICA[k].rotulo, pontos: F.serie(d, k, ini), tracejado: i === 1 })), { un: "cm", casas: 1 });
      }
    }
  });

  App.registrarAcoes({
    "metrica-evo": (el) => { st.metrica = el.dataset.k; App.renderizar(); },
    "periodo-evo": (el) => { st.periodo = el.dataset.k; App.renderizar(); }
  });
})();
