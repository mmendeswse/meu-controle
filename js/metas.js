/**
 * metas.js
 * -----------------------------------------------------------------------
 * Metas pessoais e a avaliação de cada uma. A avaliação olha a TENDÊNCIA
 * (regressão linear dos registros recentes), não apenas o último valor:
 *
 *   🟢 No caminho certo — no ritmo atual, chega ao objetivo até o prazo
 *   🟡 Atenção          — indo na direção certa, mas devagar (ou estável)
 *   🔴 Fora da meta     — indo na direção contrária ou prazo vencido
 *   ⚪ Sem dados        — registros insuficientes para avaliar
 *
 * Tipos de meta:
 *   resultado  (peso, massa muscular, gordura, cintura) — valor inicial → alvo
 *   diaria     (calorias, proteína, carboidratos, gorduras, fibras, água)
 *              — média dos últimos 7 dias; também é a meta do diário
 *   frequencia (treinos por semana) — média das últimas 4 semanas
 *   limite     (gastos do mês, orçamento da lista de compras)
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo;
  const F = global.Fitness;
  const AL = global.Alimentacao;
  const C = global.Compras;

  const TIPOS = {
    peso: { rotulo: "Peso", un: "kg", modo: "resultado", metrica: "peso", casas: 1, icone: "⚖️" },
    massaMuscular: { rotulo: "Massa muscular", un: "kg", modo: "resultado", metrica: "massaMuscular", casas: 1, icone: "💪" },
    gordura: { rotulo: "Gordura corporal", un: "%", modo: "resultado", metrica: "gorduraPct", casas: 1, icone: "📉" },
    cintura: { rotulo: "Cintura", un: "cm", modo: "resultado", metrica: "cintura", casas: 1, icone: "📏" },
    treinosSemana: { rotulo: "Treinos por semana", un: "treinos", modo: "frequencia", casas: 1, icone: "🏋️" },
    calorias: { rotulo: "Calorias por dia", un: "kcal", modo: "diaria", chave: "kcal", alvo: "faixa", tol: 0.10, casas: 0, icone: "🔥" },
    proteina: { rotulo: "Proteína por dia", un: "g", modo: "diaria", chave: "proteina", alvo: "minimo", casas: 0, icone: "🥩" },
    carboidratos: { rotulo: "Carboidratos por dia", un: "g", modo: "diaria", chave: "carbo", alvo: "faixa", tol: 0.15, casas: 0, icone: "🍚" },
    gorduras: { rotulo: "Gorduras por dia", un: "g", modo: "diaria", chave: "gordura", alvo: "faixa", tol: 0.15, casas: 0, icone: "🥑" },
    fibras: { rotulo: "Fibras por dia", un: "g", modo: "diaria", chave: "fibra", alvo: "minimo", casas: 0, icone: "🥦" },
    agua: { rotulo: "Água por dia", un: "ml", modo: "diaria", chave: "agua", alvo: "minimo", casas: 0, icone: "💧" },
    gastos: { rotulo: "Gastos com alimentação no mês", un: "R$", modo: "limite", casas: 2, icone: "💰" },
    compras: { rotulo: "Orçamento da lista de compras", un: "R$", modo: "limiteLista", casas: 2, icone: "🛒" }
  };
  const STATUS = {
    atingida: { emoji: "🟢", rotulo: "Meta atingida", classe: "ok" },
    ok: { emoji: "🟢", rotulo: "No caminho certo", classe: "ok" },
    atencao: { emoji: "🟡", rotulo: "Atenção", classe: "atencao" },
    fora: { emoji: "🔴", rotulo: "Fora da meta", classe: "fora" },
    semdados: { emoji: "⚪", rotulo: "Sem dados suficientes", classe: "semdados" }
  };

  function fmt(tipo, v) {
    if (v == null || isNaN(v)) return "—";
    const t = TIPOS[tipo] || {};
    if (t.un === "R$") return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    if (t.un === "ml" && Math.abs(v) >= 1000) return (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " L";
    const casas = t.casas == null ? 1 : t.casas;
    return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas && v % 1 ? 1 : 0, maximumFractionDigits: casas }) + (t.un ? " " + t.un : "");
  }
  function fmtRitmo(tipo, porSemana) {
    const t = TIPOS[tipo] || {};
    const s = porSemana > 0 ? "+" : porSemana < 0 ? "−" : "";
    return s + Math.abs(porSemana).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " " + t.un + "/semana";
  }
  function dataBR(iso) { return iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "—"; }

  function metasAtivas(d) {
    return d.metas.filter((m) => m.ativa !== false).sort((a, b) => Object.keys(TIPOS).indexOf(a.tipo) - Object.keys(TIPOS).indexOf(b.tipo));
  }
  function metaDoTipo(d, tipo) { return metasAtivas(d).find((m) => m.tipo === tipo) || null; }

  // valor atual "bruto" de um tipo (usado ao criar uma meta)
  function valorAtual(d, tipo) {
    const t = TIPOS[tipo];
    if (!t) return null;
    if (t.modo === "resultado") { const a = F.atual(d, t.metrica); return a ? a.valor : null; }
    if (t.modo === "diaria") return AL.mediaNutriente(d, t.chave, N.hoje(-7), N.hoje(-1)).media;
    if (t.modo === "frequencia") return frequenciaSemanal(d).media;
    if (t.modo === "limite") return C.gastoNoMes(d);
    if (t.modo === "limiteLista") return C.totalEstimadoPendente(d);
    return null;
  }
  function frequenciaSemanal(d) {
    const ini = F.inicioUso(d);
    if (!ini) return { media: null, semanas: 0 };
    const dias = Math.min(28, N.diasEntre(ini, N.hoje(0)) + 1);
    const semanas = Math.max(1, dias / 7);
    const e = F.estatisticas(d, N.hoje(-(dias - 1)), N.hoje(0));
    return { media: e.realizados / semanas, semanas };
  }

  // ---------------------------------------------------------------------
  // avaliação
  // ---------------------------------------------------------------------
  function avaliar(d, m) {
    const t = TIPOS[m.tipo];
    if (!t) return { status: "semdados", progresso: null, atual: null, explicacao: "Tipo de meta desconhecido." };
    const alvo = Number(m.valorAlvo);
    const r = { tipo: t, meta: m, alvo, atual: null, progresso: null, status: "semdados", explicacao: "", detalhe: "" };
    const hj = N.hoje(0);
    const diasRestantes = m.prazo ? N.diasEntre(hj, m.prazo) : null;
    r.diasRestantes = diasRestantes;

    if (t.modo === "resultado") {
      const ult = F.atual(d, t.metrica);
      if (!ult) { r.explicacao = "Nenhum registro de " + t.rotulo.toLowerCase() + " ainda."; return r; }
      r.atual = ult.valor; r.dataAtual = ult.data;
      let inicial = N.temValor(m.valorInicial) ? Number(m.valorInicial) : null;
      if (inicial == null) {
        const desde = F.serie(d, t.metrica).find((p) => p.data >= (m.dataInicio || "0000"));
        inicial = desde ? desde.valor : F.primeiro(d, t.metrica).valor;
      }
      r.inicial = inicial;
      const dir = Math.sign(alvo - inicial) || Math.sign(alvo - r.atual) || 0;
      r.direcao = dir;
      r.progresso = alvo !== inicial ? N.limitar(((r.atual - inicial) / (alvo - inicial)) * 100, 0, 100) : (Math.abs(r.atual - alvo) < 0.01 ? 100 : 0);
      const atingida = dir === 0 ? Math.abs(r.atual - alvo) <= Math.abs(alvo) * 0.01 : dir * (r.atual - alvo) >= 0;
      const tend = F.tendencia(d, t.metrica);
      r.tendencia = tend;
      if (atingida) {
        r.status = "atingida"; r.progresso = 100;
        r.explicacao = "Você chegou a " + fmt(m.tipo, r.atual) + " (objetivo: " + fmt(m.tipo, alvo) + ").";
        return r;
      }
      if (diasRestantes != null && diasRestantes < 0) {
        r.status = "fora";
        r.explicacao = "O prazo (" + dataBR(m.prazo) + ") já passou e faltam " + fmt(m.tipo, Math.abs(alvo - r.atual)) + ".";
        return r;
      }
      if (!tend) {
        r.status = "semdados";
        r.explicacao = "Registre " + t.rotulo.toLowerCase() + " mais vezes (pelo menos 2 registros com alguns dias de diferença) para o sistema avaliar a tendência.";
        return r;
      }
      const ritmo = tend.porSemana;
      const limiar = Math.max(Math.abs(r.atual) * 0.0006, 0.02); // abaixo disso: estável
      const certo = ritmo * dir > limiar;
      const contrario = ritmo * dir < -limiar;
      r.ritmo = ritmo;
      const txtRitmo = "Ritmo atual: " + fmtRitmo(m.tipo, ritmo) + " (tendência dos últimos " + tend.janela + " dias).";
      if (diasRestantes != null) {
        const proj = r.atual + tend.porDia * diasRestantes;
        r.projecao = proj;
        const necessario = (alvo - r.atual) / Math.max(diasRestantes / 7, 1 / 7);
        r.necessario = necessario;
        const alcanca = dir * (proj - alvo) >= 0;
        if (alcanca && certo) r.status = "ok";
        else if (certo) r.status = "atencao";
        else r.status = contrario ? "fora" : "atencao";
        r.explicacao = txtRitmo + " Necessário: " + fmtRitmo(m.tipo, necessario) + " para chegar a " + fmt(m.tipo, alvo) + " até " + dataBR(m.prazo) + ".";
        if (!alcanca) r.detalhe = "No ritmo atual, chega em " + dataBR(m.prazo) + " com cerca de " + fmt(m.tipo, proj) + ".";
      } else {
        r.status = certo ? "ok" : contrario ? "fora" : "atencao";
        r.explicacao = txtRitmo;
      }
      if (certo) {
        const diasAte = (alvo - r.atual) / tend.porDia;
        if (isFinite(diasAte) && diasAte > 0 && diasAte < 3650) { r.previsao = N.hoje(Math.round(diasAte)); r.detalhe = r.detalhe || ("No ritmo atual, atinge a meta por volta de " + dataBR(r.previsao) + "."); }
      } else if (contrario) {
        r.detalhe = "A tendência está na direção contrária ao objetivo.";
      } else {
        r.detalhe = "Sem variação relevante nas últimas semanas.";
      }
      return r;
    }

    if (t.modo === "diaria") {
      const med = AL.mediaNutriente(d, t.chave, N.hoje(-7), N.hoje(-1));
      r.hoje = t.chave === "agua" ? AL.aguaDoDia(d, hj) : AL.consumoDoDia(d, hj)[t.chave];
      if (med.dias < 2) {
        r.atual = med.media;
        r.explicacao = "É preciso registrar " + (t.chave === "agua" ? "a água" : "refeições realizadas") + " em pelo menos 2 dos últimos 7 dias para avaliar a média.";
        r.progresso = alvo ? N.limitar((r.hoje / alvo) * 100, 0, 100) : null;
        return r;
      }
      r.atual = med.media; r.diasAvaliados = med.dias;
      const razao = alvo ? r.atual / alvo : 0;
      if (t.alvo === "minimo") {
        r.progresso = N.limitar(razao * 100, 0, 100);
        r.status = razao >= 1 ? "ok" : razao >= 0.85 ? "atencao" : "fora";
      } else {
        const desvio = Math.abs(razao - 1);
        r.progresso = N.limitar((1 - desvio) * 100, 0, 100);
        r.status = desvio <= t.tol ? "ok" : desvio <= t.tol * 2 ? "atencao" : "fora";
      }
      r.explicacao = "Média dos últimos 7 dias (" + med.dias + " " + (med.dias === 1 ? "dia" : "dias") + " com registro): " + fmt(m.tipo, r.atual) + " — " + Math.round(razao * 100) + "% do objetivo.";
      return r;
    }

    if (t.modo === "frequencia") {
      const fq = frequenciaSemanal(d);
      if (fq.media == null) { r.explicacao = "Nenhum treino registrado ainda."; return r; }
      r.atual = fq.media;
      r.progresso = alvo ? N.limitar((fq.media / alvo) * 100, 0, 100) : null;
      r.status = fq.media >= alvo - 0.05 ? "ok" : fq.media >= alvo * 0.75 ? "atencao" : "fora";
      r.explicacao = "Média de treinos realizados por semana nas últimas " + Math.round(fq.semanas) + " " + (Math.round(fq.semanas) === 1 ? "semana" : "semanas") + ".";
      return r;
    }

    if (t.modo === "limite") {
      if (!d.compras.some((c) => c.status === "Comprado")) { r.explicacao = "Nenhuma compra registrada como Comprada ainda."; return r; }
      r.atual = C.gastoNoMes(d);
      const diaMes = Number(hj.slice(8, 10)), diasMes = Number(N.fimMes(hj).slice(8, 10));
      const proj = diaMes >= 5 ? (r.atual / diaMes) * diasMes : r.atual;
      r.projecao = proj;
      r.progresso = alvo ? N.limitar((r.atual / alvo) * 100, 0, 100) : null;
      r.status = proj <= alvo ? "ok" : proj <= alvo * 1.1 ? "atencao" : "fora";
      r.explicacao = "Gasto até hoje: " + fmt(m.tipo, r.atual) + (diaMes >= 5 ? ". No ritmo atual, o mês fecha em cerca de " + fmt(m.tipo, proj) + "." : ".");
      return r;
    }

    if (t.modo === "limiteLista") {
      r.atual = C.totalEstimadoPendente(d);
      r.progresso = alvo ? N.limitar((r.atual / alvo) * 100, 0, 100) : null;
      r.status = r.atual <= alvo ? "ok" : r.atual <= alvo * 1.1 ? "atencao" : "fora";
      r.explicacao = "Total estimado dos itens pendentes na lista de compras.";
      return r;
    }
    return r;
  }

  function avaliarTodas(d) { return metasAtivas(d).map((m) => avaliar(d, m)); }

  global.Metas = { TIPOS, STATUS, fmt, fmtRitmo, metasAtivas, metaDoTipo, valorAtual, frequenciaSemanal, avaliar, avaliarTodas };
})(window);
