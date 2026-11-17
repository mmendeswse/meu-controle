/**
 * busca.js
 * -----------------------------------------------------------------------
 * Busca em tudo: telas e abas, ações ("registrar peso", "novo hábito"…),
 * ajustes, tópicos de ajuda e os seus cadastros (alimentos, fichas,
 * hábitos, remédios, metas e itens da lista de compras).
 *
 * Abre pela lupa (barra do topo no celular, menu lateral no computador),
 * pelo teclado ( / ou Ctrl + K ) e pelo menu "Mais". Sem digitar nada,
 * mostra o que você abriu por último e sugestões.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo, UI = global.UI;
  const esc = UI.esc;
  const App = () => global.App;
  const AR = () => global.Areas;
  const CHAVE_REC = "meuControle:buscaRecentes";
  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // telas e abas: [rota, título, palavras, área]
  const TELAS = [
    ["dashboard", "Hoje", "inicio resumo roteiro seu dia painel", null, "🏠"],
    ["evolucao", "Corpo", "peso medidas imc gordura massa muscular grafico evolucao", "evolucao", "⚖️"],
    ["alimentacao", "Alimentação · Diário", "refeicoes calorias macros comer dieta agua", "alimentacao", "🍽️"],
    ["alimentacao/semana", "Alimentação · Semana", "cardapio planejamento favoritas planejar", "alimentacao", "🗓️"],
    ["alimentacao/alimentos", "Alimentação · Alimentos", "tabela cadastro nutricional calorias preco", "alimentacao", "🥦"],
    ["alimentacao/produtos", "Alimentação · Produtos", "marcas rotulos produtos embalagem caderno comprar", "alimentacao", "🏷️"],
    ["evolucao/fotos", "Corpo · Fotos", "fotos evolucao antes depois shape progresso", "evolucao", "📸"],
    ["academia", "Treino · Treinos", "academia musculacao treino de hoje historico", "academia", "🏋️"],
    ["academia/fichas", "Treino · Fichas e plano", "ficha exercicios plano semanal abc", "academia", "📋"],
    ["academia/calendario", "Treino · Calendário", "mes dias treinados frequencia", "academia", "📆"],
    ["academia/carga", "Treino · Carga", "evolucao de carga peso exercicio progressao", "academia", "📈"],
    ["bemestar", "Bem-estar · Resumo", "sono humor energia estresse passos check-in checkin", "checkin", "💚"],
    ["bemestar/habitos", "Bem-estar · Hábitos", "habitos desafios rotina sequencia", "habitos", "✅"],
    ["bemestar/remedios", "Bem-estar · Remédios", "remedios suplementos doses horarios estoque medicamento vitamina", "remedios", "💊"],
    ["bemestar/jejum", "Bem-estar · Jejum", "jejum intermitente cronometro 16:8", "jejum", "⏳"],
    ["compras", "Compras · Lista", "lista de compras mercado feira itens", "compras", "🛒"],
    ["compras/estoque", "Compras · Em casa", "estoque despensa geladeira minimo", "compras", "📦"],
    ["compras/gastos", "Compras · Gastos", "gastos dinheiro precos extrato por mes", "compras", "💰"],
    ["metas", "Metas", "objetivos metas progresso prazo", "metas", "🎯"],
    ["metas/conquistas", "Conquistas", "medalhas trofeus conquistas", "metas", "🏆"],
    ["relatorios", "Relatórios", "resumo semanal mensal insights pdf planilha exportar", "relatorios", "📊"],
    ["configuracoes", "Ajustes", "configuracoes preferencias opcoes", null, "⚙️"],
    ["ajuda", "Central de ajuda", "ajuda duvidas como faco tutorial glossario", null, "💡"]
  ];
  // ações: [acao, título, palavras, área, ícone, dados]
  const ACOES = [
    ["rapido-peso", "Registrar peso", "pesar balanca pesagem", "evolucao", "⚖️"],
    ["rapido-medida", "Registrar medidas", "cintura braco bioimpedancia gordura medicao", "evolucao", "📏"],
    ["rapido-refeicao", "Registrar refeição", "comer cafe almoco jantar lanche", "alimentacao", "🍽️"],
    ["rapido-agua", "Registrar água", "beber copo litros hidratacao", null, "💧"],
    ["rapido-treino", "Iniciar ou registrar treino", "academia malhar", "academia", "🏋️"],
    ["rapido-checkin", "Fazer o check-in do dia", "sono humor energia passos", "checkin", "🙂"],
    ["rapido-jejum", "Começar ou encerrar jejum", "jejum intermitente", "jejum", "⏳"],
    ["rapido-compra", "Adicionar item à lista de compras", "comprar mercado", "compras", "🛒"],
    ["rapido-alimento", "Cadastrar alimento", "novo alimento tabela nutricional", "alimentacao", "🥦"],
    ["nova-foto", "Adicionar foto de evolução", "foto corpo antes depois shape camera", "evolucao", "📸"],
    ["novo-produto", "Adicionar produto (marca e rótulo)", "produto marca rotulo embalagem foto", "alimentacao", "🏷️"],
    ["nova-meta", "Criar meta", "objetivo nova meta", "metas", "🎯"],
    ["calc-metas", "Calcular minhas metas (calorias, proteína, água)", "calculadora tmb gasto calorico tdee quanto comer deficit", "alimentacao", "🧮"],
    ["novo-habito", "Criar hábito", "novo habito desafio", "habitos", "✅"],
    ["habito-modelos", "Hábitos prontos (modelos)", "sugestoes de habitos", "habitos", "✨"],
    ["novo-remedio", "Cadastrar remédio ou suplemento", "novo remedio medicamento vitamina", "remedios", "💊"],
    ["nova-ficha", "Criar ficha de treino", "nova ficha exercicios", "academia", "📋"],
    ["dia-detalhe", "Ver um dia em detalhe", "historico ontem outro dia o que eu fiz", null, "📅"],
    ["exportar-backup", "Fazer backup agora", "salvar copia seguranca exportar", null, "🛟"],
    ["exportar-planilha", "Exportar tudo para planilha", "excel xlsx exportar", null, "📄"],
    ["av-abrir", "Trocar avatar", "foto perfil personagem anime emoji", null, "🖼️"],
    ["editar-perfil", "Editar perfil", "nome altura objetivo", null, "👤"],
    ["tema-alternar", "Alternar tema claro / escuro", "modo escuro claro dark light noite", null, "🌓"],
    ["atalhos-teclado", "Atalhos de teclado", "teclas atalho", null, "⌨️"],
    ["primeiro-uso", "Refazer a configuração inicial", "onboarding comecar de novo perfil de uso", null, "✨"],
    ["instalar-app", "Instalar o app", "pwa icone tela de inicio", null, "📲"]
  ];

  // ---------------------------------------------------------------------
  // índice
  // ---------------------------------------------------------------------
  function indice() {
    const d = App().dados(), usa = (a) => !a || AR().area(d, a), itens = [];
    const add = (grupo, o) => { o.grupo = grupo; o.busca = norm(o.t + " " + (o.p || "") + " " + (o.s || "")); o.tn = norm(o.t); itens.push(o); };
    ACOES.forEach((a) => { if (usa(a[3]) && App().dados()) add("Ações", { id: "a:" + a[0], t: a[1], p: a[2], ic: a[4], acao: a[0] }); });
    TELAS.forEach((t) => { if (usa(t[3])) add("Telas", { id: "t:" + t[0], t: t[1], p: t[2], ic: t[4], rota: t[0] }); });
    if (global.Ajustes) global.Ajustes.itens().forEach((i) => { if (!i.rota) add("Ajustes", { id: "j:" + i.k, t: i.r, s: i.s, p: i.p, ic: i.ic, rota: "configuracoes/" + i.k }); });
    if (global.Tutorial) Object.keys(global.Tutorial.TOURS).forEach((k) => { const t = global.Tutorial.TOURS[k]; if (usa(t.area)) add("Ajuda", { id: "tour:" + k, t: "Tutorial: " + t.nome, p: "tour passo a passo como funciona", ic: t.icone, acao: "tour", dados: { k } }); });
    if (global.Ajuda) global.Ajuda.topicos(d).forEach((t) => add("Ajuda", { id: "h:" + t.k, t: t.q, p: t.p, ic: "💡", rota: "ajuda/" + t.k }));
    // cadastros
    if (usa("alimentacao")) d.alimentos.forEach((a) => add("Alimentos", { id: "al:" + a.id, t: a.nome, s: (a.categoria || "") + (a.kcal != null ? " · " + Math.round(a.kcal) + " kcal" : ""), ic: N.EMOJI_CATEGORIA[a.categoria] || "🥦", acao: "editar-alimento", dados: { id: a.id } }));
    if (usa("alimentacao")) (d.produtos || []).forEach((p) => add("Produtos e marcas", { id: "pr:" + p.id, t: p.nome, s: [p.marca, p.mercado].filter(Boolean).join(" · "), p: p.obs || "", ic: p.avaliacao === "evitar" ? "🚫" : p.avaliacao === "preferido" ? "⭐" : "🏷️", acao: "produto-ver", dados: { id: p.id } }));
    if (usa("academia")) d.fichas.forEach((f) => add("Fichas de treino", { id: "fi:" + f.id, t: f.nome, p: (d.exercicios || []).filter((e) => e.fichaId === f.id).map((e) => e.nome).join(" "), ic: "📋", acao: "editar-ficha", dados: { id: f.id } }));
    if (usa("habitos")) d.habitos.forEach((h) => add("Hábitos", { id: "ha:" + h.id, t: h.nome, ic: h.emoji || "✅", acao: "editar-habito", dados: { id: h.id } }));
    if (usa("remedios")) d.remedios.forEach((r) => add("Remédios", { id: "re:" + r.id, t: r.nome, s: r.dose || "", ic: "💊", acao: "editar-remedio", dados: { id: r.id } }));
    if (usa("metas")) d.metas.filter((m) => m.ativa !== false).forEach((m) => { const tp = global.Metas.TIPOS[m.tipo]; if (tp) add("Metas", { id: "me:" + m.id, t: m.titulo || tp.rotulo, s: "objetivo " + global.Metas.fmt(m.tipo, m.valorAlvo), ic: tp.icone, acao: "editar-meta", dados: { id: m.id } }); });
    if (usa("compras")) d.compras.filter((c) => c.status === "Pendente").forEach((c) => { const al = c.alimentoId ? d.alimentos.find((a) => a.id === c.alimentoId) : null; const nome = c.nome || (al && al.nome); if (nome) add("Lista de compras", { id: "co:" + c.id, t: nome, s: "falta comprar", ic: "🛒", acao: "editar-compra", dados: { id: c.id } }); });
    return itens;
  }

  function pontuar(o, tokens, q) {
    let p = 0;
    for (const t of tokens) {
      if (o.busca.indexOf(t) === -1) return 0;
      if (o.tn.indexOf(t) === 0) p += 6;
      else if (new RegExp("(^|[\\s·(/-])" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(o.tn)) p += 4;
      else if (o.tn.indexOf(t) !== -1) p += 2;
      else p += 1;
    }
    if (o.tn === q) p += 10;
    return p;
  }
  const ORDEM_GRUPOS = ["Ações", "Telas", "Ajustes", "Alimentos", "Produtos e marcas", "Fichas de treino", "Hábitos", "Remédios", "Metas", "Lista de compras", "Ajuda"];

  // ---------------------------------------------------------------------
  // recentes (neste aparelho)
  // ---------------------------------------------------------------------
  function recentes() { try { return JSON.parse(localStorage.getItem(CHAVE_REC) || "[]"); } catch (e) { return []; } }
  function lembrar(id) {
    try { const l = recentes().filter((x) => x !== id); l.unshift(id); localStorage.setItem(CHAVE_REC, JSON.stringify(l.slice(0, 6))); } catch (e) { /* sem espaço */ }
  }

  // ---------------------------------------------------------------------
  // tela
  // ---------------------------------------------------------------------
  let IDX = [], visiveis = [], sel = 0;
  function resultados(texto) {
    const q = norm(texto.trim()), tokens = q.split(/\s+/).filter(Boolean);
    if (!tokens.length) {
      const rec = recentes().map((id) => IDX.find((o) => o.id === id)).filter(Boolean);
      const sug = ["a:rapido-refeicao", "a:rapido-peso", "a:rapido-agua", "a:rapido-checkin", "a:dia-detalhe", "a:calc-metas", "t:ajuda"].map((id) => IDX.find((o) => o.id === id)).filter((o) => o && rec.indexOf(o) === -1).slice(0, 5);
      return [{ g: "Abertos por último", l: rec }, { g: "Sugestões", l: sug }].filter((x) => x.l.length);
    }
    const porGrupo = {};
    IDX.forEach((o) => { const p = pontuar(o, tokens, q); if (p) (porGrupo[o.grupo] || (porGrupo[o.grupo] = [])).push({ o, p }); });
    return ORDEM_GRUPOS.filter((g) => porGrupo[g]).map((g) => ({ g, max: Math.max.apply(null, porGrupo[g].map((x) => x.p)), l: porGrupo[g].sort((a, b) => b.p - a.p || a.o.t.localeCompare(b.o.t)).slice(0, g === "Alimentos" ? 6 : 5).map((x) => x.o) }))
      .sort((a, b) => (b.max >= 10 ? 1 : 0) - (a.max >= 10 ? 1 : 0));
  }
  function desenhar(texto) {
    const cx = document.getElementById("buscaLista");
    if (!cx) return;
    const gs = resultados(texto);
    visiveis = gs.reduce((l, g) => l.concat(g.l), []);
    sel = 0;
    let i = 0;
    cx.innerHTML = visiveis.length ? gs.map((g) => `<div class="bs-grupo"><span class="bs-rot">${esc(g.g)}</span>${g.l.map((o) => { const n = i++; return `<button class="bs-item${n === 0 ? " atual" : ""}" data-acao="busca-ir" data-i="${n}" role="option" aria-selected="${n === 0}"><span class="bs-ic">${o.ic || "•"}</span><span class="bs-txt"><b>${esc(o.t)}</b>${o.s ? `<small>${esc(o.s)}</small>` : ""}</span><span class="bs-tipo">${o.acao && o.grupo === "Ações" ? "ação" : ""}</span></button>`; }).join("")}</div>`).join("")
      : `<div class="bs-vazio"><b>Nada encontrado para “${esc(texto.trim())}”.</b><p>Tente outra palavra — por exemplo “peso”, “remédio”, “backup” ou o nome de um alimento.</p><button class="btn pequeno" data-acao="ir" data-secao="ajuda">Abrir a Central de ajuda</button></div>`;
  }
  function mover(delta) {
    if (!visiveis.length) return;
    sel = (sel + delta + visiveis.length) % visiveis.length;
    document.querySelectorAll("#buscaLista .bs-item").forEach((b, i) => { b.classList.toggle("atual", i === sel); b.setAttribute("aria-selected", i === sel); if (i === sel) { try { b.scrollIntoView({ block: "nearest" }); } catch (e) { /* ok */ } } });
  }
  function executar(o) {
    if (!o) return;
    lembrar(o.id);
    UI.fecharModal();
    if (o.rota) { App().ir(o.rota); return; }
    // dispara a ação pela mesma delegação de cliques dos botões do app
    const b = document.createElement("button");
    b.dataset.acao = o.acao;
    Object.keys(o.dados || {}).forEach((k) => { b.dataset[k] = o.dados[k]; });
    if (o.acao === "dia-detalhe") b.dataset.data = N.hoje(-1);
    b.hidden = true;
    document.body.appendChild(b);
    UI.aposVoltar(() => { b.click(); b.remove(); });
  }
  function abrir(textoInicial) {
    if (!App().dados()) return;
    document.body.classList.remove("mais-aberto");
    App().fecharFab();
    IDX = indice();
    const m = UI.abrirModal(`<div class="bs">
      <label class="bs-campo">${UI.svg("buscar")}<input id="buscaCampo" type="search" placeholder="Buscar telas, ações, ajustes, alimentos…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Buscar" aria-controls="buscaLista" value="${esc(textoInicial || "")}"></label>
      <div class="bs-lista" id="buscaLista" role="listbox" aria-label="Resultados"></div>
      <div class="bs-rodape"><span><kbd>↑</kbd><kbd>↓</kbd> escolher</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span></div>
    </div>`, { semFoco: true, largo: true });
    m.classList.add("modal-busca");
    const campo = m.querySelector("#buscaCampo");
    desenhar(campo.value);
    campo.addEventListener("input", () => desenhar(campo.value));
    campo.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); mover(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); mover(-1); }
      else if (e.key === "Enter") { e.preventDefault(); executar(visiveis[sel]); }
    });
    setTimeout(() => { try { campo.focus({ preventScroll: true }); } catch (e) { campo.focus(); } }, 40);
  }

  App().registrarAcoes({
    "busca-abrir": () => abrir(),
    "busca-ir": (el) => executar(visiveis[Number(el.dataset.i)]),
    "tema-alternar": () => {
      const d = App().dados(), ap = d.config.aparencia;
      const claro = global.Personalizar.temaEfetivo(ap) === "claro";
      ap.tema = claro ? "escuro" : "claro";
      ap.temaPronto = null;
      global.Personalizar.aplicar(d);
      App().salvar(claro ? "Tema escuro." : "Tema claro.", { semIntegracao: true });
    }
  });

  global.Busca = { abrir, indice, TELAS, ACOES };
})(window);
