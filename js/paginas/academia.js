/**
 * paginas/academia.js — treinos, fichas, calendário (plano semanal e mês),
 * evolução de carga e a tela de registro de uma sessão (rota "treino").
 */
(function () {
  "use strict";

  const N = window.Nucleo, UI = window.UI, F = window.Fitness, G = window.Graficos, App = window.App, FM = () => window.Formularios;
  const esc = UI.esc;
  const st = App.estado.academia = { aba: "treinos", calModo: "mes", mes: N.inicioMes(), exercicio: "" };

  function statusTreinoBotoes(t) {
    return `<span class="seg-status">${N.STATUS_TREINO.map((s) => `<button class="${t.status === s ? "ativo st-" + s.toLowerCase() : ""}" data-acao="status-treino" data-id="${t.id}" data-status="${s}" aria-pressed="${t.status === s}">${s === "Realizado" ? "✓ " : s === "Cancelado" ? "✕ " : ""}${s}</button>`).join("")}</span>`;
  }
  function gruposTags(gs) { return (gs || []).map((g) => `<span class="tag">${esc(g)}</span>`).join(" "); }

  // ------------------------------------------------------------------
  // KPIs comuns
  // ------------------------------------------------------------------
  function kpis(d) {
    const sem = F.semanaAtual(d), mes = F.estatisticas(d, N.inicioMes(), N.hoje(0)), seq = F.sequencias(d);
    const volSem = N.soma(F.treinosNoPeriodo(d, N.inicioSemana(), N.fimSemana()).filter((t) => t.status === "Realizado"), (t) => F.volumeTreino(d, t.id));
    return `<div class="kpi-row">
      ${UI.kpi({ rotulo: "Treinos da semana", valor: `${sem.realizados}<small> / ${sem.planejados}</small>`, gauge: sem.planejados ? (sem.realizados / sem.planejados) * 100 : null, cor: "var(--up)", sub: "realizados / planejados" })}
      ${UI.kpi({ rotulo: "Frequência no mês", valor: mes.taxa == null ? UI.SEM_DADOS : UI.pct(mes.taxa), sub: mes.taxa == null ? "" : `${mes.realizados} realizados · ${mes.perdidos} perdidos`, dica: "Realizados ÷ (realizados + perdidos). Perdido = planejado (inclusive pelo plano semanal) que passou sem ser feito, ou cancelado." })}
      ${UI.kpi({ rotulo: "Sequência atual", valor: seq.atual ? `🔥 ${seq.atual} <small>${UI.plural(seq.atual, "dia", "dias")}</small>` : "0", sub: seq.modo === "plano" ? "seguindo o plano" : "com treino", dica: seq.modo === "plano" ? "Dias consecutivos cumprindo o plano semanal: treino feito nos dias de treino e descanso nos dias de descanso. Hoje, se ainda pendente, não quebra a sequência." : "Dias consecutivos com treino realizado. Monte um plano semanal para contar os dias de descanso." })}
      ${UI.kpi({ rotulo: "Melhor sequência", valor: `${seq.melhor} <small>${UI.plural(seq.melhor, "dia", "dias")}</small>` })}
      ${UI.kpi({ rotulo: "Volume na semana", valor: `${UI.numAuto(volSem, 0)} <small>kg</small>`, dica: "Soma de séries × repetições × carga dos exercícios feitos nesta semana." })}
    </div>`;
  }

  // ------------------------------------------------------------------
  // TREINOS
  // ------------------------------------------------------------------
  function cardHoje(d) {
    const th = F.treinoDeHoje(d);
    let corpo;
    if (!th) corpo = UI.vazio({ icone: "🏋️", titulo: "Nenhum treino planejado para hoje.", texto: d.fichas.length ? "Inicie uma ficha ou registre um treino livre." : "Crie uma ficha de treino e monte seu plano semanal.", acao: "rapido-treino", rotulo: "Registrar treino" });
    else if (th.origem === "descanso") corpo = `<div class="hoje-treino descanso"><span class="ht-ic">😴</span><div><b>Dia de descanso</b><p>Seu plano prevê descanso hoje.</p></div><button class="btn pequeno" data-acao="novo-treino" data-data="${N.hoje(0)}">Treinar mesmo assim</button></div>`;
    else if (th.origem === "plano") {
      const f = th.plano.fichaId ? F.ficha(d, th.plano.fichaId) : null;
      corpo = `<div class="hoje-treino"><span class="ht-ic">📋</span><div><b>${esc(th.nome)}</b><p>Previsto no plano${th.horario ? " às " + esc(th.horario) : ""}${f ? " · " + F.exerciciosDaFicha(d, f.id).length + " exercícios" : ""}</p></div><button class="btn primario" data-acao="rapido-treino">${UI.svg("play")}Iniciar treino</button></div>`;
    } else {
      const t = th.treino, p = F.progressoTreino(d, t.id);
      corpo = `<div class="hoje-treino ${t.status === "Realizado" ? "feito" : ""}"><span class="ht-ic">${t.status === "Realizado" ? "✅" : "💪"}</span><div><b>${esc(t.nome)}</b><p>${p.total ? `${p.feitos} de ${p.total} exercícios` : "sem exercícios registrados"} · ${esc(t.status)}</p>${p.total ? UI.barra(p.pct, "var(--up)", true) : ""}</div><button class="btn ${t.status === "Realizado" ? "" : "primario"}" data-acao="ir" data-secao="treino" data-id="${t.id}">${t.status === "Realizado" ? "Ver" : "Registrar"}</button></div>`;
    }
    return UI.card({ titulo: "Hoje", sub: UI.dataLonga(N.hoje(0)), corpo });
  }
  function tabelaTreinos(d, lista, vazioTxt) {
    if (!lista.length) return `<div class="vazio"><p>${vazioTxt}</p></div>`;
    const gr = "grid-template-columns:76px minmax(140px,1.4fr) minmax(110px,1fr) 110px 90px 140px";
    return `<div class="tabela-scroll"><div class="hd" style="${gr}"><i>Data</i><i>Treino</i><i>Grupos</i><i class="r">Exercícios</i><i class="r">Volume</i><i class="r">Status</i></div>` +
      lista.map((t) => {
        if (t.virtual) return `<div class="rw" style="${gr}"><div class="dim">${UI.dataCurta(t.data)}</div><div><div class="nm">${esc(t.nome)}</div><div class="sub">${UI.rotuloRelativo(t.data)} · previsto no plano</div></div><div>${gruposTags(t.grupos)}</div><div class="r dim">—</div><div class="r dim">—</div><div class="r"><button class="btn pequeno" data-acao="iniciar-plano-data" data-data="${t.data}">Criar</button></div></div>`;
        const p = F.progressoTreino(d, t.id);
        const perdido = t.status === "Planejado" && t.data < N.hoje(0);
        return `<div class="rw clicavel" style="${gr}" data-acao="ir" data-secao="treino" data-id="${t.id}">
          <div class="${perdido ? "down" : "dim"}">${UI.dataCurta(t.data)}</div>
          <div><div class="nm">${esc(t.nome)}</div><div class="sub">${UI.rotuloRelativo(t.data)}${t.duracao ? " · " + t.duracao + " min" : ""}${perdido ? ' · <span class="down">não marcado</span>' : ""}</div></div>
          <div>${gruposTags(t.grupos)}</div>
          <div class="r">${p.total ? `${p.feitos}/${p.total}` : "—"}</div>
          <div class="r dim">${UI.numAuto(F.volumeTreino(d, t.id), 0)} kg</div>
          <div class="r">${UI.selo(perdido ? "Perdido" : t.status, null, perdido ? "selo-ruim" : null)}</div>
        </div>`;
      }).join("") + `</div>`;
  }
  function abaTreinos(d) {
    const hj = N.hoje(0);
    const proximos = [];
    N.intervalo(N.hoje(1), N.hoje(7)).forEach((dia) => {
      const ts = F.treinosDoDia(d, dia).filter((t) => t.status !== "Cancelado");
      if (ts.length) ts.forEach((t) => proximos.push(t));
      else { const p = F.planoTreinoNoDia(d, dia); if (p) proximos.push({ virtual: true, data: dia, nome: F.nomePlano(d, p), grupos: p.grupos }); }
    });
    const passados = F.treinosOrdenados(d).filter((t) => t.data < hj || (t.data === hj && t.status !== "Planejado")).reverse().slice(0, 30);
    return kpis(d) + `<div class="grid">
        <div class="c5">${cardHoje(d)}<div class="espaco"></div>${UI.card({ titulo: "Treinos por semana", sub: "últimas 8 semanas", corpo: d.treinos.length ? `<div class="grafico" style="height:200px"><canvas id="graf-treinos-sem" aria-label="Treinos realizados e perdidos por semana"></canvas></div>` : `<div class="vazio"><p>Sem dados suficientes.</p></div>` })}</div>
        <div class="c7">${UI.card({ titulo: "Próximos 7 dias", acoes: UI.botao("novo-treino", "Treino", { icone: "mais" }), corpo: tabelaTreinos(d, proximos, "Nada planejado para os próximos dias. Monte o plano semanal em Calendário.") })}
          <div class="espaco"></div>${UI.card({ titulo: "Histórico", sub: d.treinos.length ? "últimos 30" : "", corpo: d.treinos.length ? tabelaTreinos(d, passados, "Nenhum treino anterior.") : UI.vazio({ icone: "📒", titulo: "Você ainda não registrou nenhum treino.", acao: "rapido-treino", rotulo: "Adicionar treino" }) })}</div>
      </div>`;
  }

  // ------------------------------------------------------------------
  // FICHAS
  // ------------------------------------------------------------------
  function abaFichas(d) {
    const fichas = F.fichasOrdenadas(d);
    if (!fichas.length) return `<div class="grid"><div class="c12">${UI.card({ titulo: "Fichas de treino", corpo: UI.vazio({ icone: "📋", titulo: "Nenhuma ficha de treino ainda.", texto: "Exemplo: TREINO A — PEITO + TRÍCEPS com supino reto 4×8-12, supino inclinado 4×8-12, crucifixo 3×10-15 e tríceps pulley 3×10-15.", acao: "nova-ficha", rotulo: "Criar ficha" }) })}</div></div>`;
    return `<div class="fichas">${fichas.map((f) => {
      const exs = F.exerciciosDaFicha(d, f.id);
      const ult = F.treinosOrdenados(d).filter((t) => t.fichaId === f.id && t.status === "Realizado").slice(-1)[0];
      return `<article class="ficha">
        <header><div><h3>${esc(f.nome)}</h3><div>${gruposTags(f.grupos)}</div></div>${UI.botaoIcone("editar-ficha", "editar", "Editar ficha", `data-id="${f.id}"`)}</header>
        <ol class="ficha-ex">${exs.map((e) => `<li><span>${esc(e.nome)}</span><b>${e.series} × ${esc(F.repsTexto(e))}</b></li>`).join("") || `<li class="dim">Sem exercícios.</li>`}</ol>
        <footer><span class="dim">${ult ? "último: " + UI.rotuloRelativo(ult.data).toLowerCase() : "nunca realizado"}</span><button class="btn pequeno primario" data-acao="iniciar-ficha" data-id="${f.id}">${UI.svg("play")}Iniciar hoje</button></footer>
      </article>`;
    }).join("")}<button class="ficha nova" data-acao="nova-ficha">${UI.svg("mais")}<span>Nova ficha</span></button></div>`;
  }

  // ------------------------------------------------------------------
  // CALENDÁRIO
  // ------------------------------------------------------------------
  function planoSemanal(d) {
    const hojeDia = N.diaSemana();
    const cols = [1, 2, 3, 4, 5, 6, 7].map((dia) => {
      const itens = F.planoDoDiaSemana(d, dia);
      return `<div class="dia-col ${dia === hojeDia ? "hoje" : ""}">
        <div class="dia-titulo"><span>${N.DIA_CURTO[dia]}</span>${dia === hojeDia ? "<span>hoje</span>" : ""}</div>
        ${itens.length ? itens.map((p) => p.tipo === "descanso" ? `<button class="plano-item descanso" data-acao="editar-plano" data-id="${p.id}"><b>Descanso</b></button>`
          : `<button class="plano-item" data-acao="editar-plano" data-id="${p.id}"><b>${esc(F.nomePlano(d, p))}</b><small>${p.horario ? esc(p.horario) : ""}${p.fichaId ? (p.horario ? " · " : "") + F.exerciciosDaFicha(d, p.fichaId).length + " exerc." : ""}</small></button>`).join("") : `<div class="dia-livre">livre</div>`}
        <button class="dia-mais" data-acao="novo-plano" data-dia="${dia}">+ adicionar</button>
      </div>`;
    }).join("");
    return UI.card({ titulo: "Plano semanal", sub: "o que você pretende treinar em cada dia da semana", dica: "O plano é um modelo: aparece no calendário como “previsto”. Use “Gerar treinos da semana” para criar os treinos planejados de uma vez.",
      acoes: `<button class="btn pequeno" data-acao="gerar-semana">${UI.svg("copiar")}Gerar treinos da semana</button>`, corpo: `<div class="semana-grid">${cols}</div>` });
  }
  function calendarioMes(d) {
    const ini = st.mes, fim = N.fimMes(ini), hj = N.hoje(0);
    const est = F.estatisticas(d, ini, fim);
    const seq = F.sequencias(d);
    const primeiro = N.inicioSemana(ini);
    const ultimo = N.fimSemana(fim);
    const cel = N.intervalo(primeiro, ultimo).map((dia) => {
      const fora = dia < ini || dia > fim;
      const s = F.situacaoDoDia(d, dia);
      let conteudo = "";
      if (s.treinos.length) conteudo = s.treinos.map((t) => {
        const perdido = t.status === "Planejado" && dia < hj;
        const cls = t.status === "Realizado" ? "ok" : t.status === "Cancelado" ? "cancelado" : perdido ? "perdido" : "plan";
        return `<button class="cal-treino ${cls}" data-acao="ir" data-secao="treino" data-id="${t.id}" title="${esc(t.nome)} — ${perdido ? "não realizado" : t.status.toLowerCase()}">${t.status === "Realizado" ? "✓ " : t.status === "Cancelado" ? "✕ " : ""}${esc(t.nome)}</button>`;
      }).join("");
      else if (s.plano) conteudo = `<button class="cal-treino previsto ${s.perdido ? "perdido" : ""}" data-acao="iniciar-plano-data" data-data="${dia}" title="Previsto no plano${s.perdido ? " (não registrado)" : " — clique para criar"}">${esc(F.nomePlano(d, s.plano))}</button>`;
      return `<div class="cal-dia ${fora ? "fora" : ""} ${dia === hj ? "hoje" : ""}">
        <button class="cal-num" data-acao="novo-treino" data-data="${dia}" title="Registrar treino em ${UI.dataCurta(dia)}">${Number(dia.slice(8, 10))}</button>${conteudo}</div>`;
    }).join("");
    const nav = `<div class="nav-data"><button class="btn pequeno" data-acao="mes-cal" data-delta="-1" aria-label="Mês anterior">‹</button><span class="nav-rotulo">${UI.mesRotulo(ini)}</span><button class="btn pequeno" data-acao="mes-cal" data-delta="1" aria-label="Próximo mês">›</button><button class="btn pequeno ${ini === N.inicioMes() ? "primario" : ""}" data-acao="mes-cal" data-hoje="1">Hoje</button></div>`;
    return `<div class="kpi-row">
        ${UI.kpi({ rotulo: "Planejados no mês", valor: String(est.planejados), dica: "Treinos registrados no mês (exceto cancelados que nunca existiram) + dias previstos pelo plano." })}
        ${UI.kpi({ rotulo: "Realizados", valor: String(est.realizados), sub: est.perdidos ? `${est.perdidos} perdidos` : "" })}
        ${UI.kpi({ rotulo: "Taxa de frequência", valor: est.taxa == null ? UI.SEM_DADOS : UI.pct(est.taxa), gauge: est.taxa, cor: "var(--up)" })}
        ${UI.kpi({ rotulo: "Sequência atual", valor: seq.atual ? `🔥 ${seq.atual} <small>${UI.plural(seq.atual, "dia", "dias")}</small>` : "0", sub: `melhor: ${seq.melhor}` })}
      </div>
      ${UI.card({ titulo: "Calendário", sub: "verde = realizado · azul = planejado · vermelho = perdido/cancelado · tracejado = previsto no plano", acoes: nav,
        corpo: `<div class="cal"><div class="cal-sem">${[1, 2, 3, 4, 5, 6, 7].map((k) => `<span>${N.DIA_CURTO[k]}</span>`).join("")}</div><div class="cal-grade">${cel}</div></div>` })}`;
  }
  function abaCalendario(d) {
    const modo = UI.abas([{ k: "mes", r: "Mensal" }, { k: "semana", r: "Plano semanal" }], st.calModo, "cal-modo", "abas-sec");
    return `<div class="barra-ferramentas">${modo}</div>` + (st.calModo === "semana" ? `<div class="grid"><div class="c12">${planoSemanal(d)}</div></div>` : calendarioMes(d));
  }

  // ------------------------------------------------------------------
  // EVOLUÇÃO DE CARGA
  // ------------------------------------------------------------------
  function abaCarga(d) {
    const nomes = F.nomesExercicios(d).filter((n) => F.evolucaoCarga(d, n).length);
    if (!nomes.length) return `<div class="grid"><div class="c12">${UI.card({ titulo: "Evolução de carga", corpo: UI.vazio({ icone: "📈", titulo: "Sem dados suficientes", texto: "Registre as cargas dos exercícios nos treinos realizados para acompanhar a evolução." }) })}</div></div>`;
    if (nomes.indexOf(st.exercicio) === -1) st.exercicio = nomes[0];
    const ev = F.evolucaoCarga(d, st.exercicio);
    const sem = F.cargaPorSemana(ev);
    const recorde = ev.reduce((m, p) => (p.carga > m.carga ? p : m), ev[0]);
    const rm = F.umRM(recorde.carga, recorde.reps);
    const sel = `<select class="sel" data-mudar="exercicio-carga" aria-label="Exercício">${UI.opcoes(nomes, st.exercicio)}</select>`;
    const primeira = ev[0], ultima = ev[ev.length - 1];
    return `<div class="kpi-row">
        ${UI.kpi({ rotulo: "Carga atual", valor: UI.numAuto(ultima.carga) + " <small>kg</small>", sub: `em ${UI.dataCurta(ultima.data)} · ${ultima.reps} reps` })}
        ${UI.kpi({ rotulo: "Evolução", valor: ev.length > 1 ? UI.sinal(ultima.carga - primeira.carga, 1, "kg") : UI.SEM_DADOS, delta: ev.length > 1 && primeira.carga ? UI.deltaPill(UI.sinal(((ultima.carga - primeira.carga) / primeira.carga) * 100, 0, "%"), ultima.carga >= primeira.carga) : "", sub: `desde ${UI.dataCurta(primeira.data)}` })}
        ${UI.kpi({ rotulo: "Recorde", valor: UI.numAuto(recorde.carga) + " <small>kg</small>", sub: UI.dataCurta(recorde.data) })}
        ${UI.kpi({ rotulo: "1RM estimado", valor: rm ? UI.numAuto(rm, 0) + " <small>kg</small>" : "—", dica: "Carga máxima estimada para 1 repetição (fórmula de Epley: carga × (1 + reps ÷ 30)), a partir do seu recorde. É uma estimativa." })}
      </div>
      <div class="grid">
        <div class="c8">${UI.card({ titulo: "Evolução da carga", sub: "maior carga em cada treino realizado", acoes: sel, corpo: `<div class="grafico" style="height:260px"><canvas id="graf-carga" aria-label="Evolução da carga de ${esc(st.exercicio)}"></canvas></div>` })}</div>
        <div class="c4">${UI.card({ titulo: "Por semana", sub: esc(st.exercicio), corpo: `<div class="lista-semanas">${sem.map((s, k) => `<div class="kv"><span>Semana ${s.numero} <small class="dim">${UI.dataCurta(s.semana)}</small></span><b>${UI.numAuto(s.carga)} kg ${k > 0 ? `<small class="${s.carga > sem[k - 1].carga ? "up" : s.carga < sem[k - 1].carga ? "down" : "dim"}">${s.carga > sem[k - 1].carga ? "▲" : s.carga < sem[k - 1].carga ? "▼" : "="}</small>` : ""}</b></div>`).join("")}</div>` })}</div>
      </div>`;
  }

  App.registrarPagina("academia", {
    titulo: "Academia",
    render(d) {
      const abas = UI.abas([{ k: "treinos", r: "Treinos" }, { k: "fichas", r: "Fichas", n: d.fichas.length }, { k: "calendario", r: "Calendário" }, { k: "carga", r: "Evolução de carga" }], st.aba, "aba-academia");
      const corpo = st.aba === "fichas" ? abaFichas(d) : st.aba === "calendario" ? abaCalendario(d) : st.aba === "carga" ? abaCarga(d) : abaTreinos(d);
      return `<div class="cabecalho-pagina"><div><h1>Academia</h1><p class="sub">Fichas, treinos, frequência e evolução de carga</p></div>${abas}</div>${corpo}`;
    },
    depois(d) {
      if (document.getElementById("graf-treinos-sem")) G.renderTreinosSemana("graf-treinos-sem", F.serieSemanalTreinos(d, 8));
      if (document.getElementById("graf-carga")) G.renderCarga("graf-carga", F.evolucaoCarga(d, st.exercicio));
    }
  });

  // ------------------------------------------------------------------
  // SESSÃO DE TREINO (registro de séries)
  // ------------------------------------------------------------------
  App.registrarPagina("treino", {
    titulo: "Treino", menu: "academia",
    render(d, rota) {
      const t = F.treino(d, rota.param);
      if (!t) return `<button class="voltar" data-acao="ir" data-secao="academia">${UI.svg("voltar")}Academia</button>${UI.vazio({ titulo: "Treino não encontrado." })}`;
      const series = F.seriesDoTreino(d, t.id);
      const p = F.progressoTreino(d, t.id);
      const vol = F.volumeTreino(d, t.id);
      const anterior = F.treinosOrdenados(d).filter((x) => x.id !== t.id && x.status === "Realizado" && x.data < t.data && (t.fichaId ? x.fichaId === t.fichaId : x.nome === t.nome)).slice(-1)[0];
      const volAnt = anterior ? F.volumeTreino(d, anterior.id) : null;
      const gr = "grid-template-columns:40px minmax(150px,1.5fr) 72px 72px 92px 82px minmax(80px,1fr) 64px";
      const tabela = series.length ? `<div class="tabela-scroll tabela-series"><div class="hd" style="${gr}"><i></i><i>Exercício</i><i class="r">Séries</i><i class="r">Reps</i><i class="r">Carga (kg)</i><i class="r">RPE ${UI.dica("Percepção de esforço (1–10). 10 = falha; 8 = sobrariam ~2 repetições.")}</i><i>Obs.</i><i></i></div>` +
        series.map((s) => {
          const ult = F.ultimaExecucao(d, s.exercicio, t.data);
          const subiu = ult && Number(s.carga) > Number(ult.carga);
          return `<div class="rw ${s.status === "Feito" ? "feito" : s.status === "Pulado" ? "pulado" : ""}" style="${gr}">
            <div><button class="ex-status ${s.status === "Feito" ? "feito" : s.status === "Pulado" ? "pulado" : ""}" data-acao="ciclar-serie" data-id="${s.id}" title="${esc(s.status)} — clique para mudar" aria-label="Status: ${esc(s.status)}">${s.status === "Feito" ? "✓" : s.status === "Pulado" ? "–" : ""}</button></div>
            <div><div class="nm">${esc(s.exercicio)}</div><div class="sub">${esc(s.grupo || "")}${ult ? ` · última: ${ult.series}×${ult.repeticoes} · ${UI.numAuto(ult.carga)} kg` : ""}${subiu ? ' <span class="up">▲</span>' : ""}</div></div>
            <div class="r"><input class="inp-mini" type="number" min="0" value="${s.series || ""}" data-mudar="serie-campo" data-id="${s.id}" data-campo="series" aria-label="Séries"></div>
            <div class="r"><input class="inp-mini" type="number" min="0" value="${s.repeticoes || ""}" data-mudar="serie-campo" data-id="${s.id}" data-campo="repeticoes" aria-label="Repetições"></div>
            <div class="r"><input class="inp-mini" type="number" min="0" step="0.5" value="${N.temValor(s.carga) ? s.carga : ""}" data-mudar="serie-campo" data-id="${s.id}" data-campo="carga" aria-label="Carga"></div>
            <div class="r"><select class="inp-mini" data-mudar="serie-campo" data-id="${s.id}" data-campo="rpe" aria-label="RPE">${UI.opcoes([6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((v) => ({ v, r: String(v).replace(".", ",") })), s.rpe == null ? "" : s.rpe, "—")}</select></div>
            <div><input class="inp-mini inp-obs" value="${esc(s.obs || "")}" placeholder="—" data-mudar="serie-campo" data-id="${s.id}" data-campo="obs" aria-label="Observações"></div>
            <div class="r">${UI.linhaAcoes("editar-serie", null, s.id)}</div>
          </div>`;
        }).join("") + `</div>` : UI.vazio({ icone: "🏋️", titulo: "Nenhum exercício neste treino.", acao: "nova-serie", rotulo: "Adicionar exercício", dados: `data-treino="${t.id}"` });
      return `<button class="voltar" data-acao="ir" data-secao="academia">${UI.svg("voltar")}Academia</button>
        <div class="cabecalho-pagina"><div><h1>${esc(t.nome)}</h1><p class="sub">${UI.dataLonga(t.data)} · ${UI.rotuloRelativo(t.data)}${t.fichaId && F.ficha(d, t.fichaId) ? " · ficha " + esc(F.ficha(d, t.fichaId).nome) : ""}</p></div>${statusTreinoBotoes(t)}</div>
        <div class="kpi-row">
          ${UI.kpi({ rotulo: "Exercícios feitos", valor: `${p.feitos}<small> / ${p.total}</small>`, gauge: p.total ? p.pct : null, cor: "var(--up)" })}
          ${UI.kpi({ rotulo: "Volume", valor: `${UI.numAuto(vol, 0)} <small>kg</small>`, delta: volAnt ? UI.deltaPill(UI.sinal(vol - volAnt, 0, "kg"), vol >= volAnt) + ` <span class="dim">vs ${UI.dataCurta(anterior.data)}</span>` : "", dica: "Séries × repetições × carga dos exercícios não pulados." })}
          ${UI.kpi({ rotulo: "Duração", valor: `<input class="inp-dur" type="number" min="0" step="5" value="${t.duracao || ""}" placeholder="—" data-mudar="duracao-treino" data-id="${t.id}" aria-label="Duração em minutos"> <small>min</small>` })}
        </div>
        <div class="grid"><div class="c12">${UI.card({ titulo: "Exercícios", sub: "edite séries, repetições, carga e RPE direto na linha",
          acoes: `${UI.botao("nova-serie", "Exercício", { icone: "mais", dados: `data-treino="${t.id}"` })}${UI.botao("editar-treino", "Editar", { icone: "editar", dados: `data-id="${t.id}"` })}${t.status !== "Realizado" ? `<button class="btn primario" data-acao="status-treino" data-id="${t.id}" data-status="Realizado">${UI.svg("check")}Concluir treino</button>` : ""}`,
          corpo: tabela, rodape: t.obs ? `<span>Observações</span><b>${esc(t.obs)}</b>` : "" })}</div></div>`;
    }
  });

  App.registrarAcoes({
    "aba-academia": (el) => { st.aba = el.dataset.k; App.renderizar(); },
    "cal-modo": (el) => { st.calModo = el.dataset.k; App.renderizar(); },
    "mes-cal": (el) => { st.mes = el.dataset.hoje ? N.inicioMes() : N.addMeses(st.mes, Number(el.dataset.delta)); App.renderizar(); },
    "gerar-semana": () => {
      const d = App.dados();
      if (!F.temPlano(d)) { UI.toast("Monte o plano semanal primeiro."); return; }
      const n = F.gerarSemana(d, N.inicioSemana());
      App.salvar(n ? `${n} ${UI.plural(n, "treino criado", "treinos criados")} para esta semana.` : "Os treinos desta semana já existiam.");
    },
    "iniciar-ficha": (el) => {
      const d = App.dados();
      const t = F.iniciarTreino(d, { fichaId: el.dataset.id, data: N.hoje(0) });
      App.salvar("Treino iniciado.");
      App.ir("treino", t.id);
    },
    "iniciar-plano-data": (el) => {
      const d = App.dados(), data = el.dataset.data;
      const p = F.planoTreinoNoDia(d, data);
      if (!p) return;
      const t = F.iniciarTreino(d, { fichaId: p.fichaId, nome: F.nomePlano(d, p), data, grupos: p.grupos, status: "Planejado" });
      App.salvar("Treino criado a partir do plano.");
      App.ir("treino", t.id);
    },
    "ciclar-serie": (el) => {
      const d = App.dados();
      const s = d.series.find((x) => x.id === el.dataset.id);
      if (!s) return;
      const ordem = N.STATUS_SERIE;
      s.status = ordem[(ordem.indexOf(s.status) + 1) % ordem.length];
      App.salvar();
    }
  });
  App.registrarMudancas({
    "exercicio-carga": (el) => { st.exercicio = el.value; App.renderizar(); },
    "serie-campo": (el) => {
      const d = App.dados();
      const s = d.series.find((x) => x.id === el.dataset.id);
      if (!s) return;
      const c = el.dataset.campo;
      s[c] = c === "obs" ? el.value.trim() : N.numOuNulo(el.value);
      if (c !== "obs" && c !== "rpe" && s[c] == null) s[c] = 0;
      if (s.status === "Pendente" && (c === "carga" || c === "repeticoes")) s.status = "Feito";
      App.salvar(null, { semIntegracao: true });
    },
    "duracao-treino": (el) => {
      const t = F.treino(App.dados(), el.dataset.id);
      if (t) { t.duracao = N.numOuNulo(el.value) || 0; App.salvar(null, { semIntegracao: true }); }
    }
  });
})();
