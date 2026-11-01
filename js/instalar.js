/* =========================================================================
   Instalar o app (PWA) — botão "Instalar app" no computador e no Android,
   passo a passo no iPhone/iPad e atalhos do ícone (?acao=...).
   Não guarda nada: só lê o estado do navegador.
   ========================================================================= */
(function () {
  "use strict";

  let pedido = null; // evento beforeinstallprompt guardado para usar no clique

  // ---------------------------------------------------------------------
  // como o app está aberto agora
  // ---------------------------------------------------------------------
  const instalado = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    window.navigator.standalone === true;

  const ehIOS = () =>
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPad com iPadOS se apresenta como Mac
  const ehIOSForaDoSafari = () => ehIOS() && /CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent) && !supTelaInicioOutros();
  // a partir do iOS 16.4 Chrome/Edge no iPhone também têm "Adicionar à Tela de Início"
  function supTelaInicioOutros() {
    const m = navigator.userAgent.match(/OS (\d+)_(\d+)/);
    return m ? (+m[1] > 16 || (+m[1] === 16 && +m[2] >= 4)) : false;
  }
  const ehAndroid = () => /Android/i.test(navigator.userAgent);
  const ehMacSafari = () => !ehIOS() && /Macintosh/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg|Firefox/.test(navigator.userAgent);
  const ehFirefoxPC = () => !ehAndroid() && /Firefox/.test(navigator.userAgent);
  const publicado = () => location.protocol.indexOf("http") === 0;

  // "pronto" = o navegador já ofereceu a instalação com um clique
  function situacao() {
    if (instalado()) return "instalado";
    if (!publicado()) return "arquivo";
    if (pedido) return "pronto";
    if (ehIOS()) return ehIOSForaDoSafari() ? "ios-safari" : "ios";
    if (ehMacSafari()) return "mac-safari";
    if (ehFirefoxPC()) return "firefox";
    return "manual";
  }
  // o botão só aparece quando existe um caminho de instalação de verdade
  const mostrarBotao = () => ["pronto", "ios", "ios-safari", "mac-safari"].indexOf(situacao()) !== -1;

  // ---------------------------------------------------------------------
  // botões fixos (barra lateral e menu "Mais")
  // ---------------------------------------------------------------------
  function atualizarBotoes() {
    const ver = mostrarBotao();
    document.querySelectorAll("[data-instalar]").forEach((b) => { b.hidden = !ver; });
    document.body.classList.toggle("app-instalado", instalado());
  }

  // ---------------------------------------------------------------------
  // passo a passo (quando o navegador não instala com um clique)
  // ---------------------------------------------------------------------
  const ICO_COMPARTILHAR = `<svg class="ico-passo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>`;
  const ICO_MAIS = `<svg class="ico-passo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>`;

  function passos(lista) {
    return `<ol class="passos-instalar">${lista.map((p, i) => `<li><span class="num-passo">${i + 1}</span><div>${p}</div></li>`).join("")}</ol>`;
  }

  // o iPhone guarda os dados do app instalado separado dos do Safari
  const AVISO_IOS = `<div class="aviso-instalar"><b>Já usa o app pelo Safari?</b> No iPhone e no iPad, o app instalado começa vazio — ele não enxerga os dados do Safari. Antes de instalar, faça <b>Ajustes → Fazer backup</b> aqui e depois <b>Restaurar backup</b> dentro do app.</div>`;

  function guiaHTML(sit) {
    switch (sit) {
      case "ios":
        return `<p class="ajuda" style="margin-top:0">No iPhone e no iPad a instalação é feita pelo menu de compartilhar:</p>` +
          passos([
            `Toque em <b>Compartilhar</b> ${ICO_COMPARTILHAR} — na barra de baixo (iPhone) ou no topo (iPad). Se não aparecer, toque em <b>⋯</b> primeiro.`,
            `Role a lista e toque em <b>Adicionar à Tela de Início</b> ${ICO_MAIS}.`,
            `Deixe <b>Abrir como App</b> ligado e toque em <b>Adicionar</b>. O ícone do Meu Controle aparece na tela de início.`
          ]) + AVISO_IOS;
      case "ios-safari":
        return `<p class="ajuda" style="margin-top:0">Nesta versão do iOS, só o <b>Safari</b> consegue instalar apps da web.</p>` +
          passos([
            `Copie o endereço desta página e abra no <b>Safari</b>.`,
            `Toque em <b>Compartilhar</b> ${ICO_COMPARTILHAR} e depois em <b>Adicionar à Tela de Início</b>.`
          ]) + AVISO_IOS;
      case "mac-safari":
        return passos([
          `Na barra de menus, clique em <b>Arquivo → Adicionar ao Dock…</b> (ou no botão <b>Compartilhar</b> ${ICO_COMPARTILHAR} → <b>Adicionar ao Dock</b>).`,
          `Clique em <b>Adicionar</b>. O Meu Controle passa a abrir numa janela própria, pelo Dock ou pelo Launchpad.`
        ]);
      case "firefox":
        return `<p class="ajuda" style="margin-top:0">O Firefox no computador não instala apps da web. Abra este mesmo endereço no <b>Chrome</b> ou no <b>Edge</b> e clique em <b>Instalar app</b>.</p>
          <p class="ajuda">Os dados ficam em cada navegador: use <b>Ajustes → Fazer backup</b> aqui e <b>Restaurar backup</b> no outro.</p>`;
      case "arquivo":
        return `<p class="ajuda" style="margin-top:0">O app só pode ser instalado quando aberto pelo endereço publicado (GitHub Pages), não pelo arquivo <code>index.html</code> no computador.</p>`;
      case "instalado":
        return `<p class="ajuda" style="margin-top:0">Você já está usando o app instalado. 🎉</p>`;
      default:
        return passos([
          ehAndroid()
            ? `Toque no menu <b>⋮</b> do navegador e depois em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).`
            : `No Chrome ou no Edge, clique no ícone de instalar ${ICO_MAIS} no fim da barra de endereço, ou no menu <b>⋮ → Transmitir, salvar e compartilhar → Instalar página como app</b>.`,
          `Confirme em <b>Instalar</b>. O Meu Controle ganha ícone próprio e abre em tela cheia, mesmo sem internet.`
        ]);
    }
  }

  function abrirGuia() {
    const sit = situacao();
    const titulo = sit === "instalado" ? "App instalado" : ehIOS() ? "Instalar no iPhone/iPad" : ehMacSafari() ? "Instalar no Mac" : "Instalar o app";
    UI.abrirModal(`<h3>${titulo}</h3>${guiaHTML(sit)}
      <div class="modal-acoes"><button class="btn primario" data-acao="fechar-modal">Entendi</button></div>`);
  }

  function instalar() {
    document.body.classList.remove("mais-aberto");
    if (!pedido) { abrirGuia(); return; }
    const p = pedido;
    pedido = null; // o mesmo pedido só pode ser usado uma vez
    p.prompt();
    p.userChoice.then((r) => {
      if (r && r.outcome === "accepted") UI.toast("Instalando o Meu Controle…");
      atualizarBotoes();
      if (App.rota().secao === "configuracoes") App.renderizar();
    }).catch(() => {});
  }

  // ---------------------------------------------------------------------
  // cartão em Ajustes
  // ---------------------------------------------------------------------
  function cartaoAjustes() {
    const sit = situacao();
    const selo = sit === "instalado" ? `<span class="selo-tag selo-entrada">Instalado</span>` : sit === "pronto" ? `<span class="selo-tag selo-pago">Disponível</span>` : "";
    let corpo;
    if (sit === "instalado") {
      corpo = `<p>Você está usando o <b>app instalado</b>: ícone próprio, tela cheia e funciona sem internet. As atualizações chegam sozinhas — ao abrir com internet, ou puxando a tela para baixo no iPhone/iPad.</p>`;
    } else if (sit === "pronto") {
      corpo = `<p>Instale o Meu Controle para ter ícone próprio, tela cheia e abrir sem internet, como um app comum. Ele se atualiza sozinho.</p>
        <p><button class="btn primario btn-cta-instalar" data-acao="instalar-app">${UI.svg("download")}Instalar app</button></p>`;
    } else {
      corpo = guiaHTML(sit);
    }
    return UI.card({ titulo: "Instalar o app", sub: "no computador, celular e tablet", id: "sec-instalar", acoes: selo, corpo: `<div class="pad texto-integ">${corpo}
      <p class="dim">Cada aparelho guarda os próprios dados. Para levar seus registros de um para outro, use o backup acima.</p></div>` });
  }

  // ---------------------------------------------------------------------
  // atalhos do ícone: index.html?acao=rapido-peso etc.
  // ---------------------------------------------------------------------
  const ATALHOS = ["rapido-peso", "rapido-refeicao", "rapido-agua", "rapido-treino", "rapido-compra"];
  function abrirAtalho() {
    const prm = new URLSearchParams(location.search);
    const acao = prm.get("acao");
    if (!acao) return;
    prm.delete("acao");
    const resto = prm.toString();
    history.replaceState(null, "", location.pathname + (resto ? "?" + resto : "") + location.hash);
    if (ATALHOS.indexOf(acao) === -1) return;
    // dispara a mesma ação do botão + (pela delegação de cliques do app)
    const b = document.createElement("button");
    b.dataset.acao = acao;
    b.hidden = true;
    document.body.appendChild(b);
    b.click();
    b.remove();
  }

  // ---------------------------------------------------------------------
  // eventos do navegador
  // ---------------------------------------------------------------------
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // em vez da faixa do navegador, mostra o nosso botão
    pedido = e;
    atualizarBotoes();
    if (window.App && App.rota && App.rota().secao === "configuracoes") App.renderizar();
  });
  window.addEventListener("appinstalled", () => {
    pedido = null;
    atualizarBotoes();
    if (window.UI) UI.toast("Meu Controle instalado! Procure o ícone na tela de início ou no menu de apps.");
  });
  const mq = window.matchMedia("(display-mode: standalone)");
  if (mq.addEventListener) mq.addEventListener("change", atualizarBotoes);

  App.registrarAcoes({
    "instalar-app": instalar,
    "guia-instalar": abrirGuia
  });

  document.addEventListener("DOMContentLoaded", () => {
    atualizarBotoes();
    // depois do App.iniciar (registrado antes, roda antes)
    setTimeout(abrirAtalho, 0);
  });

  window.Instalar = { situacao, instalado, cartaoAjustes, abrirGuia };
})();
