/**
 * alimentacao.js
 * -----------------------------------------------------------------------
 * Regras de negócio da parte "cozinha": lista de compras, catálogo de
 * produtos, gastos com alimentação e refeições por horário.
 *
 * Este módulo não toca no DOM — ele lê o objeto de dados e devolve
 * números e listas já calculados. Quem desenha a tela é o app.js.
 *
 * Tudo aqui é CALCULADO, nunca armazenado como valor fixo: o preço total
 * de um item é sempre "quantidade × preço unitário", e só entra como
 * gasto o que estiver com status "Comprado".
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  var A = global.Armazenamento;
  var F = global.Fitness;   // helpers de data e de usuário

  var CATEGORIAS = ["Carnes", "Frango", "Peixes", "Ovos", "Laticínios", "Verduras", "Legumes", "Frutas", "Grãos", "Padaria", "Enlatados", "Temperos", "Bebidas", "Higiene", "Limpeza", "Outros"];
  var LOCAIS = ["Feira", "Mercado", "Açougue", "Padaria", "Atacado", "Online", "Farmácia"];
  var UNIDADES = ["kg", "g", "un", "L", "ml", "pct", "dz", "cx"];
  var STATUS_COMPRA = ["Planejado", "Comprar", "Comprado", "Não comprado"];
  var PRIORIDADES = ["Alta", "Média", "Baixa"];
  var TIPOS_REFEICAO = ["Café da manhã", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar", "Ceia"];
  var UNIDADES_REFEICAO = ["g", "kg", "un", "ml", "L", "colher", "xícara", "fatia", "porção"];
  var STATUS_REFEICAO = ["Planejada", "Realizada", "Pulada"];
  var EMOJI_CATEGORIA = { "Carnes": "🥩", "Frango": "🍗", "Peixes": "🐟", "Ovos": "🥚", "Laticínios": "🥛", "Verduras": "🥦", "Legumes": "🥕", "Frutas": "🍎", "Grãos": "🍚", "Padaria": "🥖", "Enlatados": "🥫", "Temperos": "🧂", "Bebidas": "🥤", "Higiene": "🧼", "Limpeza": "🧹", "Outros": "📦" };
  var EMOJI_LOCAL = { "Feira": "🧺", "Mercado": "🛒", "Açougue": "🥩", "Padaria": "🥖", "Atacado": "📦", "Online": "🌐", "Farmácia": "💊" };
  var EMOJI_REFEICAO = { "Café da manhã": "🌅", "Lanche da manhã": "🍎", "Almoço": "🍛", "Lanche da tarde": "🥪", "Jantar": "🍽️", "Ceia": "🌙" };
  var HORARIO_SUGERIDO = { "Café da manhã": "07:30", "Lanche da manhã": "10:00", "Almoço": "12:30", "Lanche da tarde": "16:00", "Jantar": "20:00", "Ceia": "22:00" };

  // ---------------------------------------------------------------------
  // COMPRAS
  // ---------------------------------------------------------------------
  function precoTotal(c) { return Number(c.quantidade || 0) * Number(c.precoUnit || 0); }
  function gastoReal(c) { return c.status === "Comprado" ? precoTotal(c) : 0; }
  function pendente(c) { return c.status === "Comprar" || c.status === "Planejado"; }

  function comprasDe(d, usuarioId) {
    return F.deUsuario(d.compras, usuarioId).sort(function (a, b) { return (b.data || "").localeCompare(a.data || ""); });
  }
  function comprasNoMes(d, usuarioId, mes) {
    mes = mes || F.mesAtual();
    return comprasDe(d, usuarioId).filter(function (c) { return F.mesDe(c.data) === mes; });
  }
  function gastoNoMes(d, usuarioId, mes) {
    return comprasNoMes(d, usuarioId, mes).reduce(function (s, c) { return s + gastoReal(c); }, 0);
  }
  function estimadoNoMes(d, usuarioId, mes) {
    // tudo o que está na lista do mês (comprado ou não), pelo preço previsto
    return comprasNoMes(d, usuarioId, mes).filter(function (c) { return c.status !== "Não comprado"; })
      .reduce(function (s, c) { return s + precoTotal(c); }, 0);
  }
  function itensAComprar(d, usuarioId) {
    var ordem = { "Alta": 0, "Média": 1, "Baixa": 2 };
    return comprasDe(d, usuarioId).filter(pendente).sort(function (a, b) {
      return (ordem[a.prioridade] || 1) - (ordem[b.prioridade] || 1) || (a.data || "").localeCompare(b.data || "");
    });
  }
  function totalAComprar(d, usuarioId) {
    return itensAComprar(d, usuarioId).reduce(function (s, c) { return s + precoTotal(c); }, 0);
  }
  function mesesComGasto(d, usuarioId) {
    var vistos = {};
    comprasDe(d, usuarioId).forEach(function (c) { if (gastoReal(c) > 0) vistos[F.mesDe(c.data)] = true; });
    return Object.keys(vistos).sort();
  }
  function mediaMensal(d, usuarioId) {
    var meses = mesesComGasto(d, usuarioId);
    if (!meses.length) return 0;
    var total = meses.reduce(function (s, m) { return s + gastoNoMes(d, usuarioId, m); }, 0);
    return total / meses.length;
  }
  function variacaoPercentual(atual, anterior) {
    if (!anterior) return atual > 0 ? 100 : 0;
    return ((atual - anterior) / Math.abs(anterior)) * 100;
  }
  function agrupar(lista, campo, fnValor) {
    var mapa = {};
    lista.forEach(function (c) {
      var k = c[campo] || "Outros";
      mapa[k] = (mapa[k] || 0) + fnValor(c);
    });
    return Object.keys(mapa).map(function (k) { return { nome: k, valor: mapa[k] }; })
      .filter(function (i) { return i.valor > 0; })
      .sort(function (a, b) { return b.valor - a.valor; });
  }
  function gastoPorCategoria(d, usuarioId, mes) {
    var lista = mes ? comprasNoMes(d, usuarioId, mes) : comprasDe(d, usuarioId);
    return agrupar(lista, "categoria", gastoReal);
  }
  function gastoPorLocal(d, usuarioId, mes) {
    var lista = mes ? comprasNoMes(d, usuarioId, mes) : comprasDe(d, usuarioId);
    return agrupar(lista, "local", gastoReal);
  }
  function gastoPorProduto(d, usuarioId, mes) {
    var lista = mes ? comprasNoMes(d, usuarioId, mes) : comprasDe(d, usuarioId);
    return agrupar(lista, "nome", gastoReal);
  }
  function gastoPorUsuario(d, mes) {
    return d.usuarios.map(function (u) { return { id: u.id, nome: u.nome, cor: u.cor, valor: gastoNoMes(d, u.id, mes) }; })
      .filter(function (i) { return i.valor > 0; }).sort(function (a, b) { return b.valor - a.valor; });
  }
  function maiorCompra(d, usuarioId, mes) {
    var lista = comprasNoMes(d, usuarioId, mes).filter(function (c) { return gastoReal(c) > 0; });
    if (!lista.length) return null;
    return lista.reduce(function (a, b) { return gastoReal(b) > gastoReal(a) ? b : a; });
  }
  // série dos últimos N meses (gasto real por mês) para o gráfico
  function serieMensalGastos(d, usuarioId, meses) {
    meses = meses || 6;
    var out = [];
    for (var i = meses - 1; i >= 0; i--) {
      var dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - i);
      var chave = A.isoLocal(dt).slice(0, 7);
      out.push({ mes: chave, rotulo: dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        gasto: gastoNoMes(d, usuarioId, chave), estimado: estimadoNoMes(d, usuarioId, chave) });
    }
    return out;
  }

  // ---------------------------------------------------------------------
  // CATÁLOGO
  // ---------------------------------------------------------------------
  function produto(d, id) { return d.produtos.filter(function (p) { return p.id === id; })[0] || null; }
  function comprasDoProduto(d, produtoId) {
    return d.compras.filter(function (c) { return c.produtoId === produtoId; });
  }
  function resumoProduto(d, p) {
    var lista = comprasDoProduto(d, p.id);
    var pagas = lista.filter(function (c) { return c.status === "Comprado" && c.precoUnit > 0; });
    var precos = pagas.map(function (c) { return Number(c.precoUnit); });
    return {
      vezes: lista.length,
      totalGasto: lista.reduce(function (s, c) { return s + gastoReal(c); }, 0),
      menorPreco: precos.length ? Math.min.apply(null, precos) : null,
      maiorPreco: precos.length ? Math.max.apply(null, precos) : null,
      ultimoPreco: pagas.length ? Number(pagas.sort(function (a, b) { return b.data.localeCompare(a.data); })[0].precoUnit) : null
    };
  }

  // ---------------------------------------------------------------------
  // REFEIÇÕES
  // ---------------------------------------------------------------------
  function refeicoesDe(d, usuarioId) {
    return F.deUsuario(d.refeicoes, usuarioId).sort(function (a, b) {
      return (a.data || "").localeCompare(b.data || "") || (a.horario || "").localeCompare(b.horario || "");
    });
  }
  function refeicoesNoDia(d, usuarioId, data) {
    data = data || A.hoje(0);
    return refeicoesDe(d, usuarioId).filter(function (r) { return r.data === data; });
  }
  function refeicoesNoMes(d, usuarioId, mes) {
    mes = mes || F.mesAtual();
    return refeicoesDe(d, usuarioId).filter(function (r) { return F.mesDe(r.data) === mes; });
  }
  function refeicoesNaSemana(d, usuarioId) {
    return refeicoesDe(d, usuarioId).filter(function (r) { return F.estaNaSemanaAtual(r.data); });
  }
  // agrupa os alimentos do dia por horário+tipo (uma "refeição" por bloco)
  function blocosDoDia(d, usuarioId, data) {
    var mapa = {}, ordem = [];
    refeicoesNoDia(d, usuarioId, data).forEach(function (r) {
      var k = (r.horario || "") + "|" + (r.tipo || "");
      if (!mapa[k]) { mapa[k] = { horario: r.horario, tipo: r.tipo, itens: [] }; ordem.push(k); }
      mapa[k].itens.push(r);
    });
    return ordem.map(function (k) { return mapa[k]; });
  }
  function horaAgora() {
    var d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function proximaRefeicao(d, usuarioId) {
    var agora = horaAgora();
    var hoje = refeicoesNoDia(d, usuarioId).filter(function (r) { return r.status !== "Realizada" && (r.horario || "") >= agora; });
    if (hoje.length) return { data: A.hoje(0), horario: hoje[0].horario, tipo: hoje[0].tipo, itens: hoje.filter(function (r) { return r.horario === hoje[0].horario; }) };
    var amanha = refeicoesNoDia(d, usuarioId, A.hoje(1));
    if (amanha.length) return { data: A.hoje(1), horario: amanha[0].horario, tipo: amanha[0].tipo, itens: amanha.filter(function (r) { return r.horario === amanha[0].horario; }) };
    return null;
  }
  function refeicoesHoje(d, usuarioId) {
    var lista = refeicoesNoDia(d, usuarioId);
    return { total: lista.length, feitas: lista.filter(function (r) { return r.status === "Realizada"; }).length };
  }
  // copia todas as refeições de um dia para outro (planejadas)
  function duplicarDia(d, usuarioId, deData, paraData) {
    var copias = refeicoesNoDia(d, usuarioId, deData).map(function (r) {
      return Object.assign({}, r, { id: A.novoId(), data: paraData, status: "Planejada" });
    });
    copias.forEach(function (c) { d.refeicoes.push(c); });
    return copias.length;
  }

  // ---------------------------------------------------------------------
  // resumo por pessoa (alimenta os cartões)
  // ---------------------------------------------------------------------
  function resumoUsuario(d, u) {
    var mes = F.mesAtual(), ant = F.mesAnterior();
    var gasto = gastoNoMes(d, u.id, mes), gastoAnt = gastoNoMes(d, u.id, ant);
    return {
      gastoMes: gasto,
      gastoMesAnterior: gastoAnt,
      diferencaMeses: gasto - gastoAnt,
      variacaoMeses: variacaoPercentual(gasto, gastoAnt),
      estimadoMes: estimadoNoMes(d, u.id, mes),
      mediaMensal: mediaMensal(d, u.id),
      comprasMes: comprasNoMes(d, u.id, mes).filter(function (c) { return c.status === "Comprado"; }).length,
      itensAComprar: itensAComprar(d, u.id).length,
      totalAComprar: totalAComprar(d, u.id),
      refeicoesHoje: refeicoesHoje(d, u.id),
      refeicoesMes: refeicoesNoMes(d, u.id, mes).length,
      proximaRefeicao: proximaRefeicao(d, u.id)
    };
  }

  global.Alimentacao = {
    CATEGORIAS: CATEGORIAS, LOCAIS: LOCAIS, UNIDADES: UNIDADES, STATUS_COMPRA: STATUS_COMPRA, PRIORIDADES: PRIORIDADES,
    TIPOS_REFEICAO: TIPOS_REFEICAO, UNIDADES_REFEICAO: UNIDADES_REFEICAO, STATUS_REFEICAO: STATUS_REFEICAO,
    EMOJI_CATEGORIA: EMOJI_CATEGORIA, EMOJI_LOCAL: EMOJI_LOCAL, EMOJI_REFEICAO: EMOJI_REFEICAO, HORARIO_SUGERIDO: HORARIO_SUGERIDO,

    precoTotal: precoTotal,
    gastoReal: gastoReal,
    pendente: pendente,
    comprasDe: comprasDe,
    comprasNoMes: comprasNoMes,
    gastoNoMes: gastoNoMes,
    estimadoNoMes: estimadoNoMes,
    itensAComprar: itensAComprar,
    totalAComprar: totalAComprar,
    mediaMensal: mediaMensal,
    variacaoPercentual: variacaoPercentual,
    gastoPorCategoria: gastoPorCategoria,
    gastoPorLocal: gastoPorLocal,
    gastoPorProduto: gastoPorProduto,
    gastoPorUsuario: gastoPorUsuario,
    maiorCompra: maiorCompra,
    serieMensalGastos: serieMensalGastos,

    produto: produto,
    resumoProduto: resumoProduto,

    refeicoesDe: refeicoesDe,
    refeicoesNoDia: refeicoesNoDia,
    refeicoesNoMes: refeicoesNoMes,
    refeicoesNaSemana: refeicoesNaSemana,
    blocosDoDia: blocosDoDia,
    proximaRefeicao: proximaRefeicao,
    refeicoesHoje: refeicoesHoje,
    duplicarDia: duplicarDia,

    resumoUsuario: resumoUsuario
  };
})(window);
