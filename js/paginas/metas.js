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
    { r: "Alimentação diária", modos: ["diaria"], teste: (t) => t.fonte !== "bemestar" },
    { r: "Bem-estar", modos: ["diaria"], teste: (t) => t.fonte === "bemestar" },
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

  // ------------------------------------------------------------------
  // CONQUISTAS
  // ------------------------------------------------------------------
  const CQ = window.Conquistas;
  function fmtCq(x, v) { return x.un ? UI.numAuto(v, x.casas) + " " + x.un : UI.numAuto(v, 0); }
  function abaConquistas(d) {
    // só as categorias das áreas ligadas
    const lista = CQ.visiveis(d), ok = lista.filter((x) => x.ok);
    const proximas = lista.filter((x) => !x.ok && x.atual > 0).sort((a, b) => b.pct - a.pct).slice(0, 3);
    const medalha = (x) => `<button class="cq${x.ok ? " ok" : ""}" ${x.ok ? `data-acao="conquista-compartilhar" data-id="${x.id}"` : "disabled"} title="${esc(x.s)}">
        <span class="cq-ic">${x.ic}</span><b>${esc(x.t)}</b><small>${esc(x.s)}</small>
        ${x.ok ? `<span class="cq-ok">✓ conquistada</span>` : `<span class="cq-prog">${UI.barra(x.pct, "var(--marca)", true)}<small>${fmtCq(x, Math.min(x.atual, x.alvo))} de ${fmtCq(x, x.alvo)}</small></span>`}
      </button>`;
    return `<div class="cq-topo card">
        <div class="ht-prog">${UI.gaugeSVG((ok.length / lista.length) * 100, "var(--marca)", 64)}<span>${ok.length}</span></div>
        <div class="ht-txt"><b>${ok.length} de ${lista.length} conquistas</b><small>Calculadas pelos seus registros. Toque numa conquistada para compartilhar com a família.</small></div>
      </div>
      ${proximas.length ? `<div class="sechead">QUASE LÁ</div><div class="cq-grade">${proximas.map(medalha).join("")}</div>` : ""}
      ${CQ.CATEGORIAS.filter((c) => lista.some((x) => x.cat === c)).map((c) => { const l = lista.filter((x) => x.cat === c); return `<div class="sechead">${c.toUpperCase()} <small>${l.filter((x) => x.ok).length}/${l.length}</small></div><div class="cq-grade">${l.map(medalha).join("")}</div>`; }).join("")}`;
  }

  // celebra conquistas novas depois de cada registro
  let filaCq = [];
  function mostrarProxima() {
    const x = filaCq.shift();
    if (!x) return;
    let el = document.getElementById("conquistaPop");
    if (!el) { el = document.createElement("div"); el.id = "conquistaPop"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); document.body.appendChild(el); }
    el.innerHTML = `<button data-acao="ir" data-secao="metas" data-param="conquistas"><span class="cp-ic">${x.ic}</span><span><small>Nova conquista!</small><b>${esc(x.t)}</b><em>${esc(x.s)}</em></span></button>`;
    el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
    const ap = App.dados().config.aparencia || {};
    if (ap.vibrar !== false && navigator.vibrate) { try { navigator.vibrate([30, 40, 30, 40, 60]); } catch (e) { /* sem suporte */ } }
    clearTimeout(mostrarProxima.t);
    mostrarProxima.t = setTimeout(() => { el.classList.remove("on"); setTimeout(mostrarProxima, 450); }, 4200);
  }
  App.aoSalvar((d, abertura) => {
    const lista = CQ.calcular(d);
    const vistas = d.config.conquistasVistas;
    if (!Array.isArray(vistas) || d.demo) {
      // primeira vez (ou dados de exemplo): só registra o que já existe, sem festa
      const antes = JSON.stringify(vistas);
      CQ.marcarVistas(d, lista);
      if (antes !== JSON.stringify(d.config.conquistasVistas)) window.Armazenamento.salvarDados(d, true, true);
      return;
    }
    const novas = CQ.novas(d, CQ.visiveis(d));
    if (!novas.length) return;
    CQ.marcarVistas(d, lista);
    window.Armazenamento.salvarDados(d, true, true);
    const cfg = d.config.alertas || {};
    if (cfg.conquistaNova === false) return;
    filaCq = filaCq.concat(novas);
    if (!abertura || novas.length) setTimeout(mostrarProxima, abertura ? 1200 : 500);
  });

  const ABAS_METAS = [{ k: "metas", r: "Metas" }, { k: "conquistas", r: "Conquistas" }];
  App.registrarAcoes({
    "aba-metas": (el) => App.ir("metas", el.dataset.k === "metas" ? null : el.dataset.k, { manterRolagem: true }),
    "conquista-compartilhar": (el) => {
      const x = CQ.calcular(App.dados()).find((c) => c.id === el.dataset.id);
      if (!x) return;
      const nome = (App.dados().usuarios[0].nome || "").split(" ")[0];
      const texto = `${x.ic} ${nome && nome !== "Eu" ? nome + " desbloqueou" : "Desbloqueei"} a conquista “${x.t}” no Meu Controle: ${x.s.charAt(0).toLowerCase() + x.s.slice(1)}!`;
      if (navigator.share) navigator.share({ text: texto }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(texto).then(() => UI.toast("Texto copiado — cole no WhatsApp da família."), () => UI.toast(texto));
      else UI.toast(texto);
    }
  });

  App.registrarPagina("metas", {
    titulo: "Metas",
    render(d, rota) {
      if (rota && rota.param === "conquistas") return `<div class="cabecalho-pagina"><div><h1>Conquistas</h1><p class="sub">Medalhas pelos seus registros e o quanto falta para as próximas</p></div>${UI.abas(ABAS_METAS, "conquistas", "aba-metas")}</div>${abaConquistas(d)}`;
      const av = M.avaliarTodas(d);
      const existentes = {};
      av.forEach((a) => { existentes[a.meta.tipo] = true; });
      const faltam = Object.keys(M.TIPOS).filter((k) => !existentes[k] && M.tipoVisivel(d, k));
      const resumo = { ok: av.filter((a) => a.status === "ok" || a.status === "atingida").length, atencao: av.filter((a) => a.status === "atencao").length, fora: av.filter((a) => a.status === "fora").length, semdados: av.filter((a) => a.status === "semdados").length };
      const secoes = GRUPOS.map((g) => {
        const lista = av.filter((a) => g.modos.indexOf(a.tipo.modo) !== -1 && (!g.teste || g.teste(a.tipo)));
        if (!lista.length) return "";
        return `<div class="sechead">${g.r.toUpperCase()}</div><div class="metas-grade">${lista.map(cartao).join("")}</div>`;
      }).join("");
      return `<div class="cabecalho-pagina"><div><h1>Metas</h1><p class="sub">Atual, objetivo, prazo e progresso — avaliados pela tendência dos seus registros</p></div><div class="cab-acoes">${UI.abas(ABAS_METAS, "metas", "aba-metas")}${UI.botao("nova-meta", "Nova meta", { classe: "primario", icone: "mais" })}</div></div>
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
