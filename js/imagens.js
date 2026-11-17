/**
 * imagens.js
 * -----------------------------------------------------------------------
 * Fotos guardadas NESTE aparelho (IndexedDB), fora do arquivo de dados:
 * as fotos de evolução do corpo ("foto:<id>") e as dos rótulos dos
 * produtos ("prod:<id>"). O localStorage não comporta imagens; por isso
 * elas não entram na sincronização nem no backup em JSON — têm o seu
 * próprio "Exportar fotos" / "Importar fotos".
 *
 * Antes de guardar, a foto é reduzida (lado maior de até 1600 px, JPEG).
 * Na tela, <img data-img="chave"> é preenchida depois de cada desenho.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const BANCO = "meu-controle-imagens", LOJA = "imagens";
  const urls = new Map(); // chave → objectURL (enquanto o app está aberto)
  let bancoP = null;

  function banco() {
    if (bancoP) return bancoP;
    bancoP = new Promise((ok, erro) => {
      if (!global.indexedDB) { erro(new Error("Este navegador não guarda fotos.")); return; }
      const r = indexedDB.open(BANCO, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore(LOJA); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => erro(r.error || new Error("Não consegui abrir o armazenamento de fotos."));
    });
    bancoP.catch(() => { bancoP = null; });
    return bancoP;
  }
  function tx(modo, fn) {
    return banco().then((db) => new Promise((ok, erro) => {
      const t = db.transaction(LOJA, modo), loja = t.objectStore(LOJA);
      const r = fn(loja);
      t.oncomplete = () => ok(r && r.result);
      t.onerror = t.onabort = () => erro(t.error || new Error("Falha ao gravar a foto (pode ser falta de espaço)."));
    }));
  }
  function salvar(chave, blob) { soltar(chave); return tx("readwrite", (l) => l.put(blob, chave)); }
  function ler(chave) { return tx("readonly", (l) => l.get(chave)); }
  function apagar(chave) { soltar(chave); return tx("readwrite", (l) => l.delete(chave)); }
  function chaves() { return tx("readonly", (l) => l.getAllKeys()).then((k) => k || []); }
  function soltar(chave) { const u = urls.get(chave); if (u) { URL.revokeObjectURL(u); urls.delete(chave); } }
  function url(chave) {
    if (urls.has(chave)) return Promise.resolve(urls.get(chave));
    return ler(chave).then((b) => { if (!b) return null; const u = URL.createObjectURL(b); urls.set(chave, u); return u; });
  }

  // reduz a foto escolhida (arquivo) para um JPEG leve
  function reduzir(arquivo, max, qualidade) {
    max = max || 1600; qualidade = qualidade || 0.82;
    const desenhar = (img, w, h) => {
      const esc = Math.min(1, max / Math.max(w, h)), cw = Math.round(w * esc), ch = Math.round(h * esc);
      const c = document.createElement("canvas"); c.width = cw; c.height = ch;
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cw, ch); g.drawImage(img, 0, 0, cw, ch);
      return new Promise((ok, erro) => c.toBlob((b) => b ? ok(b) : erro(new Error("Não consegui preparar a foto.")), "image/jpeg", qualidade));
    };
    const porImg = () => new Promise((ok, erro) => {
      const u = URL.createObjectURL(arquivo), img = new Image();
      img.onload = () => { desenhar(img, img.naturalWidth, img.naturalHeight).then(ok, erro).finally(() => URL.revokeObjectURL(u)); };
      img.onerror = () => { URL.revokeObjectURL(u); erro(new Error("Esse arquivo não parece ser uma foto.")); };
      img.src = u;
    });
    if (global.createImageBitmap) {
      return createImageBitmap(arquivo, { imageOrientation: "from-image" }).then((bm) => desenhar(bm, bm.width, bm.height).finally(() => bm.close && bm.close())).catch(porImg);
    }
    return porImg();
  }

  // preenche as <img data-img="chave"> que estão na tela
  function preencher(raiz) {
    (raiz || document).querySelectorAll("img[data-img]:not([data-ok])").forEach((img) => {
      img.dataset.ok = "1";
      url(img.dataset.img).then((u) => {
        if (u) { img.src = u; img.classList.add("carregada"); }
        else { const p = img.closest("[data-sem-foto]") || img.parentElement; if (p) p.classList.add("sem-foto"); img.remove(); }
      }).catch(() => { const p = img.parentElement; if (p) p.classList.add("sem-foto"); img.remove(); });
    });
  }

  // cópia de segurança das fotos: um arquivo com todas (ou as de um prefixo)
  const paraDataURL = (blob) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => erro(r.error); r.readAsDataURL(blob); });
  const deDataURL = (t) => fetch(t).then((r) => r.blob());
  function exportar(prefixos) {
    return chaves().then((ks) => {
      ks = ks.filter((k) => !prefixos || prefixos.some((p) => String(k).indexOf(p) === 0));
      return ks.reduce((p, k) => p.then((l) => ler(k).then((b) => b ? paraDataURL(b).then((u) => { l.push({ chave: k, dados: u }); return l; }) : l)), Promise.resolve([]));
    }).then((itens) => ({ tipo: "meu-controle-fotos", versao: 1, exportadoEm: new Date().toISOString(), itens }));
  }
  function importar(obj) {
    if (!obj || obj.tipo !== "meu-controle-fotos" || !Array.isArray(obj.itens)) return Promise.reject(new Error("Esse arquivo não é uma cópia de fotos do Meu Controle."));
    return obj.itens.reduce((p, it) => p.then((n) => deDataURL(it.dados).then((b) => salvar(it.chave, b)).then(() => n + 1)), Promise.resolve(0));
  }
  // apaga as fotos que não pertencem mais a nenhum registro (chamado ao abrir o app)
  function limparOrfas(d) {
    const validas = new Set();
    (d.fotos || []).forEach((f) => validas.add("foto:" + f.id));
    (d.produtos || []).forEach((p) => validas.add("prod:" + p.id));
    return chaves().then((ks) => Promise.all(ks.filter((k) => !validas.has(k)).map(apagar))).catch(() => {});
  }
  function limparTudo() { urls.forEach((u) => URL.revokeObjectURL(u)); urls.clear(); return tx("readwrite", (l) => l.clear()).catch(() => {}); }
  function ocupado() { return chaves().then((ks) => ks.reduce((p, k) => p.then((s) => ler(k).then((b) => s + (b ? b.size : 0))), Promise.resolve(0))); }

  if (global.App) {
    global.App.aoRenderizar(() => preencher());
    // ao abrir (e só com dados reais): tira do aparelho as fotos de registros apagados
    global.App.aoSalvar((d, abertura) => { if (abertura && !d.demo) setTimeout(() => limparOrfas(global.App.dados()), 6000); });
  }
  // janelas (modais) também têm fotos
  const elModal = document.getElementById("modal");
  if (elModal) new MutationObserver(() => preencher(elModal)).observe(elModal, { childList: true, subtree: true });

  global.Imagens = { BANCO, salvar, ler, apagar, url, chaves, reduzir, preencher, exportar, importar, limparOrfas, limparTudo, ocupado };
})(window);
