/**
 * paginas/refeicoes.js — planejador semanal (SEG → DOM), refeições
 * favoritas e o que falta comprar para cumprir o planejamento.
 *
 * Planejar = criar refeições "Planejadas" nas datas da semana. As mesmas
 * refeições aparecem no diário (Alimentação) e alimentam a lista de compras.
 */
(function () {
  "use strict";

  const N = window.Nucleo, UI = window.UI, AL = window.Alimentacao, C = window.Compras, App = window.App;
  const esc = UI.esc;
  const st = App.estado.refeicoes = { semana: N.inicioSemana() };

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
    return UI.card({ titulo: "Planejamento semanal", sub: "clique numa refeição para montar ou editar · os valores nutricionais são calculados sozinhos", acoes: nav, corpo: `<div class="planejador">${cols}</div>`, classe: "card-planejador" });
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
    if (ini > fim) return UI.card({ titulo: "Compras para esta semana", corpo: `<div class="vazio"><p>Semana já passou.</p></div>` });
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
      titulo: "Compras para o planejado", sub: `${UI.dataCurta(ini)} a ${UI.dataCurta(fim)} · planejado − estoque${auto ? " · lista automática ligada" : ""}`,
      dica: "Soma os alimentos das refeições planejadas, desconta o que há em casa (Estoque) e o estoque mínimo. Com a lista automática ligada (Configurações), o que faltar para os próximos dias entra sozinho na lista de compras.",
      acoes: faltando ? `<button class="btn pequeno primario" data-acao="add-necessidades" data-ini="${ini}" data-fim="${fim}">Adicionar ${faltando} à lista</button>` : "",
      corpo
    });
  }

  App.registrarPagina("refeicoes", {
    titulo: "Refeições",
    render(d) {
      return `<div class="cabecalho-pagina"><div><h1>Refeições</h1><p class="sub">Planeje a semana, use favoritas e veja o que precisa comprar</p></div></div>
        <div class="grid"><div class="c12">${planejador(d)}</div></div>
        <div class="grid"><div class="c7">${necessidades(d)}</div><div class="c5">${favoritas(d)}</div></div>`;
    }
  });

  App.registrarAcoes({
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
})();
