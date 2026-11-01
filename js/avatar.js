/**
 * avatar.js
 * -----------------------------------------------------------------------
 * Tela "Editar avatar", no estilo dos apps de streaming: a imagem atual
 * grande no topo e, abaixo, galerias para escolher:
 *
 *   Sua foto        — da galeria ou da câmera
 *   Personagens     — os mais populares do MyAnimeList (API Jikan) e busca
 *                     por nome ("Naruto", "Levi", "Frieren"…)
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

  // séries com fileira própria (ids do MyAnimeList), na ordem em que aparecem
  const SERIES = [
    [20, "Naruto"], [21, "One Piece"], [813, "Dragon Ball Z"], [38000, "Demon Slayer"], [40748, "Jujutsu Kaisen"],
    [16498, "Attack on Titan"], [31964, "My Hero Academia"], [52299, "Solo Leveling"], [52991, "Frieren"], [50265, "Spy x Family"],
    [44511, "Chainsaw Man"], [11061, "Hunter x Hunter"], [1535, "Death Note"], [5114, "Fullmetal Alchemist"], [30276, "One Punch Man"],
    [269, "Bleach"], [20583, "Haikyuu!!"], [527, "Pokémon"], [530, "Sailor Moon"], [22319, "Tokyo Ghoul"],
    [32182, "Mob Psycho 100"], [1575, "Code Geass"], [9253, "Steins;Gate"], [1, "Cowboy Bebop"]
  ];

  const est = {
    aberto: false, escolha: null, original: null, aoConcluir: null, nome: "", cor: "roxo",
    linhas: {},   // chave → lista de personagens já carregados ("top", "s:20", "busca", "anime")
    erros: {},    // chave → mensagem
    busca: "", buscando: false, animeBusca: null
  };

  // ---------------------------------------------------------------------
  // cache no aparelho: a galeria abre na hora a partir da 2ª vez
  // ---------------------------------------------------------------------
  const CHAVE_CACHE = "meuControle:avatarCache", VALIDADE = 14 * 864e5, MAX_CACHE = 70;
  let disco = null;
  function lerCache() {
    if (disco) return disco;
    try { disco = JSON.parse(localStorage.getItem(CHAVE_CACHE)) || {}; } catch (e) { disco = {}; }
    return disco;
  }
  function gravarCache(k, lista) {
    const c = lerCache();
    c[k] = { t: Date.now(), l: lista };
    const ks = Object.keys(c);
    if (ks.length > MAX_CACHE) ks.sort((a, b) => c[a].t - c[b].t).slice(0, ks.length - MAX_CACHE).forEach((x) => delete c[x]);
    try { localStorage.setItem(CHAVE_CACHE, JSON.stringify(c)); } catch (e) { /* sem espaço: segue só na memória */ }
  }

  // ---------------------------------------------------------------------
  // fila de pedidos à Jikan (até 3 por segundo), com prioridade para a
  // busca, tempo-limite e nova tentativa quando o servidor está ocupado
  // ---------------------------------------------------------------------
  const fila = [], emAndamento = {};
  let ocupado = false, ultimo = 0;
  function pedir(caminho, tentativa) {
    const ctrl = global.AbortController ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), 12000) : 0;
    return fetch(JIKAN + caminho, ctrl ? { signal: ctrl.signal } : {}).then((r) => {
      clearTimeout(t);
      if (r.status === 429 || r.status >= 500) { const e = new Error(r.status === 429 ? "servidor ocupado" : "erro " + r.status); e.repetir = true; throw e; }
      if (!r.ok) throw new Error("erro " + r.status);
      return r.json();
    }).catch((e) => {
      clearTimeout(t);
      if (e && e.name === "AbortError") { e = new Error("o servidor demorou para responder"); e.repetir = true; }
      else if (e && e.name === "TypeError" && navigator.onLine) e.repetir = true;
      if (e.repetir && tentativa < 2) return new Promise((ok) => setTimeout(ok, 1300 * (tentativa + 1))).then(() => pedir(caminho, tentativa + 1));
      throw e;
    });
  }
  function proximo() {
    if (ocupado || !fila.length) return;
    ocupado = true;
    setTimeout(() => {
      const t = fila.shift();
      ultimo = Date.now();
      pedir(t.caminho, 0).then(t.ok, t.erro).finally(() => { ultimo = Date.now(); ocupado = false; proximo(); });
    }, Math.max(0, ultimo + 360 - Date.now()));
  }
  function jikan(caminho, urgente) {
    if (emAndamento[caminho]) return emAndamento[caminho];
    const p = new Promise((ok, erro) => { const t = { caminho, ok, erro }; if (urgente) fila.unshift(t); else fila.push(t); proximo(); });
    emAndamento[caminho] = p;
    p.then(() => { delete emAndamento[caminho]; }, () => { delete emAndamento[caminho]; });
    return p;
  }
  // devolve do cache (mesmo antigo, atualizando em segundo plano) ou da rede
  function obter(chave, caminho, transformar, urgente) {
    const c = lerCache()[chave];
    if (c && Date.now() - c.t < VALIDADE) return Promise.resolve(c.l);
    const p = jikan(caminho, urgente).then((j) => { const l = transformar(j); if (l.length) gravarCache(chave, l); return l; });
    if (c) { p.catch(() => {}); return Promise.resolve(c.l); }
    return p;
  }

  // personagem enxuto: { u: imagem, n: nome, l: link }
  function enxuto(c) {
    const img = (c.images && ((c.images.webp && c.images.webp.image_url) || (c.images.jpg && c.images.jpg.image_url))) || "";
    if (!img || /questionmark|apple-touch-icon/i.test(img)) return null; // sem foto no MyAnimeList
    return { u: img, n: c.name || "", l: c.url || "" };
  }
  function item(x) { return { fonte: "anime", url: x.u, nome: x.n, credito: x.n, link: x.l, foco: "50% 18%" }; }
  const ehAnime = (it) => !!it && (it.fonte === "anime" || it.fonte === "jikan");
  const site = (it) => /anilist/.test((it && (it.link || it.url)) || "") ? "AniList" : "MyAnimeList";

  // ---------------------------------------------------------------------
  // catálogo pronto (dados/personagens.json): gerado toda semana no GitHub
  // e servido junto com o app — a galeria abre sem esperar API nenhuma
  // ---------------------------------------------------------------------
  let catalogo = null, pCatalogo = null;
  function carregarCatalogo() {
    if (pCatalogo) return pCatalogo;
    pCatalogo = fetch("dados/personagens.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((j) => {
        if (!j || !Array.isArray(j.series) || !j.series.length) throw new Error("vazio");
        catalogo = j;
        if (j.top && j.top.length) est.linhas.top = j.top.map(item);
        j.series.forEach((x) => { est.linhas["s:" + x.id] = x.l.map(item); });
        return true;
      })
      .catch(() => { pCatalogo = null; return false; }); // sem o arquivo: cai para a API
    return pCatalogo;
  }
  function listaSeries() { return catalogo ? catalogo.series.map((x) => [x.id, x.t]) : SERIES; }

  // busca na AniList (rápida), com a Jikan como reserva
  const ANILIST = "https://graphql.anilist.co";
  const Q_BUSCA = `query($q: String) {
    c: Page(perPage: 24) { characters(search: $q, sort: [SEARCH_MATCH, FAVOURITES_DESC]) { name { full } image { large } siteUrl } }
    m: Page(perPage: 1) { media(search: $q, type: ANIME, sort: [SEARCH_MATCH, POPULARITY_DESC]) { title { romaji english } characters(sort: [ROLE, FAVOURITES_DESC], perPage: 20) { nodes { name { full } image { large } siteUrl } } } }
  }`;
  function alEnxuto(c) {
    const u = c && c.image && c.image.large;
    return u && !/default\.(jpg|png)$/i.test(u) ? { u, n: c.name.full, l: c.siteUrl } : null;
  }
  function buscarAniList(termo) {
    const chave = "al:" + termo.toLowerCase();
    const c = lerCache()[chave];
    if (c && Date.now() - c.t < VALIDADE) return Promise.resolve(c.l);
    const ctrl = global.AbortController ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), 8000) : 0;
    return fetch(ANILIST, Object.assign({ method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query: Q_BUSCA, variables: { q: termo } }) }, ctrl ? { signal: ctrl.signal } : {}))
      .then((r) => { clearTimeout(t); if (!r.ok) throw new Error("erro " + r.status); return r.json(); })
      .then((j) => {
        const d = j && j.data;
        if (!d) throw new Error("sem dados");
        const m = d.m && d.m.media && d.m.media[0];
        const r = { pers: (d.c.characters || []).map(alEnxuto).filter(Boolean),
          anime: m ? { titulo: (m.title.english || m.title.romaji), lista: m.characters.nodes.map(alEnxuto).filter(Boolean) } : null };
        gravarCache(chave, r);
        return r;
      })
      .catch((e) => { clearTimeout(t); throw e; });
  }
  const deTop = (j) => (j.data || []).map(enxuto).filter(Boolean);
  const deElenco = (j) => (j.data || []).filter((x) => x.character)
    .sort((a, b) => (a.role === "Main" ? 0 : 1) - (b.role === "Main" ? 0 : 1) || (b.favorites || 0) - (a.favorites || 0))
    .map((x) => enxuto(x.character)).filter(Boolean).slice(0, 20);

  function carregarLinha(chave, urgente) {
    if (est.linhas[chave] || est.erros[chave] === "carregando") return;
    // primeiro o catálogo pronto; a API só entra se ele não estiver disponível
    if (!catalogo) {
      est.erros[chave] = "carregando";
      carregarCatalogo().then(() => { delete est.erros[chave]; if (est.linhas[chave]) desenharLinha(chave); else carregarDaApi(chave, urgente); });
      return;
    }
    carregarDaApi(chave, urgente);
  }
  function carregarDaApi(chave, urgente) {
    if (est.linhas[chave] || est.erros[chave] === "carregando") return;
    let p;
    if (chave === "top") p = obter("top", "/top/characters?page=1&limit=25", deTop, urgente);
    else if (chave.indexOf("s:") === 0) p = obter(chave, `/anime/${chave.slice(2)}/characters`, deElenco, urgente);
    else return;
    est.erros[chave] = "carregando";
    p.then((l) => { est.linhas[chave] = l.map(item); est.erros[chave] = null; })
      .catch((e) => { est.erros[chave] = msgErro(e); })
      .finally(() => desenharLinha(chave));
  }
  // aquece o cache em segundo plano (ex.: ao abrir Ajustes ou o passo do avatar)
  function preaquecer() {
    carregarCatalogo().then((ok) => {
      if (!ok || !navigator.onLine || !catalogo.top) return;
      // e já pede as primeiras fotos ao navegador
      catalogo.top.slice(0, 8).concat(catalogo.series[0] ? catalogo.series[0].l.slice(0, 6) : []).forEach((x) => { const i = new Image(); i.referrerPolicy = "no-referrer"; i.src = x.u; });
    });
  }

  let timerBusca = null;
  function buscar(q) {
    est.busca = q;
    clearTimeout(timerBusca);
    if (q.trim().length < 2) { est.linhas.busca = null; est.animeBusca = null; est.erros.busca = null; est.buscando = false; desenharResultados(); return; }
    timerBusca = setTimeout(() => {
      const termo = q.trim(), chave = "q:" + termo.toLowerCase();
      est.buscando = true; desenharResultados();
      const aplicar = (pers, anime) => {
        if (est.busca !== q) return;
        est.linhas.busca = pers.map(item); est.erros.busca = null; est.buscando = false;
        est.animeBusca = anime && anime.lista.length ? anime.titulo : null;
        est.linhas.anime = anime && anime.lista.length ? anime.lista.map(item) : null;
        desenharResultados();
      };
      buscarAniList(termo).then((r) => aplicar(r.pers, r.anime)).catch(() => { if (est.busca === q) buscarJikan(q, termo, chave); });
    }, 400);
  }
  function buscarJikan(q, termo, chave) {
    {
      const pPers = obter(chave, `/characters?q=${encodeURIComponent(termo)}&order_by=favorites&sort=desc&limit=24`, deTop, true);
      // também procura um anime com esse nome e mostra o elenco dele
      const pAnime = obter("a" + chave, `/anime?q=${encodeURIComponent(termo)}&order_by=members&sort=desc&limit=1&sfw=true`,
        (j) => (j.data || []).slice(0, 1).map((a) => ({ u: "", n: a.title_english || a.title || "", l: String(a.mal_id) })), true)
        .then((l) => l[0] && l[0].l ? obter("s:" + l[0].l, `/anime/${l[0].l}/characters`, deElenco, true).then((el) => ({ titulo: l[0].n, lista: el })) : null)
        .catch(() => null);
      pPers.then((l) => {
        if (est.busca !== q) return;
        est.linhas.busca = l.map(item); est.erros.busca = null;
      }).catch((e) => { if (est.busca === q) est.erros.busca = msgErro(e); })
        .finally(() => { if (est.busca === q) { est.buscando = false; desenharResultados(); } });
      pAnime.then((r) => {
        if (est.busca !== q) return;
        est.animeBusca = r && r.lista.length ? r.titulo : null;
        est.linhas.anime = r ? r.lista.map(item) : null;
        desenharResultados();
      });
    }
  }
  function msgErro(e) {
    if (!navigator.onLine) return "Sem internet agora. Os personagens aparecem quando o aparelho estiver conectado.";
    if (!e || e.name === "TypeError") return "Não consegui falar com o servidor de imagens. Verifique a internet e tente de novo.";
    return "O servidor de imagens não respondeu (" + e.message + ").";
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
  const CACHE_IMG = "meu-controle-avatar";
  // guarda a imagem escolhida para aparecer sem internet (quando o servidor não deixa copiar)
  function guardarEndereco(url) {
    if (!global.caches || !/^https:/.test(url || "")) return Promise.resolve();
    return caches.open(CACHE_IMG).then((c) => c.match(url).then((r) => r || fetch(url, { mode: "no-cors" }).then((resp) => c.put(url, resp)))).catch(() => {});
  }
  function guardarLocal(item) {
    if (item.src && item.src.indexOf("data:") === 0) return Promise.resolve(item);
    const ctrl = global.AbortController ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), 8000) : 0;
    return fetch(item.url, ctrl ? { mode: "cors", signal: ctrl.signal } : { mode: "cors" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then((b) => miniatura(b, item.foco)).then((src) => Object.assign({}, item, { src }))
      .catch(() => guardarEndereco(item.url).then(() => Object.assign({}, item, { src: item.url })))
      .finally(() => clearTimeout(t));
  }
  function lerFoto(arquivo) {
    if (!arquivo || !/^image\//.test(arquivo.type)) { UI.toast("Escolha um arquivo de imagem."); return; }
    miniatura(arquivo, "50% 40%").then((src) => {
      est.escolha = { fonte: "foto", url: "", src, nome: "Sua foto", credito: "", link: "" };
      desenharFoto(); atualizarSelecao();
    }).catch(() => UI.toast("Não consegui abrir essa imagem."));
  }

  // ---------------------------------------------------------------------
  // desenho
  // ---------------------------------------------------------------------
  function corHex(k) { return global.Personalizar.corHex(k); }
  function chaveDe(it) {
    if (!it) return "inicial";
    if (it.fonte === "emoji") return "e:" + it.emoji;
    if (it.fonte === "inicial") return "inicial";
    return "u:" + (it.url || it.src || "");
  }
  function circulo(it, grupo, i, legenda) {
    const sel = chaveDe(est.escolha) === chaveDe(it);
    return `<button class="av-op${sel ? " ativo" : ""}" data-acao="av-escolher" data-i="${i}" data-grupo="${grupo}" data-chave="${esc(chaveDe(it))}" title="${esc(it.nome || "")}" aria-label="${esc(it.nome || "Imagem")}" aria-pressed="${sel}">
      <span class="av-img"><img src="${esc(it.src || it.url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" style="object-position:${it.foco || "50% 30%"}" onload="this.parentNode.classList.add('ok')" onerror="this.closest('.av-op').classList.add('quebrada')"></span>
      ${legenda && it.nome ? `<span class="av-nome">${esc(it.nome)}</span>` : ""}</button>`;
  }
  function grade(lista, g) { return `<div class="av-grade">${lista.map((x, i) => circulo(x, g, i, true)).join("")}</div>`; }
  function trilho(lista, g) { return `<div class="av-trilho">${lista.map((x, i) => circulo(x, g, i, true)).join("")}</div>`; }
  function esqueleto(n, tipo) { return `<div class="${tipo || "av-trilho"}">${Array.from({ length: n || 8 }, () => `<span class="av-op"><span class="av-img esqueleto"></span><span class="av-nome esq"></span></span>`).join("")}</div>`; }
  function aviso(txt, acao, rotulo, dados) { return `<p class="av-aviso">${esc(txt)}${acao ? ` <button class="link-acao" data-acao="${acao}" ${dados || ""}>${rotulo}</button>` : ""}</p>`; }

  function topoHTML() {
    const it = est.escolha;
    const temImg = it && (it.src || it.url);
    const bg = temImg ? `style="--av-bg:url('${(it.src || it.url).replace(/'/g, "%27")}')"` : `style="--av-bg:none;--av-cor:${corHex(est.cor)}"`;
    const conteudo = temImg ? `<img src="${esc(it.src || it.url)}" alt="" referrerpolicy="no-referrer" style="object-position:${it.foco || "50% 30%"}">`
      : `<span class="av-emoji">${esc((it && it.emoji) || (est.nome || "Eu").charAt(0).toUpperCase())}</span>`;
    return `<div class="av-topo" ${bg}><div class="av-topo-fundo"></div>
      <span class="avatar gigante" style="--av:${corHex(est.cor)}">${conteudo}</span>
      <b class="av-nome-pessoa">${esc(est.nome || "Você")}</b>
      ${ehAnime(it) ? `<small class="av-credito">${esc(it.nome)} · ${site(it)}${it.link ? ` · <a href="${esc(it.link)}" target="_blank" rel="noopener">fonte</a>` : ""}</small>` : ""}
    </div>`;
  }
  function linhaHTML(chave) {
    const l = est.linhas[chave], e = est.erros[chave];
    if (l && l.length) return trilho(l, chave);
    if (l && !l.length) return aviso("Nenhum personagem com foto aqui.");
    if (e && e !== "carregando") return aviso(e, "av-tentar", "Tentar de novo", `data-k="${chave}"`);
    return esqueleto(8);
  }
  function fotoHTML() {
    const f = est.escolha && est.escolha.fonte === "foto" ? est.escolha : est.original && est.original.fonte === "foto" ? est.original : null;
    return `<div class="av-grade av-grade-foto"><label class="av-op av-enviar-op"><input type="file" accept="image/*" id="avArquivo" hidden><span class="av-img av-enviar"><span>📷</span><small>Escolher foto</small></span></label>
      ${f ? circulo(f, "foto", 0) : ""}</div>`;
  }
  function corpoHTML() {
    const P = global.Personalizar;
    let html = `<section class="av-secao"><h3>Sua foto</h3><div id="avFoto">${fotoHTML()}</div></section>`;
    html += `<section class="av-secao"><h3>Buscar</h3>
      <div class="av-busca">${UI.svg("buscar")}<input id="avBusca" type="search" value="${esc(est.busca)}" placeholder="Personagem ou anime — ex.: Luffy, Frieren, Naruto" autocomplete="off" enterkeyhint="search"></div>
      <div id="avResultados">${resultadosHTML()}</div></section>`;
    html += `<section class="av-secao av-linha" data-linha="top"><h3>Mais populares</h3><div class="av-linha-corpo">${linhaHTML("top")}</div></section>`;
    html += listaSeries().map((s) => `<section class="av-secao av-linha" data-linha="s:${s[0]}"><h3>${esc(s[1])}</h3><div class="av-linha-corpo">${linhaHTML("s:" + s[0])}</div></section>`).join("");
    html += `<section class="av-secao"><h3>Emojis</h3>
      <div class="av-grade emojis"><button class="av-op av-emoji-op${chaveDe(est.escolha) === "inicial" ? " ativo" : ""}" data-acao="av-inicial" data-chave="inicial"><span class="av-img">${esc((est.nome || "Eu").charAt(0).toUpperCase())}</span></button>
        ${P.AVATARES.map((e) => `<button class="av-op av-emoji-op${chaveDe(est.escolha) === "e:" + e ? " ativo" : ""}" data-acao="av-emoji" data-k="${e}" data-chave="e:${e}"><span class="av-img">${e}</span></button>`).join("")}</div>
      <h3 class="av-sub">Cor de fundo</h3>
      <div class="ap-cores" id="avCores">${coresHTML()}</div>
    </section>
    <p class="av-rodape">${navigator.onLine ? "" : "📴 Sem internet: os personagens aparecem quando o aparelho estiver conectado. "}Personagens: <a href="https://anilist.co" target="_blank" rel="noopener">AniList</a> e <a href="https://myanimelist.net" target="_blank" rel="noopener">MyAnimeList</a>. A imagem escolhida fica guardada só neste aparelho.</p>`;
    return html;
  }
  function coresHTML() { return global.Personalizar.CORES.map((c) => `<button class="ap-cor${est.cor === c.k ? " ativo" : ""}" data-acao="av-cor" data-k="${c.k}" style="--c:${c.c}" aria-label="${c.r}"></button>`).join(""); }
  function resultadosHTML() {
    if (!est.busca || est.busca.trim().length < 2) return `<p class="av-dica">Digite o nome de um personagem ou de um anime.</p>`;
    let h = "";
    if (est.buscando && !est.linhas.busca) h += esqueleto(6, "av-grade");
    else if (est.erros.busca) h += aviso(est.erros.busca);
    else if (est.linhas.busca && !est.linhas.busca.length && !(est.linhas.anime && est.linhas.anime.length)) h += aviso(`Nenhum personagem com foto encontrado para “${est.busca}”.`);
    else if (est.linhas.busca && est.linhas.busca.length) h += grade(est.linhas.busca, "busca");
    if (est.linhas.anime && est.linhas.anime.length) h += `<h3 class="av-sub">Personagens de ${esc(est.animeBusca)}</h3>${trilho(est.linhas.anime, "anime")}`;
    return h;
  }
  function mudou() {
    return JSON.stringify([chaveDe(est.escolha), est.cor]) !== JSON.stringify([chaveDe(est.original), est.corOriginal]);
  }
  function tela() { return document.getElementById("avTela"); }

  // atualizações pontuais (sem redesenhar as galerias: nada pisca nem recarrega)
  function atualizarSelecao() {
    const el = tela(); if (!el) return;
    const k = chaveDe(est.escolha);
    el.querySelectorAll(".av-op[data-chave]").forEach((b) => { const on = b.dataset.chave === k; b.classList.toggle("ativo", on); b.setAttribute("aria-pressed", on); });
    el.querySelector(".av-cabeca-topo").innerHTML = topoHTML();
    const m = mudou();
    el.querySelector("[data-acao='av-pronto']").disabled = !m;
    const barra = el.querySelector(".av-confirmar");
    const it = est.escolha;
    barra.classList.toggle("on", m);
    barra.querySelector(".av-confirmar-txt").innerHTML = m ? `<b>${esc(ehAnime(it) ? it.nome : it && it.fonte === "foto" ? "Sua foto" : it && it.emoji ? "Emoji " + it.emoji : "Inicial do nome")}</b><small>toque em Usar para salvar</small>` : "";
    barra.querySelector(".av-confirmar-img").innerHTML = el.querySelector(".av-topo .avatar").outerHTML.replace("gigante", "");
  }
  function desenharLinha(chave) {
    const el = tela(); if (!el || !est.aberto) return;
    const s = el.querySelector(`.av-linha[data-linha="${chave}"] .av-linha-corpo`);
    if (s) s.innerHTML = linhaHTML(chave);
  }
  function desenharResultados() {
    const r = tela() && tela().querySelector("#avResultados");
    if (r) r.innerHTML = resultadosHTML();
  }
  function desenharFoto() {
    const f = tela() && tela().querySelector("#avFoto");
    if (f) { f.innerHTML = fotoHTML(); ligarArquivo(); }
  }
  function desenhar() {
    const el = tela();
    if (!el || !est.aberto) return;
    el.querySelector(".av-cabeca-topo").innerHTML = topoHTML();
    el.querySelector(".av-corpo-conteudo").innerHTML = corpoHTML();
    ligarArquivo();
    const b = el.querySelector("#avBusca");
    if (b) b.addEventListener("input", (e) => buscar(e.target.value));
    observarLinhas(el);
    atualizarSelecao();
  }
  function ligarArquivo() {
    const arq = tela() && tela().querySelector("#avArquivo");
    if (arq) arq.addEventListener("change", (e) => { lerFoto(e.target.files[0]); e.target.value = ""; });
  }
  // as fileiras só pedem os personagens quando chegam perto da tela
  let observador = null;
  function observarLinhas(el) {
    if (observador) observador.disconnect();
    const linhas = el.querySelectorAll(".av-linha");
    if (!global.IntersectionObserver) { linhas.forEach((l) => carregarLinha(l.dataset.linha)); return; }
    observador = new IntersectionObserver((ents) => ents.forEach((en) => {
      if (en.isIntersecting) { carregarLinha(en.target.dataset.linha); observador.unobserve(en.target); }
    }), { root: el.querySelector(".av-corpo"), rootMargin: "500px 0px" });
    linhas.forEach((l) => observador.observe(l));
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
    // erros antigos não ficam presos: tenta de novo ao reabrir
    Object.keys(est.erros).forEach((k) => { if (est.erros[k] !== "carregando") delete est.erros[k]; });
    let el = tela();
    if (!el) {
      el = document.createElement("div");
      el.id = "avTela"; el.className = "av-tela"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Editar avatar");
      el.innerHTML = `<header class="av-barra"><button class="btn fantasma" data-acao="av-fechar" aria-label="Voltar">${UI.svg("voltar")}</button><b>Editar avatar</b><button class="btn av-pronto" data-acao="av-pronto" disabled>Pronto</button></header>
        <div class="av-corpo"><div class="av-cabeca-topo"></div><div class="av-corpo-conteudo"></div></div>
        <div class="av-confirmar" aria-live="polite"><span class="av-confirmar-img"></span><span class="av-confirmar-txt"></span><button class="btn primario" data-acao="av-pronto">Usar</button></div>`;
      document.body.appendChild(el);
    }
    document.body.classList.add("av-aberta");
    requestAnimationFrame(() => el.classList.add("on"));
    UI.aposVoltar(() => { if (est.aberto) { try { history.pushState({ avatar: true }, "", location.href); } catch (e) { /* sem histórico */ } } });
    desenhar();
    el.querySelector(".av-corpo").scrollTop = 0;
    // primeira vez na sessão: assim que o catálogo chega, monta as fileiras dele
    if (!catalogo) carregarCatalogo().then((ok) => { if (ok && est.aberto) desenhar(); });
  }
  function fechar(peloVoltar) {
    const el = tela();
    if (!el || !est.aberto) return;
    est.aberto = false;
    if (observador) observador.disconnect();
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
    const btns = document.querySelectorAll("#avTela [data-acao='av-pronto']");
    const terminar = (resultado) => { const fn = est.aoConcluir; fechar(); if (fn) fn(resultado); };
    if (ehAnime(it)) {
      btns.forEach((b) => { b.disabled = true; b.dataset.txt = b.textContent; b.textContent = "Salvando…"; });
      guardarLocal(it).then((x) => { btns.forEach((b) => { b.textContent = b.dataset.txt; b.disabled = false; }); terminar({ img: limpar(x), emoji: "", cor: est.cor }); });
      return;
    }
    if (it && it.fonte === "foto") { terminar({ img: limpar(it), emoji: "", cor: est.cor }); return; }
    terminar({ img: null, emoji: it && it.emoji ? it.emoji : "", cor: est.cor });
  }
  function limpar(x) { return { fonte: x.fonte, src: x.src || x.url, url: x.url || "", nome: x.nome || "", credito: x.credito || "", link: x.link || "", foco: x.foco || "" }; }
  function salvarNoPerfil(r) {
    const d = global.App.dados(), ap = d.config.aparencia;
    ap.avatarImg = r.img; ap.avatar = r.img ? "" : r.emoji; ap.avatarCor = r.cor;
    global.App.salvar("Avatar atualizado.", { semIntegracao: true });
  }
  function lista(g) {
    if (g === "foto") return [est.escolha && est.escolha.fonte === "foto" ? est.escolha : est.original];
    return est.linhas[g] || [];
  }
  function vibrar() {
    const ap = (global.App.dados().config.aparencia || {});
    if (ap.vibrar !== false && navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* sem suporte */ } }
  }

  global.App.registrarAcoes({
    "av-abrir": () => abrir(),
    "av-fechar": () => fechar(),
    "av-pronto": concluir,
    "av-escolher": (el) => {
      const it = lista(el.dataset.grupo)[Number(el.dataset.i)];
      if (!it || el.classList.contains("quebrada")) return;
      est.escolha = Object.assign({}, it);
      vibrar(); atualizarSelecao();
    },
    "av-emoji": (el) => { est.escolha = { fonte: "emoji", emoji: el.dataset.k }; vibrar(); atualizarSelecao(); },
    "av-inicial": () => { est.escolha = { fonte: "inicial" }; atualizarSelecao(); },
    "av-cor": (el) => {
      est.cor = el.dataset.k;
      const t = tela();
      t.querySelector("#avCores").innerHTML = coresHTML();
      t.querySelectorAll(".av-emoji-op").forEach((b) => b.style.setProperty("--av", corHex(est.cor)));
      atualizarSelecao();
    },
    // tenta de novo esta fileira (primeiro) e as outras que também falharam
    "av-tentar": (el) => {
      const k = el.dataset.k;
      const falhas = Object.keys(est.erros).filter((x) => x !== k && est.erros[x] && est.erros[x] !== "carregando" && x !== "busca");
      [k].concat(falhas).forEach((x, i) => { delete est.erros[x]; desenharLinha(x); carregarLinha(x, i === 0); });
    }
  });

  // a imagem do avatar atual (quando é um endereço) fica guardada para funcionar sem internet
  global.App.aoSalvar((d, abertura) => {
    const img = d.config.aparencia && d.config.aparencia.avatarImg;
    if (abertura && img && /^https:/.test(img.src || "")) setTimeout(() => guardarEndereco(img.src), 3000);
  });

  // ---------------------------------------------------------------------
  // abertura: o avatar e um "olá" por um instante ao abrir o app
  // ---------------------------------------------------------------------
  function abertura() {
    const d = global.App.dados();
    if (!d) return;
    const ap = d.config.aparencia || {}, u = d.usuarios[0];
    if (ap.abertura === false || !d.config.onboardingFeito && (u.nome || "Eu") === "Eu") return;
    if (/[?&]acao=/.test(location.search)) return; // atalho do ícone: vai direto ao ponto
    if (document.documentElement.classList.contains("travado")) return; // a tela do PIN já cumprimenta
    const nome = u.nome && u.nome !== "Eu" ? u.nome.split(" ")[0] : "";
    const h = new Date().getHours(), saud = h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
    const img = ap.avatarImg && ap.avatarImg.src;
    const el = document.createElement("div");
    el.className = "abertura";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<div class="ab-fundo"${img ? ` style="--ab-bg:url('${img.replace(/'/g, "%27")}')"` : ` style="--ab-cor:${corHex(ap.avatarCor || "roxo")}"`}></div>
      <div class="ab-conteudo"><span class="avatar gigante${img ? " com-img" : ""}" style="--av:${corHex(ap.avatarCor || "roxo")}">${global.Personalizar.avatarConteudo(d)}</span>
        <p class="ab-saud">${saud}${nome ? "," : ""}</p>${nome ? `<p class="ab-nome">${esc(nome)}</p>` : ""}</div>`;
    document.body.appendChild(el);
    let saiu = false;
    const sair = () => {
      if (saiu) return; saiu = true;
      el.classList.add("saindo");
      setTimeout(() => el.remove(), 450);
    };
    el.addEventListener("click", sair);
    setTimeout(sair, document.documentElement.classList.contains("sem-animacao") ? 700 : 1300);
  }
  document.addEventListener("DOMContentLoaded", abertura);

  global.Avatar = { abrir, fechar, guardarLocal, miniatura, preaquecer, estado: est, SERIES };
})(window);
