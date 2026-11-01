/**
 * personalizar.js
 * -----------------------------------------------------------------------
 * Aparência (tema claro/escuro, cor do app, tamanho da letra, avatar) e
 * rotina do dia (horários e o que aparece no roteiro "Seu dia").
 *
 * As escolhas ficam em config.aparencia e config.rotina, aplicadas na
 * página assim que mudam — os cartões de Ajustes salvam a cada toque.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo, UI = global.UI, A = global.Armazenamento;
  const esc = UI.esc;

  const CORES = [
    { k: "rosa", r: "Rosa", c: "#FF375F" }, { k: "vermelho", r: "Vermelho", c: "#FF453A" }, { k: "laranja", r: "Laranja", c: "#FF9F0A" },
    { k: "amarelo", r: "Amarelo", c: "#FFCC00" }, { k: "verde", r: "Verde", c: "#30D158" }, { k: "menta", r: "Menta", c: "#00C7BE" },
    { k: "turquesa", r: "Turquesa", c: "#40C8E0" }, { k: "azul", r: "Azul", c: "#0A84FF" }, { k: "indigo", r: "Índigo", c: "#5E5CE6" },
    { k: "roxo", r: "Roxo", c: "#BF5AF2" }, { k: "marrom", r: "Marrom", c: "#AC8E68" }, { k: "grafite", r: "Grafite", c: "#8E8E93" }
  ];
  const FONTES = [{ k: "pequena", r: "Pequena", z: 0.92 }, { k: "normal", r: "Normal", z: 1 }, { k: "grande", r: "Grande", z: 1.1 }, { k: "extra", r: "Extra grande", z: 1.22 }];
  const TEMAS = [{ k: "escuro", r: "🌙 Escuro" }, { k: "claro", r: "☀️ Claro" }, { k: "auto", r: "🌓 Automático" }];
  const AVATARES = ["🙂", "😎", "🤓", "🥰", "😺", "🐶", "🦊", "🐼", "🦁", "🐯", "🐸", "🐵", "🦄", "🐝", "🐢", "🐬", "🌻", "🌈", "⭐", "🔥", "⚡", "🏃", "🏋️", "🧘", "🚴", "⚽", "🏀", "🎮", "🎸", "📚", "👩", "👨", "👧", "👦", "👵", "👴"];
  const SECOES = ["c-hoje", "c-corpo", "c-comer", "c-treino", "c-bem", "c-compras", "c-metas", "c-relat"];

  function corHex(k) { const c = CORES.find((x) => x.k === k); return c ? c.c : CORES[0].c; }
  function temaEfetivo(ap) {
    if (ap.tema === "auto") return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "claro" : "escuro";
    return ap.tema === "claro" ? "claro" : "escuro";
  }

  // ---------------------------------------------------------------------
  // aplicar na página
  // ---------------------------------------------------------------------
  function aplicar(d) {
    d = d || A.carregarDados();
    const ap = d.config.aparencia || A.aparenciaPadrao();
    const html = document.documentElement;
    const tema = temaEfetivo(ap);
    html.dataset.tema = tema;
    const cor = corHex(ap.cor);
    html.style.setProperty("--c-hoje", cor);
    html.style.setProperty("--c-metas", cor);
    SECOES.forEach((s) => { if (s !== "c-hoje" && s !== "c-metas") html.style.removeProperty("--" + s); });
    if (ap.corUnica) SECOES.forEach((s) => html.style.setProperty("--" + s, cor));
    const f = FONTES.find((x) => x.k === ap.fonte) || FONTES[1];
    html.style.setProperty("--zoom", f.z);
    html.classList.toggle("zoom-ativo", f.z !== 1);
    html.classList.toggle("sem-animacao", ap.animacoes === false);
    const meta = document.querySelector('meta[name="theme-color"]') || (() => { const m = document.createElement("meta"); m.name = "theme-color"; document.head.appendChild(m); return m; })();
    meta.content = tema === "claro" ? "#F2F2F7" : "#000000";
    const cs = document.querySelector('meta[name="color-scheme"]');
    if (cs) cs.content = tema === "claro" ? "light" : "dark";
    aplicarRotina(d);
  }
  // os horários da rotina viram os horários sugeridos dos formulários
  function aplicarRotina(d) {
    const h = (d.config.rotina || {}).horarios || {};
    N.TIPOS_REFEICAO.forEach((t) => { if (h[t]) N.HORARIO_SUGERIDO[t] = h[t]; });
  }
  function horario(d, chave) {
    const h = ((d.config.rotina || {}).horarios || {})[chave];
    return h || A.rotinaPadrao().horarios[chave] || "";
  }
  function mostrar(d, chave) {
    const m = (d.config.rotina || {}).mostrar || {};
    return m[chave] !== false && m[chave] !== "nao";
  }

  // avatar (emoji ou inicial) com a cor escolhida
  // avatar: imagem (anime, ilustração ou foto), emoji ou inicial do nome
  function avatarConteudo(d) {
    const u = d.usuarios[0], ap = d.config.aparencia || {};
    const nome = u.nome && u.nome !== "Eu" ? u.nome : "";
    const img = ap.avatarImg;
    if (img && img.src) return `<img src="${esc(img.src)}" alt="" referrerpolicy="no-referrer" style="object-position:${esc(img.foco || "50% 30%")}" onerror="this.remove()">`;
    return ap.avatar ? `<span class="av-emoji">${esc(ap.avatar)}</span>` : esc((nome || "Eu").charAt(0).toUpperCase());
  }
  function avatarHTML(d, classe, acao) {
    const ap = d.config.aparencia || {};
    const alvo = acao || `data-acao="ir" data-secao="configuracoes" data-param="aparencia"`;
    return `<button class="avatar ${classe || ""}${ap.avatarImg && ap.avatarImg.src ? " com-img" : ""}" ${alvo} title="Perfil e avatar" style="--av:${corHex(ap.avatarCor || "roxo")}">${avatarConteudo(d)}</button>`;
  }

  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const f = () => { const d = A.carregarDados(); if ((d.config.aparencia || {}).tema === "auto") { aplicar(d); if (global.App && global.App.renderizar) global.App.renderizar(); } };
    if (mq.addEventListener) mq.addEventListener("change", f);
  }

  // ---------------------------------------------------------------------
  // cartões de Ajustes
  // ---------------------------------------------------------------------
  function seg(acao, itens, atual) {
    return `<div class="seg-opcoes" role="radiogroup">${itens.map((i) => `<button role="radio" aria-checked="${i.k === atual}" class="${i.k === atual ? "ativo" : ""}" data-acao="${acao}" data-k="${esc(i.k)}">${i.r}</button>`).join("")}</div>`;
  }
  // mesmo desenho dos interruptores que já existem em Ajustes
  function interruptor(id, rotulo, ligado, ajuda, dados) {
    return `<label class="interruptor"><input type="checkbox" id="${id}"${ligado ? " checked" : ""} ${dados || ""}><span class="int-trilho"><i></i></span>
      <span class="int-txt"><b>${rotulo}</b>${ajuda ? `<small>${ajuda}</small>` : ""}</span></label>`;
  }

  function cartaoAparencia(d) {
    const ap = d.config.aparencia, u = d.usuarios[0];
    return UI.card({ titulo: "Aparência", sub: "cada pessoa deixa o app do seu jeito", id: "sec-aparencia", corpo: `<div class="pad ajustes-ap">
      <div class="ap-perfil">
        ${avatarHTML(d, "grande", 'data-acao="av-abrir"')}
        <div><b>${esc(u.nome && u.nome !== "Eu" ? u.nome : "Sem nome")}</b><small>${esc(ap.avatarImg && ap.avatarImg.nome && ap.avatarImg.fonte !== "foto" ? ap.avatarImg.nome : u.objetivo || "")}</small>
          <span class="botoes-linha"><button class="btn pequeno primario" data-acao="av-abrir">Editar avatar</button><button class="btn pequeno" data-acao="editar-perfil">Perfil</button></span></div>
      </div>
      <div class="ap-bloco"><span class="ap-rot">Tema</span>${seg("ap-tema", TEMAS, ap.tema)}</div>
      <div class="ap-bloco"><span class="ap-rot">Cor do app</span>
        <div class="ap-cores">${CORES.map((c) => `<button class="ap-cor${ap.cor === c.k ? " ativo" : ""}" data-acao="ap-cor" data-k="${c.k}" style="--c:${c.c}" title="${c.r}" aria-label="${c.r}"></button>`).join("")}</div>
        ${interruptor("ap_unica", "Mesma cor em todas as telas", ap.corUnica, "Desligado, cada área tem a sua cor (Treino verde, Alimentação laranja…).", 'data-mudar="ap-cor-unica"')}
      </div>
      <div class="ap-bloco"><span class="ap-rot">Tamanho da letra</span>${seg("ap-fonte", FONTES, ap.fonte)}</div>
      <div class="ap-bloco">
        ${interruptor("ap_vibrar", "Vibrar ao marcar itens", ap.vibrar !== false, "No celular, uma vibração curta ao concluir algo.", 'data-mudar="ap-vibrar"')}
        ${interruptor("ap_anim", "Animações", ap.animacoes !== false, "Desligue se preferir uma tela mais calma.", 'data-mudar="ap-anim"')}
        <label class="linha-sel"><span><b>Copo de água</b><small>Quanto soma o botão “+ copo”.</small></span>
          <select class="sel" data-mudar="ap-copo">${UI.opcoes([150, 200, 250, 300, 350, 400, 500].map((v) => ({ v, r: v + " ml" })), d.config.copoAgua || 250)}</select></label>
      </div>
    </div>` });
  }

  const ITENS_ROTEIRO = [
    { k: "sono", r: "😴 Sono da noite", s: "registrar ao acordar" }, { k: "humor", r: "🙂 Como foi o dia", s: "humor, energia e estresse" },
    { k: "agua", r: "💧 Água", s: "ao longo do dia" }, { k: "treino", r: "🏋️ Treino", s: "do plano ou registrado" },
    { k: "remedios", r: "💊 Remédios", s: "cada dose no horário" }, { k: "habitos", r: "✅ Hábitos", s: "os previstos para o dia" },
    { k: "jejum", r: "⏳ Jejum", s: "quando houver um em andamento" }
  ];
  function cartaoRotina(d) {
    const r = d.config.rotina;
    const h = r.horarios;
    const campoHora = (k, rot) => `<label class="hora-campo"><span>${rot}</span><input type="time" value="${esc(h[k] || "")}" data-mudar="rotina-hora" data-k="${esc(k)}"></label>`;
    return UI.card({ titulo: "Rotina do dia", sub: "horários e o que aparece em “Seu dia”, na tela Hoje", id: "sec-rotina", corpo: `<div class="pad ajustes-rotina">
      <div class="ap-rot">Horários</div>
      <div class="horas-grade">
        ${campoHora("acordar", "⏰ Acordar")}${campoHora("dormir", "🛏️ Dormir")}${campoHora("treino", "🏋️ Treino")}${campoHora("checkin", "🙂 Check-in")}
        ${N.TIPOS_REFEICAO.map((t) => campoHora(t, (N.EMOJI_REFEICAO[t] || "") + " " + (N.TIPO_CURTO[t] || t))).join("")}
      </div>
      <div class="ap-rot">Refeições do seu dia</div>
      <div class="chips" id="rotinaRefeicoes">${N.TIPOS_REFEICAO.map((t) => `<label class="chip"><input type="checkbox" value="${esc(t)}" data-mudar="rotina-refeicao"${r.refeicoesDoDia.indexOf(t) !== -1 ? " checked" : ""}><span>${N.EMOJI_REFEICAO[t] || ""} ${esc(t)}</span></label>`).join("")}</div>
      <p class="ajuda">As marcadas aparecem no roteiro mesmo sem estarem planejadas, para registrar com um toque.</p>
      <div class="ap-rot">Pesagem</div>
      <div class="linha-campos">${seg("rotina-peso", [{ k: "diario", r: "Todo dia" }, { k: "semanal", r: "Uma vez por semana" }, { k: "nao", r: "Não mostrar" }], r.mostrar.peso)}
        ${r.mostrar.peso === "semanal" ? `<select class="sel" data-mudar="rotina-dia-peso">${UI.opcoes([1, 2, 3, 4, 5, 6, 7].map((v) => ({ v, r: N.NOMES_DIA[v] })), r.mostrar.diaPesagem || 1)}</select>` : ""}</div>
      <div class="ap-rot">Mostrar no roteiro</div>
      <div class="lista-interruptores">${ITENS_ROTEIRO.map((i) => interruptor("rot_" + i.k, i.r, r.mostrar[i.k] !== false, i.s, `data-mudar="rotina-mostrar" data-k="${i.k}"`)).join("")}</div>
      <p class="rodape-card"><button class="link-acao" data-acao="rotina-padrao">Voltar aos horários padrão</button></p>
    </div>` });
  }

  // ---------------------------------------------------------------------
  // ações (salvam na hora)
  // ---------------------------------------------------------------------
  const App = () => global.App;
  function salvarAp(msg) {
    const d = App().dados();
    aplicar(d);
    App().salvar(msg || null, { semIntegracao: true, manterRolagem: true });
  }
  global.App.registrarAcoes({
    "ap-tema": (el) => { App().dados().config.aparencia.tema = el.dataset.k; salvarAp(); },
    "ap-cor": (el) => { App().dados().config.aparencia.cor = el.dataset.k; salvarAp(); },
    "ap-fonte": (el) => { App().dados().config.aparencia.fonte = el.dataset.k; salvarAp(); },
    "ap-avatar": (el) => { App().dados().config.aparencia.avatar = el.dataset.k; salvarAp(); },
    "ap-avatar-cor": (el) => { App().dados().config.aparencia.avatarCor = el.dataset.k; salvarAp(); },
    "rotina-peso": (el) => { App().dados().config.rotina.mostrar.peso = el.dataset.k; salvarAp(); },
    "rotina-padrao": () => UI.confirmar({ titulo: "Horários padrão", texto: "Voltar todos os horários da rotina para o padrão? O que aparece no roteiro continua como está.", rotulo: "Voltar ao padrão", perigo: false,
      aoConfirmar: () => { App().dados().config.rotina.horarios = A.rotinaPadrao().horarios; salvarAp("Horários restaurados."); } })
  });
  global.App.registrarMudancas({
    "ap-cor-unica": (el) => { App().dados().config.aparencia.corUnica = el.checked; salvarAp(); },
    "ap-vibrar": (el) => { App().dados().config.aparencia.vibrar = el.checked; salvarAp(); },
    "ap-anim": (el) => { App().dados().config.aparencia.animacoes = el.checked; salvarAp(); },
    "ap-copo": (el) => { App().dados().config.copoAgua = Number(el.value) || 250; salvarAp(); },
    "rotina-hora": (el) => { if (!el.value) return; App().dados().config.rotina.horarios[el.dataset.k] = el.value; salvarAp(); },
    "rotina-refeicao": () => { App().dados().config.rotina.refeicoesDoDia = UI.chips("rotinaRefeicoes"); salvarAp(); },
    "rotina-dia-peso": (el) => { App().dados().config.rotina.mostrar.diaPesagem = Number(el.value) || 1; salvarAp(); },
    "rotina-mostrar": (el) => { App().dados().config.rotina.mostrar[el.dataset.k] = el.checked; salvarAp(); }
  });

  global.Personalizar = { CORES, FONTES, TEMAS, AVATARES, corHex, temaEfetivo, aplicar, aplicarRotina, horario, mostrar, avatarHTML, cartaoAparencia, cartaoRotina, interruptor, seg };
})(window);
