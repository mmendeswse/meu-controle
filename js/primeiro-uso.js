/**
 * primeiro-uso.js
 * -----------------------------------------------------------------------
 * Boas-vindas guiadas na primeira abertura (app vazio): em 4 passos curtos
 * a pessoa diz o nome, escolhe o avatar, o que quer acompanhar e os
 * horários de acordar e dormir. Também dá para restaurar um backup (quem
 * trocou de aparelho) ou explorar com dados de exemplo.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo, UI = global.UI, A = global.Armazenamento;
  const esc = UI.esc;
  const App = () => global.App;
  let passo = 0, refazendo = false;
  const escolha = { nome: "", avatar: "🙂", img: null, cor: "azul", perfil: "completo", acordar: "06:30", dormir: "23:00", tema: "escuro" };

  function deveMostrar(d) {
    const c = d.config;
    return !d.demo && !c.onboardingFeito && !c.perfilUso && !(global.Backup && global.Backup.temDados(d)) && (d.usuarios[0].nome || "Eu") === "Eu";
  }

  function pontos() { return `<div class="pu-pontos">${[0, 1, 2, 3].map((i) => `<i class="${i === passo ? "ativo" : i < passo ? "feito" : ""}"></i>`).join("")}</div>`; }
  function tela() {
    const P = global.Personalizar, AR = global.Areas;
    if (passo === 0) return `<div class="pu">
      <div class="pu-logo"><img src="favicon.svg" alt="" width="64" height="64"></div>
      <h3>Bem-vindo ao Meu Controle</h3>
      <p class="pu-sub">Alimentação, treino, sono, hábitos e remédios num lugar só. Tudo fica guardado só neste aparelho — sem cadastro e sem mensalidade.</p>
      <div class="pu-opcoes">
        <button class="pu-grande primario" data-acao="pu-proximo"><span>✨</span><span><b>Começar do zero</b><small>4 perguntas rápidas e o app fica do seu jeito</small></span></button>
        <button class="pu-grande" data-acao="pu-restaurar"><span>🛟</span><span><b>Restaurar um backup</b><small>Trocou de aparelho? Traga seus dados de volta</small></span></button>
        <button class="pu-grande" data-acao="pu-exemplo"><span>👀</span><span><b>Só olhar com dados de exemplo</b><small>Dados fictícios, apagáveis com um toque</small></span></button>
      </div></div>`;
    if (passo === 1) return `<div class="pu">${pontos()}
      <h3>Como você quer ser chamado?</h3>
      <div class="campo"><input id="pu_nome" value="${esc(escolha.nome)}" placeholder="Seu nome ou apelido" autocomplete="given-name" maxlength="40"></div>
      <span class="ap-rot">Seu avatar</span>
      <div class="pu-avatar"><button class="avatar gigante${escolha.img ? " com-img" : ""}" data-acao="pu-galeria" style="--av:${P.corHex(escolha.cor)}" aria-label="Escolher avatar">${escolha.img ? `<img src="${esc(escolha.img.src)}" alt="" referrerpolicy="no-referrer" style="object-position:${esc(escolha.img.foco || "50% 30%")}">` : `<span class="av-emoji">${escolha.avatar}</span>`}<i class="pu-lapis">✎</i></button></div>
      <button class="btn primario pu-galeria" data-acao="pu-galeria">🎨 Personagens de anime ou sua foto</button>
      <div class="pu-emojis">${P.AVATARES.slice(0, 12).map((e) => `<button class="ap-av${!escolha.img && escolha.avatar === e ? " ativo" : ""}" data-acao="pu-avatar" data-k="${e}">${e}</button>`).join("")}</div>
      ${rodape()}</div>`;
    if (passo === 2) return `<div class="pu">${pontos()}
      <h3>O que você quer acompanhar?</h3>
      <p class="pu-sub">Dá para mudar quando quiser em Ajustes → O que você usa.</p>
      <div class="presets pu-presets">${AR.PRESETS.map((p) => `<button class="preset${escolha.perfil === p.k ? " ativo" : ""}" data-acao="pu-perfil" data-k="${p.k}"><span class="pr-ic">${p.ic}</span><span><b>${esc(p.r)}</b><small>${esc(p.s)}</small></span></button>`).join("")}</div>
      ${rodape()}</div>`;
    return `<div class="pu">${pontos()}
      <h3>Sua rotina</h3>
      <p class="pu-sub">Os horários organizam o seu dia na tela Hoje.</p>
      <div class="par"><div class="campo"><label for="pu_acordar">⏰ Acordo às</label><input id="pu_acordar" type="time" value="${escolha.acordar}"></div>
        <div class="campo"><label for="pu_dormir">🛏️ Durmo às</label><input id="pu_dormir" type="time" value="${escolha.dormir}"></div></div>
      <span class="ap-rot">Tema</span>
      ${P.seg("pu-tema", P.TEMAS, escolha.tema)}
      ${rodape(true)}</div>`;
  }
  function rodape(ultimo) {
    const cancelar = refazendo && passo <= 1;
    return `<div class="pu-rodape"><button class="btn" data-acao="${cancelar ? "fechar-modal" : "pu-voltar"}">${cancelar ? "Cancelar" : "Voltar"}</button><button class="btn primario" data-acao="${ultimo ? "pu-concluir" : "pu-proximo"}">${ultimo ? "Concluir" : "Continuar"}</button></div>`;
  }
  function desenhar() {
    const m = document.getElementById("modal");
    if (!UI.modalAberto()) UI.abrirModal(tela(), { largo: true, semFoco: true, aoFechar: () => { if (passo >= 0) marcarFeito(); } });
    else m.innerHTML = `<button class="modal-fechar" data-acao="fechar-modal" aria-label="Fechar">${UI.svg("fechar")}</button>` + tela();
    m.classList.add("modal-pu");
    if (passo === 1 && global.Avatar) global.Avatar.preaquecer();
    const n = m.querySelector("#pu_nome");
    if (n) { n.addEventListener("input", () => { escolha.nome = n.value; }); if (window.matchMedia("(pointer: fine)").matches) setTimeout(() => n.focus(), 50); }
  }
  function lerCampos() {
    const a = document.getElementById("pu_acordar"), dm = document.getElementById("pu_dormir");
    if (a && a.value) escolha.acordar = a.value;
    if (dm && dm.value) escolha.dormir = dm.value;
  }
  function marcarFeito() {
    const d = App().dados();
    if (!d.config.onboardingFeito) {
      d.config.onboardingFeito = true;
      if (global.Tutorial && !d.config.novidadesVistas) d.config.novidadesVistas = global.Tutorial.NOVIDADES.versao;
      A.salvarDados(d, true, true);
    }
  }
  // refazer = aberto por Ajustes: já vem preenchido com o que a pessoa escolheu antes
  function abrir(refazer) {
    refazendo = refazer === true;
    if (refazendo) {
      const d = App().dados(), ap = d.config.aparencia, h = d.config.rotina.horarios, nome = d.usuarios[0].nome || "";
      Object.assign(escolha, { nome: nome === "Eu" ? "" : nome, avatar: ap.avatar || "🙂", img: ap.avatarImg || null, cor: ap.avatarCor || "azul",
        perfil: d.config.perfilUso || "completo", acordar: h.acordar || "06:30", dormir: h.dormir || "23:00", tema: ap.tema || "escuro" });
    }
    if (UI.modalAberto()) UI.fecharModal();
    passo = refazendo ? 1 : 0;
    UI.aposVoltar(desenhar);
  }

  App().registrarAcoes({
    "pu-proximo": () => { lerCampos(); if (passo === 1 && !escolha.nome.trim()) { UI.toast("Diga como quer ser chamado."); return; } passo = Math.min(3, passo + 1); desenhar(); },
    "pu-voltar": () => { lerCampos(); passo = Math.max(refazendo ? 1 : 0, passo - 1); desenhar(); },
    "pu-avatar": (el) => { escolha.avatar = el.dataset.k; escolha.img = null; desenhar(); },
    "pu-galeria": () => {
      const n = document.getElementById("pu_nome"); if (n) escolha.nome = n.value;
      global.Avatar.abrir({ nome: escolha.nome, cor: escolha.cor, atual: escolha.img ? Object.assign({}, escolha.img) : { fonte: "emoji", emoji: escolha.avatar },
        aoConcluir: (r) => { escolha.img = r.img; if (r.emoji) escolha.avatar = r.emoji; escolha.cor = r.cor; desenhar(); } });
    },
    "pu-cor": (el) => { escolha.cor = el.dataset.k; desenhar(); },
    "pu-perfil": (el) => { escolha.perfil = el.dataset.k; desenhar(); },
    "pu-tema": (el) => {
      escolha.tema = el.dataset.k; lerCampos();
      const d = App().dados(); d.config.aparencia.tema = escolha.tema; global.Personalizar.aplicar(d);
      desenhar();
    },
    "pu-restaurar": () => { passo = -1; UI.fecharModal(); marcarFeito(); document.getElementById("inputImportarBackup").click(); },
    "pu-exemplo": () => { passo = -1; UI.fecharModal(); App().substituirDados(A.carregarExemplo()); App().ir("dashboard"); UI.toast("Dados de exemplo carregados — apague quando quiser começar."); },
    "pu-concluir": () => {
      lerCampos();
      const d = App().dados();
      d.usuarios[0].nome = escolha.nome.trim() || "Eu";
      Object.assign(d.config.aparencia, { avatar: escolha.img ? "" : escolha.avatar, avatarImg: escolha.img || null, avatarCor: escolha.cor, cor: escolha.cor === "grafite" ? "rosa" : escolha.cor, tema: escolha.tema });
      d.config.rotina.horarios.acordar = escolha.acordar;
      d.config.rotina.horarios.dormir = escolha.dormir;
      global.Areas.aplicarPerfil(escolha.perfil, true);
      d.config.onboardingFeito = true;
      if (global.Tutorial && !refazendo) d.config.novidadesVistas = global.Tutorial.NOVIDADES.versao; // quem chegou agora já começa com tudo
      passo = -1;
      UI.fecharModal();
      refazendo = false;
      App().salvar(`Tudo pronto, ${escolha.nome.trim().split(" ")[0]}! Comece pelo seu dia aqui embaixo.`, { semIntegracao: true });
      App().ir("dashboard");
    },
    "primeiro-uso": () => abrir(true)
  });

  App().aoSalvar((d, abertura) => { if (abertura && deveMostrar(d)) setTimeout(abrir, 300); });

  global.PrimeiroUso = { abrir, deveMostrar };
})(window);
