/**
 * fitness.js
 * -----------------------------------------------------------------------
 * Regras de negócio da parte "corpo e academia": pesagens, IMC, treinos,
 * exercícios e plano semanal.
 *
 * Este módulo não toca no DOM — ele lê o objeto de dados (via
 * Armazenamento.carregarDados) e devolve números e listas já calculados.
 * Quem desenha a tela é o app.js.
 *
 * Tudo aqui é CALCULADO, nunca armazenado como valor fixo: o peso atual
 * de uma pessoa é sempre "a última pesagem registrada", a diferença é
 * "peso atual − peso inicial", o IMC é "peso ÷ altura²" e assim por diante.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  var A = global.Armazenamento;

  // ---------------------------------------------------------------------
  // helpers de data (todas as datas são strings "AAAA-MM-DD")
  // ---------------------------------------------------------------------
  function mesDe(dataStr) { return dataStr ? dataStr.slice(0, 7) : ""; }
  function mesAtual() { return A.hoje(0).slice(0, 7); }
  function mesAnterior() {
    var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    return A.isoLocal(d).slice(0, 7);
  }
  function diasEntre(dataStr) {
    var alvo = new Date(dataStr + "T00:00:00");
    var hj = new Date(); hj.setHours(0, 0, 0, 0);
    return Math.round((alvo - hj) / 86400000);
  }
  // 1 = segunda … 7 = domingo (padrão do plano semanal)
  function diaSemanaDe(dataStr) {
    var dt = dataStr ? new Date(dataStr + "T00:00:00") : new Date();
    var js = dt.getDay();           // 0 = domingo
    return js === 0 ? 7 : js;
  }
  // segunda-feira da semana de uma data
  function inicioSemana(dataStr) {
    var dt = dataStr ? new Date(dataStr + "T00:00:00") : new Date();
    var dif = diaSemanaDe(dataStr) - 1;
    dt.setDate(dt.getDate() - dif);
    return A.isoLocal(dt);
  }
  function fimSemana(dataStr) {
    var ini = new Date(inicioSemana(dataStr) + "T00:00:00");
    ini.setDate(ini.getDate() + 6);
    return A.isoLocal(ini);
  }
  function estaNaSemanaAtual(dataStr) {
    return dataStr >= inicioSemana() && dataStr <= fimSemana();
  }
  function ultimosDias(dataStr, n) {
    return dataStr <= A.hoje(0) && dataStr > A.hoje(-n);
  }

  var NOMES_DIA = { 1: "Segunda", 2: "Terça", 3: "Quarta", 4: "Quinta", 5: "Sexta", 6: "Sábado", 7: "Domingo" };
  var GRUPOS_MUSCULARES = ["Peito", "Costas", "Pernas", "Glúteos", "Ombros", "Bíceps", "Tríceps", "Abdômen", "Cardio", "Corpo inteiro"];
  var STATUS_TREINO = ["Planejado", "Realizado", "Adiado", "Cancelado"];
  var STATUS_EXERCICIO = ["Pendente", "Feito", "Pulado"];
  var OBJETIVOS = ["Emagrecer", "Ganhar massa", "Manter peso", "Saúde e bem-estar", "Condicionamento"];

  // ---------------------------------------------------------------------
  // filtros por pessoa (todo o sistema é multiusuário)
  // ---------------------------------------------------------------------
  function deUsuario(lista, usuarioId) {
    if (!usuarioId) return lista.slice();
    return lista.filter(function (x) { return x.usuarioId === usuarioId; });
  }
  function usuario(d, id) {
    return d.usuarios.filter(function (u) { return u.id === id; })[0] || null;
  }
  function nomeUsuario(d, id) {
    var u = usuario(d, id);
    return u ? u.nome : "—";
  }
  function usuariosAtivos(d) {
    return d.usuarios.filter(function (u) { return u.ativo !== false; });
  }

  // ---------------------------------------------------------------------
  // PESO
  // ---------------------------------------------------------------------
  function pesagensDe(d, usuarioId) {
    return deUsuario(d.pesagens, usuarioId).sort(function (a, b) { return a.data.localeCompare(b.data); });
  }
  function ultimaPesagem(d, usuarioId) {
    var lista = pesagensDe(d, usuarioId);
    return lista.length ? lista[lista.length - 1] : null;
  }
  function primeiraPesagem(d, usuarioId) {
    var lista = pesagensDe(d, usuarioId);
    return lista.length ? lista[0] : null;
  }
  function pesoAtual(d, u) {
    var p = ultimaPesagem(d, u.id);
    return p ? Number(p.peso) : (u.pesoInicial ? Number(u.pesoInicial) : null);
  }
  function pesoInicialReal(d, u) {
    // peso inicial do cadastro; se vazio, a primeira pesagem
    if (u.pesoInicial) return Number(u.pesoInicial);
    var p = primeiraPesagem(d, u.id);
    return p ? Number(p.peso) : null;
  }
  function diferencaPeso(d, u) {
    var atual = pesoAtual(d, u), inicial = pesoInicialReal(d, u);
    if (atual == null || inicial == null) return null;
    return atual - inicial;
  }
  function pesoMedio(d, u) {
    var lista = pesagensDe(d, u.id);
    if (!lista.length) return null;
    return lista.reduce(function (s, p) { return s + Number(p.peso); }, 0) / lista.length;
  }
  function imc(peso, altura) {
    if (!peso || !altura) return null;
    return peso / (altura * altura);
  }
  function classificacaoIMC(v) {
    if (v == null) return "—";
    if (v < 18.5) return "Abaixo do peso";
    if (v < 25) return "Peso normal";
    if (v < 30) return "Sobrepeso";
    if (v < 35) return "Obesidade I";
    if (v < 40) return "Obesidade II";
    return "Obesidade III";
  }
  function imcAtual(d, u) {
    var p = ultimaPesagem(d, u.id);
    var altura = (p && p.altura) ? Number(p.altura) : Number(u.altura || 0);
    return imc(pesoAtual(d, u), altura);
  }
  function diasAcompanhamento(d, u) {
    var ini = u.dataInicio || (primeiraPesagem(d, u.id) || {}).data;
    return ini ? -diasEntre(ini) : 0;
  }
  function diasDesdeUltimaPesagem(d, u) {
    var p = ultimaPesagem(d, u.id);
    return p ? -diasEntre(p.data) : null;
  }
  // série para o gráfico de evolução: [{data, peso}]
  function seriePeso(d, usuarioId, meses) {
    var lista = pesagensDe(d, usuarioId);
    if (meses) {
      var dt = new Date(); dt.setMonth(dt.getMonth() - meses);
      var corte = A.isoLocal(dt);
      lista = lista.filter(function (p) { return p.data >= corte; });
    }
    return lista.map(function (p) { return { data: p.data, peso: Number(p.peso) }; });
  }
  // variação entre a primeira e a última pesagem do mês
  function variacaoNoMes(d, usuarioId, mes) {
    mes = mes || mesAtual();
    var lista = pesagensDe(d, usuarioId).filter(function (p) { return mesDe(p.data) === mes; });
    if (lista.length < 2) return null;
    return Number(lista[lista.length - 1].peso) - Number(lista[0].peso);
  }

  // ---------------------------------------------------------------------
  // TREINOS
  // ---------------------------------------------------------------------
  function treinosDe(d, usuarioId) {
    return deUsuario(d.treinos, usuarioId).sort(function (a, b) { return a.data.localeCompare(b.data); });
  }
  function treinosRealizados(d, usuarioId) {
    return treinosDe(d, usuarioId).filter(function (t) { return t.status === "Realizado"; });
  }
  function treinosNaSemana(d, usuarioId) {
    var semana = treinosDe(d, usuarioId).filter(function (t) { return estaNaSemanaAtual(t.data) && t.status !== "Cancelado"; });
    return {
      planejados: semana.length,
      feitos: semana.filter(function (t) { return t.status === "Realizado"; }).length
    };
  }
  function treinosUltimos7Dias(d, usuarioId) {
    return treinosRealizados(d, usuarioId).filter(function (t) { return ultimosDias(t.data, 7); }).length;
  }
  function treinosNoMes(d, usuarioId, mes) {
    mes = mes || mesAtual();
    return treinosRealizados(d, usuarioId).filter(function (t) { return mesDe(t.data) === mes; }).length;
  }
  function treinoDeHoje(d, usuarioId) {
    var hj = A.hoje(0);
    var t = treinosDe(d, usuarioId).filter(function (x) { return x.data === hj && x.status !== "Cancelado"; })[0];
    if (t) return { origem: "treino", nome: t.nome, status: t.status, id: t.id, grupos: t.grupos || [] };
    var p = deUsuario(d.planoSemanal, usuarioId).filter(function (x) { return Number(x.diaSemana) === diaSemanaDe(); })[0];
    if (p && String(p.treino || "").toLowerCase() !== "descanso") return { origem: "plano", nome: p.treino, status: "Previsto no plano", id: p.id, grupos: p.grupos || [], horario: p.horario };
    return null;
  }
  function proximoTreino(d, usuarioId) {
    var hj = A.hoje(0);
    return treinosDe(d, usuarioId).filter(function (t) { return t.data >= hj && t.status === "Planejado"; })[0] || null;
  }
  function exerciciosDoTreino(d, treinoId) {
    return d.exercicios.filter(function (e) { return e.treinoId === treinoId; });
  }
  function volumeExercicio(e) {
    return Number(e.series || 0) * Number(e.repeticoes || 0) * Number(e.carga || 0);
  }
  function volumeTreino(d, treinoId) {
    return exerciciosDoTreino(d, treinoId).reduce(function (s, e) { return s + volumeExercicio(e); }, 0);
  }
  function progressoTreino(d, treinoId) {
    var lista = exerciciosDoTreino(d, treinoId);
    var feitos = lista.filter(function (e) { return e.status === "Feito"; }).length;
    return { total: lista.length, feitos: feitos, pct: lista.length ? (feitos / lista.length) * 100 : 0 };
  }
  function exerciciosFeitos(d, usuarioId) {
    var ids = {};
    treinosDe(d, usuarioId).forEach(function (t) { ids[t.id] = true; });
    return d.exercicios.filter(function (e) { return ids[e.treinoId] && e.status === "Feito"; }).length;
  }
  function treinosPorGrupo(d, usuarioId) {
    var mapa = {};
    treinosRealizados(d, usuarioId).forEach(function (t) {
      (t.grupos || []).forEach(function (g) { mapa[g] = (mapa[g] || 0) + 1; });
    });
    return Object.keys(mapa).map(function (g) { return { grupo: g, valor: mapa[g] }; })
      .sort(function (a, b) { return b.valor - a.valor; });
  }
  function treinosPorStatus(d, usuarioId) {
    var mapa = {};
    treinosDe(d, usuarioId).forEach(function (t) { mapa[t.status] = (mapa[t.status] || 0) + 1; });
    return STATUS_TREINO.filter(function (s) { return mapa[s]; }).map(function (s) { return { status: s, valor: mapa[s] }; });
  }
  // série dos últimos N meses (treinos realizados por mês)
  function serieMensalTreinos(d, usuarioId, meses) {
    meses = meses || 6;
    var out = [];
    for (var i = meses - 1; i >= 0; i--) {
      var dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - i);
      var chave = A.isoLocal(dt).slice(0, 7);
      out.push({ mes: chave, rotulo: dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), valor: treinosNoMes(d, usuarioId, chave) });
    }
    return out;
  }
  // evolução da carga de um exercício (pelo nome) ao longo dos treinos
  function evolucaoCarga(d, usuarioId, nomeExercicio) {
    var ids = {};
    treinosDe(d, usuarioId).forEach(function (t) { ids[t.id] = t.data; });
    return d.exercicios
      .filter(function (e) { return ids[e.treinoId] && e.nome.toLowerCase() === String(nomeExercicio).toLowerCase(); })
      .map(function (e) { return { data: ids[e.treinoId], carga: Number(e.carga || 0) }; })
      .sort(function (a, b) { return a.data.localeCompare(b.data); });
  }
  function nomesExercicios(d, usuarioId) {
    var ids = {};
    treinosDe(d, usuarioId).forEach(function (t) { ids[t.id] = true; });
    var vistos = {};
    d.exercicios.forEach(function (e) { if (ids[e.treinoId]) vistos[e.nome] = true; });
    return Object.keys(vistos).sort();
  }

  // ---------------------------------------------------------------------
  // PLANO SEMANAL
  // ---------------------------------------------------------------------
  function planoDe(d, usuarioId) {
    return deUsuario(d.planoSemanal, usuarioId).sort(function (a, b) { return Number(a.diaSemana) - Number(b.diaSemana); });
  }
  function planoDoDia(d, usuarioId, dia) {
    return planoDe(d, usuarioId).filter(function (p) { return Number(p.diaSemana) === Number(dia); });
  }
  // cria (ou devolve) o treino de hoje a partir do plano — usado pelo botão
  // "Iniciar treino de hoje"
  function treinoAPartirDoPlano(p) {
    return { id: A.novoId(), usuarioId: p.usuarioId, nome: p.treino, data: A.hoje(0), grupos: (p.grupos || []).slice(), status: "Planejado", duracao: 60, obs: "" };
  }

  // ---------------------------------------------------------------------
  // resumo por pessoa (alimenta os cartões do dashboard)
  // ---------------------------------------------------------------------
  function resumoUsuario(d, u) {
    var semana = treinosNaSemana(d, u.id);
    var atual = pesoAtual(d, u);
    var dif = diferencaPeso(d, u);
    var v = imcAtual(d, u);
    return {
      usuario: u,
      pesoAtual: atual,
      pesoInicial: pesoInicialReal(d, u),
      diferenca: dif,
      pesoMedio: pesoMedio(d, u),
      imc: v,
      classificacao: classificacaoIMC(v),
      ultimaPesagem: ultimaPesagem(d, u.id),
      diasSemPesar: diasDesdeUltimaPesagem(d, u),
      diasAcompanhamento: diasAcompanhamento(d, u),
      treinoHoje: treinoDeHoje(d, u.id),
      proximoTreino: proximoTreino(d, u.id),
      semanaPlanejados: semana.planejados,
      semanaFeitos: semana.feitos,
      ultimos7: treinosUltimos7Dias(d, u.id),
      noMes: treinosNoMes(d, u.id),
      mesAnterior: treinosNoMes(d, u.id, mesAnterior()),
      exerciciosFeitos: exerciciosFeitos(d, u.id),
      totalTreinos: treinosRealizados(d, u.id).length
    };
  }

  global.Fitness = {
    mesAtual: mesAtual,
    mesAnterior: mesAnterior,
    mesDe: mesDe,
    diasEntre: diasEntre,
    diaSemanaDe: diaSemanaDe,
    inicioSemana: inicioSemana,
    fimSemana: fimSemana,
    estaNaSemanaAtual: estaNaSemanaAtual,
    NOMES_DIA: NOMES_DIA,
    GRUPOS_MUSCULARES: GRUPOS_MUSCULARES,
    STATUS_TREINO: STATUS_TREINO,
    STATUS_EXERCICIO: STATUS_EXERCICIO,
    OBJETIVOS: OBJETIVOS,

    deUsuario: deUsuario,
    usuario: usuario,
    nomeUsuario: nomeUsuario,
    usuariosAtivos: usuariosAtivos,

    pesagensDe: pesagensDe,
    ultimaPesagem: ultimaPesagem,
    pesoAtual: pesoAtual,
    pesoInicialReal: pesoInicialReal,
    diferencaPeso: diferencaPeso,
    pesoMedio: pesoMedio,
    imc: imc,
    imcAtual: imcAtual,
    classificacaoIMC: classificacaoIMC,
    diasAcompanhamento: diasAcompanhamento,
    seriePeso: seriePeso,
    variacaoNoMes: variacaoNoMes,

    treinosDe: treinosDe,
    treinosRealizados: treinosRealizados,
    treinosNaSemana: treinosNaSemana,
    treinosUltimos7Dias: treinosUltimos7Dias,
    treinosNoMes: treinosNoMes,
    treinoDeHoje: treinoDeHoje,
    proximoTreino: proximoTreino,
    exerciciosDoTreino: exerciciosDoTreino,
    volumeExercicio: volumeExercicio,
    volumeTreino: volumeTreino,
    progressoTreino: progressoTreino,
    treinosPorGrupo: treinosPorGrupo,
    treinosPorStatus: treinosPorStatus,
    serieMensalTreinos: serieMensalTreinos,
    evolucaoCarga: evolucaoCarga,
    nomesExercicios: nomesExercicios,

    planoDe: planoDe,
    planoDoDia: planoDoDia,
    treinoAPartirDoPlano: treinoAPartirDoPlano,

    resumoUsuario: resumoUsuario
  };
})(window);
