/**
 * compras.js
 * -----------------------------------------------------------------------
 * Lista de compras, gastos com alimentação, estoque de casa e a
 * INTEGRAÇÃO entre eles — o coração do sistema:
 *
 *   refeição planejada ─┐
 *                       ├─► necessidade = planejado + mínimo − estoque
 *   estoque mínimo ─────┘          │
 *                                  ▼
 *                     item automático na lista de compras
 *                                  │  (marcado como Comprado)
 *                                  ▼
 *                      entra no estoque  ─►  refeição realizada
 *                                               desconta do estoque
 *
 * Não toca no DOM. Gasto = soma do preço PAGO dos itens Comprados.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo;
  const AL = global.Alimentacao;

  // ---------------------------------------------------------------------
  // itens da lista
  // ---------------------------------------------------------------------
  function compra(d, id) { return d.compras.find((c) => c.id === id) || null; }
  function pendente(c) { return c.status === "Pendente"; }
  function valorPago(c) {
    if (c.status !== "Comprado") return 0;
    return N.temValor(c.precoPago) ? Number(c.precoPago) : (Number(c.precoEstimado) || 0);
  }
  function valorEstimado(c) { return Number(c.precoEstimado) || 0; }
  const ORDEM_PRIO = { "Alta": 0, "Normal": 1, "Baixa": 2 };
  function pendentes(d) {
    return d.compras.filter(pendente).sort((a, b) =>
      (ORDEM_PRIO[a.prioridade] - ORDEM_PRIO[b.prioridade]) || N.CATEGORIAS.indexOf(a.categoria) - N.CATEGORIAS.indexOf(b.categoria) || a.nome.localeCompare(b.nome, "pt-BR"));
  }
  function comprados(d, ini, fim) {
    return d.compras.filter((c) => c.status === "Comprado" && (!ini || N.entre(c.dataCompra, ini, fim)))
      .sort((a, b) => (b.dataCompra || "").localeCompare(a.dataCompra || ""));
  }
  function totalEstimadoPendente(d) { return N.soma(pendentes(d), valorEstimado); }
  function gastoNoPeriodo(d, ini, fim) { return N.soma(comprados(d, ini, fim), valorPago); }
  function gastoNoMes(d, mes) {
    mes = mes || N.hoje(0).slice(0, 7);
    return gastoNoPeriodo(d, mes + "-01", N.fimMes(mes + "-01"));
  }
  // economia = estimado − pago (só itens comprados com os dois valores)
  function economiaNoPeriodo(d, ini, fim) {
    return N.soma(comprados(d, ini, fim).filter((c) => N.temValor(c.precoEstimado) && N.temValor(c.precoPago)),
      (c) => Number(c.precoEstimado) - Number(c.precoPago));
  }
  function mesesComGasto(d) {
    const m = {};
    d.compras.forEach((c) => { if (valorPago(c) > 0 && c.dataCompra) m[N.mesDe(c.dataCompra)] = true; });
    return Object.keys(m).sort();
  }
  function mediaMensal(d) {
    const meses = mesesComGasto(d).filter((m) => m !== N.hoje(0).slice(0, 7));
    return meses.length ? N.media(meses.map((m) => gastoNoMes(d, m))) : null;
  }
  function agrupar(lista, campo, fn) {
    const m = {};
    lista.forEach((c) => { const k = c[campo] || "Outros"; m[k] = (m[k] || 0) + fn(c); });
    return Object.keys(m).map((k) => ({ nome: k, valor: m[k] })).filter((i) => i.valor > 0).sort((a, b) => b.valor - a.valor);
  }
  function gastoPorCategoria(d, ini, fim) { return agrupar(comprados(d, ini, fim), "categoria", valorPago); }
  function gastoPorMercado(d, ini, fim) { return agrupar(comprados(d, ini, fim), "mercado", valorPago); }
  function gastoPorProduto(d, ini, fim) { return agrupar(comprados(d, ini, fim), "nome", valorPago); }
  function serieMensal(d, meses) {
    const out = [];
    for (let i = (meses || 6) - 1; i >= 0; i--) {
      const ini = N.inicioMes(N.addMeses(N.inicioMes(), -i));
      const fim = N.fimMes(ini);
      const lista = d.compras.filter((c) => c.status === "Comprado" && N.entre(c.dataCompra, ini, fim));
      out.push({ mes: ini.slice(0, 7), rotulo: N.paraData(ini).toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        gasto: N.soma(lista, valorPago), estimado: N.soma(lista, valorEstimado) });
    }
    return out;
  }
  // histórico de preço por produto (preço unitário pago)
  function historicoPrecos(d) {
    const m = {};
    comprados(d).forEach((c) => {
      const k = c.alimentoId || ("nome:" + c.nome.toLowerCase());
      const unit = c.quantidade ? valorPago(c) / Number(c.quantidade) : null;
      if (!m[k]) m[k] = { nome: c.nome, categoria: c.categoria, unidade: c.unidade, vezes: 0, total: 0, precos: [], ultimaData: null, ultimoPreco: null };
      const r = m[k];
      r.vezes++; r.total += valorPago(c);
      if (unit != null && c.unidade === r.unidade) r.precos.push(unit);
      if (!r.ultimaData || c.dataCompra > r.ultimaData) { r.ultimaData = c.dataCompra; r.ultimoPreco = unit; }
    });
    return Object.keys(m).map((k) => Object.assign(m[k], {
      menor: m[k].precos.length ? Math.min.apply(null, m[k].precos) : null,
      maior: m[k].precos.length ? Math.max.apply(null, m[k].precos) : null
    })).sort((a, b) => b.total - a.total);
  }
  // quantas vezes cada alimento foi comprado num período
  function frequenciaCompras(d, ini, fim) {
    const m = {};
    comprados(d, ini, fim).forEach((c) => {
      const k = c.alimentoId || c.nome;
      m[k] = m[k] || { alimentoId: c.alimentoId, nome: c.nome, vezes: 0 };
      m[k].vezes++;
    });
    return Object.keys(m).map((k) => m[k]).sort((a, b) => b.vezes - a.vezes);
  }

  // preço estimado de uma quantidade (pelo cadastro do alimento)
  function estimarPreco(d, alimentoId, qtd, un) {
    const a = AL.alimento(d, alimentoId);
    const c = AL.custoDe(a, qtd, un);
    return c == null ? null : N.arred(c, 2);
  }

  // ---------------------------------------------------------------------
  // estoque
  // ---------------------------------------------------------------------
  function itemEstoque(d, id) { return d.estoque.find((e) => e.id === id) || null; }
  function estoqueDoAlimento(d, alimentoId) { return d.estoque.find((e) => e.alimentoId === alimentoId) || null; }
  // quantidade em estoque na unidade pedida (null se incompatível)
  function quantidadeEm(e, un) { return e ? N.converter(e.quantidade, e.unidade, un) : 0; }
  function abaixoDoMinimo(e) {
    return N.temValor(e.minimo) && Number(e.minimo) > 0 && Number(e.quantidade) < Number(e.minimo);
  }
  function estoqueBaixo(d) { return d.estoque.filter(abaixoDoMinimo); }
  function vencendo(d, dias) {
    const lim = N.hoje(dias || 7);
    return d.estoque.filter((e) => e.validade && e.validade <= lim && Number(e.quantidade) > 0)
      .sort((a, b) => a.validade.localeCompare(b.validade));
  }
  function valorDoEstoque(d) {
    return N.soma(d.estoque, (e) => AL.custoDe(AL.alimento(d, e.alimentoId), e.quantidade, e.unidade) || 0);
  }
  // soma (ou subtrai, com qtd negativa) no estoque do alimento; cria se precisar
  function movimentarEstoque(d, alimentoId, qtd, un, criarSeFaltar) {
    const a = AL.alimento(d, alimentoId);
    if (!a || !qtd) return null;
    let e = estoqueDoAlimento(d, alimentoId);
    if (!e) {
      if (!criarSeFaltar || qtd < 0) return null;
      e = { id: N.novoId(), alimentoId, quantidade: 0, unidade: N.compativeis(un, a.unidade) ? N.unidadeCompraPadrao(a.unidade) : un, minimo: null, validade: null, obs: "", atualizadoEm: N.hoje(0) };
      if (!N.compativeis(e.unidade, un)) e.unidade = un;
      d.estoque.push(e);
    }
    const conv = N.converter(qtd, un, e.unidade);
    if (conv == null) return null;
    const antes = Number(e.quantidade) || 0;
    e.quantidade = N.arred(Math.max(0, antes + conv), 3);
    e.atualizadoEm = N.hoje(0);
    return { estoqueId: e.id, qtd: e.quantidade - antes, unidade: e.unidade };
  }

  // compra marcada/desmarcada como Comprada → entra/sai do estoque
  function aoMudarStatusCompra(d, c, statusAnterior) {
    const integra = d.config.integracao.somarEstoqueAoComprar;
    if (c.status === "Comprado") {
      if (!c.dataCompra) c.dataCompra = N.hoje(0);
      if (!N.temValor(c.precoPago) && N.temValor(c.precoEstimado)) c.precoPago = Number(c.precoEstimado);
      c.auto = false;
      if (integra && c.alimentoId && !c.entradaEstoque) {
        const mov = movimentarEstoque(d, c.alimentoId, Number(c.quantidade) || 0, c.unidade, true);
        if (mov) c.entradaEstoque = mov;
      }
    } else if (statusAnterior === "Comprado" && c.entradaEstoque) {
      const e = itemEstoque(d, c.entradaEstoque.estoqueId);
      if (e) { e.quantidade = N.arred(Math.max(0, Number(e.quantidade) - Number(c.entradaEstoque.qtd)), 3); e.atualizadoEm = N.hoje(0); }
      delete c.entradaEstoque;
      if (c.status === "Pendente") { c.dataCompra = null; }
    }
  }

  // refeição marcada/desmarcada como Realizada → sai/volta do estoque
  function aoMudarStatusRefeicao(d, r) {
    if (r.status === "Realizada" && !r.baixas && d.config.integracao.baixarEstoqueAoComer) {
      const baixas = [];
      AL.itensDe(d, r.id).forEach((i) => {
        const e = estoqueDoAlimento(d, i.alimentoId);
        if (!e) return;
        const a = AL.alimento(d, i.alimentoId);
        const mov = movimentarEstoque(d, i.alimentoId, -(Number(i.quantidade) || 0), i.unidade || (a && a.unidade), false);
        if (mov && mov.qtd) baixas.push(mov);
      });
      r.baixas = baixas;
    } else if (r.status !== "Realizada" && r.baixas) {
      r.baixas.forEach((b) => {
        const e = itemEstoque(d, b.estoqueId);
        if (e) { e.quantidade = N.arred(Number(e.quantidade) - Number(b.qtd), 3); e.atualizadoEm = N.hoje(0); }
      });
      delete r.baixas;
    }
  }

  // ---------------------------------------------------------------------
  // necessidades: o que falta comprar para cumprir o planejamento e manter
  // o estoque mínimo. Tudo na unidade base do alimento.
  // ---------------------------------------------------------------------
  function necessidades(d, ini, fim) {
    ini = ini || N.hoje(0);
    fim = fim || N.hoje((d.config.integracao.diasPlanejamento || 7) - 1);
    const planejado = AL.consumoPlanejado(d, ini, fim);
    const proximos = AL.consumoPlanejado(d, N.hoje(0), N.hoje(1)); // hoje e amanhã: urgência
    const ids = {};
    Object.keys(planejado).forEach((k) => { ids[k] = true; });
    d.estoque.forEach((e) => { if (N.temValor(e.minimo) && Number(e.minimo) > 0) ids[e.alimentoId] = true; });
    const out = [];
    Object.keys(ids).forEach((id) => {
      const a = AL.alimento(d, id);
      if (!a) return;
      const e = estoqueDoAlimento(d, id);
      const emEstoque = e ? (N.converter(e.quantidade, e.unidade, a.unidade) || 0) : 0;
      const minimo = e && N.temValor(e.minimo) ? (N.converter(e.minimo, e.unidade, a.unidade) || 0) : 0;
      const plan = planejado[id] || 0;
      const naLista = N.soma(d.compras.filter((c) => pendente(c) && c.alimentoId === id && !c.auto), (c) => N.converter(c.quantidade, c.unidade, a.unidade) || 0);
      const falta = Math.max(0, plan + minimo - emEstoque);
      const faltaDescontada = Math.max(0, falta - naLista);
      out.push({ alimento: a, planejado: plan, emEstoque, minimo, naLista, falta, faltaComprar: faltaDescontada, temEstoque: !!e, urgente: (proximos[id] || 0) > emEstoque + naLista });
    });
    return out.sort((x, y) => (y.faltaComprar > 0) - (x.faltaComprar > 0) || x.alimento.nome.localeCompare(y.alimento.nome, "pt-BR"));
  }
  // converte a falta (unidade base) para a unidade de compra do alimento
  function quantidadeDeCompra(a, faltaBase) {
    const un = a.precoUnidade && N.compativeis(a.precoUnidade, a.unidade) ? a.precoUnidade : N.unidadeCompraPadrao(a.unidade);
    let q = N.converter(faltaBase, a.unidade, un);
    if (q == null) return { quantidade: N.arred(faltaBase, 2), unidade: a.unidade };
    // arredonda para uma quantidade que dá para comprar de verdade
    if (un === "kg" || un === "L") q = Math.max(0.5, Math.ceil(q * 2 - 1e-6) / 2);
    else if (un === "g" || un === "ml") q = Math.max(50, Math.ceil(q / 50 - 1e-6) * 50);
    else q = Math.max(1, Math.ceil(q - 1e-9));
    return { quantidade: q, unidade: un };
  }
  function motivoTexto(n) {
    const p = [];
    if (n.planejado > 0) p.push("planejado " + N.qtdLegivel(n.planejado, n.alimento.unidade));
    if (n.minimo > 0) p.push("mínimo " + N.qtdLegivel(n.minimo, n.alimento.unidade));
    p.push("em casa " + N.qtdLegivel(n.emEstoque, n.alimento.unidade));
    return p.join(" · ");
  }
  function novoItemDeNecessidade(d, n, auto) {
    const a = n.alimento;
    const q = quantidadeDeCompra(a, n.faltaComprar);
    return {
      id: N.novoId(), usuarioId: d.usuarios[0].id, alimentoId: a.id, nome: a.nome, categoria: a.categoria || "Outros",
      quantidade: q.quantidade, unidade: q.unidade, precoEstimado: estimarPreco(d, a.id, q.quantidade, q.unidade), precoPago: null,
      mercado: a.mercado || "Mercado", prioridade: n.urgente ? "Alta" : "Normal", status: "Pendente",
      dataCompra: null, dataPrevista: null, origem: n.planejado > 0 ? "planejamento" : "estoque", auto: !!auto,
      motivo: motivoTexto(n), criadoEm: N.hoje(0), obs: ""
    };
  }
  // adiciona à lista (manual) o que falta de um alimento
  function adicionarNecessidade(d, alimentoId, ini, fim) {
    const n = necessidades(d, ini, fim).find((x) => x.alimento.id === alimentoId);
    const a = AL.alimento(d, alimentoId);
    if (!a) return null;
    // remove o automático (se houver) — o manual passa a valer
    d.compras = d.compras.filter((c) => !(pendente(c) && c.auto && c.alimentoId === alimentoId));
    let item;
    if (n && n.faltaComprar > 0) item = novoItemDeNecessidade(d, n, false);
    else {
      const e = estoqueDoAlimento(d, alimentoId);
      const base = e && N.temValor(e.minimo) ? (N.converter(e.minimo, e.unidade, a.unidade) || a.porcao) : a.porcao;
      item = novoItemDeNecessidade(d, { alimento: a, planejado: 0, emEstoque: 0, minimo: base, falta: base, faltaComprar: base }, false);
      item.origem = "estoque";
    }
    d.compras.push(item);
    return item;
  }
  // mantém os itens automáticos da lista em dia com as necessidades
  function sincronizarAutomaticos(d) {
    if (!d.config || !d.config.integracao || !d.config.integracao.listaAutomatica) {
      return { criados: 0, removidos: 0 };
    }
    const nec = necessidades(d);
    let criados = 0, removidos = 0;
    const precisa = {};
    nec.forEach((n) => { if (n.faltaComprar > 0.0001) precisa[n.alimento.id] = n; });
    // atualiza ou remove os automáticos existentes
    d.compras = d.compras.filter((c) => {
      if (!(pendente(c) && c.auto)) return true;
      const n = precisa[c.alimentoId];
      if (!n) { removidos++; return false; }
      const novo = novoItemDeNecessidade(d, n, true);
      c.quantidade = novo.quantidade; c.unidade = novo.unidade; c.precoEstimado = novo.precoEstimado; c.motivo = novo.motivo;
      c.origem = novo.origem;
      if (c.prioridadeAuto !== false) c.prioridade = novo.prioridade;
      delete precisa[c.alimentoId];
      return true;
    });
    Object.keys(precisa).forEach((id) => { d.compras.push(novoItemDeNecessidade(d, precisa[id], true)); criados++; });
    return { criados, removidos };
  }

  // ---------------------------------------------------------------------
  // resumo (dashboard)
  // ---------------------------------------------------------------------
  function resumo(d) {
    const pend = pendentes(d);
    const mes = N.hoje(0).slice(0, 7);
    const ini = mes + "-01", fim = N.fimMes(ini);
    return {
      pendentes: pend.length,
      altaPrioridade: pend.filter((c) => c.prioridade === "Alta").length,
      totalEstimado: N.soma(pend, valorEstimado),
      gastoMes: gastoNoPeriodo(d, ini, fim),
      economiaMes: economiaNoPeriodo(d, ini, fim),
      estoqueBaixo: estoqueBaixo(d).length
    };
  }

  global.Compras = {
    compra, pendente, valorPago, valorEstimado, pendentes, comprados, totalEstimadoPendente,
    gastoNoPeriodo, gastoNoMes, economiaNoPeriodo, mesesComGasto, mediaMensal,
    gastoPorCategoria, gastoPorMercado, gastoPorProduto, serieMensal, historicoPrecos, frequenciaCompras, estimarPreco,
    itemEstoque, estoqueDoAlimento, quantidadeEm, abaixoDoMinimo, estoqueBaixo, vencendo, valorDoEstoque, movimentarEstoque,
    aoMudarStatusCompra, aoMudarStatusRefeicao,
    necessidades, quantidadeDeCompra, adicionarNecessidade, sincronizarAutomaticos, motivoTexto,
    resumo
  };
})(window);
