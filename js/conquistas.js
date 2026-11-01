/**
 * conquistas.js
 * -----------------------------------------------------------------------
 * Medalhas calculadas a partir dos registros — nada é guardado além de
 * quais já foram vistas (config.conquistasVistas), para celebrar só as
 * novas. Cada conquista tem um progresso (atual / alvo), então a tela
 * mostra também quanto falta para as próximas.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo;

  // contadores reaproveitados por várias conquistas (calculados uma vez)
  function contexto(d) {
    const AL = global.Alimentacao, F = global.Fitness, BE = global.BemEstar, M = global.Metas;
    const c = {};
    c.treinos = d.treinos.filter((t) => t.status === "Realizado").length;
    c.seqTreino = F ? F.sequencias(d).melhor : 0;
    c.refeicoes = d.refeicoes.filter((r) => r.status === "Realizada").length;
    c.pesagens = d.pesagens.length;
    c.medidas = d.medidas.length;

    // dias batendo a meta de água
    const metaAgua = AL && AL.metaDiaria(d, "agua");
    const porDia = {};
    d.agua.forEach((a) => { porDia[a.data] = (porDia[a.data] || 0) + (Number(a.ml) || 0); });
    const diasAgua = metaAgua ? Object.keys(porDia).filter((k) => porDia[k] >= metaAgua).sort() : [];
    c.diasAgua = diasAgua.length;
    c.seqAgua = maiorSequencia(diasAgua);

    // check-ins e sono
    c.checkins = d.bemEstar.length;
    c.seqCheckin = maiorSequencia(d.bemEstar.map((r) => r.data).sort());
    const alvoSono = (BE && BE.metaDe(d, "sono")) || 7;
    const noitesBoas = d.bemEstar.filter((r) => { const h = BE ? BE.horasSono(r) : null; return h != null && h >= alvoSono; }).map((r) => r.data).sort();
    c.noitesBoas = noitesBoas.length;
    c.seqSono = maiorSequencia(noitesBoas);
    c.alvoSono = alvoSono;

    // passos
    const passos = d.bemEstar.filter((r) => N.temValor(r.passos));
    c.maxPassos = passos.length ? Math.max.apply(null, passos.map((r) => Number(r.passos))) : 0;
    c.passosTotal = N.soma(passos, (r) => Number(r.passos) || 0);
    const metaPassos = (BE && BE.metaDe(d, "passos")) || 10000;
    c.seqPassos = maiorSequencia(passos.filter((r) => Number(r.passos) >= metaPassos).map((r) => r.data).sort());
    c.metaPassos = metaPassos;

    // hábitos e desafios
    c.melhorSeqHabito = 0;
    c.desafiosConcluidos = 0;
    c.marcacoes = d.habitoRegistros.filter((r) => Number(r.valor) > 0).length;
    if (BE) d.habitos.forEach((h) => {
      c.melhorSeqHabito = Math.max(c.melhorSeqHabito, BE.sequencia(d, h).melhor);
      const ds = BE.desafio(d, h);
      if (ds && ds.estado === "concluido") c.desafiosConcluidos++;
    });

    // remédios: dias com todas as doses previstas tomadas
    c.diasRemedioOk = 0; c.seqRemedio = 0;
    if (BE && d.remedios.length) {
      const datas = {};
      d.doses.forEach((x) => { datas[x.data] = true; });
      const ok = Object.keys(datas).sort().filter((dia) => {
        const lista = BE.dosesDoDia(d, dia).filter((x) => !x.extra);
        return lista.length && lista.every((x) => x.status === "Tomado");
      });
      c.diasRemedioOk = ok.length;
      c.seqRemedio = maiorSequencia(ok);
    }

    // jejum
    const jc = BE ? BE.jejunsConcluidos(d) : [];
    c.jejuns = jc.filter((j) => BE.horasJejum(j) >= (Number(j.metaHoras) || 0) - 0.01).length;
    c.maiorJejum = jc.length ? Math.max.apply(null, jc.map((j) => BE.horasJejum(j))) : 0;

    // metas
    c.metasAtingidas = M ? M.avaliarTodas(d).filter((a) => a.status === "atingida").length : 0;

    // peso na direção do objetivo
    c.pesoMudanca = 0;
    if (F) {
      const s = F.serie(d, "peso");
      if (s.length >= 2) {
        const delta = s[s.length - 1].valor - s[0].valor;
        const m = M && M.metaDoTipo(d, "peso");
        const obj = (F.perfil(d).objetivo || "").toLowerCase();
        const dir = m ? Math.sign(Number(m.valorAlvo) - s[0].valor) : obj.indexOf("emagrecer") !== -1 ? -1 : obj.indexOf("ganhar") !== -1 ? 1 : 0;
        if (dir) c.pesoMudanca = Math.max(0, delta * dir);
      }
    }
    c.compras = d.compras.filter((x) => x.status === "Comprado").length;
    c.backup = d.config.ultimoBackup ? 1 : 0;
    return c;
  }
  function maiorSequencia(datasOrdenadas) {
    let melhor = 0, atual = 0, ant = null;
    datasOrdenadas.forEach((x) => {
      if (ant && N.diasEntre(ant, x) === 1) atual++;
      else if (ant !== x) atual = 1;
      melhor = Math.max(melhor, atual);
      ant = x;
    });
    return melhor;
  }

  // categoria, ícone, título, descrição, valor (do contexto) e alvo
  const LISTA = [
    { id: "peso1", cat: "Corpo", ic: "⚖️", t: "Ponto de partida", s: "Registre o seu peso pela primeira vez", v: (c) => c.pesagens, alvo: 1 },
    { id: "peso10", cat: "Corpo", ic: "📊", t: "De olho na balança", s: "10 pesagens registradas", v: (c) => c.pesagens, alvo: 10 },
    { id: "medidas", cat: "Corpo", ic: "📏", t: "Fita métrica", s: "Registre medidas ou composição corporal 3 vezes", v: (c) => c.medidas, alvo: 3 },
    { id: "kg1", cat: "Corpo", ic: "🎯", t: "Primeiro quilo", s: "1 kg na direção do seu objetivo", v: (c) => c.pesoMudanca, alvo: 1, casas: 1, un: "kg" },
    { id: "kg5", cat: "Corpo", ic: "🏔️", t: "Virada de jogo", s: "5 kg na direção do seu objetivo", v: (c) => c.pesoMudanca, alvo: 5, casas: 1, un: "kg" },

    { id: "ref10", cat: "Alimentação", ic: "🍽️", t: "Diário em dia", s: "10 refeições registradas", v: (c) => c.refeicoes, alvo: 10 },
    { id: "ref100", cat: "Alimentação", ic: "📒", t: "Cronista da cozinha", s: "100 refeições registradas", v: (c) => c.refeicoes, alvo: 100 },
    { id: "agua7", cat: "Alimentação", ic: "💧", t: "Bem hidratado", s: "7 dias seguidos batendo a meta de água", v: (c) => c.seqAgua, alvo: 7 },
    { id: "agua30", cat: "Alimentação", ic: "🌊", t: "Fonte da juventude", s: "30 dias batendo a meta de água", v: (c) => c.diasAgua, alvo: 30 },

    { id: "treino1", cat: "Treino", ic: "🏋️", t: "Primeiro treino", s: "Registre um treino realizado", v: (c) => c.treinos, alvo: 1 },
    { id: "treino10", cat: "Treino", ic: "💪", t: "Pegando o ritmo", s: "10 treinos realizados", v: (c) => c.treinos, alvo: 10 },
    { id: "treino50", cat: "Treino", ic: "🥈", t: "Frequentador", s: "50 treinos realizados", v: (c) => c.treinos, alvo: 50 },
    { id: "treino100", cat: "Treino", ic: "🥇", t: "Centenário", s: "100 treinos realizados", v: (c) => c.treinos, alvo: 100 },
    { id: "seq7", cat: "Treino", ic: "🔥", t: "Semana perfeita", s: "7 dias seguidos cumprindo o plano de treino", v: (c) => c.seqTreino, alvo: 7 },
    { id: "seq30", cat: "Treino", ic: "☄️", t: "Imparável", s: "30 dias seguidos cumprindo o plano de treino", v: (c) => c.seqTreino, alvo: 30 },

    { id: "check1", cat: "Bem-estar", ic: "📝", t: "Como você está?", s: "Faça o primeiro check-in", v: (c) => c.checkins, alvo: 1 },
    { id: "check7", cat: "Bem-estar", ic: "🗓️", t: "Autoconhecimento", s: "7 dias seguidos de check-in", v: (c) => c.seqCheckin, alvo: 7 },
    { id: "check30", cat: "Bem-estar", ic: "🧠", t: "Diário da mente", s: "30 check-ins", v: (c) => c.checkins, alvo: 30 },
    { id: "sono7", cat: "Bem-estar", ic: "😴", t: "Bela adormecida", s: (c) => `7 noites seguidas dormindo ${String(c.alvoSono).replace(".", ",")} h ou mais`, v: (c) => c.seqSono, alvo: 7 },
    { id: "passos10k", cat: "Bem-estar", ic: "👟", t: "10 mil passos", s: "Um dia com 10.000 passos ou mais", v: (c) => c.maxPassos, alvo: 10000 },
    { id: "passos7", cat: "Bem-estar", ic: "🚶", t: "Pé na estrada", s: (c) => `7 dias seguidos com ${Number(c.metaPassos).toLocaleString("pt-BR")} passos`, v: (c) => c.seqPassos, alvo: 7 },
    { id: "maratona", cat: "Bem-estar", ic: "🗺️", t: "Volta ao bairro", s: "500.000 passos somados", v: (c) => c.passosTotal, alvo: 500000 },

    { id: "hab7", cat: "Hábitos", ic: "🌱", t: "Brotou", s: "7 dias seguidos em um hábito", v: (c) => c.melhorSeqHabito, alvo: 7 },
    { id: "hab21", cat: "Hábitos", ic: "🌿", t: "Criando raízes", s: "21 dias seguidos em um hábito", v: (c) => c.melhorSeqHabito, alvo: 21 },
    { id: "hab66", cat: "Hábitos", ic: "🌳", t: "Hábito formado", s: "66 dias seguidos em um hábito", v: (c) => c.melhorSeqHabito, alvo: 66 },
    { id: "desafio1", cat: "Hábitos", ic: "🏆", t: "Desafio aceito", s: "Conclua um desafio", v: (c) => c.desafiosConcluidos, alvo: 1 },
    { id: "desafio5", cat: "Hábitos", ic: "👑", t: "Colecionador de desafios", s: "Conclua 5 desafios", v: (c) => c.desafiosConcluidos, alvo: 5 },

    { id: "rem7", cat: "Remédios", ic: "💊", t: "Em dia com a saúde", s: "7 dias seguidos tomando todas as doses", v: (c) => c.seqRemedio, alvo: 7 },
    { id: "rem30", cat: "Remédios", ic: "🩺", t: "Disciplina de ferro", s: "30 dias com todas as doses tomadas", v: (c) => c.diasRemedioOk, alvo: 30 },

    { id: "jejum1", cat: "Jejum", ic: "⏳", t: "Primeiro jejum", s: "Complete um jejum até a meta", v: (c) => c.jejuns, alvo: 1 },
    { id: "jejum10", cat: "Jejum", ic: "⌛", t: "Ritmo de jejum", s: "10 jejuns completos", v: (c) => c.jejuns, alvo: 10 },
    { id: "jejum16", cat: "Jejum", ic: "🌗", t: "16 horas", s: "Um jejum de 16 horas ou mais", v: (c) => c.maiorJejum, alvo: 16, casas: 1, un: "h" },

    { id: "meta1", cat: "Constância", ic: "🎉", t: "Meta cumprida", s: "Atinja uma meta de resultado", v: (c) => c.metasAtingidas, alvo: 1 },
    { id: "compras20", cat: "Constância", ic: "🛒", t: "Despensa cheia", s: "20 itens comprados pela lista", v: (c) => c.compras, alvo: 20 },
    { id: "backup", cat: "Constância", ic: "🛟", t: "Precavido", s: "Faça um backup dos seus dados", v: (c) => c.backup, alvo: 1 }
  ];
  const CATEGORIAS = ["Corpo", "Alimentação", "Treino", "Bem-estar", "Hábitos", "Remédios", "Jejum", "Constância"];

  function calcular(d) { return N.memo(d, "CQ.calcular", () => calcularAgora(d)); }
  function calcularAgora(d) {
    const c = contexto(d);
    return LISTA.map((x) => {
      const atual = Number(x.v(c)) || 0;
      return { id: x.id, cat: x.cat, ic: x.ic, t: x.t, s: typeof x.s === "function" ? x.s(c) : x.s, atual, alvo: x.alvo, casas: x.casas || 0, un: x.un || "",
        ok: atual >= x.alvo, pct: N.limitar((atual / x.alvo) * 100, 0, 100) };
    });
  }
  // só as das áreas ligadas em Ajustes → O que você usa
  const AREA_CAT = { "Corpo": "evolucao", "Alimentação": "alimentacao", "Treino": "academia", "Bem-estar": "checkin", "Hábitos": "habitos", "Remédios": "remedios", "Jejum": "jejum" };
  function visiveis(d) {
    const AR = global.Areas;
    return calcular(d).filter((x) => !AR || !AREA_CAT[x.cat] || AR.area(d, AREA_CAT[x.cat])).filter((x) => x.id !== "compras20" || !AR || AR.area(d, "compras"));
  }
  // conquistas desbloqueadas que ainda não foram celebradas
  function novas(d, lista) {
    lista = lista || calcular(d);
    const vistas = d.config.conquistasVistas;
    if (!Array.isArray(vistas)) return [];
    return lista.filter((x) => x.ok && vistas.indexOf(x.id) === -1);
  }
  function marcarVistas(d, lista) {
    lista = lista || calcular(d);
    d.config.conquistasVistas = lista.filter((x) => x.ok).map((x) => x.id);
  }

  global.Conquistas = { LISTA, CATEGORIAS, calcular, visiveis, novas, marcarVistas, maiorSequencia };
})(window);
