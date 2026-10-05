/**
 * nucleo.js
 * -----------------------------------------------------------------------
 * Base compartilhada por todos os módulos: datas, unidades de medida,
 * estatística simples e as listas fixas do sistema (categorias, tipos de
 * refeição, grupos musculares…). Não toca no DOM e não guarda estado.
 *
 * Todas as datas do sistema são strings "AAAA-MM-DD" no fuso local.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  // ---------------------------------------------------------------------
  // identificadores e datas
  // ---------------------------------------------------------------------
  function novoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function isoLocal(dt) {
    return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
  }
  function paraData(iso) { return new Date(iso + "T00:00:00"); }
  function hoje(offsetDias) {
    const d = new Date();
    if (offsetDias) d.setDate(d.getDate() + offsetDias);
    return isoLocal(d);
  }
  function addDias(iso, n) {
    const d = paraData(iso);
    d.setDate(d.getDate() + n);
    return isoLocal(d);
  }
  function addMeses(iso, n) {
    const d = paraData(iso);
    const dia = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(dia, ultimo));
    return isoLocal(d);
  }
  // dias de `a` até `b` (positivo se b é depois de a)
  function diasEntre(a, b) {
    return Math.round((paraData(b) - paraData(a)) / 86400000);
  }
  // 1 = segunda … 7 = domingo
  function diaSemana(iso) {
    const js = paraData(iso || hoje(0)).getDay();
    return js === 0 ? 7 : js;
  }
  function inicioSemana(iso) {
    iso = iso || hoje(0);
    return addDias(iso, 1 - diaSemana(iso));
  }
  function fimSemana(iso) { return addDias(inicioSemana(iso), 6); }
  function mesDe(iso) { return iso ? iso.slice(0, 7) : ""; }
  function inicioMes(iso) { return (iso || hoje(0)).slice(0, 7) + "-01"; }
  function fimMes(iso) {
    const d = paraData(inicioMes(iso));
    return isoLocal(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  }
  function inicioTrimestre(iso) {
    const d = paraData(iso || hoje(0));
    const m = Math.floor(d.getMonth() / 3) * 3;
    return isoLocal(new Date(d.getFullYear(), m, 1));
  }
  function fimTrimestre(iso) {
    const ini = paraData(inicioTrimestre(iso));
    return isoLocal(new Date(ini.getFullYear(), ini.getMonth() + 3, 0));
  }
  // lista de datas de `ini` a `fim` (inclusive)
  function intervalo(ini, fim) {
    const out = [];
    if (!ini || !fim || ini > fim) return out;
    let d = ini;
    while (d <= fim) { out.push(d); d = addDias(d, 1); }
    return out;
  }
  function entre(iso, ini, fim) { return !!iso && iso >= ini && iso <= fim; }
  function horaAgora() {
    const d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  const NOMES_DIA = { 1: "Segunda", 2: "Terça", 3: "Quarta", 4: "Quinta", 5: "Sexta", 6: "Sábado", 7: "Domingo" };
  const DIA_CURTO = { 1: "SEG", 2: "TER", 3: "QUA", 4: "QUI", 5: "SEX", 6: "SÁB", 7: "DOM" };

  // ---------------------------------------------------------------------
  // unidades de medida — conversão só dentro da mesma família
  // (massa: g/kg · volume: ml/L · contagem: un/dz). As demais (fatia,
  // colher, xícara, porção, pct, cx) só convertem para elas mesmas.
  // ---------------------------------------------------------------------
  const FATOR = {
    g: { fam: "massa", f: 1 }, kg: { fam: "massa", f: 1000 },
    ml: { fam: "volume", f: 1 }, L: { fam: "volume", f: 1000 },
    un: { fam: "contagem", f: 1 }, dz: { fam: "contagem", f: 12 }
  };
  function familia(un) { return FATOR[un] ? FATOR[un].fam : "u:" + un; }
  function compativeis(a, b) { return familia(a) === familia(b); }
  function converter(qtd, de, para) {
    if (qtd == null || isNaN(qtd)) return null;
    if (de === para) return Number(qtd);
    if (!FATOR[de] || !FATOR[para] || FATOR[de].fam !== FATOR[para].fam) return null;
    return Number(qtd) * FATOR[de].f / FATOR[para].f;
  }
  // unidade "de compra" natural para uma unidade de consumo
  function unidadeCompraPadrao(un) {
    return { g: "kg", ml: "L", un: "un" }[un] || un;
  }
  // mostra 1500 g como "1,5 kg" e 300 g como "300 g"
  function qtdLegivel(qtd, un) {
    if (qtd == null) return "—";
    let q = Number(qtd), u = un;
    if (u === "g" && Math.abs(q) >= 1000) { q = q / 1000; u = "kg"; }
    else if (u === "ml" && Math.abs(q) >= 1000) { q = q / 1000; u = "L"; }
    else if (u === "kg" && Math.abs(q) < 1 && q !== 0) { q = q * 1000; u = "g"; }
    else if (u === "L" && Math.abs(q) < 1 && q !== 0) { q = q * 1000; u = "ml"; }
    const casas = Math.abs(q - Math.round(q)) < 0.005 ? 0 : (Math.abs(q * 10 - Math.round(q * 10)) < 0.05 ? 1 : 2);
    return q.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }) + " " + u;
  }

  // ---------------------------------------------------------------------
  // números e estatística
  // ---------------------------------------------------------------------
  function arred(v, casas) {
    const f = Math.pow(10, casas == null ? 2 : casas);
    return Math.round(Number(v) * f) / f;
  }
  function soma(lista, fn) {
    return lista.reduce((s, x) => s + (Number(fn ? fn(x) : x) || 0), 0);
  }
  function media(lista, fn) {
    const v = lista.map((x) => (fn ? fn(x) : x)).filter((x) => x != null && !isNaN(x));
    return v.length ? v.reduce((s, x) => s + Number(x), 0) / v.length : null;
  }
  function limitar(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function temValor(v) { return v !== null && v !== undefined && v !== "" && !isNaN(v); }
  function numOuNulo(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim().replace(",", ".");
    if (s === "") return null;
    const n = Number(s);
    return isNaN(n) ? null : n;
  }
  // regressão linear simples sobre pontos [{data, valor}] — inclinação por dia
  function regressao(pontos) {
    const p = pontos.filter((x) => x && temValor(x.valor));
    if (p.length < 2) return null;
    const x0 = p[0].data;
    const xs = p.map((x) => diasEntre(x0, x.data)), ys = p.map((x) => Number(x.valor));
    if (xs[xs.length - 1] - xs[0] < 2) return null;
    const mx = media(xs), my = media(ys);
    let num = 0, den = 0;
    for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) * (xs[i] - mx); }
    if (!den) return null;
    const incl = num / den;
    return { porDia: incl, base: my - incl * mx, x0: x0, pontos: p.length, valorEm: (iso) => (my - incl * mx) + incl * diasEntre(x0, iso) };
  }
  function variacaoPct(atual, anterior) {
    if (!anterior) return null;
    return ((atual - anterior) / Math.abs(anterior)) * 100;
  }

  // ---------------------------------------------------------------------
  // listas fixas do sistema
  // ---------------------------------------------------------------------
  const CATEGORIAS = ["Proteínas", "Carboidratos", "Frutas", "Verduras", "Legumes", "Laticínios", "Bebidas", "Suplementos", "Outros"];
  const EMOJI_CATEGORIA = { "Proteínas": "🍗", "Carboidratos": "🍚", "Frutas": "🍎", "Verduras": "🥬", "Legumes": "🥕", "Laticínios": "🥛", "Bebidas": "🥤", "Suplementos": "💊", "Outros": "📦" };
  const MERCADOS = ["Mercado", "Feira", "Açougue", "Padaria", "Atacado", "Online", "Farmácia"];
  const PRIORIDADES = ["Alta", "Normal", "Baixa"];
  const STATUS_COMPRA = ["Pendente", "Comprado", "Cancelado"];
  const UNIDADES_ALIMENTO = ["g", "ml", "un", "fatia", "colher", "xícara", "porção"];
  const UNIDADES_COMPRA = ["kg", "g", "L", "ml", "un", "dz", "pct", "cx", "fatia", "colher", "xícara", "porção"];

  const TIPOS_REFEICAO = ["Café da manhã", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar", "Ceia"];
  const TIPO_CURTO = { "Café da manhã": "Café", "Lanche da manhã": "Lanche manhã", "Almoço": "Almoço", "Lanche da tarde": "Lanche", "Jantar": "Jantar", "Ceia": "Ceia" };
  const EMOJI_REFEICAO = { "Café da manhã": "🌅", "Lanche da manhã": "🍎", "Almoço": "🍛", "Lanche da tarde": "🥪", "Jantar": "🍽️", "Ceia": "🌙" };
  const HORARIO_SUGERIDO = { "Café da manhã": "07:30", "Lanche da manhã": "10:00", "Almoço": "12:30", "Lanche da tarde": "16:00", "Jantar": "20:00", "Ceia": "22:00" };
  const STATUS_REFEICAO = ["Planejada", "Realizada", "Pulada"];

  const GRUPOS_MUSCULARES = ["Peito", "Costas", "Pernas", "Glúteos", "Ombros", "Bíceps", "Tríceps", "Abdômen", "Cardio", "Corpo inteiro"];
  const STATUS_TREINO = ["Planejado", "Realizado", "Cancelado"];
  const STATUS_SERIE = ["Pendente", "Feito", "Pulado"];
  const OBJETIVOS = ["Emagrecer", "Ganhar massa", "Recomposição corporal", "Manter peso", "Saúde e bem-estar", "Condicionamento"];

  // nutrientes (por porção do alimento)
  const NUTRIENTES = [
    { chave: "kcal", rotulo: "Calorias", curto: "kcal", unidade: "kcal" },
    { chave: "proteina", rotulo: "Proteína", curto: "P", unidade: "g" },
    { chave: "carbo", rotulo: "Carboidratos", curto: "C", unidade: "g" },
    { chave: "gordura", rotulo: "Gorduras", curto: "G", unidade: "g" },
    { chave: "fibra", rotulo: "Fibras", curto: "F", unidade: "g" }
  ];

  global.Nucleo = {
    novoId, isoLocal, paraData, hoje, addDias, addMeses, diasEntre, diaSemana, inicioSemana, fimSemana,
    mesDe, inicioMes, fimMes, inicioTrimestre, fimTrimestre, intervalo, entre, horaAgora,
    NOMES_DIA, DIA_CURTO,
    familia, compativeis, converter, unidadeCompraPadrao, qtdLegivel,
    arred, soma, media, limitar, temValor, numOuNulo, regressao, variacaoPct,
    CATEGORIAS, EMOJI_CATEGORIA, MERCADOS, PRIORIDADES, STATUS_COMPRA, UNIDADES_ALIMENTO, UNIDADES_COMPRA,
    TIPOS_REFEICAO, TIPO_CURTO, EMOJI_REFEICAO, HORARIO_SUGERIDO, STATUS_REFEICAO,
    GRUPOS_MUSCULARES, STATUS_TREINO, STATUS_SERIE, OBJETIVOS, NUTRIENTES
  };
})(window);
