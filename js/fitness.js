/**
 * fitness.js
 * -----------------------------------------------------------------------
 * Regras da parte "corpo e academia": peso, composição corporal, medidas,
 * fichas de treino, sessões, séries, calendário, sequências e evolução de
 * carga. Não toca no DOM.
 *
 * Tudo aqui é CALCULADO: peso atual = última pesagem; IMC = peso ÷ altura²;
 * massa de gordura (se não informada) = peso × % de gordura; frequência =
 * realizados ÷ (realizados + perdidos); sequência = dias seguindo o plano.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo;

  // ---------------------------------------------------------------------
  // métricas corporais
  // ---------------------------------------------------------------------
  const METRICAS = [
    { chave: "peso", rotulo: "Peso", un: "kg", fonte: "pesagens", casas: 1 },
    { chave: "massaMuscular", rotulo: "Massa muscular", un: "kg", fonte: "medidas", casas: 1, dica: "Massa muscular esquelética, como informada pela sua balança de bioimpedância ou avaliação física." },
    { chave: "gorduraPct", rotulo: "Gordura corporal", un: "%", fonte: "medidas", casas: 1, dica: "Percentual de gordura em relação ao peso total." },
    { chave: "massaGordura", rotulo: "Massa de gordura", un: "kg", fonte: "medidas", casas: 1, dica: "Quilos de gordura. Se você não informar, é calculada como peso × % de gordura." },
    { chave: "aguaPct", rotulo: "Água corporal", un: "%", fonte: "medidas", casas: 1, dica: "Percentual de água no corpo (bioimpedância)." },
    { chave: "imc", rotulo: "IMC", un: "", fonte: "calculado", casas: 1, dica: "Índice de Massa Corporal = peso ÷ altura². É informativo: não diferencia músculo de gordura." },
    { chave: "pescoco", rotulo: "Pescoço", un: "cm", fonte: "medidas", casas: 1 },
    { chave: "peito", rotulo: "Peito", un: "cm", fonte: "medidas", casas: 1 },
    { chave: "cintura", rotulo: "Cintura", un: "cm", fonte: "medidas", casas: 1, dica: "Medida na altura do umbigo ou na parte mais estreita do tronco — use sempre o mesmo ponto." },
    { chave: "abdomen", rotulo: "Abdômen", un: "cm", fonte: "medidas", casas: 1 },
    { chave: "quadril", rotulo: "Quadril", un: "cm", fonte: "medidas", casas: 1 },
    { chave: "bracoD", rotulo: "Braço direito", un: "cm", fonte: "medidas", casas: 1 },
    { chave: "bracoE", rotulo: "Braço esquerdo", un: "cm", fonte: "medidas", casas: 1 },
    { chave: "coxaD", rotulo: "Coxa direita", un: "cm", fonte: "medidas", casas: 1 },
    { chave: "coxaE", rotulo: "Coxa esquerda", un: "cm", fonte: "medidas", casas: 1 }
  ];
  const METRICA = {};
  METRICAS.forEach((m) => { METRICA[m.chave] = m; });
  const CAMPOS_MEDIDA = METRICAS.filter((m) => m.fonte === "medidas").map((m) => m.chave);

  function perfil(d) { return d.usuarios[0]; }
  function pesagens(d) { return d.pesagens.slice().sort((a, b) => a.data.localeCompare(b.data)); }
  function medidas(d) { return d.medidas.slice().sort((a, b) => a.data.localeCompare(b.data)); }
  function pesoNaData(d, data) {
    const l = pesagens(d).filter((p) => p.data <= data);
    return l.length ? Number(l[l.length - 1].peso) : null;
  }
  function altura(d) { return Number(perfil(d).altura) || null; }
  function imc(peso, alt) { return peso && alt ? peso / (alt * alt) : null; }
  function classificacaoIMC(v) {
    if (v == null) return "—";
    if (v < 18.5) return "Abaixo do peso";
    if (v < 25) return "Peso normal";
    if (v < 30) return "Sobrepeso";
    if (v < 35) return "Obesidade I";
    if (v < 40) return "Obesidade II";
    return "Obesidade III";
  }

  // série histórica de qualquer métrica → [{data, valor}] em ordem de data
  function serie(d, chave, ini) {
    let out = [];
    if (chave === "peso") out = pesagens(d).map((p) => ({ data: p.data, valor: Number(p.peso) }));
    else if (chave === "imc") {
      const alt = altura(d);
      out = alt ? pesagens(d).map((p) => ({ data: p.data, valor: imc(Number(p.peso), Number(p.altura) || alt) })) : [];
    } else if (chave === "massaGordura") {
      out = medidas(d).map((m) => {
        if (N.temValor(m.massaGordura)) return { data: m.data, valor: Number(m.massaGordura) };
        const p = pesoNaData(d, m.data);
        return N.temValor(m.gorduraPct) && p ? { data: m.data, valor: p * Number(m.gorduraPct) / 100 } : null;
      }).filter(Boolean);
    } else {
      out = medidas(d).filter((m) => N.temValor(m[chave])).map((m) => ({ data: m.data, valor: Number(m[chave]) }));
    }
    return ini ? out.filter((p) => p.data >= ini) : out;
  }
  function primeiro(d, chave) { const s = serie(d, chave); return s.length ? s[0] : null; }
  function atual(d, chave) { const s = serie(d, chave); return s.length ? s[s.length - 1] : null; }
  // valor na data (último registro até ela)
  function valorEm(d, chave, data) {
    const s = serie(d, chave).filter((p) => p.data <= data);
    return s.length ? s[s.length - 1] : null;
  }
  // variação nos últimos N dias (precisa de um registro anterior à janela
  // ou de dois dentro dela)
  function variacao(d, chave, dias) {
    const s = serie(d, chave);
    if (s.length < 2) return null;
    const fim = s[s.length - 1];
    const corte = N.addDias(fim.data, -dias);
    const antes = s.filter((p) => p.data <= corte);
    const base = antes.length ? antes[antes.length - 1] : s.find((p) => p.data > corte);
    if (!base || base === fim) return null;
    return { delta: fim.valor - base.valor, de: base, para: fim, dias: N.diasEntre(base.data, fim.data) };
  }
  // tendência (regressão linear) — usa a janela que tiver pontos suficientes
  function tendencia(d, chave, dias) {
    const s = serie(d, chave);
    if (s.length < 2) return null;
    const ultimo = s[s.length - 1].data;
    const janelas = dias ? [dias] : [30, 60, 120, 3650];
    for (let k = 0; k < janelas.length; k++) {
      const pts = s.filter((p) => p.data >= N.addDias(ultimo, -janelas[k]));
      if (pts.length >= 3 || (k === janelas.length - 1 && pts.length >= 2)) {
        const r = N.regressao(pts);
        if (r) return Object.assign(r, { porSemana: r.porDia * 7, janela: janelas[k], ultimo: s[s.length - 1] });
      }
    }
    return null;
  }

  // todos os registros (pesagem + medidas) agrupados por data, mais recente primeiro
  function historicoCorporal(d) {
    const mapa = {};
    d.pesagens.forEach((p) => { (mapa[p.data] = mapa[p.data] || { data: p.data }).pesagem = p; });
    d.medidas.forEach((m) => { (mapa[m.data] = mapa[m.data] || { data: m.data }).medida = m; });
    return Object.keys(mapa).sort().reverse().map((k) => mapa[k]);
  }
  function pesagemDoDia(d, data) { return d.pesagens.find((p) => p.data === data) || null; }
  function medidaDoDia(d, data) { return d.medidas.find((m) => m.data === data) || null; }
  function diasSemPesar(d) {
    const s = pesagens(d);
    return s.length ? N.diasEntre(s[s.length - 1].data, N.hoje(0)) : null;
  }
  function pesoInicial(d) {
    const u = perfil(d);
    if (N.temValor(u.pesoInicial)) return Number(u.pesoInicial);
    const p = primeiro(d, "peso");
    return p ? p.valor : null;
  }

  // ---------------------------------------------------------------------
  // fichas de treino
  // ---------------------------------------------------------------------
  function ficha(d, id) { return d.fichas.find((f) => f.id === id) || null; }
  function fichasOrdenadas(d) { return d.fichas.slice().sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome, "pt-BR")); }
  function exerciciosDaFicha(d, fichaId) {
    return d.exercicios.filter((e) => e.fichaId === fichaId).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  }
  function repsTexto(e) {
    if (N.temValor(e.repMin) && N.temValor(e.repMax) && Number(e.repMin) !== Number(e.repMax)) return e.repMin + "-" + e.repMax;
    return String(e.repMax || e.repMin || "—");
  }

  // ---------------------------------------------------------------------
  // sessões de treino
  // ---------------------------------------------------------------------
  function treino(d, id) { return d.treinos.find((t) => t.id === id) || null; }
  function treinosOrdenados(d) { return d.treinos.slice().sort((a, b) => a.data.localeCompare(b.data)); }
  function treinosNoPeriodo(d, ini, fim) { return treinosOrdenados(d).filter((t) => N.entre(t.data, ini, fim)); }
  function treinosDoDia(d, data) { return d.treinos.filter((t) => t.data === data); }
  function seriesDoTreino(d, treinoId) {
    return d.series.filter((s) => s.treinoId === treinoId).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  }
  function volumeSerie(s) {
    return s.status === "Pulado" ? 0 : (Number(s.series) || 0) * (Number(s.repeticoes) || 0) * (Number(s.carga) || 0);
  }
  function volumeTreino(d, treinoId) { return N.soma(seriesDoTreino(d, treinoId), volumeSerie); }
  function progressoTreino(d, treinoId) {
    const l = seriesDoTreino(d, treinoId);
    const feitos = l.filter((s) => s.status === "Feito").length;
    return { total: l.length, feitos, pct: l.length ? (feitos / l.length) * 100 : 0 };
  }
  // última vez que um exercício foi feito (antes de uma data)
  function ultimaExecucao(d, nomeExercicio, antesDe) {
    const nome = String(nomeExercicio || "").toLowerCase();
    const ids = {};
    d.treinos.forEach((t) => { if (t.status === "Realizado" && (!antesDe || t.data < antesDe)) ids[t.id] = t.data; });
    const l = d.series.filter((s) => ids[s.treinoId] && s.status !== "Pulado" && String(s.exercicio).toLowerCase() === nome)
      .sort((a, b) => ids[b.treinoId].localeCompare(ids[a.treinoId]) || (Number(b.carga) || 0) - (Number(a.carga) || 0));
    return l.length ? Object.assign({ data: ids[l[0].treinoId] }, l[0]) : null;
  }
  // cria uma sessão a partir de uma ficha (já com as cargas da última vez)
  function iniciarTreino(d, opcoes) {
    const f = opcoes.fichaId ? ficha(d, opcoes.fichaId) : null;
    const data = opcoes.data || N.hoje(0);
    const t = { id: N.novoId(), usuarioId: perfil(d).id, fichaId: f ? f.id : null, nome: opcoes.nome || (f ? f.nome : "Treino"),
      data, grupos: f ? (f.grupos || []).slice() : (opcoes.grupos || []), status: opcoes.status || "Planejado", duracao: Number(opcoes.duracao) || 0, obs: "" };
    d.treinos.push(t);
    if (f) {
      exerciciosDaFicha(d, f.id).forEach((e, k) => {
        const ult = ultimaExecucao(d, e.nome, data);
        d.series.push({ id: N.novoId(), treinoId: t.id, exercicioId: e.id, exercicio: e.nome, grupo: e.grupo || "", ordem: k + 1,
          series: Number(e.series) || 3, repeticoes: Number(e.repMax || e.repMin) || 10, carga: ult ? Number(ult.carga) || 0 : 0,
          rpe: null, descanso: e.descanso || "", status: "Pendente", obs: "" });
      });
    }
    return t;
  }
  function excluirTreino(d, id) {
    d.series = d.series.filter((s) => s.treinoId !== id);
    d.treinos = d.treinos.filter((t) => t.id !== id);
  }

  // ---------------------------------------------------------------------
  // plano semanal e calendário
  // ---------------------------------------------------------------------
  function planoOrdenado(d) { return d.planoSemanal.slice().sort((a, b) => a.diaSemana - b.diaSemana || (a.horario || "").localeCompare(b.horario || "")); }
  function planoDoDiaSemana(d, dia) { return planoOrdenado(d).filter((p) => Number(p.diaSemana) === Number(dia)); }
  function planoTreinoNoDia(d, data) {
    return planoDoDiaSemana(d, N.diaSemana(data)).filter((p) => p.tipo !== "descanso")[0] || null;
  }
  function temPlano(d) { return d.planoSemanal.some((p) => p.tipo !== "descanso"); }
  function nomePlano(d, p) {
    if (!p) return "";
    if (p.tipo === "descanso") return "Descanso";
    const f = p.fichaId ? ficha(d, p.fichaId) : null;
    return f ? f.nome : (p.treino || "Treino");
  }
  // primeiro dia em que o usuário passou a registrar treinos
  function inicioUso(d) {
    const l = treinosOrdenados(d);
    return l.length ? l[0].data : null;
  }
  // situação de um dia no calendário
  function situacaoDoDia(d, data) {
    const hj = N.hoje(0);
    const ts = treinosDoDia(d, data);
    const plano = planoTreinoNoDia(d, data);
    const ini = inicioUso(d);
    if (ts.length) {
      const realizado = ts.some((t) => t.status === "Realizado");
      const cancelado = !realizado && ts.every((t) => t.status === "Cancelado");
      const pendente = !realizado && !cancelado;
      return { treinos: ts, plano, previsto: true, realizado, cancelado, perdido: cancelado || (pendente && data < hj), futuro: pendente && data >= hj };
    }
    if (plano) {
      const contaComoPerdido = data < hj && ini && data >= ini;
      return { treinos: [], plano, previsto: true, realizado: false, cancelado: false, perdido: !!contaComoPerdido, futuro: data >= hj, virtual: true };
    }
    return { treinos: [], plano: null, previsto: false, realizado: false, cancelado: false, perdido: false, futuro: data >= hj, descanso: true };
  }
  // estatísticas de frequência em um período
  function estatisticas(d, ini, fim) {
    let realizados = 0, perdidos = 0, futuros = 0, cancelados = 0;
    N.intervalo(ini, fim).forEach((dia) => {
      const s = situacaoDoDia(d, dia);
      if (!s.previsto) return;
      if (s.treinos.length) {
        s.treinos.forEach((t) => {
          if (t.status === "Realizado") realizados++;
          else if (t.status === "Cancelado") { perdidos++; cancelados++; }
          else if (dia < N.hoje(0)) perdidos++;
          else futuros++;
        });
      } else if (s.perdido) perdidos++;
      else if (s.futuro) futuros++;
    });
    const base = realizados + perdidos;
    return { realizados, perdidos, cancelados, futuros, planejados: realizados + perdidos + futuros, taxa: base ? (realizados / base) * 100 : null };
  }
  function semanaAtual(d) {
    return estatisticas(d, N.inicioSemana(), N.fimSemana());
  }
  // sequências: com plano, conta dias seguidos "seguindo o plano" (treinou
  // quando devia ou descansou quando era descanso); sem plano, dias seguidos
  // com treino realizado. Hoje ainda pendente não quebra a sequência.
  function sequencias(d) {
    const ini = inicioUso(d);
    if (!ini) return { atual: 0, melhor: 0, modo: temPlano(d) ? "plano" : "treinos" };
    const modoPlano = temPlano(d);
    const hj = N.hoje(0);
    let atual = 0, melhor = 0;
    N.intervalo(ini, hj).forEach((dia) => {
      const s = situacaoDoDia(d, dia);
      let ok;
      if (modoPlano) ok = s.realizado || !s.previsto;
      else ok = s.realizado;
      if (ok) { atual++; melhor = Math.max(melhor, atual); }
      else if (dia === hj) { /* hoje ainda pode ser cumprido */ }
      else atual = 0;
    });
    return { atual, melhor, modo: modoPlano ? "plano" : "treinos" };
  }
  // o que está previsto para hoje
  function treinoDeHoje(d) {
    const hj = N.hoje(0);
    const ts = treinosDoDia(d, hj).filter((t) => t.status !== "Cancelado");
    if (ts.length) {
      const t = ts.find((x) => x.status === "Realizado") || ts[0];
      return { origem: "treino", treino: t, nome: t.nome, status: t.status };
    }
    const p = planoTreinoNoDia(d, hj);
    if (p) return { origem: "plano", plano: p, nome: nomePlano(d, p), status: "Previsto", horario: p.horario };
    const descanso = planoDoDiaSemana(d, N.diaSemana(hj)).some((x) => x.tipo === "descanso");
    return descanso ? { origem: "descanso", nome: "Descanso", status: "Descanso" } : null;
  }
  // cria os treinos planejados de uma semana a partir do plano
  function gerarSemana(d, iniSemana) {
    let n = 0;
    planoOrdenado(d).forEach((p) => {
      if (p.tipo === "descanso") return;
      const data = N.addDias(iniSemana, Number(p.diaSemana) - 1);
      const nome = nomePlano(d, p);
      if (d.treinos.some((t) => t.data === data && (t.fichaId && t.fichaId === p.fichaId || t.nome === nome))) return;
      iniciarTreino(d, { fichaId: p.fichaId, nome, data, status: "Planejado", grupos: p.grupos });
      n++;
    });
    return n;
  }

  // ---------------------------------------------------------------------
  // evolução de carga
  // ---------------------------------------------------------------------
  function nomesExercicios(d) {
    const v = {};
    d.series.forEach((s) => { if (s.exercicio) v[s.exercicio] = true; });
    d.exercicios.forEach((e) => { if (e.nome) v[e.nome] = true; });
    return Object.keys(v).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }
  // carga máxima por sessão realizada → [{data, carga, volume, reps}]
  function evolucaoCarga(d, nomeExercicio) {
    const nome = String(nomeExercicio || "").toLowerCase();
    const datas = {};
    d.treinos.forEach((t) => { if (t.status === "Realizado") datas[t.id] = t.data; });
    const porTreino = {};
    d.series.forEach((s) => {
      if (!datas[s.treinoId] || s.status === "Pulado" || String(s.exercicio).toLowerCase() !== nome) return;
      const r = porTreino[s.treinoId] = porTreino[s.treinoId] || { data: datas[s.treinoId], carga: 0, volume: 0, reps: 0 };
      if ((Number(s.carga) || 0) >= r.carga) { r.carga = Number(s.carga) || 0; r.reps = Number(s.repeticoes) || 0; }
      r.volume += volumeSerie(s);
    });
    return Object.keys(porTreino).map((k) => porTreino[k]).sort((a, b) => a.data.localeCompare(b.data));
  }
  // agrupa a evolução por semana (maior carga da semana)
  function cargaPorSemana(evol) {
    const m = {};
    evol.forEach((p) => {
      const s = N.inicioSemana(p.data);
      if (!m[s] || p.carga > m[s].carga) m[s] = { semana: s, carga: p.carga, reps: p.reps };
    });
    return Object.keys(m).sort().map((k, i) => Object.assign({ numero: i + 1 }, m[k]));
  }
  // 1RM estimado (fórmula de Epley)
  function umRM(carga, reps) { return carga && reps ? carga * (1 + reps / 30) : null; }
  // maior progresso de carga recente (para insights)
  function maiorProgressoCarga(d, dias) {
    const corte = N.hoje(-(dias || 28));
    let melhor = null;
    nomesExercicios(d).forEach((n) => {
      const ev = evolucaoCarga(d, n);
      if (ev.length < 2) return;
      const ult = ev[ev.length - 1];
      const antes = ev.filter((p) => p.data <= corte);
      const base = antes.length ? antes[antes.length - 1] : ev[0];
      if (base === ult || ult.data < corte || !base.carga) return;
      const ganho = ult.carga - base.carga;
      if (ganho > 0 && (!melhor || ganho / base.carga > melhor.pct)) melhor = { exercicio: n, de: base.carga, para: ult.carga, pct: ganho / base.carga, desde: base.data };
    });
    return melhor;
  }
  function treinosPorGrupo(d, ini, fim) {
    const m = {};
    treinosNoPeriodo(d, ini || "0000-01-01", fim || "9999-12-31").filter((t) => t.status === "Realizado")
      .forEach((t) => (t.grupos || []).forEach((g) => { m[g] = (m[g] || 0) + 1; }));
    return Object.keys(m).map((g) => ({ nome: g, valor: m[g] })).sort((a, b) => b.valor - a.valor);
  }
  function ultimoTreinoDoGrupo(d, grupo) {
    const l = treinosOrdenados(d).filter((t) => t.status === "Realizado" && (t.grupos || []).indexOf(grupo) !== -1);
    return l.length ? l[l.length - 1].data : null;
  }
  function serieSemanalTreinos(d, semanas) {
    const out = [];
    for (let i = (semanas || 8) - 1; i >= 0; i--) {
      const ini = N.addDias(N.inicioSemana(), -7 * i), fim = N.addDias(ini, 6);
      const e = estatisticas(d, ini, i === 0 ? N.hoje(0) : fim);
      out.push({ rotulo: ini.slice(8, 10) + "/" + ini.slice(5, 7), realizados: e.realizados, perdidos: e.perdidos });
    }
    return out;
  }

  global.Fitness = {
    METRICAS, METRICA, CAMPOS_MEDIDA,
    perfil, pesagens, medidas, pesoNaData, altura, imc, classificacaoIMC,
    serie, primeiro, atual, valorEm, variacao, tendencia, historicoCorporal, pesagemDoDia, medidaDoDia, diasSemPesar, pesoInicial,
    ficha, fichasOrdenadas, exerciciosDaFicha, repsTexto,
    treino, treinosOrdenados, treinosNoPeriodo, treinosDoDia, seriesDoTreino, volumeSerie, volumeTreino, progressoTreino,
    ultimaExecucao, iniciarTreino, excluirTreino,
    planoOrdenado, planoDoDiaSemana, planoTreinoNoDia, temPlano, nomePlano, inicioUso, situacaoDoDia, estatisticas, semanaAtual,
    sequencias, treinoDeHoje, gerarSemana,
    nomesExercicios, evolucaoCarga, cargaPorSemana, umRM, maiorProgressoCarga, treinosPorGrupo, ultimoTreinoDoGrupo, serieSemanalTreinos
  };
})(window);
