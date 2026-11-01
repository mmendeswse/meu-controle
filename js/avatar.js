/**
 * avatar.js
 * -----------------------------------------------------------------------
 * Tela "Editar avatar", no estilo dos apps de streaming: a imagem atual
 * grande no topo e, abaixo, galerias para escolher:
 *
 *   Sua foto        — da galeria ou da câmera
 *   Personagens     — os mais populares do MyAnimeList (API Jikan) e busca
 *                     por nome ("Naruto", "Levi", "Frieren"…)
 *   Ilustrações     — arte de anime da API nekos.best (só conteúdo seguro)
 *   Emojis          — com a cor de fundo escolhida
 *
 * A imagem escolhida é reduzida para 256 px e guardada no próprio
 * aparelho (config.aparencia.avatarImg.src), então aparece sem internet e
 * vai junto no backup. Se o servidor da imagem não permitir a cópia, fica
 * guardado o endereço, e o service worker mantém a imagem em cache.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const UI = global.UI;
  const esc = UI.esc;
  const JIKAN = "https://api.jikan.moe/v4";
  const NEKOS = "https://nekos.best/api/v2";
  const CATEGORIAS = [
    { k: "husbando", r: "Husbandos" }, { k: "waifu", r: "Waifus" },
    { k: "neko", r: "Nekos" }, { k: "kitsune", r: "Kitsunes" }
  ];
  const cacheApi = {}; // respostas da sessão (evita repetir pedidos)
  const est = { aberto: false, escolha: null, original: null, aoConcluir: null, nome: "", cor: "roxo", top: [], topPagina: 0, topFim: false, busca: "", resultados: null, buscando: false, ilustr: {}, erro: {} };

  // ---------------------------------------------------------------------
  // APIs
  // ---------------------------------------------------------------------
  let filaJikan = Promise.resolve();
  // a Jikan aceita até 3 pedidos por segundo: os pedidos esperam a vez
  function jikan(caminho) {
    if (cacheApi[caminho]) return Promise.resolve(cacheApi[caminho]);
    const p = filaJikan.then(() => fetch(JIKAN + caminho).then((r) => {
      if (r.status === 429) throw new Error("muitos pedidos — tente de novo em alguns segundos");
      if (!r.ok) throw new Error("erro " + r.status);
      return r.json();
    }));
    filaJikan = p.catch(() => {}).then(() => new Promise((ok) => setTimeout(ok, 400)));
    return p.then((j) => { cacheApi[caminho] = j; return j; });
  }
  function personagem(c) {
    const img = (c.images && ((c.images.webp && c.images.webp.image_url) || (c.images.jpg && c.images.jpg.image_url))) || "";
    if (!img || /questionmark|apple-touch-icon/i.test(img)) return null; // sem foto no MyAnimeList
    return { fonte: "jikan", url: img, nome: c.name, credito: c.name, link: c.url || "", foco: "50% 18%" };
  }
  function carregarTop() {
    if (est.topFim || est.carregandoTop) return;
    est.carregandoTop = true;
    const pg = est.topPagina + 1;
    jikan(`/top/characters?page=${pg}&limit=25`).then((j) => {
      const novos = (j.data || []).map(personagem).filter(Boolean);
      est.top = est.top.concat(novos.filter((n) => !est.top.some((x) => x.url === n.url)));
      est.topPagina = pg;
      est.topFim = !(j.pagination && j.pagination.has_next_page);
      est.erro.top = null;
    }).catch((e) => { est.erro.top = msgErro(e); }).finally(() => { est.carregandoTop = false; desenhar(); });
  }
  let timerBusca = null;
  function buscar(q) {
    est.busca = q;
    clearTimeout(timerBusca);
    if (q.trim().length < 2) { est.resultados = null; desenhar(true); return; }
    timerBusca = setTimeout(() => {
      est.buscando = true; desenhar(true);
      jikan(`/characters?q=${encodeURIComponent(q.trim())}&order_by=favorites&sort=desc&limit=24`).then((j) => {
        if (est.busca !== q) return;
        est.resultados = (j.data || []).map(personagem).filter(Boolean);
        est.erro.busca = null;
      }).catch((e) => { est.erro.busca = msgErro(e); }).finally(() => { est.buscando = false; desenhar(true); });
    }, 450);
  }
  function carregarIlustr(cat) {
    const s = est.ilustr[cat] = est.ilustr[cat] || { lista: [], carregando: false };
    if (s.carregando) return;
    s.carregando = true;
    fetch(`${NEKOS}/${cat}?amount=12`).then((r) => { if (!r.ok) throw new Error("erro " + r.status); return r.json(); }).then((j) => {
      const novos = (j.results || []).filter((x) => x.url).map((x) => ({ fonte: "nekos", url: x.url, nome: x.anime_name || "", credito: x.artist_name ? "Arte: " + x.artist_name : "", link: x.source_url || x.artist_href || "", foco: "50% 25%" }));
      s.lista = s.lista.concat(novos.filter((n) => !s.lista.some((x) => x.url === n.url)));
      est.erro[cat] = null;
    }).catch((e) => { est.erro[cat] = msgErro(e); }).finally(() => { s.carregando = false; desenhar(); });
  }
  function msgErro(e) {
    if (!navigator.onLine) return "Sem internet agora. As imagens aparecem quando o aparelho estiver conectado.";
    if (!e || e.name === "TypeError") return "Não consegui falar com o servidor de imagens. Verifique a internet e tente de novo.";
    return "Não consegui carregar as imagens (" + e.message + ").";
  }

  // ---------------------------------------------------------------------
  // imagem → miniatura guardada no aparelho
  // ---------------------------------------------------------------------
  function carregarBitmap(blob) {
    if (global.createImageBitmap) return createImageBitmap(blob);
    return new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = URL.createObjectURL(blob); });
  }
  // recorte quadrado (o foco diz onde fica o rosto) em 256 px, JPEG
  function miniatura(blob, foco) {
    return carregarBitmap(blob).then((img) => {
      const T = 256, w = img.width, h = img.height, lado = Math.min(w, h);
      const fy = foco && /\s(\d+)%/.test(foco) ? Number(foco.match(/\s(\d+)%/)[1]) / 100 : 0.5;
      const sx = (w - lado) / 2, sy = Math.max(0, Math.min(h - lado, h * fy - lado / 2));
      const c = document.createElement("canvas"); c.width = T; c.height = T;
      const g = c.getContext("2d");
      g.fillStyle = "#1c1c1e"; g.fillRect(0, 0, T, T);
      g.drawImage(img, sx, sy, lado, lado, 0, 0, T, T);
      return c.toDataURL("image/jpeg", 0.86);
    });
  }
  function guardarLocal(item) {
    if (item.src && item.src.indexOf("data:") === 0) return Promise.resolve(item);
    return fetch(item.url, { mode: "cors" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then((b) => miniatura(b, item.foco)).then((src) => Object.assign({}, item, { src }))
      .catch(() => Object.assign({}, item, { src: item.url })); // sem permissão de cópia: usa o endereço (o service worker guarda em cache)
  }
  function lerFoto(arquivo) {
    if (!arquivo || !/^image\//.test(arquivo.type)) { UI.toast("Escolha um arquivo de imagem."); return; }
    miniatura(arquivo, "50% 40%").then((src) => {
      est.escolha = { fonte: "foto", url: "", src, nome: "Sua foto", credito: "", link: "" };
      desenhar();
    }).catch(() => UI.toast("Não consegui abrir essa imagem."));
  }

  // ---------------------------------------------------------------------
  // desenho
  // ---------------------------------------------------------------------
  function corHex(k) { return global.Personalizar.corHex(k); }
  function circulo(item, opc) {
    const sel = est.escolha && est.escolha.fonte === item.fonte && (est.escolha.url || est.escolha.src) === (item.url || item.src);
    return `<button class="av-op${sel ? " ativo" : ""}" data-acao="av-escolher" data-i="${opc.i}" data-grupo="${opc.g}" title="${esc(item.nome || item.credito || "")}" aria-label="${esc(item.nome || "Imagem")}">
      <img src="${esc(item.src || item.url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" style="object-position:${item.foco || "50% 30%"}" onerror="this.closest('.av-op').classList.add('quebrada')">
      ${opc.legenda && item.nome ? `<span class="av-nome">${esc(item.nome)}</span>` : ""}</button>`;
  }
  function grade(lista, g, legenda) { return `<div class="av-grade">${lista.map((x, i) => circulo(x, { i, g, legenda })).join("")}</div>`; }
  function carregando(n) { return `<div class="av-grade">${Array.from({ length: n || 6 }, () => `<span class="av-op esqueleto"></span>`).join("")}</div>`; }
  function aviso(txt, acao, rotulo, dados) { return `<p class="av-aviso">${esc(txt)}${acao ? ` <button class="link-acao" data-acao="${acao}" ${dados || ""}>${rotulo}</button>` : ""}</p>`; }

  function itemAtual() { return est.escolha; }
  function topoHTML() {
    const it = itemAtual();
    const bg = it && (it.src || it.url) ? `style="--av-bg:url('${(it.src || it.url).replace(/'/g, "%27")}')"` : `style="--av-bg:none;--av-cor:${corHex(est.cor)}"`;
    const conteudo = it && (it.src || it.url) ? `<img src="${esc(it.src || it.url)}" alt="" referrerpolicy="no-referrer" style="object-position:${it.foco || "50% 30%"}">`
      : `<span class="av-emoji">${esc((it && it.emoji) || (est.nome || "Eu").charAt(0).toUpperCase())}</span>`;
    return `<div class="av-topo" ${bg}><div class="av-topo-fundo"></div>
      <span class="avatar gigante" style="--av:${corHex(est.cor)}">${conteudo}</span>
      <b class="av-nome-pessoa">${esc(est.nome || "Você")}</b>
      ${it && (it.credito || it.nome) && it.fonte !== "foto" && it.fonte !== "emoji" ? `<small class="av-credito">${esc(it.fonte === "jikan" ? it.nome + " · MyAnimeList" : it.credito || it.nome)}${it.link ? ` · <a href="${esc(it.link)}" target="_blank" rel="noopener">fonte</a>` : ""}</small>` : ""}
    </div>`;
  }
  function corpoHTML() {
    const P = global.Personalizar;
    const online = navigator.onLine;
    const listaTop = est.top;
    let html = "";
    html += `<section class="av-secao"><h3>Sua foto</h3>
      <div class="av-grade">
        <label class="av-op av-enviar"><input type="file" accept="image/*" id="avArquivo" hidden><span>📷</span><small>Escolher foto</small></label>
        ${est.escolha && est.escolha.fonte === "foto" ? circulo(est.escolha, { i: 0, g: "foto" }) : est.original && est.original.fonte === "foto" ? circulo(est.original, { i: 0, g: "foto-orig" }) : ""}
      </div></section>`;
    html += `<section class="av-secao"><h3>Buscar personagem</h3>
      <div class="av-busca">${UI.svg("buscar")}<input id="avBusca" type="search" value="${esc(est.busca)}" placeholder="Nome do personagem — ex.: Luffy, Frieren, Tanjiro" autocomplete="off" enterkeyhint="search"></div>
      <div id="avResultados">${resultadosHTML()}</div></section>`;
    html += `<section class="av-secao"><h3>Personagens mais populares</h3>
      ${listaTop.length ? grade(listaTop, "top", true) : est.erro.top ? "" : carregando(9)}
      ${est.erro.top ? aviso(est.erro.top, "av-tentar", "Tentar de novo", 'data-k="top"') : !est.topFim && listaTop.length ? `<button class="btn av-mais" data-acao="av-mais-top"${est.carregandoTop ? " disabled" : ""}>${est.carregandoTop ? "Carregando…" : "Ver mais personagens"}</button>` : ""}
    </section>`;
    CATEGORIAS.forEach((c) => {
      const s = est.ilustr[c.k] || { lista: [] };
      html += `<section class="av-secao"><h3>${c.r} <small>ilustrações</small></h3>
        ${s.lista.length ? grade(s.lista, c.k) : est.erro[c.k] ? "" : carregando(6)}
        ${est.erro[c.k] ? aviso(est.erro[c.k], "av-tentar", "Tentar de novo", `data-k="${c.k}"`) : s.lista.length ? `<button class="btn av-mais" data-acao="av-mais-ilustr" data-k="${c.k}"${s.carregando ? " disabled" : ""}>${s.carregando ? "Carregando…" : "Mais " + c.r.toLowerCase()}</button>` : ""}
      </section>`;
    });
    html += `<section class="av-secao"><h3>Emojis</h3>
      <div class="av-grade emojis"><button class="av-op av-emoji-op${est.escolha && est.escolha.fonte === "inicial" ? " ativo" : ""}" data-acao="av-inicial" style="--av:${corHex(est.cor)}"><span>${esc((est.nome || "Eu").charAt(0).toUpperCase())}</span></button>
        ${P.AVATARES.map((e) => `<button class="av-op av-emoji-op${est.escolha && est.escolha.emoji === e ? " ativo" : ""}" data-acao="av-emoji" data-k="${e}" style="--av:${corHex(est.cor)}"><span>${e}</span></button>`).join("")}</div>
      <h3 class="av-sub">Cor de fundo</h3>
      <div class="ap-cores">${P.CORES.map((c) => `<button class="ap-cor${est.cor === c.k ? " ativo" : ""}" data-acao="av-cor" data-k="${c.k}" style="--c:${c.c}" aria-label="${c.r}"></button>`).join("")}</div>
    </section>
    <p class="av-rodape">${online ? "" : "📴 Sem internet: as galerias de anime aparecem quando o aparelho estiver conectado. "}Personagens: <a href="https://myanimelist.net" target="_blank" rel="noopener">MyAnimeList</a> via Jikan · Ilustrações: <a href="https://nekos.best" target="_blank" rel="noopener">nekos.best</a>, com crédito ao artista. A imagem escolhida fica guardada só neste aparelho.</p>`;
    return html;
  }
  function resultadosHTML() {
    if (est.buscando) return carregando(6);
    if (est.erro.busca) return aviso(est.erro.busca);
    if (!est.resultados) return "";
    if (!est.resultados.length) return aviso(`Nenhum personagem com foto encontrado para “${est.busca}”.`);
    return grade(est.resultados, "busca", true);
  }
  function mudou() {
    const a = est.escolha, o = est.original;
    return JSON.stringify([a && (a.src || a.url || a.emoji || a.fonte), est.cor]) !== JSON.stringify([o && (o.src || o.url || o.emoji || o.fonte), est.corOriginal]);
  }
  function desenhar(soResultados) {
    const el = document.getElementById("avTela");
    if (!el || !est.aberto) return;
    if (soResultados) { const r = el.querySelector("#avResultados"); if (r) { r.innerHTML = resultadosHTML(); return; } }
    const rolagem = el.querySelector(".av-corpo") ? el.querySelector(".av-corpo").scrollTop : 0;
    const foco = document.activeElement && document.activeElement.id === "avBusca";
    el.querySelector(".av-cabeca-topo").innerHTML = topoHTML();
    el.querySelector(".av-corpo-conteudo").innerHTML = corpoHTML();
    el.querySelector("[data-acao='av-pronto']").disabled = !mudou();
    el.querySelector(".av-corpo").scrollTop = rolagem;
    ligarCampos(el);
    if (foco) { const b = el.querySelector("#avBusca"); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
  }
  function ligarCampos(el) {
    const arq = el.querySelector("#avArquivo");
    if (arq) arq.addEventListener("change", (e) => { lerFoto(e.target.files[0]); e.target.value = ""; });
    const b = el.querySelector("#avBusca");
    if (b) b.addEventListener("input", (e) => buscar(e.target.value));
  }

  // ---------------------------------------------------------------------
  // abrir / fechar
  // ---------------------------------------------------------------------
  // opc: { nome, cor, atual (avatarImg | {emoji} | null), aoConcluir(resultado) }
  function abrir(opc) {
    opc = opc || {};
    const d = global.App.dados(), ap = d.config.aparencia || {};
    est.nome = opc.nome != null ? opc.nome : (d.usuarios[0].nome !== "Eu" ? d.usuarios[0].nome : "");
    est.cor = est.corOriginal = opc.cor || ap.avatarCor || "roxo";
    const atual = opc.atual !== undefined ? opc.atual : ap.avatarImg ? Object.assign({}, ap.avatarImg) : ap.avatar ? { fonte: "emoji", emoji: ap.avatar } : { fonte: "inicial" };
    est.escolha = atual; est.original = atual;
    est.aoConcluir = opc.aoConcluir || salvarNoPerfil;
    est.aberto = true;
    let el = document.getElementById("avTela");
    if (!el) {
      el = document.createElement("div");
      el.id = "avTela"; el.className = "av-tela"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Editar avatar");
      el.innerHTML = `<header class="av-barra"><button class="btn fantasma" data-acao="av-fechar" aria-label="Voltar">${UI.svg("voltar")}</button><b>Editar avatar</b><button class="btn av-pronto" data-acao="av-pronto" disabled>Pronto</button></header>
        <div class="av-corpo"><div class="av-cabeca-topo"></div><div class="av-corpo-conteudo"></div></div>`;
      document.body.appendChild(el);
    }
    document.body.classList.add("av-aberta");
    requestAnimationFrame(() => el.classList.add("on"));
    UI.aposVoltar(() => { if (est.aberto) { try { history.pushState({ avatar: true }, "", location.href); } catch (e) { /* sem histórico */ } } });
    desenhar();
    el.querySelector(".av-corpo").scrollTop = 0;
    if (!est.top.length) carregarTop();
    CATEGORIAS.forEach((c) => { if (!est.ilustr[c.k] || !est.ilustr[c.k].lista.length) carregarIlustr(c.k); });
  }
  function fechar(peloVoltar) {
    const el = document.getElementById("avTela");
    if (!el || !est.aberto) return;
    est.aberto = false;
    el.classList.remove("on");
    document.body.classList.remove("av-aberta");
    if (!peloVoltar && history.state && history.state.avatar) { voltaPropria = true; try { history.back(); } catch (e) { voltaPropria = false; } }
  }
  let voltaPropria = false; // o "voltar" que a própria tela fez ao fechar (não deve fechar mais nada)
  // o "voltar" do celular fecha esta tela (antes de qualquer outro ouvinte)
  UI.aoVoltar(() => {
    if (voltaPropria) { voltaPropria = false; return true; }
    if (est.aberto) { fechar(true); return true; }
    return false;
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && est.aberto) { e.stopPropagation(); fechar(); } }, true);

  function concluir() {
    const it = est.escolha;
    const btn = document.querySelector("#avTela [data-acao='av-pronto']");
    const terminar = (resultado) => { const fn = est.aoConcluir; fechar(); if (fn) fn(resultado); };
    if (it && (it.fonte === "jikan" || it.fonte === "nekos")) {
      if (btn) { btn.disabled = true; btn.textContent = "Salvando…"; }
      guardarLocal(it).then((x) => { if (btn) btn.textContent = "Pronto"; terminar({ img: limpar(x), emoji: "", cor: est.cor }); });
      return;
    }
    if (it && it.fonte === "foto") { terminar({ img: limpar(it), emoji: "", cor: est.cor }); return; }
    terminar({ img: null, emoji: it && it.emoji ? it.emoji : "", cor: est.cor });
  }
  function limpar(x) { return { fonte: x.fonte, src: x.src || x.url, url: x.url || "", nome: x.nome || "", credito: x.credito || "", link: x.link || "", foco: x.foco || "" }; }
  function salvarNoPerfil(r) {
    const d = global.App.dados(), ap = d.config.aparencia;
    ap.avatarImg = r.img; ap.avatar = r.img ? "" : r.emoji; ap.avatarCor = r.cor;
    global.App.salvar(r.img ? "Avatar atualizado." : "Avatar atualizado.", { semIntegracao: true });
  }
  function lista(g) {
    if (g === "top") return est.top;
    if (g === "busca") return est.resultados || [];
    if (g === "foto") return est.escolha ? [est.escolha] : [];
    if (g === "foto-orig") return est.original ? [est.original] : [];
    return (est.ilustr[g] || { lista: [] }).lista;
  }

  global.App.registrarAcoes({
    "av-abrir": () => abrir(),
    "av-fechar": () => fechar(),
    "av-pronto": concluir,
    "av-escolher": (el) => {
      const it = lista(el.dataset.grupo)[Number(el.dataset.i)];
      if (!it || el.classList.contains("quebrada")) return;
      est.escolha = Object.assign({}, it);
      const ap = (global.App.dados().config.aparencia || {});
      if (ap.vibrar !== false && navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* sem suporte */ } }
      desenhar();
      const c = document.querySelector("#avTela .av-corpo"); if (c) c.scrollTo({ top: 0, behavior: "smooth" });
    },
    "av-emoji": (el) => { est.escolha = { fonte: "emoji", emoji: el.dataset.k }; desenhar(); },
    "av-inicial": () => { est.escolha = { fonte: "inicial" }; desenhar(); },
    "av-cor": (el) => { est.cor = el.dataset.k; desenhar(); },
    "av-mais-top": () => carregarTop(),
    "av-mais-ilustr": (el) => carregarIlustr(el.dataset.k),
    "av-tentar": (el) => { const k = el.dataset.k; est.erro[k] = null; if (k === "top") carregarTop(); else carregarIlustr(k); desenhar(); }
  });

  global.Avatar = { abrir, fechar, guardarLocal, miniatura, estado: est };
})(window);
