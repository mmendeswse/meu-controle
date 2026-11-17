/**
 * produtos.js
 * -----------------------------------------------------------------------
 * Alimentação → aba "Produtos": o caderno de marcas e rótulos para a hora
 * da compra. Cada produto tem marca, embalagem, preço, onde comprar, uma
 * avaliação (⭐ preferido, 👍 bom, 🚫 não comprar), observações e a foto do
 * rótulo. Pode ser ligado a um alimento do cadastro: aí a marca preferida
 * aparece ao lado do item na lista de compras.
 *
 * Os dados ficam em d.produtos (entram no backup e na sincronização); a
 * foto do rótulo fica só neste aparelho (imagens.js, chave "prod:<id>").
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo, UI = global.UI, AL = global.Alimentacao, C = global.Compras, IM = global.Imagens;
  const esc = UI.esc;
  const App = () => global.App;
  const AVAL = [{ k: "preferido", r: "⭐ Preferido", curto: "⭐ preferido" }, { k: "bom", r: "👍 Bom", curto: "👍 bom" }, { k: "evitar", r: "🚫 Não comprar", curto: "🚫 não comprar" }];
  const st = { busca: "", filtro: "" };
  const chave = (p) => "prod:" + p.id;
  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

  function ordenados(d) {
    const peso = { preferido: 0, bom: 1, evitar: 2 };
    return (d.produtos || []).slice().sort((a, b) => (peso[a.avaliacao] - peso[b.avaliacao]) || norm(a.nome).localeCompare(norm(b.nome)));
  }
  // produtos de um item da lista: pelo alimento ligado ou pelo mesmo nome
  function doItem(d, alimentoId, nome) {
    const n = norm(nome);
    return ordenados(d).filter((p) => (alimentoId && p.alimentoId === alimentoId) || (!p.alimentoId && n && norm(p.nome) === n));
  }
  function preferido(d, alimentoId, nome) { return doItem(d, alimentoId, nome).find((p) => p.avaliacao === "preferido") || null; }
  // preço por kg / litro, quando a embalagem tem quantidade e unidade
  function precoBase(p) {
    if (!N.temValor(p.preco) || !N.temValor(p.qtd) || !p.qtd) return null;
    const fam = N.familia(p.unidade);
    if (fam === "massa") return { v: p.preco / N.converter(p.qtd, p.unidade, "kg"), un: "kg" };
    if (fam === "volume") return { v: p.preco / N.converter(p.qtd, p.unidade, "L"), un: "L" };
    return p.qtd !== 1 ? { v: p.preco / p.qtd, un: p.unidade } : null;
  }
  const embalagem = (p) => N.temValor(p.qtd) && p.qtd ? N.qtdLegivel(p.qtd, p.unidade) : "";
  const foto = (p, classe) => `<span class="pd-foto ${classe || ""}" data-sem-foto>${p.temFoto ? `<img data-img="${chave(p)}" alt="Rótulo de ${esc(p.nome)}" loading="lazy">` : ""}<span class="pd-semfoto">${p.temFoto ? "📷" : AL.emojiAlimento(p.alimentoId ? AL.alimento(App().dados(), p.alimentoId) : { categoria: p.categoria })}</span></span>`;

  function cartao(d, p) {
    const pb = precoBase(p), av = AVAL.find((x) => x.k === p.avaliacao) || AVAL[1];
    const al = p.alimentoId ? AL.alimento(d, p.alimentoId) : null;
    return `<article class="pd-card av-${av.k}">
      <button class="pd-abrir" data-acao="produto-ver" data-id="${p.id}" aria-label="Ver ${esc(p.nome)}">${foto(p)}
        <span class="pd-txt"><b>${esc(p.nome)}</b><small>${[p.marca, embalagem(p)].filter(Boolean).map(esc).join(" · ") || "sem marca"}</small>
          <span class="pd-linha"><span class="pd-selo">${av.curto}</span>${N.temValor(p.preco) ? `<span class="pd-preco">${UI.brl(p.preco)}${pb ? `<small> · ${UI.brl(pb.v)}/${pb.un}</small>` : ""}</span>` : ""}</span>
          ${p.mercado || al ? `<small class="pd-onde">${[p.mercado ? "📍 " + esc(p.mercado) : "", al ? "↔ " + esc(al.nome) : ""].filter(Boolean).join(" · ")}</small>` : ""}</span></button>
      ${p.avaliacao === "evitar" ? "" : `<button class="btn pequeno pd-lista" data-acao="produto-lista" data-id="${p.id}" title="Pôr na lista de compras deste mês">${UI.svg("carrinho")}<span class="btn-txt">Lista</span></button>`}
    </article>`;
  }
  function aba(d) {
    const todos = ordenados(d), b = norm(st.busca);
    const lista = todos.filter((p) => (!st.filtro || p.avaliacao === st.filtro) && (!b || norm(p.nome + " " + (p.marca || "") + " " + (p.mercado || "") + " " + (p.obs || "")).indexOf(b) !== -1));
    if (!todos.length) return `<div class="grid"><div class="c12">${UI.card({ titulo: "Produtos e marcas", corpo: UI.vazio({ icone: "🏷️", titulo: "Seu caderno de marcas está vazio.", texto: "Guarde aqui os produtos que você compra: a marca que gostou, a foto do rótulo, o preço e onde achou. Na hora da compra, a marca preferida aparece ao lado do item na lista.", acao: "novo-produto", rotulo: "Adicionar produto" }) })}</div></div>`;
    const n = (k) => todos.filter((p) => p.avaliacao === k).length;
    return `<div class="grid"><div class="c12">${UI.card({ titulo: "Produtos e marcas", sub: `${todos.length} ${UI.plural(todos.length, "produto", "produtos")} · o que comprar (e o que não comprar de novo)`,
      acoes: UI.botao("novo-produto", "Produto", { classe: "primario", icone: "mais" }),
      corpo: `<div class="filtros-linha"><label class="busca">${UI.svg("buscar")}<input type="search" placeholder="Buscar produto, marca ou mercado" value="${esc(st.busca)}" data-digitar="busca-produto" aria-label="Buscar produto"></label>
        <div class="chips-filtro"><button class="${!st.filtro ? "ativo" : ""}" data-acao="filtro-produto" data-k="">Todos</button>${AVAL.filter((a) => n(a.k)).map((a) => `<button class="${st.filtro === a.k ? "ativo" : ""}" data-acao="filtro-produto" data-k="${a.k}">${a.r} <small>${n(a.k)}</small></button>`).join("")}</div></div>
        <div id="gradeProdutos">${grade(d, lista)}</div>` })}</div></div>
      <p class="ajuda">As fotos dos rótulos ficam só neste aparelho; o resto (marca, preço, avaliação) entra no backup e na sincronização.</p>`;
  }
  function grade(d, lista) { return lista.length ? `<div class="pd-grade">${lista.map((p) => cartao(d, p)).join("")}</div>` : `<div class="vazio"><p>Nenhum produto com esse filtro.</p></div>`; }

  // ---------------------------------------------------------------------
  // ver e editar
  // ---------------------------------------------------------------------
  function ver(id) {
    const d = App().dados(), p = d.produtos.find((x) => x.id === id);
    if (!p) return;
    const pb = precoBase(p), av = AVAL.find((x) => x.k === p.avaliacao) || AVAL[1], al = p.alimentoId ? AL.alimento(d, p.alimentoId) : null;
    const kv = (r, v) => v ? `<div class="kv"><span>${r}</span><b>${v}</b></div>` : "";
    const m = UI.abrirModal(`<div class="pd-ver" data-sem-deslize>
      ${p.temFoto ? `<div class="pd-ver-img">${foto(p, "inteira")}</div>` : ""}
      <h3>${esc(p.nome)}</h3><p class="pd-ver-sub"><span class="pd-selo av-${av.k}">${av.r}</span> ${esc(p.marca || "")}</p>
      ${kv("Embalagem", esc(embalagem(p)))}${kv("Preço", N.temValor(p.preco) ? UI.brl(p.preco) + (pb ? ` <small class="dim">(${UI.brl(pb.v)}/${pb.un})</small>` : "") : "")}
      ${kv("Onde comprar", esc(p.mercado || ""))}${kv("Alimento do cadastro", al ? esc(al.nome) : "")}${kv("Código de barras", esc(p.codigo || ""))}
      ${p.obs ? `<p class="pd-obs">“${esc(p.obs)}”</p>` : ""}
      <div class="modal-acoes">${p.avaliacao === "evitar" ? "" : `<button class="btn primario" data-acao="produto-lista" data-id="${p.id}">${UI.svg("carrinho")}Pôr na lista</button>`}<button class="btn" data-acao="editar-produto" data-id="${p.id}">${UI.svg("editar")}Editar</button><button class="btn" data-acao="fechar-modal">Fechar</button></div></div>`, { semFoco: true });
    m.classList.add("modal-produto");
  }
  function formulario(id, base) {
    const d = App().dados(), p = id ? d.produtos.find((x) => x.id === id) : null;
    base = base || {};
    let blob = null, tirarFoto = false, aval = p ? p.avaliacao : "preferido";
    const v = (k, pad) => p ? (p[k] == null ? "" : p[k]) : (base[k] == null ? (pad || "") : base[k]);
    const alIni = (p ? p.alimentoId : base.alimentoId) ? AL.alimento(d, p ? p.alimentoId : base.alimentoId) : null;
    const m = UI.abrirModal(`<div id="prodRaiz"><h3>${p ? "Editar produto" : "Novo produto"}</h3>
      <div class="pd-form-foto"><div id="pdPrevia">${p && p.temFoto ? foto(p, "media") : `<span class="pd-foto media"><span class="pd-semfoto">🏷️</span></span>`}</div>
        <div><b>Foto do rótulo</b><small>A frente da embalagem ou a tabela nutricional — para reconhecer na prateleira.</small>
          <span class="botoes-linha"><label class="btn pequeno primario">Tirar foto<input type="file" accept="image/*" capture="environment" hidden></label><label class="btn pequeno">Galeria<input type="file" accept="image/*" hidden></label>${p && p.temFoto ? `<button class="btn pequeno fantasma" id="pdSemFoto" type="button">Remover</button>` : ""}</span></div></div>
      <div class="par">
        <div class="campo"><label for="pd_nome">Produto</label><input id="pd_nome" value="${esc(v("nome", alIni ? alIni.nome : ""))}" placeholder="ex.: Iogurte natural integral" maxlength="80"></div>
        <div class="campo"><label for="pd_marca">Marca</label><input id="pd_marca" value="${esc(v("marca"))}" placeholder="ex.: Nestlé" maxlength="50" list="pd_marcas" autocomplete="off">
          <datalist id="pd_marcas">${Array.from(new Set(d.produtos.map((x) => x.marca).filter(Boolean))).sort().map((x) => `<option value="${esc(x)}">`).join("")}</datalist></div>
      </div>
      <div class="campo"><label>Avaliação</label><div id="pdAval"></div></div>
      <div class="par3">
        <div class="campo"><label for="pd_qtd">Embalagem</label><input id="pd_qtd" type="number" inputmode="decimal" step="any" min="0" value="${v("qtd")}" placeholder="ex.: 170"></div>
        <div class="campo"><label for="pd_un">Unidade</label><select id="pd_un">${UI.opcoes(N.UNIDADES_COMPRA, v("unidade", alIni ? alIni.unidade : "g"))}</select></div>
        <div class="campo"><label for="pd_preco">Preço (R$)</label><input id="pd_preco" type="number" inputmode="decimal" step="0.01" min="0" value="${v("preco")}"></div>
      </div>
      <div class="par">
        <div class="campo"><label for="pd_mercado">Onde comprar</label><input id="pd_mercado" value="${esc(v("mercado"))}" placeholder="mercado, loja ou site" list="pd_mercados" autocomplete="off" maxlength="50">
          <datalist id="pd_mercados">${Array.from(new Set(N.MERCADOS.concat(d.produtos.map((x) => x.mercado), d.compras.map((x) => x.mercado)).filter(Boolean))).map((x) => `<option value="${esc(x)}">`).join("")}</datalist></div>
        ${UI.campoAlimento("pd_alimento", d, alIni ? alIni.nome : "", `Alimento do cadastro ${UI.dica("Opcional. Ligando o produto a um alimento, a marca preferida aparece ao lado dele na lista de compras.")}`)}
      </div>
      <div class="par">
        <div class="campo"><label for="pd_codigo">Código de barras</label><input id="pd_codigo" inputmode="numeric" value="${esc(v("codigo"))}" placeholder="opcional" maxlength="20"></div>
        <div class="campo"><label for="pd_obs">Observações</label><input id="pd_obs" value="${esc(v("obs"))}" placeholder="ex.: menos açúcar que os outros" maxlength="160"></div>
      </div>
      ${UI.botoesModal(!!p)}</div>`, { largo: true, semFoco: true });
    const raiz = m.querySelector("#prodRaiz");
    const desenharAval = () => { raiz.querySelector("#pdAval").innerHTML = global.Personalizar.seg("pd-aval", AVAL, aval); };
    desenharAval();
    raiz.addEventListener("click", (e) => {
      const b = e.target.closest("[data-acao='pd-aval']"); if (b) { aval = b.dataset.k; desenharAval(); return; }
      if (e.target.closest("#pdSemFoto")) { tirarFoto = true; blob = null; raiz.querySelector("#pdPrevia").innerHTML = `<span class="pd-foto media"><span class="pd-semfoto">🏷️</span></span>`; }
    });
    raiz.addEventListener("change", (e) => {
      const arq = e.target.type === "file" && e.target.files[0];
      if (!arq) return;
      IM.reduzir(arq, 1400, 0.8).then((b) => { blob = b; tirarFoto = false; raiz.querySelector("#pdPrevia").innerHTML = `<span class="pd-foto media"><img class="carregada" src="${URL.createObjectURL(b)}" alt="Prévia do rótulo"></span>`; }).catch((err) => UI.toast(err.message));
    });
    raiz.querySelector("#btnSalvar").onclick = () => {
      const nome = UI.texto("pd_nome");
      if (!nome) { UI.toast("Dê um nome ao produto."); return; }
      const nomeAl = norm(UI.valor("pd_alimento")), al = nomeAl ? d.alimentos.find((a) => norm(a.nome) === nomeAl) : null;
      if (nomeAl && !al) { UI.toast("Não achei esse alimento no cadastro — escolha um da lista ou deixe em branco."); return; }
      const reg = { nome, marca: UI.texto("pd_marca"), avaliacao: aval, qtd: UI.numero("pd_qtd"), unidade: UI.valor("pd_un"), preco: UI.numero("pd_preco"), mercado: UI.texto("pd_mercado"),
        alimentoId: al ? al.id : null, categoria: al ? al.categoria : (p ? p.categoria : "Outros"), codigo: UI.texto("pd_codigo"), obs: UI.texto("pd_obs") };
      const alvo = p || Object.assign({ id: N.novoId(), criadoEm: new Date().toISOString(), temFoto: false }, reg);
      const btn = raiz.querySelector("#btnSalvar"); btn.disabled = true;
      const img = blob ? IM.salvar(chave(alvo), blob).then(() => true) : tirarFoto ? IM.apagar(chave(alvo)).then(() => false, () => false) : Promise.resolve(alvo.temFoto);
      img.then((tem) => {
        if (p) Object.assign(p, reg); else d.produtos.push(alvo);
        alvo.temFoto = !!tem;
        UI.fecharModal();
        App().salvar(p ? "Produto atualizado." : "Produto guardado.", { semIntegracao: true });
        if (!p && (App().rota().secao !== "alimentacao" || App().rota().param !== "produtos")) App().ir("alimentacao", "produtos");
      }).catch((err) => { btn.disabled = false; UI.toast(err.message || "Não consegui guardar a foto do rótulo."); });
    };
    if (p) raiz.querySelector("#btnExcluir").onclick = () => UI.confirmar({ titulo: "Excluir produto", texto: `Excluir “${p.nome}” do seu caderno de marcas?`, rotulo: "Excluir",
      aoConfirmar: () => App().comDesfazer("Produto excluído.", () => { const dd = App().dados(); dd.produtos = dd.produtos.filter((x) => x.id !== p.id); }) });
  }
  // põe o produto na lista de compras do mês (uma vez só)
  function paraLista(id) {
    const d = App().dados(), p = d.produtos.find((x) => x.id === id);
    if (!p) return;
    const al = p.alimentoId ? AL.alimento(d, p.alimentoId) : null, nome = al ? al.nome : p.nome, mes = C.mesAtual();
    const ja = d.compras.find((c) => c.status === "Pendente" && C.mesDaCompra(c) === mes && ((al && c.alimentoId === al.id) || norm(c.nome) === norm(nome)));
    UI.fecharModal();
    if (ja) { UI.toast(`“${nome}” já está na lista deste mês.`); return; }
    const item = { id: N.novoId(), usuarioId: d.usuarios[0].id, origem: "manual", auto: false, motivo: "", criadoEm: N.hoje(0), dataPrevista: null,
      nome, alimentoId: al ? al.id : null, categoria: al ? al.categoria : p.categoria || "Outros", quantidade: p.qtd || 1, unidade: p.qtd ? p.unidade : "un",
      precoEstimado: N.temValor(p.preco) ? p.preco : null, precoPago: null, mercado: p.mercado || "", prioridade: "Normal", status: "Pendente", dataCompra: null,
      obs: [p.marca, p.nome !== nome ? p.nome : ""].filter(Boolean).join(" — "), mes };
    App().comDesfazer(`“${nome}”${p.marca ? " (" + p.marca + ")" : ""} entrou na lista de compras.`, () => { d.compras.push(item); C.aoMudarStatusCompra(d, item, "Pendente"); });
  }
  // etiqueta na linha da lista de compras: a marca preferida daquele item
  function etiqueta(d, c) {
    if (!(d.produtos || []).length) return "";
    const ps = doItem(d, c.alimentoId, c.nome);
    if (!ps.length) return "";
    const p = ps.find((x) => x.avaliacao === "preferido") || ps.find((x) => x.avaliacao === "bom");
    if (!p) return `<span class="tag tag-prod evitar" data-acao="produto-ver" data-id="${ps[0].id}" role="button" tabindex="0" title="Ver o produto">🚫 ${esc(ps[0].marca || ps[0].nome)}</span>`;
    return `<span class="tag tag-prod" data-acao="produto-ver" data-id="${p.id}" role="button" tabindex="0" title="Ver a marca e o rótulo">${p.avaliacao === "preferido" ? "⭐" : "👍"} ${esc(p.marca || p.nome)}${p.temFoto ? " 📷" : ""}</span>`;
  }

  App().registrarAcoes({
    "novo-produto": (el) => formulario(null, el && el.dataset.alimento ? { alimentoId: el.dataset.alimento } : null),
    "editar-produto": (el) => formulario(el.dataset.id),
    "produto-ver": (el) => ver(el.dataset.id),
    "produto-lista": (el) => paraLista(el.dataset.id),
    "filtro-produto": (el) => { st.filtro = el.dataset.k; App().renderizar(); }
  });
  App().registrarMudancas({
    "busca-produto": (el) => {
      st.busca = el.value;
      const d = App().dados(), b = norm(st.busca), cx = document.getElementById("gradeProdutos");
      if (!cx) return;
      cx.innerHTML = grade(d, ordenados(d).filter((p) => (!st.filtro || p.avaliacao === st.filtro) && (!b || norm(p.nome + " " + (p.marca || "") + " " + (p.mercado || "") + " " + (p.obs || "")).indexOf(b) !== -1)));
      IM.preencher(cx);
    }
  });

  global.Produtos = { AVAL, aba, ordenados, doItem, preferido, etiqueta, precoBase };
})(window);
