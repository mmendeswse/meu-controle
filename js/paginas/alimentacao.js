/**
 * paginas/alimentacao.js — tudo de comida, em três abas na ordem de uso:
 *   Diário   — o que comeu hoje × metas (marcar ✓ entra nas calorias e baixa o estoque)
 *   Semana   — cardápio SEG → DOM, favoritas e o que falta comprar para cumpri-lo
 *   Alimentos — cadastro com nutrição e preço (a base de tudo)
 * A aba fica na rota (#/alimentacao/semana), então links e o "voltar" funcionam.
 */
(function () {
  "use strict";

  const N = window.Nucleo, UI = window.UI, AL = window.Alimentacao, C = window.Compras, G = window.Graficos, App = window.App;
  const esc = UI.esc;
  const st = App.estado.alimentacao = { data: N.hoje(0), semana: N.inicioSemana(), busca: "", cat: "" };
  const ABAS = [{ k: "diario", r: "Diário" }, { k: "semana", r: "Semana" }, { k: "alimentos", r: "Alimentos" }];

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

  function diario(d) {
    const data = st.data;
    return `<div class="barra-ferramentas">${UI.navData("dia-alimentacao", data, `<button class="btn pequeno ${data === N.hoje(0) ? "primario" : ""}" data-acao="dia-alimentacao" data-hoje="1">Hoje</button>`)}<span class="dim">${UI.dataLonga(data)}</span></div>
      <div class="grid">
        <div class="c5">${resumoDia(d, data)}</div>
        <div class="c7">${refeicoesDoDia(d, data)}</div>
      </div>`;
  }

  // ------------------------------------------------------------------
  // semana: cardápio, compras para o cardápio e favoritas
  // ------------------------------------------------------------------
  function slot(d, data, tipo) {
    const r = AL.refeicaoDoTipo(d, data, tipo);
    if (!r) return `<button class="slot vazio" data-acao="nova-refeicao" data-data="${data}" data-tipo="${tipo}" data-status="${data < N.hoje(0) ? "Realizada" : "Planejada"}" title="Planejar ${tipo.toLowerCase()}"><span class="slot-tipo">${N.TIPO_CURTO[tipo]}</span><span class="slot-mais">+</span></button>`;
    const itens = AL.itensDe(d, r.id);
    const nomes = itens.map((i) => { const a = AL.alimento(d, i.alimentoId); return a ? a.nome : ""; }).filter(Boolean);
    const n = AL.nutricaoRefeicao(d, r.id);
    return `<button class="slot ${r.status === "Realizada" ? "feito" : r.status === "Pulada" ? "pulado" : ""}" data-acao="editar-refeicao" data-id="${r.id}" title="${esc(nomes.join(", "))}">
      <span class="slot-tipo">${N.TIPO_CURTO[tipo]}${r.status === "Realizada" ? " ✓" : ""}</span>
      <span class="slot-itens">${esc(nomes.slice(0, 3).join(", "))}${nomes.length > 3 ? ` +${nomes.length - 3}` : ""}</span>
      <span class="slot-kcal">${n.kcal ? UI.numAuto(n.kcal, 0) + " kcal" : ""}</span>
    </button>`;
  }

  function planejador(d) {
    const ini = st.semana, hj = N.hoje(0);
    const meta = AL.metaDiaria(d, "kcal");
    const cols = N.intervalo(ini, N.addDias(ini, 6)).map((data) => {
      const plan = AL.planejadoDoDia(d, data);
      const temRef = AL.refeicoesNoDia(d, data).length > 0;
      const desvio = meta && plan.kcal ? (plan.kcal - meta) / meta : null;
      return `<div class="plan-dia ${data === hj ? "hoje" : ""} ${data < hj ? "passado" : ""}">
        <div class="plan-cab"><b>${N.DIA_CURTO[N.diaSemana(data)]}</b><span>${UI.dataCurta(data)}</span></div>
        ${N.TIPOS_REFEICAO.map((t) => slot(d, data, t)).join("")}
        <div class="plan-total ${desvio == null ? "" : Math.abs(desvio) <= 0.1 ? "ok" : "fora"}" title="${meta ? "Meta: " + UI.numAuto(meta, 0) + " kcal" : "Defina uma meta de calorias em Metas"}">
          <b>${plan.kcal ? UI.numAuto(plan.kcal, 0) : "—"}</b> kcal ${meta ? `<small>/ ${UI.numAuto(meta, 0)}</small>` : ""}
          <span class="plan-macros">P ${UI.numAuto(plan.proteina, 0)} · C ${UI.numAuto(plan.carbo, 0)} · G ${UI.numAuto(plan.gordura, 0)}</span>
        </div>
        <div class="plan-acoes">
          ${temRef ? `<button class="btn pequeno" data-acao="copiar-dia" data-data="${data}" title="Copiar este dia para outros">${UI.svg("copiar")}Copiar</button>
          <button class="btn pequeno fantasma perigo-txt" data-acao="limpar-dia" data-data="${data}" title="Apagar as refeições do dia">${UI.svg("lixo")}</button>` : `<span class="dim">vazio</span>`}
        </div>
      </div>`;
    }).join("");
    const fim = N.addDias(ini, 6);
    const nav = `<div class="nav-data"><button class="btn pequeno" data-acao="semana-ref" data-delta="-1" aria-label="Semana anterior">‹</button>
      <span class="nav-rotulo">${UI.dataCurta(ini)} – ${UI.dataCurta(fim)}</span>
      <button class="btn pequeno" data-acao="semana-ref" data-delta="1" aria-label="Próxima semana">›</button>
      <button class="btn pequeno ${ini === N.inicioSemana() ? "primario" : ""}" data-acao="semana-ref" data-hoje="1">Esta semana</button></div>`;
    return UI.card({ titulo: "Cardápio da semana", sub: "toque numa refeição para montar ou editar · nutrição calculada sozinha", acoes: nav, corpo: `<div class="planejador">${cols}</div>`, classe: "card-planejador" });
  }

  function favoritas(d) {
    const lista = d.favoritas.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const corpo = lista.length ? `<div class="favoritas">${lista.map((f) => {
      const n = AL.nutricaoFavorita(d, f);
      const itens = (f.itens || []).map((i) => { const a = AL.alimento(d, i.alimentoId); return a ? `${N.qtdLegivel(i.quantidade, i.unidade)} ${a.nome.toLowerCase()}` : ""; }).filter(Boolean);
      return `<article class="favorita">
        <header><b>⭐ ${esc(f.nome)}</b><span class="dim">${esc(f.tipo || "")}</span></header>
        <p>${esc(itens.join(" · "))}</p>
        <div class="fav-nutri"><span><b>${UI.numAuto(n.kcal, 0)}</b> kcal</span><span>P ${UI.numAuto(n.proteina, 0)}g</span><span>C ${UI.numAuto(n.carbo, 0)}g</span><span>G ${UI.numAuto(n.gordura, 0)}g</span><span>F ${UI.numAuto(n.fibra, 0)}g</span></div>
        <footer><button class="btn pequeno primario" data-acao="aplicar-favorita" data-id="${f.id}" data-data="${N.hoje(0) >= st.semana && N.hoje(0) <= N.addDias(st.semana, 6) ? N.hoje(0) : st.semana}">Usar</button>${UI.botaoIcone("editar-favorita", "editar", "Editar", `data-id="${f.id}"`)}</footer>
      </article>`;
    }).join("")}</div>` : UI.vazio({ icone: "⭐", titulo: "Nenhuma refeição favorita ainda.", texto: "Crie modelos como “Almoço padrão” (150 g arroz, 150 g frango, 100 g feijão, 100 g brócolis) e use com um clique.", acao: "nova-favorita", rotulo: "Criar favorita" });
    return UI.card({ titulo: "Refeições favoritas", sub: lista.length ? lista.length + " " + UI.plural(lista.length, "modelo", "modelos") : "", acoes: lista.length ? UI.botao("nova-favorita", "Favorita", { icone: "mais" }) : "", corpo });
  }

  function necessidades(d) {
    const hj = N.hoje(0);
    const ini = st.semana < hj ? hj : st.semana;
    const fim = N.addDias(st.semana, 6);
    if (ini > fim) return UI.card({ titulo: "Compras para o cardápio", corpo: `<div class="vazio"><p>Semana já passou.</p></div>` });
    const plan = AL.consumoPlanejado(d, ini, fim);
    const lista = C.necessidades(d, ini, fim).filter((n) => plan[n.alimento.id]);
    const auto = d.config.integracao.listaAutomatica;
    const corpo = !lista.length ? UI.vazio({ icone: "🧺", titulo: "Nada planejado a partir de hoje nesta semana.", texto: "Ao planejar refeições, o sistema confere o estoque e mostra aqui o que falta comprar." }) :
      `<div class="tabela-scroll"><div class="hd" style="grid-template-columns:1.4fr 100px 100px 120px"><i>Alimento</i><i class="r">Planejado</i><i class="r">Em casa</i><i class="r">Situação</i></div>` +
      lista.map((n) => {
        const pend = d.compras.filter((c) => c.status === "Pendente" && c.alimentoId === n.alimento.id);
        const un = n.alimento.unidade;
        let sit;
        if (n.falta <= 0.0001) sit = `<span class="up">✓ tem em casa</span>`;
        else if (pend.length) sit = `<span class="azul-txt">${UI.svg("carrinho", 'class="ic-inline"')} na lista</span>`;
        else sit = `<button class="btn pequeno perigo" data-acao="add-necessidade" data-alimento="${n.alimento.id}" data-ini="${ini}" data-fim="${fim}">faltam ${N.qtdLegivel(n.falta, un)} +</button>`;
        return `<div class="rw" style="grid-template-columns:1.4fr 100px 100px 120px"><div class="nm">${AL.emojiAlimento(n.alimento)} ${esc(n.alimento.nome)}</div>
          <div class="r">${N.qtdLegivel(n.planejado, un)}</div><div class="r ${n.emEstoque < n.planejado ? "down" : ""}">${n.temEstoque ? N.qtdLegivel(n.emEstoque, un) : `<span class="dim">sem controle</span>`}</div><div class="r">${sit}</div></div>`;
      }).join("") + `</div>`;
    const faltando = lista.filter((n) => n.faltaComprar > 0.0001 && !d.compras.some((c) => c.status === "Pendente" && c.alimentoId === n.alimento.id)).length;
    return UI.card({
      titulo: "Compras para o cardápio", sub: `${UI.dataCurta(ini)} a ${UI.dataCurta(fim)} · planejado − estoque${auto ? " · lista automática ligada" : ""}`,
      dica: "Soma os alimentos das refeições planejadas, desconta o que há em casa (Compras → Em casa) e o estoque mínimo. Com a lista automática ligada (Ajustes), o que faltar para os próximos dias entra sozinho na lista de compras.",
      acoes: faltando ? `<button class="btn pequeno primario" data-acao="add-necessidades" data-ini="${ini}" data-fim="${fim}">Adicionar ${faltando} à lista</button>` : "",
      corpo
    });
  }

  function semana(d) {
    return `<div class="grid"><div class="c12">${planejador(d)}</div></div>
      <div class="grid"><div class="c7">${necessidades(d)}</div><div class="c5">${favoritas(d)}</div></div>`;
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
    render(d, rota) {
      const aba = ABAS.some((x) => x.k === rota.param) ? rota.param : "diario";
      const corpo = aba === "semana" ? semana(d) : aba === "alimentos" ? `<div class="grid"><div class="c12">${alimentos(d)}</div></div>` : diario(d);
      return `<div class="cabecalho-pagina"><div><h1>Alimentação</h1><p class="sub">Diário de hoje, cardápio da semana e cadastro de alimentos</p></div>
        ${UI.abas(ABAS.map((x) => x.k === "alimentos" ? Object.assign({ n: d.alimentos.length }, x) : x), aba, "aba-alimentacao")}</div>${corpo}`;
    },
    depois(d) {
      if (document.getElementById("graf-macros")) {
        const c = AL.consumoDoDia(d, st.data);
        G.renderRosca("graf-macros", [{ nome: "Proteína", valor: c.proteina * 4, cor: G.CORES.cy }, { nome: "Carboidratos", valor: c.carbo * 4, cor: G.CORES.vi }, { nome: "Gorduras", valor: c.gordura * 9, cor: G.CORES.acc }], (v) => UI.numAuto(v, 0) + " kcal");
      }
    }
  });

  App.registrarAcoes({
    "aba-alimentacao": (el) => App.ir("alimentacao", el.dataset.k === "diario" ? null : el.dataset.k, { manterRolagem: true }),
    "dia-alimentacao": (el) => { st.data = el.dataset.hoje ? N.hoje(0) : N.addDias(st.data, Number(el.dataset.delta)); App.renderizar(); },
    "cat-alimento": (el) => { st.cat = el.dataset.k; App.renderizar(); },
    "semana-ref": (el) => { st.semana = el.dataset.hoje ? N.inicioSemana() : N.addDias(st.semana, 7 * Number(el.dataset.delta)); App.renderizar(); },
    "limpar-dia": (el) => {
      const d = App.dados(), data = el.dataset.data;
      const n = AL.refeicoesNoDia(d, data).length;
      UI.confirmar({ titulo: "Limpar dia", texto: `Apagar as ${n} ${UI.plural(n, "refeição", "refeições")} de ${UI.dataLonga(data)}?`, rotulo: "Apagar", aoConfirmar: () => App.comDesfazer("Dia limpo.", () => {
        AL.refeicoesNoDia(d, data).forEach((r) => { if (r.baixas) { r.status = "Planejada"; C.aoMudarStatusRefeicao(d, r); } });
        AL.excluirDia(d, data);
      }) });
    },
    "add-necessidades": (el) => {
      const d = App.dados();
      let n = 0;
      C.necessidades(d, el.dataset.ini, el.dataset.fim).forEach((x) => {
        if (x.faltaComprar > 0.0001 && !d.compras.some((c) => c.status === "Pendente" && c.alimentoId === x.alimento.id)) { C.adicionarNecessidade(d, x.alimento.id, el.dataset.ini, el.dataset.fim); n++; }
      });
      App.salvar(`${n} ${UI.plural(n, "item adicionado", "itens adicionados")} à lista de compras.`);
    }
  });
  App.registrarMudancas({
    "dia-alimentacao": (el) => { st.data = el.value || N.hoje(0); App.renderizar(); },
    "busca-alimento": (el) => { st.busca = el.value; const t = document.getElementById("tabelaAlimentos"); if (t) t.innerHTML = tabela(App.dados()); }
  });
})();
