/**
 * ui.js
 * -----------------------------------------------------------------------
 * Componentes de interface reutilizados por todas as páginas: formatação,
 * cards, KPIs, barras de progresso, estados vazios, dicas (tooltips),
 * selos de status, abas, modal, confirmação e toast.
 *
 * Cada componente devolve uma string HTML. Cliques são tratados por
 * delegação no app.js através do atributo data-acao.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo;

  // ---------------------------------------------------------------------
  // formatação
  // ---------------------------------------------------------------------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function brl(v) { return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function num(v, casas) {
    if (v == null || isNaN(v)) return "—";
    const c = casas == null ? 1 : casas;
    return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
  }
  function numAuto(v, max) {
    if (v == null || isNaN(v)) return "—";
    return Number(v).toLocaleString("pt-BR", { maximumFractionDigits: max == null ? 1 : max });
  }
  function kg(v) { return v == null ? "—" : num(v, 1) + " kg"; }
  function litros(ml) { return ml == null ? "—" : num(ml / 1000, 1) + " L"; }
  function sinal(v, casas, un) {
    if (v == null || isNaN(v)) return "—";
    return (v > 0 ? "+" : v < 0 ? "−" : "") + num(Math.abs(v), casas == null ? 1 : casas) + (un ? " " + un : "");
  }
  function pct(v, casas) { return v == null ? "—" : num(v, casas == null ? 0 : casas) + "%"; }
  function dataBR(iso) { return iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "—"; }
  function dataCurta(iso) { return iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "—"; }
  function dataLonga(iso) { return N.NOMES_DIA[N.diaSemana(iso)] + ", " + dataCurta(iso); }
  function mesRotulo(iso) {
    const m = N.paraData(N.inicioMes(iso)).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return m.charAt(0).toUpperCase() + m.slice(1);
  }
  function rotuloRelativo(iso) {
    const d = N.diasEntre(N.hoje(0), iso);
    if (d === 0) return "Hoje";
    if (d === 1) return "Amanhã";
    if (d === -1) return "Ontem";
    if (d > 1 && d < 7) return "em " + d + " dias";
    if (d < -1 && d > -7) return "há " + -d + " dias";
    return dataBR(iso);
  }
  function plural(n, s, p) { return n === 1 ? s : p; }
  function opcoes(lista, atual, vazio) {
    return (vazio != null ? `<option value="">${esc(vazio)}</option>` : "") +
      lista.map((o) => {
        const v = typeof o === "object" ? o.v : o, r = typeof o === "object" ? o.r : o;
        return `<option value="${esc(v)}"${String(v) === String(atual) ? " selected" : ""}>${esc(r)}</option>`;
      }).join("");
  }

  // ---------------------------------------------------------------------
  // ícones (traço 1.6, 20×20)
  // ---------------------------------------------------------------------
  const ICONES = {
    mais: '<path d="M10 4v12M4 10h12"/>',
    editar: '<path d="M4 15.5V13l8.5-8.5a1.5 1.5 0 0 1 2 2L6 15H4v-2z"/>',
    excluir: '<path d="M4.5 5.5h11M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M6 5.5 6.6 15a1 1 0 0 0 1 1h4.8a1 1 0 0 0 1-1l.6-9.5"/>',
    voltar: '<path d="M12 15l-5-5 5-5"/>',
    avancar: '<path d="M8 5l5 5-5 5"/>',
    copiar: '<rect x="7" y="7" width="9" height="9" rx="1.5"/><path d="M4 13V5a1 1 0 0 1 1-1h8"/>',
    check: '<path d="M4.5 10.5l3.5 3.5 7.5-8"/>',
    estrela: '<path d="M10 3l2.1 4.4 4.9.6-3.6 3.4.9 4.8L10 13.9 5.7 16.2l.9-4.8L3 8l4.9-.6z"/>',
    carrinho: '<path d="M3 4h2l2 9h8l2-6H6"/><circle cx="8" cy="16" r="1.2"/><circle cx="14" cy="16" r="1.2"/>',
    play: '<path d="M7 5l8 5-8 5z"/>',
    info: '<circle cx="10" cy="10" r="7"/><path d="M10 9v4.5M10 6.5v.3"/>',
    alerta: '<path d="M10 3.5 17 16H3z"/><path d="M10 8v4M10 14.2v.3"/>',
    ok: '<circle cx="10" cy="10" r="6.5"/><path d="M7 10l2 2 4-4"/>',
    aviso: '<circle cx="10" cy="10" r="6.5"/><path d="M10 6.5v4M10 13.2v.3"/>',
    agua: '<path d="M10 3c3 4 5 6.5 5 9a5 5 0 0 1-10 0c0-2.5 2-5 5-9z"/>',
    download: '<path d="M10 3v9M6 8.5l4 4 4-4M4 16h12"/>',
    upload: '<path d="M10 13V4M6 7.5l4-4 4 4M4 16h12"/>',
    lixo: '<path d="M4.5 5.5h11M8 5.5V4h4v1.5M6 5.5 6.6 16h6.8l.6-10.5"/>',
    buscar: '<circle cx="9" cy="9" r="5"/><path d="M13 13l4 4"/>',
    calendario: '<rect x="3" y="4" width="14" height="13" rx="1.5"/><path d="M3 8h14M7 2.5v3M13 2.5v3"/>',
    fechar: '<path d="M5 5l10 10M15 5L5 15"/>'
  };
  function svg(nome, extra) {
    const p = ICONES[nome] || nome;
    return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"${extra ? " " + extra : ""}>${p}</svg>`;
  }

  // ---------------------------------------------------------------------
  // dica (tooltip) — funciona com mouse (hover) e toque (foco)
  // ---------------------------------------------------------------------
  function dica(texto) {
    if (!texto) return "";
    return `<span class="dica" tabindex="0" role="note" aria-label="${esc(texto)}" data-dica="${esc(texto)}">?</span>`;
  }

  // ---------------------------------------------------------------------
  // blocos
  // ---------------------------------------------------------------------
  function card(o) {
    return `<section class="card ${o.classe || ""}"${o.id ? ` id="${o.id}"` : ""}>
      ${o.titulo != null ? `<header><div><h2>${o.titulo}${o.dica ? " " + dica(o.dica) : ""}</h2>${o.sub ? `<div class="sub">${o.sub}</div>` : ""}</div>
      ${o.acoes ? `<div class="acoes">${o.acoes}</div>` : ""}</header>` : ""}
      <div class="body${o.pad ? " pad" : ""}">${o.corpo || ""}</div>
      ${o.rodape ? `<div class="foot">${o.rodape}</div>` : ""}
    </section>`;
  }
  function gaugeSVG(percentual, cor, t) {
    t = t || 56;
    const r = t / 2 - 5, c = 2 * Math.PI * r;
    const p = N.limitar(percentual || 0, 0, 100);
    return `<svg viewBox="0 0 ${t} ${t}"><circle class="gauge-fundo" cx="${t / 2}" cy="${t / 2}" r="${r}" stroke-width="6"></circle>
      <circle class="gauge-valor" cx="${t / 2}" cy="${t / 2}" r="${r}" stroke-width="6" stroke="${cor}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c - c * p / 100).toFixed(1)}"></circle></svg>`;
  }
  function kpi(o) {
    const gauge = o.gauge == null ? "" : `<div class="kpi-gauge">${gaugeSVG(o.gauge, o.cor || "var(--cy)")}<span class="kpi-gauge-txt">${Math.round(N.limitar(o.gauge, 0, 999))}%</span></div>`;
    const tag = o.rota ? "button" : "div";
    return `<${tag} class="kpi${o.rota ? " clicavel" : ""}"${o.rota ? ` data-acao="ir" data-secao="${o.rota}"` : ""}>
      <div class="kpi-rotulo">${o.rotulo}${o.dica ? " " + dica(o.dica) : ""}</div>
      <div class="kpi-corpo">${gauge}<div class="kpi-info">
        <div class="kpi-valor">${o.valor}</div>
        ${o.delta ? `<div class="kpi-delta">${o.delta}</div>` : ""}
        ${o.sub ? `<div class="kpi-sub">${o.sub}</div>` : ""}
      </div></div></${tag}>`;
  }
  // pílula de variação: verde se "bom", vermelho se "ruim", neutra se indefinido
  function deltaPill(texto, bom) {
    const cls = bom === true ? "up" : bom === false ? "down" : "neutro";
    return `<b class="${cls}">${texto}</b>`;
  }
  // mini-estatística (dentro dos painéis agrupados do dashboard)
  function mini(o) {
    const tag = o.rota ? "button" : "div";
    return `<${tag} class="mini${o.rota ? " clicavel" : ""}"${o.rota ? ` data-acao="ir" data-secao="${o.rota}"` : ""}>
      <span class="mini-rotulo">${o.rotulo}${o.dica ? " " + dica(o.dica) : ""}</span>
      <span class="mini-valor"${o.cor ? ` style="color:${o.cor}"` : ""}>${o.valor}</span>
      ${o.barra != null ? barra(o.barra, o.corBarra || "var(--cy)", true) : ""}
      ${o.sub ? `<span class="mini-sub">${o.sub}</span>` : ""}
    </${tag}>`;
  }
  function barra(p, cor, fina) {
    return `<span class="progresso${fina ? " fina" : ""}"><i style="width:${N.limitar(p || 0, 0, 100).toFixed(1)}%;background:${cor || "var(--cy)"}"></i></span>`;
  }
  // barra de macro "CALORIAS 1.850 / 2.200 kcal"
  function macro(o) {
    const temMeta = o.meta != null && o.meta > 0;
    const p = temMeta ? (o.atual / o.meta) * 100 : 0;
    let cor = o.cor || "var(--cy)";
    if (temMeta && o.limite && p > 110) cor = "var(--down)";
    else if (temMeta && p >= 100) cor = "var(--up)";
    const fmt = o.fmt || ((v) => numAuto(v, 0));
    return `<div class="macro">
      <div class="macro-topo"><span class="macro-rotulo">${o.rotulo}${o.dica ? " " + dica(o.dica) : ""}</span>
        <span class="macro-valor"><b>${fmt(o.atual)}</b>${temMeta ? ` <span class="dim">/ ${fmt(o.meta)} ${o.un}</span>` : ` <span class="dim">${o.un}</span>`}</span></div>
      ${temMeta ? barra(p, cor) : `<span class="macro-semmeta">sem meta — <button class="link-acao" data-acao="nova-meta" data-tipo="${o.tipoMeta || ""}">definir</button></span>`}
      ${o.extra || ""}
    </div>`;
  }
  // lista de barras horizontais: itens [{nome, valor}]
  function barList(itens, cor, fmt) {
    fmt = fmt || brl;
    if (!itens.length) return `<div class="vazio"><p>Sem dados no período.</p></div>`;
    const max = Math.max.apply(null, itens.map((i) => Math.abs(i.valor))) || 1;
    return `<div class="barlist">` + itens.map((i) => `<div class="barlist-linha">
        <span class="barlist-nome" title="${esc(i.nome)}">${esc(i.nome)}</span>
        <span class="barlist-trilho"><i style="width:${Math.max(2, (Math.abs(i.valor) / max) * 100).toFixed(1)}%;background:${i.cor || cor || "var(--cy)"}"></i></span>
        <b class="barlist-valor">${fmt(i.valor)}</b></div>`).join("") + `</div>`;
  }
  // estado vazio amigável com ação
  function vazio(o) {
    return `<div class="vazio">
      ${o.icone ? `<div class="vazio-icone">${o.icone}</div>` : ""}
      ${o.titulo ? `<b>${o.titulo}</b>` : ""}
      ${o.texto ? `<p>${o.texto}</p>` : ""}
      ${o.acao ? `<button class="btn primario pequeno" data-acao="${o.acao}"${o.dados ? " " + o.dados : ""}>${svg("mais")}${o.rotulo || "Adicionar"}</button>` : ""}
    </div>`;
  }
  const SEM_DADOS = `<span class="sem-dados">Sem dados suficientes</span>`;

  const CLASSE_STATUS = {
    "Comprado": "selo-ok", "Pendente": "selo-plan", "Cancelado": "selo-ruim",
    "Realizado": "selo-ok", "Planejado": "selo-plan", "Realizada": "selo-ok", "Planejada": "selo-plan", "Pulada": "selo-ruim",
    "Feito": "selo-ok", "Pulado": "selo-ruim",
    "Alta": "selo-ruim", "Normal": "selo-neutro", "Baixa": "selo-ok"
  };
  function selo(texto, clicavel, classe) {
    return `<span class="selo-tag ${classe || CLASSE_STATUS[texto] || "selo-neutro"}${clicavel ? " selo-botao" : ""}"${clicavel ? ` data-acao="${clicavel.acao}" data-id="${clicavel.id}" title="${esc(clicavel.titulo || "Clique para mudar")}" role="button" tabindex="0"` : ""}>${esc(texto)}</span>`;
  }
  function statusMeta(status) {
    const s = global.Metas.STATUS[status] || global.Metas.STATUS.semdados;
    return `<span class="status-meta ${s.classe}"><i></i>${s.rotulo}</span>`;
  }
  // abas: itens [{k, r, n}]
  function abas(itens, ativo, acao, classe) {
    return `<div class="abas ${classe || ""}" role="tablist">${itens.map((i) => `<button role="tab" aria-selected="${i.k === ativo}" class="${i.k === ativo ? "ativo" : ""}" data-acao="${acao}" data-k="${esc(i.k)}">${i.r}${i.n != null ? `<b>${i.n}</b>` : ""}</button>`).join("")}</div>`;
  }
  function botao(acao, rotulo, o) {
    o = o || {};
    return `<button class="btn ${o.classe || ""}" data-acao="${acao}"${o.dados ? " " + o.dados : ""}${o.titulo ? ` title="${esc(o.titulo)}"` : ""}>${o.icone ? svg(o.icone) : ""}${o.icone && o.soIcone ? "" : `<span class="btn-txt">${rotulo}</span>`}</button>`;
  }
  function botaoIcone(acao, icone, titulo, dados, classe) {
    return `<button class="btn fantasma ${classe || ""}" data-acao="${acao}"${dados ? " " + dados : ""} title="${esc(titulo)}" aria-label="${esc(titulo)}">${svg(icone)}</button>`;
  }
  function linhaAcoes(editar, excluir, id) {
    return `<span class="cel-botoes">${editar ? botaoIcone(editar, "editar", "Editar", `data-id="${id}"`) : ""}${excluir ? botaoIcone(excluir, "excluir", "Excluir", `data-id="${id}"`, "perigo-txt") : ""}</span>`;
  }
  function navData(acao, data, extra) {
    return `<div class="nav-data">
      <button class="btn pequeno" data-acao="${acao}" data-delta="-1" aria-label="Anterior">‹</button>
      <input type="date" class="sel" value="${data}" data-mudar="${acao}">
      <button class="btn pequeno" data-acao="${acao}" data-delta="1" aria-label="Próximo">›</button>
      ${extra || ""}
    </div>`;
  }

  // ---------------------------------------------------------------------
  // toast, modal e confirmação
  // ---------------------------------------------------------------------
  let timerToast = null;
  function toast(msg, desfazer) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.innerHTML = esc(msg) + (desfazer ? ` <button class="link-acao" id="toastDesfazer">Desfazer</button>` : "");
    el.classList.add("on");
    if (desfazer) document.getElementById("toastDesfazer").onclick = () => { el.classList.remove("on"); desfazer(); };
    clearTimeout(timerToast);
    timerToast = setTimeout(() => el.classList.remove("on"), desfazer ? 5000 : 2600);
  }
  let aoFecharModal = null;
  function abrirModal(html, opc) {
    opc = opc || {};
    const m = document.getElementById("modal");
    m.className = "modal on" + (opc.largo ? " largo" : "") + (opc.extraLargo ? " extra-largo" : "");
    m.innerHTML = `<button class="modal-fechar" data-acao="fechar-modal" aria-label="Fechar">${svg("fechar")}</button>` + html;
    document.getElementById("scrim").classList.add("on");
    document.body.classList.add("modal-aberto");
    aoFecharModal = opc.aoFechar || null;
    if (!opc.semFoco) {
      const primeiro = m.querySelector("input:not([type=checkbox]):not([readonly]), select, textarea");
      if (primeiro && window.matchMedia("(pointer: fine)").matches) setTimeout(() => primeiro.focus(), 30);
    }
    return m;
  }
  function fecharModal() {
    const m = document.getElementById("modal");
    if (!m.classList.contains("on")) return;
    m.classList.remove("on");
    m.innerHTML = "";
    document.getElementById("scrim").classList.remove("on");
    document.body.classList.remove("modal-aberto");
    const fn = aoFecharModal; aoFecharModal = null;
    if (fn) fn();
  }
  function modalAberto() { return document.getElementById("modal").classList.contains("on"); }
  // confirmação para ações destrutivas. Com `digitar`, exige escrever a palavra.
  function confirmar(o) {
    const m = abrirModal(`<h3>${esc(o.titulo || "Confirmar")}</h3>
      <p class="modal-texto">${o.html || esc(o.texto || "")}</p>
      ${o.digitar ? `<div class="campo"><label for="f_confirma">Para confirmar, digite <b>${esc(o.digitar)}</b></label><input id="f_confirma" autocomplete="off" autocapitalize="characters"></div>` : ""}
      <div class="modal-acoes"><button class="btn ${o.perigo === false ? "primario" : "perigo"} salvar" id="btnConfirmar"${o.digitar ? " disabled" : ""}>${esc(o.rotulo || "Confirmar")}</button><button class="btn" data-acao="fechar-modal">Cancelar</button></div>`);
    const b = m.querySelector("#btnConfirmar");
    if (o.digitar) {
      const inp = m.querySelector("#f_confirma");
      inp.addEventListener("input", () => { b.disabled = inp.value.trim().toUpperCase() !== o.digitar.toUpperCase(); });
      setTimeout(() => inp.focus(), 30);
    }
    b.onclick = () => { if (b.disabled) return; fecharModal(); o.aoConfirmar(); };
  }
  function botoesModal(editando, rotuloSalvar) {
    return `<div class="modal-acoes">
      <button class="btn primario salvar" id="btnSalvar">${esc(rotuloSalvar || "Salvar")}</button>
      ${editando ? `<button class="btn perigo" id="btnExcluir">Excluir</button>` : ""}
      <button class="btn" data-acao="fechar-modal">Cancelar</button>
    </div>`;
  }
  // leitura de campos do modal
  function valor(id) { const el = document.getElementById(id); return el ? el.value : ""; }
  function texto(id) { return valor(id).trim(); }
  function numero(id) { return N.numOuNulo(valor(id)); }
  function marcado(id) { const el = document.getElementById(id); return !!(el && el.checked); }
  function multiplos(id) { const el = document.getElementById(id); return el ? Array.from(el.selectedOptions).map((o) => o.value) : []; }
  function chips(idGrupo) { return Array.from(document.querySelectorAll(`#${idGrupo} input:checked`)).map((i) => i.value); }
  function campoChips(id, lista, selecionados) {
    return `<div class="chips" id="${id}">${lista.map((g) => `<label class="chip"><input type="checkbox" value="${esc(g)}"${(selecionados || []).indexOf(g) !== -1 ? " checked" : ""}><span>${esc(g)}</span></label>`).join("")}</div>`;
  }
  // campo de alimento com busca (datalist) — aceita nome novo
  function campoAlimento(id, d, valorAtual, rotulo) {
    const lista = global.Alimentacao.alimentosOrdenados(d);
    return `<div class="campo"><label for="${id}">${rotulo || "Alimento"}</label>
      <input id="${id}" list="${id}_lista" value="${esc(valorAtual || "")}" placeholder="Digite para buscar ou cadastrar" autocomplete="off">
      <datalist id="${id}_lista">${lista.map((a) => `<option value="${esc(a.nome)}">`).join("")}</datalist></div>`;
  }

  global.UI = {
    esc, brl, num, numAuto, kg, litros, sinal, pct, dataBR, dataCurta, dataLonga, mesRotulo, rotuloRelativo, plural, opcoes,
    ICONES, svg, dica, card, gaugeSVG, kpi, deltaPill, mini, barra, macro, barList, vazio, SEM_DADOS, CLASSE_STATUS, selo, statusMeta, abas,
    botao, botaoIcone, linhaAcoes, navData,
    toast, abrirModal, fecharModal, modalAberto, confirmar, botoesModal,
    valor, texto, numero, marcado, multiplos, chips, campoChips, campoAlimento
  };
})(window);
