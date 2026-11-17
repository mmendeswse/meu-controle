/**
 * navegacao.js
 * -----------------------------------------------------------------------
 * Jeitos de andar pelo app, do gosto de cada pessoa:
 *  - tela que abre primeiro (Hoje, outra tela ou a última em que estava);
 *  - ordem do menu, as 4 abas do celular e o botão + (lado, atalhos, ordem);
 *  - tocar de novo na aba em que você já está volta ao topo (e à 1ª aba);
 *  - atalhos de teclado no computador (1–9, /, N, ?, H);
 *  - "Um dia em detalhe": tudo o que foi registrado numa data, aberto pelos
 *    anéis de "Sua semana" na tela Hoje.
 *
 * As escolhas ficam em config.navegacao (Ajustes → Navegação).
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo, UI = global.UI, A = global.Armazenamento;
  const esc = UI.esc;
  const App = () => global.App;
  const AR = () => global.Areas;
  const cfg = (d) => d.config.navegacao || A.configPadrao().navegacao;
  const CHAVE_ULTIMA = "meuControle:ultimaTela";

  // ---------------------------------------------------------------------
  // tela inicial
  // ---------------------------------------------------------------------
  function telaInicial(d) {
    const k = cfg(d).telaInicial || "dashboard";
    if (k === "ultima") {
      try {
        const u = JSON.parse(localStorage.getItem(CHAVE_ULTIMA) || "null");
        if (u && u.secao && u.secao !== "treino" && AR().secaoVisivel(d, u.secao)) return { secao: u.secao, param: u.param || null };
      } catch (e) { /* segue com Hoje */ }
      return null;
    }
    return k !== "dashboard" && AR().secaoVisivel(d, k) ? { secao: k, param: null } : null;
  }
  App().aoRenderizar((d, rota) => {
    try { localStorage.setItem(CHAVE_ULTIMA, JSON.stringify({ secao: rota.secao, param: rota.param || null })); } catch (e) { /* sem espaço */ }
    document.body.classList.toggle("fab-esq", cfg(d).fabLado === "esquerda");
  });

  // ---------------------------------------------------------------------
  // botão +: quais atalhos e em que ordem
  // ---------------------------------------------------------------------
  function itensFab(d, itens) {
    const c = cfg(d), ord = c.fabOrdem || [], oc = c.fabOcultos || [];
    const pos = (r) => { const i = ord.indexOf(r.acao); return i === -1 ? 100 + itens.indexOf(r) : i; };
    return itens.filter((r) => oc.indexOf(r.acao) === -1).sort((a, b) => pos(a) - pos(b));
  }
  function todosFab(d) {
    const c = cfg(d), ord = c.fabOrdem || [];
    const base = App().RAPIDO.filter((r) => AR().rapidoVisivel(d, r.acao));
    const pos = (r) => { const i = ord.indexOf(r.acao); return i === -1 ? 100 + base.indexOf(r) : i; };
    return base.slice().sort((a, b) => pos(a) - pos(b));
  }

  // ---------------------------------------------------------------------
  // cartão de Ajustes → Navegação
  // ---------------------------------------------------------------------
  function cartaoAjustes(d) {
    const c = cfg(d), P = global.Personalizar;
    const ord = AR().ordem(d).filter((k) => k !== "dashboard" && k !== "configuracoes");
    const sec = (k) => AR().SECOES.find((s) => s.k === k);
    const visiveis = AR().ordem(d).filter((k) => AR().secaoVisivel(d, k));
    const linhaMenu = (k, i, total) => {
      const s = sec(k), desl = !AR().secaoVisivel(d, k);
      return `<li class="${desl ? "oculto" : ""}"><span class="ord-txt"><b>${esc(s.r)}</b><small>${desl ? "área desligada" : esc(s.s)}</small></span>
        <span class="ord-botoes"><button class="btn fantasma pequeno" data-acao="nav-mover" data-k="${k}" data-d="-1"${i === 0 ? " disabled" : ""} aria-label="Subir ${esc(s.r)}">↑</button><button class="btn fantasma pequeno" data-acao="nav-mover" data-k="${k}" data-d="1"${i === total - 1 ? " disabled" : ""} aria-label="Descer ${esc(s.r)}">↓</button></span></li>`;
    };
    const fab = todosFab(d);
    const linhaFab = (r, i, total) => {
      const oculto = (c.fabOcultos || []).indexOf(r.acao) !== -1;
      return `<li class="${oculto ? "oculto" : ""}"><span class="ord-txt"><b>${r.icone} ${esc(r.rotulo)}</b></span>
        <span class="ord-botoes"><button class="btn fantasma pequeno" data-acao="fab-mover" data-k="${r.acao}" data-d="-1"${i === 0 ? " disabled" : ""} aria-label="Subir">↑</button><button class="btn fantasma pequeno" data-acao="fab-mover" data-k="${r.acao}" data-d="1"${i === total - 1 ? " disabled" : ""} aria-label="Descer">↓</button>
        <label class="interruptor sem-txt" title="${oculto ? "Mostrar" : "Esconder"}"><input type="checkbox" data-mudar="fab-mostrar" data-k="${r.acao}"${oculto ? "" : " checked"}><span class="int-trilho"><i></i></span></label></span></li>`;
    };
    const opcoesInicio = [{ v: "dashboard", r: "Hoje (padrão)" }, { v: "ultima", r: "A última tela em que eu estava" }]
      .concat(visiveis.filter((k) => k !== "dashboard" && k !== "configuracoes").map((k) => ({ v: k, r: sec(k).r })));
    return UI.card({ titulo: "Navegação", sub: "menu, abas, botão + e por onde o app começa", id: "sec-navegacao", corpo: `<div class="pad">
      <label class="linha-sel" style="margin-top:0"><span><b>Tela que abre primeiro</b><small>Ao abrir o app.</small></span>
        <select class="sel" data-mudar="nav-inicial">${UI.opcoes(opcoesInicio, c.telaInicial || "dashboard")}</select></label>
      <div class="ap-rot">Ordem do menu</div>
      <p class="ajuda" style="margin-top:0">Hoje fica sempre em primeiro e Ajustes por último. A barra do celular segue a mesma ordem.</p>
      <ul class="ordenaveis">${ord.map((k, i, l) => linhaMenu(k, i, l.length)).join("")}</ul>
      <div class="ap-rot">Abas da barra do celular</div>
      <p class="ajuda" style="margin-top:0">Escolha até 4. O resto fica em “Mais”.</p>
      <div class="chips abas-escolha" id="abasEscolha">${visiveis.map((k) => `<label class="chip"><input type="checkbox" value="${k}" data-mudar="abas"${(AR().abasAtuais || d.config.abas).indexOf(k) !== -1 ? " checked" : ""}><span>${esc(sec(k).r)}</span></label>`).join("")}</div>
      <div class="ap-rot">Botão + (registro rápido)</div>
      <div class="linha-campos">${P.seg("fab-lado", [{ k: "direita", r: "À direita" }, { k: "esquerda", r: "À esquerda" }], c.fabLado || "direita")}</div>
      <p class="ajuda">Escolha os atalhos e a ordem — o primeiro da lista fica mais perto do dedo.</p>
      <ul class="ordenaveis">${fab.map((r, i, l) => linhaFab(r, i, l.length)).join("")}</ul>
      <div class="lista-interruptores" style="margin-top:14px">${P.interruptor("nav_desl", "Deslizar para trocar de tela", c.deslizar !== false, "No celular: arraste para a esquerda ou direita para ir à próxima aba ou tela. Na primeira tela, arrastar para a direita abre o menu.", 'data-mudar="nav-deslizar"')}
        ${P.interruptor("nav_tecl", "Atalhos de teclado", c.teclado !== false, "No computador: <b>/</b> busca, <b>N</b> novo registro, <b>1–9</b> telas, <b>?</b> mostra todos.", 'data-mudar="nav-teclado"')}</div>
      <p class="rodape-card"><button class="link-acao" data-acao="nav-padrao">Voltar ao padrão</button> · <button class="link-acao" data-acao="atalhos-teclado">Ver atalhos de teclado</button></p>
    </div>` });
  }
  const salvarCfg = (msg) => App().salvar(msg || null, { semIntegracao: true });
  App().registrarAcoes({
    "nav-mover": (el) => {
      const d = App().dados(), lista = AR().ordem(d).filter((k) => k !== "dashboard" && k !== "configuracoes");
      const i = lista.indexOf(el.dataset.k), j = i + Number(el.dataset.d);
      if (i < 0 || j < 0 || j >= lista.length) return;
      lista.splice(j, 0, lista.splice(i, 1)[0]);
      cfg(d).ordemMenu = lista;
      salvarCfg();
    },
    "fab-mover": (el) => {
      const d = App().dados(), lista = todosFab(d).map((r) => r.acao);
      const i = lista.indexOf(el.dataset.k), j = i + Number(el.dataset.d);
      if (i < 0 || j < 0 || j >= lista.length) return;
      lista.splice(j, 0, lista.splice(i, 1)[0]);
      cfg(d).fabOrdem = lista;
      salvarCfg();
    },
    "fab-lado": (el) => { cfg(App().dados()).fabLado = el.dataset.k; salvarCfg(); },
    "nav-padrao": () => {
      const d = App().dados();
      d.config.navegacao = A.configPadrao().navegacao;
      d.config.abas = A.configPadrao().abas;
      salvarCfg("Navegação voltou ao padrão.");
    }
  });
  App().registrarMudancas({
    "nav-inicial": (el) => { cfg(App().dados()).telaInicial = el.value; salvarCfg("Pronto: vale a partir da próxima vez que abrir o app."); },
    "nav-teclado": (el) => { cfg(App().dados()).teclado = el.checked; salvarCfg(); },
    "nav-deslizar": (el) => { cfg(App().dados()).deslizar = el.checked; salvarCfg(); },
    "fab-mostrar": (el) => {
      const c = cfg(App().dados()), i = c.fabOcultos.indexOf(el.dataset.k);
      if (el.checked && i !== -1) c.fabOcultos.splice(i, 1);
      if (!el.checked && i === -1) c.fabOcultos.push(el.dataset.k);
      salvarCfg();
    }
  });

  // ---------------------------------------------------------------------
  // tocar de novo na aba atual: volta ao topo; já no topo, vai à 1ª aba
  // ---------------------------------------------------------------------
  const celular = () => global.matchMedia("(max-width: 860px)").matches;
  const rolagem = () => global.scrollY || document.documentElement.scrollTop || 0;
  const calmo = () => document.documentElement.classList.contains("sem-animacao");
  function subirAoTopo() { global.scrollTo({ top: 0, behavior: calmo() ? "auto" : "smooth" }); }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("#tabBar button[data-secao], #navPrincipal button[data-secao], #btnLogo");
    if (!b) return;
    if (b.id === "btnLogo" && celular()) { e.stopPropagation(); e.preventDefault(); abrirGaveta(); return; }
    const r = App().rota(), secao = b.dataset.secao || "dashboard";
    const pag = r.secao === "treino" ? "academia" : r.secao === "ajuda" ? "configuracoes" : r.secao;
    if (pag !== secao || r.secao !== secao) return; // outra tela (ou subtela): navega normalmente
    if (rolagem() > 60) { e.stopPropagation(); e.preventDefault(); subirAoTopo(); }
  }, true);
  // no celular, tocar na barra do topo (fora dos botões) também sobe — como a barra de status do iPhone
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#sidebar") || e.target.closest("button, a, input, .dropdown") || !celular()) return;
    if (rolagem() > 60) subirAoTopo();
  });

  // ---------------------------------------------------------------------
  // atalhos de teclado (computador)
  // ---------------------------------------------------------------------
  const ATALHOS = [
    ["/", "Buscar em tudo (também Ctrl + K)"], ["N", "Novo registro (abre o botão +)"], ["H", "Ir para Hoje"],
    ["1 … 9", "Ir para a 1ª, 2ª… tela do menu"], ["A", "Abrir Ajustes"], ["?", "Ver estes atalhos"],
    ["Esc", "Fechar a janela ou o menu aberto"], ["← →", "Nos tutoriais: passo anterior / próximo"]
  ];
  function abrirAtalhos() {
    UI.abrirModal(`<h3>Atalhos de teclado</h3>
      <p class="ajuda" style="margin-top:0">Funcionam no computador quando você não está digitando num campo.</p>
      <ul class="lista-atalhos">${ATALHOS.map((a) => `<li><kbd>${esc(a[0])}</kbd><span>${esc(a[1])}</span></li>`).join("")}</ul>
      <div class="modal-acoes"><button class="btn primario" data-acao="fechar-modal">Entendi</button></div>`, { semFoco: true });
  }
  App().registrarAcoes({ "atalhos-teclado": abrirAtalhos });
  document.addEventListener("keydown", (e) => {
    const d = App().dados();
    if (!d) return;
    // Ctrl/⌘ + K abre a busca de qualquer lugar
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); if (global.Busca && !document.documentElement.classList.contains("travado")) global.Busca.abrir(); return; }
    if (cfg(d).teclado === false || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (UI.modalAberto() || document.body.classList.contains("tour-on") || document.body.classList.contains("av-aberta") || document.documentElement.classList.contains("travado") || document.querySelector(".abertura")) return;
    const k = e.key;
    if (k === "/") { e.preventDefault(); if (global.Busca) global.Busca.abrir(); }
    else if (k === "?") { e.preventDefault(); abrirAtalhos(); }
    else if (k === "n" || k === "N") { e.preventDefault(); const f = document.getElementById("fab"); if (f && !f.hidden) { f.click(); const p = document.querySelector("#fabMenu .fab-item"); if (p) p.focus(); } }
    else if (k === "h" || k === "H") { e.preventDefault(); App().ir("dashboard"); }
    else if (k === "a" || k === "A") { e.preventDefault(); App().ir("configuracoes"); }
    else if (/^[1-9]$/.test(k)) {
      const vis = AR().ordem(d).filter((s) => AR().secaoVisivel(d, s));
      const alvo = vis[Number(k) - 1];
      if (alvo) { e.preventDefault(); App().ir(alvo); }
    }
  });

  // ---------------------------------------------------------------------
  // um dia em detalhe
  // ---------------------------------------------------------------------
  function abrirDia(data) {
    const d = App().dados(), hj = N.hoje(0);
    if (!data || data > hj) data = hj;
    const AL = global.Alimentacao, F = global.Fitness, BE = global.BemEstar, usa = (k) => AR().area(d, k);
    const blocos = [];
    const linha = (ic, titulo, valor, sub, acao) => `<li><${acao ? `button ${acao}` : "div"} class="dd-linha"><span class="dd-ic">${ic}</span><span class="dd-txt"><b>${titulo}</b>${sub ? `<small>${sub}</small>` : ""}</span><span class="dd-val">${valor || ""}</span>${acao ? `<i class="dd-seta">›</i>` : ""}</${acao ? "button" : "div"}></li>`;
    const nota = global.Hoje && global.Hoje.notaDoDia ? global.Hoje.notaDoDia(d, data) : null;

    if (usa("alimentacao")) {
      const c = AL.consumoDoDia(d, data), mt = AL.metasDiarias(d), refs = AL.refeicoesNoDia(d, data);
      const feitas = refs.filter((r) => r.status === "Realizada");
      blocos.push(linha("🍽️", "Alimentação", c.kcal ? `${UI.numAuto(c.kcal, 0)}${mt.kcal ? ` <small>/ ${UI.numAuto(mt.kcal, 0)}</small>` : ""} kcal` : "—",
        refs.length ? `${feitas.length} de ${refs.length} ${UI.plural(refs.length, "refeição", "refeições")}${c.proteina ? " · " + UI.numAuto(c.proteina, 0) + " g de proteína" : ""}` : "nenhuma refeição registrada",
        `data-acao="dia-abrir-diario" data-data="${data}"`));
    }
    const agua = AL.aguaDoDia(d, data), metaAgua = AL.metaDiaria(d, "agua");
    if (d.config.rotina.mostrar.agua !== false) blocos.push(linha("💧", "Água", agua ? UI.litros(agua) : "—", metaAgua ? "meta " + UI.litros(metaAgua) : "", `data-acao="agua" data-data="${data}"`));
    if (usa("academia")) {
      const s = F.situacaoDoDia(d, data);
      const t = s.treinos && s.treinos[0];
      if (s.previsto || t) blocos.push(linha("🏋️", "Treino", s.realizado ? "✓ feito" : s.cancelado ? "cancelado" : s.perdido ? "não feito" : "previsto",
        t ? esc(t.nome) + (t.duracao ? " · " + t.duracao + " min" : "") : s.plano ? "previsto no plano" : "", t ? `data-acao="ir" data-secao="treino" data-id="${t.id}"` : ""));
      else blocos.push(linha("🏋️", "Treino", "—", "nada previsto", data <= hj ? `data-acao="novo-treino" data-data="${data}"` : ""));
    }
    if (usa("evolucao")) {
      const p = F.pesagemDoDia(d, data);
      blocos.push(linha("⚖️", "Peso", p ? UI.kg(p.peso) : "—", p ? "" : "sem pesagem neste dia", `data-acao="registrar-corpo" data-data="${data}"`));
    }
    if (usa("checkin")) {
      const ck = BE.checkin(d, data), hs = ck ? BE.horasSono(ck) : null;
      blocos.push(linha("😴", "Sono", hs != null ? BE.fmtHoras(hs) : "—", ck && ck.sonoQualidade ? BE.emoji("sonoQualidade", ck.sonoQualidade) + " " + BE.nivel("sonoQualidade", ck.sonoQualidade).r.toLowerCase() : "", `data-acao="checkin" data-data="${data}" data-foco="sono"`));
      blocos.push(linha(ck && ck.humor != null ? BE.emoji("humor", ck.humor) : "🙂", "Humor", ck && ck.humor != null ? esc(BE.nivel("humor", ck.humor).r) : "—",
        ck ? [ck.passos ? UI.numAuto(ck.passos, 0) + " passos" : "", ck.obs ? "“" + esc(String(ck.obs).slice(0, 60)) + "”" : ""].filter(Boolean).join(" · ") : "sem check-in", `data-acao="checkin" data-data="${data}" data-foco="humor"`));
    }
    if (usa("habitos")) {
      const habs = BE.habitosDoDia(d, data);
      if (habs.length) {
        const ok = habs.filter((h) => BE.cumpridoNoDia(d, h, data));
        blocos.push(linha("✅", "Hábitos", `${ok.length} de ${habs.length}`, esc(habs.map((h) => (BE.cumpridoNoDia(d, h, data) ? "✓ " : "· ") + h.nome).join("  ").slice(0, 90)), `data-acao="ir" data-secao="bemestar" data-param="habitos"`));
      }
    }
    if (usa("remedios")) {
      const doses = BE.dosesDoDia(d, data).filter((x) => !x.extra);
      if (doses.length) blocos.push(linha("💊", "Remédios", `${doses.filter((x) => x.status === "Tomado").length} de ${doses.length}`, "doses tomadas", `data-acao="ir" data-secao="bemestar" data-param="remedios"`));
    }
    const p = nota == null ? null : Math.round(nota * 100);
    const m = UI.abrirModal(`<div class="dia-det">
      <div class="dd-topo">
        <button class="btn pequeno" data-acao="dia-detalhe" data-data="${N.addDias(data, -1)}" aria-label="Dia anterior">‹</button>
        <div class="dd-titulo"><small>${data === hj ? "Hoje" : data === N.hoje(-1) ? "Ontem" : UI.rotuloRelativo(data)}</small><h3>${esc(N.paraData(data).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }))}</h3></div>
        <button class="btn pequeno" data-acao="dia-detalhe" data-data="${N.addDias(data, 1)}"${data >= hj ? " disabled" : ""} aria-label="Dia seguinte">›</button>
      </div>
      ${p != null ? `<div class="dd-nota"><span class="progresso"><i style="width:${p}%;background:var(--c-hoje)"></i></span><b>${p}%</b> <span class="dim">do que estava previsto</span></div>` : `<p class="ajuda" style="margin:0 0 6px">Nada previsto para este dia.</p>`}
      <ul class="dd-lista">${blocos.join("")}</ul>
      <label class="linha-sel dd-ir"><span><b>Ir para outra data</b></span><input type="date" class="sel" max="${hj}" value="${data}" data-mudar="dia-detalhe-data"></label>
      <div class="modal-acoes"><button class="btn primario" data-acao="fechar-modal">Fechar</button></div></div>`, { semFoco: true });
    m.classList.add("modal-dia");
  }
  App().registrarAcoes({
    "dia-detalhe": (el) => abrirDia(el.dataset.data),
    "dia-abrir-diario": (el) => { App().estado.alimentacao.data = el.dataset.data; UI.fecharModal(); App().ir("alimentacao"); }
  });
  App().registrarMudancas({ "dia-detalhe-data": (el) => { if (el.value) abrirDia(el.value); } });

  // ---------------------------------------------------------------------
  // menu lateral do celular (abre pela logo ou arrastando a 1ª tela para a direita)
  // ---------------------------------------------------------------------
  function gavetaAberta() { return document.body.classList.contains("gaveta-aberta"); }
  function fecharGaveta() { document.body.classList.remove("gaveta-aberta"); const b = document.getElementById("btnLogo"); if (b) b.setAttribute("aria-expanded", "false"); }
  function abrirGaveta() {
    const d = App().dados();
    if (!d || UI.modalAberto() || document.body.classList.contains("tour-on")) return;
    let g = document.getElementById("gaveta");
    if (!g) {
      const sc = document.createElement("div"); sc.id = "gavetaFundo"; sc.className = "gaveta-fundo"; sc.addEventListener("click", fecharGaveta);
      g = document.createElement("aside"); g.id = "gaveta"; g.className = "gaveta"; g.setAttribute("aria-label", "Menu");
      document.body.appendChild(sc); document.body.appendChild(g);
      g.addEventListener("click", (e) => { if (e.target.closest("button")) setTimeout(fecharGaveta, 0); });
      // arrastar o menu para a esquerda fecha
      let x0 = null;
      g.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
      g.addEventListener("touchend", (e) => { if (x0 != null && e.changedTouches[0].clientX - x0 < -60) fecharGaveta(); x0 = null; }, { passive: true });
    }
    const P = global.Personalizar, r = App().rota(), u = d.usuarios[0];
    const atual = r.secao === "treino" ? "academia" : r.secao === "ajuda" ? "ajuda" : r.secao;
    const icone = (k) => { const b = document.querySelector(`#navPrincipal button[data-secao="${k}"] svg`); return b ? b.outerHTML : ""; };
    const secoes = AR().ordem(d).filter((k) => AR().secaoVisivel(d, k));
    const claro = P.temaEfetivo(d.config.aparencia) === "claro";
    g.innerHTML = `<button class="gv-perfil" data-acao="av-abrir">${P.avatarHTML(d, "", 'tabindex="-1"').replace("<button", "<span").replace("</button>", "</span>")}<span><b>${esc(u.nome && u.nome !== "Eu" ? u.nome : "Seu perfil")}</b><small>Editar avatar</small></span></button>
      <button class="gv-busca" data-acao="busca-abrir">${UI.svg("buscar")}<span>Buscar</span></button>
      <nav class="gv-nav">${secoes.map((k) => { const sx = AR().SECOES.find((x) => x.k === k); return `<button class="gv-item it-${k}${atual === k ? " ativo" : ""}" data-acao="ir" data-secao="${k}"><i>${icone(k)}</i><span>${esc(sx.r)}</span></button>`; }).join("")}</nav>
      <div class="gv-rodape"><button class="gv-item${atual === "ajuda" ? " ativo" : ""}" data-acao="ir" data-secao="ajuda"><i class="gv-q">?</i><span>Ajuda</span></button>
        <button class="gv-item" data-acao="tema-alternar"><i class="gv-q">${claro ? "🌙" : "☀️"}</i><span>Tema ${claro ? "escuro" : "claro"}</span></button>
        <small class="gv-versao">${esc(P.nomeApp(d))} v${App().VERSAO_APP}</small></div>`;
    App().fecharFab(); document.body.classList.remove("mais-aberto");
    requestAnimationFrame(() => document.body.classList.add("gaveta-aberta"));
    const b = document.getElementById("btnLogo"); if (b) b.setAttribute("aria-expanded", "true");
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharGaveta(); });
  App().aoRenderizar(() => { fecharGaveta(); const b = document.getElementById("btnLogo"); if (b) b.title = celular() ? "Abrir o menu" : "Ir para Hoje"; });

  // ---------------------------------------------------------------------
  // deslizar para os lados (celular): próxima aba; na última aba, próxima tela.
  // Em subtelas (um treino aberto, Ajuda, uma categoria de Ajustes), deslizar
  // para a direita volta.
  // ---------------------------------------------------------------------
  function irParaLado(dir) { // dir: +1 = próxima (dedo para a esquerda), -1 = anterior
    const d = App().dados(), r = App().rota();
    const voltar = document.querySelector("#conteudo .voltar");
    if (r.secao === "treino" || r.secao === "ajuda" || (r.secao === "configuracoes" && r.param)) { if (dir < 0 && voltar) voltar.click(); return; }
    const abas = Array.from(document.querySelectorAll("#conteudo .cabecalho-pagina .abas[role=tablist] button"));
    const i = abas.findIndex((b) => b.classList.contains("ativo"));
    if (abas.length && i !== -1 && abas[i + dir]) { abas[i + dir].click(); return; }
    const ordem = AR().ordem(d).filter((k) => AR().secaoVisivel(d, k)), j = ordem.indexOf(r.secao);
    if (j === -1) return;
    if (!ordem[j + dir]) { if (dir < 0) abrirGaveta(); return; }
    App().ir(ordem[j + dir]);
    // voltando, cai na última aba da tela anterior (a ordem fica contínua)
    if (dir < 0) { const l = document.querySelectorAll("#conteudo .cabecalho-pagina .abas[role=tablist] button"); if (l.length > 1) l[l.length - 1].click(); }
  }
  (function () {
    let x0 = 0, y0 = 0, t0 = 0, ativo = false, travado = null;
    const cont = () => document.getElementById("conteudo");
    const rolaDeLado = (el) => {
      for (; el && el !== document.body; el = el.parentElement) {
        if (el.matches && el.matches("input, textarea, select, canvas, [data-sem-deslize], .abas, .chips-filtro, .seg-opcoes, .atalhos-ajustes, .ordenaveis, [contenteditable]")) return true;
        if (el.scrollWidth > el.clientWidth + 6) { const o = getComputedStyle(el).overflowX; if (o === "auto" || o === "scroll") return true; }
      }
      return false;
    };
    document.addEventListener("touchstart", (e) => {
      ativo = false;
      const d = App().dados();
      if (!d || cfg(d).deslizar === false || !celular() || e.touches.length !== 1) return;
      if (UI.modalAberto() || gavetaAberta() || document.body.classList.contains("tour-on") || document.body.classList.contains("fab-aberto") || document.body.classList.contains("mais-aberto") || document.body.classList.contains("av-aberta") || document.documentElement.classList.contains("travado")) return;
      const t = e.touches[0];
      // as bordas são do gesto de "voltar" do próprio sistema
      if (t.clientX < 22 || t.clientX > global.innerWidth - 22) return;
      if (!e.target.closest("#conteudo") || rolaDeLado(e.target)) return;
      x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); ativo = true; travado = null;
    }, { passive: true });
    document.addEventListener("touchmove", (e) => {
      if (!ativo) return;
      const t = e.touches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (travado == null && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) travado = Math.abs(dx) > Math.abs(dy) * 1.5 ? "x" : "y";
      if (travado === "y") { ativo = false; const c = cont(); if (c) c.style.transform = ""; return; }
      // o gesto é do app: o navegador não deve usá-lo para "voltar/avançar" página
      if (travado === "x" && e.cancelable) e.preventDefault();
      if (travado === "x" && !calmo()) { const c = cont(); if (c) { c.style.transition = "none"; c.style.transform = `translateX(${Math.max(-60, Math.min(60, dx * 0.3))}px)`; } }
    }, { passive: false });
    const fim = (e) => {
      const c = cont();
      if (c && c.style.transform) { c.style.transition = "transform .18s ease"; c.style.transform = ""; setTimeout(() => { c.style.transition = ""; }, 200); }
      if (!ativo) return;
      ativo = false;
      if (travado !== "x" || !e.changedTouches || !e.changedTouches.length) return;
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0, dt = Date.now() - t0;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8 || dt > 800) return;
      irParaLado(dx < 0 ? 1 : -1);
    };
    document.addEventListener("touchend", fim, { passive: true });
    document.addEventListener("touchcancel", () => { ativo = false; const c = cont(); if (c) c.style.transform = ""; }, { passive: true });
  })();

  global.Navegacao = { abrirGaveta, fecharGaveta, irParaLado, telaInicial, itensFab, cartaoAjustes, abrirDia, abrirAtalhos, ATALHOS, subirAoTopo };
})(window);
