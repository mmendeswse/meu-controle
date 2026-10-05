/**
 * paginas/estoque.js — o que existe em casa, estoque mínimo, alertas e o
 * atalho para a lista de compras.
 */
(function () {
  "use strict";

  const N = window.Nucleo, UI = window.UI, AL = window.Alimentacao, C = window.Compras, App = window.App;
  const esc = UI.esc;
  const PASSO = { kg: 0.1, g: 100, L: 0.5, ml: 250, un: 1, dz: 1 };

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

  App.registrarPagina("estoque", {
    titulo: "Estoque",
    render(d) {
      const baixo = C.estoqueBaixo(d).length;
      const valor = C.valorDoEstoque(d);
      const venc = C.vencendo(d, 7).length;
      const integ = d.config.integracao;
      return `<div class="cabecalho-pagina"><div><h1>Estoque</h1><p class="sub">O que existe em casa agora</p></div>${UI.botao("novo-estoque", "Adicionar", { classe: "primario", icone: "mais" })}</div>
        <div class="kpi-row">
          ${UI.kpi({ rotulo: "Itens controlados", valor: String(d.estoque.length) })}
          ${UI.kpi({ rotulo: "Abaixo do mínimo", valor: String(baixo), sub: baixo ? "precisam de reposição" : "tudo em ordem" })}
          ${UI.kpi({ rotulo: "Valor estimado", valor: UI.brl(valor), dica: "Quantidade em casa × preço cadastrado de cada alimento (só os que têm preço)." })}
          ${UI.kpi({ rotulo: "Vencendo em 7 dias", valor: String(venc) })}
        </div>
        ${alertas(d)}
        <div class="grid"><div class="c12">${UI.card({ titulo: "Em casa", sub: `${integ.baixarEstoqueAoComer ? "refeições realizadas descontam do estoque" : "refeições não alteram o estoque"} · ${integ.somarEstoqueAoComprar ? "compras somam ao estoque" : "compras não alteram o estoque"}`,
          acoes: `<button class="btn pequeno" data-acao="ir" data-secao="configuracoes" data-param="integracao">integração</button>`, corpo: tabela(d) })}</div></div>`;
    }
  });

  App.registrarAcoes({
    "ajustar-estoque": (el) => {
      const d = App.dados();
      const e = C.itemEstoque(d, el.dataset.id);
      if (!e) return;
      e.quantidade = N.arred(Math.max(0, Number(e.quantidade) + Number(el.dataset.delta)), 3);
      e.atualizadoEm = N.hoje(0);
      App.salvar();
    }
  });
})();
