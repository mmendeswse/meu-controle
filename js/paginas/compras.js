/**
 * paginas/compras.js — lista de compras (marcar como comprado direto na
 * lista), gastos com alimentação e histórico de preços.
 */
(function () {
  "use strict";

  const N = window.Nucleo, UI = window.UI, AL = window.Alimentacao, C = window.Compras, G = window.Graficos, App = window.App;
  const esc = UI.esc;
  const st = App.estado.compras = { aba: "lista", status: "Pendente", cat: "", mercado: "", busca: "", mes: N.hoje(0).slice(0, 7) };

  // ------------------------------------------------------------------
  // LISTA
  // ------------------------------------------------------------------
  function filtrar(d) {
    const b = st.busca.trim().toLowerCase();
    let lista = st.status === "Pendente" ? C.pendentes(d) : d.compras.filter((c) => st.status === "todos" || c.status === st.status)
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
    const todas = d.compras;
    const itens = filtrar(d);
    const contagem = { Pendente: todas.filter((c) => c.status === "Pendente").length, Comprado: todas.filter((c) => c.status === "Comprado").length, Cancelado: todas.filter((c) => c.status === "Cancelado").length };
    const filtros = `<div class="filtros-linha">
      ${UI.abas([{ k: "Pendente", r: "Pendentes", n: contagem.Pendente }, { k: "Comprado", r: "Comprados", n: contagem.Comprado }, { k: "Cancelado", r: "Cancelados", n: contagem.Cancelado }, { k: "todos", r: "Todos" }], st.status, "status-lista")}
      <label class="busca">${UI.svg("buscar")}<input type="search" placeholder="Buscar" value="${esc(st.busca)}" data-digitar="busca-compra" aria-label="Buscar item"></label>
      <select class="sel" data-mudar="mercado-compra" aria-label="Filtrar por mercado">${UI.opcoes(N.MERCADOS.concat(todas.map((c) => c.mercado).filter((m) => m && N.MERCADOS.indexOf(m) === -1)).filter((v, i, a) => a.indexOf(v) === i), st.mercado, "Todos os mercados")}</select>
    </div>
    <div class="chips-filtro"><button class="${!st.cat ? "ativo" : ""}" data-acao="cat-compra" data-k="">Todas</button>${N.CATEGORIAS.map((c) => `<button class="${st.cat === c ? "ativo" : ""}" data-acao="cat-compra" data-k="${esc(c)}">${N.EMOJI_CATEGORIA[c]} ${esc(c)}</button>`).join("")}</div>`;
    let corpo;
    if (!todas.length) corpo = UI.vazio({ icone: "🛒", titulo: "Sua lista de compras está vazia.", texto: "Adicione itens aqui — ou planeje refeições e defina estoques mínimos: o que faltar entra sozinho na lista.", acao: "nova-compra", rotulo: "Adicionar item" });
    else if (!itens.length) corpo = `<div class="vazio"><p>${st.status === "Pendente" && !st.cat && !st.busca && !st.mercado ? "Nada pendente — lista em dia! 🎉" : "Nenhum item com esse filtro."}</p></div>`;
    else {
      const grupos = {};
      itens.forEach((c) => { (grupos[c.categoria || "Outros"] = grupos[c.categoria || "Outros"] || []).push(c); });
      corpo = N.CATEGORIAS.concat(Object.keys(grupos).filter((k) => N.CATEGORIAS.indexOf(k) === -1)).filter((k) => grupos[k]).map((k) => `<div class="grupo-compra">
        <div class="grupo-cab"><span>${N.EMOJI_CATEGORIA[k] || "📦"} ${esc(k)}</span><span class="dim">${grupos[k].length} · ${UI.brl(N.soma(grupos[k], (c) => c.status === "Comprado" ? C.valorPago(c) : C.valorEstimado(c)))}</span></div>
        ${grupos[k].map((c) => linhaItem(d, c)).join("")}</div>`).join("");
    }
    const total = N.soma(itens, (c) => c.status === "Comprado" ? C.valorPago(c) : c.status === "Pendente" ? C.valorEstimado(c) : 0);
    return UI.card({ titulo: "Lista de compras", sub: "toque no quadrado para marcar como comprado", acoes: UI.botao("nova-compra", "Item", { classe: "primario", icone: "mais" }),
      corpo: (todas.length ? filtros : "") + `<div class="lista-compras">${corpo}</div>`, rodape: itens.length ? `<span>Total ${st.status === "Comprado" ? "pago" : "desta lista"}</span><b>${UI.brl(total)}</b>` : "" });
  }
  function kpisLista(d) {
    const r = C.resumo(d);
    const pend = C.pendentes(d);
    return `<div class="kpi-row">
      ${UI.kpi({ rotulo: "Total estimado", valor: UI.brl(r.totalEstimado), sub: "itens pendentes", dica: "Soma do preço estimado dos itens pendentes." })}
      ${UI.kpi({ rotulo: "Total gasto no mês", valor: UI.brl(r.gastoMes), sub: UI.mesRotulo(N.hoje(0)), dica: "Soma do preço pago dos itens comprados neste mês." })}
      ${UI.kpi({ rotulo: "Economia no mês", valor: UI.brl(r.economiaMes), delta: r.economiaMes ? UI.deltaPill(r.economiaMes > 0 ? "abaixo do estimado" : "acima do estimado", r.economiaMes > 0) : "", dica: "Preço estimado − preço pago, nos itens comprados que têm os dois valores." })}
      ${UI.kpi({ rotulo: "Itens pendentes", valor: String(r.pendentes), sub: pend.filter((c) => c.auto).length ? pend.filter((c) => c.auto).length + " automáticos" : "" })}
      ${UI.kpi({ rotulo: "Alta prioridade", valor: String(r.altaPrioridade), sub: r.altaPrioridade ? pend.filter((c) => c.prioridade === "Alta").slice(0, 3).map((c) => esc(c.nome)).join(", ") : "nenhum" })}
    </div>`;
  }
  function lateralLista(d) {
    const pend = C.pendentes(d);
    const porMercado = {};
    pend.forEach((c) => { porMercado[c.mercado || "—"] = (porMercado[c.mercado || "—"] || 0) + C.valorEstimado(c); });
    const itens = Object.keys(porMercado).map((k) => ({ nome: k, valor: porMercado[k] })).sort((a, b) => b.valor - a.valor);
    const integ = d.config.integracao;
    return UI.card({ titulo: "Quanto vou gastar", sub: "pendentes por mercado", corpo: `<div class="pad">${UI.barList(itens, "var(--cy)")}</div>` }) +
      `<div class="espaco"></div>` +
      UI.card({ titulo: "Lista automática", dica: "O sistema soma o que está planejado nas refeições dos próximos dias e o estoque mínimo, desconta o que há em casa, e coloca o que faltar na lista (marcado como “auto”).",
        corpo: `<div class="pad texto-integ">${integ.listaAutomatica ? `<p><span class="up">● Ligada.</span> Considera as refeições planejadas dos próximos <b>${integ.diasPlanejamento}</b> dias e os estoques mínimos.</p>` : `<p><span class="dim">● Desligada.</span> Use “Compras para o planejado” em Refeições e os botões do Estoque para adicionar manualmente.</p>`}
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
    const meses = C.mesesComGasto(d).concat([N.hoje(0).slice(0, 7)]).filter((v, i, a) => a.indexOf(v) === i).sort().reverse();
    const metaGasto = window.Metas.metaDoTipo(d, "gastos");
    const varPct = N.variacaoPct(g, gAnt);
    const gr = "grid-template-columns:64px 1.5fr 110px 90px 100px";
    return `<div class="barra-ferramentas"><select class="sel" data-mudar="mes-gastos" aria-label="Mês">${meses.map((m) => `<option value="${m}"${m === mes ? " selected" : ""}>${UI.mesRotulo(m + "-01")}</option>`).join("")}</select></div>
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
      </div>`;
  }

  // ------------------------------------------------------------------
  // HISTÓRICO DE PREÇOS
  // ------------------------------------------------------------------
  function historico(d) {
    const h = C.historicoPrecos(d);
    const gr = "grid-template-columns:1.5fr 70px 110px 110px 110px 110px";
    return `<div class="grid"><div class="c12">${UI.card({ titulo: "Histórico de preços", sub: "por produto · preço unitário pago", corpo: h.length ? `<div class="tabela-scroll"><div class="hd" style="${gr}"><i>Produto</i><i class="r">Vezes</i><i class="r">Último</i><i class="r">Menor</i><i class="r">Maior</i><i class="r">Total gasto</i></div>` +
      h.map((x) => `<div class="rw" style="${gr}"><div><div class="nm">${esc(x.nome)}</div><div class="sub">${esc(x.categoria || "")} · última compra ${UI.dataCurta(x.ultimaData)}</div></div><div class="r">${x.vezes}</div>
        <div class="r big">${x.ultimoPreco == null ? "—" : UI.brl(x.ultimoPreco) + `<div class="sub">/${esc(x.unidade)}</div>`}</div><div class="r up">${x.menor == null ? "—" : UI.brl(x.menor)}</div><div class="r down">${x.maior == null ? "—" : UI.brl(x.maior)}</div><div class="r big">${UI.brl(x.total)}</div></div>`).join("") + `</div>`
      : UI.vazio({ icone: "🏷️", titulo: "Sem compras registradas ainda.", texto: "Quando você marcar itens como comprados, o histórico de preços aparece aqui." }) })}</div></div>`;
  }

  App.registrarPagina("compras", {
    titulo: "Compras",
    render(d) {
      const abas = UI.abas([{ k: "lista", r: "Lista" }, { k: "gastos", r: "Gastos" }, { k: "historico", r: "Histórico de preços" }], st.aba, "aba-compras");
      let corpo;
      if (st.aba === "gastos") corpo = gastos(d);
      else if (st.aba === "historico") corpo = historico(d);
      else corpo = kpisLista(d) + `<div class="grid"><div class="c8">${lista(d)}</div><div class="c4">${lateralLista(d)}</div></div>`;
      return `<div class="cabecalho-pagina"><div><h1>Compras</h1><p class="sub">Lista, gastos com alimentação e preços</p></div>${abas}</div>${corpo}`;
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
    "aba-compras": (el) => { st.aba = el.dataset.k; App.renderizar(); },
    "status-lista": (el) => { st.status = el.dataset.k; App.renderizar(); },
    "cat-compra": (el) => { st.cat = el.dataset.k; App.renderizar(); }
  });
  App.registrarMudancas({
    "mercado-compra": (el) => { st.mercado = el.value; App.renderizar(); },
    "mes-gastos": (el) => { st.mes = el.value; App.renderizar(); },
    "busca-compra": (el) => {
      st.busca = el.value;
      const pos = el.selectionStart;
      App.renderizar();
      const novo = document.querySelector('[data-digitar="busca-compra"]');
      if (novo) { novo.focus(); try { novo.setSelectionRange(pos, pos); } catch (e) { /* ignora */ } }
    }
  });
})();
