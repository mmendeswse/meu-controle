/**
 * trava.js
 * -----------------------------------------------------------------------
 * Bloqueio do app com PIN de 6 dígitos (e, se o aparelho tiver, Face ID ou
 * digital). Pede o PIN ao abrir o app e ao voltar depois de alguns minutos
 * fora dele.
 *
 * O PIN nunca é guardado: fica só o resultado do PBKDF2-SHA256 (com sal
 * aleatório) numa chave própria do aparelho ("meuControle:seguranca"), que
 * NÃO vai no backup — cada aparelho tem o seu PIN.
 *
 * Esqueceu o PIN? Os dados deste aparelho (e as cópias de segurança
 * internas) são apagados e a pessoa restaura o último arquivo de backup.
 *
 * O bloqueio é uma tranca de tela: impede quem pega o celular desbloqueado
 * de abrir o app. Os dados em si continuam no armazenamento do navegador.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const UI = global.UI;
  const esc = UI.esc;
  const App = () => global.App;
  const CHAVE = "meuControle:seguranca";
  const ITER = 210000;
  const TAM = 6;
  const html = document.documentElement;

  // ---------------------------------------------------------------------
  // ajustes do aparelho
  // ---------------------------------------------------------------------
  function ler() { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; } }
  function gravar(s) { try { localStorage.setItem(CHAVE, JSON.stringify(s)); } catch (e) { /* sem espaço */ } }
  function ativo() { return !!ler().hash; }

  const b64 = (buf) => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  function aleatorio(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; }
  function derivar(pin, sal, iter) {
    return crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"])
      .then((k) => crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iter }, k, 256))
      .then(b64);
  }
  function definirPin(pin) {
    const sal = aleatorio(16);
    return derivar(pin, sal, ITER).then((hash) => {
      const s = ler();
      Object.assign(s, { v: 1, sal: b64(sal), hash, iter: ITER, erros: 0, esperaAte: 0 });
      if (s.apos == null) s.apos = 1;
      gravar(s);
    });
  }
  function conferir(pin) {
    const s = ler();
    if (!s.hash) return Promise.resolve(true);
    return derivar(pin, deB64(s.sal), s.iter || ITER).then((h) => {
      // comparação sem atalho
      let dif = h.length ^ s.hash.length;
      for (let i = 0; i < Math.min(h.length, s.hash.length); i++) dif |= h.charCodeAt(i) ^ s.hash.charCodeAt(i);
      return dif === 0;
    });
  }

  // ---------------------------------------------------------------------
  // Face ID / digital (WebAuthn com o autenticador do próprio aparelho)
  // ---------------------------------------------------------------------
  function bioDisponivel() {
    if (!global.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable || !global.isSecureContext) return Promise.resolve(false);
    return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false);
  }
  function bioAtivar() {
    const d = App().dados(), nome = (d.usuarios[0].nome && d.usuarios[0].nome !== "Eu") ? d.usuarios[0].nome : "Meu Controle";
    return navigator.credentials.create({ publicKey: {
      challenge: aleatorio(32), rp: { name: "Meu Controle" },
      user: { id: aleatorio(16), name: nome, displayName: nome },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60000, attestation: "none"
    } }).then((c) => { const s = ler(); s.bio = b64(c.rawId); gravar(s); });
  }
  function bioConferir() {
    const s = ler();
    if (!s.bio) return Promise.reject(new Error("sem biometria"));
    return navigator.credentials.get({ publicKey: {
      challenge: aleatorio(32), allowCredentials: [{ type: "public-key", id: deB64(s.bio), transports: ["internal", "hybrid"] }],
      userVerification: "required", timeout: 60000
    } }).then((r) => !!r);
  }

  // ---------------------------------------------------------------------
  // teclado de PIN (usado na tela de bloqueio e nos ajustes)
  // ---------------------------------------------------------------------
  // opc: { titulo, sub, aoCompletar(pin) → Promise<bool|string> (string = mensagem de erro), extra (html) }
  function teclado(el, opc) {
    let pin = "", ocupado = false;
    el.innerHTML = `<div class="pin">
      ${opc.topo || ""}
      <b class="pin-titulo">${esc(opc.titulo)}</b>
      <p class="pin-sub">${opc.sub || ""}</p>
      <div class="pin-pontos" aria-hidden="true">${"<i></i>".repeat(TAM)}</div>
      <p class="pin-erro" role="alert"></p>
      <div class="pin-teclas">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-n="${n}">${n}</button>`).join("")}
        <span class="pin-esq">${opc.esquerda || ""}</span><button type="button" data-n="0">0</button>
        <button type="button" class="pin-apagar" data-apagar aria-label="Apagar">⌫</button></div>
      ${opc.extra || ""}
      <input class="pin-oculto" type="password" inputmode="numeric" autocomplete="off" aria-label="PIN" maxlength="${TAM}">
    </div>`;
    const pontos = el.querySelectorAll(".pin-pontos i"), erro = el.querySelector(".pin-erro"), oculto = el.querySelector(".pin-oculto");
    const desenhar = () => pontos.forEach((p, i) => p.classList.toggle("on", i < pin.length));
    const tremer = (msg) => {
      erro.textContent = msg || "";
      const c = el.querySelector(".pin-pontos"); c.classList.remove("errou"); void c.offsetWidth; c.classList.add("errou");
      if (navigator.vibrate) { try { navigator.vibrate([40, 60, 40]); } catch (e) { /* sem suporte */ } }
    };
    const digitar = (n) => {
      if (ocupado || pin.length >= TAM) return;
      if (opc.bloqueado && opc.bloqueado()) { tremer(opc.bloqueado()); return; }
      pin += n; erro.textContent = ""; desenhar();
      if (pin.length === TAM) {
        ocupado = true;
        Promise.resolve(opc.aoCompletar(pin)).then((r) => {
          ocupado = false;
          if (r === true) return;
          pin = ""; desenhar(); tremer(typeof r === "string" ? r : "PIN incorreto.");
        });
      }
    };
    const apagar = () => { if (!ocupado) { pin = pin.slice(0, -1); desenhar(); } };
    el.querySelector(".pin-teclas").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.hasAttribute("data-apagar")) apagar(); else if (b.dataset.n != null) digitar(b.dataset.n);
    });
    // teclado físico (computador)
    el.addEventListener("keydown", (e) => {
      if (/^\d$/.test(e.key)) { e.preventDefault(); digitar(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); apagar(); }
    });
    el.tabIndex = -1;
    setTimeout(() => { if (global.matchMedia("(pointer: fine)").matches) el.focus({ preventScroll: true }); }, 60);
    return { limpar: () => { pin = ""; desenhar(); erro.textContent = ""; }, erro: (m) => tremer(m) };
  }

  // ---------------------------------------------------------------------
  // tela de bloqueio
  // ---------------------------------------------------------------------
  let travada = false;
  function esperaRestante() { const s = ler(); return Math.max(0, (s.esperaAte || 0) - Date.now()); }
  function msgEspera() {
    const ms = esperaRestante();
    if (!ms) return "";
    const seg = Math.ceil(ms / 1000);
    return `Muitas tentativas. Tente de novo em ${seg >= 60 ? Math.ceil(seg / 60) + " min" : seg + " s"}.`;
  }
  function travar() {
    if (!ativo()) return;
    travada = true;
    html.classList.add("travado");
    document.body.inert = true;
    if (UI.modalAberto && document.activeElement) document.activeElement.blur();
    let el = document.getElementById("trava");
    if (!el) {
      el = document.createElement("div");
      el.id = "trava"; el.className = "trava";
      el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "App bloqueado");
      html.appendChild(el); // fora do <body>, que fica inerte e escondido
    }
    const d = App() && App().dados();
    const u = d && d.usuarios[0], nome = u && u.nome && u.nome !== "Eu" ? u.nome.split(" ")[0] : "";
    const avatar = d && global.Personalizar ? `<span class="avatar grande${d.config.aparencia.avatarImg ? " com-img" : ""}" style="--av:${global.Personalizar.corHex(d.config.aparencia.avatarCor || "roxo")}">${global.Personalizar.avatarConteudo(d)}</span>` : `<span class="trava-cadeado">🔒</span>`;
    const s = ler();
    const t = teclado(el, {
      topo: `<div class="trava-topo">${avatar}</div>`,
      titulo: nome ? `Olá, ${nome}` : "Meu Controle",
      sub: "Digite o seu PIN",
      esquerda: s.bio ? `<button type="button" class="pin-bio" data-bio aria-label="Desbloquear com Face ID ou digital">${ICONE_BIO}</button>` : "",
      extra: `<button type="button" class="pin-link" data-esqueci>Esqueci o PIN</button>`,
      bloqueado: () => msgEspera(),
      aoCompletar: (pin) => conferir(pin).then((ok) => {
        const s2 = ler();
        if (ok) { s2.erros = 0; s2.esperaAte = 0; gravar(s2); destravar(); return true; }
        s2.erros = (s2.erros || 0) + 1;
        // a partir da 5ª tentativa errada: espera cada vez maior
        if (s2.erros >= 5) s2.esperaAte = Date.now() + Math.min(15 * 60, 30 * Math.pow(2, s2.erros - 5)) * 1000;
        gravar(s2);
        return s2.erros >= 5 ? msgEspera() : `PIN incorreto. ${5 - s2.erros > 1 ? 5 - s2.erros + " tentativas" : "1 tentativa"} antes de uma pausa.`;
      })
    });
    el.querySelector("[data-esqueci]").addEventListener("click", () => esqueci(el));
    const bio = el.querySelector("[data-bio]");
    if (bio) {
      const usar = () => bioConferir().then((ok) => { if (ok) destravar(); }).catch(() => t.erro("Não deu certo. Use o PIN."));
      bio.addEventListener("click", usar);
      // pede o rosto/digital sozinho quando o app está na frente
      if (document.visibilityState === "visible" && !esperaRestante()) setTimeout(() => { if (travada) usar(); }, 350);
    }
    if (esperaRestante()) t.erro(msgEspera());
    requestAnimationFrame(() => el.classList.add("on"));
  }
  function destravar() {
    travada = false;
    const el = document.getElementById("trava");
    html.classList.remove("travado");
    document.body.inert = false;
    if (el) { el.classList.remove("on"); setTimeout(() => { if (!travada) el.innerHTML = ""; }, 250); }
    const s = ler(); s.saiuEm = 0; gravar(s);
  }
  const ICONE_BIO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9.5 15.5c1.4 1 3.6 1 5 0"/></svg>`;

  function esqueci(el) {
    const caixa = document.createElement("div");
    caixa.className = "trava-esqueci";
    caixa.innerHTML = `<div class="trava-esqueci-caixa"><b>Esqueceu o PIN?</b>
      <p>Por segurança, o PIN não pode ser recuperado. Para usar o app de novo, os dados <b>deste aparelho</b> serão apagados — inclusive as cópias de segurança internas. Depois você restaura o seu último <b>arquivo de backup</b> (da pasta escolhida ou do que você salvou/compartilhou).</p>
      <p class="dim">Sem um arquivo de backup, os registros deste aparelho serão perdidos.</p>
      <label><span>Digite <b>APAGAR</b> para confirmar</span><input type="text" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
      <div class="trava-esqueci-botoes"><button type="button" class="btn" data-cancelar>Cancelar</button><button type="button" class="btn perigo" data-apagar-tudo disabled>Apagar e restaurar</button></div></div>`;
    el.appendChild(caixa);
    const inp = caixa.querySelector("input"), bt = caixa.querySelector("[data-apagar-tudo]");
    inp.addEventListener("input", () => { bt.disabled = inp.value.trim().toUpperCase() !== "APAGAR"; });
    caixa.querySelector("[data-cancelar]").addEventListener("click", () => caixa.remove());
    bt.addEventListener("click", () => { bt.disabled = true; bt.textContent = "Apagando…"; apagarTudo().then(() => location.reload()); });
    setTimeout(() => inp.focus(), 50);
  }
  function apagarTudo() {
    try { Object.keys(localStorage).filter((k) => k.indexOf("meuControle") === 0).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignora */ }
    const semBanco = new Promise((ok) => {
      if (!global.indexedDB) { ok(); return; }
      const r = indexedDB.deleteDatabase("meu-controle-backup");
      r.onsuccess = r.onerror = r.onblocked = () => ok();
      setTimeout(ok, 2500);
    });
    const semCache = global.caches ? caches.delete("meu-controle-avatar").catch(() => {}) : Promise.resolve();
    return Promise.all([semBanco, semCache]);
  }

  // ---------------------------------------------------------------------
  // quando travar: ao abrir e ao voltar depois do tempo escolhido
  // ---------------------------------------------------------------------
  function aoSair() { if (!ativo() || travada) return; const s = ler(); s.saiuEm = Date.now(); gravar(s); if (s.apos === 0) travar(); }
  function aoVoltar() {
    if (!ativo() || travada) return;
    const s = ler();
    if (s.saiuEm && Date.now() - s.saiuEm >= (s.apos || 0) * 60000) travar();
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") aoSair(); else aoVoltar(); });
  global.addEventListener("pagehide", aoSair);
  global.addEventListener("pageshow", (e) => { if (e.persisted) aoVoltar(); });
  // o app sempre abre travado (o <html> já veio com a classe do script do <head>)
  // (desenha a tela depois que os dados carregam, para mostrar o avatar e o nome)
  if (ativo()) document.addEventListener("DOMContentLoaded", () => setTimeout(() => { if (ativo()) travar(); }, 0));
  else html.classList.remove("travado");
  // segurança extra: nenhum atalho de teclado chega ao app por trás da tela
  document.addEventListener("keydown", (e) => { if (travada && !e.target.closest("#trava")) { e.stopPropagation(); e.preventDefault(); } }, true);

  // ---------------------------------------------------------------------
  // Ajustes → Segurança
  // ---------------------------------------------------------------------
  const TEMPOS = [[0, "Ao sair do app"], [1, "Depois de 1 min"], [5, "Depois de 5 min"], [15, "Depois de 15 min"]];
  function cartaoAjustes() {
    const s = ler(), on = !!s.hash;
    return UI.card({ titulo: "Segurança", sub: "bloqueio do app neste aparelho", id: "sec-seguranca", corpo: `<div class="pad">
      ${on ? `<div class="seg-status ok"><span>🔒</span><div><b>Bloqueio com PIN ligado</b><small>O app pede o PIN ao abrir${s.apos === 0 ? " e sempre que você sair dele" : ` e quando você volta depois de ${s.apos} min fora`}.</small></div></div>
        <span class="ap-rot">Pedir o PIN de novo</span>
        <div class="seg-opcoes">${TEMPOS.map((t) => `<button class="${s.apos === t[0] ? "ativo" : ""}" data-acao="trava-tempo" data-k="${t[0]}">${t[1]}</button>`).join("")}</div>
        <div id="travaBio"></div>
        <div class="botoes-linha"><button class="btn pequeno primario" data-acao="trava-agora">🔒 Bloquear agora</button><button class="btn pequeno" data-acao="trava-trocar">Trocar PIN</button><button class="btn pequeno perigo" data-acao="trava-desligar">Desligar bloqueio</button></div>`
      : `<div class="seg-status"><span>🔓</span><div><b>Sem bloqueio</b><small>Quem pegar este aparelho desbloqueado consegue abrir o app e ver seus registros.</small></div></div>
        <button class="btn primario" data-acao="trava-ligar">Criar um PIN de 6 dígitos</button>`}
      <p class="ajuda">O PIN fica só neste aparelho (não vai no backup). Se esquecer, os dados deste aparelho são apagados e você restaura o último backup — por isso mantenha o backup em dia. Para proteger tudo, use também a senha ou biometria do próprio celular.</p>
    </div>` });
  }
  function desenharBio() {
    const alvo = document.getElementById("travaBio");
    if (!alvo || !ativo()) return;
    bioDisponivel().then((ok) => {
      if (!ok || !document.getElementById("travaBio")) return;
      const s = ler();
      alvo.innerHTML = global.Personalizar.interruptor("trava_bio", "Desbloquear com Face ID ou digital", !!s.bio, "O PIN continua valendo como alternativa.", 'data-mudar="trava-bio"');
    });
  }
  App().aoRenderizar((d, rota) => { if (rota && rota.secao === "configuracoes") desenharBio(); });

  // fluxo em etapas dentro de um modal: [{titulo, sub, conferir(pin) → true|string}]
  function fluxo(etapas, fim) {
    let i = 0;
    const m = UI.abrirModal(`<div class="pin-modal"></div>`, { semFoco: true });
    m.classList.add("modal-pin");
    const caixa = m.querySelector(".pin-modal");
    const proxima = () => {
      const e = etapas[i];
      teclado(caixa, { titulo: e.titulo, sub: e.sub, aoCompletar: (pin) => Promise.resolve(e.conferir(pin)).then((r) => {
        if (r !== true) return r;
        i++;
        if (i < etapas.length) setTimeout(proxima, 120); else { UI.fecharModal(); fim(); }
        return true;
      }) });
    };
    proxima();
  }
  function novoPin(depois) {
    let primeiro = "";
    return [
      { titulo: "Crie um PIN", sub: "6 números que você vai lembrar — evite datas de nascimento e 123456.", conferir: (p) => {
        if (/^(\d)\1+$/.test(p) || "0123456789".indexOf(p) !== -1 || "9876543210".indexOf(p) !== -1) return "Fácil demais de adivinhar. Escolha outro.";
        primeiro = p; return true; } },
      { titulo: "Repita o PIN", sub: "Para ter certeza de que digitou certo.", conferir: (p) => p !== primeiro ? "Os PINs não são iguais. Comece de novo." : definirPin(p).then(() => { if (depois) depois(); return true; }) }
    ];
  }
  function pinAtual(sub) {
    return { titulo: "Digite o PIN atual", sub: sub || "", conferir: (p) => conferir(p).then((ok) => ok || "PIN incorreto.") };
  }
  function avisoBackup() {
    return App().dados().config.ultimoBackup ? "" : " Dica: faça um backup agora — é ele que salva seus dados se você esquecer o PIN.";
  }

  App().registrarAcoes({
    "trava-ligar": () => fluxo(novoPin(), () => {
      App().renderizar();
      UI.toast("Bloqueio ligado. O app vai pedir o PIN ao abrir." + avisoBackup());
    }),
    "trava-trocar": () => {
      const etapas = [pinAtual()].concat(novoPin());
      // a troca regrava o sal e o hash; a biometria continua
      fluxo(etapas, () => { App().renderizar(); UI.toast("PIN trocado."); });
    },
    "trava-desligar": () => fluxo([pinAtual("Para desligar o bloqueio.")], () => {
      gravar({}); App().renderizar(); UI.toast("Bloqueio desligado.");
    }),
    "trava-agora": () => travar(),
    "trava-tempo": (el) => { const s = ler(); s.apos = Number(el.dataset.k); gravar(s); App().renderizar(); UI.toast("Pronto."); }
  });
  App().registrarMudancas({
    "trava-bio": (el) => {
      if (!el.checked) { const s = ler(); delete s.bio; gravar(s); UI.toast("Face ID/digital desligado."); return; }
      bioAtivar().then(() => UI.toast("Pronto! Da próxima vez, é só olhar ou encostar o dedo."))
        .catch(() => { el.checked = false; UI.toast("Não consegui ativar. Verifique se o aparelho tem Face ID ou digital cadastrados."); });
    }
  });

  global.Trava = { ativo, travar, destravar, travada: () => travada, cartaoAjustes, conferir, definirPin };
})(window);
