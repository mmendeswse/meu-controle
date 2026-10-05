/**
 * paginas/metas.js — metas com valor atual, objetivo, prazo, progresso e
 * status calculado pela tendência.
 */
(function () {
  "use strict";

  const N = window.Nucleo, UI = window.UI, M = window.Metas, App = window.App;
  const esc = UI.esc;
  const GRUPOS = [
    { r: "Corpo", modos: ["resultado"] },
    { r: "Treinos", modos: ["frequencia"] },
    { r: "Alimentação diária", modos: ["diaria"] },
    { r: "Orçamento", modos: ["limite", "limiteLista"] }
  ];

  function cartao(a) {
    const m = a.meta, t = a.tipo;
    const cor = a.status === "fora" ? "var(--down)" : a.status === "atencao" ? "var(--acc)" : a.status === "semdados" ? "var(--dim)" : "var(--up)";
    const prazo = m.prazo ? `${UI.dataBR(m.prazo)} <small class="${a.diasRestantes < 0 ? "down" : "dim"}">${a.diasRestantes < 0 ? "vencido" : a.diasRestantes === 0 ? "hoje" : "em " + a.diasRestantes + " " + UI.plural(a.diasRestantes, "dia", "dias")}</small>` : `<span class="dim">sem prazo</span>`;
    const titulo = m.titulo || (t.modo === "resultado" ? `Chegar a ${M.fmt(m.tipo, m.valorAlvo)}` : t.modo === "limite" || t.modo === "limiteLista" ? `${t.rotulo} até ${M.fmt(m.tipo, m.valorAlvo)}` : `${t.rotulo}: ${M.fmt(m.tipo, m.valorAlvo)}`);
    return `<article class="meta-card st-${M.STATUS[a.status].classe}">
      <header><span class="meta-ic">${t.icone}</span><div><small>${esc(t.rotulo)}</small><h3>${esc(titulo)}</h3></div>${UI.botaoIcone("editar-meta", "editar", "Editar meta", `data-id="${m.id}"`)}</header>
      <div class="meta-valores">
        ${t.modo === "resultado" && a.inicial != null ? `<div><small>Inicial</small><b>${M.fmt(m.tipo, a.inicial)}</b></div>` : ""}
        <div><small>Atual${t.modo === "diaria" ? " (média 7d)" : ""}</small><b>${a.atual == null ? "—" : M.fmt(m.tipo, a.atual)}</b></div>
        <div><small>${t.modo === "limite" || t.modo === "limiteLista" ? "Limite" : "Objetivo"}</small><b>${M.fmt(m.tipo, a.alvo)}</b></div>
        <div><small>Prazo</small><b>${prazo}</b></div>
      </div>
      <div class="meta-prog">${UI.barra(a.progresso || 0, cor)}<span><b>${a.progresso == null ? "—" : Math.round(a.progresso) + "%"}</b> ${t.modo === "limite" || t.modo === "limiteLista" ? "do limite usado" : "concluído"}</span></div>
      <div class="meta-status">${UI.statusMeta(a.status)}</div>
      <p class="meta-exp">${esc(a.explicacao)}${a.detalhe ? `<br><span class="dim">${esc(a.detalhe)}</span>` : ""}</p>
      ${t.modo === "diaria" && a.hoje != null ? `<p class="meta-hoje">Hoje até agora: <b>${M.fmt(m.tipo, a.hoje)}</b></p>` : ""}
    </article>`;
  }

  App.registrarPagina("metas", {
    titulo: "Metas",
    render(d) {
      const av = M.avaliarTodas(d);
      const existentes = {};
      av.forEach((a) => { existentes[a.meta.tipo] = true; });
      const faltam = Object.keys(M.TIPOS).filter((k) => !existentes[k]);
      const resumo = { ok: av.filter((a) => a.status === "ok" || a.status === "atingida").length, atencao: av.filter((a) => a.status === "atencao").length, fora: av.filter((a) => a.status === "fora").length, semdados: av.filter((a) => a.status === "semdados").length };
      const secoes = GRUPOS.map((g) => {
        const lista = av.filter((a) => g.modos.indexOf(a.tipo.modo) !== -1);
        if (!lista.length) return "";
        return `<div class="sechead">${g.r.toUpperCase()}</div><div class="metas-grade">${lista.map(cartao).join("")}</div>`;
      }).join("");
      return `<div class="cabecalho-pagina"><div><h1>Metas</h1><p class="sub">Atual, objetivo, prazo e progresso — avaliados pela tendência dos seus registros</p></div>${UI.botao("nova-meta", "Nova meta", { classe: "primario", icone: "mais" })}</div>
        ${av.length ? `<div class="kpi-row">
          ${UI.kpi({ rotulo: "🟢 No caminho certo", valor: String(resumo.ok) })}
          ${UI.kpi({ rotulo: "🟡 Atenção", valor: String(resumo.atencao) })}
          ${UI.kpi({ rotulo: "🔴 Fora da meta", valor: String(resumo.fora) })}
          ${UI.kpi({ rotulo: "⚪ Sem dados suficientes", valor: String(resumo.semdados) })}
        </div>` : ""}
        ${av.length ? secoes : `<div class="grid"><div class="c12">${UI.card({ titulo: "Metas", corpo: UI.vazio({ icone: "🎯", titulo: "Você ainda não criou nenhuma meta.", texto: "Exemplo: chegar a 75 kg até 15/12/2026, comer 160 g de proteína por dia, beber 3 L de água, treinar 4 vezes por semana.", acao: "nova-meta", rotulo: "Criar meta" }) })}</div></div>`}
        ${faltam.length ? `<div class="sechead">ADICIONAR</div><div class="chips-filtro">${faltam.map((k) => `<button data-acao="nova-meta" data-tipo="${k}">${M.TIPOS[k].icone} ${esc(M.TIPOS[k].rotulo)}</button>`).join("")}</div>` : ""}`;
    }
  });
})();
