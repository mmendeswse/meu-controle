/**
 * paginas/alimentacao.js — diário alimentar (resumo + refeições do dia) e
 * cadastro de alimentos com valores nutricionais.
 */
(function () {
  "use strict";

  const N = window.Nucleo, UI = window.UI, AL = window.Alimentacao, C = window.Compras, G = window.Graficos, App = window.App;
  const esc = UI.esc;
  const st = App.estado.alimentacao = { aba: "diario", data: N.hoje(0), busca: "", cat: "" };

  // ------------------------------------------------------------------
  // diário
  // ------------------------------------------------------------------
  function resumoDia(d, data) {
    const c = AL.consumoDoDia(d, data);
    const mt = AL.metasDiarias(d);
    const plan = AL.planejadoDoDia(d, data);
    const restante = mt.kcal ? mt.kcal - c.kcal : null;
    const corpo = `<div class="macros">
      ${UI.macro({ rotulo: "Calorias", atual: c.kcal, meta: mt.kcal, un: "kcal", tipoMeta: "calorias", limite: true, dica: "Soma das refeições marcadas como Realizadas neste dia." })}
      ${UI.macro({ rotulo: "Proteína", atual: c.proteina, meta: mt.proteina, un: "g", tipoMeta: "proteina", cor: "var(--cy)" })}
      ${UI.macro({ rotulo: "Carboidratos", atual: c.carbo, meta: mt.carbo, un: "g", tipoMeta: "carboidratos", cor: "var(--vi)", limite: true })}
      ${UI.macro({ rotulo: "Gorduras", atual: c.gordura, meta: mt.gordura, un: "g", tipoMeta: "gorduras", cor: "var(--acc)", limite: true })}
      ${UI.macro({ rotulo: "Fibras", atual: c.fibra, meta: mt.fibra, un: "g", tipoMeta: "fibras", cor: "var(--up)" })}
      ${UI.macro({ rotulo: "Água", atual: c.agua / 1000, meta: mt.agua ? mt.agua / 1000 : null, un: "L", tipoMeta: "agua", cor: "var(--azul)", fmt: (v) => UI.num(v, 1),
        extra: `<div class="agua-acoes"><button class="btn pequeno" data-acao="agua-rapida" data-data="${data}">+${d.config.copoAgua || 250} ml</button><button class="btn pequeno" data-acao="agua-rapida" data-ml="500" data-data="${data}">+500 ml</button><button class="btn pequeno" data-acao="agua" data-data="${data}">detalhes</button></div>` })}
    </div>`;
    const kcalMacros = c.proteina * 4 + c.carbo * 4 + c.gordura * 9;
    const dist = kcalMacros > 0 ? `<div class="dist-macros"><div class="donut-centro"><canvas id="graf-macros" width="118" height="118" style="width:118px;height:118px" aria-label="Distribuição de calorias por macronutriente"></canvas><div class="donut-rotulo"><b>${UI.numAuto(c.kcal, 0)}</b><span>KCAL</span></div></div>
      <div class="legenda">${[["Proteína", c.proteina * 4, "var(--cy)"], ["Carboidratos", c.carbo * 4, "var(--vi)"], ["Gorduras", c.gordura * 9, "var(--acc)"]].map((x) => `<div class="legenda-linha"><span class="legenda-nome"><span class="legenda-ponto" style="background:${x[2]}"></span>${x[0]}</span><span class="legenda-pct">${UI.pct((x[1] / kcalMacros) * 100)}</span></div>`).join("")}</div></div>` : "";
    const rodape = restante != null ? `<span>${restante >= 0 ? "Restam" : "Acima da meta"}</span><b class="${restante >= 0 ? "" : "down"}">${UI.numAuto(Math.abs(restante), 0)} kcal${plan.kcal > c.kcal ? ` <span class="dim">· planejado no dia: ${UI.numAuto(plan.kcal, 0)}</span>` : ""}</b>` : "";
    return UI.card({ titulo: "Resumo do dia", sub: UI.rotuloRelativo(data) + (c.incompleto ? " · alguns alimentos sem nutrição cadastrada" : ""), corpo: corpo + dist, rodape, pad: false });
  }

  function cartaoRefeicao(d, r) {
    const itens = AL.itensDe(d, r.id);
    const n = AL.nutricaoRefeicao(d, r.id);
    const custo = AL.custoRefeicao(d, r.id);
    const proximo = r.status === "Realizada" ? "Planejada" : "Realizada";
    return `<article class="refeicao ${r.status === "Realizada" ? "feita" : r.status === "Pulada" ? "pulada" : ""}">
      <header>
        <button class="ref-check" data-acao="status-refeicao" data-id="${r.id}" data-status="${proximo}" title="${r.status === "Realizada" ? "Desmarcar" : "Marcar como realizada"}" aria-label="${r.status === "Realizada" ? "Desmarcar refeição" : "Marcar refeição como realizada"}">${r.status === "Realizada" ? "✓" : ""}</button>
        <div class="ref-titulo"><b>${N.EMOJI_REFEICAO[r.tipo] || ""} ${esc(r.tipo)}</b><small>${r.horario ? esc(r.horario) + " · " : ""}${esc(r.status)}</small></div>
        <div class="ref-kcal"><b>${UI.numAuto(n.kcal, 0)}</b> kcal</div>
        <span class="ref-acoes">
          ${r.status !== "Pulada" && r.status !== "Realizada" ? UI.botaoIcone("status-refeicao", "fechar", "Marcar como pulada", `data-id="${r.id}" data-status="Pulada"`) : ""}
          ${UI.botaoIcone("salvar-favorita", "estrela", "Salvar como favorita", `data-id="${r.id}"`)}
          ${UI.botaoIcone("editar-refeicao", "editar", "Editar", `data-id="${r.id}"`)}
          ${UI.botaoIcone("excluir-refeicao", "excluir", "Excluir", `data-id="${r.id}"`, "perigo-txt")}
        </span>
      </header>
      <ul class="ref-itens">${itens.map((i) => {
        const a = AL.alimento(d, i.alimentoId);
        const ni = AL.nutricaoDe(a, i.quantidade, i.unidade);
        return `<li><span>${AL.emojiAlimento(a)} ${esc(a ? a.nome : "(alimento excluído)")}</span><span class="dim">${N.qtdLegivel(i.quantidade, i.unidade)}</span><span class="ref-item-kcal">${ni.incompleto ? `<span class="dim" title="Sem valores nutricionais">—</span>` : UI.numAuto(ni.kcal, 0) + " kcal"}</span></li>`;
      }).join("")}</ul>
      <footer><span>P <b>${UI.numAuto(n.proteina, 0)}</b>g</span><span>C <b>${UI.numAuto(n.carbo, 0)}</b>g</span><span>G <b>${UI.numAuto(n.gordura, 0)}</b>g</span><span>F <b>${UI.numAuto(n.fibra, 0)}</b>g</span>${custo.total > 0 ? `<span class="dim" title="${custo.completo ? "" : "Alguns alimentos sem preço"}">≈ ${UI.brl(custo.total)}</span>` : ""}</footer>
    </article>`;
  }

  function refeicoesDoDia(d, data) {
    const refs = AL.refeicoesNoDia(d, data);
    const blocos = N.TIPOS_REFEICAO.map((t) => {
      const doTipo = refs.filter((r) => r.tipo === t);
      if (doTipo.length) return doTipo.map((r) => cartaoRefeicao(d, r)).join("");
      return `<button class="refeicao-vazia" data-acao="nova-refeicao" data-data="${data}" data-tipo="${t}"><span>${N.EMOJI_REFEICAO[t]} ${t}</span><span class="dim">+ adicionar</span></button>`;
    }).join("");
    const favs = d.favoritas.slice(0, 6);
    return UI.card({
      titulo: "Refeições do dia", sub: "marque ✓ quando comer — entra nas calorias e baixa o estoque",
      acoes: `${UI.botao("nova-refeicao", "Refeição", { classe: "primario", icone: "mais", dados: `data-data="${data}"` })}${UI.botao("copiar-dia", "Copiar dia", { icone: "copiar", dados: `data-data="${data}"` })}`,
      corpo: `<div class="refeicoes">${blocos}</div>` + (favs.length ? `<div class="favs-rapidas"><span class="dim">Favoritas:</span>${favs.map((f) => `<button class="chip-btn" data-acao="aplicar-favorita" data-id="${f.id}" data-data="${data}">⭐ ${esc(f.nome)}</button>`).join("")}</div>` : "")
    });
  }

  function grafico7(d) {
    const dias = N.intervalo(N.hoje(-6), N.hoje(0));
    if (!AL.diasComRegistro(d, dias[0], dias[6]).length) return "";
    return `<div class="grid"><div class="c12">${UI.card({ titulo: "Calorias — últimos 7 dias", sub: "refeições realizadas", corpo: `<div class="grafico" style="height:200px"><canvas id="graf-kcal-7" aria-label="Calorias consumidas nos últimos 7 dias"></canvas></div>` })}</div></div>`;
  }

  function diario(d) {
    const data = st.data;
    return `<div class="barra-ferramentas">${UI.navData("dia-alimentacao", data, `<button class="btn pequeno ${data === N.hoje(0) ? "primario" : ""}" data-acao="dia-alimentacao" data-hoje="1">Hoje</button>`)}<span class="dim">${UI.dataLonga(data)}</span></div>
      <div class="grid">
        <div class="c5">${resumoDia(d, data)}</div>
        <div class="c7">${refeicoesDoDia(d, data)}</div>
      </div>${grafico7(d)}`;
  }

  // ------------------------------------------------------------------
  // cadastro de alimentos
  // ------------------------------------------------------------------
  function filtrados(d) {
    const b = st.busca.trim().toLowerCase();
    return AL.alimentosOrdenados(d).filter((a) => (!st.cat || a.categoria === st.cat) && (!b || a.nome.toLowerCase().indexOf(b) !== -1 || (a.marca || "").toLowerCase().indexOf(b) !== -1));
  }
  function tabela(d) {
    const lista = filtrados(d);
    if (!d.alimentos.length) return UI.vazio({ icone: "🥦", titulo: "Você ainda não cadastrou nenhum alimento.", texto: "Cadastre com calorias, macros e preço: eles são usados nas refeições, no estoque e na lista de compras.", acao: "novo-alimento", rotulo: "Adicionar alimento" });
    if (!lista.length) return `<div class="vazio"><p>Nenhum alimento encontrado com esse filtro.</p></div>`;
    const g = "grid-template-columns:minmax(170px,1.6fr) 90px 70px 60px 60px 60px 60px 100px 96px 72px";
    return `<div class="tabela-scroll"><div class="hd" style="${g}"><i>Alimento</i><i class="r">Porção</i><i class="r">kcal</i><i class="r">Prot.</i><i class="r">Carb.</i><i class="r">Gord.</i><i class="r">Fibra</i><i class="r">Preço</i><i class="r">Estoque</i><i></i></div>` +
      lista.map((a) => {
        const e = C.estoqueDoAlimento(d, a.id);
        const nz = (v) => N.temValor(v) ? UI.numAuto(v, 1) : `<span class="dim">—</span>`;
        return `<div class="rw clicavel" style="${g}" data-acao="editar-alimento" data-id="${a.id}">
          <div><div class="nm">${AL.emojiAlimento(a)} ${esc(a.nome)}</div><div class="sub">${esc(a.categoria)}${a.marca ? " · " + esc(a.marca) : ""}</div></div>
          <div class="r dim">${N.qtdLegivel(a.porcao, a.unidade)}</div>
          <div class="r big">${nz(a.kcal)}</div><div class="r">${nz(a.proteina)}</div><div class="r">${nz(a.carbo)}</div><div class="r">${nz(a.gordura)}</div><div class="r">${nz(a.fibra)}</div>
          <div class="r">${N.temValor(a.preco) ? UI.brl(a.preco) + `<div class="sub">/${a.precoQtd && a.precoQtd !== 1 ? UI.numAuto(a.precoQtd) + " " : ""}${esc(a.precoUnidade)}</div>` : `<span class="dim">—</span>`}</div>
          <div class="r">${e ? `<span class="${C.abaixoDoMinimo(e) ? "down" : ""}">${N.qtdLegivel(e.quantidade, e.unidade)}</span>` : `<span class="dim">—</span>`}</div>
          <div class="r">${UI.linhaAcoes("editar-alimento", "excluir-alimento", a.id)}</div>
        </div>`;
      }).join("") + `</div>`;
  }
  function alimentos(d) {
    const cats = N.CATEGORIAS.filter((c) => d.alimentos.some((a) => a.categoria === c));
    const semNutri = d.alimentos.filter((a) => !AL.temNutricao(a)).length;
    return UI.card({
      titulo: "Alimentos cadastrados", sub: `${d.alimentos.length} ${UI.plural(d.alimentos.length, "alimento", "alimentos")}${semNutri ? ` · ${semNutri} sem valores nutricionais` : ""}`,
      acoes: UI.botao("novo-alimento", "Alimento", { classe: "primario", icone: "mais" }),
      corpo: (d.alimentos.length ? `<div class="filtros-linha"><label class="busca">${UI.svg("buscar")}<input type="search" placeholder="Buscar alimento ou marca" value="${esc(st.busca)}" data-digitar="busca-alimento" aria-label="Buscar alimento"></label>
        <div class="chips-filtro"><button class="${!st.cat ? "ativo" : ""}" data-acao="cat-alimento" data-k="">Todos</button>${cats.map((c) => `<button class="${st.cat === c ? "ativo" : ""}" data-acao="cat-alimento" data-k="${esc(c)}">${N.EMOJI_CATEGORIA[c]} ${esc(c)}</button>`).join("")}</div></div>` : "") +
        `<div id="tabelaAlimentos">${tabela(d)}</div>`
    });
  }

  App.registrarPagina("alimentacao", {
    titulo: "Alimentação",
    render(d) {
      return `<div class="cabecalho-pagina"><div><h1>Alimentação</h1><p class="sub">O que você comeu, quanto falta para as metas e o cadastro dos seus alimentos</p></div>
        ${UI.abas([{ k: "diario", r: "Diário" }, { k: "alimentos", r: "Alimentos", n: d.alimentos.length }], st.aba, "aba-alimentacao")}</div>
        ${st.aba === "alimentos" ? `<div class="grid"><div class="c12">${alimentos(d)}</div></div>` : diario(d)}`;
    },
    depois(d) {
      if (document.getElementById("graf-macros")) {
        const c = AL.consumoDoDia(d, st.data);
        G.renderRosca("graf-macros", [{ nome: "Proteína", valor: c.proteina * 4, cor: G.CORES.cy }, { nome: "Carboidratos", valor: c.carbo * 4, cor: G.CORES.vi }, { nome: "Gorduras", valor: c.gordura * 9, cor: G.CORES.acc }], (v) => UI.numAuto(v, 0) + " kcal");
      }
      if (document.getElementById("graf-kcal-7")) {
        G.renderBarrasMeta("graf-kcal-7", N.intervalo(N.hoje(-6), N.hoje(0)).map((x) => ({ rotulo: N.DIA_CURTO[N.diaSemana(x)] + " " + x.slice(8, 10), valor: Math.round(AL.consumoDoDia(d, x).kcal) })), { meta: AL.metaDiaria(d, "kcal"), un: "kcal", rotulo: "Consumido" });
      }
    }
  });

  App.registrarAcoes({
    "aba-alimentacao": (el) => { st.aba = el.dataset.k; App.renderizar(); },
    "dia-alimentacao": (el) => { st.data = el.dataset.hoje ? N.hoje(0) : N.addDias(st.data, Number(el.dataset.delta)); App.renderizar(); },
    "cat-alimento": (el) => { st.cat = el.dataset.k; App.renderizar(); }
  });
  App.registrarMudancas({
    "dia-alimentacao": (el) => { st.data = el.value || N.hoje(0); App.renderizar(); },
    "busca-alimento": (el) => { st.busca = el.value; const t = document.getElementById("tabelaAlimentos"); if (t) t.innerHTML = tabela(App.dados()); }
  });
})();
