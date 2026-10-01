/**
 * app.js — Meu Controle (Vida & Fitness)
 * -----------------------------------------------------------------------
 * Camada de interface. Este arquivo é o único que toca no DOM: lê os
 * dados através de Armazenamento/Fitness/Alimentacao e desenha cada
 * seção como uma string HTML injetada em #conteudo, sem recarregar a
 * página. Cliques dentro de #conteudo são tratados por delegação de
 * eventos (um único listener, ligado uma vez em iniciar()).
 *
 * Multiusuário: o seletor de pessoa na barra superior define
 * `usuarioAtivo`. Vazio = "Todos" (cada tela separa por pessoa);
 * preenchido = só os registros daquela pessoa aparecem e os novos
 * registros já nascem ligados a ela.
 * -----------------------------------------------------------------------
 */
(function () {
  "use strict";

  const A = window.Armazenamento;
  const F = window.Fitness;
  const L = window.Alimentacao;
  const G = window.Graficos;

  const VERSAO_APP = "1.0.0";
  const CORES_PESSOA = ["#00E5FF", "#2EE59D", "#FF5C6A", "#38B6FF", "#A66BFF", "#FFA726", "#FF2E92"];

  // =========================================================================
  // ESTADO DA INTERFACE (nada disso é salvo, exceto o usuário ativo)
  // =========================================================================
  let DADOS = null;
  let ROTA = { secao: "dashboard", param: null };
  let usuarioAtivo = "";               // "" = todos
  let demoBannerOculto = false;
  let filtroCompras = "pendentes";     // pendentes | Feira | Mercado | Açougue | comprados | todos
  let mesGastos = F.mesAtual();
  let dataAlimentacao = A.hoje(0);
  let periodoEvo = 0;                  // meses no gráfico de peso (0 = tudo)
  let exercicioCarga = "";             // exercício escolhido no gráfico de carga
  let mesRelatorio = F.mesAtual();

  // =========================================================================
  // UTILIDADES
  // =========================================================================
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function brl(v) { return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function num(v, casas) { return (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: casas == null ? 1 : casas, maximumFractionDigits: casas == null ? 1 : casas }); }
  function kgf(v) { return v == null ? "—" : num(v, 1) + " kg"; }
  function sinalKg(v) { return v == null ? "—" : (v > 0 ? "▲ +" : v < 0 ? "▼ " : "= ") + num(v, 1) + " kg"; }
  function pct(v) { return (Number(v) || 0).toFixed(1).replace(".", ",") + "%"; }
  function dataBR(iso) { return iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "—"; }
  function dataCurta(iso) { return iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "—"; }
  function mesRotulo(chave) {
    const dt = new Date(Number(chave.slice(0, 4)), Number(chave.slice(5, 7)) - 1, 1);
    const m = dt.toLocaleDateString("pt-BR", { month: "long" });
    return m.charAt(0).toUpperCase() + m.slice(1) + " de " + chave.slice(0, 4);
  }
  function rotuloRelativo(iso) {
    const d = F.diasEntre(iso);
    if (d === 0) return "Hoje";
    if (d === 1) return "Amanhã";
    if (d === -1) return "Ontem";
    if (d > 1 && d <= 7) return "Próximos 7 dias";
    if (d < -1 && d >= -7) return "Últimos 7 dias";
    return d > 0 ? "Mais adiante" : "Anteriores";
  }
  function numIn(v) { return Number(String(v == null ? "" : v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0; }
  function numDec(v) { return Number(String(v == null ? "" : v).replace(",", ".")) || 0; }
  function achar(lista, id) { return lista.filter((x) => x.id === id)[0] || null; }
  function opcoes(lista, atual, comVazio) {
    return (comVazio ? `<option value="">${esc(comVazio)}</option>` : "") +
      lista.map((o) => `<option value="${esc(o)}"${o === atual ? " selected" : ""}>${esc(o)}</option>`).join("");
  }
  function opcoesUsuarios(atual) {
    return F.usuariosAtivos(DADOS).map((u) => `<option value="${u.id}"${u.id === atual ? " selected" : ""}>${esc(u.nome)}</option>`).join("");
  }
  function plural(qtd, s, p) { return qtd === 1 ? s : p; }
  function corSinal(v) { return v > 0 ? "up" : v < 0 ? "down" : "dim"; }
  function inicial(nome) { const partes = String(nome || "?").replace(/\(.*?\)/g, "").trim().split(/\s+/).filter((p) => /^[\p{L}\d]/u.test(p)); return (partes.map((p) => p[0]).slice(0, 2).join("") || "?").toUpperCase(); }

  // anel de progresso (KPIs)
  function gaugeSVG(percentual, cor, tamanho) {
    const t = tamanho || 60, r = t / 2 - 5, c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(100, percentual || 0));
    return `<svg viewBox="0 0 ${t} ${t}"><circle class="gauge-fundo" cx="${t / 2}" cy="${t / 2}" r="${r}" stroke-width="6"></circle>
      <circle class="gauge-valor" cx="${t / 2}" cy="${t / 2}" r="${r}" stroke-width="6" stroke="${cor}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c - c * p / 100).toFixed(1)}"></circle></svg>`;
  }

  // pessoa(s) em foco: uma (seletor) ou todas as ativas
  function pessoas() {
    const ativos = F.usuariosAtivos(DADOS);
    if (!usuarioAtivo) return ativos;
    const u = achar(DADOS.usuarios, usuarioAtivo);
    return u ? [u] : ativos;
  }
  function uid() { return usuarioAtivo || null; }
  function corUsuario(id) { const u = achar(DADOS.usuarios, id); return (u && u.cor) || "var(--cy)"; }

  // =========================================================================
  // CICLO DE VIDA
  // =========================================================================
  function iniciar() {
    DADOS = A.carregarDados();
    usuarioAtivo = DADOS.config.usuarioAtivo || "";
    if (usuarioAtivo && !achar(DADOS.usuarios, usuarioAtivo)) usuarioAtivo = "";
    A.aoMudar(() => { DADOS = A.carregarDados(); renderRota(); });

    ligarTopbar();
    ligarSidebar();
    ligarModalGlobal();
    ligarDelegacaoConteudo();
    iniciarRelogio();
    ajustarBarraGuias();
    window.addEventListener("resize", ajustarBarraGuias);
    window.addEventListener("orientationchange", () => setTimeout(ajustarBarraGuias, 300));
    document.getElementById("inputImportarBackup").addEventListener("change", (e) => {
      const arq = e.target.files[0];
      if (!arq) return;
      e.target.value = "";
      confirmarExclusao("Importar este backup substitui TODOS os dados atuais. Continuar?", () => {
        A.importarDados(arq).then(() => toast("Backup importado.")).catch((err) => toast(err.message));
      }, "Importar");
    });

    navegarPara("dashboard");
  }

  function salvarEAtualizar(mensagem) {
    A.salvarDados(DADOS);
    if (mensagem) toast(mensagem);
  }

  function navegarPara(secao, param) {
    ROTA = { secao, param: param || null };
    if (secao === "gastos") mesGastos = F.mesAtual();
    if (secao === "alimentacao") dataAlimentacao = A.hoje(0);
    if (secao === "relatorio") mesRelatorio = F.mesAtual();
    document.querySelectorAll("#navPrincipal button").forEach((b) => b.classList.toggle("ativo", b.dataset.secao === secao));
    fecharSidebarMobile();
    renderRota();
    const area = document.querySelector(".scroll");
    if (area) area.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  const TITULOS = {
    dashboard: ["Dashboard", "Visão geral: comer, comprar, treinar e evoluir"],
    usuarios: ["Usuários", "Pessoas que usam o sistema — cada uma com seus dados"],
    "detalhe-usuario": ["Painel pessoal", "Só os dados desta pessoa"],
    compras: ["Lista de Compras", "O que comprar, com preços, local e prioridade"],
    gastos: ["Gastos com Alimentação", "Só entra como gasto o que foi marcado como Comprado"],
    alimentacao: ["Minha Alimentação", "Refeições do dia por horário"],
    academia: ["Academia", "Treinos por data e exercícios"],
    "detalhe-treino": ["Treino", "Exercícios, séries, repetições e carga"],
    semana: ["Minha Semana", "Plano semanal de treinos (Seg → Dom)"],
    evolucao: ["Minha Evolução", "Peso, IMC e histórico"],
    relatorio: ["Relatório do Mês", "Fechamento: gastos, refeições, treinos e peso"],
    configuracoes: ["Configurações", "Backup, dados de exemplo e privacidade"]
  };

  function renderRota() {
    const t = TITULOS[ROTA.secao] || TITULOS.dashboard;
    document.getElementById("tituloSecao").textContent = t[0];
    document.getElementById("subtituloSecao").textContent = t[1];
    const mapa = {
      dashboard: renderDashboard, usuarios: renderUsuarios, "detalhe-usuario": renderDetalheUsuario,
      compras: renderCompras, gastos: renderGastos, alimentacao: renderAlimentacao,
      academia: renderAcademia, "detalhe-treino": renderDetalheTreino, semana: renderSemana,
      evolucao: renderEvolucao, relatorio: renderRelatorio, configuracoes: renderConfiguracoes
    };
    const fn = mapa[ROTA.secao] || renderDashboard;
    G.destruirTodos();
    document.getElementById("conteudo").innerHTML = fn(DADOS, ROTA.param);
    montarGraficosDaRota();
    preencherSeletorUsuario();
    atualizarBadgeNotificacoes();
    atualizarSidebarMeta();
    atualizarRodape();
  }

  // =========================================================================
  // TOAST + MODAL
  // =========================================================================
  let timerToast = null;
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("on");
    clearTimeout(timerToast);
    timerToast = setTimeout(() => el.classList.remove("on"), 2400);
  }
  window.UI = { toast };

  function abrirModal(html, largo) {
    const m = document.getElementById("modal");
    m.className = "modal on" + (largo ? " largo" : "");
    m.innerHTML = html;
    document.getElementById("scrim").classList.add("on");
    const primeiro = m.querySelector("input, select, textarea");
    if (primeiro) setTimeout(() => primeiro.focus(), 30);
  }
  function fecharModal() {
    document.getElementById("modal").classList.remove("on");
    document.getElementById("scrim").classList.remove("on");
  }
  function ligarModalGlobal() {
    document.getElementById("scrim").addEventListener("click", fecharModal);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharModal(); });
  }
  // confirmação dentro da página (funciona também onde confirm() é bloqueado)
  function confirmarExclusao(mensagem, aoConfirmar, rotulo) {
    abrirModal(`<h3>Confirmar</h3>
      <p style="margin:0;font-size:14px;line-height:1.55;color:#C9D3E6">${esc(mensagem)}</p>
      <div class="modal-acoes"><button class="btn perigo salvar" id="btnConfirmar">${esc(rotulo || "Confirmar")}</button><button class="btn" id="btnCancelar">Cancelar</button></div>`);
    ligarCancelar();
    document.getElementById("btnConfirmar").onclick = () => { fecharModal(); aoConfirmar(); };
  }
  function valor(id) { const el = document.getElementById(id); return el ? el.value : ""; }
  function valorTrim(id) { return valor(id).trim(); }
  function marcado(id) { const el = document.getElementById(id); return !!(el && el.checked); }
  function multiplos(id) { const el = document.getElementById(id); return el ? Array.from(el.selectedOptions).map((o) => o.value) : []; }
  function botoesModal(editando) {
    return `<div class="modal-acoes">
      <button class="btn primario salvar" id="btnSalvar">Salvar</button>
      ${editando ? `<button class="btn perigo" id="btnExcluir">Excluir</button>` : ""}
      <button class="btn" id="btnCancelar">Cancelar</button>
    </div>`;
  }
  function ligarCancelar() {
    const b = document.getElementById("btnCancelar");
    if (b) b.onclick = fecharModal;
  }

  // =========================================================================
  // TOPBAR (seletor de pessoa, notificações, relógio)
  // =========================================================================
  function ligarTopbar() {
    const sel = document.getElementById("selUsuario");
    sel.addEventListener("change", () => {
      usuarioAtivo = sel.value;
      DADOS.config.usuarioAtivo = usuarioAtivo;
      A.salvarDados(DADOS, true, true);
      renderRota();
    });
    const btnNotif = document.getElementById("btnNotificacoes");
    const dropNotif = document.getElementById("dropdownNotificacoes");
    btnNotif.addEventListener("click", (e) => {
      e.stopPropagation();
      dropNotif.classList.toggle("on");
      if (dropNotif.classList.contains("on")) preencherNotificacoes();
    });
    dropNotif.addEventListener("click", (e) => {
      const item = e.target.closest("[data-rota]");
      if (item) { navegarPara(item.dataset.rota); dropNotif.classList.remove("on"); }
    });
    document.addEventListener("click", (e) => {
      if (!dropNotif.contains(e.target) && e.target !== btnNotif) dropNotif.classList.remove("on");
    });
  }
  function preencherSeletorUsuario() {
    const sel = document.getElementById("selUsuario");
    const ativos = F.usuariosAtivos(DADOS);
    sel.innerHTML = `<option value="">Todos</option>` + ativos.map((u) => `<option value="${u.id}"${u.id === usuarioAtivo ? " selected" : ""}>${esc(u.nome)}</option>`).join("");
    sel.value = usuarioAtivo;
  }
  function ligarSidebar() {
    document.getElementById("navPrincipal").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-secao]");
      if (b) navegarPara(b.dataset.secao);
    });
    document.getElementById("btnLogo").addEventListener("click", () => navegarPara("dashboard"));
  }
  function fecharSidebarMobile() {
    const sb = document.getElementById("sidebar"), sc = document.getElementById("scrimMenu");
    if (sb) sb.classList.remove("aberta");
    if (sc) sc.classList.remove("on");
  }
  function iniciarRelogio() {
    const rel = document.getElementById("relogioTopbar"), dat = document.getElementById("dataTopbar");
    const tick = () => {
      const d = new Date();
      rel.textContent = d.toLocaleTimeString("pt-BR");
      dat.textContent = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).replace(/\./g, "");
    };
    tick();
    setInterval(tick, 1000);
  }
  // compacta a barra de guias (níveis 0–6 do CSS) até todas caberem
  function ajustarBarraGuias() {
    const sb = document.getElementById("sidebar"), nav = document.getElementById("navPrincipal");
    if (!sb || !nav) return;
    for (let n = 0; n <= 6; n++) {
      if (n) sb.setAttribute("data-compacta", String(n)); else sb.removeAttribute("data-compacta");
      if (nav.scrollWidth <= nav.clientWidth + 1) return;
    }
  }
  function atualizarSidebarMeta() { /* barra superior não usa este bloco */ }
  function atualizarRodape() {
    const el = document.getElementById("rodapeAtualizado");
    if (!el) return;
    el.textContent = DADOS.atualizadoEm ? "Atualizado " + new Date(DADOS.atualizadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Sem alterações ainda";
  }

  // =========================================================================
  // ALERTAS / NOTIFICAÇÕES (calculados a partir dos dados reais)
  // =========================================================================
  function gerarAlertas(d) {
    const alertas = [];
    pessoas().forEach((u) => {
      const r = F.resumoUsuario(d, u);
      const nome = pessoas().length > 1 ? esc(u.nome) + ": " : "";
      if (r.treinoHoje && r.treinoHoje.status === "Planejado")
        alertas.push({ tipo: "info", rota: "academia", texto: `${nome}treino de hoje (${esc(r.treinoHoje.nome)}) ainda não foi marcado como realizado.` });
      if (r.treinoHoje && r.treinoHoje.origem === "plano")
        alertas.push({ tipo: "info", rota: "semana", texto: `${nome}o plano prevê "${esc(r.treinoHoje.nome)}" hoje. Registre o treino em Academia.` });
      if (r.diasSemPesar == null) alertas.push({ tipo: "aviso", rota: "evolucao", texto: `${nome}nenhuma pesagem registrada ainda.` });
      else if (r.diasSemPesar >= 7) alertas.push({ tipo: "aviso", rota: "evolucao", texto: `${nome}última pesagem há ${r.diasSemPesar} dias. Que tal registrar o peso?` });
      if (r.semanaPlanejados && r.semanaFeitos === r.semanaPlanejados)
        alertas.push({ tipo: "sucesso", rota: "academia", texto: `${nome}todos os ${r.semanaPlanejados} treinos da semana foram feitos.` });
      const alta = L.itensAComprar(d, u.id).filter((c) => c.prioridade === "Alta");
      if (alta.length) alertas.push({ tipo: "perigo", rota: "compras", texto: `${nome}${alta.length} ${plural(alta.length, "item", "itens")} de prioridade alta para comprar (${alta.map((c) => esc(c.nome)).join(", ")}).` });
      const al = L.resumoUsuario(d, u);
      if (al.mediaMensal > 0 && al.gastoMes > al.mediaMensal * 1.2)
        alertas.push({ tipo: "aviso", rota: "gastos", texto: `${nome}gasto do mês (${brl(al.gastoMes)}) já passou 20% da média mensal (${brl(al.mediaMensal)}).` });
      if (al.refeicoesHoje.total === 0) alertas.push({ tipo: "info", rota: "alimentacao", texto: `${nome}nenhuma refeição planejada para hoje.` });
    });
    if (!d.usuarios.length) alertas.push({ tipo: "aviso", rota: "usuarios", texto: "Cadastre a primeira pessoa em Usuários para começar." });
    return alertas;
  }
  function chaveAlerta(a) { return a.tipo + "|" + a.texto; }
  function alertasNaoLidos(d) { return gerarAlertas(d).filter((a) => d.notificacoesLidas.indexOf(chaveAlerta(a)) === -1); }
  function preencherNotificacoes() {
    const drop = document.getElementById("dropdownNotificacoes");
    const lista = gerarAlertas(DADOS);
    if (!lista.length) { drop.innerHTML = `<div class="dropdown-vazio">Nenhum aviso. Tudo em ordem.</div>`; return; }
    drop.innerHTML = lista.map((a) => `<button class="dropdown-item" data-rota="${a.rota}" style="width:100%;text-align:left">
      <span class="ic" style="background:${COR_ALERTA[a.tipo]}22;color:${COR_ALERTA[a.tipo]}"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONE_ALERTA[a.tipo]}</svg></span>
      <p>${a.texto}</p></button>`).join("");
    DADOS.notificacoesLidas = lista.map(chaveAlerta);
    A.salvarDados(DADOS, true, true);
    atualizarBadgeNotificacoes();
  }
  function atualizarBadgeNotificacoes() {
    const n = alertasNaoLidos(DADOS).length;
    const b = document.getElementById("badgeNotificacoes");
    b.textContent = n; b.style.display = n ? "flex" : "none";
  }
  const COR_ALERTA = { perigo: "#FF5C6A", aviso: "#FFA726", sucesso: "#2EE59D", info: "#38B6FF" };
  const TITULO_ALERTA = { perigo: "Atenção", aviso: "Aviso", sucesso: "Bom sinal", info: "Informação" };
  const ICONE_ALERTA = {
    perigo: '<path d="M10 3.5 17 16H3z"/><path d="M10 8v4M10 14.2v.3"/>',
    aviso: '<circle cx="10" cy="10" r="6.5"/><path d="M10 6.5v4M10 13.2v.3"/>',
    sucesso: '<circle cx="10" cy="10" r="6.5"/><path d="M7 10l2 2 4-4"/>',
    info: '<circle cx="10" cy="10" r="6.5"/><path d="M10 9v4.5M10 6.5v.3"/>'
  };

  // =========================================================================
  // COMPONENTES REUTILIZÁVEIS
  // =========================================================================
  const ICONES = {
    mais: '<path d="M10 4v12M4 10h12"/>',
    editar: '<path d="M4 15.5V13l8.5-8.5a1.5 1.5 0 0 1 2 2L6 15H4v-2z"/>',
    excluir: '<path d="M4.5 5.5h11M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M6 5.5 6.6 15a1 1 0 0 0 1 1h4.8a1 1 0 0 0 1-1l.6-9.5"/>',
    voltar: '<path d="M12 15l-5-5 5-5"/>',
    copiar: '<rect x="7" y="7" width="9" height="9" rx="1.5"/><path d="M4 13V5a1 1 0 0 1 1-1h8"/>'
  };
  const ICONES_STRIP = {
    peso: '<path d="M6 4h12l2 5H4z"/><path d="M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M12 12v4M10 14h4"/>',
    treino: '<rect x="2.5" y="9" width="3" height="6" rx="1"/><rect x="18.5" y="9" width="3" height="6" rx="1"/><rect x="5.5" y="10.5" width="2.5" height="3" rx=".6"/><rect x="16" y="10.5" width="2.5" height="3" rx=".6"/><path d="M8 12h8"/>',
    refeicao: '<path d="M6 3.5v7a2.5 2.5 0 0 0 5 0v-7"/><path d="M8.5 10.5v10"/><path d="M17 3.5c-2 2-2.5 5-2.5 8h2.5v9"/>',
    compras: '<path d="M3.5 4.5h2.5l2.4 10.5h9.6l2-7H7"/><circle cx="10" cy="19" r="1.4"/><circle cx="16.5" cy="19" r="1.4"/>',
    gasto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M14.5 9.2c-.5-.9-1.4-1.3-2.5-1.3-1.5 0-2.5.8-2.5 1.9 0 2.6 5 1.4 5 4.1 0 1.2-1.1 2-2.5 2-1.2 0-2.2-.5-2.7-1.4"/>',
    imc: '<path d="M4 18.5h16"/><path d="M4 14.5l4.5-4.5 3.5 3L20 5.5"/><path d="M15.5 5.5H20v4.5"/>'
  };
  function svg(path, vb) { return `<svg viewBox="${vb || "0 0 20 20"}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`; }

  function card(span, titulo, sub, acoesHtml, corpoHtml, footHtml, id) {
    return `<section class="card ${span || ""}"${id ? ` id="${id}"` : ""}>
      <header><div><h2>${titulo}</h2>${sub ? `<div class="sub">${sub}</div>` : ""}</div>
      ${acoesHtml ? `<div class="acoes">${acoesHtml}</div>` : ""}</header>
      <div class="body">${corpoHtml}</div>
      ${footHtml ? `<div class="foot">${footHtml}</div>` : ""}
    </section>`;
  }
  function kpiCard(rotulo, valorHtml, gaugePct, cor, deltaHtml, sub) {
    const gauge = gaugePct == null ? "" :
      `<div class="kpi-gauge">${gaugeSVG(gaugePct, cor, 66)}<span class="kpi-gauge-txt">${Math.round(Math.max(0, Math.min(100, gaugePct)))}%</span></div>`;
    return `<div class="kpi">
      <div class="kpi-rotulo">${rotulo}</div>
      <div class="kpi-corpo">${gauge}<div class="kpi-info">
        <div class="kpi-valor">${valorHtml}</div>
        ${deltaHtml ? `<div class="kpi-delta">${deltaHtml}</div>` : ""}
        ${sub ? `<div class="kpi-sub">${sub}</div>` : ""}
      </div></div>
    </div>`;
  }
  function delta(v, texto, inverter) {
    const n = Number(v) || 0;
    const boa = inverter ? n <= 0 : n >= 0;
    return `<b class="${boa ? "up" : "down"}">${n >= 0 ? "↑" : "↓"} ${Math.abs(n).toFixed(1).replace(".", ",")}%</b> <span class="dim">${texto || ""}</span>`;
  }
  function pill(texto, classe) { return `<b class="${classe}" style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:11.5px;font-weight:700">${texto}</b>`; }
  function stripKpis(itens) {
    return `<div class="strip">` + itens.map((i) => `<${i.rota ? "button" : "div"} class="strip-item${i.rota ? " clicavel" : ""}"${i.rota ? ` data-acao="ir" data-secao="${i.rota}"` : ""}>
      <span class="strip-ic" style="color:${i.cor};background:${i.cor}1F"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${i.icone}</svg></span>
      <div><div class="strip-rotulo">${i.rotulo}</div><div class="strip-valor">${i.valor}</div><div class="strip-sub">${i.sub || ""}</div></div>
    </${i.rota ? "button" : "div"}>`).join("") + `</div>`;
  }
  function barList(itens, cor, fmt) {
    fmt = fmt || brl;
    if (!itens.length) return `<div class="empty">Sem dados ainda.</div>`;
    const soma = itens.reduce((t, i) => t + Math.abs(i.valor), 0) || 1;
    return `<div class="barlist">` + itens.map((i, k) => {
      const p = Math.max(0, (i.valor / soma) * 100);
      return `<div class="barlist-linha">
        <span class="barlist-nome" title="${esc(i.nome)}">${esc(i.nome)}</span>
        <span class="barlist-trilho"><i style="width:${p.toFixed(1)}%;background:${i.cor || cor || G.PALETA_CATEGORIAS[k % G.PALETA_CATEGORIAS.length]}"></i></span>
        <b class="barlist-valor">${fmt(i.valor)}</b>
      </div>`;
    }).join("") + `</div>`;
  }
  function alertasCards(d, limite) {
    const alertas = gerarAlertas(d).slice(0, limite || 4);
    if (!alertas.length) return `<div class="alertas-lista"><div class="alerta-card sucesso"><span class="ic">${svg(ICONE_ALERTA.sucesso)}</span><div><b>Tudo em ordem</b><p>Nenhum alerta no momento.</p></div></div></div>`;
    return `<div class="alertas-lista">` + alertas.map((a) => `<button class="alerta-card ${a.tipo}" data-acao="ir" data-secao="${a.rota}" style="width:100%;text-align:left;cursor:pointer">
      <span class="ic">${svg(ICONE_ALERTA[a.tipo])}</span>
      <div><b>${TITULO_ALERTA[a.tipo]}</b><p>${a.texto}</p></div>
    </button>`).join("") + `</div>`;
  }
  function faixaDemo(d) {
    if (!d.demo || demoBannerOculto) return "";
    return `<div class="faixa-demo">
      <div><b>Dados de exemplo.</b> Ana e João e todos os registros ligados a eles são fictícios — servem só para você ver o sistema funcionando. Substitua pelos seus dados ou apague quando quiser.</div>
      <div class="acoes">
        <button class="btn pequeno" data-acao="manter-demo">Continuar explorando</button>
        <button class="btn pequeno perigo" data-acao="remover-demo">Apagar exemplo e começar do zero</button>
      </div>
    </div>`;
  }
  function linhaAcoes(editarAcao, id, excluirAcao) {
    return `<span class="cel-botoes"><button class="btn fantasma" data-acao="${editarAcao}" data-id="${id}" title="Editar" aria-label="Editar">${svg(ICONES.editar)}</button>
      ${excluirAcao ? `<button class="btn fantasma" data-acao="${excluirAcao}" data-id="${id}" title="Excluir" aria-label="Excluir" style="color:var(--down)">${svg(ICONES.excluir)}</button>` : ""}</span>`;
  }
  function seloPessoa(usuarioId) {
    const u = achar(DADOS.usuarios, usuarioId);
    if (!u) return `<span class="selo-tag selo-neutro">sem pessoa</span>`;
    return `<span class="selo-pessoa"><i style="background:${esc(u.cor || "#00E5FF")}">${esc(inicial(u.nome))}</i>${esc(u.nome)}</span>`;
  }
  const CLASSE_STATUS = {
    "Comprado": "selo-ok", "Comprar": "selo-alerta", "Planejado": "selo-plan", "Não comprado": "selo-ruim",
    "Realizado": "selo-ok", "Adiado": "selo-alerta", "Cancelado": "selo-ruim",
    "Realizada": "selo-ok", "Planejada": "selo-plan", "Pulada": "selo-ruim",
    "Feito": "selo-ok", "Pendente": "selo-plan", "Pulado": "selo-ruim",
    "Alta": "selo-ruim", "Média": "selo-alerta", "Baixa": "selo-ok"
  };
  function selo(texto, clicavel) {
    return `<span class="selo-tag ${CLASSE_STATUS[texto] || "selo-neutro"}${clicavel ? " selo-botao" : ""}"${clicavel ? ` data-acao="${clicavel.acao}" data-id="${clicavel.id}" title="Clique para mudar o status"` : ""}>${esc(texto)}</span>`;
  }
  function botaoNovo(acao, rotulo) {
    return `<button class="btn primario" data-acao="${acao}">${svg(ICONES.mais)}${rotulo || "NOVO"}</button>`;
  }
  function voltar(secao, rotulo) {
    return `<button class="voltar" data-acao="ir" data-secao="${secao}">${svg(ICONES.voltar)}${rotulo || "Voltar"}</button>`;
  }
  function tituloPessoas() {
    return usuarioAtivo ? esc(achar(DADOS.usuarios, usuarioAtivo).nome) : `${pessoas().length} ${plural(pessoas().length, "pessoa", "pessoas")}`;
  }
  function semUsuarios() {
    return `<div class="grid g-top"><div class="c12">${card("", "Bem-vindo ao Meu Controle", "primeiro passo", "", `
      <div class="empty">Nenhuma pessoa cadastrada ainda. Cadastre a primeira em <b>Usuários</b>: cada compra, refeição, treino e pesagem fica ligada a uma pessoa, e os dados nunca se misturam.
      <br>${botaoNovo("novo-usuario", "CADASTRAR PESSOA")}</div>`)}</div></div>`;
  }

  // =========================================================================
  // DASHBOARD
  // =========================================================================
  function pessoaCard(d, u) {
    const r = F.resumoUsuario(d, u), al = L.resumoUsuario(d, u);
    const treinoHoje = r.treinoHoje ? `${esc(r.treinoHoje.nome)} <span class="dim">· ${esc(r.treinoHoje.status)}</span>` : `<span class="dim">Descanso</span>`;
    const prox = al.proximaRefeicao ? `${esc(al.proximaRefeicao.horario)} · ${esc(al.proximaRefeicao.tipo)}` : `<span class="dim">Nada planejado</span>`;
    return `<button class="pessoa-card" style="--pessoa:${esc(u.cor || "#00E5FF")}" data-acao="ir" data-secao="detalhe-usuario" data-id="${u.id}" title="Abrir o painel pessoal">
      <div class="pessoa-topo"><span class="avatar">${esc(inicial(u.nome))}</span>
        <div><div class="pessoa-nome">${esc(u.nome)}</div><div class="pessoa-objetivo">${esc(u.objetivo || "sem objetivo")} · ${r.diasAcompanhamento} dias</div></div></div>
      <div class="pessoa-kpis">
        <div class="pessoa-kpi"><small>Peso atual</small><b>${r.pesoAtual == null ? "—" : num(r.pesoAtual) + " kg"}</b></div>
        <div class="pessoa-kpi"><small>Diferença</small><b class="${r.diferenca == null ? "dim" : r.diferenca < 0 ? "up" : r.diferenca > 0 ? "down" : ""}">${r.diferenca == null ? "—" : (r.diferenca > 0 ? "+" : "") + num(r.diferenca) + " kg"}</b></div>
        <div class="pessoa-kpi"><small>IMC</small><b>${r.imc == null ? "—" : num(r.imc)}</b></div>
      </div>
      <div class="pessoa-linhas">
        <div class="pessoa-linha"><span>🎯 Treino de hoje</span><b>${treinoHoje}</b></div>
        <div class="pessoa-linha"><span>🏋️ Semana</span><b>${r.semanaFeitos} de ${r.semanaPlanejados} feitos · ${r.ultimos7} nos últimos 7 dias</b></div>
        <div class="pessoa-linha"><span>⏰ Próxima refeição</span><b>${prox}</b></div>
        <div class="pessoa-linha"><span>🛒 A comprar</span><b>${al.itensAComprar} ${plural(al.itensAComprar, "item", "itens")} · ${brl(al.totalAComprar)}</b></div>
        <div class="pessoa-linha"><span>💰 Gasto no mês</span><b>${brl(al.gastoMes)} <span class="${al.diferencaMeses > 0 ? "down" : "up"}">${al.gastoMesAnterior ? (al.diferencaMeses > 0 ? "▲" : "▼") + " " + brl(Math.abs(al.diferencaMeses)) : ""}</span></b></div>
      </div>
    </button>`;
  }

  function renderDashboard(d) {
    if (!d.usuarios.length) return faixaDemo(d) + semUsuarios();
    const lista = pessoas();
    const u = uid();
    // agregados das pessoas em foco
    const treinosSemana = lista.reduce((s, x) => { const t = F.treinosNaSemana(d, x.id); s.feitos += t.feitos; s.plan += t.planejados; return s; }, { feitos: 0, plan: 0 });
    const treinosMes = lista.reduce((s, x) => s + F.treinosNoMes(d, x.id), 0);
    const treinosMesAnt = lista.reduce((s, x) => s + F.treinosNoMes(d, x.id, F.mesAnterior()), 0);
    const gastoMes = L.gastoNoMes(d, u), gastoAnt = L.gastoNoMes(d, u, F.mesAnterior());
    const estimado = L.estimadoNoMes(d, u);
    const aComprar = L.itensAComprar(d, u);
    const refHoje = lista.reduce((s, x) => { const r = L.refeicoesHoje(d, x.id); s.total += r.total; s.feitas += r.feitas; return s; }, { total: 0, feitas: 0 });
    const pesoMedioDif = lista.map((x) => F.diferencaPeso(d, x)).filter((v) => v != null);
    const difMedia = pesoMedioDif.length ? pesoMedioDif.reduce((s, v) => s + v, 0) / pesoMedioDif.length : null;
    const hojeStr = A.hoje(0);
    const proximos = F.deUsuario(d.treinos, u).filter((t) => t.data >= hojeStr && t.status === "Planejado").sort((a, b) => a.data.localeCompare(b.data)).slice(0, 6);
    const ultimasPesagens = F.deUsuario(d.pesagens, u).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 6);

    return `
      ${faixaDemo(d)}
      <div class="kpi-row">
        ${kpiCard("Treinos na semana", `${treinosSemana.feitos}<span class="dim" style="font-size:14px"> / ${treinosSemana.plan}</span>`, treinosSemana.plan ? (treinosSemana.feitos / treinosSemana.plan) * 100 : 0, "var(--up)", delta(L.variacaoPercentual(treinosMes, treinosMesAnt), "no mês vs anterior"), `${treinosMes} ${plural(treinosMes, "treino realizado", "treinos realizados")} no mês`)}
        ${kpiCard("Refeições de hoje", `${refHoje.feitas}<span class="dim" style="font-size:14px"> / ${refHoje.total}</span>`, refHoje.total ? (refHoje.feitas / refHoje.total) * 100 : 0, "var(--cy)", "", refHoje.total ? "realizadas / planejadas" : "nada planejado para hoje")}
        ${kpiCard("Gasto no mês", brl(gastoMes), estimado > 0 ? (gastoMes / estimado) * 100 : 0, "var(--down)", delta(L.variacaoPercentual(gastoMes, gastoAnt), "vs mês anterior", true), `Previsto: ${brl(estimado)} · anterior ${brl(gastoAnt)}`)}
        ${kpiCard("Para comprar", `${aComprar.length} <span class="dim" style="font-size:14px">${plural(aComprar.length, "item", "itens")}</span>`, null, "var(--acc)", aComprar.filter((c) => c.prioridade === "Alta").length ? pill(`${aComprar.filter((c) => c.prioridade === "Alta").length} prioridade alta`, "down") : "", `Estimativa: ${brl(L.totalAComprar(d, u))}`)}
        ${kpiCard("Peso", difMedia == null ? "—" : (difMedia > 0 ? "+" : "") + num(difMedia) + " kg", null, "var(--azul)", "", lista.length > 1 ? "variação média desde o início" : "desde o início do acompanhamento")}
      </div>

      <div class="grid">
        <div class="c12">${card("", "Pessoas", `${tituloPessoas()} · clique no cartão para abrir o painel pessoal`, botaoNovo("novo-usuario", "NOVA PESSOA"),
          `<div class="grade-pessoas">${lista.map((x) => pessoaCard(d, x)).join("")}</div>`)}</div>
      </div>

      <div class="grid">
        <div class="c4">${card("", "Refeições de hoje", dataBR(hojeStr), `<button class="btn pequeno" data-acao="ir" data-secao="alimentacao">ver tudo →</button>`, timelineDia(d, u, hojeStr, true))}</div>
        <div class="c4">${card("", "Próximos treinos", "planejados", `<button class="btn pequeno" data-acao="novo-treino">+ treino</button>`, tabelaTreinos(d, proximos, true))}</div>
        <div class="c4">${card("", "Avisos", "calculados dos seus dados", "", alertasCards(d, 5))}</div>
      </div>

      <div class="grid">
        <div class="c4">${card("", "Lista de compras", `${aComprar.length} ${plural(aComprar.length, "item pendente", "itens pendentes")}`, `<button class="btn pequeno" data-acao="nova-compra">+ item</button>`, tabelaComprasCompacta(d, aComprar.slice(0, 8)))}</div>
        <div class="c4">${card("", "Evolução do peso", periodoEvo ? `últimos ${periodoEvo} meses` : "todo o histórico", abasPeriodoEvo(),
          `<div style="padding:8px 14px 12px;height:230px"><canvas id="graf-dash-peso"></canvas></div>`)}</div>
        <div class="c4">${card("", "Últimas pesagens", "mais recentes primeiro", `<button class="btn pequeno" data-acao="nova-pesagem">+ pesagem</button>`, tabelaPesagens(d, ultimasPesagens, true))}</div>
      </div>

      ${stripKpis([
        { rotulo: "TREINOS NO MÊS", valor: String(treinosMes), sub: `mês anterior: ${treinosMesAnt}`, cor: "#2EE59D", icone: ICONES_STRIP.treino, rota: "academia" },
        { rotulo: "REFEIÇÕES NO MÊS", valor: String(lista.reduce((s, x) => s + L.refeicoesNoMes(d, x.id).length, 0)), sub: "alimentos registrados", cor: "#00E5FF", icone: ICONES_STRIP.refeicao, rota: "alimentacao" },
        { rotulo: "COMPRAS NO MÊS", valor: String(L.comprasNoMes(d, u).filter((c) => c.status === "Comprado").length), sub: `Média mensal: ${brl(L.mediaMensal(d, u))}`, cor: "#FFA726", icone: ICONES_STRIP.compras, rota: "gastos" },
        { rotulo: "MAIOR COMPRA", valor: (() => { const m = L.maiorCompra(d, u); return m ? brl(L.gastoReal(m)) : "—"; })(), sub: (() => { const m = L.maiorCompra(d, u); return m ? esc(m.nome) : "sem compras no mês"; })(), cor: "#FF5C6A", icone: ICONES_STRIP.gasto, rota: "gastos" },
        { rotulo: "IMC", valor: lista.length === 1 ? (F.imcAtual(d, lista[0]) == null ? "—" : num(F.imcAtual(d, lista[0]))) : `${lista.length} pessoas`, sub: lista.length === 1 ? F.classificacaoIMC(F.imcAtual(d, lista[0])) : "escolha uma pessoa no topo", cor: "#38B6FF", icone: ICONES_STRIP.imc, rota: "evolucao" }
      ])}
    `;
  }
  function abasPeriodoEvo() {
    return `<div class="abas">${[{ m: 1, r: "1m" }, { m: 3, r: "3m" }, { m: 6, r: "6m" }, { m: 0, r: "Tudo" }].map((o) => `<button class="${periodoEvo === o.m ? "ativo" : ""}" data-acao="periodo-evo" data-meses="${o.m}">${o.r}</button>`).join("")}</div>`;
  }

  // =========================================================================
  // USUÁRIOS
  // =========================================================================
  function renderUsuarios(d) {
    const lista = d.usuarios;
    const corpo = !lista.length ? `<div class="empty">Nenhuma pessoa cadastrada. Use "+ NOVA PESSOA" para começar.</div>` :
      `<div class="grade-pessoas">${lista.map((u) => pessoaCard(d, u)).join("")}</div>`;
    const grid = "grid-template-columns:1.4fr 90px 100px 110px 110px 1fr 80px";
    const tabela = !lista.length ? "" : `<div class="hd" style="${grid}"><i>Pessoa</i><i class="r">Altura</i><i class="r">Peso inicial</i><i class="r">Peso atual</i><i class="r">IMC</i><i>Objetivo</i><i></i></div>` +
      lista.map((u) => { const r = F.resumoUsuario(d, u); return `<div class="rw" style="${grid}">
        <div class="nm">${seloPessoa(u.id)} ${u.ativo === false ? selo("inativo") : ""}</div>
        <div class="r big">${u.altura ? num(u.altura, 2) + " m" : "—"}</div>
        <div class="r big">${kgf(r.pesoInicial)}</div>
        <div class="r big">${kgf(r.pesoAtual)}</div>
        <div class="r big">${r.imc == null ? "—" : num(r.imc)}</div>
        <div class="dim">${esc(u.objetivo || "—")}</div>
        <div class="r">${linhaAcoes("editar-usuario", u.id, "excluir-usuario")}</div>
      </div>`; }).join("");
    return `${faixaDemo(d)}
      <div class="grid g-top"><div class="c12">${card("", "Pessoas", `${lista.length} ${plural(lista.length, "cadastrada", "cadastradas")} · cada registro do sistema pertence a uma pessoa`, botaoNovo("novo-usuario", "NOVA PESSOA"), corpo)}</div></div>
      <div class="grid"><div class="c12">${card("", "Cadastro", "altura, peso inicial e objetivo", "", tabela || `<div class="empty">—</div>`)}</div></div>`;
  }

  function renderDetalheUsuario(d, id) {
    const u = achar(d.usuarios, id);
    if (!u) return voltar("usuarios") + `<div class="empty">Pessoa não encontrada.</div>`;
    const r = F.resumoUsuario(d, u), al = L.resumoUsuario(d, u);
    const hojeStr = A.hoje(0);
    const treinos = F.treinosDe(d, u.id).slice().sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8);
    const pesagens = F.pesagensDe(d, u.id).slice().reverse().slice(0, 8);
    const compras = L.itensAComprar(d, u.id);
    return `
      ${voltar("usuarios", "Usuários")}
      <div class="kpi-row">
        ${kpiCard("Peso atual", kgf(r.pesoAtual), null, "var(--cy)", r.diferenca == null ? "" : pill(sinalKg(r.diferenca), r.diferenca < 0 ? "up" : "down") + ` <span class="dim">desde o início</span>`, `Inicial: ${kgf(r.pesoInicial)} · média ${kgf(r.pesoMedio)}`)}
        ${kpiCard("IMC", r.imc == null ? "—" : num(r.imc), null, "var(--azul)", "", `${r.classificacao} · altura ${u.altura ? num(u.altura, 2) + " m" : "—"}`)}
        ${kpiCard("Treinos na semana", `${r.semanaFeitos}<span class="dim" style="font-size:14px"> / ${r.semanaPlanejados}</span>`, r.semanaPlanejados ? (r.semanaFeitos / r.semanaPlanejados) * 100 : 0, "var(--up)", "", `${r.ultimos7} nos últimos 7 dias · ${r.noMes} no mês`)}
        ${kpiCard("Gasto no mês", brl(al.gastoMes), al.estimadoMes ? (al.gastoMes / al.estimadoMes) * 100 : 0, "var(--down)", al.gastoMesAnterior ? delta(al.variacaoMeses, "vs mês anterior", true) : "", `Média mensal: ${brl(al.mediaMensal)}`)}
        ${kpiCard("Acompanhamento", `${r.diasAcompanhamento} <span class="dim" style="font-size:14px">dias</span>`, null, "var(--vi)", "", `Desde ${dataBR(u.dataInicio)} · ${r.totalTreinos} treinos · ${r.exerciciosFeitos} exercícios`)}
      </div>
      <div class="grid">
        <div class="c4">${card("", esc(u.nome), esc(u.objetivo || ""), `<button class="btn pequeno" data-acao="editar-usuario" data-id="${u.id}">editar</button>`, `
          <div class="kv"><span>Treino de hoje</span><b>${r.treinoHoje ? esc(r.treinoHoje.nome) + " · " + esc(r.treinoHoje.status) : "Descanso"}</b></div>
          <div class="kv"><span>Próximo treino</span><b>${r.proximoTreino ? dataCurta(r.proximoTreino.data) + " · " + esc(r.proximoTreino.nome) : "—"}</b></div>
          <div class="kv"><span>Última pesagem</span><b>${r.ultimaPesagem ? dataBR(r.ultimaPesagem.data) : "—"}</b></div>
          <div class="kv"><span>Próxima refeição</span><b>${al.proximaRefeicao ? esc(al.proximaRefeicao.horario) + " · " + esc(al.proximaRefeicao.tipo) : "—"}</b></div>
          <div class="kv"><span>Itens a comprar</span><b>${al.itensAComprar} · ${brl(al.totalAComprar)}</b></div>
          <div class="kv"><span>Compras no mês</span><b>${al.comprasMes}</b></div>
          <div class="kv"><span>Refeições no mês</span><b>${al.refeicoesMes}</b></div>
          <div class="kv"><span>Observações</span><b class="dim" style="font-weight:500;font-family:var(--ui)">${esc(u.obs || "—")}</b></div>`)}</div>
        <div class="c8">${card("", "Evolução do peso", periodoEvo ? `últimos ${periodoEvo} meses` : "todo o histórico", abasPeriodoEvo(), `<div style="padding:8px 14px 12px;height:250px"><canvas id="graf-peso-usuario" data-usuario="${u.id}"></canvas></div>`)}</div>
      </div>
      <div class="grid">
        <div class="c4">${card("", "Refeições de hoje", dataBR(hojeStr), `<button class="btn pequeno" data-acao="nova-refeicao" data-usuario="${u.id}">+ refeição</button>`, timelineDia(d, u.id, hojeStr, true))}</div>
        <div class="c4">${card("", "Treinos", "mais recentes", `<button class="btn pequeno" data-acao="novo-treino" data-usuario="${u.id}">+ treino</button>`, tabelaTreinos(d, treinos, true))}</div>
        <div class="c4">${card("", "Plano semanal", "Seg → Dom", `<button class="btn pequeno" data-acao="ir" data-secao="semana">editar →</button>`, planoLista(d, u.id))}</div>
      </div>
      <div class="grid">
        <div class="c6">${card("", "Pesagens", "mais recentes", `<button class="btn pequeno" data-acao="nova-pesagem" data-usuario="${u.id}">+ pesagem</button>`, tabelaPesagens(d, pesagens, true))}</div>
        <div class="c6">${card("", "Para comprar", `${compras.length} ${plural(compras.length, "item", "itens")}`, `<button class="btn pequeno" data-acao="nova-compra" data-usuario="${u.id}">+ item</button>`, tabelaComprasCompacta(d, compras))}</div>
      </div>`;
  }

  function abrirModalUsuario(id) {
    const u = id ? achar(DADOS.usuarios, id) : null;
    const cor = u ? u.cor : CORES_PESSOA[DADOS.usuarios.length % CORES_PESSOA.length];
    abrirModal(`
      <h3>${u ? "Editar pessoa" : "Nova pessoa"}</h3>
      <div class="par">
        <div class="campo"><label for="f_nome">Nome</label><input id="f_nome" value="${u ? esc(u.nome) : ""}" placeholder="Ex.: Maria"></div>
        <div class="campo"><label for="f_objetivo">Objetivo</label><select id="f_objetivo">${opcoes(F.OBJETIVOS, u ? u.objetivo : F.OBJETIVOS[0])}</select></div>
      </div>
      <div class="par3">
        <div class="campo"><label for="f_altura">Altura (m)</label><input id="f_altura" type="number" step="0.01" min="0.5" max="2.5" value="${u && u.altura ? u.altura : ""}" placeholder="1.70"></div>
        <div class="campo"><label for="f_pesoini">Peso inicial (kg)</label><input id="f_pesoini" type="number" step="0.1" min="0" value="${u && u.pesoInicial ? u.pesoInicial : ""}" placeholder="70.0"></div>
        <div class="campo"><label for="f_inicio">Data de início</label><input id="f_inicio" type="date" value="${u ? esc(u.dataInicio || "") : A.hoje(0)}"></div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_cor">Cor de identificação</label><input id="f_cor" type="color" value="${esc(cor)}"></div>
        <div class="campo"><label>&nbsp;</label><label class="chk-linha"><input type="checkbox" id="f_ativo" ${!u || u.ativo !== false ? "checked" : ""}> Pessoa ativa (aparece nos painéis)</label></div>
      </div>
      <div class="campo"><label for="f_obs">Observações</label><textarea id="f_obs" placeholder="Opcional">${u ? esc(u.obs || "") : ""}</textarea></div>
      <p class="campo ajuda">Peso atual, diferença, IMC e treinos são sempre calculados a partir das pesagens e treinos registrados — por isso não são campos editáveis.</p>
      ${botoesModal(!!u)}`);
    ligarCancelar();
    document.getElementById("btnSalvar").onclick = () => {
      const nome = valorTrim("f_nome");
      if (!nome) { toast("Informe o nome."); return; }
      const reg = { id: u ? u.id : A.novoId(), nome, objetivo: valor("f_objetivo"), altura: numDec(valor("f_altura")) || null, pesoInicial: numDec(valor("f_pesoini")) || null,
        dataInicio: valor("f_inicio"), cor: valor("f_cor"), ativo: marcado("f_ativo"), obs: valorTrim("f_obs") };
      if (u) Object.assign(u, reg); else DADOS.usuarios.push(reg);
      fecharModal();
      salvarEAtualizar(u ? "Pessoa atualizada." : "Pessoa cadastrada.");
    };
    if (u) document.getElementById("btnExcluir").onclick = () => { fecharModal(); excluirUsuario(u.id); };
  }
  function excluirUsuario(id) {
    const u = achar(DADOS.usuarios, id);
    if (!u) return;
    const n = ["compras", "refeicoes", "planoSemanal", "treinos", "pesagens"].reduce((s, k) => s + DADOS[k].filter((x) => x.usuarioId === id).length, 0);
    confirmarExclusao(`Excluir "${u.nome}" e TODOS os seus registros (${n} itens: compras, refeições, treinos, exercícios, pesagens)? Isso não pode ser desfeito.`, () => {
      const treinosIds = DADOS.treinos.filter((t) => t.usuarioId === id).map((t) => t.id);
      DADOS.exercicios = DADOS.exercicios.filter((e) => treinosIds.indexOf(e.treinoId) === -1);
      ["compras", "refeicoes", "planoSemanal", "treinos", "pesagens"].forEach((k) => { DADOS[k] = DADOS[k].filter((x) => x.usuarioId !== id); });
      DADOS.usuarios = DADOS.usuarios.filter((x) => x.id !== id);
      if (usuarioAtivo === id) { usuarioAtivo = ""; DADOS.config.usuarioAtivo = ""; }
      if (ROTA.secao === "detalhe-usuario") ROTA = { secao: "usuarios", param: null };
      salvarEAtualizar("Pessoa excluída.");
    });
  }

  // =========================================================================
  // COMPRAS
  // =========================================================================
  function renderCompras(d) {
    if (!d.usuarios.length) return semUsuarios();
    const u = uid();
    const todas = L.comprasDe(d, u);
    const pend = L.itensAComprar(d, u);
    const filtros = [
      { k: "pendentes", r: "🛒 Para comprar", n: pend.length },
      { k: "Feira", r: "🧺 Feira", n: pend.filter((c) => c.local === "Feira").length },
      { k: "Mercado", r: "🛒 Mercado", n: pend.filter((c) => c.local === "Mercado").length },
      { k: "Açougue", r: "🥩 Açougue", n: pend.filter((c) => c.local === "Açougue").length },
      { k: "comprados", r: "✅ Comprados", n: todas.filter((c) => c.status === "Comprado").length },
      { k: "todos", r: "Todos", n: todas.length }
    ];
    let lista;
    if (filtroCompras === "pendentes") lista = pend;
    else if (filtroCompras === "comprados") lista = todas.filter((c) => c.status === "Comprado");
    else if (filtroCompras === "todos") lista = todas;
    else lista = pend.filter((c) => c.local === filtroCompras);
    const total = lista.reduce((s, c) => s + L.precoTotal(c), 0);
    const abas = `<div class="abas-filtro">${filtros.map((f) => `<button class="${filtroCompras === f.k ? "ativo" : ""}" data-acao="filtro-compras" data-filtro="${f.k}">${f.r}<b>${f.n}</b></button>`).join("")}</div>`;
    const galeria = !lista.length ? `<div class="empty">Nada aqui. ${filtroCompras === "pendentes" ? "Sua lista está em dia — ou adicione um item com + NOVO." : ""}</div>` :
      `<div class="galeria">${lista.map((c) => galCardCompra(c)).join("")}</div>`;
    const porLocal = L.LOCAIS.map((l) => ({ nome: `${L.EMOJI_LOCAL[l]} ${l}`, valor: pend.filter((c) => c.local === l).reduce((s, c) => s + L.precoTotal(c), 0) })).filter((i) => i.valor > 0);
    return `${faixaDemo(d)}
      <div class="grid g-top"><div class="c12">${card("", "Lista de compras", `${tituloPessoas()} · clique no card para editar ou marcar como comprado`, botaoNovo("nova-compra"), abas + galeria,
        `<span class="dim">Total desta lista</span><b class="acc-laranja" style="font-size:14px;font-weight:800">${brl(total)}</b>`)}</div></div>
      <div class="grid">
        <div class="c4">${card("", "Quanto vou gastar", "itens pendentes por local", "", `<div class="body pad">${barList(porLocal)}</div>`, `<span class="dim">Estimativa</span><b>${brl(L.totalAComprar(d, u))}</b>`)}</div>
        <div class="c8">${card("", "Catálogo de produtos", `${d.produtos.length} ${plural(d.produtos.length, "produto", "produtos")} · preço de referência e histórico de preços`, botaoNovo("novo-produto", "NOVO PRODUTO"), tabelaCatalogo(d))}</div>
      </div>`;
  }
  function galCardCompra(c) {
    const st = c.status;
    return `<button class="gal-card ${c.prioridade === "Alta" && L.pendente(c) ? "alta" : ""} ${st === "Comprado" ? "comprado" : ""}" data-acao="editar-compra" data-id="${c.id}" title="Editar">
      <div class="gal-figura">${esc(c.emoji || L.EMOJI_CATEGORIA[c.categoria] || "📦")}</div>
      <div class="gal-corpo">
        <div class="gal-nome">${esc(c.nome)}</div>
        <div class="gal-preco">${brl(L.precoTotal(c))}</div>
        <div class="gal-sub">${num(c.quantidade, c.quantidade % 1 ? 1 : 0)} ${esc(c.unidade)} × ${brl(c.precoUnit)} · ${esc(L.EMOJI_LOCAL[c.local] || "")} ${esc(c.local || "")}</div>
        <div class="gal-selos">${selo(st, { acao: "ciclar-status-compra", id: c.id })}${L.pendente(c) ? selo(c.prioridade) : ""}${!usuarioAtivo ? seloPessoa(c.usuarioId) : ""}</div>
      </div></button>`;
  }
  function tabelaComprasCompacta(d, lista) {
    if (!lista.length) return `<div class="empty">Nada para comprar.</div>`;
    const grid = "grid-template-columns:1fr 90px 76px";
    return `<div class="hd" style="${grid}"><i>Item</i><i class="r">Total</i><i class="r">Status</i></div>` + lista.map((c) => `
      <button class="rw clicavel" style="${grid}" data-acao="editar-compra" data-id="${c.id}">
        <div><div class="nm">${esc(c.emoji || "")} ${esc(c.nome)}</div><div class="sub">${num(c.quantidade, c.quantidade % 1 ? 1 : 0)} ${esc(c.unidade)} · ${esc(c.local || "")}${!usuarioAtivo ? " · " + esc(F.nomeUsuario(d, c.usuarioId)) : ""}</div></div>
        <div class="r big">${brl(L.precoTotal(c))}</div>
        <div class="r">${selo(c.status, { acao: "ciclar-status-compra", id: c.id })}</div>
      </button>`).join("");
  }
  function tabelaCatalogo(d) {
    if (!d.produtos.length) return `<div class="empty">Cadastre cada produto uma vez (nome, categoria, preço de referência) e reaproveite na lista de compras.</div>`;
    const grid = "grid-template-columns:1.4fr 110px 90px 100px 100px 70px 80px";
    return `<div class="tabela-scroll"><div class="hd" style="${grid}"><i>Produto</i><i>Categoria</i><i class="r">Ref.</i><i class="r">Último pago</i><i class="r">Total gasto</i><i class="r">Vezes</i><i></i></div>` +
      d.produtos.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map((p) => { const r = L.resumoProduto(d, p); return `<div class="rw" style="${grid}">
        <div class="nm">${esc(p.emoji || L.EMOJI_CATEGORIA[p.categoria] || "📦")} ${esc(p.nome)} <span class="dim" style="font-weight:500">/${esc(p.unidade)}</span></div>
        <div class="dim">${esc(p.categoria || "—")}</div>
        <div class="r big">${brl(p.precoRef)}</div>
        <div class="r big ${r.ultimoPreco != null && p.precoRef ? (r.ultimoPreco > p.precoRef ? "down" : "up") : ""}">${r.ultimoPreco == null ? "—" : brl(r.ultimoPreco)}</div>
        <div class="r big">${brl(r.totalGasto)}</div>
        <div class="r big dim">${r.vezes}</div>
        <div class="r"><span class="cel-botoes"><button class="btn fantasma" data-acao="compra-do-produto" data-id="${p.id}" title="Adicionar à lista">${svg(ICONES.mais)}</button>${linhaAcoes("editar-produto", p.id, "excluir-produto")}</span></div>
      </div>`; }).join("") + `</div>`;
  }
  function ciclarStatusCompra(id) {
    const c = achar(DADOS.compras, id);
    if (!c) return;
    const ordem = ["Planejado", "Comprar", "Comprado", "Não comprado"];
    c.status = ordem[(ordem.indexOf(c.status) + 1) % ordem.length];
    if (c.status === "Comprado" && (!c.data || c.data > A.hoje(0))) c.data = A.hoje(0);
    salvarEAtualizar(`Status: ${c.status}.`);
  }
  function abrirModalCompra(id, base) {
    const c = id ? achar(DADOS.compras, id) : null;
    const prod = base && base.produtoId ? L.produto(DADOS, base.produtoId) : null;
    const ini = c || (prod ? { usuarioId: base.usuarioId, produtoId: prod.id, nome: prod.nome, emoji: prod.emoji, categoria: prod.categoria, local: prod.local, quantidade: 1, unidade: prod.unidade, precoUnit: prod.precoRef, status: "Comprar", prioridade: "Média", data: A.hoje(0) } :
      { usuarioId: (base && base.usuarioId) || usuarioAtivo || (F.usuariosAtivos(DADOS)[0] || {}).id, nome: "", categoria: "Outros", local: "Mercado", quantidade: 1, unidade: "un", precoUnit: 0, status: "Comprar", prioridade: "Média", data: A.hoje(0) });
    abrirModal(`
      <h3>${c ? "Editar item" : "Novo item da lista"}</h3>
      <div class="par">
        <div class="campo"><label for="f_usuario">Pessoa</label><select id="f_usuario">${opcoesUsuarios(ini.usuarioId)}</select></div>
        <div class="campo"><label for="f_produto">Produto do catálogo (opcional)</label><select id="f_produto"><option value="">— digitar manualmente —</option>${DADOS.produtos.map((p) => `<option value="${p.id}"${ini.produtoId === p.id ? " selected" : ""}>${esc(p.emoji || "")} ${esc(p.nome)}</option>`).join("")}</select></div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_nome">Nome do item</label><input id="f_nome" value="${esc(ini.nome)}" placeholder="Ex.: Arroz integral"></div>
        <div class="campo"><label for="f_emoji">Emoji (aparece no card)</label><input id="f_emoji" value="${esc(ini.emoji || "")}" placeholder="🍚" maxlength="4"></div>
      </div>
      <div class="par3">
        <div class="campo"><label for="f_qtd">Quantidade</label><input id="f_qtd" type="number" step="0.01" min="0" value="${ini.quantidade}"></div>
        <div class="campo"><label for="f_un">Unidade</label><select id="f_un">${opcoes(L.UNIDADES, ini.unidade)}</select></div>
        <div class="campo"><label for="f_preco">Preço unitário (R$)</label><input id="f_preco" type="number" step="0.01" min="0" value="${ini.precoUnit}"></div>
      </div>
      <div class="par3">
        <div class="campo"><label for="f_cat">Categoria</label><select id="f_cat">${opcoes(L.CATEGORIAS, ini.categoria)}</select></div>
        <div class="campo"><label for="f_local">Local</label><select id="f_local">${opcoes(L.LOCAIS, ini.local)}</select></div>
        <div class="campo"><label for="f_prio">Prioridade</label><select id="f_prio">${opcoes(L.PRIORIDADES, ini.prioridade)}</select></div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_status">Status</label><select id="f_status">${opcoes(L.STATUS_COMPRA, ini.status)}</select></div>
        <div class="campo"><label for="f_data">Data (compra ou prevista)</label><input id="f_data" type="date" value="${esc(ini.data || "")}"></div>
      </div>
      <div class="campo"><label for="f_obs">Observações</label><textarea id="f_obs" placeholder="Opcional">${esc(ini.obs || "")}</textarea></div>
      <p class="campo ajuda">Preço total = quantidade × preço unitário. Só entra em <b>Gastos</b> o que estiver com status <b>Comprado</b>.</p>
      ${botoesModal(!!c)}`, true);
    ligarCancelar();
    document.getElementById("f_produto").addEventListener("change", (e) => {
      const p = L.produto(DADOS, e.target.value);
      if (!p) return;
      document.getElementById("f_nome").value = p.nome; document.getElementById("f_emoji").value = p.emoji || "";
      document.getElementById("f_un").value = p.unidade; document.getElementById("f_preco").value = p.precoRef || 0;
      document.getElementById("f_cat").value = p.categoria; document.getElementById("f_local").value = p.local || "Mercado";
    });
    document.getElementById("btnSalvar").onclick = () => {
      const nome = valorTrim("f_nome");
      if (!nome) { toast("Informe o nome do item."); return; }
      if (!valor("f_usuario")) { toast("Escolha a pessoa."); return; }
      const reg = { id: c ? c.id : A.novoId(), usuarioId: valor("f_usuario"), produtoId: valor("f_produto") || null, nome, emoji: valorTrim("f_emoji"),
        categoria: valor("f_cat"), local: valor("f_local"), quantidade: numDec(valor("f_qtd")), unidade: valor("f_un"), precoUnit: numDec(valor("f_preco")),
        status: valor("f_status"), prioridade: valor("f_prio"), data: valor("f_data") || A.hoje(0), obs: valorTrim("f_obs") };
      if (c) Object.assign(c, reg); else DADOS.compras.push(reg);
      fecharModal();
      salvarEAtualizar(c ? "Item atualizado." : "Item adicionado à lista.");
    };
    if (c) document.getElementById("btnExcluir").onclick = () => { fecharModal(); confirmarExclusao("Excluir este item?", () => { DADOS.compras = DADOS.compras.filter((x) => x.id !== c.id); salvarEAtualizar("Item excluído."); }); };
  }
  function abrirModalProduto(id) {
    const p = id ? achar(DADOS.produtos, id) : null;
    abrirModal(`
      <h3>${p ? "Editar produto" : "Novo produto do catálogo"}</h3>
      <div class="par">
        <div class="campo"><label for="f_nome">Nome</label><input id="f_nome" value="${p ? esc(p.nome) : ""}" placeholder="Ex.: Aveia"></div>
        <div class="campo"><label for="f_emoji">Emoji</label><input id="f_emoji" value="${p ? esc(p.emoji || "") : ""}" placeholder="🌾" maxlength="4"></div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_cat">Categoria</label><select id="f_cat">${opcoes(L.CATEGORIAS, p ? p.categoria : "Outros")}</select></div>
        <div class="campo"><label for="f_local">Local habitual</label><select id="f_local">${opcoes(L.LOCAIS, p ? p.local : "Mercado")}</select></div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_un">Unidade padrão</label><select id="f_un">${opcoes(L.UNIDADES, p ? p.unidade : "un")}</select></div>
        <div class="campo"><label for="f_preco">Preço de referência (R$)</label><input id="f_preco" type="number" step="0.01" min="0" value="${p ? p.precoRef : ""}"></div>
      </div>
      ${botoesModal(!!p)}`);
    ligarCancelar();
    document.getElementById("btnSalvar").onclick = () => {
      const nome = valorTrim("f_nome");
      if (!nome) { toast("Informe o nome do produto."); return; }
      const reg = { id: p ? p.id : A.novoId(), nome, emoji: valorTrim("f_emoji"), categoria: valor("f_cat"), local: valor("f_local"), unidade: valor("f_un"), precoRef: numDec(valor("f_preco")) };
      if (p) Object.assign(p, reg); else DADOS.produtos.push(reg);
      fecharModal();
      salvarEAtualizar(p ? "Produto atualizado." : "Produto cadastrado.");
    };
    if (p) document.getElementById("btnExcluir").onclick = () => { fecharModal(); confirmarExclusao(`Excluir "${p.nome}" do catálogo? As compras já feitas continuam no histórico.`, () => { DADOS.produtos = DADOS.produtos.filter((x) => x.id !== p.id); salvarEAtualizar("Produto excluído."); }); };
  }

  // =========================================================================
  // GASTOS
  // =========================================================================
  function mesesDisponiveis(d) {
    const vistos = {};
    d.compras.forEach((c) => { if (c.data) vistos[F.mesDe(c.data)] = true; });
    vistos[F.mesAtual()] = true;
    return Object.keys(vistos).sort().reverse();
  }
  function seletorMes(idAcao, atual, meses) {
    return `<select class="sel" data-acao-mes="${idAcao}">${meses.map((m) => `<option value="${m}"${m === atual ? " selected" : ""}>${mesRotulo(m)}</option>`).join("")}</select>`;
  }
  function renderGastos(d) {
    if (!d.usuarios.length) return semUsuarios();
    const u = uid();
    const gasto = L.gastoNoMes(d, u, mesGastos);
    const dt = new Date(Number(mesGastos.slice(0, 4)), Number(mesGastos.slice(5, 7)) - 1, 1); dt.setMonth(dt.getMonth() - 1);
    const mesAnt = A.isoLocal(dt).slice(0, 7);
    const gastoAnt = L.gastoNoMes(d, u, mesAnt);
    const estimado = L.estimadoNoMes(d, u, mesGastos);
    const media = L.mediaMensal(d, u);
    const porCat = L.gastoPorCategoria(d, u, mesGastos).map((i) => ({ nome: `${L.EMOJI_CATEGORIA[i.nome] || ""} ${i.nome}`, valor: i.valor }));
    const porLocal = L.gastoPorLocal(d, u, mesGastos).map((i) => ({ nome: `${L.EMOJI_LOCAL[i.nome] || ""} ${i.nome}`, valor: i.valor }));
    const porProd = L.gastoPorProduto(d, u, mesGastos).slice(0, 8);
    const porPessoa = usuarioAtivo ? [] : L.gastoPorUsuario(d, mesGastos);
    const extrato = L.comprasNoMes(d, u, mesGastos).filter((c) => c.status === "Comprado");
    const maior = L.maiorCompra(d, u, mesGastos);
    const grid = "grid-template-columns:70px 1.4fr 110px 100px 90px 100px";
    const tabela = !extrato.length ? `<div class="empty">Nenhuma compra marcada como Comprado em ${mesRotulo(mesGastos)}.</div>` :
      `<div class="tabela-scroll"><div class="hd" style="${grid}"><i>Data</i><i>Item</i><i>Local</i><i>Pessoa</i><i class="r">Qtd</i><i class="r">Total</i></div>` +
      extrato.map((c) => `<button class="rw clicavel" style="${grid}" data-acao="editar-compra" data-id="${c.id}">
        <div class="big dim">${dataCurta(c.data)}</div><div class="nm">${esc(c.emoji || "")} ${esc(c.nome)} <span class="dim" style="font-weight:500">· ${esc(c.categoria)}</span></div>
        <div class="dim">${esc(c.local || "—")}</div><div>${seloPessoa(c.usuarioId)}</div>
        <div class="r big dim">${num(c.quantidade, c.quantidade % 1 ? 1 : 0)} ${esc(c.unidade)}</div><div class="r big">${brl(L.gastoReal(c))}</div>
      </button>`).join("") + `</div>`;
    return `${faixaDemo(d)}
      <div class="kpi-row">
        ${kpiCard("Gasto no mês", brl(gasto), estimado > 0 ? (gasto / estimado) * 100 : 0, "var(--down)", delta(L.variacaoPercentual(gasto, gastoAnt), "vs " + mesRotulo(mesAnt).split(" de ")[0], true), `Previsto na lista: ${brl(estimado)}`)}
        ${kpiCard("Mês anterior", brl(gastoAnt), null, "var(--dim)", "", mesRotulo(mesAnt))}
        ${kpiCard("Diferença entre meses", (gasto - gastoAnt >= 0 ? "+" : "−") + brl(Math.abs(gasto - gastoAnt)), null, gasto - gastoAnt > 0 ? "var(--down)" : "var(--up)", "", gasto - gastoAnt > 0 ? "gastou mais que no mês anterior" : "gastou menos que no mês anterior")}
        ${kpiCard("Média mensal", brl(media), media > 0 ? Math.min(100, (gasto / media) * 100) : 0, "var(--cy)", "", "média dos meses com compras registradas")}
        ${kpiCard("Maior compra", maior ? brl(L.gastoReal(maior)) : "—", null, "var(--acc)", "", maior ? `${esc(maior.nome)} · ${dataCurta(maior.data)}` : "sem compras no mês")}
      </div>
      <div class="grid">
        <div class="c8">${card("", "Gasto por mês", "real x previsto · últimos 6 meses", seletorMes("mes-gastos", mesGastos, mesesDisponiveis(d)), `<div style="padding:8px 14px 12px;height:240px"><canvas id="graf-gastos-mes"></canvas></div>`)}</div>
        <div class="c4">${card("", "Por categoria", mesRotulo(mesGastos), "", porCat.length ? `<div class="donut-wrap"><div class="donut-centro"><canvas id="graf-gastos-cat" width="150" height="150" style="width:150px;height:150px"></canvas><div class="donut-rotulo"><b>${brl(gasto).replace("R$", "").trim()}</b><span>TOTAL</span></div></div>
          <div class="legenda">${porCat.map((i, k) => `<div class="legenda-linha"><span class="legenda-nome"><span class="legenda-ponto" style="background:${G.PALETA_CATEGORIAS[k % G.PALETA_CATEGORIAS.length]}"></span>${esc(i.nome)}</span><span class="legenda-pct">${pct(gasto ? (i.valor / gasto) * 100 : 0)}</span><span class="legenda-val">${brl(i.valor)}</span></div>`).join("")}</div></div>` : `<div class="empty">Sem gastos no mês.</div>`)}</div>
      </div>
      <div class="grid">
        <div class="c4">${card("", "Feira × Mercado × outros", "por local", "", `<div class="body pad">${barList(porLocal, "var(--azul)")}</div>`)}</div>
        <div class="c4">${card("", "Por produto", "os 8 maiores", "", `<div class="body pad">${barList(porProd, "var(--acc)")}</div>`)}</div>
        <div class="c4">${usuarioAtivo ? card("", "Por pessoa", "escolha Todos no topo para comparar", "", `<div class="empty">Mostrando só ${esc(achar(d.usuarios, usuarioAtivo).nome)}.</div>`) : card("", "Por pessoa", mesRotulo(mesGastos), "", `<div class="body pad">${barList(porPessoa)}</div>`)}</div>
      </div>
      <div class="grid"><div class="c12">${card("", "Extrato de compras", `${mesRotulo(mesGastos)} · ${extrato.length} ${plural(extrato.length, "compra", "compras")}`, "", tabela, `<span class="dim">Total do mês</span><b class="acc-laranja" style="font-size:14px;font-weight:800">${brl(gasto)}</b>`)}</div></div>`;
  }

  // =========================================================================
  // ALIMENTAÇÃO (refeições por horário)
  // =========================================================================
  function timelineDia(d, usuarioId, data, compacta) {
    const blocos = L.blocosDoDia(d, usuarioId, data);
    if (!blocos.length) return `<div class="empty">Nenhuma refeição ${data === A.hoje(0) ? "hoje" : "neste dia"}.${compacta ? "" : ` <br><button class="btn pequeno primario" data-acao="nova-refeicao" data-data="${data}">+ Planejar refeição</button> ${data !== A.hoje(0) || true ? `<button class="btn pequeno" data-acao="duplicar-dia" data-data="${data}">Copiar de outro dia</button>` : ""}`}</div>`;
    return `<div class="timeline">` + blocos.map((b) => {
      const todosFeitos = b.itens.every((i) => i.status === "Realizada");
      return `<div class="tl-bloco ${todosFeitos ? "feito" : ""}">
        <div class="tl-hora">${esc(b.horario || "--:--")}</div>
        <div class="tl-trilho"><span class="tl-ponto"></span></div>
        <div class="tl-corpo">
          <div class="tl-tipo">${esc(L.EMOJI_REFEICAO[b.tipo] || "🍽️")} ${esc(b.tipo || "Refeição")}${!usuarioAtivo && !compacta ? " · " + b.itens.map((i) => i.usuarioId).filter((v, k, a) => a.indexOf(v) === k).map(seloPessoa).join(" ") : ""}</div>
          <div class="tl-itens">${b.itens.map((i) => `<button class="tl-item ${i.status === "Realizada" ? "feito" : i.status === "Pulada" ? "pulado" : ""}" data-acao="ciclar-status-refeicao" data-id="${i.id}" title="Clique: Planejada → Realizada → Pulada. Botão direito: editar" oncontextmenu="return false">${esc(i.emoji || "")} ${esc(i.alimento)} <small>${num(i.quantidade, i.quantidade % 1 ? 1 : 0)} ${esc(i.unidade)}</small></button>`).join("")}
            ${compacta ? "" : `<button class="tl-item" data-acao="nova-refeicao" data-data="${data}" data-horario="${esc(b.horario)}" data-tipo="${esc(b.tipo)}" title="Adicionar alimento nesta refeição">+</button>`}
          </div>
        </div>
      </div>`;
    }).join("") + `</div>`;
  }
  function renderAlimentacao(d) {
    if (!d.usuarios.length) return semUsuarios();
    const u = uid();
    const dia = dataAlimentacao;
    const refs = L.refeicoesNoDia(d, u, dia);
    const feitas = refs.filter((r) => r.status === "Realizada").length;
    const semana = L.refeicoesNaSemana(d, u);
    const porTipo = L.TIPOS_REFEICAO.map((t) => ({ nome: `${L.EMOJI_REFEICAO[t]} ${t}`, valor: L.refeicoesNoMes(d, u).filter((r) => r.tipo === t).length })).filter((i) => i.valor);
    const navDia = `<div class="filtro-mes"><button class="btn pequeno" data-acao="dia-alimentacao" data-delta="-1">‹</button><input type="date" class="sel" value="${dia}" data-acao-data="dia-alimentacao"><button class="btn pequeno" data-acao="dia-alimentacao" data-delta="1">›</button><button class="btn pequeno ${dia === A.hoje(0) ? "primario" : ""}" data-acao="dia-alimentacao" data-hoje="1">Hoje</button></div>`;
    const grid = "grid-template-columns:64px 1fr 120px 90px 90px 76px";
    const listaRefs = !refs.length ? "" : `<div class="tabela-scroll"><div class="hd" style="${grid}"><i>Hora</i><i>Alimento</i><i>Refeição</i><i class="r">Porção</i><i>Pessoa</i><i></i></div>` +
      refs.map((r) => `<div class="rw" style="${grid}"><div class="big acc-laranja">${esc(r.horario)}</div><div class="nm">${esc(r.emoji || "")} ${esc(r.alimento)}</div><div class="dim">${esc(r.tipo)}</div>
        <div class="r big">${num(r.quantidade, r.quantidade % 1 ? 1 : 0)} ${esc(r.unidade)}</div><div>${seloPessoa(r.usuarioId)}</div><div class="r">${linhaAcoes("editar-refeicao", r.id, "excluir-refeicao")}</div></div>`).join("") + `</div>`;
    return `${faixaDemo(d)}
      <div class="kpi-row">
        ${kpiCard("Refeições do dia", `${feitas}<span class="dim" style="font-size:14px"> / ${refs.length}</span>`, refs.length ? (feitas / refs.length) * 100 : 0, "var(--cy)", "", `${rotuloRelativo(dia)} · ${dataBR(dia)}`)}
        ${kpiCard("Na semana", String(semana.length), null, "var(--up)", "", `alimentos registrados de ${dataCurta(F.inicioSemana())} a ${dataCurta(F.fimSemana())}`)}
        ${kpiCard("No mês", String(L.refeicoesNoMes(d, u).length), null, "var(--azul)", "", mesRotulo(F.mesAtual()))}
        ${kpiCard("Próxima refeição", (() => { const p = pessoas().map((x) => L.proximaRefeicao(d, x.id)).filter(Boolean).sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario))[0]; return p ? esc(p.horario) : "—"; })(), null, "var(--acc)", "", (() => { const p = pessoas().map((x) => L.proximaRefeicao(d, x.id)).filter(Boolean).sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario))[0]; return p ? `${esc(p.tipo)} · ${p.itens.map((i) => esc(i.alimento)).join(", ")}` : "nada planejado"; })())}
      </div>
      <div class="grid">
        <div class="c8">${card("", "Cronograma do dia", `${tituloPessoas()} · clique no alimento para marcar como realizado`, navDia + ` ${botaoNovo("nova-refeicao", "NOVA")} <button class="btn" data-acao="duplicar-dia" data-data="${dia}" title="Copiar as refeições de um dia para outro">${svg(ICONES.copiar)}<span class="btn-txt">Repetir dia</span></button>`,
          timelineDia(d, u, dia, false))}</div>
        <div class="c4">${card("", "Horários sugeridos", "padrão ao criar uma refeição", "", L.TIPOS_REFEICAO.map((t) => `<div class="kv"><span>${esc(L.EMOJI_REFEICAO[t])} ${esc(t)}</span><b>${esc(L.HORARIO_SUGERIDO[t])}</b></div>`).join(""))}
        <div style="height:14px"></div>${card("", "Refeições no mês por tipo", "quantidade de alimentos", "", `<div class="body pad">${barList(porTipo, "var(--cy)", (v) => String(v))}</div>`)}</div>
      </div>
      ${listaRefs ? `<div class="grid"><div class="c12">${card("", "Lista do dia", "editar ou excluir", "", listaRefs)}</div></div>` : ""}`;
  }
  function ciclarStatusRefeicao(id) {
    const r = achar(DADOS.refeicoes, id);
    if (!r) return;
    const ordem = ["Planejada", "Realizada", "Pulada"];
    r.status = ordem[(ordem.indexOf(r.status) + 1) % ordem.length];
    salvarEAtualizar(`${r.alimento}: ${r.status}.`);
  }
  function abrirModalRefeicao(id, base) {
    const r = id ? achar(DADOS.refeicoes, id) : null;
    base = base || {};
    const tipoIni = r ? r.tipo : (base.tipo || "Café da manhã");
    const ini = r || { usuarioId: base.usuarioId || usuarioAtivo || (F.usuariosAtivos(DADOS)[0] || {}).id, data: base.data || dataAlimentacao || A.hoje(0), horario: base.horario || L.HORARIO_SUGERIDO[tipoIni], tipo: tipoIni, alimento: "", emoji: "", quantidade: 1, unidade: "porção", status: "Planejada", obs: "" };
    abrirModal(`
      <h3>${r ? "Editar alimento" : "Novo alimento da refeição"}</h3>
      <div class="par">
        <div class="campo"><label for="f_usuario">Pessoa</label><select id="f_usuario">${opcoesUsuarios(ini.usuarioId)}</select></div>
        <div class="campo"><label for="f_data">Data</label><input id="f_data" type="date" value="${esc(ini.data)}"></div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_tipo">Refeição</label><select id="f_tipo">${opcoes(L.TIPOS_REFEICAO, ini.tipo)}</select></div>
        <div class="campo"><label for="f_hora">Horário</label><input id="f_hora" type="time" value="${esc(ini.horario)}"></div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_alimento">Alimento</label><input id="f_alimento" value="${esc(ini.alimento)}" placeholder="Ex.: Ovos mexidos"></div>
        <div class="campo"><label for="f_emoji">Emoji</label><input id="f_emoji" value="${esc(ini.emoji || "")}" placeholder="🥚" maxlength="4"></div>
      </div>
      <div class="par3">
        <div class="campo"><label for="f_qtd">Quantidade</label><input id="f_qtd" type="number" step="0.5" min="0" value="${ini.quantidade}"></div>
        <div class="campo"><label for="f_un">Unidade</label><select id="f_un">${opcoes(L.UNIDADES_REFEICAO, ini.unidade)}</select></div>
        <div class="campo"><label for="f_status">Status</label><select id="f_status">${opcoes(L.STATUS_REFEICAO, ini.status)}</select></div>
      </div>
      <div class="campo"><label for="f_obs">Observações</label><textarea id="f_obs" placeholder="Opcional">${esc(ini.obs || "")}</textarea></div>
      ${botoesModal(!!r)}`);
    ligarCancelar();
    document.getElementById("f_tipo").addEventListener("change", (e) => { if (!r) document.getElementById("f_hora").value = L.HORARIO_SUGERIDO[e.target.value] || ""; });
    document.getElementById("btnSalvar").onclick = () => {
      const alimento = valorTrim("f_alimento");
      if (!alimento) { toast("Informe o alimento."); return; }
      const reg = { id: r ? r.id : A.novoId(), usuarioId: valor("f_usuario"), data: valor("f_data") || A.hoje(0), horario: valor("f_hora") || "12:00", tipo: valor("f_tipo"), alimento, emoji: valorTrim("f_emoji"),
        quantidade: numDec(valor("f_qtd")), unidade: valor("f_un"), status: valor("f_status"), obs: valorTrim("f_obs") };
      if (r) Object.assign(r, reg); else DADOS.refeicoes.push(reg);
      dataAlimentacao = reg.data;
      fecharModal();
      salvarEAtualizar(r ? "Alimento atualizado." : "Alimento adicionado.");
    };
    if (r) document.getElementById("btnExcluir").onclick = () => { fecharModal(); confirmarExclusao("Excluir este alimento da refeição?", () => { DADOS.refeicoes = DADOS.refeicoes.filter((x) => x.id !== r.id); salvarEAtualizar("Excluído."); }); };
  }
  function abrirModalDuplicarDia(dataAlvo) {
    const uIni = usuarioAtivo || (F.usuariosAtivos(DADOS)[0] || {}).id;
    abrirModal(`
      <h3>Repetir refeições de um dia</h3>
      <div class="campo"><label for="f_usuario">Pessoa</label><select id="f_usuario">${opcoesUsuarios(uIni)}</select></div>
      <div class="par">
        <div class="campo"><label for="f_de">Copiar as refeições de</label><input id="f_de" type="date" value="${A.hoje(0)}"></div>
        <div class="campo"><label for="f_para">Para o dia</label><input id="f_para" type="date" value="${esc(dataAlvo || A.hoje(1))}"></div>
      </div>
      <p class="campo ajuda">Todos os alimentos do dia de origem são copiados como <b>Planejada</b>. Depois é só ajustar o que mudar.</p>
      <div class="modal-acoes"><button class="btn primario salvar" id="btnSalvar">Copiar</button><button class="btn" id="btnCancelar">Cancelar</button></div>`);
    ligarCancelar();
    document.getElementById("btnSalvar").onclick = () => {
      const n = L.duplicarDia(DADOS, valor("f_usuario"), valor("f_de"), valor("f_para"));
      if (!n) { toast("O dia de origem não tem refeições."); return; }
      dataAlimentacao = valor("f_para");
      fecharModal();
      salvarEAtualizar(`${n} ${plural(n, "alimento copiado", "alimentos copiados")}.`);
    };
  }

  // =========================================================================
  // ACADEMIA (treinos + exercícios)
  // =========================================================================
  function tabelaTreinos(d, lista, compacta) {
    if (!lista.length) return `<div class="empty">Nenhum treino aqui.</div>`;
    const grid = compacta ? "grid-template-columns:54px 1fr 92px" : "grid-template-columns:64px 1.3fr 1fr 150px 100px 100px 76px";
    let html = compacta ? "" : `<div class="hd" style="${grid}"><i>Data</i><i>Treino</i><i>Grupos</i><i>Pessoa</i><i class="r">Progresso</i><i class="r">Status</i><i></i></div>`;
    html += lista.map((t) => {
      const p = F.progressoTreino(d, t.id);
      if (compacta) return `<button class="rw clicavel" style="${grid}" data-acao="ir" data-secao="detalhe-treino" data-id="${t.id}">
        <div class="big acc-laranja">${dataCurta(t.data)}</div>
        <div><div class="nm">${esc(t.nome)}</div><div class="sub">${rotuloRelativo(t.data)}${!usuarioAtivo ? " · " + esc(F.nomeUsuario(d, t.usuarioId)) : ""}${p.total ? ` · ${p.feitos}/${p.total} exerc.` : ""}</div></div>
        <div class="r">${selo(t.status, { acao: "ciclar-status-treino", id: t.id })}</div></button>`;
      return `<div class="rw clicavel" style="${grid}" data-acao="ir" data-secao="detalhe-treino" data-id="${t.id}">
        <div class="big acc-laranja">${dataCurta(t.data)}</div>
        <div><div class="nm">${esc(t.nome)}</div><div class="sub">${rotuloRelativo(t.data)} · ${t.duracao || 0} min</div></div>
        <div class="dim" style="font-size:12px">${(t.grupos || []).map((g) => `<span class="selo-tag selo-neutro" style="margin:1px 2px 1px 0">${esc(g)}</span>`).join("") || "—"}</div>
        <div>${seloPessoa(t.usuarioId)}</div>
        <div class="r"><div class="prog-linha"><span class="progresso fina"><i style="width:${p.pct}%;background:var(--up)"></i></span><span>${p.total ? `${p.feitos}/${p.total}` : "—"}</span></div></div>
        <div class="r">${selo(t.status, { acao: "ciclar-status-treino", id: t.id })}</div>
        <div class="r">${linhaAcoes("editar-treino", t.id, "excluir-treino")}</div></div>`;
    }).join("");
    return compacta ? html : `<div class="tabela-scroll">${html}</div>`;
  }
  function renderAcademia(d) {
    if (!d.usuarios.length) return semUsuarios();
    const u = uid();
    const hojeStr = A.hoje(0);
    const todos = F.treinosDe(d, u);
    const hoje = todos.filter((t) => t.data === hojeStr);
    const proximos = todos.filter((t) => t.data > hojeStr && t.status !== "Cancelado");
    const passados = todos.filter((t) => t.data < hojeStr).slice().reverse();
    const semana = pessoas().reduce((s, x) => { const t = F.treinosNaSemana(d, x.id); s.feitos += t.feitos; s.plan += t.planejados; return s; }, { feitos: 0, plan: 0 });
    const mes = pessoas().reduce((s, x) => s + F.treinosNoMes(d, x.id), 0);
    const mesAnt = pessoas().reduce((s, x) => s + F.treinosNoMes(d, x.id, F.mesAnterior()), 0);
    const grupos = (() => { const m = {}; pessoas().forEach((x) => F.treinosPorGrupo(d, x.id).forEach((g) => { m[g.grupo] = (m[g.grupo] || 0) + g.valor; })); return Object.keys(m).map((k) => ({ nome: k, valor: m[k] })).sort((a, b) => b.valor - a.valor); })();
    const planoHoje = pessoas().map((x) => ({ u: x, t: F.treinoDeHoje(d, x.id) })).filter((p) => p.t && p.t.origem === "plano");
    const volumeMes = todos.filter((t) => F.mesDe(t.data) === F.mesAtual() && t.status === "Realizado").reduce((s, t) => s + F.volumeTreino(d, t.id), 0);
    return `${faixaDemo(d)}
      <div class="kpi-row">
        ${kpiCard("Treinos na semana", `${semana.feitos}<span class="dim" style="font-size:14px"> / ${semana.plan}</span>`, semana.plan ? (semana.feitos / semana.plan) * 100 : 0, "var(--up)", "", `${dataCurta(F.inicioSemana())} a ${dataCurta(F.fimSemana())}`)}
        ${kpiCard("Treinos no mês", String(mes), null, "var(--cy)", delta(L.variacaoPercentual(mes, mesAnt), "vs mês anterior"), `mês anterior: ${mesAnt}`)}
        ${kpiCard("Últimos 7 dias", String(pessoas().reduce((s, x) => s + F.treinosUltimos7Dias(d, x.id), 0)), null, "var(--azul)", "", "treinos realizados")}
        ${kpiCard("Volume no mês", `${num(volumeMes, 0)} <span class="dim" style="font-size:14px">kg</span>`, null, "var(--vi)", "", "séries × repetições × carga")}
        ${kpiCard("Hoje", hoje.length ? `${hoje.filter((t) => t.status === "Realizado").length}<span class="dim" style="font-size:14px"> / ${hoje.length}</span>` : (planoHoje.length ? String(planoHoje.length) : "—"), null, "var(--acc)", "", hoje.length ? "treinos de hoje realizados" : planoHoje.length ? "previstos no plano semanal" : "nada planejado para hoje")}
      </div>
      <div class="grid">
        <div class="c8">${card("", "Hoje e próximos", `${tituloPessoas()} · clique no treino para ver os exercícios`, botaoNovo("novo-treino", "NOVO TREINO"),
          (planoHoje.length ? `<div class="alertas-lista" style="padding-top:12px">${planoHoje.map((p) => `<div class="alerta-card info"><span class="ic">${svg(ICONE_ALERTA.info)}</span><div><b>Plano de hoje · ${esc(p.u.nome)}</b><p>${esc(p.t.nome)}${p.t.horario ? " às " + esc(p.t.horario) : ""}. <button class="link-acao" data-acao="iniciar-plano" data-id="${p.t.id}">Iniciar este treino →</button></p></div></div>`).join("")}</div>` : "") +
          tabelaTreinos(d, hoje.concat(proximos), false))}</div>
        <div class="c4">${card("", "Grupos musculares", "treinos realizados", "", grupos.length ? `<div class="donut-wrap"><div class="donut-centro"><canvas id="graf-grupos" width="150" height="150" style="width:150px;height:150px"></canvas><div class="donut-rotulo"><b>${grupos.reduce((s, g) => s + g.valor, 0)}</b><span>TREINOS</span></div></div>
          <div class="legenda">${grupos.slice(0, 7).map((g, k) => `<div class="legenda-linha"><span class="legenda-nome"><span class="legenda-ponto" style="background:${G.PALETA_CATEGORIAS[k % G.PALETA_CATEGORIAS.length]}"></span>${esc(g.nome)}</span><span class="legenda-pct">${g.valor}</span><span class="legenda-val"></span></div>`).join("")}</div></div>` : `<div class="empty">Nenhum treino realizado ainda.</div>`)}</div>
      </div>
      <div class="grid">
        <div class="c8">${card("", "Histórico", `${passados.length} ${plural(passados.length, "treino", "treinos")}`, "", tabelaTreinos(d, passados.slice(0, 30), false))}</div>
        <div class="c4">${card("", "Treinos por mês", "realizados · 6 meses", "", `<div style="padding:8px 14px 12px;height:230px"><canvas id="graf-treinos-mes"></canvas></div>`)}</div>
      </div>`;
  }
  function renderDetalheTreino(d, id) {
    const t = achar(d.treinos, id);
    if (!t) return voltar("academia") + `<div class="empty">Treino não encontrado.</div>`;
    const exs = F.exerciciosDoTreino(d, t.id);
    const p = F.progressoTreino(d, t.id);
    const vol = F.volumeTreino(d, t.id);
    const grid = "grid-template-columns:34px 1.4fr 110px 70px 70px 90px 80px 76px";
    const tabela = !exs.length ? `<div class="empty">Nenhum exercício ainda. Adicione com "+ EXERCÍCIO".</div>` :
      `<div class="tabela-scroll"><div class="hd" style="${grid}"><i></i><i>Exercício</i><i>Grupo</i><i class="r">Séries</i><i class="r">Reps</i><i class="r">Carga</i><i class="r">Descanso</i><i></i></div>` +
      exs.map((e) => `<div class="rw" style="${grid}">
        <div><button class="ex-status ${e.status === "Feito" ? "feito" : e.status === "Pulado" ? "pulado" : ""}" data-acao="ciclar-status-exercicio" data-id="${e.id}" title="${esc(e.status)} — clique para mudar">${e.status === "Feito" ? "✓" : e.status === "Pulado" ? "–" : ""}</button></div>
        <div><div class="nm">${esc(e.nome)}</div>${e.obs ? `<div class="sub">${esc(e.obs)}</div>` : ""}</div>
        <div class="dim">${esc(e.grupo || "—")}</div>
        <div class="r big">${e.series || 0}</div><div class="r big">${e.repeticoes || 0}</div>
        <div class="r big acc-laranja">${e.carga ? num(e.carga, e.carga % 1 ? 1 : 0) + " kg" : "—"}</div>
        <div class="r big dim">${esc(e.descanso || "—")}</div>
        <div class="r">${linhaAcoes("editar-exercicio", e.id, "excluir-exercicio")}</div>
      </div>`).join("") + `</div>`;
    return `
      ${voltar("academia", "Academia")}
      <div class="kpi-row">
        ${kpiCard("Progresso", `${p.feitos}<span class="dim" style="font-size:14px"> / ${p.total}</span>`, p.pct, "var(--up)", "", "exercícios feitos")}
        ${kpiCard("Volume total", `${num(vol, 0)} <span class="dim" style="font-size:14px">kg</span>`, null, "var(--cy)", "", "séries × repetições × carga")}
        ${kpiCard("Duração", `${t.duracao || 0} <span class="dim" style="font-size:14px">min</span>`, null, "var(--azul)", "", dataBR(t.data))}
        ${kpiCard("Status", selo(t.status, { acao: "ciclar-status-treino", id: t.id }), null, "var(--acc)", "", "clique no selo para mudar")}
      </div>
      <div class="grid">
        <div class="c12">${card("", esc(t.nome), `${seloPessoa(t.usuarioId)} · ${(t.grupos || []).join(", ") || "sem grupo"} · ${rotuloRelativo(t.data)}`,
          `<button class="btn" data-acao="duplicar-treino" data-id="${t.id}" title="Copiar este treino com os exercícios para outra data">${svg(ICONES.copiar)}<span class="btn-txt">Repetir treino</span></button>
           <button class="btn" data-acao="editar-treino" data-id="${t.id}">${svg(ICONES.editar)}<span class="btn-txt">Editar</span></button>
           ${botaoNovo("novo-exercicio", "EXERCÍCIO")}`, tabela,
          `<span class="dim">Observações</span><b style="font-family:var(--ui);font-weight:500">${esc(t.obs || "—")}</b>`)}</div>
      </div>
      ${F.nomesExercicios(d, t.usuarioId).length ? `<div class="grid"><div class="c12">${card("", "Evolução da carga", "por exercício · todos os treinos desta pessoa", `<select class="sel" data-acao-carga="1">${F.nomesExercicios(d, t.usuarioId).map((n) => `<option value="${esc(n)}"${(exercicioCarga || (exs[0] || {}).nome) === n ? " selected" : ""}>${esc(n)}</option>`).join("")}</select>`,
        `<div style="padding:8px 14px 12px;height:220px"><canvas id="graf-carga" data-usuario="${t.usuarioId}"></canvas></div>`)}</div></div>` : ""}`;
  }
  function ciclarStatusTreino(id) {
    const t = achar(DADOS.treinos, id);
    if (!t) return;
    const ordem = ["Planejado", "Realizado", "Adiado", "Cancelado"];
    t.status = ordem[(ordem.indexOf(t.status) + 1) % ordem.length];
    if (t.status === "Realizado") F.exerciciosDoTreino(DADOS, t.id).forEach((e) => { if (e.status === "Pendente") e.status = "Feito"; });
    salvarEAtualizar(`${t.nome}: ${t.status}.`);
  }
  function ciclarStatusExercicio(id) {
    const e = achar(DADOS.exercicios, id);
    if (!e) return;
    const ordem = ["Pendente", "Feito", "Pulado"];
    e.status = ordem[(ordem.indexOf(e.status) + 1) % ordem.length];
    salvarEAtualizar();
  }
  function abrirModalTreino(id, base) {
    const t = id ? achar(DADOS.treinos, id) : null;
    base = base || {};
    const ini = t || { usuarioId: base.usuarioId || usuarioAtivo || (F.usuariosAtivos(DADOS)[0] || {}).id, nome: base.nome || "", data: base.data || A.hoje(0), grupos: base.grupos || [], status: "Planejado", duracao: 60, obs: "" };
    abrirModal(`
      <h3>${t ? "Editar treino" : "Novo treino"}</h3>
      <div class="par">
        <div class="campo"><label for="f_usuario">Pessoa</label><select id="f_usuario">${opcoesUsuarios(ini.usuarioId)}</select></div>
        <div class="campo"><label for="f_data">Data</label><input id="f_data" type="date" value="${esc(ini.data)}"></div>
      </div>
      <div class="campo"><label for="f_nome">Nome do treino</label><input id="f_nome" value="${esc(ini.nome)}" placeholder="Ex.: Treino de Peito" list="lista-treinos"><datalist id="lista-treinos">${DADOS.planoSemanal.map((p) => p.treino).filter((v, k, a) => a.indexOf(v) === k).map((n) => `<option value="${esc(n)}">`).join("")}</datalist></div>
      <div class="par">
        <div class="campo"><label for="f_grupos">Grupos musculares (Ctrl/⌘ para vários)</label><select id="f_grupos" multiple size="5">${F.GRUPOS_MUSCULARES.map((g) => `<option value="${g}"${(ini.grupos || []).indexOf(g) !== -1 ? " selected" : ""}>${g}</option>`).join("")}</select></div>
        <div>
          <div class="campo"><label for="f_status">Status</label><select id="f_status">${opcoes(F.STATUS_TREINO, ini.status)}</select></div>
          <div class="campo"><label for="f_dur">Duração (min)</label><input id="f_dur" type="number" min="0" step="5" value="${ini.duracao || 60}"></div>
        </div>
      </div>
      <div class="campo"><label for="f_obs">Observações</label><textarea id="f_obs" placeholder="Ex.: Aumentar carga no supino na próxima semana">${esc(ini.obs || "")}</textarea></div>
      ${botoesModal(!!t)}`);
    ligarCancelar();
    document.getElementById("btnSalvar").onclick = () => {
      const nome = valorTrim("f_nome");
      if (!nome) { toast("Informe o nome do treino."); return; }
      const reg = { id: t ? t.id : A.novoId(), usuarioId: valor("f_usuario"), nome, data: valor("f_data") || A.hoje(0), grupos: multiplos("f_grupos"), status: valor("f_status"), duracao: numDec(valor("f_dur")), obs: valorTrim("f_obs") };
      if (t) Object.assign(t, reg); else DADOS.treinos.push(reg);
      fecharModal();
      salvarEAtualizar(t ? "Treino atualizado." : "Treino criado.");
      if (!t) navegarPara("detalhe-treino", reg.id);
    };
    if (t) document.getElementById("btnExcluir").onclick = () => { fecharModal(); excluirTreino(t.id); };
  }
  function excluirTreino(id) {
    const t = achar(DADOS.treinos, id);
    if (!t) return;
    confirmarExclusao(`Excluir "${t.nome}" e seus exercícios?`, () => {
      DADOS.exercicios = DADOS.exercicios.filter((e) => e.treinoId !== id);
      DADOS.treinos = DADOS.treinos.filter((x) => x.id !== id);
      if (ROTA.secao === "detalhe-treino") ROTA = { secao: "academia", param: null };
      salvarEAtualizar("Treino excluído.");
    });
  }
  function duplicarTreino(id) {
    const t = achar(DADOS.treinos, id);
    if (!t) return;
    abrirModal(`
      <h3>Repetir treino</h3>
      <p class="campo ajuda" style="margin-top:0">Copia "<b>${esc(t.nome)}</b>" com todos os exercícios (séries, repetições e carga) para a data escolhida, como Planejado.</p>
      <div class="campo"><label for="f_data">Nova data</label><input id="f_data" type="date" value="${A.hoje(7)}"></div>
      <div class="modal-acoes"><button class="btn primario salvar" id="btnSalvar">Copiar</button><button class="btn" id="btnCancelar">Cancelar</button></div>`);
    ligarCancelar();
    document.getElementById("btnSalvar").onclick = () => {
      const novo = Object.assign({}, t, { id: A.novoId(), data: valor("f_data") || A.hoje(7), status: "Planejado", grupos: (t.grupos || []).slice() });
      DADOS.treinos.push(novo);
      F.exerciciosDoTreino(DADOS, t.id).forEach((e) => DADOS.exercicios.push(Object.assign({}, e, { id: A.novoId(), treinoId: novo.id, status: "Pendente" })));
      fecharModal();
      salvarEAtualizar("Treino copiado.");
      navegarPara("detalhe-treino", novo.id);
    };
  }
  function iniciarDoPlano(planoId) {
    const p = achar(DADOS.planoSemanal, planoId);
    if (!p) return;
    const t = F.treinoAPartirDoPlano(p);
    DADOS.treinos.push(t);
    salvarEAtualizar("Treino de hoje criado a partir do plano.");
    navegarPara("detalhe-treino", t.id);
  }
  function abrirModalExercicio(id, treinoId) {
    const e = id ? achar(DADOS.exercicios, id) : null;
    const tId = e ? e.treinoId : treinoId;
    const t = achar(DADOS.treinos, tId);
    const ini = e || { nome: "", grupo: (t && t.grupos && t.grupos[0]) || "Peito", series: 3, repeticoes: 12, carga: 0, descanso: "60s", status: "Pendente", obs: "" };
    abrirModal(`
      <h3>${e ? "Editar exercício" : "Novo exercício"}</h3>
      <div class="par">
        <div class="campo"><label for="f_nome">Exercício</label><input id="f_nome" value="${esc(ini.nome)}" placeholder="Ex.: Supino reto" list="lista-ex"><datalist id="lista-ex">${F.nomesExercicios(DADOS, t ? t.usuarioId : null).map((n) => `<option value="${esc(n)}">`).join("")}</datalist></div>
        <div class="campo"><label for="f_grupo">Grupo muscular</label><select id="f_grupo">${opcoes(F.GRUPOS_MUSCULARES, ini.grupo)}</select></div>
      </div>
      <div class="par3">
        <div class="campo"><label for="f_series">Séries</label><input id="f_series" type="number" min="0" value="${ini.series}"></div>
        <div class="campo"><label for="f_reps">Repetições</label><input id="f_reps" type="number" min="0" value="${ini.repeticoes}"></div>
        <div class="campo"><label for="f_carga">Carga (kg)</label><input id="f_carga" type="number" min="0" step="0.5" value="${ini.carga}"></div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_desc">Descanso</label><input id="f_desc" value="${esc(ini.descanso || "")}" placeholder="60s"></div>
        <div class="campo"><label for="f_status">Status</label><select id="f_status">${opcoes(F.STATUS_EXERCICIO, ini.status)}</select></div>
      </div>
      <div class="campo"><label for="f_obs">Observações</label><textarea id="f_obs" placeholder="Ex.: senti facilidade, subir 2 kg">${esc(ini.obs || "")}</textarea></div>
      ${botoesModal(!!e)}`);
    ligarCancelar();
    document.getElementById("btnSalvar").onclick = () => {
      const nome = valorTrim("f_nome");
      if (!nome) { toast("Informe o exercício."); return; }
      const reg = { id: e ? e.id : A.novoId(), treinoId: tId, nome, grupo: valor("f_grupo"), series: numDec(valor("f_series")), repeticoes: numDec(valor("f_reps")), carga: numDec(valor("f_carga")), descanso: valorTrim("f_desc"), status: valor("f_status"), obs: valorTrim("f_obs") };
      if (e) Object.assign(e, reg); else DADOS.exercicios.push(reg);
      fecharModal();
      salvarEAtualizar(e ? "Exercício atualizado." : "Exercício adicionado.");
    };
    if (e) document.getElementById("btnExcluir").onclick = () => { fecharModal(); confirmarExclusao("Excluir este exercício?", () => { DADOS.exercicios = DADOS.exercicios.filter((x) => x.id !== e.id); salvarEAtualizar("Exercício excluído."); }); };
  }

  // =========================================================================
  // MINHA SEMANA (plano semanal)
  // =========================================================================
  function planoLista(d, usuarioId) {
    const plano = F.planoDe(d, usuarioId);
    const hojeDia = F.diaSemanaDe();
    return [1, 2, 3, 4, 5, 6, 7].map((dia) => {
      const itens = plano.filter((p) => Number(p.diaSemana) === dia);
      return `<div class="kv" style="${dia === hojeDia ? "background:rgba(0,229,255,.06)" : ""}"><span class="${dia === hojeDia ? "acc-laranja" : ""}">${F.NOMES_DIA[dia]}${dia === hojeDia ? " · hoje" : ""}</span><b>${itens.length ? itens.map((p) => esc(p.treino) + (p.horario ? ` <span class="dim">${esc(p.horario)}</span>` : "")).join(", ") : `<span class="dim">Descanso</span>`}</b></div>`;
    }).join("");
  }
  function renderSemana(d) {
    if (!d.usuarios.length) return semUsuarios();
    const lista = pessoas();
    const hojeDia = F.diaSemanaDe();
    const cols = [1, 2, 3, 4, 5, 6, 7].map((dia) => {
      const itens = lista.map((u) => F.planoDoDia(d, u.id, dia).map((p) => ({ p, u }))).reduce((a, b) => a.concat(b), []);
      return `<div class="dia-col ${dia === hojeDia ? "hoje" : ""}">
        <div class="dia-titulo"><span>${F.NOMES_DIA[dia]}</span>${dia === hojeDia ? "<span>hoje</span>" : ""}</div>
        ${itens.length ? itens.map(({ p, u }) => `<button class="plano-item" style="--pessoa:${esc(u.cor || "#00E5FF")}" data-acao="editar-plano" data-id="${p.id}" title="Editar">
          <b>${esc(p.treino)}</b><small>${p.horario ? esc(p.horario) + " · " : ""}${(p.grupos || []).join(", ") || (lista.length > 1 ? "" : "sem grupo")}${lista.length > 1 ? (p.grupos && p.grupos.length ? " · " : "") + esc(u.nome) : ""}</small></button>`).join("") : `<div class="dia-descanso">Descanso</div>`}
        <button class="dia-mais" data-acao="novo-plano" data-dia="${dia}">+ adicionar</button>
      </div>`;
    }).join("");
    const treinosSemana = F.deUsuario(d.treinos, uid()).filter((t) => F.estaNaSemanaAtual(t.data)).sort((a, b) => a.data.localeCompare(b.data));
    const totalPlano = lista.reduce((s, u) => s + F.planoDe(d, u.id).filter((p) => (p.treino || "").toLowerCase() !== "descanso").length, 0);
    return `${faixaDemo(d)}
      <div class="grid g-top"><div class="c12">${card("", "Plano semanal", `${tituloPessoas()} · ${totalPlano} ${plural(totalPlano, "treino previsto", "treinos previstos")} por semana · clique para editar`, botaoNovo("novo-plano", "NOVO DIA") + ` <button class="btn" data-acao="gerar-semana" title="Cria os treinos desta semana a partir do plano">${svg(ICONES.copiar)}<span class="btn-txt">Gerar treinos da semana</span></button>`,
        `<div class="semana-grid">${cols}</div>`)}</div></div>
      <div class="grid">
        <div class="c8">${card("", "Treinos desta semana", `${dataCurta(F.inicioSemana())} a ${dataCurta(F.fimSemana())} · registrados em Academia`, `<button class="btn pequeno" data-acao="novo-treino">+ treino</button>`, tabelaTreinos(d, treinosSemana, false))}</div>
        <div class="c4">${card("", "Como usar", "dicas rápidas", "", `<ol class="dicas">
          <li>Monte o plano com um treino por dia (ou "Descanso").</li>
          <li>No dia, o Dashboard e a Academia mostram o treino previsto; clique em "Iniciar" para registrá-lo com exercícios.</li>
          <li>"Gerar treinos da semana" cria de uma vez os treinos planejados de segunda a domingo.</li>
          <li>Marque como Realizado ao terminar: isso alimenta as estatísticas e o relatório.</li></ol>`)}</div>
      </div>`;
  }
  function abrirModalPlano(id, diaIni) {
    const p = id ? achar(DADOS.planoSemanal, id) : null;
    const ini = p || { usuarioId: usuarioAtivo || (F.usuariosAtivos(DADOS)[0] || {}).id, diaSemana: diaIni || F.diaSemanaDe(), treino: "", grupos: [], horario: "", obs: "" };
    abrirModal(`
      <h3>${p ? "Editar dia do plano" : "Novo dia do plano"}</h3>
      <div class="par">
        <div class="campo"><label for="f_usuario">Pessoa</label><select id="f_usuario">${opcoesUsuarios(ini.usuarioId)}</select></div>
        <div class="campo"><label for="f_dia">Dia da semana</label><select id="f_dia">${[1, 2, 3, 4, 5, 6, 7].map((dd) => `<option value="${dd}"${Number(ini.diaSemana) === dd ? " selected" : ""}>${F.NOMES_DIA[dd]}</option>`).join("")}</select></div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_treino">Treino</label><input id="f_treino" value="${esc(ini.treino)}" placeholder="Ex.: Treino de Peito (ou Descanso)"></div>
        <div class="campo"><label for="f_hora">Horário</label><input id="f_hora" type="time" value="${esc(ini.horario || "")}"></div>
      </div>
      <div class="campo"><label for="f_grupos">Grupos musculares (Ctrl/⌘ para vários)</label><select id="f_grupos" multiple size="5">${F.GRUPOS_MUSCULARES.map((g) => `<option value="${g}"${(ini.grupos || []).indexOf(g) !== -1 ? " selected" : ""}>${g}</option>`).join("")}</select></div>
      <div class="campo"><label for="f_obs">Observações</label><textarea id="f_obs" placeholder="Opcional">${esc(ini.obs || "")}</textarea></div>
      ${botoesModal(!!p)}`);
    ligarCancelar();
    document.getElementById("btnSalvar").onclick = () => {
      const treino = valorTrim("f_treino");
      if (!treino) { toast("Informe o treino (ou \"Descanso\")."); return; }
      const reg = { id: p ? p.id : A.novoId(), usuarioId: valor("f_usuario"), diaSemana: Number(valor("f_dia")), treino, grupos: multiplos("f_grupos"), horario: valor("f_hora"), obs: valorTrim("f_obs") };
      if (p) Object.assign(p, reg); else DADOS.planoSemanal.push(reg);
      fecharModal();
      salvarEAtualizar(p ? "Plano atualizado." : "Dia adicionado ao plano.");
    };
    if (p) document.getElementById("btnExcluir").onclick = () => { fecharModal(); confirmarExclusao("Remover este dia do plano?", () => { DADOS.planoSemanal = DADOS.planoSemanal.filter((x) => x.id !== p.id); salvarEAtualizar("Removido do plano."); }); };
  }
  function gerarTreinosDaSemana() {
    const ini = new Date(F.inicioSemana() + "T00:00:00");
    let n = 0;
    pessoas().forEach((u) => {
      F.planoDe(DADOS, u.id).forEach((p) => {
        if ((p.treino || "").toLowerCase() === "descanso") return;
        const dt = new Date(ini); dt.setDate(dt.getDate() + Number(p.diaSemana) - 1);
        const data = A.isoLocal(dt);
        const jaTem = DADOS.treinos.some((t) => t.usuarioId === u.id && t.data === data && t.nome === p.treino);
        if (jaTem) return;
        DADOS.treinos.push({ id: A.novoId(), usuarioId: u.id, nome: p.treino, data, grupos: (p.grupos || []).slice(), status: "Planejado", duracao: 60, obs: "" });
        n++;
      });
    });
    salvarEAtualizar(n ? `${n} ${plural(n, "treino criado", "treinos criados")} para esta semana.` : "Os treinos desta semana já existiam.");
  }

  // =========================================================================
  // EVOLUÇÃO (peso)
  // =========================================================================
  function tabelaPesagens(d, lista, compacta) {
    if (!lista.length) return `<div class="empty">Nenhuma pesagem registrada.</div>`;
    const grid = compacta ? "grid-template-columns:60px 1fr 80px" : "grid-template-columns:100px 1fr 110px 120px 90px 76px";
    let html = compacta ? "" : `<div class="hd" style="${grid}"><i>Data</i><i>Pessoa</i><i class="r">Peso</i><i class="r">Variação</i><i class="r">IMC</i><i></i></div>`;
    html += lista.map((p) => {
      const u = achar(d.usuarios, p.usuarioId);
      const altura = p.altura || (u && u.altura);
      const ini = u ? F.pesoInicialReal(d, u) : null;
      const dif = ini != null ? Number(p.peso) - ini : null;
      const v = F.imc(Number(p.peso), Number(altura || 0));
      if (compacta) return `<button class="rw clicavel" style="${grid}" data-acao="editar-pesagem" data-id="${p.id}">
        <div class="big acc-laranja">${dataCurta(p.data)}</div>
        <div><div class="nm">${kgf(p.peso)}</div><div class="sub">${!usuarioAtivo ? esc(F.nomeUsuario(d, p.usuarioId)) + " · " : ""}${dif == null ? "" : sinalKg(dif)}</div></div>
        <div class="r big dim">${v == null ? "—" : num(v)}</div></button>`;
      return `<div class="rw" style="${grid}">
        <div class="big acc-laranja">${dataBR(p.data)}</div><div>${seloPessoa(p.usuarioId)}${p.obs ? ` <span class="dim" style="font-size:11px">${esc(p.obs)}</span>` : ""}</div>
        <div class="r big">${kgf(p.peso)}</div>
        <div class="r big ${dif == null ? "dim" : dif < 0 ? "up" : dif > 0 ? "down" : ""}">${dif == null ? "—" : sinalKg(dif)}</div>
        <div class="r big dim">${v == null ? "—" : num(v)}</div>
        <div class="r">${linhaAcoes("editar-pesagem", p.id, "excluir-pesagem")}</div></div>`;
    }).join("");
    return html;
  }
  function renderEvolucao(d) {
    if (!d.usuarios.length) return semUsuarios();
    const lista = pessoas();
    const u = uid();
    const pesagens = F.deUsuario(d.pesagens, u).sort((a, b) => b.data.localeCompare(a.data));
    const cards = lista.map((x) => {
      const r = F.resumoUsuario(d, x);
      return `<div class="c4">${card("", esc(x.nome), esc(x.objetivo || ""), `<button class="btn pequeno" data-acao="nova-pesagem" data-usuario="${x.id}">+ pesagem</button>`, `
        <div class="kv"><span>Peso inicial</span><b>${kgf(r.pesoInicial)}</b></div>
        <div class="kv"><span>Peso atual</span><b class="acc-laranja">${kgf(r.pesoAtual)}</b></div>
        <div class="kv"><span>Diferença</span><b class="${r.diferenca == null ? "dim" : r.diferenca < 0 ? "up" : r.diferenca > 0 ? "down" : ""}">${sinalKg(r.diferenca)}</b></div>
        <div class="kv"><span>Variação no mês</span><b>${sinalKg(F.variacaoNoMes(d, x.id))}</b></div>
        <div class="kv"><span>Peso médio</span><b>${kgf(r.pesoMedio)}</b></div>
        <div class="kv"><span>IMC</span><b>${r.imc == null ? "—" : num(r.imc) + " · " + r.classificacao}</b></div>
        <div class="kv"><span>Última pesagem</span><b>${r.ultimaPesagem ? dataBR(r.ultimaPesagem.data) : "—"}</b></div>
        <div class="kv"><span>Acompanhamento</span><b>${r.diasAcompanhamento} dias</b></div>`)}</div>`;
    }).join("");
    return `${faixaDemo(d)}
      <div class="grid g-top">${cards}</div>
      <div class="grid"><div class="c12">${card("", "Evolução do peso", `${tituloPessoas()} · ${periodoEvo ? `últimos ${periodoEvo} meses` : "todo o histórico"}`, abasPeriodoEvo() + ` ${botaoNovo("nova-pesagem", "PESAGEM")}`,
        `<div style="padding:8px 14px 12px;height:300px"><canvas id="graf-evolucao"></canvas></div>`)}</div></div>
      <div class="grid"><div class="c12">${card("", "Registro de peso", `${pesagens.length} ${plural(pesagens.length, "pesagem", "pesagens")} · mais recentes primeiro`, "", `<div class="tabela-scroll">${tabelaPesagens(d, pesagens, false)}</div>`)}</div></div>
      <p class="campo ajuda" style="padding:0 4px">O IMC (peso ÷ altura²) é apenas informativo e não substitui avaliação profissional.</p>`;
  }
  function abrirModalPesagem(id, base) {
    const p = id ? achar(DADOS.pesagens, id) : null;
    base = base || {};
    const ini = p || { usuarioId: base.usuarioId || usuarioAtivo || (F.usuariosAtivos(DADOS)[0] || {}).id, data: A.hoje(0), peso: "", altura: "", obs: "" };
    abrirModal(`
      <h3>${p ? "Editar pesagem" : "Registrar peso"}</h3>
      <div class="par">
        <div class="campo"><label for="f_usuario">Pessoa</label><select id="f_usuario">${opcoesUsuarios(ini.usuarioId)}</select></div>
        <div class="campo"><label for="f_data">Data</label><input id="f_data" type="date" value="${esc(ini.data)}"></div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_peso">Peso (kg)</label><input id="f_peso" type="number" step="0.1" min="0" value="${ini.peso}" placeholder="70.5"></div>
        <div class="campo"><label for="f_altura">Altura (m) — opcional</label><input id="f_altura" type="number" step="0.01" min="0" value="${ini.altura || ""}" placeholder="usa a do cadastro"></div>
      </div>
      <div class="campo"><label for="f_obs">Observações</label><textarea id="f_obs" placeholder="Ex.: em jejum, pela manhã">${esc(ini.obs || "")}</textarea></div>
      ${botoesModal(!!p)}`);
    ligarCancelar();
    document.getElementById("btnSalvar").onclick = () => {
      const peso = numDec(valor("f_peso"));
      if (!peso) { toast("Informe o peso."); return; }
      const reg = { id: p ? p.id : A.novoId(), usuarioId: valor("f_usuario"), data: valor("f_data") || A.hoje(0), peso, altura: numDec(valor("f_altura")) || null, obs: valorTrim("f_obs") };
      if (p) Object.assign(p, reg); else DADOS.pesagens.push(reg);
      fecharModal();
      salvarEAtualizar(p ? "Pesagem atualizada." : "Peso registrado.");
    };
    if (p) document.getElementById("btnExcluir").onclick = () => { fecharModal(); confirmarExclusao("Excluir esta pesagem?", () => { DADOS.pesagens = DADOS.pesagens.filter((x) => x.id !== p.id); salvarEAtualizar("Pesagem excluída."); }); };
  }

  // =========================================================================
  // RELATÓRIO DO MÊS
  // =========================================================================
  function renderRelatorio(d) {
    if (!d.usuarios.length) return semUsuarios();
    const mes = mesRelatorio;
    const dt = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1); dt.setMonth(dt.getMonth() - 1);
    const mesAnt = A.isoLocal(dt).slice(0, 7);
    const lista = pessoas();
    const grid = "grid-template-columns:1.3fr 110px 110px 100px 90px 90px 90px 110px 110px";
    const linhas = lista.map((u) => {
      const gasto = L.gastoNoMes(d, u.id, mes), gastoAnt = L.gastoNoMes(d, u.id, mesAnt);
      const pes = F.pesagensDe(d, u.id).filter((p) => F.mesDe(p.data) === mes);
      const pIni = pes.length ? Number(pes[0].peso) : null, pFim = pes.length ? Number(pes[pes.length - 1].peso) : null;
      const treinos = F.treinosDe(d, u.id).filter((t) => F.mesDe(t.data) === mes);
      const feitos = treinos.filter((t) => t.status === "Realizado").length;
      return `<div class="rw" style="${grid}">
        <div>${seloPessoa(u.id)}</div>
        <div class="r big">${brl(gasto)}</div>
        <div class="r big ${gasto - gastoAnt > 0 ? "down" : "up"}">${gastoAnt || gasto ? (gasto - gastoAnt >= 0 ? "+" : "−") + brl(Math.abs(gasto - gastoAnt)) : "—"}</div>
        <div class="r big dim">${L.comprasNoMes(d, u.id, mes).filter((c) => c.status === "Comprado").length}</div>
        <div class="r big dim">${L.refeicoesNoMes(d, u.id, mes).length}</div>
        <div class="r big">${feitos}<span class="dim">/${treinos.length}</span></div>
        <div class="r big dim">${treinos.length ? pct((feitos / treinos.length) * 100) : "—"}</div>
        <div class="r big">${pIni == null ? "—" : kgf(pIni) + " → " + kgf(pFim)}</div>
        <div class="r big ${pIni == null ? "dim" : pFim - pIni < 0 ? "up" : pFim - pIni > 0 ? "down" : ""}">${pIni == null ? "—" : sinalKg(pFim - pIni)}</div>
      </div>`;
    }).join("");
    const gastoTotal = lista.reduce((s, u) => s + L.gastoNoMes(d, u.id, mes), 0);
    const porCat = lista.length ? L.gastoPorCategoria(d, uid(), mes).map((i) => ({ nome: `${L.EMOJI_CATEGORIA[i.nome] || ""} ${i.nome}`, valor: i.valor })) : [];
    const porLocal = L.gastoPorLocal(d, uid(), mes).map((i) => ({ nome: `${L.EMOJI_LOCAL[i.nome] || ""} ${i.nome}`, valor: i.valor }));
    const grupos = (() => { const m = {}; lista.forEach((x) => F.treinosDe(d, x.id).filter((t) => F.mesDe(t.data) === mes && t.status === "Realizado").forEach((t) => (t.grupos || []).forEach((g) => { m[g] = (m[g] || 0) + 1; }))); return Object.keys(m).map((k) => ({ nome: k, valor: m[k] })).sort((a, b) => b.valor - a.valor); })();
    return `${faixaDemo(d)}
      <div class="grid g-top"><div class="c12">${card("", "Relatório do mês", `${mesRotulo(mes)} · ${tituloPessoas()}`, seletorMes("mes-relatorio", mes, mesesDisponiveis(d)) + ` <button class="btn" onclick="window.print()">Imprimir</button>`,
        `<div class="tabela-scroll"><div class="hd" style="${grid}"><i>Pessoa</i><i class="r">Gasto</i><i class="r">vs mês ant.</i><i class="r">Compras</i><i class="r">Refeições</i><i class="r">Treinos</i><i class="r">Concluídos</i><i class="r">Peso (início → fim)</i><i class="r">Variação</i></div>${linhas}</div>`,
        `<span class="dim">Gasto total do mês</span><b class="acc-laranja" style="font-size:14px;font-weight:800">${brl(gastoTotal)}</b>`)}</div></div>
      <div class="grid">
        <div class="c4">${card("", "Gastos por categoria", mesRotulo(mes), "", `<div class="body pad">${barList(porCat)}</div>`)}</div>
        <div class="c4">${card("", "Gastos por local", mesRotulo(mes), "", `<div class="body pad">${barList(porLocal, "var(--azul)")}</div>`)}</div>
        <div class="c4">${card("", "Grupos musculares treinados", mesRotulo(mes), "", `<div class="body pad">${barList(grupos, "var(--up)", (v) => v + " " + plural(v, "treino", "treinos"))}</div>`)}</div>
      </div>
      <div class="grid"><div class="c12">${card("", "Checklist de fechamento", "faça isso no fim do mês", "", `<ol class="dicas">
        <li>Marcar como <b>Comprado</b> tudo o que foi comprado (com o preço real pago).</li>
        <li>Marcar os treinos feitos como <b>Realizado</b>.</li>
        <li>Registrar a pesagem de fim de mês.</li>
        <li>Exportar um backup em Ajustes.</li></ol>`)}</div></div>`;
  }

  // =========================================================================
  // CONFIGURAÇÕES
  // =========================================================================
  function renderConfiguracoes(d) {
    const total = ["usuarios", "produtos", "compras", "refeicoes", "planoSemanal", "treinos", "exercicios", "pesagens"].map((k) => `<div class="kv"><span>${k}</span><b>${d[k].length}</b></div>`).join("");
    return `
      <div class="grid g-top">
        <div class="c6">${card("", "Backup dos dados", "tudo fica salvo só neste navegador — guarde uma cópia de vez em quando", "", `
          <div class="body pad" style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn primario" data-acao="exportar-backup">Exportar backup (.json)</button>
            <button class="btn primario" data-acao="importar-backup">Importar backup</button>
            <button class="btn" data-acao="copiar-backup">Copiar backup</button>
            <button class="btn" data-acao="colar-backup">Colar backup</button>
          </div>
          <p class="campo ajuda" style="padding:0 16px 14px">Importar um backup substitui todos os dados atuais — o sistema pede confirmação antes de aplicar. Último backup: ${d.config.ultimoBackup ? new Date(d.config.ultimoBackup).toLocaleString("pt-BR") : "nunca"}.</p>`)}</div>
        <div class="c6">${card("", "Dados de exemplo", d.demo ? "o sistema está mostrando dados fictícios" : "os dados atuais são seus", "", `
          <div class="body pad" style="display:flex;gap:10px;flex-wrap:wrap">
            ${d.demo ? `<button class="btn perigo" data-acao="remover-demo">Apagar exemplo e começar do zero</button>` : `<button class="btn" data-acao="carregar-demo">Carregar dados de exemplo</button>`}
            <button class="btn perigo" data-acao="apagar-tudo">Apagar todos os dados</button>
          </div>
          <p class="campo ajuda" style="padding:0 16px 14px">Ana e João são perfis fictícios criados só para demonstrar o sistema. Carregar o exemplo substitui os dados atuais.</p>`)}</div>
      </div>
      <div class="grid">
        <div class="c6">${card("", "Registros", "quantidade por tipo", "", total)}</div>
        <div class="c6">${card("", "Privacidade", "100% local", "", `
          <div class="body pad" style="font-size:13px;line-height:1.6;color:#C9D3E6">
            <p style="margin:0 0 10px">Os dados ficam no armazenamento local do seu navegador (<code>localStorage</code>). Nada é enviado para nenhum servidor — o sistema não tem servidor.</p>
            <p style="margin:0 0 10px">Isso também quer dizer: limpar os dados de navegação apaga tudo; outro navegador ou computador começa do zero. Use <b>Exportar backup</b> para levar seus dados para outro lugar.</p>
            <p style="margin:0">Versão ${VERSAO_APP}.</p>
          </div>`)}</div>
      </div>`;
  }

  // =========================================================================
  // GRÁFICOS DA ROTA (chamados após injetar o HTML)
  // =========================================================================
  function seriesPeso(d) {
    return pessoas().map((u) => ({ nome: u.nome, cor: u.cor, pontos: F.seriePeso(d, u.id, periodoEvo) }));
  }
  function montarGraficosDaRota() {
    const d = DADOS;
    if (document.getElementById("graf-dash-peso")) G.renderEvolucaoPeso("graf-dash-peso", seriesPeso(d));
    if (document.getElementById("graf-evolucao")) G.renderEvolucaoPeso("graf-evolucao", seriesPeso(d));
    const gu = document.getElementById("graf-peso-usuario");
    if (gu) { const u = achar(d.usuarios, gu.dataset.usuario); if (u) G.renderEvolucaoPeso("graf-peso-usuario", [{ nome: u.nome, cor: u.cor, pontos: F.seriePeso(d, u.id, periodoEvo) }]); }
    if (document.getElementById("graf-gastos-mes")) G.renderGastosMes("graf-gastos-mes", L.serieMensalGastos(d, uid(), 6));
    if (document.getElementById("graf-gastos-cat")) G.renderRosca("graf-gastos-cat", L.gastoPorCategoria(d, uid(), mesGastos), brl);
    if (document.getElementById("graf-grupos")) {
      const m = {}; pessoas().forEach((x) => F.treinosPorGrupo(d, x.id).forEach((g) => { m[g.grupo] = (m[g.grupo] || 0) + g.valor; }));
      G.renderRosca("graf-grupos", Object.keys(m).map((k) => ({ nome: k, valor: m[k] })).sort((a, b) => b.valor - a.valor));
    }
    if (document.getElementById("graf-treinos-mes")) {
      const serie = F.serieMensalTreinos(d, null, 6).map((s) => ({ rotulo: s.rotulo, valor: pessoas().reduce((t, x) => t + F.treinosNoMes(d, x.id, s.mes), 0) }));
      G.renderTreinosMes("graf-treinos-mes", serie);
    }
    const gc = document.getElementById("graf-carga");
    if (gc) {
      const sel = document.querySelector("[data-acao-carga]");
      const nome = sel && sel.value;
      if (nome) G.renderCarga("graf-carga", F.evolucaoCarga(d, gc.dataset.usuario, nome));
    }
  }

  // =========================================================================
  // DELEGAÇÃO DE EVENTOS (um listener para toda a área de conteúdo)
  // =========================================================================
  function ligarDelegacaoConteudo() {
    const cont = document.getElementById("conteudo");

    cont.addEventListener("change", (e) => {
      const el = e.target;
      if (el.dataset.acaoMes === "mes-gastos") { mesGastos = el.value; renderRota(); }
      else if (el.dataset.acaoMes === "mes-relatorio") { mesRelatorio = el.value; renderRota(); }
      else if (el.dataset.acaoData === "dia-alimentacao") { dataAlimentacao = el.value || A.hoje(0); renderRota(); }
      else if (el.dataset.acaoCarga) { exercicioCarga = el.value; montarGraficosDaRota(); }
    });

    // botão direito num alimento da linha do tempo abre a edição
    cont.addEventListener("contextmenu", (e) => {
      const b = e.target.closest('[data-acao="ciclar-status-refeicao"]');
      if (b) { e.preventDefault(); abrirModalRefeicao(b.dataset.id); }
    });

    cont.addEventListener("click", (e) => {
      const b = e.target.closest("[data-acao]");
      if (!b) return;
      const acao = b.dataset.acao;
      const id = b.dataset.id;
      // selos e botões dentro de linhas clicáveis não devem abrir a linha
      if (["ciclar-status-compra", "ciclar-status-treino", "ciclar-status-refeicao", "ciclar-status-exercicio", "editar-compra", "editar-treino", "excluir-treino", "compra-do-produto", "editar-produto", "excluir-produto", "editar-exercicio", "excluir-exercicio", "editar-pesagem", "excluir-pesagem", "editar-refeicao", "excluir-refeicao", "editar-usuario", "excluir-usuario", "iniciar-plano"].indexOf(acao) !== -1) e.stopPropagation();

      switch (acao) {
        case "ir": navegarPara(b.dataset.secao, id); break;

        case "manter-demo": demoBannerOculto = true; renderRota(); break;
        case "remover-demo":
          confirmarExclusao("Apagar todos os dados de exemplo e começar do zero?", () => { DADOS = A.limparDados(); toast("Pronto: sistema zerado. Cadastre a primeira pessoa."); navegarPara("usuarios"); });
          break;
        case "carregar-demo":
          confirmarExclusao("Carregar os dados de exemplo substitui os dados atuais. Continuar?", () => { DADOS = A.carregarExemplo(); toast("Dados de exemplo carregados."); navegarPara("dashboard"); });
          break;
        case "apagar-tudo":
          confirmarExclusao("Apagar TODOS os dados deste navegador? Exporte um backup antes se quiser guardar.", () => { DADOS = A.limparDados(); usuarioAtivo = ""; toast("Tudo apagado."); navegarPara("usuarios"); });
          break;
        case "exportar-backup": A.exportarDados(); toast("Backup exportado — verifique seus downloads."); break;
        case "importar-backup": document.getElementById("inputImportarBackup").click(); break;
        case "copiar-backup": {
          const texto = JSON.stringify(DADOS, null, 2);
          abrirModal(`<h3>Copiar backup</h3><p class="campo ajuda" style="margin-top:0">Guarde este texto num arquivo ou nota. Para restaurar, use "Colar backup".</p>
            <div class="campo"><textarea id="f_backup" rows="10" readonly style="font-family:var(--mono);font-size:12px">${esc(texto)}</textarea></div>
            <div class="modal-acoes"><button class="btn primario salvar" id="btnCopiar">Copiar</button><button class="btn" id="btnCancelar">Fechar</button></div>`, true);
          ligarCancelar();
          document.getElementById("btnCopiar").onclick = () => {
            const ta = document.getElementById("f_backup");
            const ok = () => toast("Backup copiado.");
            try { navigator.clipboard.writeText(texto).then(ok).catch(() => { ta.select(); toast("Selecionei o texto: use Ctrl/⌘ + C."); }); }
            catch (e2) { ta.select(); toast("Selecionei o texto: use Ctrl/⌘ + C."); }
          };
          break;
        }
        case "colar-backup": {
          abrirModal(`<h3>Colar backup</h3><p class="campo ajuda" style="margin-top:0">Cole o texto copiado antes. Isso substitui TODOS os dados atuais.</p>
            <div class="campo"><textarea id="f_backup" rows="10" style="font-family:var(--mono);font-size:12px" placeholder='{ "versao": 1, ... }'></textarea></div>
            <div class="modal-acoes"><button class="btn perigo salvar" id="btnRestaurar">Restaurar</button><button class="btn" id="btnCancelar">Cancelar</button></div>`, true);
          ligarCancelar();
          document.getElementById("btnRestaurar").onclick = () => {
            try {
              const obj = JSON.parse(document.getElementById("f_backup").value);
              if (!obj || !Array.isArray(obj.usuarios)) throw new Error();
              fecharModal(); A.salvarDados(obj); DADOS = A.carregarDados(); toast("Backup restaurado.");
            } catch (e2) { toast("Esse texto não é um backup do Meu Controle."); }
          };
          break;
        }

        case "novo-usuario": abrirModalUsuario(null); break;
        case "editar-usuario": abrirModalUsuario(id); break;
        case "excluir-usuario": excluirUsuario(id); break;

        case "nova-compra": abrirModalCompra(null, { usuarioId: b.dataset.usuario }); break;
        case "editar-compra": abrirModalCompra(id); break;
        case "ciclar-status-compra": ciclarStatusCompra(id); break;
        case "filtro-compras": filtroCompras = b.dataset.filtro; renderRota(); break;
        case "novo-produto": abrirModalProduto(null); break;
        case "editar-produto": abrirModalProduto(id); break;
        case "excluir-produto": { const p = achar(DADOS.produtos, id); if (p) confirmarExclusao(`Excluir "${p.nome}" do catálogo?`, () => { DADOS.produtos = DADOS.produtos.filter((x) => x.id !== id); salvarEAtualizar("Produto excluído."); }); break; }
        case "compra-do-produto": abrirModalCompra(null, { produtoId: id, usuarioId: usuarioAtivo || (F.usuariosAtivos(DADOS)[0] || {}).id }); break;

        case "nova-refeicao": abrirModalRefeicao(null, { usuarioId: b.dataset.usuario, data: b.dataset.data, horario: b.dataset.horario, tipo: b.dataset.tipo }); break;
        case "editar-refeicao": abrirModalRefeicao(id); break;
        case "excluir-refeicao": confirmarExclusao("Excluir este alimento?", () => { DADOS.refeicoes = DADOS.refeicoes.filter((x) => x.id !== id); salvarEAtualizar("Excluído."); }); break;
        case "ciclar-status-refeicao": ciclarStatusRefeicao(id); break;
        case "duplicar-dia": abrirModalDuplicarDia(b.dataset.data); break;
        case "dia-alimentacao": {
          if (b.dataset.hoje) dataAlimentacao = A.hoje(0);
          else { const dt = new Date(dataAlimentacao + "T00:00:00"); dt.setDate(dt.getDate() + Number(b.dataset.delta)); dataAlimentacao = A.isoLocal(dt); }
          renderRota(); break;
        }

        case "novo-treino": abrirModalTreino(null, { usuarioId: b.dataset.usuario }); break;
        case "editar-treino": abrirModalTreino(id); break;
        case "excluir-treino": excluirTreino(id); break;
        case "ciclar-status-treino": ciclarStatusTreino(id); break;
        case "duplicar-treino": duplicarTreino(id); break;
        case "iniciar-plano": iniciarDoPlano(id); break;
        case "novo-exercicio": abrirModalExercicio(null, ROTA.param); break;
        case "editar-exercicio": abrirModalExercicio(id); break;
        case "excluir-exercicio": confirmarExclusao("Excluir este exercício?", () => { DADOS.exercicios = DADOS.exercicios.filter((x) => x.id !== id); salvarEAtualizar("Exercício excluído."); }); break;
        case "ciclar-status-exercicio": ciclarStatusExercicio(id); break;

        case "novo-plano": abrirModalPlano(null, Number(b.dataset.dia) || null); break;
        case "editar-plano": abrirModalPlano(id); break;
        case "gerar-semana": gerarTreinosDaSemana(); break;

        case "nova-pesagem": abrirModalPesagem(null, { usuarioId: b.dataset.usuario }); break;
        case "editar-pesagem": abrirModalPesagem(id); break;
        case "excluir-pesagem": confirmarExclusao("Excluir esta pesagem?", () => { DADOS.pesagens = DADOS.pesagens.filter((x) => x.id !== id); salvarEAtualizar("Pesagem excluída."); }); break;

        case "periodo-evo": periodoEvo = Number(b.dataset.meses) || 0; renderRota(); break;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", iniciar);
})();
