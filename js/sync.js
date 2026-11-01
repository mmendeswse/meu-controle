/**
 * sync.js
 * -----------------------------------------------------------------------
 * Sincronização entre aparelhos usando um repositório PRIVADO do GitHub.
 *
 *  - Cada conta é um arquivo  contas/<id>.json  no repositório, com os
 *    dados CRIPTOGRAFADOS (AES-GCM 256, compactados com gzip). Quem vê o
 *    repositório só enxerga texto embaralhado.
 *  - O "código da conta" leva o repositório, a chave de acesso do GitHub
 *    (token "fine-grained" só daquele repositório) e a chave da
 *    criptografia. Funciona como uma senha: quem tem o código lê e altera.
 *  - Mudanças feitas em dois aparelhos ao mesmo tempo são JUNTADAS
 *    registro a registro (cada aparelho guarda a "base" da última
 *    sincronização para saber o que mudou de cada lado).
 *  - A lista de aparelhos fica dentro do arquivo criptografado; um aparelho
 *    removido se desconecta (e pode apagar os dados) ao sincronizar.
 *  - Cada envio é um commit: o histórico do GitHub vira um backup com
 *    todas as versões.
 *
 * Fica fora da sincronização o que é do aparelho: a pasta de backup e o
 * PIN (que nem está nos dados).
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const UI = global.UI, A = global.Armazenamento;
  const esc = UI.esc;
  const App = () => global.App;
  const CHAVE = "meuControle:sync";
  const API = "https://api.github.com";
  const PREFIXO = "MC1.";
  const BANCO = "meu-controle-sync";
  const VISTO_A_CADA = 6 * 3600e3; // atualiza "visto por último" sem gerar commit a cada minuto

  // ---------------------------------------------------------------------
  // estado deste aparelho
  // ---------------------------------------------------------------------
  function ler() { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; } }
  function gravar(s) { try { localStorage.setItem(CHAVE, JSON.stringify(s)); } catch (e) { /* sem espaço */ } }
  function conectado() { const s = ler(); return !!(s.t && s.k && s.c); }

  // base da última sincronização (IndexedDB: pode ser grande)
  let bancoP = null;
  function banco() {
    if (bancoP) return bancoP;
    bancoP = new Promise((ok, erro) => {
      if (!global.indexedDB) { erro(new Error("sem IndexedDB")); return; }
      const r = indexedDB.open(BANCO, 1);
      r.onupgradeneeded = () => r.result.createObjectStore("base");
      r.onsuccess = () => { const db = r.result; db.onclose = () => { bancoP = null; }; db.onversionchange = () => { db.close(); bancoP = null; }; ok(db); };
      r.onerror = () => { bancoP = null; erro(r.error); };
    });
    return bancoP;
  }
  function lerBase() {
    return banco().then((db) => new Promise((ok) => {
      const r = db.transaction("base").objectStore("base").get("base");
      r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null);
    })).catch(() => { try { return JSON.parse(localStorage.getItem(CHAVE + ":base")); } catch (e) { return null; } });
  }
  function gravarBase(b) {
    return banco().then((db) => new Promise((ok) => {
      const t = db.transaction("base", "readwrite");
      if (b) t.objectStore("base").put(b, "base"); else t.objectStore("base").delete("base");
      t.oncomplete = t.onerror = () => ok();
    })).catch(() => { try { if (b) localStorage.setItem(CHAVE + ":base", JSON.stringify(b)); else localStorage.removeItem(CHAVE + ":base"); } catch (e) { /* ignora */ } });
  }

  // ---------------------------------------------------------------------
  // código da conta
  // ---------------------------------------------------------------------
  const b64url = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const deB64url = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4))));
  function codigoDe(s) { return PREFIXO + b64url(JSON.stringify({ o: s.o, r: s.r, t: s.t, k: s.k, c: s.c })); }
  function lerCodigo(txt) {
    const m = String(txt || "").replace(/\s+/g, "").match(/MC1\.[A-Za-z0-9_-]+/);
    if (!m) return null;
    try {
      const j = JSON.parse(deB64url(m[0].slice(PREFIXO.length)));
      return j && j.o && j.r && j.t && j.k && j.c ? j : null;
    } catch (e) { return null; }
  }
  function linkDe(s) { return location.href.split("#")[0].split("?")[0] + "#sync=" + codigoDe(s); }

  // ---------------------------------------------------------------------
  // criptografia (AES-GCM 256) + compactação
  // ---------------------------------------------------------------------
  function bytesB64(bytes) { let s = ""; const T = 0x8000; for (let i = 0; i < bytes.length; i += T) s += String.fromCharCode.apply(null, bytes.subarray(i, i + T)); return btoa(s); }
  function b64Bytes(b) { const s = atob(b); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function novaChave() { const a = new Uint8Array(32); crypto.getRandomValues(a); return bytesB64(a).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function importar(k) { return crypto.subtle.importKey("raw", b64Bytes(k.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((k.length + 3) % 4)), "AES-GCM", false, ["encrypt", "decrypt"]); }
  function passar(bytes, stream) { return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then((b) => new Uint8Array(b)); }
  const temGzip = () => typeof global.CompressionStream === "function" && typeof global.DecompressionStream === "function";
  function cifrar(obj, k) {
    const json = new TextEncoder().encode(JSON.stringify(obj));
    const z = temGzip();
    const iv = new Uint8Array(12); crypto.getRandomValues(iv);
    return (z ? passar(json, new CompressionStream("gzip")) : Promise.resolve(json))
      .then((dados) => importar(k).then((ch) => crypto.subtle.encrypt({ name: "AES-GCM", iv }, ch, dados)))
      .then((c) => ({ app: "meu-controle", v: 1, z, iv: bytesB64(iv), c: bytesB64(new Uint8Array(c)) }));
  }
  function decifrar(env, k) {
    if (!env || env.app !== "meu-controle" || !env.c) return Promise.reject(Object.assign(new Error("arquivo inválido"), { tipo: "chave" }));
    return importar(k).then((ch) => crypto.subtle.decrypt({ name: "AES-GCM", iv: b64Bytes(env.iv) }, ch, b64Bytes(env.c)))
      .catch(() => { throw Object.assign(new Error("chave"), { tipo: "chave" }); })
      .then((b) => env.z ? passar(new Uint8Array(b), new DecompressionStream("gzip")) : new Uint8Array(b))
      .then((b) => JSON.parse(new TextDecoder().decode(b)));
  }

  // ---------------------------------------------------------------------
  // GitHub
  // ---------------------------------------------------------------------
  function erroGH(status, j) {
    const msg = status === 401 ? "A chave do GitHub venceu ou foi apagada. Atualize a chave em Ajustes → Sincronização."
      : status === 403 ? ((j && /rate limit/i.test(j.message || "")) ? "O GitHub pediu uma pausa (muitos pedidos). Tento de novo daqui a pouco." : "A chave do GitHub não tem permissão para gravar neste repositório (precisa de Contents: Read and write).")
      : status === 404 ? "Não encontrei o repositório. Confira o nome e se a chave tem acesso a ele."
      : "O GitHub respondeu com erro " + status + ".";
    return Object.assign(new Error(msg), { status, tipo: status === 401 ? "token" : "gh" });
  }
  function gh(s, metodo, caminho, corpo, accept) {
    return fetch(API + caminho, {
      method: metodo, cache: "no-store",
      headers: Object.assign({ Authorization: "Bearer " + s.t, Accept: accept || "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, corpo ? { "Content-Type": "application/json" } : {}),
      body: corpo ? JSON.stringify(corpo) : undefined
    }).then((r) => {
      const exp = r.headers.get("github-authentication-token-expiration");
      if (exp) { const st = ler(); if (st.t === s.t && st.expira !== exp) { st.expira = exp; gravar(st); } }
      return (accept && accept.indexOf("raw") !== -1 ? r.text() : r.json().catch(() => null)).then((j) => ({ status: r.status, j }));
    }).catch((e) => { throw Object.assign(new Error(navigator.onLine ? "Não consegui falar com o GitHub." : "Sem internet — sincronizo quando a conexão voltar."), { tipo: "rede", causa: e }); });
  }
  const caminhoArquivo = (s) => `/repos/${encodeURIComponent(s.o)}/${encodeURIComponent(s.r)}/contents/contas/${encodeURIComponent(s.c)}.json`;
  function lerArquivo(s) {
    return gh(s, "GET", caminhoArquivo(s) + "?t=" + Date.now()).then(({ status, j }) => {
      if (status === 404) return null;
      if (status !== 200 || !j) throw erroGH(status, j);
      if (j.content && j.encoding === "base64") return { sha: j.sha, env: JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\s/g, ""))))) };
      // arquivo grande (> 1 MB): o conteúdo vem à parte
      return gh(s, "GET", caminhoArquivo(s) + "?t=" + Date.now(), null, "application/vnd.github.raw+json").then((r) => {
        if (r.status !== 200) throw erroGH(r.status, null);
        return { sha: j.sha, env: JSON.parse(r.j) };
      });
    });
  }
  function gravarArquivo(s, env, sha, msg) {
    const conteudo = btoa(unescape(encodeURIComponent(JSON.stringify(env))));
    return gh(s, "PUT", caminhoArquivo(s), Object.assign({ message: msg, content: conteudo }, sha ? { sha } : {})).then(({ status, j }) => {
      if (status === 200 || status === 201) return j.content.sha;
      if (status === 409 || status === 422) throw Object.assign(new Error("conflito"), { tipo: "conflito" });
      throw erroGH(status, j);
    });
  }
  function apagarArquivo(s, sha) {
    return gh(s, "DELETE", caminhoArquivo(s), { message: "Meu Controle: conta encerrada (código trocado)", sha }).then(({ status, j }) => {
      if (status !== 200 && status !== 404) throw erroGH(status, j);
    });
  }
  // confere a chave e o repositório; devolve { o, r, privado }
  function conferirAcesso(token, repo) {
    const s = { t: token };
    const resolverDono = repo.indexOf("/") !== -1 ? Promise.resolve(repo.split("/")[0]) : gh(s, "GET", "/user").then(({ status, j }) => {
      if (status !== 200 || !j || !j.login) throw erroGH(status === 200 ? 404 : status, j);
      return j.login;
    });
    const nome = repo.split("/").pop();
    return resolverDono.then((o) => gh(s, "GET", `/repos/${encodeURIComponent(o)}/${encodeURIComponent(nome)}`).then(({ status, j }) => {
      if (status !== 200) throw erroGH(status, j);
      if (j.permissions && j.permissions.push === false) throw erroGH(403, j);
      return { o: j.owner.login, r: j.name, privado: !!j.private };
    })).catch((e) => {
      if (e.status === 401) throw new Error("O GitHub não aceitou essa chave. Confira se copiou inteira e se ela não foi apagada.");
      throw e;
    });
  }

  // ---------------------------------------------------------------------
  // junção de alterações (três vias: base × este aparelho × nuvem)
  // ---------------------------------------------------------------------
  function estavel(v) {
    if (v === undefined) return "u";
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(estavel).join(",") + "]";
    return "{" + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + estavel(v[k])).join(",") + "}";
  }
  const igual = (a, b) => a === b || estavel(a) === estavel(b);
  const ehObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const listaComId = (v) => Array.isArray(v) && v.every((x) => x && typeof x === "object" && x.id != null);
  function juntarLista(b, l, r) {
    const mapa = (lista) => { const m = new Map(); (lista || []).forEach((x) => m.set(String(x.id), x)); return m; };
    const mb = mapa(b), ml = mapa(l), mr = mapa(r);
    const ordem = (r || []).map((x) => String(x.id)).concat((l || []).map((x) => String(x.id)).filter((id) => !mr.has(id)));
    const vistos = new Set(), saida = [];
    ordem.forEach((id) => {
      if (vistos.has(id)) return; vistos.add(id);
      const x = juntar(mb.get(id), ml.get(id), mr.get(id));
      if (x !== undefined) saida.push(x);
    });
    return saida;
  }
  function juntar(b, l, r) {
    if (igual(l, r)) return l;
    if (igual(l, b)) return r;          // só a nuvem mudou (ou apagou)
    if (igual(r, b)) return l;          // só este aparelho mudou (ou apagou)
    // os dois mudaram
    if (l === undefined) return r;      // apagado aqui, editado lá: não perde a edição
    if (r === undefined) return l;
    if (ehObj(l) && ehObj(r)) {
      const o = {};
      new Set(Object.keys(l).concat(Object.keys(r))).forEach((k) => { const v = juntar(ehObj(b) ? b[k] : undefined, l[k], r[k]); if (v !== undefined) o[k] = v; });
      return o;
    }
    if (Array.isArray(l) && Array.isArray(r) && listaComId(l) && listaComId(r)) return juntarLista(listaComId(b) ? b : [], l, r);
    return l; // mesmo campo mudou nos dois: vale o deste aparelho
  }

  // dois aparelhos que começaram separados têm perfis com ids diferentes: fica o da conta
  function umPerfil(d) { if (d && Array.isArray(d.usuarios) && d.usuarios.length > 1) d.usuarios = [d.usuarios[0]]; return d; }
  // o que vai para a nuvem (sem o que é só deste aparelho)
  function paraNuvem(d) {
    const c = JSON.parse(JSON.stringify(d));
    delete c.atualizadoEm; delete c.demo;
    if (c.config) { delete c.config.backup; delete c.config.ultimoBackup; }
    return c;
  }
  let aplicando = false;
  function aplicar(dados) {
    const atual = App().dados();
    const novo = JSON.parse(JSON.stringify(dados));
    novo.config = novo.config || {};
    novo.config.backup = atual.config.backup;
    if (atual.config.ultimoBackup) novo.config.ultimoBackup = atual.config.ultimoBackup;
    novo.demo = false;
    aplicando = true;
    try { App().substituirDados((A.substituirSemCopia || A.substituir)(novo)); } finally { aplicando = false; }
  }

  // ---------------------------------------------------------------------
  // aparelho
  // ---------------------------------------------------------------------
  function idAparelho() { const s = ler(); if (!s.disp) { s.disp = A.novoId ? A.novoId() : String(Date.now()); gravar(s); } return s.disp; }
  function nomePadrao() {
    const ua = navigator.userAgent;
    const so = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "iPad" : /iPhone/.test(ua) ? "iPhone" : /Android/.test(ua) ? (/Mobile/.test(ua) ? "Celular Android" : "Tablet Android") : /Windows/.test(ua) ? "PC Windows" : /Mac/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Computador Linux" : "Aparelho";
    const nav = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
    return so + (nav && !/iPhone|iPad/.test(so) ? " · " + nav : "");
  }
  function registro(s) { return { nome: s.nome || nomePadrao(), visto: new Date().toISOString(), versao: App().VERSAO_APP }; }

  // ---------------------------------------------------------------------
  // ciclo de sincronização
  // ---------------------------------------------------------------------
  const st = { rodando: false, denovo: false, timer: null, estado: "parado", msg: "", aparelhos: null };
  function avisar() { atualizarCartao(); atualizarSelo(); }
  function ocupadoNaTela() {
    return UI.modalAberto() || document.body.classList.contains("av-aberta") || document.documentElement.classList.contains("travado");
  }
  function agendar(ms) {
    if (!conectado()) return;
    clearTimeout(st.timer);
    st.timer = setTimeout(() => sincronizar(), ms == null ? 3000 : ms);
  }

  // opc.forcarEnvio: grava mesmo sem mudanças (ex.: registrar este aparelho)
  function sincronizar(opc) {
    opc = opc || {};
    if (!conectado()) return Promise.resolve();
    if (st.rodando) { st.denovo = true; return Promise.resolve(); }
    // não troca os dados por baixo de um formulário aberto: tenta daqui a pouco
    if (!opc.agora && ocupadoNaTela()) { agendar(5000); return Promise.resolve(); }
    st.rodando = true; st.estado = "sincronizando"; avisar();
    let s = ler();
    const fim = (estado, msg) => {
      st.rodando = false; st.estado = estado; st.msg = msg || "";
      s = ler(); s.erro = estado === "erro" ? msg : null; if (estado === "ok") s.ultimo = new Date().toISOString(); gravar(s);
      avisar();
      if (st.denovo) { st.denovo = false; agendar(1200); }
    };
    return Promise.all([lerBase(), lerArquivo(s)]).then(([base, remoto]) => {
      if (!remoto) {
        // o arquivo sumiu depois de já ter sincronizado: o código foi trocado ou a conta encerrada
        if (base && !opc.criar) throw Object.assign(new Error("Esta conta não existe mais (o código foi trocado em outro aparelho). Entre com o código novo."), { tipo: "sumiu" });
        return { base, remoto: null, nuvem: null };
      }
      return decifrar(remoto.env, s.k).then((nuvem) => ({ base, remoto, nuvem }));
    }).then(({ base, remoto, nuvem }) => {
      const eu = idAparelho();
      const aparelhos = Object.assign({}, nuvem && nuvem.aparelhos);
      // este aparelho foi removido em outro
      if (aparelhos[eu] && aparelhos[eu].removido) { desconectado(aparelhos[eu].apagar); throw Object.assign(new Error("removido"), { tipo: "removido" }); }
      // chave do GitHub renovada em outro aparelho
      if (nuvem && nuvem.acesso && nuvem.acesso.t && nuvem.acesso.t !== s.t) { s.t = nuvem.acesso.t; delete s.expira; gravar(s); }
      const local = paraNuvem(App().dados());
      let junto;
      if (!nuvem) junto = local;
      else if (base && remoto && base.sha === remoto.sha) junto = local; // a nuvem não mudou desde a última vez
      else junto = umPerfil(juntar(base ? base.dados : undefined, local, nuvem.dados));
      if (!igual(junto, local)) aplicar(junto);
      const meu = aparelhos[eu];
      const vencido = !meu || !meu.visto || Date.now() - new Date(meu.visto).getTime() > VISTO_A_CADA || meu.nome !== (s.nome || nomePadrao()) || meu.versao !== App().VERSAO_APP;
      const mudou = !nuvem || !igual(junto, nuvem.dados);
      if (!mudou && !vencido && !opc.forcarEnvio) {
        st.aparelhos = aparelhos;
        return gravarBase({ sha: remoto.sha, dados: junto });
      }
      aparelhos[eu] = Object.assign({}, meu, registro(s));
      const pacote = { dados: junto, aparelhos, acesso: { t: s.t }, salvoEm: new Date().toISOString(), por: eu };
      return cifrar(pacote, s.k).then((env) => gravarArquivo(s, env, remoto && remoto.sha, `Meu Controle: sincroniza (${(s.nome || nomePadrao()).slice(0, 40)})`))
        .then((sha) => { st.aparelhos = aparelhos; return gravarBase({ sha, dados: junto }); });
    }).then(() => fim("ok")).catch((e) => {
      if (e.tipo === "conflito") { st.denovo = true; fim("ok"); return; } // outro aparelho gravou no meio: junta de novo
      if (e.tipo === "removido") return;
      fim(e.tipo === "rede" ? "offline" : "erro", e.tipo === "chave" ? "O código desta conta mudou em outro aparelho. Entre com o código novo." : e.message);
    });
  }

  // altera a lista de aparelhos direto na nuvem (remover, desconectar)
  function alterarNuvem(fn, tentativa) {
    const s = ler();
    return lerArquivo(s).then((remoto) => {
      if (!remoto) throw new Error("A conta não foi encontrada.");
      return decifrar(remoto.env, s.k).then((nuvem) => {
        fn(nuvem);
        return cifrar(nuvem, s.k).then((env) => gravarArquivo(s, env, remoto.sha, "Meu Controle: aparelhos")).then(() => { st.aparelhos = nuvem.aparelhos; });
      });
    }).catch((e) => { if (e.tipo === "conflito" && (tentativa || 0) < 3) return alterarNuvem(fn, (tentativa || 0) + 1); throw e; });
  }

  function limparLocal() {
    const s = ler();
    gravar({ disp: s.disp, nome: s.nome });
    st.aparelhos = null; st.estado = "parado";
    return gravarBase(null);
  }
  function desconectado(apagar) {
    limparLocal().then(() => {
      if (apagar && global.Trava) {
        // mesmo caminho do "Esqueci o PIN": apaga tudo deste aparelho
        try { Object.keys(localStorage).filter((k) => k.indexOf("meuControle") === 0).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignora */ }
        ["meu-controle-backup", BANCO].forEach((n) => { try { indexedDB.deleteDatabase(n); } catch (e) { /* ignora */ } });
        setTimeout(() => location.reload(), 600);
        return;
      }
      App().renderizar();
      UI.toast("Este aparelho foi desconectado da sincronização em outro aparelho.");
    });
  }

  // ---------------------------------------------------------------------
  // criar conta / entrar com código
  // ---------------------------------------------------------------------
  function criarConta(token, repo, nome) {
    return conferirAcesso(token.trim(), (repo || "meu-controle-dados").trim()).then((acc) => {
      const s = ler();
      Object.assign(s, { o: acc.o, r: acc.r, t: token.trim(), k: novaChave(), c: (A.novoId ? A.novoId() : Date.now().toString(36)) + Math.random().toString(36).slice(2, 8), nome: nome || s.nome || nomePadrao(), erro: null });
      gravar(s);
      return gravarBase(null).then(() => sincronizar({ agora: true, criar: true, forcarEnvio: true })).then(() => {
        if (st.estado !== "ok") { const msg = st.msg; limparLocal(); throw new Error(msg || "Não consegui criar a conta."); }
        return acc;
      });
    });
  }
  // modo: "juntar" (une os dados deste aparelho com os da conta) ou "conta" (fica só com os da conta)
  function entrar(codigo, modo, nome) {
    const c = lerCodigo(codigo);
    if (!c) return Promise.reject(new Error("Código inválido. Confira se copiou inteiro (começa com MC1.)."));
    const teste = Object.assign({}, c);
    return lerArquivo(teste).then((remoto) => {
      if (!remoto) throw new Error("Não encontrei esta conta. O código pode ter sido trocado.");
      return decifrar(remoto.env, c.k).catch(() => { throw new Error("Este código não abre a conta (foi trocado?)."); }).then((nuvem) => {
        const s = ler();
        Object.assign(s, { o: c.o, r: c.r, t: c.t, k: c.k, c: c.c, nome: nome || s.nome || nomePadrao(), erro: null });
        gravar(s);
        // aparelho novo (sem registros): fica com tudo da conta, inclusive nome, avatar e ajustes
        const vazio = !(global.Backup && global.Backup.temDados(App().dados()));
        if (modo === "conta" || vazio || App().dados().demo) { aplicar(nuvem.dados); return gravarBase({ sha: remoto.sha, dados: nuvem.dados }); }
        return gravarBase(null); // sem base: junta tudo (nada se perde)
      });
    }).then(() => sincronizar({ agora: true, forcarEnvio: true })).then(() => {
      if (st.estado === "erro") throw new Error(st.msg);
    });
  }
  // gera chave e arquivo novos: os outros aparelhos (inclusive um roubado) deixam de acessar
  function trocarCodigo(tokenNovo) {
    const s = ler();
    const antigo = Object.assign({}, s);
    let nuvemAtual = null, shaAntigo = null;
    return lerArquivo(antigo).then((remoto) => {
      if (!remoto) return null;
      shaAntigo = remoto.sha;
      return decifrar(remoto.env, antigo.k).then((n) => { nuvemAtual = n; });
    }).then(() => (tokenNovo ? conferirAcesso(tokenNovo.trim(), antigo.o + "/" + antigo.r) : Promise.resolve(null))).then(() => {
      const novo = Object.assign({}, antigo, { k: novaChave(), c: (A.novoId ? A.novoId() : Date.now().toString(36)) + Math.random().toString(36).slice(2, 8), t: tokenNovo ? tokenNovo.trim() : antigo.t });
      const eu = idAparelho();
      const pacote = { dados: paraNuvem(App().dados()), aparelhos: { [eu]: registro(novo) }, acesso: { t: novo.t }, salvoEm: new Date().toISOString(), por: eu };
      if (nuvemAtual) pacote.dados = umPerfil(juntar(undefined, pacote.dados, nuvemAtual.dados));
      return cifrar(pacote, novo.k).then((env) => gravarArquivo(novo, env, null, "Meu Controle: novo código")).then((sha) => {
        gravar(Object.assign(ler(), novo, { erro: null }));
        return gravarBase({ sha, dados: pacote.dados });
      }).then(() => shaAntigo ? apagarArquivo(antigo, shaAntigo).catch(() => {}) : null).then(() => { st.aparelhos = pacote.aparelhos; st.estado = "ok"; avisar(); });
    });
  }
  // renova a chave do GitHub (antes de vencer): os outros aparelhos recebem sozinhos
  function atualizarToken(token) {
    const s = ler();
    return conferirAcesso(token.trim(), s.o + "/" + s.r).then(() => {
      s.t = token.trim(); delete s.expira; s.erro = null; gravar(s);
      return sincronizar({ agora: true, forcarEnvio: true });
    });
  }

  // ---------------------------------------------------------------------
  // QR code (gerar e ler)
  // ---------------------------------------------------------------------
  const scripts = {};
  function carregarScript(src) {
    if (!scripts[src]) scripts[src] = new Promise((ok, erro) => { const t = document.createElement("script"); t.src = src; t.onload = ok; t.onerror = () => { delete scripts[src]; erro(new Error("não carregou")); }; document.head.appendChild(t); });
    return scripts[src];
  }
  function qrSVG(texto) {
    return carregarScript("js/vendor/qrcode.js").then(() => {
      const q = global.qrcode(0, "L"); q.addData(texto); q.make();
      return q.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
    });
  }
  let leitor = null;
  function pararLeitor() { if (leitor) { leitor.parar = true; if (leitor.stream) leitor.stream.getTracks().forEach((t) => t.stop()); leitor = null; } }
  function lerQR(video, aoLer) {
    pararLeitor();
    const l = leitor = { parar: false, stream: null };
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }).then((stream) => {
      l.stream = stream; video.srcObject = stream; video.setAttribute("playsinline", ""); video.muted = true;
      return video.play();
    }).then(() => {
      const usarNativo = "BarcodeDetector" in global;
      const det = usarNativo ? new global.BarcodeDetector({ formats: ["qr_code"] }) : null;
      return (usarNativo ? Promise.resolve() : carregarScript("js/vendor/jsQR.js")).then(() => {
        const cv = document.createElement("canvas"), g = cv.getContext("2d", { willReadFrequently: true });
        const passo = () => {
          if (l.parar) return;
          if (video.readyState < 2) { setTimeout(passo, 200); return; }
          const tentar = det ? det.detect(video).then((r) => r[0] && r[0].rawValue) : Promise.resolve().then(() => {
            const w = Math.min(640, video.videoWidth), h = Math.round(video.videoHeight * w / video.videoWidth);
            cv.width = w; cv.height = h; g.drawImage(video, 0, 0, w, h);
            const r = global.jsQR(g.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
            return r && r.data;
          });
          tentar.then((txt) => { if (l.parar) return; if (txt && lerCodigo(txt)) { pararLeitor(); aoLer(txt); } else setTimeout(passo, 250); }).catch(() => setTimeout(passo, 400));
        };
        passo();
      });
    });
  }

  // ---------------------------------------------------------------------
  // telas
  // ---------------------------------------------------------------------
  function quando(iso) {
    if (!iso) return "nunca";
    const d = new Date(iso), seg = (Date.now() - d.getTime()) / 1000;
    if (seg < 60) return "agora há pouco";
    if (seg < 3600) return `há ${Math.round(seg / 60)} min`;
    if (seg < 86400 && d.getDate() === new Date().getDate()) return "hoje às " + d.toTimeString().slice(0, 5);
    if (seg < 2 * 86400) return "ontem às " + d.toTimeString().slice(0, 5);
    return d.toLocaleDateString("pt-BR") + " às " + d.toTimeString().slice(0, 5);
  }
  function diasParaVencer(s) {
    if (!s.expira) return null;
    const t = Date.parse(s.expira.replace(" UTC", "Z").replace(" ", "T"));
    return isNaN(t) ? null : Math.floor((t - Date.now()) / 864e5);
  }
  function statusHTML(s) {
    const venc = diasParaVencer(s);
    const linhas = [];
    if (st.estado === "sincronizando") linhas.push(`<div class="sy-status"><span class="sy-gira">🔄</span><div><b>Sincronizando…</b></div></div>`);
    else if (st.estado === "erro" || s.erro) linhas.push(`<div class="sy-status erro"><span>⚠️</span><div><b>Não sincronizou</b><small>${esc(st.msg || s.erro)}</small></div></div>`);
    else if (st.estado === "offline") linhas.push(`<div class="sy-status"><span>📴</span><div><b>Sem internet</b><small>As alterações ficam guardadas e sobem quando a conexão voltar.</small></div></div>`);
    else linhas.push(`<div class="sy-status ok"><span>✅</span><div><b>Sincronizado</b><small>Última vez: ${quando(s.ultimo)} · repositório ${esc(s.o + "/" + s.r)}</small></div></div>`);
    if (venc != null && venc <= 30) linhas.push(`<div class="sy-status erro"><span>⏳</span><div><b>A chave do GitHub ${venc < 0 ? "venceu" : venc === 0 ? "vence hoje" : `vence em ${venc} ${venc === 1 ? "dia" : "dias"}`}</b><small>Crie uma chave nova no GitHub e toque em “Atualizar chave do GitHub”. Os outros aparelhos recebem sozinhos.</small></div></div>`);
    return linhas.join("");
  }
  function aparelhosHTML(s) {
    const lista = st.aparelhos ? Object.keys(st.aparelhos).map((id) => Object.assign({ id }, st.aparelhos[id])).filter((x) => !x.removido) : null;
    if (!lista) return `<p class="ajuda">Carregando a lista de aparelhos…</p>`;
    const eu = idAparelho();
    lista.sort((a, b) => (a.id === eu ? -1 : b.id === eu ? 1 : (b.visto || "").localeCompare(a.visto || "")));
    return `<div class="sy-aparelhos">${lista.map((x) => `<div class="sy-ap"><span class="sy-ap-ic">${/iPhone|Celular|Android/.test(x.nome) ? "📱" : /iPad|Tablet/.test(x.nome) ? "📲" : "💻"}</span>
      <div><b>${esc(x.nome || "Aparelho")}${x.id === eu ? ` <em>este aparelho</em>` : ""}</b><small>visto ${quando(x.visto)}</small></div>
      ${x.id === eu ? `<button class="btn pequeno" data-acao="sync-renomear">Renomear</button>` : `<button class="btn pequeno perigo" data-acao="sync-remover" data-id="${esc(x.id)}">Remover</button>`}</div>`).join("")}</div>`;
  }
  function cartaoAjustes() {
    const s = ler(), on = conectado();
    const corpo = on ? `${statusHTML(s)}
        <span class="ap-rot">Aparelhos conectados</span>
        <div id="syAparelhos">${aparelhosHTML(s)}</div>
        <div class="botoes-linha"><button class="btn pequeno primario" data-acao="sync-agora">🔄 Sincronizar agora</button><button class="btn pequeno" data-acao="sync-codigo">➕ Adicionar aparelho</button>
          <a class="btn pequeno" href="https://github.com/${esc(s.o)}/${esc(s.r)}/commits" target="_blank" rel="noopener">🕘 Histórico no GitHub</a></div>
        <details class="sy-mais"><summary>Mais opções</summary>
          <div class="botoes-linha"><button class="btn pequeno" data-acao="sync-token">🔑 Atualizar chave do GitHub</button><button class="btn pequeno" data-acao="sync-trocar">♻️ Trocar código (aparelho perdido)</button><button class="btn pequeno perigo" data-acao="sync-sair">Desconectar este aparelho</button></div>
        </details>`
      : `<div class="sy-status"><span>🔄</span><div><b>Use o app no celular e no computador com os mesmos dados</b><small>Os dados ficam num repositório privado do seu GitHub, criptografados com um código que só os seus aparelhos têm. Cada sincronização fica salva no histórico, como um backup.</small></div></div>
        <div class="botoes-linha"><button class="btn primario" data-acao="sync-criar">Criar conta de sincronização</button><button class="btn" data-acao="sync-entrar">Entrar com código</button></div>`;
    return UI.card({ titulo: "Sincronização", sub: on ? "entre os seus aparelhos, pelo GitHub" : "celular, tablet e computador juntos", id: "sec-sync", corpo: `<div class="pad">${corpo}
      <p class="ajuda">O código da conta funciona como uma senha: guarde só para você. Cada pessoa da família usa o próprio código.</p></div>` });
  }
  function atualizarCartao() {
    const c = document.getElementById("sec-sync");
    if (!c || UI.modalAberto()) return;
    const tmp = document.createElement("div"); tmp.innerHTML = cartaoAjustes();
    c.replaceWith(tmp.firstElementChild);
  }
  // pontinho no avatar do topo: sincronizando / erro
  function atualizarSelo() {
    document.documentElement.dataset.sync = !conectado() ? "" : st.estado === "erro" ? "erro" : st.estado === "sincronizando" ? "rodando" : "";
  }

  const INSTRUCOES = `<ol class="sy-passos">
    <li>No GitHub, crie um repositório <b>privado</b> chamado <code>meu-controle-dados</code> — <a href="https://github.com/new?name=meu-controle-dados&visibility=private" target="_blank" rel="noopener">abrir</a>.</li>
    <li>Crie uma chave de acesso (<em>fine-grained token</em>) — <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">abrir</a>: dê um nome, escolha a maior validade, em <b>Repository access</b> marque <b>Only select repositories</b> → <code>meu-controle-dados</code>, e em <b>Permissions → Contents</b> escolha <b>Read and write</b>. Clique em <b>Generate token</b>.</li>
    <li>Copie a chave (começa com <code>github_pat_</code>) e cole aqui. Ela fica só nos seus aparelhos.</li></ol>`;
  function abrirCriar() {
    const m = UI.abrirModal(`<h3>Criar conta de sincronização</h3>${INSTRUCOES}
      <div class="campo"><label for="sy_token">Chave do GitHub</label><input id="sy_token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></div>
      <div class="par"><div class="campo"><label for="sy_repo">Repositório</label><input id="sy_repo" value="meu-controle-dados" autocomplete="off" spellcheck="false"></div>
        <div class="campo"><label for="sy_nome">Nome deste aparelho</label><input id="sy_nome" value="${esc(ler().nome || nomePadrao())}" maxlength="40"></div></div>
      <p class="sy-erro" role="alert"></p>
      <div class="modal-acoes"><button class="btn" data-acao="fechar-modal">Cancelar</button><button class="btn primario" id="sy_ok">Criar conta</button></div>`, { largo: true });
    m.querySelector("#sy_ok").addEventListener("click", () => {
      const b = m.querySelector("#sy_ok"), err = m.querySelector(".sy-erro");
      const token = m.querySelector("#sy_token").value.trim();
      if (!/^(github_pat_|ghp_)[A-Za-z0-9_]+$/.test(token)) { err.textContent = "Cole a chave inteira — ela começa com github_pat_."; return; }
      b.disabled = true; b.textContent = "Conferindo…"; err.textContent = "";
      criarConta(token, m.querySelector("#sy_repo").value, m.querySelector("#sy_nome").value.trim()).then((acc) => {
        UI.fecharModal();
        UI.aposVoltar(() => mostrarCodigo(true, acc.privado ? "" : "⚠️ Atenção: o repositório é PÚBLICO. Os dados estão criptografados, mas o ideal é deixá-lo privado (Settings → Change visibility)."));
      }).catch((e) => { b.disabled = false; b.textContent = "Criar conta"; err.textContent = e.message; });
    });
  }
  function mostrarCodigo(recemCriado, aviso) {
    const pin = global.Trava && !recemCriado ? global.Trava.pedirPin("Para mostrar o código da conta.") : Promise.resolve(true);
    pin.then((ok) => {
      if (!ok) return;
      const s = ler(), codigo = codigoDe(s), link = linkDe(s);
      const abrir = () => {
        const m = UI.abrirModal(`<h3>${recemCriado ? "Conta criada! 🎉" : "Adicionar um aparelho"}</h3>
        ${aviso ? `<p class="sy-aviso">${esc(aviso)}</p>` : ""}
        <p class="ajuda" style="margin-top:0">No outro aparelho, abra o Meu Controle → <b>Ajustes → Sincronização → Entrar com código</b> e leia este QR code (ou cole o código).</p>
        <div class="sy-qr" id="syQR"><span class="ajuda">Gerando QR code…</span></div>
        <div class="campo"><label for="sy_cod">Código da conta</label><textarea id="sy_cod" rows="3" readonly spellcheck="false">${esc(codigo)}</textarea></div>
        <div class="botoes-linha"><button class="btn pequeno primario" id="sy_copiar">Copiar código</button>${navigator.share ? `<button class="btn pequeno" id="sy_comp">Enviar para mim</button>` : ""}</div>
        <p class="ajuda">🔐 Quem tiver este código vê e altera os seus dados. Mande só para você mesmo (por exemplo, numa conversa com você no WhatsApp) e apague depois.</p>
        <div class="modal-acoes"><button class="btn primario" data-acao="fechar-modal">Pronto</button></div>`, { largo: true, semFoco: true });
        qrSVG(link).then((svg) => { const q = m.querySelector("#syQR"); if (q) q.innerHTML = svg; }).catch(() => { const q = m.querySelector("#syQR"); if (q) q.innerHTML = `<span class="ajuda">Não consegui gerar o QR code — use o código abaixo.</span>`; });
        m.querySelector("#sy_copiar").addEventListener("click", () => {
          const t = m.querySelector("#sy_cod");
          (navigator.clipboard ? navigator.clipboard.writeText(codigo) : Promise.reject()).catch(() => { t.select(); document.execCommand("copy"); }).then(() => UI.toast("Código copiado."));
        });
        const comp = m.querySelector("#sy_comp");
        if (comp) comp.addEventListener("click", () => navigator.share({ title: "Código do Meu Controle", text: "Código da minha conta do Meu Controle (não compartilhe):\n" + codigo }).catch(() => {}));
      };
      if (recemCriado) abrir(); else UI.aposVoltar(abrir);
    });
  }
  function abrirEntrar(codigoInicial) {
    const temDados = global.Backup && global.Backup.temDados(App().dados());
    const m = UI.abrirModal(`<h3>Entrar com código</h3>
      <p class="ajuda" style="margin-top:0">No aparelho que já sincroniza: <b>Ajustes → Sincronização → Adicionar aparelho</b>. Leia o QR code com a câmera ou cole o código.</p>
      <div class="sy-camera" hidden><video muted playsinline></video><span class="sy-mira"></span></div>
      <div class="botoes-linha"><button class="btn" id="sy_ler">📷 Ler QR code</button></div>
      <div class="campo"><label for="sy_cod">Código da conta</label><textarea id="sy_cod" rows="3" spellcheck="false" autocomplete="off" placeholder="MC1.…">${esc(codigoInicial || "")}</textarea></div>
      <div class="campo"><label for="sy_nome">Nome deste aparelho</label><input id="sy_nome" value="${esc(ler().nome || nomePadrao())}" maxlength="40"></div>
      ${temDados ? `<span class="ap-rot">Este aparelho já tem registros</span>
        <div class="sy-modos"><label><input type="radio" name="sy_modo" value="juntar" checked><span><b>Juntar</b><small>Fica tudo: os registros deste aparelho e os da conta.</small></span></label>
        <label><input type="radio" name="sy_modo" value="conta"><span><b>Usar só os da conta</b><small>Os registros deste aparelho são substituídos (fica uma cópia de segurança).</small></span></label></div>` : ""}
      <p class="sy-erro" role="alert"></p>
      <div class="modal-acoes"><button class="btn" data-acao="fechar-modal">Cancelar</button><button class="btn primario" id="sy_ok">Entrar</button></div>`, { largo: true, semFoco: !!codigoInicial, aoFechar: pararLeitor });
    const cod = m.querySelector("#sy_cod"), err = m.querySelector(".sy-erro"), cam = m.querySelector(".sy-camera");
    m.querySelector("#sy_ler").addEventListener("click", () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { err.textContent = "Este navegador não deixa usar a câmera aqui. Cole o código."; return; }
      cam.hidden = false; err.textContent = "";
      lerQR(cam.querySelector("video"), (txt) => { cam.hidden = true; cod.value = (lerCodigo(txt) ? codigoDe(lerCodigo(txt)) : txt); UI.toast("QR code lido."); })
        .catch(() => { cam.hidden = true; err.textContent = "Não consegui abrir a câmera. Libere o acesso à câmera ou cole o código."; });
    });
    m.querySelector("#sy_ok").addEventListener("click", () => {
      const b = m.querySelector("#sy_ok");
      if (!lerCodigo(cod.value)) { err.textContent = "Código inválido. Confira se copiou inteiro (começa com MC1.)."; return; }
      const modoEl = m.querySelector("input[name=sy_modo]:checked");
      const modo = modoEl ? modoEl.value : "juntar";
      b.disabled = true; b.textContent = "Entrando…"; err.textContent = ""; pararLeitor();
      const copia = modo === "conta" && global.Backup && global.Backup.copiaDeSeguranca ? Promise.resolve(global.Backup.copiaDeSeguranca("antes de entrar na sincronização")).catch(() => {}) : Promise.resolve();
      copia.then(() => entrar(cod.value, modo, m.querySelector("#sy_nome").value.trim())).then(() => {
        UI.fecharModal(); App().renderizar(); UI.toast("Pronto! Este aparelho agora sincroniza com a sua conta.");
      }).catch((e) => { limparSeFalhou(); b.disabled = false; b.textContent = "Entrar"; err.textContent = e.message; });
    });
  }
  function limparSeFalhou() { const s = ler(); if (s.t && !s.ultimo) limparLocal(); }

  function pedirTexto(titulo, html, rotulo, aoOk) {
    const m = UI.abrirModal(`<h3>${titulo}</h3>${html}<p class="sy-erro" role="alert"></p>
      <div class="modal-acoes"><button class="btn" data-acao="fechar-modal">Cancelar</button><button class="btn primario" id="sy_ok">${rotulo}</button></div>`, { largo: true });
    const b = m.querySelector("#sy_ok"), err = m.querySelector(".sy-erro");
    b.addEventListener("click", () => {
      b.disabled = true; err.textContent = "";
      Promise.resolve(aoOk(m)).then((fechar) => { if (fechar !== false) UI.fecharModal(); else b.disabled = false; })
        .catch((e) => { b.disabled = false; err.textContent = e.message; });
    });
    return m;
  }

  App().registrarAcoes({
    "sync-criar": abrirCriar,
    "sync-entrar": () => abrirEntrar(),
    "sync-agora": () => { sincronizar({ agora: true, forcarEnvio: true }).then(() => { if (st.estado === "ok") UI.toast("Sincronizado."); }); },
    "sync-codigo": () => mostrarCodigo(false),
    "sync-renomear": () => pedirTexto("Nome deste aparelho", `<div class="campo"><input id="sy_nome" value="${esc(ler().nome || nomePadrao())}" maxlength="40"></div>`, "Salvar", (m) => {
      const s = ler(); s.nome = m.querySelector("#sy_nome").value.trim() || nomePadrao(); gravar(s);
      return sincronizar({ agora: true, forcarEnvio: true });
    }),
    "sync-remover": (el) => {
      const id = el.dataset.id, ap = (st.aparelhos || {})[id] || {};
      pedirTexto(`Remover “${esc(ap.nome || "aparelho")}”`, `<p>O aparelho deixa de sincronizar na próxima vez que abrir o app.</p>
        <label class="sy-check"><input type="checkbox" id="sy_apagar"> <span><b>Apagar os dados dele também</b><small>Use se o aparelho foi perdido ou roubado.</small></span></label>
        <p class="ajuda">Se ele foi roubado, use também <b>Trocar código</b> em “Mais opções”: aí ele perde o acesso mesmo que nunca mais abra o app.</p>`, "Remover", (m) => {
        const apagar = m.querySelector("#sy_apagar").checked;
        return alterarNuvem((n) => { n.aparelhos = n.aparelhos || {}; n.aparelhos[id] = Object.assign({}, n.aparelhos[id], { removido: true, apagar, removidoEm: new Date().toISOString() }); })
          .then(() => { atualizarCartao(); UI.toast("Aparelho removido."); });
      });
    },
    "sync-sair": () => pedirTexto("Desconectar este aparelho", `<p>Os dados continuam neste aparelho, mas param de sincronizar. Os outros aparelhos não são afetados.</p>`, "Desconectar", () => {
      const eu = idAparelho();
      return alterarNuvem((n) => { if (n.aparelhos) delete n.aparelhos[eu]; }).catch(() => {}).then(() => limparLocal()).then(() => { App().renderizar(); UI.toast("Este aparelho não sincroniza mais."); });
    }),
    "sync-token": () => pedirTexto("Atualizar chave do GitHub", `<p class="ajuda" style="margin-top:0">Crie uma chave nova (<a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">abrir</a>) com acesso ao repositório <code>${esc(ler().r)}</code> e <b>Contents: Read and write</b>. Os outros aparelhos recebem a chave nova sozinhos na próxima sincronização — desde que a antiga ainda não tenha vencido.</p>
      <div class="campo"><label for="sy_token">Chave nova</label><input id="sy_token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></div>`, "Atualizar", (m) => {
      const t = m.querySelector("#sy_token").value.trim();
      if (!/^(github_pat_|ghp_)/.test(t)) throw new Error("Cole a chave inteira — ela começa com github_pat_.");
      return atualizarToken(t).then(() => { if (st.estado === "erro") throw new Error(st.msg); UI.toast("Chave atualizada."); });
    }),
    "sync-trocar": () => {
      const pin = global.Trava ? global.Trava.pedirPin("Para trocar o código da conta.") : Promise.resolve(true);
      pin.then((ok) => {
        if (!ok) return;
        UI.aposVoltar(() => pedirTexto("Trocar código", `<p>Cria um código novo e encerra o antigo. <b>Todos os outros aparelhos</b> param de sincronizar e precisam ler o código novo — use quando um aparelho for perdido ou roubado.</p>
          <p class="ajuda">Para garantir, apague também a chave antiga no GitHub (<a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noopener">abrir</a>), crie outra e cole abaixo. Sem chave nova, o aparelho perdido ainda conseguiria apagar o arquivo, embora não consiga mais ler os dados.</p>
          <div class="campo"><label for="sy_token">Chave nova do GitHub (recomendado)</label><input id="sy_token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_… (opcional)"></div>`, "Trocar código", (m) => {
          const t = m.querySelector("#sy_token").value.trim();
          return trocarCodigo(t || null).then(() => { UI.fecharModal(); UI.aposVoltar(() => mostrarCodigo(true, "Código novo criado. Leia este QR code em cada aparelho que deve continuar sincronizando.")); return false; });
        }));
      });
    }
  });

  // ---------------------------------------------------------------------
  // quando sincronizar
  // ---------------------------------------------------------------------
  App().aoSalvar((d, abertura) => {
    if (aplicando || !conectado()) return;
    agendar(abertura ? 1200 : 4000);
  });
  App().aoRenderizar((d, rota) => {
    if (rota && rota.secao === "configuracoes" && conectado() && !st.aparelhos && !st.rodando) agendar(300);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !conectado()) return;
    const s = ler();
    if (!s.ultimo || Date.now() - new Date(s.ultimo).getTime() > 30000) agendar(600);
  });
  global.addEventListener("online", () => agendar(800));
  setInterval(() => { if (document.visibilityState === "visible" && conectado()) sincronizar(); }, 90000);

  // link do QR code (#sync=MC1.…): abre "Entrar com código" já preenchido
  let codigoDoLink = null;
  const mh = location.hash.match(/^#sync=(MC1\.[A-Za-z0-9_-]+)/);
  if (mh) { codigoDoLink = mh[1]; try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignora */ } }
  document.addEventListener("DOMContentLoaded", () => {
    if (!codigoDoLink) return;
    const tentar = (n) => setTimeout(() => {
      if (document.documentElement.classList.contains("travado") || UI.modalAberto()) { if (n < 120) tentar(n + 1); return; }
      if (conectado()) { UI.toast("Este aparelho já sincroniza com uma conta."); return; }
      App().ir("configuracoes", "sync");
      setTimeout(() => abrirEntrar(codigoDoLink), 400);
    }, n ? 1000 : 1500);
    tentar(0);
  });

  global.Sync = { conectado, sincronizar, cartaoAjustes, codigoDe, lerCodigo, juntar, cifrar, decifrar, estado: st, ler, criarConta, entrar, trocarCodigo, abrirEntrar };
})(window);
