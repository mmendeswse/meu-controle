/**
 * insights.js
 * -----------------------------------------------------------------------
 * Insights (observações úteis) e alertas (notificações). As duas listas
 * são geradas na hora, SOMENTE a partir dos dados registrados — cada
 * regra só fala alguma coisa quando há registros suficientes para isso.
 * Nada é estimado ou inventado.
 *
 * O único estado guardado é quais alertas já foram vistos
 * (coleção `notificacoes`), e quais tipos de alerta estão ligados
 * (config.alertas).
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo;
  const F = global.Fitness;
  const AL = global.Alimentacao;
  const C = global.Compras;
  const M = global.Metas;

  function n1(v, casas) { return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas == null ? 1 : casas, maximumFractionDigits: casas == null ? 1 : casas }); }
  function brl(v) { return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function dataCurta(iso) { return iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : ""; }
  function litros(ml) { return n1(ml / 1000, 1) + " L"; }

  // direção desejada para uma métrica: pela meta ativa; senão pelo objetivo do perfil
  function direcaoDesejada(d, metrica) {
    const tipo = { peso: "peso", massaMuscular: "massaMuscular", gorduraPct: "gordura", cintura: "cintura" }[metrica];
    const m = tipo && M.metaDoTipo(d, tipo);
    if (m) {
      const a = M.avaliar(d, m);
      if (a.inicial != null) return Math.sign(Number(m.valorAlvo) - a.inicial);
    }
    const obj = (F.perfil(d).objetivo || "").toLowerCase();
    if (metrica === "massaMuscular") return 1;
    if (metrica === "gorduraPct" || metrica === "cintura") return -1;
    if (metrica === "peso") return obj.indexOf("emagrecer") !== -1 ? -1 : obj.indexOf("ganhar") !== -1 ? 1 : 0;
    return 0;
  }
  function tipoPorDirecao(delta, dir) {
    if (!dir) return "info";
    return delta * dir > 0 ? "positivo" : "atencao";
  }

  // ---------------------------------------------------------------------
  // INSIGHTS
  // ---------------------------------------------------------------------
  function gerarInsights(d) {
    const out = [];
    const hj = N.hoje(0);
    const add = (tipo, icone, texto, rota, peso) => out.push({ tipo, icone, texto, rota, peso: peso || 0 });

    // peso nas últimas 2 semanas
    const vp = F.variacao(d, "peso", 14);
    if (vp && vp.dias >= 6 && Math.abs(vp.delta) >= 0.1) {
      add(tipoPorDirecao(vp.delta, direcaoDesejada(d, "peso")), "⚖️",
        `Seu peso ${vp.delta < 0 ? "diminuiu" : "aumentou"} ${n1(Math.abs(vp.delta))} kg nas últimas ${vp.dias >= 12 ? "2 semanas" : vp.dias + " dias"} (${n1(vp.de.valor)} → ${n1(vp.para.valor)} kg).`, "evolucao", 9);
    } else if (vp && vp.dias >= 6) {
      add("info", "⚖️", `Seu peso ficou estável nas últimas 2 semanas (${n1(vp.para.valor)} kg).`, "evolucao", 4);
    }
    // massa muscular / gordura / cintura (últimos 60 dias)
    [["massaMuscular", "💪", "Sua massa muscular", " kg"], ["gorduraPct", "📉", "Seu percentual de gordura", " pontos percentuais"], ["cintura", "📏", "Sua cintura", " cm"]].forEach((x) => {
      const v = F.variacao(d, x[0], 60);
      if (!v || v.dias < 10 || Math.abs(v.delta) < 0.1) return;
      add(tipoPorDirecao(v.delta, direcaoDesejada(d, x[0])), x[1], `${x[2]} ${v.delta > 0 ? "aumentou" : "diminuiu"} ${n1(Math.abs(v.delta))}${x[3]} desde ${dataCurta(v.de.data)}.`, "evolucao", 7);
    });

    // treinos do mês
    const em = F.estatisticas(d, N.inicioMes(), hj);
    if (em.realizados + em.perdidos >= 2) {
      const tx = Math.round(em.taxa);
      add(tx >= 80 ? "positivo" : tx >= 50 ? "info" : "atencao", "🏋️",
        `Você realizou ${tx}% dos treinos planejados este mês (${em.realizados} de ${em.realizados + em.perdidos}).`, "academia", 8);
    }
    const seq = F.sequencias(d);
    if (seq.atual >= 3) add("positivo", "🔥", `${seq.atual} dias consecutivos ${seq.modo === "plano" ? "seguindo o plano de treinos" : "treinando"}${seq.melhor > seq.atual ? ` — seu recorde é ${seq.melhor}` : seq.atual >= 5 ? " — é o seu recorde!" : ""}.`, "academia", 6);
    const carga = F.maiorProgressoCarga(d, 28);
    if (carga) add("positivo", "📈", `Sua carga no ${carga.exercicio.toLowerCase()} subiu de ${n1(carga.de, carga.de % 1 ? 1 : 0)} kg para ${n1(carga.para, carga.para % 1 ? 1 : 0)} kg desde ${dataCurta(carga.desde)}.`, "academia", 6);
    // grupo muscular esquecido
    const grupos = F.treinosPorGrupo(d, N.hoje(-60), hj).filter((g) => g.valor >= 2 && g.nome !== "Cardio");
    grupos.forEach((g) => {
      const ult = F.ultimoTreinoDoGrupo(d, g.nome);
      const dias = ult ? N.diasEntre(ult, hj) : null;
      if (dias != null && dias >= 10) add("atencao", "🗓️", `Você não treina ${g.nome.toLowerCase()} há ${dias} dias.`, "academia", 5);
    });

    // nutrição: médias dos últimos 7 dias vs metas
    [["proteina", "🥩", "proteína", "g", 0.95], ["kcal", "🔥", "calorias", "kcal", null], ["agua", "💧", "água", "ml", 0.9], ["fibra", "🥦", "fibras", "g", 0.9]].forEach((x) => {
      const meta = AL.metaDiaria(d, x[0]);
      if (!meta) return;
      const med = AL.mediaNutriente(d, x[0], N.hoje(-7), N.hoje(-1));
      if (med.dias < 3) return;
      const r = med.media / meta;
      const valor = x[0] === "agua" ? litros(med.media) + " de " + litros(meta) : Math.round(med.media) + " de " + Math.round(meta) + " " + x[3];
      if (x[4] == null) {
        if (Math.abs(r - 1) <= 0.1) add("positivo", x[1], `Sua média de ${x[2]} está dentro da meta nos últimos 7 dias (${valor}).`, "alimentacao", 5);
        else add("atencao", x[1], `Sua média de ${x[2]} está ${r > 1 ? "acima" : "abaixo"} da meta nos últimos 7 dias (${valor}).`, "alimentacao", 7);
      } else if (r < x[4]) add("atencao", x[1], `Sua média de ${x[2]} está abaixo da meta nos últimos 7 dias (${valor}).`, "alimentacao", 7);
      else add("positivo", x[1], `Você está batendo a meta de ${x[2]} (média de ${valor} nos últimos 7 dias).`, "alimentacao", 4);
    });

    // gastos: mesmo período do mês anterior (comparação justa)
    const dia = Number(hj.slice(8, 10));
    const iniAnt = N.addMeses(N.inicioMes(), -1);
    const fimAntMesmoDia = N.addDias(iniAnt, Math.min(dia, Number(N.fimMes(iniAnt).slice(8, 10))) - 1);
    const gAtual = C.gastoNoPeriodo(d, N.inicioMes(), hj), gAnt = C.gastoNoPeriodo(d, iniAnt, fimAntMesmoDia);
    if (gAtual > 0 && gAnt > 0) {
      const p = Math.round(((gAtual - gAnt) / gAnt) * 100);
      if (Math.abs(p) >= 5) add(p > 0 ? "atencao" : "positivo", "💰", `Você gastou ${Math.abs(p)}% ${p > 0 ? "mais" : "menos"} com alimentação este mês do que no mesmo período do mês passado (${brl(gAtual)} × ${brl(gAnt)} até o dia ${dia}).`, "compras", 7);
      else add("info", "💰", `Seus gastos com alimentação estão parecidos com os do mês passado no mesmo período (${brl(gAtual)}).`, "compras", 3);
    }
    const eco = C.economiaNoPeriodo(d, N.inicioMes(), hj);
    if (Math.abs(eco) >= 1) add(eco > 0 ? "positivo" : "atencao", "🏷️", eco > 0 ? `Você economizou ${brl(eco)} em relação aos preços estimados das compras deste mês.` : `Você pagou ${brl(-eco)} a mais do que o estimado nas compras deste mês.`, "compras", 3);

    // compras frequentes que não estão no planejamento
    const planejados = AL.consumoPlanejado(d, hj, N.hoje(13));
    const nasFavoritas = {};
    d.favoritas.forEach((f) => (f.itens || []).forEach((i) => { nasFavoritas[i.alimentoId] = true; }));
    C.frequenciaCompras(d, N.hoje(-60), hj).filter((x) => x.vezes >= 3 && x.alimentoId && !planejados[x.alimentoId] && !nasFavoritas[x.alimentoId]).slice(0, 2).forEach((x) => {
      add("info", "🛒", `Você está comprando ${x.nome.toLowerCase()} com frequência (${x.vezes} vezes em 60 dias). Considere adicionar ao planejamento semanal.`, "refeicoes", 4);
    });
    // custo do que foi comido
    const custo = AL.custoConsumido(d, N.inicioMes(), hj);
    const diasRef = AL.diasComRegistro(d, N.inicioMes(), hj).length;
    if (custo.refeicoes >= 5 && diasRef >= 3) add("info", "🍽️", `Pelos preços cadastrados, o que você comeu este mês custou cerca de ${brl(custo.total)} (${brl(custo.total / diasRef)} por dia com registro).`, "alimentacao", 3);

    const baixo = C.estoqueBaixo(d);
    if (baixo.length) add("atencao", "📦", `${baixo.length} ${baixo.length === 1 ? "alimento está" : "alimentos estão"} abaixo do estoque mínimo.`, "estoque", 5);

    return out.sort((a, b) => b.peso - a.peso);
  }

  // ---------------------------------------------------------------------
  // ALERTAS
  // ---------------------------------------------------------------------
  function gerarAlertas(d, todos) {
    const cfg = d.config.alertas || {};
    const out = [];
    const hj = N.hoje(0);
    const agora = new Date();
    const hora = agora.getHours() + agora.getMinutes() / 60;
    const add = (tipo, nivel, titulo, texto, rota, chave) => { if (todos || cfg[tipo] !== false) out.push({ tipo, nivel, titulo, texto, rota, chave: tipo + ":" + chave }); };
    const usaAlgo = d.pesagens.length + d.treinos.length + d.refeicoes.length + d.compras.length > 0;

    // treinos planejados que passaram sem registro
    d.treinos.filter((t) => t.status === "Planejado" && t.data < hj && t.data >= N.hoje(-7))
      .sort((a, b) => b.data.localeCompare(a.data)).slice(0, 3).forEach((t) => {
        add("treinoNaoRealizado", "aviso", "Treino não realizado", `"${t.nome}" de ${dataCurta(t.data)} ainda está como planejado. Marque como realizado ou cancelado.`, "academia", t.id);
      });

    // peso sem registro
    const dsp = F.diasSemPesar(d);
    const lim = Number(d.config.diasSemPesagem) || 7;
    if (dsp == null && usaAlgo) add("pesoSemRegistro", "info", "Sem pesagens", "Você ainda não registrou o seu peso.", "evolucao", "nunca");
    else if (dsp != null && dsp >= lim) add("pesoSemRegistro", "aviso", "Peso sem registro", `Sua última pesagem foi há ${dsp} dias.`, "evolucao", F.pesagens(d).slice(-1)[0].data);

    // estoque baixo
    C.estoqueBaixo(d).slice(0, 5).forEach((e) => {
      const a = AL.alimento(d, e.alimentoId);
      if (!a) return;
      add("estoqueBaixo", "perigo", "Estoque baixo", `${a.nome} está abaixo da quantidade mínima (${N.qtdLegivel(e.quantidade, e.unidade)} de ${N.qtdLegivel(e.minimo, e.unidade)}).`, "estoque", e.id + ":" + e.quantidade);
    });

    // itens importantes pendentes
    const alta = C.pendentes(d).filter((c) => c.prioridade === "Alta");
    if (alta.length) add("itemImportante", "perigo", "Itens importantes", `${alta.length} ${alta.length === 1 ? "item" : "itens"} de alta prioridade na lista: ${alta.slice(0, 4).map((c) => c.nome).join(", ")}${alta.length > 4 ? "…" : ""}.`, "compras", alta.map((c) => c.id).sort().join(","));

    // metas atrasadas / fora do ritmo
    M.avaliarTodas(d).filter((a) => a.status === "fora" || (a.status === "atencao" && a.tipo.modo === "resultado" && a.meta.prazo)).forEach((a) => {
      add("metaAtrasada", a.status === "fora" ? "perigo" : "aviso", a.status === "fora" ? "Meta fora do ritmo" : "Meta em atenção",
        `${a.meta.titulo || a.tipo.rotulo}: ${a.explicacao}`, "metas", a.meta.id + ":" + a.status + ":" + N.inicioSemana());
    });

    // refeição planejada
    const rh = AL.resumoHoje(d);
    if (rh.proxima) {
      const nut = AL.nutricaoRefeicao(d, rh.proxima.id);
      const itens = AL.itensDe(d, rh.proxima.id).length;
      add("refeicaoPlanejada", "info", "Refeição planejada", `${rh.proxima.tipo}${rh.proxima.horario ? " às " + rh.proxima.horario : ""}: ${itens} ${itens === 1 ? "item" : "itens"}${nut.kcal ? ", " + Math.round(nut.kcal) + " kcal" : ""}.`, "alimentacao", rh.proxima.id);
    }

    // água abaixo do esperado para o horário
    const metaAgua = AL.metaDiaria(d, "agua");
    if (metaAgua && hora >= 11) {
      const bebido = AL.aguaDoDia(d, hj);
      const esperado = metaAgua * N.limitar((hora - 7) / 14, 0, 1);
      if (bebido < esperado * 0.7) add("aguaAbaixo", "aviso", "Água abaixo da meta", `Você registrou ${litros(bebido)} de ${litros(metaAgua)} hoje.`, "alimentacao", hj + ":" + Math.floor(hora / 3));
    }

    // proteína abaixo da meta (últimos 3 dias)
    const metaProt = AL.metaDiaria(d, "proteina");
    if (metaProt) {
      const med = AL.mediaNutriente(d, "proteina", N.hoje(-3), N.hoje(-1));
      if (med.dias >= 2 && med.media < metaProt * 0.85) add("proteinaAbaixo", "aviso", "Proteína abaixo da meta", `Média de ${Math.round(med.media)} g nos últimos ${med.dias} dias com registro (meta: ${Math.round(metaProt)} g).`, "alimentacao", hj);
    }

    // mudanças relevantes
    const v7 = F.variacao(d, "peso", 7);
    if (v7 && v7.dias <= 10 && Math.abs(v7.delta) >= v7.para.valor * 0.015) {
      add("mudancaRelevante", "aviso", "Mudança de peso", `Seu peso variou ${v7.delta > 0 ? "+" : "−"}${n1(Math.abs(v7.delta))} kg em ${v7.dias} dias.`, "evolucao", v7.para.data);
    }
    const sg = F.serie(d, "gorduraPct");
    if (sg.length >= 2) {
      const a = sg[sg.length - 2], b = sg[sg.length - 1];
      if (Math.abs(b.valor - a.valor) >= 1 && N.diasEntre(b.data, hj) <= 14) add("mudancaRelevante", b.valor < a.valor ? "sucesso" : "aviso", "Gordura corporal", `Seu percentual de gordura foi de ${n1(a.valor)}% para ${n1(b.valor)}% entre ${dataCurta(a.data)} e ${dataCurta(b.data)}.`, "evolucao", "g:" + b.data);
    }
    const sm = F.serie(d, "massaMuscular");
    if (sm.length >= 2) {
      const a = sm[sm.length - 2], b = sm[sm.length - 1];
      if (Math.abs(b.valor - a.valor) >= 0.8 && N.diasEntre(b.data, hj) <= 14) add("mudancaRelevante", b.valor > a.valor ? "sucesso" : "aviso", "Massa muscular", `Sua massa muscular foi de ${n1(a.valor)} kg para ${n1(b.valor)} kg entre ${dataCurta(a.data)} e ${dataCurta(b.data)}.`, "evolucao", "m:" + b.data);
    }

    // backup
    if (usaAlgo && !d.demo) {
      const ult = d.config.ultimoBackup ? N.isoLocal(new Date(d.config.ultimoBackup)) : null;
      const dias = ult ? N.diasEntre(ult, hj) : null;
      if (dias == null || dias >= 30) add("backupAntigo", "info", "Backup", dias == null ? "Você ainda não fez nenhum backup dos seus dados." : `Seu último backup foi há ${dias} dias.`, "configuracoes", N.inicioSemana());
    }
    return out;
  }

  function lidas(d) {
    const s = {};
    d.notificacoes.forEach((n) => { s[n.chave] = true; });
    return s;
  }
  function naoLidas(d) {
    const s = lidas(d);
    return gerarAlertas(d).filter((a) => !s[a.chave]);
  }
  // marca os alertas atuais como lidos (e descarta chaves antigas)
  function marcarLidas(d) {
    const atuais = gerarAlertas(d);
    const s = lidas(d);
    d.notificacoes = atuais.map((a) => ({ chave: a.chave, lidaEm: s[a.chave] ? (d.notificacoes.find((n) => n.chave === a.chave) || {}).lidaEm : new Date().toISOString() }));
  }

  global.Insights = { gerarInsights, gerarAlertas, naoLidas, marcarLidas, lidas };
})(window);
