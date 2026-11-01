/* Service worker — deixa o app abrir sem internet no celular/tablet.
   Arquivos do app: cache primeiro; a página: rede primeiro (cai no cache offline). */
const CACHE = "meu-controle-v21";
// a imagem do avatar escolhido (quando é um endereço) — o próprio app guarda aqui
const CACHE_IMG = "meu-controle-avatar";
const V = "?v=3.6.0";
const MODULOS = ["nucleo", "armazenamento", "demo", "alimentacao", "compras", "fitness", "bemestar", "metas", "insights", "conquistas", "relatorios", "graficos", "ui", "app", "personalizar", "areas", "instalar", "backup", "lembretes", "avatar", "primeiro-uso", "tutorial", "trava", "sync", "agenda", "formularios", "formularios-saude", "paginas/dashboard", "paginas/alimentacao", "paginas/compras", "paginas/academia", "paginas/bemestar", "paginas/evolucao", "paginas/metas", "paginas/relatorios", "paginas/configuracoes"];
const ARQUIVOS = [
  "./", "./index.html", "./css/style.css" + V, "./css/saude.css" + V, "./css/extras.css" + V, "./manifest.json", "./favicon.svg", "./favicon-32.png",
  "./js/vendor/chart.umd.min.js",
  "./assets/icons/icon-192.png", "./assets/icons/icon-512.png",
  "./apple-touch-icon.png", "./apple-touch-icon-180.png", "./apple-touch-icon-167.png", "./apple-touch-icon-152.png", "./apple-touch-icon-precomposed.png"
].concat(MODULOS.map((m) => "./js/" + m + ".js" + V));
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== CACHE_IMG).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // imagens de avatar (MyAnimeList): o avatar escolhido sai do cache (funciona sem
  // internet); as da galeria vêm direto da rede, sem passar por aqui
  if (url.origin !== location.origin) {
    if (e.request.destination === "image" && /(^|\.)(myanimelist\.net|anilist\.co)$/.test(url.hostname)) {
      e.respondWith(caches.open(CACHE_IMG).then((c) => c.match(e.request.url)).then((r) => r || fetch(e.request)));
    }
    return;
  }
  // lista de personagens (atualizada toda semana): responde do cache na hora e atualiza por trás
  if (url.pathname.endsWith("/dados/personagens.json")) {
    e.respondWith(caches.open(CACHE).then((c) => c.match(url.pathname).then((r) => {
      const rede = fetch(e.request).then((resp) => { if (resp.ok) c.put(url.pathname, resp.clone()); return resp; });
      if (r) { e.waitUntil(rede.catch(() => {})); return r; }
      return rede;
    })));
    return;
  }
  const ehPagina = e.request.mode === "navigate" || (e.request.destination === "document");
  if (ehPagina) {
    e.respondWith(fetch(e.request).then((resp) => { const cp = resp.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return resp; }).catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html"))));
    return;
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => { const cp = resp.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return resp; })));
});
// toque numa notificação de lembrete: abre (ou traz para a frente) o app na tela certa
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const rota = (e.notification.data && e.notification.data.rota) || "dashboard";
  const alvo = new URL("./index.html#/" + rota, self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
    const aberto = lista.find((c) => c.url.indexOf(self.registration.scope) === 0);
    if (aberto) { aberto.navigate ? aberto.navigate(alvo).catch(() => {}) : null; return aberto.focus(); }
    return self.clients.openWindow(alvo);
  }));
});
