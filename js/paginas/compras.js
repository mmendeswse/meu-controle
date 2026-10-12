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
  const st = App.estado.compras = { status: "Pendente", cat: "", mercado: "", busca: "", mes: N.hoje(0).slice(0, 7) };
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
  function filtrar(d) {
    const b = st.busca.trim().toLowerCase();
    let lista = st.status === "Pendente" ? C.pendentes(d).filter((c) => C.mesDaCompra(c) === st.mes) : C.doMes(d, st.mes).filter((c) => st.status === "todos" || c.status === st.status)
      .sort((a, b2) => (b2.dataCompra || b2.criadoEm || "").localeCompare(a.dataCompra || a.criadoEm || ""));
    return lista.filter((c) => (!st.cat || c.categoria === st.cat) && (!st.mercado || c.mercado === st.mercado) && (!b || c.nome.toLowerCase().indexOf(b) !== -1));
  }
  function linhaItem(d, c) {
    const comprado = c.status === "Comprado", cancelado = c.status === "Cancelado";
    const a = c.alimentoId ? AL.alimento(d, c.alimentoId) : null;
    const tags = [];
    if (c.prioridade === "Alta" && c.status === "Pendente") tags.push(`<span class="tag tag-alta">alta</span>`);
    if (c.prioridade === "Baixa" && c.status === "Pendente") tags.push(`<span class="tag">baixa</span>`);
    if (c.auto && c.status === "Pendente") tags.push(`<span class="tag tag-auto" title="${esc(c.motivo || "")}">auto · ${c.origem === "planejamento" ? "planejamento" : "estoque"}</span>`);
    return `<div class="item-compra ${comprado ? "comprado" : ""} ${cancelado ? "cancelado" : ""}">
      <button class="chk-compra" data-acao="alternar-comprado" data-id="${c.id}" aria-label="${comprado ? "Desmarcar compra de " : "Marcar como comprado: "}${esc(c.nome)}" title="${comprado ? "Desmarcar" : "Marcar como comprado"}">${comprado ? "✓" : ""}</button>
      <button class="ic-corpo" data-acao="editar-compra" data-id="${c.id}">
        <span class="ic-nome">${AL.emojiAlimento(a || { categoria: c.categoria })} ${esc(c.nome)} ${tags.join("")}</span>
        <span class="ic-sub">${N.qtdLegivel(c.quantidade, c.unidade)}${c.mercado ? " · " + esc(c.mercado) : ""}${comprado && c.dataCompra ? " · " + UI.dataCurta(c.dataCompra) : ""}${c.auto && c.motivo ? ` · <span class="dim">${esc(c.motivo)}</span>` : ""}</span>
      </button>
      <span class="ic-precos">
        ${comprado ? `<b>${UI.brl(C.valorPago(c))}</b>${N.temValor(c.precoEstimado) && Math.abs(c.precoEstimado - C.valorPago(c)) >= 0.01 ? `<small class="${C.valorPago(c) <= c.precoEstimado ? "up" : "down"}">est. ${UI.brl(c.precoEstimado)}</small>` : ""}`
          : `<b>${N.temValor(c.precoEstimado) ? UI.brl(c.precoEstimado) : `<span class="dim">—</span>`}</b><small>estimado</small>`}
      </span>
      <span class="cel-botoes">${!comprado && !cancelado ? UI.botaoIcone("status-compra", "fechar", "Cancelar item", `data-id="${c.id}" data-status="Cancelado"`) : cancelado ? UI.botaoIcone("status-compra", "voltar", "Voltar para pendente", `data-id="${c.id}" data-status="Pendente"`) : ""}${UI.botaoIcone("excluir-compra", "excluir", "Excluir", `data-id="${c.id}"`, "perigo-txt")}</span>
    </div>`;
  }
  function lista(d) {
    const todas = C.doMes(d, st.mes);
    const itens = filtrar(d);
    const ant = C.mesAnterior(st.mes), doAnt = C.doMes(d, ant).filter((c) => c.status !== "Cancelado").length;
    const contagem = { Pendente: todas.filter((c) => c.status === "Pendente").length, Comprado: todas.filter((c) => c.status === "Comprado").length, Cancelado: todas.filter((c) => c.status === "Cancelado").length };
    const mercados = N.MERCADOS.concat(d.compras.map((c) => c.mercado).filter((m) => m && N.MERCADOS.indexOf(m) === -1)).filter((v, i, a) => a.indexOf(v) === i);
    const filtros = `<div class="filtros-linha">
      ${UI.abas([{ k: "Pendente", r: "Pendentes", n: contagem.Pendente }, { k: "Comprado", r: "Comprados", n: contagem.Comprado }, { k: "Cancelado", r: "Cancelados", n: contagem.Cancelado }, { k: "todos", r: "Todos" }], st.status, "status-lista")}
      <label class="busca">${UI.svg("buscar")}<input type="search" placeholder="Buscar" value="${esc(st.busca)}" data-digitar="busca-compra" aria-label="Buscar item"></label>
      <select class="sel" data-mudar="mercado-compra" aria-label="Filtrar por mercado">${UI.opcoes(mercados, st.mercado, "Todos os mercados")}</select>
    </div>
    <div class="chips-filtro"><button class="${!st.cat ? "ativo" : ""}" data-acao="cat-compra" data-k="">Todas</button>${N.CATEGORIAS.map((c) => `<button class="${st.cat === c ? "ativo" : ""}" data-acao="cat-compra" data-k="${esc(c)}">${N.EMOJI_CATEGORIA[c]} ${esc(c)}</button>`).join("")}</div>`;
    const copiar = doAnt ? `<button class="btn pequeno" data-acao="copiar-mes-compras" title="Repete os itens de ${nomeMes(ant)} como pendentes (sem duplicar)">${UI.svg("copiar")}Copiar ${nomeMes(ant)}</button>` : "";
    let corpo;
    if (!todas.length) corpo = UI.vazio({ icone: "🛒", titulo: `A lista de ${nomeMes(st.mes)} está vazia.`,
      texto: doAnt ? `Repita a lista de ${nomeMes(ant)} (${doAnt} ${UI.plural(doAnt, "item", "itens")}) ou adicione itens. Refeições planejadas e estoque mínimo também enchem a lista sozinhos.` : "Adicione itens — ou planeje refeições e defina estoques mínimos: o que faltar entra sozinho na lista.",
      acao: doAnt ? "copiar-mes-compras" : "nova-compra", rotulo: doAnt ? `Copiar lista de ${nomeMes(ant)}` : "Adicionar item", dados: doAnt ? "" : `data-mes="${st.mes}"` });
    else if (!itens.length) corpo = `<div class="vazio"><p>${st.status === "Pendente" && !st.cat && !st.busca && !st.mercado ? "Nada pendente — lista do mês em dia! 🎉" : "Nenhum item com esse filtro."}</p></div>`;
    else {
      const grupos = {};
      itens.forEach((c) => { (grupos[c.categoria || "Outros"] = grupos[c.categoria || "Outros"] || []).push(c); });
      corpo = N.CATEGORIAS.concat(Object.keys(grupos).filter((k) => N.CATEGORIAS.indexOf(k) === -1)).filter((k) => grupos[k]).map((k) => `<div class="grupo-compra">
        <div class="grupo-cab"><span>${N.EMOJI_CATEGORIA[k] || "📦"} ${esc(k)}</span><span class="dim">${grupos[k].length} · ${UI.brl(N.soma(grupos[k], (c) => c.status === "Comprado" ? C.valorPago(c) : C.valorEstimado(c)))}</span></div>
        ${grupos[k].map((c) => linhaItem(d, c)).join("")}</div>`).join("");
    }
    const previsto = N.soma(todas.filter((c) => c.status === "Pendente"), C.valorEstimado);
    const pago = N.soma(todas, C.valorPago);
    const feitos = contagem.Comprado, total = contagem.Pendente + contagem.Comprado;
    return UI.card({ titulo: `Lista de ${nomeMes(st.mes)}`, sub: total ? `${feitos} de ${total} comprados · toque no quadrado para marcar` : "toque no quadrado para marcar como comprado",
      acoes: copiar, corpo: (todas.length ? filtros : "") + `<div class="lista-compras">${corpo}</div>`,
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
  function lateralLista(d) {
    const pend = C.pendentes(d).filter((c) => C.mesDaCompra(c) === st.mes);
    const porMercado = {};
    pend.forEach((c) => { porMercado[c.mercado || "—"] = (porMercado[c.mercado || "—"] || 0) + C.valorEstimado(c); });
    const itens = Object.keys(porMercado).map((k) => ({ nome: k, valor: porMercado[k] })).sort((a, b) => b.valor - a.valor);
    const integ = d.config.integracao;
    return UI.card({ titulo: "Quanto vou gastar", sub: `pendentes de ${nomeMes(st.mes)} por mercado`, corpo: `<div class="pad">${UI.barList(itens, "var(--cy)")}</div>` }) +
      `<div class="espaco"></div>` +
      UI.card({ titulo: "Lista automática", dica: "O sistema soma o que está planejado nas refeições dos próximos dias e o estoque mínimo, desconta o que há em casa, e coloca o que faltar na lista (marcado como “auto”).",
        corpo: `<div class="pad texto-integ">${integ.listaAutomatica ? `<p><span class="up">● Ligada.</span> Considera as refeições planejadas dos próximos <b>${integ.diasPlanejamento}</b> dias e os estoques mínimos.</p>` : `<p><span class="dim">● Desligada.</span> Use “Compras para o cardápio” em Alimentação → Semana e os botões da aba Em casa.</p>`}
          <p>${integ.somarEstoqueAoComprar ? "Itens marcados como comprados <b>entram no estoque</b>." : "Itens comprados não alteram o estoque."}</p>
          <button class="btn pequeno" data-acao="ir" data-secao="configuracoes" data-param="integracao">Configurar</button></div>` });
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
      const corpo = aba === "gastos" ? gastos(d) : aba === "estoque" ? emCasa(d) : `${barraMes(d)}${atrasados(d)}<div class="grid"><div class="c8">${lista(d)}</div><div class="c4">${lateralLista(d)}</div></div>`;
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
      st.status = "Pendente";
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
