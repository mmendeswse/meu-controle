/**
 * alimentacao.js
 * -----------------------------------------------------------------------
 * Regras da parte "comer": cadastro de alimentos com nutrição, refeições
 * montadas com itens, água, refeições favoritas e planejamento semanal.
 *
 * Não toca no DOM. Tudo aqui é CALCULADO a partir dos registros:
 *   nutrição de um item = valores do alimento × (quantidade ÷ porção)
 *   nutrição da refeição = soma dos itens
 *   consumo do dia       = soma das refeições REALIZADAS
 *   metas diárias        = vêm das metas ativas (calorias, proteína…)
 *
 * Planejar uma refeição é simplesmente criá-la com status "Planejada" em
 * uma data futura — o planejador semanal e o diário usam os mesmos dados.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo;
  const CHAVES = ["kcal", "proteina", "carbo", "gordura", "fibra"];

  // ---------------------------------------------------------------------
  // alimentos
  // ---------------------------------------------------------------------
  function alimento(d, id) { return d.alimentos.find((a) => a.id === id) || null; }
  function alimentoPorNome(d, nome) {
    const k = String(nome || "").trim().toLowerCase();
    return k ? d.alimentos.find((a) => a.nome.trim().toLowerCase() === k) || null : null;
  }
  function alimentosOrdenados(d) {
    return d.alimentos.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }
  function emojiAlimento(a) { return (a && (a.emoji || N.EMOJI_CATEGORIA[a.categoria])) || "🍽️"; }
  function temNutricao(a) { return !!a && N.temValor(a.kcal); }
  function novoAlimento(dados) {
    const unidade = dados.unidade || "g";
    return Object.assign({
      id: N.novoId(), nome: "", emoji: "", categoria: "Outros", marca: "",
      porcao: unidade === "g" || unidade === "ml" ? 100 : 1, unidade,
      kcal: null, proteina: null, carbo: null, gordura: null, fibra: null,
      preco: null, precoQtd: 1, precoUnidade: N.unidadeCompraPadrao(unidade), mercado: "Mercado",
      obs: "", criadoEm: N.hoje(0)
    }, dados);
  }

  // nutrição de uma quantidade de um alimento → {kcal, proteina, …, incompleto}
  function nutricaoDe(a, qtd, un) {
    const r = { kcal: 0, proteina: 0, carbo: 0, gordura: 0, fibra: 0, incompleto: false };
    if (!a) { r.incompleto = true; return r; }
    const q = N.converter(qtd, un || a.unidade, a.unidade);
    if (q == null || !a.porcao) { r.incompleto = true; return r; }
    const f = q / Number(a.porcao);
    CHAVES.forEach((k) => {
      if (N.temValor(a[k])) r[k] = Number(a[k]) * f;
      else if (k === "kcal") r.incompleto = true;
    });
    return r;
  }
  function somarNutricao(lista) {
    const r = { kcal: 0, proteina: 0, carbo: 0, gordura: 0, fibra: 0, incompleto: false };
    lista.forEach((n) => { CHAVES.forEach((k) => { r[k] += n[k] || 0; }); if (n.incompleto) r.incompleto = true; });
    return r;
  }
  // custo de uma quantidade, a partir do preço cadastrado (null se não der)
  function custoDe(a, qtd, un) {
    if (!a || !N.temValor(a.preco) || !a.precoQtd) return null;
    const q = N.converter(qtd, un || a.unidade, a.precoUnidade);
    if (q == null) return null;
    return (q / Number(a.precoQtd)) * Number(a.preco);
  }

  // ---------------------------------------------------------------------
  // refeições
  // ---------------------------------------------------------------------
  function refeicao(d, id) { return d.refeicoes.find((r) => r.id === id) || null; }
  function itensDe(d, refeicaoId) { return d.refeicaoItens.filter((i) => i.refeicaoId === refeicaoId); }
  function nutricaoItem(d, i) { return nutricaoDe(alimento(d, i.alimentoId), i.quantidade, i.unidade); }
  function nutricaoRefeicao(d, refeicaoId) { return somarNutricao(itensDe(d, refeicaoId).map((i) => nutricaoItem(d, i))); }
  function custoRefeicao(d, refeicaoId) {
    let total = 0, completo = true;
    itensDe(d, refeicaoId).forEach((i) => {
      const c = custoDe(alimento(d, i.alimentoId), i.quantidade, i.unidade);
      if (c == null) completo = false; else total += c;
    });
    return { total, completo };
  }
  const ORDEM_TIPO = {};
  N.TIPOS_REFEICAO.forEach((t, k) => { ORDEM_TIPO[t] = k; });
  function ordenarRefeicoes(lista) {
    return lista.sort((a, b) => (a.data || "").localeCompare(b.data || "") || (ORDEM_TIPO[a.tipo] - ORDEM_TIPO[b.tipo]) || (a.horario || "").localeCompare(b.horario || ""));
  }
  function refeicoesNoDia(d, data) {
    return ordenarRefeicoes(d.refeicoes.filter((r) => r.data === data));
  }
  function refeicoesNoPeriodo(d, ini, fim) {
    return ordenarRefeicoes(d.refeicoes.filter((r) => N.entre(r.data, ini, fim)));
  }
  function refeicaoDoTipo(d, data, tipo) {
    return d.refeicoes.find((r) => r.data === data && r.tipo === tipo) || null;
  }

  // consumo (somente refeições REALIZADAS) de um dia
  function consumoDoDia(d, data) {
    const refs = refeicoesNoDia(d, data).filter((r) => r.status === "Realizada");
    const n = somarNutricao(refs.map((r) => nutricaoRefeicao(d, r.id)));
    n.refeicoes = refs.length;
    n.agua = aguaDoDia(d, data);
    return n;
  }
  // nutrição planejada (todas as refeições não puladas) de um dia
  function planejadoDoDia(d, data) {
    const refs = refeicoesNoDia(d, data).filter((r) => r.status !== "Pulada");
    return somarNutricao(refs.map((r) => nutricaoRefeicao(d, r.id)));
  }
  // dias com pelo menos uma refeição realizada
  function diasComRegistro(d, ini, fim) {
    const dias = {};
    d.refeicoes.forEach((r) => { if (r.status === "Realizada" && N.entre(r.data, ini, fim)) dias[r.data] = true; });
    return Object.keys(dias).sort();
  }
  // média diária de um nutriente nos dias com registro (null se não houver)
  function mediaNutriente(d, chave, ini, fim) {
    const dias = chave === "agua" ? diasComAgua(d, ini, fim) : diasComRegistro(d, ini, fim);
    if (!dias.length) return { media: null, dias: 0 };
    const v = dias.map((dia) => chave === "agua" ? aguaDoDia(d, dia) : consumoDoDia(d, dia)[chave]);
    return { media: N.media(v), dias: dias.length };
  }

  // ---------------------------------------------------------------------
  // água
  // ---------------------------------------------------------------------
  function aguaDoDia(d, data) { return N.soma(d.agua.filter((a) => a.data === data), (a) => a.ml); }
  function diasComAgua(d, ini, fim) {
    const dias = {};
    d.agua.forEach((a) => { if (N.entre(a.data, ini, fim) && a.ml > 0) dias[a.data] = true; });
    return Object.keys(dias).sort();
  }

  // ---------------------------------------------------------------------
  // metas diárias de nutrição (vêm das metas ativas do tipo correspondente)
  // ---------------------------------------------------------------------
  const META_DE = { kcal: "calorias", proteina: "proteina", carbo: "carboidratos", gordura: "gorduras", fibra: "fibras", agua: "agua" };
  function metaDiaria(d, chave) {
    const tipo = META_DE[chave];
    const m = d.metas.filter((x) => x.tipo === tipo && x.ativa !== false).sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""))[0];
    return m && N.temValor(m.valorAlvo) ? Number(m.valorAlvo) : null;
  }
  function metasDiarias(d) {
    const r = {};
    Object.keys(META_DE).forEach((k) => { r[k] = metaDiaria(d, k); });
    return r;
  }

  // ---------------------------------------------------------------------
  // favoritas
  // ---------------------------------------------------------------------
  function favorita(d, id) { return d.favoritas.find((f) => f.id === id) || null; }
  function nutricaoFavorita(d, f) {
    return somarNutricao((f.itens || []).map((i) => nutricaoDe(alimento(d, i.alimentoId), i.quantidade, i.unidade)));
  }
  // cria uma refeição (com itens) a partir de uma favorita
  function aplicarFavorita(d, favoritaId, data, tipo, status) {
    const f = favorita(d, favoritaId);
    if (!f) return null;
    const t = tipo || f.tipo || "Almoço";
    let r = refeicaoDoTipo(d, data, t);
    if (!r) {
      r = { id: N.novoId(), usuarioId: d.usuarios[0].id, data, tipo: t, horario: N.HORARIO_SUGERIDO[t] || "", status: status || "Planejada", favoritaId: f.id, obs: "" };
      d.refeicoes.push(r);
    } else {
      r.favoritaId = f.id;
    }
    (f.itens || []).forEach((i) => {
      d.refeicaoItens.push({ id: N.novoId(), refeicaoId: r.id, alimentoId: i.alimentoId, quantidade: Number(i.quantidade) || 0, unidade: i.unidade });
    });
    return r;
  }
  // salva uma refeição existente como favorita
  function favoritaDeRefeicao(d, refeicaoId, nome) {
    const r = refeicao(d, refeicaoId);
    if (!r) return null;
    const f = { id: N.novoId(), nome: nome || ((r.tipo || "Refeição") + " favorita"), tipo: r.tipo, obs: "",
      itens: itensDe(d, r.id).map((i) => ({ alimentoId: i.alimentoId, quantidade: i.quantidade, unidade: i.unidade })) };
    d.favoritas.push(f);
    return f;
  }

  // ---------------------------------------------------------------------
  // planejamento
  // ---------------------------------------------------------------------
  // copia as refeições (e itens) de um dia para outro, como Planejadas.
  // `substituir` apaga antes o que já existia no dia de destino.
  function copiarDia(d, deData, paraData, substituir) {
    if (deData === paraData) return 0;
    if (substituir) excluirDia(d, paraData);
    let n = 0;
    refeicoesNoDia(d, deData).forEach((r) => {
      const nova = Object.assign({}, r, { id: N.novoId(), data: paraData, status: "Planejada", baixas: undefined });
      delete nova.baixas;
      d.refeicoes.push(nova);
      itensDe(d, r.id).forEach((i) => d.refeicaoItens.push(Object.assign({}, i, { id: N.novoId(), refeicaoId: nova.id })));
      n++;
    });
    return n;
  }
  function excluirRefeicao(d, id) {
    d.refeicaoItens = d.refeicaoItens.filter((i) => i.refeicaoId !== id);
    d.refeicoes = d.refeicoes.filter((r) => r.id !== id);
  }
  function excluirDia(d, data) {
    refeicoesNoDia(d, data).forEach((r) => excluirRefeicao(d, r.id));
  }
  // quantidade planejada por alimento (unidade base do alimento) entre datas
  function consumoPlanejado(d, ini, fim) {
    const mapa = {};
    d.refeicoes.forEach((r) => {
      if (r.status !== "Planejada" || !N.entre(r.data, ini, fim)) return;
      itensDe(d, r.id).forEach((i) => {
        const a = alimento(d, i.alimentoId);
        if (!a) return;
        const q = N.converter(i.quantidade, i.unidade || a.unidade, a.unidade);
        if (q == null) return;
        mapa[a.id] = (mapa[a.id] || 0) + q;
      });
    });
    return mapa;
  }

  // ---------------------------------------------------------------------
  // resumo de hoje (alimenta o dashboard)
  // ---------------------------------------------------------------------
  function resumoHoje(d) {
    const hj = N.hoje(0);
    const refs = refeicoesNoDia(d, hj);
    return {
      consumo: consumoDoDia(d, hj),
      metas: metasDiarias(d),
      refeicoes: refs,
      realizadas: refs.filter((r) => r.status === "Realizada").length,
      total: refs.filter((r) => r.status !== "Pulada").length,
      proxima: refs.filter((r) => r.status === "Planejada" && (r.horario || "99:99") >= N.horaAgora())[0] || refs.filter((r) => r.status === "Planejada")[0] || null
    };
  }

  // gasto estimado com o que foi comido (usa os preços cadastrados)
  function custoConsumido(d, ini, fim) {
    let total = 0, refeicoesComCusto = 0;
    d.refeicoes.forEach((r) => {
      if (r.status !== "Realizada" || !N.entre(r.data, ini, fim)) return;
      const c = custoRefeicao(d, r.id);
      if (c.total > 0) { total += c.total; refeicoesComCusto++; }
    });
    return { total, refeicoes: refeicoesComCusto };
  }

  global.Alimentacao = {
    CHAVES,
    alimento, alimentoPorNome, alimentosOrdenados, emojiAlimento, temNutricao, novoAlimento,
    nutricaoDe, somarNutricao, custoDe,
    refeicao, itensDe, nutricaoItem, nutricaoRefeicao, custoRefeicao, refeicoesNoDia, refeicoesNoPeriodo, refeicaoDoTipo,
    consumoDoDia, planejadoDoDia, diasComRegistro, mediaNutriente,
    aguaDoDia, diasComAgua,
    metaDiaria, metasDiarias,
    favorita, nutricaoFavorita, aplicarFavorita, favoritaDeRefeicao,
    copiarDia, excluirRefeicao, excluirDia, consumoPlanejado,
    resumoHoje, custoConsumido
  };
})(window);
