/**
 * ux.js
 * -----------------------------------------------------------------------
 * Detalhes de experiência no estilo dos apps de saúde:
 *  - transição entre telas: a tela nova desliza para o lado (indo para
 *    frente ou voltando no menu) e as abas trocam com um esmaecer rápido;
 *  - no celular, ao rolar, o título grande da tela "sobe" para a barra do
 *    topo (como no app Saúde do iPhone);
 *  - toque nas abas com um "pulinho" do ícone e vibração curta.
 * Tudo respeita "Animações" desligado em Ajustes e a preferência do
 * sistema por menos movimento.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const App = () => global.App;
  const html = document.documentElement;
  const calmo = () => html.classList.contains("sem-animacao") || (global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // ordem das telas no menu (para saber se a navegação vai "para frente" ou "para trás")
  const ORDEM = ["dashboard", "alimentacao", "academia", "evolucao", "bemestar", "compras", "metas", "relatorios", "configuracoes"];
  const SUBTELAS = { treino: "academia" };
  function posicao(r) {
    if (!r) return -1;
    const base = SUBTELAS[r.secao];
    return base ? ORDEM.indexOf(base) + 0.5 : ORDEM.indexOf(r.secao);
  }

  let anterior = null, primeira = true;
  App().aoRenderizar((d, rota) => {
    const atual = { secao: rota.secao, param: rota.param || null };
    const de = anterior;
    anterior = atual;
    tituloTopo(true);
    if (primeira) { primeira = false; return; }
    if (!de || calmo()) return;
    let tipo = null;
    if (de.secao !== atual.secao) tipo = posicao(atual) >= posicao(de) ? "frente" : "tras";
    else if (de.param !== atual.param) tipo = "aba";
    if (!tipo) return;
    const c = document.getElementById("conteudo");
    c.classList.remove("entra-frente", "entra-tras", "entra-aba");
    void c.offsetWidth; // reinicia a animação
    c.classList.add("entra-" + tipo);
    clearTimeout(c._fimAnim);
    c._fimAnim = setTimeout(() => c.classList.remove("entra-" + tipo), 420);
  });

  // ---------------------------------------------------------------------
  // título que sobe para a barra do topo ao rolar (celular)
  // ---------------------------------------------------------------------
  let el = null, pendente = false;
  function garantir() {
    if (el) return el;
    const barra = document.getElementById("sidebar");
    if (!barra) return null;
    el = document.createElement("span");
    el.className = "titulo-topo"; el.setAttribute("aria-hidden", "true");
    barra.appendChild(el);
    return el;
  }
  function tituloTopo(novaTela) {
    if (pendente && !novaTela) return;
    pendente = true;
    requestAnimationFrame(() => {
      pendente = false;
      const t = garantir();
      if (!t) return;
      const h1 = document.querySelector("#conteudo .cabecalho-pagina h1, #conteudo .cab-hoje h1");
      if (novaTela && h1) {
        const copia = h1.cloneNode(true);
        copia.querySelectorAll("button").forEach((b) => b.remove());
        t.textContent = copia.textContent.trim();
      }
      const barra = document.getElementById("sidebar");
      const limite = barra ? barra.getBoundingClientRect().bottom : 60;
      const rolou = !!h1 && global.matchMedia("(max-width: 860px)").matches && h1.getBoundingClientRect().bottom < limite + 4;
      html.classList.toggle("titulo-rolado", rolou);
    });
  }
  global.addEventListener("scroll", () => tituloTopo(false), { passive: true });
  global.addEventListener("resize", () => tituloTopo(false), { passive: true });

  // ---------------------------------------------------------------------
  // abas: pulinho do ícone e vibração curta
  // ---------------------------------------------------------------------
  document.addEventListener("click", (e) => {
    const b = e.target.closest("#tabBar button");
    if (!b) return;
    const ap = (App().dados() && App().dados().config.aparencia) || {};
    if (ap.vibrar !== false && navigator.vibrate) { try { navigator.vibrate(6); } catch (x) { /* sem suporte */ } }
    if (calmo()) return;
    b.classList.remove("pulo"); void b.offsetWidth; b.classList.add("pulo");
    setTimeout(() => b.classList.remove("pulo"), 400);
  }, true);

  global.UX = { tituloTopo };
})(window);
