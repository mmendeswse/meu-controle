/**
 * paginas/compras.js — o ciclo da comida em casa, em três abas:
 *   Lista   — a lista de compras do mês (marcar como comprado direto na lista)
 *   Em casa — estoque, mínimo, validade e alertas
 *   Gastos  — quanto gastou no mês, por categoria/mercado, e histórico de preços
 * A aba fica na rota (#/compras/estoque).
 */
(function () {
  "use strict";

  const N = window.Nucleo, UI = window.UI, AL = window.Alimentacao, C = window.Compras, G = window.Graficos, App = window.App;
  const esc = UI.esc;
  const st = App.estado.compras = { status: "todos", cat: "", mercado: "", busca: "", mes: N.hoje(0).slice(0, 7) };
  const ABAS = [{ k: "lista", r: "Lista" }, { k: "estoque", r: "Em casa" }, { k: "gastos", r: "Gastos" }];
  const PASSO = { kg: 0.1, g: 100, L: 0.5, ml: 250, un: 1, dz: 1 };
  const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const NOME_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  function nomeMes(mes) { return NOME_MES[Number(mes.slice(5, 7)) - 1]; }

  // barra do mês: ano + JAN…DEZ + Novo (usada na Lista e nos Gastos)
  function barraMes(d) {
    const ano = Number(st.mes.slice(0, 4)), atual = C.mesAtual();
    const anosDados = C.mesesComItens(d).map((m) => Number(m.slice(0, 4)));
    const anos = [];
    for (let a = Math.min(ano, Number(atual.slice(0, 4)) - 1, ...anosDados); a <= Math.max(ano, Number(atual.slice(0, 4)) + 1, ...anosDados); a++) anos.push(a);
    const comItens = {};
    d.compras.forEach((c) => { const m = C.mesDaCompra(c); if (c.status !== "Cancelado") comItens[m] = (comItens[m] || 0) + 1; });
    return `<div class="barra-mes">
      <select class="sel barra-ano" data-mudar="ano-compras" aria-label="Ano">${anos.map((a) => `<option value="${a}"${a === ano ? " selected" : ""}>${a}</option>`).join("")}</select>
      <div class="barra-meses" role="tablist" aria-label="Mês">${MESES.map((r, i) => {
        const m = ano + "-" + String(i + 1).padStart(2, "0");
        return `<button role="tab" aria-selected="${m === st.mes}" class="${m === st.mes ? "ativo" : ""}${m === atual ? " atual" : ""}${comItens[m] ? " tem" : ""}" data-acao="mes-compras" data-k="${m}" title="${nomeMes(m)} de ${ano}${comItens[m] ? " · " + comItens[m] + " " + UI.plural(comItens[m], "item", "itens") : ""}">${r}</button>`;
      }).join("")}</div>
      <button class="btn primario barra-novo" data-acao="nova-compra" data-mes="${st.mes}">${UI.svg("mais")}<span class="btn-txt">Novo</span></button>
    </div>`;
  }

  // ------------------------------------------------------------------
  // LISTA
  // ------------------------------------------------------------------
  // status de cada item da lista do mês, na ordem em que aparecem
  const STATUS = [
    { k: "Pendente", r: "Falta comprar", curto: "Falta", cls: "falta", ic: "🛒" },
    { k: "Tenho", r: "Já tenho", curto: "Tenho", cls: "tenho", ic: "🏠" },
    { k: "Comprado", r: "Comprado", curto: "Comprei", cls: "comprado", ic: "✓" }
  ];
  const ORDEM_ST = { Pendente: 0, Tenho: 1, Comprado: 2, Cancelado: 3 };
  function filtrar(d) {
    const b = st.busca.trim().toLowerCase();
    const prio = { Alta: 0, Normal: 1, Baixa: 2 };
    return C.doMes(d, st.mes)
      .filter((c) => (st.status === "todos" ? c.status !== "Cancelado" : c.status === st.status) && (!st.mercado || c.mercado === st.mercado) && (!b || c.nome.toLowerCase().indexOf(b) !== -1))
      .sort((x, y) => (ORDEM_ST[x.status] - ORDEM_ST[y.status]) || ((prio[x.prioridade] || 1) - (prio[y.prioridade] || 1)) || x.nome.localeCompare(y.nome, "pt-BR"));
  }
  const GR = "grid-template-columns:minmax(190px,1.6fr) 96px 262px minmax(90px,.8fr) 110px 64px";
  function linhaItem(d, c) {
    const a = c.alimentoId ? AL.alimento(d, c.alimentoId) : null;
    const tags = [];
    if (c.prioridade === "Alta" && c.status === "Pendente") tags.push(`<span class="tag tag-alta">alta</span>`);
    if (c.auto && c.status === "Pendente") tags.push(`<span class="tag tag-auto" title="${esc(c.motivo || "")}">auto</span>`);
    const e = a ? C.estoqueDoAlimento(d, a.id) : null;
    const sub = [esc(c.categoria || "Outros")];
    if (c.auto && c.motivo) sub.push(esc(c.motivo)); // o motivo já diz quanto há em casa
    else if (e) sub.push("em casa " + N.qtdLegivel(e.quantidade, e.unidade));
    if (c.status === "Comprado" && c.dataCompra) sub.push("comprado " + UI.dataCurta(c.dataCompra));
    const valor = c.status === "Comprado" ? `<b class="down">−${UI.brl(C.valorPago(c))}</b>`
      : c.status === "Tenho" ? `<span class="dim">—</span>`
      : N.temValor(c.precoEstimado) ? `<b>${UI.brl(c.precoEstimado)}</b><small>estimado</small>` : `<span class="dim">—</span>`;
    const seg = c.status === "Cancelado" ? `<span class="selo-tag selo-ruim">CANCELADO</span> ${UI.botaoIcone("status-compra", "voltar", "Voltar para a lista", `data-id="${c.id}" data-status="Pendente"`)}`
      : `<span class="seg-compra" role="group" aria-label="Situação de ${esc(c.nome)}">${STATUS.map((x) => `<button class="${x.cls}${c.status === x.k ? " ativo" : ""}" data-acao="status-compra" data-id="${c.id}" data-status="${x.k}" aria-pressed="${c.status === x.k}" title="${x.r}">${x.curto}</button>`).join("")}</span>`;
    return `<div class="rw linha-compra st-${(STATUS.find((x) => x.k === c.status) || { cls: "cancelado" }).cls}" style="${GR}">
      <button class="lc-nome" data-acao="editar-compra" data-id="${c.id}"><span class="nm">${AL.emojiAlimento(a || { categoria: c.categoria })} ${esc(c.nome)} ${tags.join("")}</span><span class="sub">${sub.join(" · ")}</span></button>
      <div class="r lc-qtd">${N.qtdLegivel(c.quantidade, c.unidade)}</div>
      <div class="lc-seg">${seg}</div>
      <div class="dim celula-texto lc-mercado">${esc(c.mercado || "—")}</div>
      <div class="r lc-valor">${valor}</div>
      <div class="r lc-botoes"><span class="cel-botoes">${UI.botaoIcone("editar-compra", "editar", "Editar", `data-id="${c.id}"`)}${UI.botaoIcone("excluir-compra", "excluir", "Excluir", `data-id="${c.id}"`, "perigo-txt")}</span></div>
    </div>`;
  }
  function lista(d) {
    const todas = C.doMes(d, st.mes);
    const itens = filtrar(d);
    const ant = C.mesAnterior(st.mes), doAnt = C.doMes(d, ant).filter((c) => c.status !== "Cancelado").length;
    const de = (k) => todas.filter((c) => c.status === k);
    const falta = de("Pendente"), tenho = de("Tenho"), comprado = de("Comprado"), cancelados = de("Cancelado");
    const previsto = N.soma(falta, C.valorEstimado), pago = N.soma(comprado, C.valorPago);
    const pilula = (k, cls, rot, n, valor) => `<button class="pilula-st ${cls}${st.status === k ? " ativo" : ""}" data-acao="status-lista" data-k="${st.status === k ? "todos" : k}" title="${st.status === k ? "Mostrar todos" : "Mostrar só " + rot.toLowerCase()}">
      <small>${rot}</small><b>${n}${valor != null ? ` · ${UI.brl(valor)}` : ""}</b></button>`;
    const pilulas = `<div class="pilulas-st">${pilula("Pendente", "falta", "Falta comprar", falta.length, previsto)}${pilula("Tenho", "tenho", "Já tenho", tenho.length)}${pilula("Comprado", "comprado", "Comprado", comprado.length, pago)}${cancelados.length ? pilula("Cancelado", "cancelado", "Cancelados", cancelados.length) : ""}</div>`;
    const mercados = N.MERCADOS.concat(d.compras.map((c) => c.mercado).filter((m) => m && N.MERCADOS.indexOf(m) === -1)).filter((v, i, a) => a.indexOf(v) === i);
    const filtros = `<div class="filtros-linha">${pilulas}
      <label class="busca">${UI.svg("buscar")}<input type="search" placeholder="Buscar" value="${esc(st.busca)}" data-digitar="busca-compra" aria-label="Buscar item"></label>
      <select class="sel" data-mudar="mercado-compra" aria-label="Filtrar por mercado">${UI.opcoes(mercados, st.mercado, "Todos os mercados")}</select></div>`;
    const copiar = doAnt ? `<button class="btn pequeno" data-acao="copiar-mes-compras" title="Repete os itens de ${nomeMes(ant)} como “falta comprar” (sem duplicar) — depois é só marcar o que já tem">${UI.svg("copiar")}Copiar ${nomeMes(ant)}</button>` : "";
    let corpo;
    if (!todas.length) corpo = UI.vazio({ icone: "🛒", titulo: `A lista de ${nomeMes(st.mes)} está vazia.`,
      texto: doAnt ? `Repita a lista de ${nomeMes(ant)} (${doAnt} ${UI.plural(doAnt, "item", "itens")}) e marque o que já tem em casa — o resto é o que falta comprar.` : "Liste tudo o que precisa no mês e marque o que já tem em casa: o resto é o que falta comprar.",
      acao: doAnt ? "copiar-mes-compras" : "nova-compra", rotulo: doAnt ? `Copiar lista de ${nomeMes(ant)}` : "Adicionar item", dados: doAnt ? "" : `data-mes="${st.mes}"` });
    else if (!itens.length) corpo = `<div class="vazio"><p>${st.status === "Pendente" && !st.busca && !st.mercado ? "Nada faltando — lista do mês completa! 🎉" : "Nenhum item com esse filtro."}</p></div>`;
    else {
      const grupos = {};
      itens.forEach((c) => { (grupos[c.categoria || "Outros"] = grupos[c.categoria || "Outros"] || []).push(c); });
      corpo = `<div class="tabela-scroll tabela-compras"><div class="hd" style="${GR}"><i>Item</i><i class="r">Quantidade</i><i>Situação</i><i>Mercado</i><i class="r">Valor</i><i></i></div>` +
        N.CATEGORIAS.concat(Object.keys(grupos).filter((k) => N.CATEGORIAS.indexOf(k) === -1)).filter((k) => grupos[k]).map((k) => {
          const g = grupos[k], f = g.filter((c) => c.status === "Pendente").length;
          return `<div class="grupo-cab"><span>${N.EMOJI_CATEGORIA[k] || "📦"} ${esc(k)}</span><span class="dim">${g.length} ${UI.plural(g.length, "item", "itens")}${f ? ` · <span class="acc-txt">${f} ${UI.plural(f, "falta", "faltam")}</span>` : " · ✓ completo"}</span></div>${g.map((c) => linhaItem(d, c)).join("")}`;
        }).join("") + `</div>`;
    }
    const total = falta.length + tenho.length + comprado.length;
    return UI.card({ titulo: `Lista de ${nomeMes(st.mes)}`, sub: total ? `${tenho.length + comprado.length} de ${total} garantidos · marque o que já tem e o que comprou` : "marque o que já tem e o que comprou",
      acoes: copiar, corpo: (todas.length ? filtros : "") + corpo,
      rodape: todas.length ? `<span>Falta comprar <b>${UI.brl(previsto)}</b></span><span>Já pago <b>${UI.brl(pago)}</b></span>` : "" });
  }
  // pendentes de meses anteriores: aviso com "trazer para este mês"
  function atrasados(d) {
    if (st.mes !== C.mesAtual()) return "";
    const lista = C.pendentesAtrasados(d, st.mes);
    if (!lista.length) return "";
    return `<div class="alerta-card aviso"><span class="ic">${UI.svg("aviso")}</span><div><b>${lista.length} ${UI.plural(lista.length, "item pendente", "itens pendentes")} de meses anteriores</b>
      <p>${esc(lista.slice(0, 5).map((c) => c.nome).join(", "))}${lista.length > 5 ? "…" : ""}</p></div>
      <button class="btn pequeno" data-acao="trazer-atrasados">Trazer para ${nomeMes(st.mes)}</button></div><div class="espaco"></div>`;
  }


  // ------------------------------------------------------------------
  // GASTOS
  // ------------------------------------------------------------------
  function gastos(d) {
    const mes = st.mes;
    const ini = mes + "-01", fim = N.fimMes(ini);
    const iniAnt = N.addMeses(ini, -1), fimAnt = N.fimMes(iniAnt);
    const g = C.gastoNoPeriodo(d, ini, fim), gAnt = C.gastoNoPeriodo(d, iniAnt, fimAnt);
    const media = C.mediaMensal(d);
    const eco = C.economiaNoPeriodo(d, ini, fim);
    const extrato = C.comprados(d, ini, fim);
    const maior = extrato.slice().sort((a, b) => C.valorPago(b) - C.valorPago(a))[0];
    const porCat = C.gastoPorCategoria(d, ini, fim);
    const metaGasto = window.Metas.metaDoTipo(d, "gastos");
    const varPct = N.variacaoPct(g, gAnt);
    const gr = "grid-template-columns:64px 1.5fr 110px 90px 100px";
    return `${barraMes(d)}
      <div class="kpi-row">
        ${UI.kpi({ rotulo: "Gasto no mês", valor: UI.brl(g), gauge: metaGasto ? (g / metaGasto.valorAlvo) * 100 : null, cor: metaGasto && g > metaGasto.valorAlvo ? "var(--down)" : "var(--cy)", delta: varPct != null ? UI.deltaPill(UI.sinal(varPct, 0, "%"), varPct <= 0) + ` <span class="dim">vs mês anterior</span>` : "", sub: metaGasto ? "limite: " + UI.brl(metaGasto.valorAlvo) : "" })}
        ${UI.kpi({ rotulo: "Mês anterior", valor: UI.brl(gAnt), sub: UI.mesRotulo(iniAnt) })}
        ${UI.kpi({ rotulo: "Média mensal", valor: media == null ? UI.SEM_DADOS : UI.brl(media), dica: "Média dos meses anteriores com compras registradas (não inclui o mês atual)." })}
        ${UI.kpi({ rotulo: "Economia", valor: UI.brl(eco), sub: "estimado − pago" })}
        ${UI.kpi({ rotulo: "Maior compra", valor: maior ? UI.brl(C.valorPago(maior)) : "—", sub: maior ? esc(maior.nome) + " · " + UI.dataCurta(maior.dataCompra) : "sem compras no mês" })}
      </div>
      <div class="grid">
        <div class="c8">${UI.card({ titulo: "Gasto por mês", sub: "pago × estimado · últimos 6 meses", corpo: C.mesesComGasto(d).length ? `<div class="grafico" style="height:240px"><canvas id="graf-gastos-mes" aria-label="Gasto por mês"></canvas></div>` : UI.vazio({ icone: "📊", titulo: "Sem dados suficientes", texto: "Marque itens como comprados para ver os gastos." }) })}</div>
        <div class="c4">${UI.card({ titulo: "Por categoria", sub: UI.mesRotulo(ini), corpo: porCat.length ? `<div class="donut-wrap"><div class="donut-centro"><canvas id="graf-gastos-cat" width="140" height="140" style="width:140px;height:140px" aria-label="Gastos por categoria"></canvas><div class="donut-rotulo"><b>${UI.brl(g).replace("R$", "").trim()}</b><span>TOTAL</span></div></div>
          <div class="legenda">${porCat.slice(0, 5).map((i, k) => `<div class="legenda-linha"><span class="legenda-nome"><span class="legenda-ponto" style="background:${G.PALETA_CATEGORIAS[Math.min(k, 4)]}"></span>${esc(i.nome)}</span><span class="legenda-pct">${UI.pct((i.valor / g) * 100)}</span><span class="legenda-val">${UI.brl(i.valor)}</span></div>`).join("")}${porCat.length > 5 ? `<div class="dim" style="font-size:11px">+ ${porCat.length - 5} em "Outros"</div>` : ""}</div></div>` : `<div class="vazio"><p>Sem gastos no mês.</p></div>` })}</div>
      </div>
      <div class="grid">
        <div class="c5">${UI.card({ titulo: "Por mercado", corpo: `<div class="pad">${UI.barList(C.gastoPorMercado(d, ini, fim), "var(--azul)")}</div>` })}</div>
        <div class="c7">${UI.card({ titulo: "Extrato", sub: `${extrato.length} ${UI.plural(extrato.length, "compra", "compras")}`, corpo: extrato.length ? `<div class="tabela-scroll"><div class="hd" style="${gr}"><i>Data</i><i>Item</i><i>Mercado</i><i class="r">Qtd</i><i class="r">Pago</i></div>` +
          extrato.map((c) => `<button class="rw clicavel" style="${gr}" data-acao="editar-compra" data-id="${c.id}"><div class="dim">${UI.dataCurta(c.dataCompra)}</div><div class="nm">${esc(c.nome)}</div><div class="dim">${esc(c.mercado || "—")}</div><div class="r dim">${N.qtdLegivel(c.quantidade, c.unidade)}</div><div class="r big">${UI.brl(C.valorPago(c))}</div></button>`).join("") + `</div>` : `<div class="vazio"><p>Nenhuma compra em ${UI.mesRotulo(ini)}.</p></div>`,
          rodape: `<span>Total do mês</span><b>${UI.brl(g)}</b>` })}</div>
      </div>${historico(d)}`;
  }

  // ------------------------------------------------------------------
  // HISTÓRICO DE PREÇOS
  // ------------------------------------------------------------------
  function historico(d) {
    const h = C.historicoPrecos(d);
    const gr = "grid-template-columns:1.5fr 70px 110px 110px 110px 110px";
    return `<div class="grid"><div class="c12">${UI.card({ titulo: "Histórico de preços", id: "sec-precos", sub: "por produto · preço unitário pago", corpo: h.length ? `<div class="tabela-scroll"><div class="hd" style="${gr}"><i>Produto</i><i class="r">Vezes</i><i class="r">Último</i><i class="r">Menor</i><i class="r">Maior</i><i class="r">Total gasto</i></div>` +
      h.map((x) => `<div class="rw" style="${gr}"><div><div class="nm">${esc(x.nome)}</div><div class="sub">${esc(x.categoria || "")} · última compra ${UI.dataCurta(x.ultimaData)}</div></div><div class="r">${x.vezes}</div>
        <div class="r big">${x.ultimoPreco == null ? "—" : UI.brl(x.ultimoPreco) + `<div class="sub">/${esc(x.unidade)}</div>`}</div><div class="r up">${x.menor == null ? "—" : UI.brl(x.menor)}</div><div class="r down">${x.maior == null ? "—" : UI.brl(x.maior)}</div><div class="r big">${UI.brl(x.total)}</div></div>`).join("") + `</div>`
      : UI.vazio({ icone: "🏷️", titulo: "Sem compras registradas ainda.", texto: "Quando você marcar itens como comprados, o histórico de preços aparece aqui." }) })}</div></div>`;
  }

  // ------------------------------------------------------------------
  // EM CASA (estoque)
  // ------------------------------------------------------------------
  function naLista(d, alimentoId) { return d.compras.some((c) => c.status === "Pendente" && c.alimentoId === alimentoId); }

  function alertas(d) {
    const baixo = C.estoqueBaixo(d);
    const venc = C.vencendo(d, 3);
    if (!baixo.length && !venc.length) return "";
    return `<div class="alertas-estoque">${baixo.map((e) => {
      const a = AL.alimento(d, e.alimentoId);
      if (!a) return "";
      return `<div class="alerta-card perigo"><span class="ic">${UI.svg("alerta")}</span><div><b>Estoque baixo</b><p>${esc(a.nome)} está abaixo da quantidade mínima (${N.qtdLegivel(e.quantidade, e.unidade)} de ${N.qtdLegivel(e.minimo, e.unidade)}).</p></div>
        ${naLista(d, a.id) ? `<span class="na-lista">${UI.svg("check")} na lista</span>` : `<button class="btn pequeno" data-acao="add-necessidade" data-alimento="${a.id}">+ Adicionar à lista de compras</button>`}</div>`;
    }).join("")}${venc.map((e) => {
      const a = AL.alimento(d, e.alimentoId);
      const dias = N.diasEntre(N.hoje(0), e.validade);
      return a ? `<div class="alerta-card aviso"><span class="ic">${UI.svg("aviso")}</span><div><b>Validade</b><p>${esc(a.nome)} ${dias < 0 ? "venceu em " + UI.dataCurta(e.validade) : dias === 0 ? "vence hoje" : "vence em " + dias + " " + UI.plural(dias, "dia", "dias")}.</p></div></div>` : "";
    }).join("")}</div>`;
  }

  function tabela(d) {
    const plan = AL.consumoPlanejado(d, N.hoje(0), N.hoje(6));
    const lista = d.estoque.map((e) => ({ e, a: AL.alimento(d, e.alimentoId) })).filter((x) => x.a)
      .sort((x, y) => (C.abaixoDoMinimo(y.e) - C.abaixoDoMinimo(x.e)) || x.a.nome.localeCompare(y.a.nome, "pt-BR"));
    if (!lista.length) return UI.vazio({ icone: "📦", titulo: "Você ainda não controla nenhum estoque.", texto: "Registre o que tem em casa e defina um mínimo: o sistema avisa quando estiver acabando, desconta o que você come e soma o que você compra.", acao: "novo-estoque", rotulo: "Adicionar ao estoque" });
    const gr = "grid-template-columns:minmax(150px,1.4fr) 150px 100px minmax(110px,1fr) 120px 96px 72px";
    return `<div class="tabela-scroll"><div class="hd" style="${gr}"><i>Alimento</i><i class="r">Quantidade</i><i class="r">Mínimo</i><i>Nível</i><i class="r">Planejado 7 dias ${UI.dica("Quanto as refeições planejadas para os próximos 7 dias vão consumir deste alimento.")}</i><i class="r">Validade</i><i></i></div>` +
      lista.map(({ e, a }) => {
        const baixo = C.abaixoDoMinimo(e);
        const min = N.temValor(e.minimo) ? Number(e.minimo) : 0;
        const nivel = min ? Math.min(100, (e.quantidade / (min * 2)) * 100) : null;
        const p = plan[a.id] ? N.converter(plan[a.id], a.unidade, e.unidade) : null;
        const falta = p != null && p > e.quantidade;
        const passo = PASSO[e.unidade] || 1;
        const venc = e.validade && e.validade <= N.hoje(3);
        return `<div class="rw ${baixo ? "linha-alerta" : ""}" style="${gr}">
          <div><div class="nm">${AL.emojiAlimento(a)} ${esc(a.nome)}</div><div class="sub">${esc(a.categoria)}${e.atualizadoEm ? " · atualizado " + UI.rotuloRelativo(e.atualizadoEm).toLowerCase() : ""}</div></div>
          <div class="r qtd-ajuste"><button class="btn fantasma" data-acao="ajustar-estoque" data-id="${e.id}" data-delta="${-passo}" aria-label="Diminuir">−</button><b class="${baixo ? "down" : ""}">${N.qtdLegivel(e.quantidade, e.unidade)}</b><button class="btn fantasma" data-acao="ajustar-estoque" data-id="${e.id}" data-delta="${passo}" aria-label="Aumentar">+</button></div>
          <div class="r dim">${min ? N.qtdLegivel(min, e.unidade) : "—"}</div>
          <div>${nivel == null ? `<span class="dim">sem mínimo</span>` : UI.barra(nivel, baixo ? "var(--down)" : nivel < 70 ? "var(--acc)" : "var(--up)", true)}</div>
          <div class="r ${falta ? "down" : ""}">${p ? N.qtdLegivel(p, e.unidade) + (falta ? " ⚠" : "") : `<span class="dim">—</span>`}</div>
          <div class="r ${venc ? "down" : "dim"}">${e.validade ? UI.dataCurta(e.validade) : "—"}</div>
          <div class="r"><span class="cel-botoes">${!naLista(d, a.id) ? UI.botaoIcone("add-necessidade", "carrinho", "Adicionar à lista de compras", `data-alimento="${a.id}"`) : `<span class="na-lista-ic" title="Já está na lista">${UI.svg("check")}</span>`}${UI.botaoIcone("editar-estoque", "editar", "Editar", `data-id="${e.id}"`)}</span></div>
        </div>`;
      }).join("") + `</div>`;
  }

  function emCasa(d) {
    const baixo = C.estoqueBaixo(d).length, venc = C.vencendo(d, 7).length, integ = d.config.integracao;
    const resumo = d.estoque.length ? `${d.estoque.length} ${UI.plural(d.estoque.length, "item", "itens")} · ${baixo ? `<span class="down">${baixo} abaixo do mínimo</span>` : "nada abaixo do mínimo"}${venc ? ` · ${venc} vencendo em 7 dias` : ""} · valor ≈ ${UI.brl(C.valorDoEstoque(d))}` : "";
    return `${alertas(d)}
      <div class="grid"><div class="c12">${UI.card({ titulo: "Em casa", sub: resumo || "o que existe em casa agora",
        dica: `${integ.baixarEstoqueAoComer ? "Refeições realizadas descontam do estoque." : "Refeições não alteram o estoque."} ${integ.somarEstoqueAoComprar ? "Itens comprados somam ao estoque." : "Compras não alteram o estoque."} O valor estimado usa o preço cadastrado de cada alimento.`,
        acoes: UI.botao("novo-estoque", "Item", { classe: "primario", icone: "mais" }), corpo: tabela(d) })}</div></div>`;
  }

  App.registrarPagina("compras", {
    titulo: "Compras",
    render(d, rota) {
      const aba = ABAS.some((x) => x.k === rota.param) ? rota.param : "lista";
      const pend = d.compras.filter((c) => c.status === "Pendente").length, baixo = C.estoqueBaixo(d).length;
      const abas = UI.abas(ABAS.map((x) => x.k === "lista" ? Object.assign({ n: pend }, x) : x.k === "estoque" && baixo ? Object.assign({ n: baixo }, x) : x), aba, "aba-compras");
      const corpo = aba === "gastos" ? gastos(d) : aba === "estoque" ? emCasa(d) : `${barraMes(d)}${atrasados(d)}<div class="grid"><div class="c12">${lista(d)}</div></div>`;
      return `<div class="cabecalho-pagina"><div><h1>Compras</h1><p class="sub">O que comprar, o que tem em casa e quanto gastou</p></div>${abas}</div>${corpo}`;
    },
    depois(d) {
      if (document.getElementById("graf-gastos-mes")) G.renderGastosMes("graf-gastos-mes", C.serieMensal(d, 6));
      if (document.getElementById("graf-gastos-cat")) {
        const ini = st.mes + "-01";
        const pc = C.gastoPorCategoria(d, ini, N.fimMes(ini));
        const top = pc.slice(0, 4);
        if (pc.length > 4) top.push({ nome: "Outros", valor: N.soma(pc.slice(4), (x) => x.valor) });
        G.renderRosca("graf-gastos-cat", top, UI.brl);
      }
    }
  });

  App.registrarAcoes({
    "aba-compras": (el) => App.ir("compras", el.dataset.k === "lista" ? null : el.dataset.k, { manterRolagem: true }),
    "ajustar-estoque": (el) => {
      const d = App.dados();
      const e = C.itemEstoque(d, el.dataset.id);
      if (!e) return;
      e.quantidade = N.arred(Math.max(0, Number(e.quantidade) + Number(el.dataset.delta)), 3);
      e.atualizadoEm = N.hoje(0);
      App.salvar();
    },
    "status-lista": (el) => { st.status = el.dataset.k; App.renderizar(); },
    "mes-compras": (el) => { st.mes = el.dataset.k; App.renderizar(); },
    "copiar-mes-compras": () => {
      const d = App.dados(), ant = C.mesAnterior(st.mes);
      const n = C.copiarMes(JSON.parse(JSON.stringify(d)), ant, st.mes); // conta antes, para a mensagem
      if (!n) { UI.toast(`Os itens de ${nomeMes(ant)} já estão nesta lista.`); return; }
      st.status = "todos";
      App.comDesfazer(`${n} ${UI.plural(n, "item copiado", "itens copiados")} de ${nomeMes(ant)}.`, () => C.copiarMes(d, ant, st.mes));
    },
    "trazer-atrasados": () => {
      const d = App.dados(), lista = C.pendentesAtrasados(d, st.mes);
      App.comDesfazer(`${lista.length} ${UI.plural(lista.length, "item trazido", "itens trazidos")} para ${nomeMes(st.mes)}.`, () => C.moverParaMes(d, lista, st.mes));
    },
    "cat-compra": (el) => { st.cat = el.dataset.k; App.renderizar(); }
  });
  App.registrarMudancas({
    "mercado-compra": (el) => { st.mercado = el.value; App.renderizar(); },
    "ano-compras": (el) => { st.mes = el.value + st.mes.slice(4); App.renderizar(); },
    "busca-compra": (el) => {
      st.busca = el.value;
      const pos = el.selectionStart;
      App.renderizar();
      const novo = document.querySelector('[data-digitar="busca-compra"]');
      if (novo) { novo.focus(); try { novo.setSelectionRange(pos, pos); } catch (e) { /* ignora */ } }
    }
  });
})();
