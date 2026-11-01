/**
 * bemestar.js
 * -----------------------------------------------------------------------
 * Regras de bem-estar. Como os outros módulos de regra, não toca no DOM:
 * recebe o objeto de dados e devolve números e listas.
 *
 *   check-in     sono (horas e qualidade), humor, energia, estresse,
 *                passos e minutos ativos — um registro por dia
 *   hábitos      hábitos próprios (sim/não ou quantidade), dias da semana,
 *                horário opcional e desafios com duração
 *   remédios     remédios, vitaminas e suplementos: horários, dias, doses
 *                tomadas, estoque e dias restantes
 *   jejum        jejuns com início, fim e meta em horas
 *
 * Tudo que pode ser calculado é calculado (horas de sono a partir de
 * "dormi/acordei", sequências, adesão, dias de estoque…).
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo;

  // escalas de 1 a 5 do check-in
  const HUMOR = [
    { v: 1, e: "😞", r: "Muito mal" }, { v: 2, e: "😕", r: "Mal" }, { v: 3, e: "😐", r: "Normal" },
    { v: 4, e: "🙂", r: "Bem" }, { v: 5, e: "😄", r: "Muito bem" }
  ];
  const ENERGIA = [
    { v: 1, e: "🪫", r: "Esgotado" }, { v: 2, e: "🥱", r: "Cansado" }, { v: 3, e: "🔋", r: "Normal" },
    { v: 4, e: "⚡", r: "Disposto" }, { v: 5, e: "🚀", r: "Cheio de energia" }
  ];
  const ESTRESSE = [
    { v: 1, e: "😌", r: "Tranquilo" }, { v: 2, e: "🙂", r: "Leve" }, { v: 3, e: "😬", r: "Moderado" },
    { v: 4, e: "😣", r: "Alto" }, { v: 5, e: "🤯", r: "Muito alto" }
  ];
  const QUALIDADE = [
    { v: 1, e: "😫", r: "Péssimo" }, { v: 2, e: "😪", r: "Ruim" }, { v: 3, e: "😐", r: "Regular" },
    { v: 4, e: "😊", r: "Bom" }, { v: 5, e: "😴", r: "Excelente" }
  ];
  const ESCALAS = { humor: HUMOR, energia: ENERGIA, estresse: ESTRESSE, sonoQualidade: QUALIDADE };
  const ROTULO_CHAVE = { sono: "Sono", sonoQualidade: "Qualidade do sono", humor: "Humor", energia: "Energia", estresse: "Estresse", passos: "Passos", minutosAtivos: "Minutos ativos" };

  function nivel(escala, v) { return (ESCALAS[escala] || []).find((x) => x.v === Math.round(v)) || null; }
  function emoji(escala, v) { const n = nivel(escala, v); return n ? n.e : ""; }

  function metaDe(d, tipo) {
    const M = global.Metas;
    const m = M && M.metaDoTipo(d, tipo);
    return m ? Number(m.valorAlvo) : null;
  }

  // =====================================================================
  // CHECK-IN
  // =====================================================================
  function checkin(d, data) { return (N.grupo(d.bemEstar, "data")[data] || [])[0] || null; }

  // horas entre "dormi" e "acordei" (atravessando a meia-noite)
  function horasEntre(dormiu, acordou) {
    if (!dormiu || !acordou) return null;
    const [h1, m1] = dormiu.split(":").map(Number), [h2, m2] = acordou.split(":").map(Number);
    let min = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (min <= 0) min += 24 * 60;
    return min / 60;
  }
  function horasSono(r) {
    if (!r) return null;
    if (N.temValor(r.sonoHoras)) return Number(r.sonoHoras);
    return horasEntre(r.dormiu, r.acordou);
  }
  function valorDe(r, chave) {
    if (!r) return null;
    if (chave === "sono") return horasSono(r);
    return N.temValor(r[chave]) ? Number(r[chave]) : null;
  }
  function doDia(d, chave, data) { return valorDe(checkin(d, data), chave); }

  function serie(d, chave, ini, fim) {
    return d.bemEstar.filter((r) => (!ini || r.data >= ini) && (!fim || r.data <= fim))
      .map((r) => ({ data: r.data, valor: valorDe(r, chave) }))
      .filter((p) => p.valor != null)
      .sort((a, b) => a.data.localeCompare(b.data));
  }
  function media(d, chave, ini, fim) {
    const s = serie(d, chave, ini, fim);
    return { media: s.length ? N.media(s, (p) => p.valor) : null, dias: s.length };
  }
  function diasComCheckin(d, ini, fim) { return d.bemEstar.filter((r) => N.entre(r.data, ini, fim)).length; }

  // "Sono das últimas noites": soma do déficit em relação à meta (ou 7 h)
  function debitoSono(d, dias) {
    const alvo = metaDe(d, "sono") || 7;
    const s = serie(d, "sono", N.hoje(-(dias - 1)), N.hoje(0));
    if (s.length < 3) return null;
    return { alvo, noites: s.length, debito: N.soma(s, (p) => Math.max(0, alvo - p.valor)), media: N.media(s, (p) => p.valor) };
  }

  // relações entre áreas, só com registros suficientes nos dois grupos
  function relacoes(d) { return N.memo(d, "BE.relacoes", () => calcularRelacoes(d)); }
  function calcularRelacoes(d) {
    const out = [];
    const F = global.Fitness, AL = global.Alimentacao;
    const ini = N.hoje(-60), fim = N.hoje(0);
    const regs = d.bemEstar.filter((r) => N.entre(r.data, ini, fim));
    const comparar = (rotulo, chave, teste, txtSim, txtNao, icone, minimo) => {
      const a = [], b = [];
      regs.forEach((r) => {
        const v = valorDe(r, chave);
        if (v == null) return;
        const t = teste(r);
        if (t === true) a.push(v); else if (t === false) b.push(v);
      });
      const min = minimo || 4;
      if (a.length < min || b.length < min) return;
      const ma = N.media(a, (x) => x), mb = N.media(b, (x) => x);
      const dif = ma - mb;
      if (Math.abs(dif) < 0.3) return;
      out.push({ icone, chave, dif, ma, mb, na: a.length, nb: b.length,
        texto: `${rotulo} ${chave === "energia" ? "média" : "médio"} ${dif > 0 ? "maior" : "menor"} ${txtSim} (${N.arred(ma, 1).toLocaleString("pt-BR")} × ${N.arred(mb, 1).toLocaleString("pt-BR")} ${txtNao}).`,
        bom: chave === "estresse" ? dif < 0 : dif > 0 });
    };
    const alvoSono = metaDe(d, "sono") || 7;
    comparar("Energia", "energia", (r) => { const h = horasSono(r); return h == null ? null : h >= alvoSono; }, `nas manhãs depois de dormir ${N.arred(alvoSono, 1).toLocaleString("pt-BR")} h ou mais`, "nas outras", "😴");
    comparar("Humor", "humor", (r) => { const h = horasSono(r); return h == null ? null : h >= alvoSono; }, `nos dias depois de dormir ${N.arred(alvoSono, 1).toLocaleString("pt-BR")} h ou mais`, "nos outros", "😴");
    if (F) {
      comparar("Humor", "humor", (r) => { const s = F.situacaoDoDia(d, r.data); return s.realizado ? true : s.previsto || s.descanso ? false : null; }, "nos dias com treino", "sem treino", "🏋️");
      comparar("Energia", "energia", (r) => { const s = F.situacaoDoDia(d, r.data); return s.realizado ? true : s.previsto || s.descanso ? false : null; }, "nos dias com treino", "sem treino", "🏋️");
      comparar("Estresse", "estresse", (r) => { const s = F.situacaoDoDia(d, r.data); return s.realizado ? true : s.previsto || s.descanso ? false : null; }, "nos dias com treino", "sem treino", "🏋️");
    }
    if (AL) {
      const metaAgua = AL.metaDiaria(d, "agua");
      if (metaAgua) comparar("Energia", "energia", (r) => { const a = AL.aguaDoDia(d, r.data); return a ? a >= metaAgua : null; }, "nos dias em que bateu a meta de água", "nos outros", "💧");
    }
    const metaPassos = metaDe(d, "passos") || 8000;
    comparar("Humor", "humor", (r) => N.temValor(r.passos) ? Number(r.passos) >= metaPassos : null, `nos dias com ${Number(metaPassos).toLocaleString("pt-BR")} passos ou mais`, "nos outros", "👟");
    return out.sort((x, y) => Math.abs(y.dif) - Math.abs(x.dif));
  }

  // =====================================================================
  // HÁBITOS
  // =====================================================================
  const CORES_HABITO = ["#FF375F", "#FF9F0A", "#FFD60A", "#30D158", "#40C8E0", "#0A84FF", "#5E5CE6", "#BF5AF2"];
  // desafios prontos (viram hábitos com duração)
  const MODELOS = [
    { nome: "Beber 2 L de água", emoji: "💧", tipo: "quantidade", meta: 2000, unidade: "ml", duracao: 7, cor: "#40C8E0", agua: true, desc: "7 dias seguidos. Conta sozinho pela água registrada." },
    { nome: "Caminhar 30 minutos", emoji: "🚶", tipo: "quantidade", meta: 30, unidade: "min", duracao: 30, cor: "#30D158", desc: "30 dias de caminhada." },
    { nome: "Sem açúcar", emoji: "🍬", tipo: "sim", duracao: 21, cor: "#FF9F0A", negativo: true, desc: "21 dias sem doces e refrigerante." },
    { nome: "Dormir antes das 23h", emoji: "🌙", tipo: "sim", duracao: 14, cor: "#5E5CE6", desc: "14 noites deitando mais cedo." },
    { nome: "Ler 10 páginas", emoji: "📖", tipo: "quantidade", meta: 10, unidade: "páginas", duracao: 30, cor: "#BF5AF2", desc: "30 dias de leitura." },
    { nome: "Meditar", emoji: "🧘", tipo: "quantidade", meta: 10, unidade: "min", duracao: 21, cor: "#0A84FF", desc: "21 dias, 10 minutos por dia." },
    { nome: "Alongamento", emoji: "🤸", tipo: "sim", duracao: 30, cor: "#30D158", desc: "Todo dia, por 30 dias." },
    { nome: "Comer 3 frutas", emoji: "🍎", tipo: "quantidade", meta: 3, unidade: "frutas", duracao: 14, cor: "#FF375F", desc: "14 dias com 3 frutas." },
    { nome: "Sem telas 1h antes de dormir", emoji: "📵", tipo: "sim", duracao: 21, cor: "#8E8E93", desc: "21 noites desligando mais cedo." },
    { nome: "10.000 passos", emoji: "👟", tipo: "quantidade", meta: 10000, unidade: "passos", duracao: 7, cor: "#FF9F0A", passos: true, desc: "7 dias seguidos. Conta pelos passos do check-in." }
  ];

  function habito(d, id) { return d.habitos.find((h) => h.id === id) || null; }
  function habitosAtivos(d) {
    return d.habitos.filter((h) => h.ativo !== false)
      .sort((a, b) => (a.horario || "99").localeCompare(b.horario || "99") || (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome));
  }
  function fimDesafio(h) { return h.duracao && h.inicio ? N.addDias(h.inicio, Number(h.duracao) - 1) : null; }
  function previstoNoDia(h, data) {
    if (h.inicio && data < h.inicio) return false;
    const fim = fimDesafio(h);
    if (fim && data > fim) return false;
    const dias = Array.isArray(h.dias) && h.dias.length ? h.dias : [1, 2, 3, 4, 5, 6, 7];
    return dias.indexOf(N.diaSemana(data)) !== -1;
  }
  function registro(d, hid, data) { return (N.grupo(d.habitoRegistros, "habitoId", "data")[hid + "|" + data] || [])[0] || null; }
  // hábitos ligados a outras áreas contam sozinhos (água, passos)
  function valorNoDia(d, h, data) {
    if (h.agua && global.Alimentacao) return global.Alimentacao.aguaDoDia(d, data);
    if (h.passos) return doDia(d, "passos", data) || 0;
    const r = registro(d, h.id, data);
    return r ? Number(r.valor) || 0 : 0;
  }
  function automatico(h) { return !!(h.agua || h.passos); }
  function cumpridoNoDia(d, h, data) {
    const v = valorNoDia(d, h, data);
    return h.tipo === "quantidade" ? v >= (Number(h.meta) || 1) : v > 0;
  }
  function progressoNoDia(d, h, data) {
    const v = valorNoDia(d, h, data);
    if (h.tipo !== "quantidade") return v > 0 ? 1 : 0;
    return N.limitar(v / (Number(h.meta) || 1), 0, 1);
  }
  function inicioHabito(h) { return h.inicio || (h.criadoEm ? String(h.criadoEm).slice(0, 10) : N.hoje(0)); }

  // dias seguidos cumprindo (só conta os dias em que o hábito estava previsto;
  // hoje, se ainda não feito, não quebra a sequência)
  function sequencia(d, h) { return N.memo(d, "BE.seq:" + h.id + ":" + (h.inicio || "") + (h.dias || []).join(""), () => calcularSequencia(d, h)); }
  function calcularSequencia(d, h) {
    const hj = N.hoje(0), ini = inicioHabito(h);
    let atual = 0, melhor = 0, corrente = 0, quebrouAtual = false;
    const dias = N.intervalo(ini, hj);
    for (let i = dias.length - 1; i >= 0; i--) {
      const dia = dias[i];
      if (!previstoNoDia(h, dia)) continue;
      const ok = cumpridoNoDia(d, h, dia);
      if (!quebrouAtual) {
        if (ok) atual++;
        else if (dia !== hj) quebrouAtual = true;
      }
    }
    dias.forEach((dia) => {
      if (!previstoNoDia(h, dia)) return;
      if (cumpridoNoDia(d, h, dia)) { corrente++; melhor = Math.max(melhor, corrente); }
      else if (dia !== hj) corrente = 0;
    });
    return { atual, melhor: Math.max(melhor, atual) };
  }
  function taxa(d, h, dias) {
    const hj = N.hoje(0);
    const ini = [N.hoje(-(dias - 1)), inicioHabito(h)].sort().pop();
    let prev = 0, ok = 0;
    N.intervalo(ini, hj).forEach((dia) => {
      if (!previstoNoDia(h, dia)) return;
      const feito = cumpridoNoDia(d, h, dia);
      if (dia === hj && !feito) return; // hoje pendente não conta contra
      prev++; if (feito) ok++;
    });
    return { previstos: prev, cumpridos: ok, pct: prev ? (ok / prev) * 100 : null };
  }
  function desafio(d, h) {
    if (!h.duracao) return null;
    const ini = inicioHabito(h), fim = fimDesafio(h), hj = N.hoje(0);
    const previstos = N.intervalo(ini, fim).filter((x) => previstoNoDia(h, x));
    const cumpridos = previstos.filter((x) => x <= hj && cumpridoNoDia(d, h, x)).length;
    const perdidos = previstos.filter((x) => x < hj && !cumpridoNoDia(d, h, x)).length;
    const restantes = previstos.filter((x) => x > hj || (x === hj && !cumpridoNoDia(d, h, x))).length;
    const estado = hj > fim ? (cumpridos === previstos.length ? "concluido" : "encerrado") : cumpridos === previstos.length ? "concluido" : "ativo";
    return { ini, fim, total: previstos.length, cumpridos, perdidos, restantes, estado, dia: Math.min(N.diasEntre(ini, hj) + 1, Number(h.duracao)), pct: previstos.length ? (cumpridos / previstos.length) * 100 : 0 };
  }
  function habitosDoDia(d, data) { return habitosAtivos(d).filter((h) => previstoNoDia(h, data)); }

  // =====================================================================
  // REMÉDIOS
  // =====================================================================
  const TIPOS_REMEDIO = ["Remédio", "Vitamina", "Suplemento", "Outro"];
  const EMOJI_REMEDIO = { "Remédio": "💊", "Vitamina": "🍊", "Suplemento": "🧴", "Outro": "🩹" };
  const UNIDADES_DOSE = ["comprimido", "cápsula", "gota", "ml", "sachê", "colher", "dose", "aplicação", "g"];

  // "1 cápsula", "4 cápsulas", "5 g"
  function unidade(qtd, un) {
    if (!un) return "";
    if (Math.abs(Number(qtd)) === 1 || /s$/.test(un) || un === "ml" || un === "g") return un;
    return un === "aplicação" ? "aplicações" : un + "s";
  }
  function remedio(d, id) { return d.remedios.find((r) => r.id === id) || null; }
  function remediosAtivos(d, data) {
    data = data || N.hoje(0);
    return d.remedios.filter((r) => r.ativo !== false && (!r.inicio || r.inicio <= data) && (!r.fim || r.fim >= data))
      .sort((a, b) => ((a.horarios || [])[0] || "99").localeCompare((b.horarios || [])[0] || "99") || a.nome.localeCompare(b.nome));
  }
  function previstoRemedio(r, data) {
    if (r.ativo === false) return false;
    if (r.inicio && data < r.inicio) return false;
    if (r.fim && data > r.fim) return false;
    if (r.frequencia === "sob-demanda") return false;
    if (r.frequencia === "intervalo" && r.inicio) {
      const a = Number(r.intervaloDias) || 2;
      return N.diasEntre(r.inicio, data) % a === 0;
    }
    const dias = Array.isArray(r.dias) && r.dias.length ? r.dias : [1, 2, 3, 4, 5, 6, 7];
    return dias.indexOf(N.diaSemana(data)) !== -1;
  }
  function dose(d, rid, data, horario) { return (N.grupo(d.doses, "remedioId", "data", "horario")[rid + "|" + data + "|" + horario] || [])[0] || null; }
  function dosesDoDia(d, data) {
    const out = [];
    d.remedios.forEach((r) => {
      if (!previstoRemedio(r, data)) return;
      (r.horarios && r.horarios.length ? r.horarios : ["08:00"]).forEach((h) => {
        const x = dose(d, r.id, data, h);
        out.push({ remedio: r, horario: h, dose: x, status: x ? x.status : "Pendente" });
      });
    });
    // doses extras (sob demanda) registradas no dia
    (N.grupo(d.doses, "data")[data] || []).filter((x) => x.extra).forEach((x) => {
      const r = remedio(d, x.remedioId);
      if (r) out.push({ remedio: r, horario: x.horario, dose: x, status: x.status, extra: true });
    });
    return out.sort((a, b) => a.horario.localeCompare(b.horario));
  }
  function dosesPorDia(r) {
    if (r.frequencia === "sob-demanda") return 0;
    const n = (r.horarios || []).length || 1;
    if (r.frequencia === "intervalo") return n / (Number(r.intervaloDias) || 2);
    const dias = Array.isArray(r.dias) && r.dias.length ? r.dias.length : 7;
    return n * dias / 7;
  }
  function estoque(r) {
    if (!N.temValor(r.estoque)) return null;
    const qtd = Number(r.estoque), porDose = Number(r.porDose) || 1;
    const porDia = dosesPorDia(r) * porDose;
    return { qtd, porDia, dias: porDia ? Math.floor(qtd / porDia) : null, baixo: (N.temValor(r.estoqueMinimo) && qtd <= Number(r.estoqueMinimo)) || (porDia > 0 && qtd / porDia <= 5) };
  }
  function adesao(d, ini, fim) {
    const agora = N.horaAgora(), hj = N.hoje(0);
    let prev = 0, ok = 0;
    N.intervalo(ini, fim).forEach((dia) => {
      if (dia > hj) return;
      dosesDoDia(d, dia).forEach((x) => {
        if (x.extra) return;
        if (dia === hj && x.horario > agora && x.status === "Pendente") return;
        prev++; if (x.status === "Tomado") ok++;
      });
    });
    return { previstas: prev, tomadas: ok, pct: prev ? (ok / prev) * 100 : null };
  }
  // minutos de atraso de uma dose pendente de hoje (negativo = ainda não chegou)
  function atrasoMin(horario) {
    const [h, m] = horario.split(":").map(Number), a = new Date();
    return (a.getHours() * 60 + a.getMinutes()) - (h * 60 + m);
  }

  // =====================================================================
  // JEJUM
  // =====================================================================
  const PROTOCOLOS = [
    { h: 12, r: "12:12", s: "iniciante" }, { h: 14, r: "14:10", s: "leve" }, { h: 16, r: "16:8", s: "o mais comum" },
    { h: 18, r: "18:6", s: "avançado" }, { h: 20, r: "20:4", s: "avançado" }, { h: 24, r: "24 h", s: "uma refeição por dia" }
  ];
  function jejumAtivo(d) { return d.jejuns.find((j) => !j.fim) || null; }
  function horasJejum(j, agora) {
    const fim = j.fim ? new Date(j.fim) : (agora || new Date());
    return Math.max(0, (fim - new Date(j.inicio)) / 3600000);
  }
  function jejunsConcluidos(d) { return d.jejuns.filter((j) => j.fim).sort((a, b) => b.inicio.localeCompare(a.inicio)); }
  function estatJejum(d, dias) {
    const desde = dias ? new Date(Date.now() - dias * 86400000).toISOString() : "";
    const lista = jejunsConcluidos(d).filter((j) => j.inicio >= desde);
    const horas = lista.map((j) => horasJejum(j));
    const atingidos = lista.filter((j) => horasJejum(j) >= (Number(j.metaHoras) || 0) - 0.01).length;
    return { total: lista.length, atingidos, media: horas.length ? N.media(horas, (x) => x) : null, maior: horas.length ? Math.max.apply(null, horas) : null, pct: lista.length ? (atingidos / lista.length) * 100 : null };
  }
  function fmtHoras(h) {
    if (h == null) return "—";
    const tot = Math.round(h * 60), hh = Math.floor(tot / 60), mm = tot % 60;
    return hh + "h" + (mm ? String(mm).padStart(2, "0") : "");
  }

  global.BemEstar = {
    HUMOR, ENERGIA, ESTRESSE, QUALIDADE, ESCALAS, ROTULO_CHAVE, nivel, emoji, metaDe,
    checkin, horasEntre, horasSono, valorDe, doDia, serie, media, diasComCheckin, debitoSono, relacoes,
    CORES_HABITO, MODELOS, habito, habitosAtivos, habitosDoDia, previstoNoDia, registro, valorNoDia, automatico, cumpridoNoDia, progressoNoDia, sequencia, taxa, desafio, fimDesafio, inicioHabito,
    TIPOS_REMEDIO, EMOJI_REMEDIO, UNIDADES_DOSE, unidade, remedio, remediosAtivos, previstoRemedio, dose, dosesDoDia, dosesPorDia, estoque, adesao, atrasoMin,
    PROTOCOLOS, jejumAtivo, horasJejum, jejunsConcluidos, estatJejum, fmtHoras
  };
})(window);
