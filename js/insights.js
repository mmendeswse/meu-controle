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
  function gerarInsights(d) { return N.memo(d, "IN.insights", () => calcularInsights(d)); }
  function calcularInsights(d) {
    const out = [];
    const hj = N.hoje(0);
    const AR = global.Areas;
    const add = (tipo, icone, texto, rota, peso) => {
      const a = AR && AR.areaDaRota(rota);
      if (a && !AR.area(d, a)) return;
      out.push({ tipo, icone, texto, rota, peso: peso || 0 });
    };

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

    // bem-estar
    const BE = global.BemEstar;
    if (BE) {
      const sono = BE.media(d, "sono", N.hoje(-6), hj);
      if (sono.dias >= 4) {
        const alvo = BE.metaDe(d, "sono") || 7;
        const h = BE.fmtHoras(sono.media);
        if (sono.media >= alvo - 0.1) add("positivo", "😴", `Você dormiu em média ${h} por noite nos últimos 7 dias — dentro da meta.`, "bemestar", 6);
        else add("atencao", "😴", `Sua média de sono foi ${h} nos últimos 7 dias, abaixo de ${BE.fmtHoras(alvo)}.`, "bemestar", 7);
      }
      const h1 = BE.media(d, "humor", N.hoje(-6), hj), h0 = BE.media(d, "humor", N.hoje(-13), N.hoje(-7));
      if (h1.dias >= 4 && h0.dias >= 4 && Math.abs(h1.media - h0.media) >= 0.5) {
        add(h1.media > h0.media ? "positivo" : "atencao", h1.media > h0.media ? "😊" : "🫂", `Seu humor médio ${h1.media > h0.media ? "melhorou" : "caiu"} esta semana (${n1(h0.media)} → ${n1(h1.media)} de 5).`, "bemestar", 6);
      }
      const rel = BE.relacoes(d)[0];
      if (rel) add(rel.bom ? "positivo" : "info", rel.icone, rel.texto, "bemestar", 5);
      BE.habitosAtivos(d).forEach((h) => {
        const sq = BE.sequencia(d, h);
        if (sq.atual >= 7) add("positivo", h.emoji || "🌱", `${sq.atual} dias seguidos em “${h.nome}”${sq.atual >= sq.melhor && sq.atual > 7 ? " — o seu recorde!" : "."}`, "bemestar/habitos", 5);
        const ds = BE.desafio(d, h);
        if (ds && ds.estado === "ativo" && ds.restantes <= 3 && ds.restantes > 0) add("info", "🏆", `Faltam ${ds.restantes} ${ds.restantes === 1 ? "dia" : "dias"} para concluir o desafio “${h.nome}”.`, "bemestar/habitos", 6);
      });
      if (d.remedios.length) {
        const ad = BE.adesao(d, N.hoje(-6), hj);
        if (ad.previstas >= 5) {
          if (ad.pct >= 95) add("positivo", "💊", `Você tomou ${Math.round(ad.pct)}% das doses previstas nos últimos 7 dias.`, "bemestar/remedios", 5);
          else if (ad.pct < 80) add("atencao", "💊", `Nos últimos 7 dias você tomou ${ad.tomadas} de ${ad.previstas} doses (${Math.round(ad.pct)}%). Lembretes podem ajudar — Ajustes → Lembretes.`, "bemestar/remedios", 7);
        }
      }
      const ej = BE.estatJejum(d, 30);
      if (ej.total >= 3) add(ej.pct >= 70 ? "positivo" : "info", "⏳", `${ej.total} jejuns nos últimos 30 dias, com média de ${BE.fmtHoras(ej.media)} (${ej.atingidos} ${ej.atingidos === 1 ? "atingiu" : "atingiram"} a meta).`, "bemestar/jejum", 4);
    }

    return out.sort((a, b) => b.peso - a.peso);
  }

  // ---------------------------------------------------------------------
  // ALERTAS
  // ---------------------------------------------------------------------
  // os alertas dependem também da hora (água, doses atrasadas): guardados por minuto
  function gerarAlertas(d, todos) { return N.memo(d, "IN.alertas:" + !!todos, () => calcularAlertas(d, todos), N.hoje(0) + N.horaAgora()); }
  function calcularAlertas(d, todos) {
    const cfg = d.config.alertas || {};
    const out = [];
    const hj = N.hoje(0);
    const agora = new Date();
    const hora = agora.getHours() + agora.getMinutes() / 60;
    const AR = global.Areas;
    const add = (tipo, nivel, titulo, texto, rota, chave) => {
      if (AR && AR.AREA_ALERTA[tipo] && !AR.area(d, AR.AREA_ALERTA[tipo])) return;
      if (todos || cfg[tipo] !== false) out.push({ tipo, nivel, titulo, texto, rota, chave: tipo + ":" + chave });
    };
    const usaAlgo = d.pesagens.length + d.treinos.length + d.refeicoes.length + d.compras.length > 0;

    // treinos planejados que passaram sem registro (agrupados)
    const tpend = d.treinos.filter((t) => t.status === "Planejado" && t.data < hj && t.data >= N.hoje(-7)).sort((a, b) => b.data.localeCompare(a.data));
    if (tpend.length === 1) add("treinoNaoRealizado", "aviso", "Treino não realizado", `"${tpend[0].nome}" de ${dataCurta(tpend[0].data)} ainda está como planejado. Marque como realizado ou cancelado.`, "academia", tpend[0].id);
    else if (tpend.length > 1) add("treinoNaoRealizado", "aviso", `${tpend.length} treinos sem registro`, `${tpend.slice(0, 3).map((t) => `${t.nome} (${dataCurta(t.data)})`).join(", ")}${tpend.length > 3 ? "…" : ""} ainda estão como planejados.`, "academia", tpend.map((t) => t.id).join(","));

    // peso sem registro
    const dsp = F.diasSemPesar(d);
    const lim = Number(d.config.diasSemPesagem) || 7;
    if (dsp == null && usaAlgo) add("pesoSemRegistro", "info", "Sem pesagens", "Você ainda não registrou o seu peso.", "evolucao", "nunca");
    else if (dsp != null && dsp >= lim) add("pesoSemRegistro", "aviso", "Peso sem registro", `Sua última pesagem foi há ${dsp} dias.`, "evolucao", F.pesagens(d).slice(-1)[0].data);

    // estoque baixo (um aviso só, com os nomes)
    const baixos = C.estoqueBaixo(d).map((e) => ({ e, a: AL.alimento(d, e.alimentoId) })).filter((x) => x.a);
    if (baixos.length === 1) add("estoqueBaixo", "aviso", "Estoque baixo", `${baixos[0].a.nome} está abaixo do mínimo (${N.qtdLegivel(baixos[0].e.quantidade, baixos[0].e.unidade)} de ${N.qtdLegivel(baixos[0].e.minimo, baixos[0].e.unidade)}).`, "estoque", baixos[0].e.id + ":" + baixos[0].e.quantidade);
    else if (baixos.length > 1) add("estoqueBaixo", "aviso", `${baixos.length} alimentos acabando`, `${baixos.slice(0, 4).map((x) => x.a.nome).join(", ")}${baixos.length > 4 ? "…" : ""} estão abaixo do mínimo.`, "estoque", baixos.map((x) => x.e.id).sort().join(","));

    // itens importantes pendentes
    const alta = C.pendentes(d).filter((c) => c.prioridade === "Alta");
    if (alta.length) add("itemImportante", "aviso", "Itens importantes", `${alta.length} ${alta.length === 1 ? "item" : "itens"} de alta prioridade na lista: ${alta.slice(0, 4).map((c) => c.nome).join(", ")}${alta.length > 4 ? "…" : ""}.`, "compras", alta.map((c) => c.id).sort().join(","));

    // metas atrasadas / fora do ritmo (agrupadas)
    const mf = M.avaliarTodas(d).filter((a) => a.status === "fora" || (a.status === "atencao" && a.tipo.modo === "resultado" && a.meta.prazo));
    if (mf.length === 1) add("metaAtrasada", "aviso", mf[0].status === "fora" ? "Meta fora do ritmo" : "Meta em atenção", `${mf[0].meta.titulo || mf[0].tipo.rotulo}: ${mf[0].explicacao}`, "metas", mf[0].meta.id + ":" + mf[0].status + ":" + N.inicioSemana());
    else if (mf.length > 1) add("metaAtrasada", "aviso", `${mf.length} metas pedem atenção`, mf.map((a) => a.meta.titulo || a.tipo.rotulo).join(", ") + ".", "metas", mf.map((a) => a.meta.id + a.status).sort().join(",") + ":" + N.inicioSemana());

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

    // bem-estar: doses, estoque de remédios, jejum e check-in
    const BE = global.BemEstar;
    if (BE) {
      const pend = BE.dosesDoDia(d, hj).filter((x) => !x.extra && x.status === "Pendente").map((x) => Object.assign({ atraso: BE.atrasoMin(x.horario) }, x));
      const atrasadas = pend.filter((x) => x.atraso >= 30), agora = pend.filter((x) => x.atraso < 30 && x.atraso >= -10);
      if (atrasadas.length === 1) add("remedioAtrasado", "perigo", "Remédio atrasado", `${atrasadas[0].remedio.nome} (${atrasadas[0].remedio.dose || "dose"}) era às ${atrasadas[0].horario}.`, "bemestar/remedios", atrasadas[0].remedio.id + ":" + hj + ":" + atrasadas[0].horario);
      else if (atrasadas.length > 1) add("remedioAtrasado", "perigo", `${atrasadas.length} doses atrasadas`, atrasadas.map((x) => `${x.remedio.nome} (${x.horario})`).join(", ") + ".", "bemestar/remedios", atrasadas.map((x) => x.remedio.id + x.horario).join(",") + ":" + hj);
      if (agora.length) add("remedioAtrasado", "aviso", "Hora do remédio", agora.map((x) => `${x.remedio.nome} às ${x.horario}`).join(", "), "bemestar/remedios", agora.map((x) => x.remedio.id + x.horario).join(",") + ":" + hj + ":agora");
      const acabando = BE.remediosAtivos(d).map((r) => ({ r, e: BE.estoque(r) })).filter((x) => x.e && x.e.baixo);
      if (acabando.length === 1) add("remedioEstoque", "perigo", "Remédio acabando", `${acabando[0].r.nome}: restam ${n1(acabando[0].e.qtd, acabando[0].e.qtd % 1 ? 1 : 0)} ${BE.unidade(acabando[0].e.qtd, acabando[0].r.unidadeDose || "")}${acabando[0].e.dias != null ? ` (≈ ${acabando[0].e.dias} ${acabando[0].e.dias === 1 ? "dia" : "dias"})` : ""}.`, "bemestar/remedios", acabando[0].r.id + ":" + Math.floor(acabando[0].e.qtd));
      else if (acabando.length > 1) add("remedioEstoque", "perigo", `${acabando.length} remédios acabando`, acabando.map((x) => `${x.r.nome}${x.e.dias != null ? ` (≈ ${x.e.dias} d)` : ""}`).join(", ") + ".", "bemestar/remedios", acabando.map((x) => x.r.id + Math.floor(x.e.qtd)).join(","));
      const jj = BE.jejumAtivo(d);
      if (jj && BE.horasJejum(jj) >= Number(jj.metaHoras)) add("jejumMeta", "sucesso", "Jejum concluído", `Você completou ${BE.fmtHoras(BE.horasJejum(jj))} de jejum (meta ${BE.fmtHoras(jj.metaHoras)}). Encerre quando fizer a próxima refeição.`, "bemestar/jejum", jj.id);
      const P = global.Personalizar;
      if (P && d.bemEstar.length >= 3) {
        const hc = P.horario(d, "checkin"), c = BE.checkin(d, hj);
        if (hc && N.horaAgora() >= hc && (!c || c.humor == null)) add("checkinPendente", "info", "Check-in do dia", "Como foi o seu dia? Registre humor, energia e estresse.", "bemestar", hj);
      }
    }

    // backup
    if (usaAlgo && !d.demo) {
      const ult = d.config.ultimoBackup ? N.isoLocal(new Date(d.config.ultimoBackup)) : null;
      const dias = ult ? N.diasEntre(ult, hj) : null;
      const B = global.Backup;
      if (B ? B.precisaLembrar(d) : (dias == null || dias >= 30)) add("backupAntigo", "aviso", "Backup", dias == null ? "Você ainda não fez nenhum backup dos seus dados." : `Seu último backup foi há ${dias} dias.`, "configuracoes/backup", N.hoje(0));
    }
    const ORDEM = { perigo: 0, aviso: 1, sucesso: 2, info: 3 };
    return out.sort((a, b) => (ORDEM[a.nivel] || 9) - (ORDEM[b.nivel] || 9));
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
