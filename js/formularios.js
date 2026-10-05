/**
 * formularios.js
 * -----------------------------------------------------------------------
 * Todos os formulários (modais) do sistema. Ficam num módulo só porque
 * são usados por várias páginas e pelo botão "+" de registro rápido.
 *
 * Regra geral: o formulário lê os campos, valida, altera App.dados() e
 * chama App.salvar(). Campos vazios ficam null — nada é obrigatório além
 * do mínimo para o registro fazer sentido.
 * -----------------------------------------------------------------------
 */
(function () {
  "use strict";

  const N = window.Nucleo;
  const UI = window.UI;
  const AL = window.Alimentacao;
  const C = window.Compras;
  const F = window.Fitness;
  const M = window.Metas;
  const esc = UI.esc;
  const D = () => window.App.dados();
  const salvar = (msg, o) => window.App.salvar(msg, o);
  const achar = (lista, id) => lista.find((x) => x.id === id) || null;

  function confirmarExclusao(texto, fn) {
    UI.confirmar({ titulo: "Excluir", texto, rotulo: "Excluir", aoConfirmar: fn });
  }
  function unidadesCompativeis(un, lista) {
    return (lista || N.UNIDADES_COMPRA).filter((u) => N.compativeis(u, un));
  }
  // acha o alimento pelo nome; se não existir, cria um cadastro mínimo
  function resolverAlimento(d, nome, unidade) {
    const a = AL.alimentoPorNome(d, nome);
    if (a) return { alimento: a, novo: false };
    const base = { kg: "g", L: "ml", dz: "un" }[unidade] || unidade || "g";
    const novo = AL.novoAlimento({ nome: nome.trim(), unidade: N.UNIDADES_ALIMENTO.indexOf(base) !== -1 ? base : "porção" });
    d.alimentos.push(novo);
    return { alimento: novo, novo: true };
  }
  function tipoPelaHora() {
    const h = new Date().getHours();
    if (h < 10) return "Café da manhã";
    if (h < 12) return "Lanche da manhã";
    if (h < 15) return "Almoço";
    if (h < 18) return "Lanche da tarde";
    if (h < 22) return "Jantar";
    return "Ceia";
  }

  // =====================================================================
  // ALIMENTO
  // =====================================================================
  function alimento(id, preset, aoSalvar) {
    const d = D();
    const a = id ? AL.alimento(d, id) : null;
    const ini = a || AL.novoAlimento(Object.assign({ nome: "" }, preset || {}));
    const e = estoqueInfo(d, a);
    UI.abrirModal(`
      <h3>${a ? "Editar alimento" : "Novo alimento"}</h3>
      <div class="par">
        <div class="campo"><label for="f_nome">Nome</label><input id="f_nome" value="${esc(ini.nome)}" placeholder="Ex.: Peito de frango"></div>
        <div class="par">
          <div class="campo"><label for="f_cat">Categoria</label><select id="f_cat">${UI.opcoes(N.CATEGORIAS, ini.categoria)}</select></div>
          <div class="campo"><label for="f_emoji">Ícone</label><input id="f_emoji" value="${esc(ini.emoji || "")}" placeholder="${esc(N.EMOJI_CATEGORIA[ini.categoria] || "🍽️")}" maxlength="4"></div>
        </div>
      </div>
      <div class="sechead">Valores nutricionais ${UI.dica("Informe os valores da tabela nutricional para a quantidade indicada (ex.: por 100 g, ou por 1 unidade). Campos vazios contam como desconhecidos.")}</div>
      <div class="par">
        <div class="campo"><label for="f_porcao">Quantidade de referência</label><input id="f_porcao" type="number" step="any" min="0" value="${ini.porcao == null ? "" : ini.porcao}"></div>
        <div class="campo"><label for="f_un">Unidade</label><select id="f_un">${UI.opcoes(N.UNIDADES_ALIMENTO, ini.unidade)}</select></div>
      </div>
      <div class="grade-5">
        ${N.NUTRIENTES.map((n) => `<div class="campo"><label for="f_${n.chave}">${n.rotulo} (${n.unidade})</label><input id="f_${n.chave}" type="number" step="any" min="0" value="${N.temValor(ini[n.chave]) ? ini[n.chave] : ""}"></div>`).join("")}
      </div>
      <div class="sechead">Compra</div>
      <div class="par3">
        <div class="campo"><label for="f_preco">Preço (R$)</label><input id="f_preco" type="number" step="0.01" min="0" value="${N.temValor(ini.preco) ? ini.preco : ""}" placeholder="opcional"></div>
        <div class="campo"><label for="f_pqtd">por</label><input id="f_pqtd" type="number" step="any" min="0" value="${ini.precoQtd || 1}"></div>
        <div class="campo"><label for="f_pun">unidade</label><select id="f_pun">${UI.opcoes(N.UNIDADES_COMPRA, ini.precoUnidade)}</select></div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_marca">Marca</label><input id="f_marca" value="${esc(ini.marca || "")}" placeholder="opcional"></div>
        <div class="campo"><label for="f_mercado">Onde costuma comprar</label><input id="f_mercado" list="lista_mercados" value="${esc(ini.mercado || "")}"><datalist id="lista_mercados">${N.MERCADOS.map((m) => `<option value="${esc(m)}">`).join("")}</datalist></div>
      </div>
      <div class="campo"><label for="f_obs">Observações</label><textarea id="f_obs" placeholder="opcional">${esc(ini.obs || "")}</textarea></div>
      ${e}
      ${UI.botoesModal(!!a)}`, { largo: true });
    const sel = document.getElementById("f_un");
    sel.addEventListener("change", () => {
      const u = sel.value;
      const porc = document.getElementById("f_porcao");
      if (!porc.value || porc.value === "100" || porc.value === "1") porc.value = u === "g" || u === "ml" ? 100 : 1;
      document.getElementById("f_pun").value = N.unidadeCompraPadrao(u);
    });
    document.getElementById("btnSalvar").onclick = () => {
      const nome = UI.texto("f_nome");
      if (!nome) { UI.toast("Informe o nome do alimento."); return; }
      const dup = AL.alimentoPorNome(d, nome);
      if (dup && (!a || dup.id !== a.id)) { UI.toast("Já existe um alimento com esse nome."); return; }
      const porcao = UI.numero("f_porcao");
      if (!porcao) { UI.toast("Informe a quantidade de referência (ex.: 100)."); return; }
      const reg = { nome, categoria: UI.valor("f_cat"), emoji: UI.texto("f_emoji"), porcao, unidade: UI.valor("f_un"),
        preco: UI.numero("f_preco"), precoQtd: UI.numero("f_pqtd") || 1, precoUnidade: UI.valor("f_pun"),
        marca: UI.texto("f_marca"), mercado: UI.texto("f_mercado"), obs: UI.texto("f_obs") };
      N.NUTRIENTES.forEach((n) => { reg[n.chave] = UI.numero("f_" + n.chave); });
      let alvo = a;
      if (a) {
        // mudou a unidade base: converte as quantidades que dependem dela
        if (a.unidade !== reg.unidade && !N.compativeis(a.unidade, reg.unidade)) {
          d.refeicaoItens.filter((i) => i.alimentoId === a.id && !N.compativeis(i.unidade, reg.unidade)).forEach((i) => { i.unidade = reg.unidade; });
        }
        Object.assign(a, reg);
      } else {
        alvo = AL.novoAlimento(reg);
        d.alimentos.push(alvo);
      }
      // nome mudou: atualiza os itens da lista ainda pendentes
      d.compras.filter((c) => c.alimentoId === alvo.id && c.status === "Pendente").forEach((c) => { c.nome = alvo.nome; c.categoria = alvo.categoria; });
      UI.fecharModal();
      salvar(a ? "Alimento atualizado." : "Alimento cadastrado.");
      if (aoSalvar) aoSalvar(alvo);
    };
    if (a) document.getElementById("btnExcluir").onclick = () => excluirAlimento(a.id);
  }
  function estoqueInfo(d, a) {
    if (!a) return "";
    const e = C.estoqueDoAlimento(d, a.id);
    return `<p class="ajuda">${e ? `Em estoque: <b>${N.qtdLegivel(e.quantidade, e.unidade)}</b>.` : "Sem controle de estoque para este alimento."}</p>`;
  }
  function excluirAlimento(id) {
    const d = D();
    const a = AL.alimento(d, id);
    if (!a) return;
    const usos = d.refeicaoItens.filter((i) => i.alimentoId === id).length;
    UI.confirmar({
      titulo: "Excluir alimento",
      texto: usos ? `"${a.nome}" aparece em ${usos} ${UI.plural(usos, "item de refeição", "itens de refeições")}. Excluir também remove esses itens, o estoque e as referências nas favoritas. As compras já feitas continuam no histórico.` : `Excluir "${a.nome}"? O estoque dele também será removido; compras já feitas continuam no histórico.`,
      rotulo: "Excluir",
      aoConfirmar: () => window.App.comDesfazer("Alimento excluído.", () => {
        d.alimentos = d.alimentos.filter((x) => x.id !== id);
        d.refeicaoItens = d.refeicaoItens.filter((i) => i.alimentoId !== id);
        d.estoque = d.estoque.filter((e) => e.alimentoId !== id);
        d.favoritas.forEach((f) => { f.itens = (f.itens || []).filter((i) => i.alimentoId !== id); });
        d.compras = d.compras.filter((c) => !(c.alimentoId === id && c.status === "Pendente" && c.auto));
        d.compras.forEach((c) => { if (c.alimentoId === id) c.alimentoId = null; });
      })
    });
  }

  // =====================================================================
  // EDITOR DE ITENS (refeição e favorita)
  // =====================================================================
  function linhaItem(d, it, k) {
    const a = AL.alimentoPorNome(d, it.nome);
    const uns = a ? unidadesCompativeis(a.unidade, N.UNIDADES_ALIMENTO.concat(["kg", "L", "dz"])) : N.UNIDADES_ALIMENTO;
    return `<div class="item-linha" data-k="${k}">
      <input class="it-nome" list="lista_alimentos" value="${esc(it.nome)}" placeholder="Alimento" autocomplete="off" aria-label="Alimento">
      <input class="it-qtd" type="number" step="any" min="0" value="${it.quantidade == null ? "" : it.quantidade}" aria-label="Quantidade">
      <select class="it-un" aria-label="Unidade">${UI.opcoes(uns, it.unidade || (a && a.unidade) || "g")}</select>
      <span class="it-kcal"></span>
      <button class="btn fantasma perigo-txt it-rem" title="Remover" aria-label="Remover item">${UI.svg("fechar")}</button>
    </div>`;
  }
  // monta a lista editável de itens dentro de um container; devolve funções de leitura
  function editorItens(container, d, itensIniciais) {
    let itens = itensIniciais.map((i) => ({ nome: i.nome, quantidade: i.quantidade, unidade: i.unidade }));
    if (!itens.length) itens.push({ nome: "", quantidade: null, unidade: "g" });
    const lista = container.querySelector(".itens-lista");
    const tot = container.querySelector(".itens-total");
    function ler() {
      return Array.from(lista.querySelectorAll(".item-linha")).map((l) => ({
        nome: l.querySelector(".it-nome").value.trim(), quantidade: N.numOuNulo(l.querySelector(".it-qtd").value), unidade: l.querySelector(".it-un").value
      }));
    }
    function totais() {
      const linhas = Array.from(lista.querySelectorAll(".item-linha"));
      const nuts = [];
      let semCadastro = 0, semNutri = 0;
      linhas.forEach((l) => {
        const nome = l.querySelector(".it-nome").value.trim();
        const q = N.numOuNulo(l.querySelector(".it-qtd").value);
        const a = AL.alimentoPorNome(d, nome);
        const out = l.querySelector(".it-kcal");
        if (!nome) { out.textContent = ""; return; }
        if (!a) { out.innerHTML = `<span class="novo-tag" title="Será cadastrado ao salvar">novo</span>`; semCadastro++; return; }
        const n = AL.nutricaoDe(a, q || 0, l.querySelector(".it-un").value);
        if (n.incompleto) { out.innerHTML = `<span class="dim" title="Sem valores nutricionais cadastrados">—</span>`; semNutri++; }
        else out.textContent = Math.round(n.kcal) + " kcal";
        nuts.push(n);
      });
      const s = AL.somarNutricao(nuts);
      tot.innerHTML = `<span><b>${Math.round(s.kcal)}</b> kcal</span><span>P <b>${UI.numAuto(s.proteina, 0)}</b> g</span><span>C <b>${UI.numAuto(s.carbo, 0)}</b> g</span><span>G <b>${UI.numAuto(s.gordura, 0)}</b> g</span><span>F <b>${UI.numAuto(s.fibra, 0)}</b> g</span>` +
        (semCadastro || semNutri ? `<small class="dim">${semCadastro ? semCadastro + " " + UI.plural(semCadastro, "alimento novo será cadastrado", "alimentos novos serão cadastrados") + " sem nutrição. " : ""}${semNutri ? semNutri + " sem valores nutricionais." : ""}</small>` : "");
    }
    function desenhar() {
      lista.innerHTML = itens.map((it, k) => linhaItem(d, it, k)).join("");
      totais();
    }
    lista.addEventListener("input", totais);
    lista.addEventListener("change", (e) => {
      if (!e.target.classList.contains("it-nome")) { totais(); return; }
      const l = e.target.closest(".item-linha");
      const a = AL.alimentoPorNome(d, e.target.value);
      if (a) {
        const sel = l.querySelector(".it-un");
        sel.innerHTML = UI.opcoes(unidadesCompativeis(a.unidade, N.UNIDADES_ALIMENTO.concat(["kg", "L", "dz"])), a.unidade);
        const q = l.querySelector(".it-qtd");
        if (!q.value) q.value = a.porcao || 1;
      }
      totais();
    });
    lista.addEventListener("click", (e) => {
      const b = e.target.closest(".it-rem");
      if (!b) return;
      itens = ler();
      itens.splice(Number(b.closest(".item-linha").dataset.k), 1);
      if (!itens.length) itens.push({ nome: "", quantidade: null, unidade: "g" });
      desenhar();
    });
    container.querySelector(".it-add").addEventListener("click", () => {
      itens = ler(); itens.push({ nome: "", quantidade: null, unidade: "g" }); desenhar();
      const ult = lista.querySelectorAll(".it-nome"); ult[ult.length - 1].focus();
    });
    desenhar();
    return {
      ler,
      adicionar: (novos) => { itens = ler().filter((i) => i.nome).concat(novos); desenhar(); }
    };
  }
  function blocoItens(d) {
    return `<div class="itens-editor">
      <div class="itens-cab"><span>Alimento</span><span>Qtd</span><span>Unid.</span><span>kcal</span><span></span></div>
      <div class="itens-lista"></div>
      <button type="button" class="btn pequeno it-add">${UI.svg("mais")}Adicionar alimento</button>
      <div class="itens-total"></div>
      <datalist id="lista_alimentos">${AL.alimentosOrdenados(d).map((a) => `<option value="${esc(a.nome)}">`).join("")}</datalist>
    </div>`;
  }
  // grava os itens lidos do editor, criando alimentos novos se preciso
  function itensResolvidos(d, lidos) {
    const out = [];
    for (const it of lidos) {
      if (!it.nome) continue;
      if (!it.quantidade || it.quantidade <= 0) return { erro: `Informe a quantidade de "${it.nome}".` };
      const r = resolverAlimento(d, it.nome, it.unidade);
      const un = N.compativeis(it.unidade, r.alimento.unidade) ? it.unidade : r.alimento.unidade;
      out.push({ alimentoId: r.alimento.id, quantidade: it.quantidade, unidade: un });
    }
    return { itens: out };
  }

  // =====================================================================
  // REFEIÇÃO
  // =====================================================================
  function refeicao(id, base) {
    const d = D();
    base = base || {};
    let r = id ? AL.refeicao(d, id) : null;
    if (!r && base.data && base.tipo) r = AL.refeicaoDoTipo(d, base.data, base.tipo); // já existe: edita
    const tipoIni = r ? r.tipo : (base.tipo || tipoPelaHora());
    const ini = r || { data: base.data || N.hoje(0), tipo: tipoIni, horario: N.HORARIO_SUGERIDO[tipoIni], status: base.status || (base.data && base.data > N.hoje(0) ? "Planejada" : "Realizada"), obs: "" };
    const itensIni = r ? AL.itensDe(d, r.id).map((i) => { const a = AL.alimento(d, i.alimentoId); return { nome: a ? a.nome : "", quantidade: i.quantidade, unidade: i.unidade }; }) : [];
    const favs = d.favoritas.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const m = UI.abrirModal(`
      <h3>${r ? "Editar refeição" : "Registrar refeição"}</h3>
      <div class="grade-4">
        <div class="campo"><label for="f_data">Data</label><input id="f_data" type="date" value="${esc(ini.data)}"></div>
        <div class="campo"><label for="f_tipo">Refeição</label><select id="f_tipo">${UI.opcoes(N.TIPOS_REFEICAO, ini.tipo)}</select></div>
        <div class="campo"><label for="f_hora">Horário</label><input id="f_hora" type="time" value="${esc(ini.horario || "")}"></div>
        <div class="campo"><label for="f_status">Status ${UI.dica("Planejada: ainda vai comer (entra no planejamento e na lista de compras). Realizada: já comeu (entra nas calorias do dia e baixa o estoque). Pulada: não comeu.")}</label><select id="f_status">${UI.opcoes(N.STATUS_REFEICAO, ini.status)}</select></div>
      </div>
      ${favs.length ? `<div class="campo linha-fav"><label for="f_fav">Usar uma favorita</label><select id="f_fav">${UI.opcoes(favs.map((f) => ({ v: f.id, r: f.nome })), "", "— escolher —")}</select></div>` : ""}
      ${blocoItens(d)}
      <label class="chk-linha"><input type="checkbox" id="f_salvarfav"> Salvar também como refeição favorita</label>
      <div class="campo" id="f_favnome_box" style="display:none"><label for="f_favnome">Nome da favorita</label><input id="f_favnome" placeholder="Ex.: Almoço padrão"></div>
      <div class="campo"><label for="f_obs">Observações</label><input id="f_obs" value="${esc(ini.obs || "")}" placeholder="opcional"></div>
      ${UI.botoesModal(!!r)}`, { largo: true, semFoco: true });
    const ed = editorItens(m.querySelector(".itens-editor"), d, itensIni);
    m.querySelector("#f_tipo").addEventListener("change", (e) => { if (!r) m.querySelector("#f_hora").value = N.HORARIO_SUGERIDO[e.target.value] || ""; });
    m.querySelector("#f_salvarfav").addEventListener("change", (e) => { m.querySelector("#f_favnome_box").style.display = e.target.checked ? "" : "none"; });
    const selFav = m.querySelector("#f_fav");
    if (selFav) selFav.addEventListener("change", () => {
      const f = AL.favorita(d, selFav.value);
      if (!f) return;
      ed.adicionar((f.itens || []).map((i) => { const a = AL.alimento(d, i.alimentoId); return { nome: a ? a.nome : "", quantidade: i.quantidade, unidade: i.unidade }; }).filter((i) => i.nome));
      if (!r && f.tipo) m.querySelector("#f_tipo").value = f.tipo;
      selFav.value = "";
    });
    m.querySelector("#btnSalvar").onclick = () => {
      const res = itensResolvidos(d, ed.ler());
      if (res.erro) { UI.toast(res.erro); return; }
      if (!res.itens.length) { UI.toast("Adicione pelo menos um alimento."); return; }
      const data = UI.valor("f_data") || N.hoje(0), tipo = UI.valor("f_tipo"), status = UI.valor("f_status");
      let alvo = r;
      if (!alvo) {
        alvo = AL.refeicaoDoTipo(d, data, tipo);
        if (alvo) {
          // já havia uma refeição desse tipo no dia: junta os itens
          res.itens.forEach((i) => d.refeicaoItens.push(Object.assign({ id: N.novoId(), refeicaoId: alvo.id }, i)));
        } else {
          alvo = { id: N.novoId(), usuarioId: d.usuarios[0].id, data, tipo, horario: UI.valor("f_hora"), status: "Planejada", favoritaId: null, obs: UI.texto("f_obs") };
          d.refeicoes.push(alvo);
          res.itens.forEach((i) => d.refeicaoItens.push(Object.assign({ id: N.novoId(), refeicaoId: alvo.id }, i)));
        }
      } else {
        // edição: se estava realizada, devolve ao estoque antes de trocar os itens
        if (alvo.baixas) { const st = alvo.status; alvo.status = "Planejada"; C.aoMudarStatusRefeicao(d, alvo); alvo.status = st; }
        d.refeicaoItens = d.refeicaoItens.filter((i) => i.refeicaoId !== alvo.id);
        res.itens.forEach((i) => d.refeicaoItens.push(Object.assign({ id: N.novoId(), refeicaoId: alvo.id }, i)));
        Object.assign(alvo, { data, tipo, horario: UI.valor("f_hora"), obs: UI.texto("f_obs") });
      }
      alvo.status = status;
      C.aoMudarStatusRefeicao(d, alvo);
      if (UI.marcado("f_salvarfav")) AL.favoritaDeRefeicao(d, alvo.id, UI.texto("f_favnome") || tipo + " favorito");
      UI.fecharModal();
      salvar(r ? "Refeição atualizada." : status === "Realizada" ? "Refeição registrada." : "Refeição planejada.");
    };
    if (r) m.querySelector("#btnExcluir").onclick = () => excluirRefeicao(r.id);
  }
  function excluirRefeicao(id) {
    const d = D();
    const r = AL.refeicao(d, id);
    if (!r) return;
    confirmarExclusao(`Excluir ${r.tipo.toLowerCase()} de ${UI.dataCurta(r.data)}?`, () => window.App.comDesfazer("Refeição excluída.", () => {
      if (r.baixas) { r.status = "Planejada"; C.aoMudarStatusRefeicao(d, r); }
      AL.excluirRefeicao(d, id);
    }));
  }
  // ciclo de status com integração ao estoque
  function definirStatusRefeicao(id, status) {
    const d = D();
    const r = AL.refeicao(d, id);
    if (!r) return;
    r.status = status;
    C.aoMudarStatusRefeicao(d, r);
    salvar(`${r.tipo}: ${status.toLowerCase()}.`);
  }

  // =====================================================================
  // FAVORITA
  // =====================================================================
  function favorita(id) {
    const d = D();
    const f = id ? AL.favorita(d, id) : null;
    const itensIni = f ? (f.itens || []).map((i) => { const a = AL.alimento(d, i.alimentoId); return { nome: a ? a.nome : "", quantidade: i.quantidade, unidade: i.unidade }; }) : [];
    const m = UI.abrirModal(`
      <h3>${f ? "Editar favorita" : "Nova refeição favorita"}</h3>
      <div class="par">
        <div class="campo"><label for="f_nome">Nome</label><input id="f_nome" value="${esc(f ? f.nome : "")}" placeholder="Ex.: Almoço padrão"></div>
        <div class="campo"><label for="f_tipo">Refeição sugerida</label><select id="f_tipo">${UI.opcoes(N.TIPOS_REFEICAO, f ? f.tipo : "Almoço")}</select></div>
      </div>
      ${blocoItens(d)}
      ${UI.botoesModal(!!f)}`, { largo: true });
    const ed = editorItens(m.querySelector(".itens-editor"), d, itensIni);
    m.querySelector("#btnSalvar").onclick = () => {
      const nome = UI.texto("f_nome");
      if (!nome) { UI.toast("Dê um nome à favorita."); return; }
      const res = itensResolvidos(d, ed.ler());
      if (res.erro) { UI.toast(res.erro); return; }
      if (!res.itens.length) { UI.toast("Adicione pelo menos um alimento."); return; }
      if (f) Object.assign(f, { nome, tipo: UI.valor("f_tipo"), itens: res.itens });
      else d.favoritas.push({ id: N.novoId(), nome, tipo: UI.valor("f_tipo"), itens: res.itens, obs: "" });
      UI.fecharModal();
      salvar(f ? "Favorita atualizada." : "Favorita criada.");
    };
    if (f) m.querySelector("#btnExcluir").onclick = () => confirmarExclusao(`Excluir a favorita "${f.nome}"? As refeições já criadas com ela continuam.`, () => window.App.comDesfazer("Favorita excluída.", () => {
      d.favoritas = d.favoritas.filter((x) => x.id !== f.id);
    }));
  }
  function aplicarFavorita(favId, base) {
    const d = D();
    const f = AL.favorita(d, favId);
    if (!f) return;
    base = base || {};
    const data = base.data || N.hoje(0);
    const m = UI.abrirModal(`
      <h3>Usar "${esc(f.nome)}"</h3>
      <div class="par3">
        <div class="campo"><label for="f_data">Data</label><input id="f_data" type="date" value="${esc(data)}"></div>
        <div class="campo"><label for="f_tipo">Refeição</label><select id="f_tipo">${UI.opcoes(N.TIPOS_REFEICAO, base.tipo || f.tipo)}</select></div>
        <div class="campo"><label for="f_status">Status</label><select id="f_status">${UI.opcoes(N.STATUS_REFEICAO, data > N.hoje(0) ? "Planejada" : (base.status || "Planejada"))}</select></div>
      </div>
      <p class="ajuda">Os itens da favorita são adicionados à refeição desse dia (se já existir, entram junto com os itens dela).</p>
      ${UI.botoesModal(false, "Adicionar")}`);
    m.querySelector("#btnSalvar").onclick = () => {
      const r = AL.aplicarFavorita(d, f.id, UI.valor("f_data") || data, UI.valor("f_tipo"), "Planejada");
      r.status = UI.valor("f_status");
      C.aoMudarStatusRefeicao(d, r);
      UI.fecharModal();
      salvar(`"${f.nome}" adicionada em ${UI.dataCurta(r.data)}.`);
    };
  }

  // =====================================================================
  // COPIAR DIA (planejamento)
  // =====================================================================
  function copiarDia(deData) {
    const d = D();
    const ini = N.inicioSemana(deData);
    const dias = [1, 2, 3, 4, 5, 6, 7].map((k) => N.addDias(ini, k - 1 + 7));
    const m = UI.abrirModal(`
      <h3>Copiar planejamento de ${UI.dataLonga(deData)}</h3>
      <p class="ajuda" style="margin-top:0">As refeições desse dia são copiadas como <b>Planejadas</b> para os dias escolhidos.</p>
      <div class="sechead">Esta semana</div>
      ${UI.campoChips("f_dias1", N.intervalo(ini, N.addDias(ini, 6)).filter((x) => x !== deData).map((x) => x), [])}
      <div class="sechead">Próxima semana</div>
      ${UI.campoChips("f_dias2", dias, [])}
      <div class="campo"><label for="f_outra">Ou outra data</label><input id="f_outra" type="date"></div>
      <label class="chk-linha"><input type="checkbox" id="f_subst" checked> Substituir o que já estiver planejado nos dias de destino</label>
      ${UI.botoesModal(false, "Copiar")}`, { largo: true });
    // rótulos legíveis nas fichinhas de data
    m.querySelectorAll(".chip span").forEach((s) => { const iso = s.textContent; s.textContent = N.DIA_CURTO[N.diaSemana(iso)] + " " + UI.dataCurta(iso); });
    m.querySelector("#btnSalvar").onclick = () => {
      const destinos = UI.chips("f_dias1").concat(UI.chips("f_dias2"));
      if (UI.valor("f_outra")) destinos.push(UI.valor("f_outra"));
      if (!destinos.length) { UI.toast("Escolha pelo menos um dia."); return; }
      if (!AL.refeicoesNoDia(d, deData).length) { UI.toast("Esse dia não tem refeições para copiar."); return; }
      let n = 0;
      destinos.forEach((dt) => { n += AL.copiarDia(d, deData, dt, UI.marcado("f_subst")); });
      UI.fecharModal();
      salvar(`${n} ${UI.plural(n, "refeição copiada", "refeições copiadas")} para ${destinos.length} ${UI.plural(destinos.length, "dia", "dias")}.`);
    };
  }

  // =====================================================================
  // ÁGUA
  // =====================================================================
  function agua(data) {
    const d = D();
    data = data || N.hoje(0);
    const copo = Number(d.config.copoAgua) || 250;
    const desenhar = () => {
      const lista = d.agua.filter((a) => a.data === data).sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
      const meta = AL.metaDiaria(d, "agua");
      const total = AL.aguaDoDia(d, data);
      return `<h3>Água — ${UI.dataLonga(data)}</h3>
        <div class="agua-topo"><b>${UI.litros(total)}</b>${meta ? ` <span class="dim">de ${UI.litros(meta)}</span>` : ""}</div>
        ${meta ? UI.barra((total / meta) * 100, total >= meta ? "var(--up)" : "var(--azul)") : ""}
        <div class="agua-botoes">
          ${[copo, 500, 750, 1000].filter((v, i, a) => a.indexOf(v) === i).map((v) => `<button class="btn" data-acao="agua-somar" data-ml="${v}" data-data="${data}">+ ${v >= 1000 ? UI.num(v / 1000, 1) + " L" : v + " ml"}</button>`).join("")}
        </div>
        <div class="par"><div class="campo"><label for="f_ml">Outra quantidade (ml)</label><input id="f_ml" type="number" min="0" step="50" placeholder="ex.: 330"></div>
          <div class="campo"><label>&nbsp;</label><button class="btn primario" data-acao="agua-somar-campo" data-data="${data}">Adicionar</button></div></div>
        ${lista.length ? `<div class="sechead">Registros do dia</div>${lista.map((a) => `<div class="kv"><span>${esc(a.hora || "—")}</span><b>${a.ml} ml ${UI.botaoIcone("agua-remover", "excluir", "Remover", `data-id="${a.id}" data-data="${data}"`, "perigo-txt")}</b></div>`).join("")}` : ""}
        <div class="modal-acoes"><button class="btn salvar" data-acao="fechar-modal">Fechar</button></div>`;
    };
    UI.abrirModal(desenhar(), { semFoco: true });
    aguaRedesenhar = () => { document.getElementById("modal").innerHTML = `<button class="modal-fechar" data-acao="fechar-modal" aria-label="Fechar">${UI.svg("fechar")}</button>` + desenhar(); };
  }
  let aguaRedesenhar = null;
  function somarAgua(ml, data, manterModal) {
    const d = D();
    if (!ml || ml <= 0) { UI.toast("Informe a quantidade em ml."); return; }
    d.agua.push({ id: N.novoId(), usuarioId: d.usuarios[0].id, data: data || N.hoje(0), ml: Number(ml), hora: N.horaAgora() });
    salvar(`+${ml} ml de água.`);
    if (manterModal && aguaRedesenhar && UI.modalAberto()) aguaRedesenhar();
  }
  window.App.registrarAcoes({
    "agua-somar": (el) => somarAgua(Number(el.dataset.ml), el.dataset.data, true),
    "agua-somar-campo": (el) => somarAgua(UI.numero("f_ml"), el.dataset.data, true),
    "agua-remover": (el) => { const d = D(); d.agua = d.agua.filter((a) => a.id !== el.dataset.id); salvar("Registro removido."); if (aguaRedesenhar) aguaRedesenhar(); },
    "agua-rapida": (el) => somarAgua(Number(el.dataset.ml) || Number(D().config.copoAgua) || 250, el.dataset.data || N.hoje(0), false)
  });

  // =====================================================================
  // PESO + COMPOSIÇÃO + MEDIDAS (um formulário, nada obrigatório)
  // =====================================================================
  function corpo(data, foco) {
    const d = D();
    data = data || N.hoje(0);
    const carregar = (dt) => ({ p: F.pesagemDoDia(d, dt), m: F.medidaDoDia(d, dt) || {} });
    let atual = carregar(data);
    const campo = (k, rot, un, dicaTxt) => `<div class="campo"><label for="f_${k}">${rot}${un ? " (" + un + ")" : ""}${dicaTxt ? " " + UI.dica(dicaTxt) : ""}</label><input id="f_${k}" type="number" step="any" min="0" value="${N.temValor(atual.m[k]) ? atual.m[k] : ""}"></div>`;
    const alt = F.altura(d);
    const m = UI.abrirModal(`
      <h3>${foco === "medidas" ? "Registrar medidas" : "Registrar peso"}</h3>
      <p class="ajuda" style="margin-top:0">Preencha só o que tiver — nenhum campo é obrigatório. Se já houver registro nesta data, ele é atualizado.</p>
      <div class="par">
        <div class="campo"><label for="f_data">Data</label><input id="f_data" type="date" value="${esc(data)}"></div>
        <div class="campo"><label for="f_peso">Peso (kg)</label><input id="f_peso" type="number" step="0.1" min="0" value="${atual.p ? atual.p.peso : ""}" placeholder="ex.: 78,5"></div>
      </div>
      <div class="imc-previa" id="imcPrevia"></div>
      <details class="grupo-campos"${foco === "medidas" ? " open" : ""}><summary>Composição corporal ${UI.dica("Valores da balança de bioimpedância ou de uma avaliação física.")}</summary>
        <div class="grade-4">
          ${campo("massaMuscular", "Massa muscular", "kg", F.METRICA.massaMuscular.dica)}
          ${campo("gorduraPct", "Gordura", "%", F.METRICA.gorduraPct.dica)}
          ${campo("massaGordura", "Massa de gordura", "kg", F.METRICA.massaGordura.dica)}
          ${campo("aguaPct", "Água corporal", "%")}
        </div>
      </details>
      <details class="grupo-campos"${foco === "medidas" ? " open" : ""}><summary>Medidas (cm)</summary>
        <div class="grade-4">
          ${["pescoco", "peito", "cintura", "abdomen", "quadril", "bracoD", "bracoE", "coxaD", "coxaE"].map((k) => campo(k, F.METRICA[k].rotulo, "", F.METRICA[k].dica)).join("")}
        </div>
      </details>
      <div class="campo"><label for="f_obs">Observações</label><input id="f_obs" value="${esc((atual.p && atual.p.obs) || atual.m.obs || "")}" placeholder="ex.: em jejum, pela manhã"></div>
      ${UI.botoesModal(!!(atual.p || atual.m.id))}`, { largo: true });
    const previa = () => {
      const p = UI.numero("f_peso");
      const v = F.imc(p, alt);
      m.querySelector("#imcPrevia").innerHTML = v ? `IMC: <b>${UI.num(v, 1)}</b> · ${F.classificacaoIMC(v)} ${UI.dica(F.METRICA.imc.dica)}` : (p && !alt ? `<span class="dim">Informe sua altura em Configurações → Perfil para calcular o IMC.</span>` : "");
    };
    m.querySelector("#f_peso").addEventListener("input", previa);
    previa();
    // trocar a data carrega o que já existe nela
    m.querySelector("#f_data").addEventListener("change", (e) => {
      const dt = e.target.value;
      if (!dt) return;
      atual = carregar(dt);
      m.querySelector("#f_peso").value = atual.p ? atual.p.peso : "";
      F.CAMPOS_MEDIDA.forEach((k) => { const el = m.querySelector("#f_" + k); if (el) el.value = N.temValor(atual.m[k]) ? atual.m[k] : ""; });
      previa();
    });
    m.querySelector("#btnSalvar").onclick = () => {
      const dt = UI.valor("f_data") || N.hoje(0);
      const peso = UI.numero("f_peso");
      const med = {};
      let temMedida = false;
      F.CAMPOS_MEDIDA.forEach((k) => { const v = UI.numero("f_" + k); med[k] = v; if (v != null) temMedida = true; });
      if (peso == null && !temMedida) { UI.toast("Preencha pelo menos um valor."); return; }
      if (peso != null && (peso < 20 || peso > 400)) { UI.toast("Confira o peso informado."); return; }
      if (med.gorduraPct != null && (med.gorduraPct <= 0 || med.gorduraPct >= 75)) { UI.toast("Confira o percentual de gordura."); return; }
      const obs = UI.texto("f_obs");
      let p = F.pesagemDoDia(d, dt);
      if (peso != null) {
        if (p) Object.assign(p, { peso, obs });
        else d.pesagens.push({ id: N.novoId(), usuarioId: d.usuarios[0].id, data: dt, peso, altura: null, obs });
      } else if (p) {
        d.pesagens = d.pesagens.filter((x) => x.id !== p.id); // apagou o peso do formulário
      }
      let reg = F.medidaDoDia(d, dt);
      if (temMedida) {
        if (reg) Object.assign(reg, med, { obs });
        else d.medidas.push(Object.assign({ id: N.novoId(), usuarioId: d.usuarios[0].id, data: dt, obs }, med));
      } else if (reg) d.medidas = d.medidas.filter((x) => x.id !== reg.id);
      UI.fecharModal();
      salvar("Registro salvo.");
    };
    const exc = m.querySelector("#btnExcluir");
    if (exc) exc.onclick = () => excluirRegistroCorpo(UI.valor("f_data") || data);
  }
  function excluirRegistroCorpo(data) {
    const d = D();
    confirmarExclusao(`Excluir o peso e as medidas de ${UI.dataBR(data)}?`, () => window.App.comDesfazer("Registro excluído.", () => {
      d.pesagens = d.pesagens.filter((p) => p.data !== data);
      d.medidas = d.medidas.filter((x) => x.data !== data);
    }));
  }

  // =====================================================================
  // COMPRA
  // =====================================================================
  function compra(id, base) {
    const d = D();
    base = base || {};
    const c = id ? C.compra(d, id) : null;
    const aBase = base.alimentoId ? AL.alimento(d, base.alimentoId) : null;
    const ini = c || {
      nome: aBase ? aBase.nome : "", categoria: aBase ? aBase.categoria : "Outros", quantidade: 1, unidade: aBase ? (aBase.precoUnidade || N.unidadeCompraPadrao(aBase.unidade)) : "un",
      precoEstimado: aBase ? C.estimarPreco(d, aBase.id, 1, aBase.precoUnidade) : null, precoPago: null, mercado: (aBase && aBase.mercado) || "Mercado",
      prioridade: "Normal", status: "Pendente", dataCompra: null, obs: ""
    };
    const m = UI.abrirModal(`
      <h3>${c ? "Editar item" : "Adicionar à lista de compras"}</h3>
      ${c && c.auto ? `<p class="aviso-auto">${UI.svg("info")} Item criado automaticamente (${esc(c.motivo || c.origem)}). Se você editar, ele deixa de ser atualizado sozinho.</p>` : ""}
      <div class="par">
        ${UI.campoAlimento("f_nome", d, ini.nome, "Produto")}
        <div class="campo"><label for="f_cat">Categoria</label><select id="f_cat">${UI.opcoes(N.CATEGORIAS, ini.categoria)}</select></div>
      </div>
      <div class="grade-4">
        <div class="campo"><label for="f_qtd">Quantidade</label><input id="f_qtd" type="number" step="any" min="0" value="${ini.quantidade}"></div>
        <div class="campo"><label for="f_un">Unidade</label><select id="f_un">${UI.opcoes(N.UNIDADES_COMPRA, ini.unidade)}</select></div>
        <div class="campo"><label for="f_est">Preço estimado (R$) ${UI.dica("Total previsto para esta quantidade. Calculado pelo preço cadastrado no alimento, quando houver.")}</label><input id="f_est" type="number" step="0.01" min="0" value="${N.temValor(ini.precoEstimado) ? ini.precoEstimado : ""}"></div>
        <div class="campo"><label for="f_pago">Preço pago (R$)</label><input id="f_pago" type="number" step="0.01" min="0" value="${N.temValor(ini.precoPago) ? ini.precoPago : ""}" placeholder="ao comprar"></div>
      </div>
      <div class="grade-4">
        <div class="campo"><label for="f_mercado">Mercado</label><input id="f_mercado" list="lista_mercados2" value="${esc(ini.mercado || "")}"><datalist id="lista_mercados2">${N.MERCADOS.map((x) => `<option value="${esc(x)}">`).join("")}</datalist></div>
        <div class="campo"><label for="f_prio">Prioridade</label><select id="f_prio">${UI.opcoes(N.PRIORIDADES, ini.prioridade)}</select></div>
        <div class="campo"><label for="f_status">Status</label><select id="f_status">${UI.opcoes(N.STATUS_COMPRA, ini.status)}</select></div>
        <div class="campo"><label for="f_dcompra">Data da compra</label><input id="f_dcompra" type="date" value="${esc(ini.dataCompra || "")}"></div>
      </div>
      <div class="campo"><label for="f_obs">Observações</label><input id="f_obs" value="${esc(ini.obs || "")}" placeholder="opcional"></div>
      ${!c ? `<label class="chk-linha" id="f_cad_box"><input type="checkbox" id="f_cad" checked> Cadastrar como alimento (para controlar estoque e nutrição)</label>` : ""}
      ${UI.botoesModal(!!c)}`, { largo: true });
    let estimadoManual = !!c;
    const recalcular = () => {
      if (estimadoManual) return;
      const a = AL.alimentoPorNome(d, UI.valor("f_nome"));
      const v = a ? C.estimarPreco(d, a.id, UI.numero("f_qtd") || 0, UI.valor("f_un")) : null;
      if (v != null) m.querySelector("#f_est").value = v.toFixed(2);
    };
    m.querySelector("#f_est").addEventListener("input", () => { estimadoManual = true; });
    m.querySelector("#f_qtd").addEventListener("input", recalcular);
    m.querySelector("#f_un").addEventListener("change", recalcular);
    m.querySelector("#f_nome").addEventListener("change", () => {
      const a = AL.alimentoPorNome(d, UI.valor("f_nome"));
      const box = m.querySelector("#f_cad_box");
      if (box) box.style.display = a ? "none" : "";
      if (!a) return;
      m.querySelector("#f_cat").value = a.categoria;
      if (a.mercado) m.querySelector("#f_mercado").value = a.mercado;
      if (a.precoUnidade && !c) m.querySelector("#f_un").value = a.precoUnidade;
      recalcular();
    });
    if (aBase && m.querySelector("#f_cad_box")) m.querySelector("#f_cad_box").style.display = "none";
    m.querySelector("#f_status").addEventListener("change", (e) => {
      if (e.target.value === "Comprado" && !UI.valor("f_dcompra")) m.querySelector("#f_dcompra").value = N.hoje(0);
      if (e.target.value === "Comprado" && !UI.valor("f_pago") && UI.valor("f_est")) m.querySelector("#f_pago").value = UI.valor("f_est");
    });
    m.querySelector("#btnSalvar").onclick = () => {
      const nome = UI.texto("f_nome");
      if (!nome) { UI.toast("Informe o produto."); return; }
      let a = AL.alimentoPorNome(d, nome);
      if (!a && UI.marcado("f_cad")) {
        a = resolverAlimento(d, nome, UI.valor("f_un")).alimento;
        a.categoria = UI.valor("f_cat");
        a.mercado = UI.texto("f_mercado");
        const q = UI.numero("f_qtd"), est = UI.numero("f_est");
        if (q && est != null) { a.preco = N.arred(est / q, 2); a.precoQtd = 1; a.precoUnidade = UI.valor("f_un"); }
      }
      const antes = c ? c.status : null;
      const reg = { nome, alimentoId: a ? a.id : null, categoria: UI.valor("f_cat"), quantidade: UI.numero("f_qtd") || 0, unidade: UI.valor("f_un"),
        precoEstimado: UI.numero("f_est"), precoPago: UI.numero("f_pago"), mercado: UI.texto("f_mercado"), prioridade: UI.valor("f_prio"),
        status: UI.valor("f_status"), dataCompra: UI.valor("f_dcompra") || null, obs: UI.texto("f_obs") };
      let alvo = c;
      if (c) {
        // se já tinha entrado no estoque, desfaz antes de aplicar as mudanças
        if (antes === "Comprado" && c.entradaEstoque) { c.status = "Pendente"; C.aoMudarStatusCompra(d, c, "Comprado"); }
        Object.assign(c, reg, { auto: false });
        C.aoMudarStatusCompra(d, c, antes === "Comprado" && !c.entradaEstoque ? "Pendente" : antes);
      } else {
        alvo = Object.assign({ id: N.novoId(), usuarioId: d.usuarios[0].id, origem: "manual", auto: false, motivo: "", criadoEm: N.hoje(0), dataPrevista: null }, reg);
        d.compras.push(alvo);
        C.aoMudarStatusCompra(d, alvo, "Pendente");
      }
      UI.fecharModal();
      salvar(c ? "Item atualizado." : "Item adicionado à lista.");
    };
    if (c) m.querySelector("#btnExcluir").onclick = () => excluirCompra(c.id);
  }
  function excluirCompra(id) {
    const d = D();
    const c = C.compra(d, id);
    if (!c) return;
    confirmarExclusao(`Excluir "${c.nome}" da lista?${c.status === "Comprado" ? " O valor deixa de contar nos gastos." : ""}`, () => window.App.comDesfazer("Item excluído.", () => {
      if (c.status === "Comprado" && c.entradaEstoque) { c.status = "Cancelado"; C.aoMudarStatusCompra(d, c, "Comprado"); }
      d.compras = d.compras.filter((x) => x.id !== id);
    }));
  }
  function definirStatusCompra(id, status) {
    const d = D();
    const c = C.compra(d, id);
    if (!c) return;
    const antes = c.status;
    c.status = status;
    C.aoMudarStatusCompra(d, c, antes);
    salvar(status === "Comprado" ? `${c.nome}: comprado${c.entradaEstoque ? " e somado ao estoque" : ""}.` : `${c.nome}: ${status.toLowerCase()}.`);
  }

  // =====================================================================
  // ESTOQUE
  // =====================================================================
  function estoque(id, base) {
    const d = D();
    base = base || {};
    const e = id ? C.itemEstoque(d, id) : (base.alimentoId ? C.estoqueDoAlimento(d, base.alimentoId) : null);
    const a = e ? AL.alimento(d, e.alimentoId) : (base.alimentoId ? AL.alimento(d, base.alimentoId) : null);
    const un = e ? e.unidade : (a ? N.unidadeCompraPadrao(a.unidade) : "kg");
    const m = UI.abrirModal(`
      <h3>${e ? "Editar estoque" : "Adicionar ao estoque"}</h3>
      ${e ? `<div class="campo"><label>Alimento</label><div class="campo-fixo">${AL.emojiAlimento(a)} ${esc(a ? a.nome : "")}</div></div>` : UI.campoAlimento("f_nome", d, a ? a.nome : "", "Alimento")}
      <div class="par3">
        <div class="campo"><label for="f_qtd">Quantidade em casa</label><input id="f_qtd" type="number" step="any" min="0" value="${e ? e.quantidade : ""}"></div>
        <div class="campo"><label for="f_un">Unidade</label><select id="f_un">${UI.opcoes(a ? unidadesCompativeis(a.unidade) : N.UNIDADES_COMPRA, un)}</select></div>
        <div class="campo"><label for="f_min">Estoque mínimo ${UI.dica("Abaixo dessa quantidade o sistema avisa e (se a lista automática estiver ligada) coloca o alimento na lista de compras.")}</label><input id="f_min" type="number" step="any" min="0" value="${e && N.temValor(e.minimo) ? e.minimo : ""}" placeholder="opcional"></div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_val">Validade</label><input id="f_val" type="date" value="${esc((e && e.validade) || "")}"></div>
        <div class="campo"><label for="f_obs">Observações</label><input id="f_obs" value="${esc((e && e.obs) || "")}" placeholder="ex.: congelador"></div>
      </div>
      ${UI.botoesModal(!!e)}`, { largo: true });
    const inpNome = m.querySelector("#f_nome");
    if (inpNome) inpNome.addEventListener("change", () => {
      const x = AL.alimentoPorNome(d, inpNome.value);
      if (!x) return;
      const ex = C.estoqueDoAlimento(d, x.id);
      if (ex) { UI.fecharModal(); estoque(ex.id); UI.toast("Esse alimento já está no estoque — editando."); return; }
      m.querySelector("#f_un").innerHTML = UI.opcoes(unidadesCompativeis(x.unidade), N.unidadeCompraPadrao(x.unidade));
    });
    m.querySelector("#btnSalvar").onclick = () => {
      const qtd = UI.numero("f_qtd");
      if (qtd == null) { UI.toast("Informe a quantidade (pode ser 0)."); return; }
      let alvo = e;
      if (!alvo) {
        const nome = UI.texto("f_nome");
        if (!nome) { UI.toast("Informe o alimento."); return; }
        const r = resolverAlimento(d, nome, UI.valor("f_un"));
        alvo = C.estoqueDoAlimento(d, r.alimento.id);
        if (!alvo) { alvo = { id: N.novoId(), alimentoId: r.alimento.id }; d.estoque.push(alvo); }
      }
      Object.assign(alvo, { quantidade: qtd, unidade: UI.valor("f_un"), minimo: UI.numero("f_min"), validade: UI.valor("f_val") || null, obs: UI.texto("f_obs"), atualizadoEm: N.hoje(0) });
      UI.fecharModal();
      salvar(e ? "Estoque atualizado." : "Adicionado ao estoque.");
    };
    if (e) m.querySelector("#btnExcluir").onclick = () => confirmarExclusao(`Parar de controlar o estoque de "${a ? a.nome : ""}"? O alimento continua cadastrado.`, () => window.App.comDesfazer("Removido do estoque.", () => {
      d.estoque = d.estoque.filter((x) => x.id !== e.id);
    }));
  }

  // =====================================================================
  // FICHA DE TREINO
  // =====================================================================
  function ficha(id) {
    const d = D();
    const f = id ? F.ficha(d, id) : null;
    let exs = f ? F.exerciciosDaFicha(d, f.id).map((e) => Object.assign({}, e)) : [{ nome: "", grupo: "Peito", series: 4, repMin: 8, repMax: 12, descanso: "60s" }];
    const nomes = F.nomesExercicios(d);
    const m = UI.abrirModal(`
      <h3>${f ? "Editar ficha" : "Nova ficha de treino"}</h3>
      <div class="campo"><label for="f_nome">Nome da ficha</label><input id="f_nome" value="${esc(f ? f.nome : "")}" placeholder="Ex.: Treino A — Peito + Tríceps"></div>
      <div class="campo"><label>Grupos musculares</label>${UI.campoChips("f_grupos", N.GRUPOS_MUSCULARES, f ? f.grupos : [])}</div>
      <div class="sechead">Exercícios</div>
      <div class="ex-editor"><div class="ex-cab"><span>Exercício</span><span>Grupo</span><span>Séries</span><span>Reps</span><span>Descanso</span><span></span></div><div class="ex-lista"></div></div>
      <button type="button" class="btn pequeno" id="exAdd">${UI.svg("mais")}Adicionar exercício</button>
      <datalist id="lista_ex">${nomes.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
      <div class="campo" style="margin-top:12px"><label for="f_obs">Observações</label><input id="f_obs" value="${esc(f ? f.obs || "" : "")}" placeholder="opcional"></div>
      ${UI.botoesModal(!!f)}`, { extraLargo: true });
    const lista = m.querySelector(".ex-lista");
    const ler = () => Array.from(lista.querySelectorAll(".ex-linha")).map((l, k) => ({
      id: exs[k] && exs[k].id, nome: l.querySelector(".ex-nome").value.trim(), grupo: l.querySelector(".ex-grupo").value,
      series: N.numOuNulo(l.querySelector(".ex-series").value), repMin: N.numOuNulo(l.querySelector(".ex-rmin").value), repMax: N.numOuNulo(l.querySelector(".ex-rmax").value),
      descanso: l.querySelector(".ex-desc").value.trim()
    }));
    const desenhar = () => {
      lista.innerHTML = exs.map((e, k) => `<div class="ex-linha" data-k="${k}">
        <input class="ex-nome" list="lista_ex" value="${esc(e.nome || "")}" placeholder="Ex.: Supino reto" aria-label="Exercício">
        <select class="ex-grupo" aria-label="Grupo">${UI.opcoes(N.GRUPOS_MUSCULARES, e.grupo)}</select>
        <input class="ex-series" type="number" min="0" value="${e.series == null ? "" : e.series}" aria-label="Séries">
        <span class="ex-reps"><input class="ex-rmin" type="number" min="0" value="${e.repMin == null ? "" : e.repMin}" aria-label="Repetições mínimas">–<input class="ex-rmax" type="number" min="0" value="${e.repMax == null ? "" : e.repMax}" aria-label="Repetições máximas"></span>
        <input class="ex-desc" value="${esc(e.descanso || "")}" placeholder="60s" aria-label="Descanso">
        <span class="ex-btns"><button type="button" class="btn fantasma ex-up" title="Subir" aria-label="Subir">↑</button><button type="button" class="btn fantasma perigo-txt ex-rem" title="Remover" aria-label="Remover">${UI.svg("fechar")}</button></span>
      </div>`).join("");
    };
    desenhar();
    m.querySelector("#exAdd").onclick = () => { exs = ler(); const ult = exs[exs.length - 1]; exs.push({ nome: "", grupo: ult ? ult.grupo : "Peito", series: 3, repMin: 10, repMax: 12, descanso: "60s" }); desenhar(); const ns = lista.querySelectorAll(".ex-nome"); ns[ns.length - 1].focus(); };
    lista.addEventListener("click", (e) => {
      const l = e.target.closest(".ex-linha");
      if (!l) return;
      const k = Number(l.dataset.k);
      if (e.target.closest(".ex-rem")) { exs = ler(); exs.splice(k, 1); desenhar(); }
      else if (e.target.closest(".ex-up") && k > 0) { exs = ler(); const t = exs[k]; exs[k] = exs[k - 1]; exs[k - 1] = t; desenhar(); }
    });
    m.querySelector("#btnSalvar").onclick = () => {
      const nome = UI.texto("f_nome");
      if (!nome) { UI.toast("Dê um nome à ficha."); return; }
      const lidos = ler().filter((e) => e.nome);
      const alvo = f || { id: N.novoId(), ordem: d.fichas.length + 1 };
      Object.assign(alvo, { nome, grupos: UI.chips("f_grupos"), obs: UI.texto("f_obs") });
      if (!f) d.fichas.push(alvo);
      const manter = {};
      lidos.forEach((e, k) => {
        const existente = e.id ? d.exercicios.find((x) => x.id === e.id) : null;
        const reg = { fichaId: alvo.id, nome: e.nome, grupo: e.grupo, series: e.series || 3, repMin: e.repMin, repMax: e.repMax || e.repMin, descanso: e.descanso, ordem: k + 1 };
        if (existente) { Object.assign(existente, reg); manter[existente.id] = true; }
        else { const novo = Object.assign({ id: N.novoId(), obs: "" }, reg); d.exercicios.push(novo); manter[novo.id] = true; }
      });
      d.exercicios = d.exercicios.filter((x) => x.fichaId !== alvo.id || manter[x.id]);
      UI.fecharModal();
      salvar(f ? "Ficha atualizada." : "Ficha criada.");
    };
    if (f) m.querySelector("#btnExcluir").onclick = () => confirmarExclusao(`Excluir a ficha "${f.nome}"? Os treinos já registrados com ela continuam no histórico.`, () => window.App.comDesfazer("Ficha excluída.", () => {
      d.exercicios = d.exercicios.filter((x) => x.fichaId !== f.id);
      d.fichas = d.fichas.filter((x) => x.id !== f.id);
      d.planoSemanal.forEach((p) => { if (p.fichaId === f.id) { p.treino = f.nome; p.fichaId = null; } });
      d.treinos.forEach((t) => { if (t.fichaId === f.id) t.fichaId = null; });
    }));
  }

  // =====================================================================
  // TREINO (sessão)
  // =====================================================================
  function treino(id, base) {
    const d = D();
    base = base || {};
    const t = id ? F.treino(d, id) : null;
    const fichas = F.fichasOrdenadas(d);
    const dataIni = base.data || N.hoje(0);
    const ini = t || { nome: "", data: dataIni, fichaId: base.fichaId || "", status: dataIni < N.hoje(0) ? "Realizado" : "Planejado", duracao: null, grupos: [], obs: "" };
    const m = UI.abrirModal(`
      <h3>${t ? "Editar treino" : "Registrar treino"}</h3>
      ${!t ? `<div class="campo"><label for="f_ficha">Ficha</label><select id="f_ficha">${UI.opcoes(fichas.map((f) => ({ v: f.id, r: f.nome })), ini.fichaId, "— treino livre (sem ficha) —")}</select>
        <p class="ajuda">Com uma ficha, os exercícios entram prontos, com a carga da última vez.</p></div>` : ""}
      <div class="campo" id="f_nome_box"${!t && ini.fichaId ? ' style="display:none"' : ""}><label for="f_nome">Nome do treino</label><input id="f_nome" value="${esc(ini.nome)}" placeholder="Ex.: Corrida, Funcional…"></div>
      <div class="par3">
        <div class="campo"><label for="f_data">Data</label><input id="f_data" type="date" value="${esc(ini.data)}"></div>
        <div class="campo"><label for="f_status">Status</label><select id="f_status">${UI.opcoes(N.STATUS_TREINO, ini.status)}</select></div>
        <div class="campo"><label for="f_dur">Duração (min)</label><input id="f_dur" type="number" min="0" step="5" value="${ini.duracao || ""}" placeholder="opcional"></div>
      </div>
      <div class="campo" id="f_grupos_box"${!t && ini.fichaId ? ' style="display:none"' : ""}><label>Grupos musculares</label>${UI.campoChips("f_grupos", N.GRUPOS_MUSCULARES, ini.grupos)}</div>
      <div class="campo"><label for="f_obs">Observações</label><input id="f_obs" value="${esc(ini.obs || "")}" placeholder="opcional"></div>
      ${UI.botoesModal(!!t, t ? "Salvar" : "Criar treino")}`, { largo: true });
    const sf = m.querySelector("#f_ficha");
    if (sf) sf.addEventListener("change", () => {
      m.querySelector("#f_nome_box").style.display = sf.value ? "none" : "";
      m.querySelector("#f_grupos_box").style.display = sf.value ? "none" : "";
    });
    m.querySelector("#btnSalvar").onclick = () => {
      const fichaId = sf ? sf.value : (t && t.fichaId);
      const nome = UI.texto("f_nome") || (fichaId ? F.ficha(d, fichaId).nome : "");
      if (!nome) { UI.toast("Escolha uma ficha ou dê um nome ao treino."); return; }
      let alvo = t;
      if (t) Object.assign(t, { nome, data: UI.valor("f_data") || t.data, status: UI.valor("f_status"), duracao: UI.numero("f_dur") || 0, grupos: UI.chips("f_grupos"), obs: UI.texto("f_obs") });
      else {
        alvo = F.iniciarTreino(d, { fichaId: fichaId || null, nome, data: UI.valor("f_data") || N.hoje(0), status: UI.valor("f_status"), duracao: UI.numero("f_dur"), grupos: UI.chips("f_grupos") });
        alvo.obs = UI.texto("f_obs");
      }
      if (alvo.status === "Realizado") F.seriesDoTreino(d, alvo.id).forEach((s) => { if (s.status === "Pendente") s.status = "Feito"; });
      UI.fecharModal();
      salvar(t ? "Treino atualizado." : "Treino criado.");
      if (!t) window.App.ir("treino", alvo.id);
    };
    if (t) m.querySelector("#btnExcluir").onclick = () => excluirTreino(t.id);
  }
  function excluirTreino(id) {
    const d = D();
    const t = F.treino(d, id);
    if (!t) return;
    confirmarExclusao(`Excluir "${t.nome}" de ${UI.dataCurta(t.data)} e as cargas registradas nele?`, () => window.App.comDesfazer("Treino excluído.", () => {
      F.excluirTreino(d, id);
      if (window.App.rota().secao === "treino") window.App.ir("academia");
    }));
  }
  function definirStatusTreino(id, status) {
    const d = D();
    const t = F.treino(d, id);
    if (!t) return;
    t.status = status;
    if (status === "Realizado") F.seriesDoTreino(d, t.id).forEach((s) => { if (s.status === "Pendente") s.status = "Feito"; });
    salvar(`${t.nome}: ${status.toLowerCase()}.`);
  }
  // registro rápido de treino: abre o de hoje, inicia o do plano ou cria um novo
  function treinoRapido() {
    const d = D();
    const th = F.treinoDeHoje(d);
    if (th && th.origem === "treino") { window.App.ir("treino", th.treino.id); return; }
    if (th && th.origem === "plano") {
      const t = F.iniciarTreino(d, { fichaId: th.plano.fichaId, nome: th.nome, data: N.hoje(0), grupos: th.plano.grupos });
      salvar("Treino de hoje iniciado a partir do plano.");
      window.App.ir("treino", t.id);
      return;
    }
    treino(null, { data: N.hoje(0) });
  }

  // =====================================================================
  // SÉRIE (exercício registrado dentro de um treino)
  // =====================================================================
  function serie(id, treinoId) {
    const d = D();
    const s = id ? d.series.find((x) => x.id === id) : null;
    const tId = s ? s.treinoId : treinoId;
    const t = F.treino(d, tId);
    const ini = s || { exercicio: "", grupo: (t && t.grupos && t.grupos[0]) || "Peito", series: 3, repeticoes: 10, carga: null, rpe: null, descanso: "", status: "Pendente", obs: "" };
    const ult = ini.exercicio ? F.ultimaExecucao(d, ini.exercicio, t ? t.data : null) : null;
    const m = UI.abrirModal(`
      <h3>${s ? "Registrar exercício" : "Adicionar exercício"}</h3>
      <div class="par">
        <div class="campo"><label for="f_nome">Exercício</label><input id="f_nome" list="lista_ex2" value="${esc(ini.exercicio)}" placeholder="Ex.: Supino reto"><datalist id="lista_ex2">${F.nomesExercicios(d).map((n) => `<option value="${esc(n)}">`).join("")}</datalist></div>
        <div class="campo"><label for="f_grupo">Grupo muscular</label><select id="f_grupo">${UI.opcoes(N.GRUPOS_MUSCULARES, ini.grupo)}</select></div>
      </div>
      <div class="ultima-vez" id="ultimaVez">${ult ? `Última vez (${UI.dataCurta(ult.data)}): <b>${ult.series}×${ult.repeticoes}</b> com <b>${UI.numAuto(ult.carga)} kg</b>${ult.rpe ? " · RPE " + ult.rpe : ""}` : ""}</div>
      <div class="grade-4">
        <div class="campo"><label for="f_series">Séries</label><input id="f_series" type="number" min="0" value="${ini.series == null ? "" : ini.series}"></div>
        <div class="campo"><label for="f_reps">Repetições</label><input id="f_reps" type="number" min="0" value="${ini.repeticoes == null ? "" : ini.repeticoes}"></div>
        <div class="campo"><label for="f_carga">Carga / peso utilizado (kg)</label><input id="f_carga" type="number" min="0" step="0.5" value="${N.temValor(ini.carga) ? ini.carga : ""}"></div>
        <div class="campo"><label for="f_rpe">RPE ${UI.dica("Percepção de esforço de 1 a 10. 10 = não conseguiria fazer nem mais uma repetição; 8 = sobrariam ~2 repetições.")}</label><select id="f_rpe">${UI.opcoes([6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((v) => ({ v, r: String(v).replace(".", ",") })), ini.rpe == null ? "" : ini.rpe, "—")}</select></div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_status">Status</label><select id="f_status">${UI.opcoes(N.STATUS_SERIE, s ? (ini.status === "Pendente" ? "Feito" : ini.status) : "Pendente")}</select></div>
        <div class="campo"><label for="f_desc">Descanso</label><input id="f_desc" value="${esc(ini.descanso || "")}" placeholder="60s"></div>
      </div>
      <div class="campo"><label for="f_obs">Observações</label><input id="f_obs" value="${esc(ini.obs || "")}" placeholder="ex.: subir 2 kg na próxima"></div>
      ${UI.botoesModal(!!s)}`, { largo: true });
    m.querySelector("#f_nome").addEventListener("change", () => {
      const u = F.ultimaExecucao(d, UI.valor("f_nome"), t ? t.data : null);
      m.querySelector("#ultimaVez").innerHTML = u ? `Última vez (${UI.dataCurta(u.data)}): <b>${u.series}×${u.repeticoes}</b> com <b>${UI.numAuto(u.carga)} kg</b>` : "";
      if (u && !UI.valor("f_carga")) m.querySelector("#f_carga").value = u.carga;
      if (u && u.grupo) m.querySelector("#f_grupo").value = u.grupo;
    });
    m.querySelector("#btnSalvar").onclick = () => {
      const nome = UI.texto("f_nome");
      if (!nome) { UI.toast("Informe o exercício."); return; }
      const reg = { exercicio: nome, grupo: UI.valor("f_grupo"), series: UI.numero("f_series") || 0, repeticoes: UI.numero("f_reps") || 0, carga: UI.numero("f_carga") || 0,
        rpe: UI.numero("f_rpe"), descanso: UI.texto("f_desc"), status: UI.valor("f_status"), obs: UI.texto("f_obs") };
      if (s) Object.assign(s, reg);
      else d.series.push(Object.assign({ id: N.novoId(), treinoId: tId, exercicioId: null, ordem: F.seriesDoTreino(d, tId).length + 1 }, reg));
      UI.fecharModal();
      salvar(s ? "Exercício salvo." : "Exercício adicionado.");
    };
    if (s) m.querySelector("#btnExcluir").onclick = () => confirmarExclusao(`Remover "${s.exercicio}" deste treino?`, () => window.App.comDesfazer("Exercício removido.", () => {
      d.series = d.series.filter((x) => x.id !== s.id);
    }));
  }

  // =====================================================================
  // PLANO SEMANAL
  // =====================================================================
  function plano(id, dia) {
    const d = D();
    const p = id ? d.planoSemanal.find((x) => x.id === id) : null;
    const fichas = F.fichasOrdenadas(d);
    const ini = p || { diaSemana: dia || 1, tipo: "treino", fichaId: fichas[0] ? fichas[0].id : "", treino: "", horario: "" };
    const m = UI.abrirModal(`
      <h3>${p ? "Editar dia do plano" : "Adicionar ao plano"}</h3>
      <div class="par">
        <div class="campo"><label for="f_dia">Dia da semana</label><select id="f_dia">${UI.opcoes([1, 2, 3, 4, 5, 6, 7].map((k) => ({ v: k, r: N.NOMES_DIA[k] })), ini.diaSemana)}</select></div>
        <div class="campo"><label for="f_tipo">Tipo</label><select id="f_tipo">${UI.opcoes([{ v: "treino", r: "Treino" }, { v: "descanso", r: "Descanso" }], ini.tipo)}</select></div>
      </div>
      <div id="f_treino_box"${ini.tipo === "descanso" ? ' style="display:none"' : ""}>
        <div class="par">
          <div class="campo"><label for="f_ficha">Ficha</label><select id="f_ficha">${UI.opcoes(fichas.map((f) => ({ v: f.id, r: f.nome })), ini.fichaId || "", "— outro (sem ficha) —")}</select></div>
          <div class="campo"><label for="f_hora">Horário</label><input id="f_hora" type="time" value="${esc(ini.horario || "")}"></div>
        </div>
        <div class="campo" id="f_nome_box"${ini.fichaId ? ' style="display:none"' : ""}><label for="f_nome">Nome</label><input id="f_nome" value="${esc(ini.treino || "")}" placeholder="Ex.: Cardio, Corrida"></div>
      </div>
      ${UI.botoesModal(!!p)}`);
    m.querySelector("#f_tipo").addEventListener("change", (e) => { m.querySelector("#f_treino_box").style.display = e.target.value === "descanso" ? "none" : ""; });
    m.querySelector("#f_ficha").addEventListener("change", (e) => { m.querySelector("#f_nome_box").style.display = e.target.value ? "none" : ""; });
    m.querySelector("#btnSalvar").onclick = () => {
      const tipo = UI.valor("f_tipo"), fichaId = tipo === "treino" ? UI.valor("f_ficha") || null : null;
      const nome = tipo === "descanso" ? "Descanso" : (fichaId ? F.ficha(d, fichaId).nome : UI.texto("f_nome"));
      if (!nome) { UI.toast("Escolha uma ficha ou dê um nome."); return; }
      const reg = { diaSemana: Number(UI.valor("f_dia")), tipo, fichaId, treino: nome, horario: tipo === "treino" ? UI.valor("f_hora") : "", grupos: fichaId ? (F.ficha(d, fichaId).grupos || []) : [] };
      if (p) Object.assign(p, reg);
      else {
        // descanso substitui o que houver no dia; treino substitui um descanso
        d.planoSemanal = d.planoSemanal.filter((x) => !(Number(x.diaSemana) === reg.diaSemana && (tipo === "descanso" || x.tipo === "descanso")));
        d.planoSemanal.push(Object.assign({ id: N.novoId(), usuarioId: d.usuarios[0].id, obs: "" }, reg));
      }
      UI.fecharModal();
      salvar("Plano atualizado.");
    };
    if (p) m.querySelector("#btnExcluir").onclick = () => { d.planoSemanal = d.planoSemanal.filter((x) => x.id !== p.id); UI.fecharModal(); salvar("Removido do plano."); };
  }

  // =====================================================================
  // META
  // =====================================================================
  function meta(id, tipoIni) {
    const d = D();
    let mt = id ? d.metas.find((x) => x.id === id) : null;
    if (!mt && tipoIni) mt = M.metaDoTipo(d, tipoIni); // uma meta ativa por tipo
    const tipo = mt ? mt.tipo : (tipoIni || "peso");
    const m = UI.abrirModal(`
      <h3>${mt ? "Editar meta" : "Nova meta"}</h3>
      <div class="campo"><label for="f_tipo">Tipo de meta</label><select id="f_tipo"${mt ? " disabled" : ""}>${UI.opcoes(Object.keys(M.TIPOS).map((k) => ({ v: k, r: M.TIPOS[k].icone + " " + M.TIPOS[k].rotulo })), tipo)}</select></div>
      <div class="campo"><label for="f_titulo">Descrição</label><input id="f_titulo" value="${esc(mt ? mt.titulo || "" : "")}" placeholder="opcional — ex.: Chegar a 75 kg"></div>
      <div id="metaCampos"></div>
      <div class="campo"><label for="f_obs">Observações</label><input id="f_obs" value="${esc(mt ? mt.obs || "" : "")}" placeholder="opcional"></div>
      ${UI.botoesModal(!!mt)}`, { largo: true });
    const campos = () => {
      const tp = UI.valor("f_tipo");
      const t = M.TIPOS[tp];
      const atual = M.valorAtual(d, tp);
      const unid = t.un === "R$" ? "R$" : t.un;
      const resultado = t.modo === "resultado";
      m.querySelector("#metaCampos").innerHTML = `
        <p class="ajuda">${atual == null ? "Ainda não há registros para este tipo — o sistema acompanha a partir dos próximos." : "Valor atual: <b>" + M.fmt(tp, atual) + "</b>" + (t.modo === "diaria" ? " (média dos últimos 7 dias)" : t.modo === "frequencia" ? " (média semanal recente)" : "") + "."}</p>
        <div class="${resultado ? "par3" : "par"}">
          ${resultado ? `<div class="campo"><label for="f_ini">Valor inicial (${unid}) ${UI.dica("Ponto de partida usado no cálculo do progresso. Por padrão, o valor atual.")}</label><input id="f_ini" type="number" step="any" value="${mt && N.temValor(mt.valorInicial) ? mt.valorInicial : atual == null ? "" : N.arred(atual, 1)}"></div>` : ""}
          <div class="campo"><label for="f_alvo">${t.modo === "limite" || t.modo === "limiteLista" ? "Limite" : "Objetivo"} (${unid})</label><input id="f_alvo" type="number" step="any" min="0" value="${mt ? mt.valorAlvo : ""}"></div>
          <div class="campo"><label for="f_prazo">Prazo ${t.modo === "resultado" ? "" : "(opcional)"}</label><input id="f_prazo" type="date" value="${esc(mt ? mt.prazo || "" : "")}"></div>
        </div>
        ${t.modo === "diaria" ? `<p class="ajuda">Esta meta também é usada como objetivo diário no resumo de Alimentação e no Dashboard.</p>` : ""}`;
    };
    campos();
    m.querySelector("#f_tipo").addEventListener("change", () => {
      const existente = M.metaDoTipo(d, UI.valor("f_tipo"));
      if (existente && !mt) { UI.fecharModal(); meta(existente.id); UI.toast("Já existe uma meta desse tipo — editando."); return; }
      campos();
    });
    m.querySelector("#btnSalvar").onclick = () => {
      const tp = UI.valor("f_tipo");
      const alvo = UI.numero("f_alvo");
      if (alvo == null) { UI.toast("Informe o valor desejado."); return; }
      const reg = { tipo: tp, titulo: UI.texto("f_titulo"), valorAlvo: alvo, prazo: UI.valor("f_prazo") || null, obs: UI.texto("f_obs") };
      if (M.TIPOS[tp].modo === "resultado") reg.valorInicial = UI.numero("f_ini");
      if (mt) Object.assign(mt, reg);
      else d.metas.push(Object.assign({ id: N.novoId(), dataInicio: N.hoje(0), criadoEm: new Date().toISOString(), ativa: true }, reg));
      UI.fecharModal();
      salvar(mt ? "Meta atualizada." : "Meta criada.");
    };
    if (mt) m.querySelector("#btnExcluir").onclick = () => confirmarExclusao("Excluir esta meta?", () => window.App.comDesfazer("Meta excluída.", () => {
      d.metas = d.metas.filter((x) => x.id !== mt.id);
    }));
  }

  // =====================================================================
  // PERFIL
  // =====================================================================
  function perfil() {
    const d = D();
    const u = d.usuarios[0];
    const m = UI.abrirModal(`
      <h3>Meu perfil</h3>
      <div class="par">
        <div class="campo"><label for="f_nome">Nome</label><input id="f_nome" value="${esc(u.nome || "")}" placeholder="Como quer ser chamado"></div>
        <div class="campo"><label for="f_obj">Objetivo</label><select id="f_obj">${UI.opcoes(N.OBJETIVOS, u.objetivo)}</select></div>
      </div>
      <div class="par3">
        <div class="campo"><label for="f_alt">Altura (m)</label><input id="f_alt" type="number" step="0.01" min="0.5" max="2.5" value="${u.altura || ""}" placeholder="1,75"></div>
        <div class="campo"><label for="f_pini">Peso inicial (kg) ${UI.dica("Opcional. Se vazio, o sistema usa a primeira pesagem registrada.")}</label><input id="f_pini" type="number" step="0.1" min="0" value="${u.pesoInicial || ""}"></div>
        <div class="campo"><label for="f_ini">Início do acompanhamento</label><input id="f_ini" type="date" value="${esc(u.dataInicio || N.hoje(0))}"></div>
      </div>
      ${UI.botoesModal(false)}`);
    m.querySelector("#btnSalvar").onclick = () => {
      const alt = UI.numero("f_alt");
      if (alt != null && (alt < 0.5 || alt > 2.5)) { UI.toast("Informe a altura em metros (ex.: 1,75)."); return; }
      Object.assign(u, { nome: UI.texto("f_nome") || "Eu", objetivo: UI.valor("f_obj"), altura: alt, pesoInicial: UI.numero("f_pini"), dataInicio: UI.valor("f_ini") || u.dataInicio });
      UI.fecharModal();
      salvar("Perfil atualizado.");
    };
  }

  // =====================================================================
  // ações globais dos formulários (botão "+", links em várias telas)
  // =====================================================================
  window.App.registrarAcoes({
    "rapido-peso": () => corpo(N.hoje(0), "peso"),
    "rapido-medida": () => corpo(N.hoje(0), "medidas"),
    "rapido-refeicao": () => refeicao(null, { data: N.hoje(0), status: "Realizada" }),
    "rapido-agua": () => agua(N.hoje(0)),
    "rapido-treino": () => treinoRapido(),
    "rapido-alimento": () => alimento(null),
    "rapido-compra": () => compra(null),

    "novo-alimento": () => alimento(null),
    "editar-alimento": (el) => alimento(el.dataset.id),
    "excluir-alimento": (el) => excluirAlimento(el.dataset.id),
    "nova-refeicao": (el) => refeicao(null, { data: el.dataset.data, tipo: el.dataset.tipo, status: el.dataset.status }),
    "editar-refeicao": (el) => refeicao(el.dataset.id),
    "excluir-refeicao": (el) => excluirRefeicao(el.dataset.id),
    "status-refeicao": (el) => definirStatusRefeicao(el.dataset.id, el.dataset.status),
    "ciclar-refeicao": (el) => {
      const r = AL.refeicao(D(), el.dataset.id);
      if (r) definirStatusRefeicao(r.id, r.status === "Realizada" ? "Planejada" : "Realizada");
    },
    "nova-favorita": () => favorita(null),
    "editar-favorita": (el) => favorita(el.dataset.id),
    "aplicar-favorita": (el) => aplicarFavorita(el.dataset.id, { data: el.dataset.data, tipo: el.dataset.tipo }),
    "salvar-favorita": (el) => {
      const d = D();
      const r = AL.refeicao(d, el.dataset.id);
      if (!r) return;
      const f = AL.favoritaDeRefeicao(d, r.id, r.tipo + " de " + UI.dataCurta(r.data));
      salvar(`Salva como favorita: "${f.nome}". Renomeie em Refeições → Favoritas.`);
    },
    "copiar-dia": (el) => copiarDia(el.dataset.data),
    "agua": (el) => agua(el.dataset.data),
    "registrar-corpo": (el) => corpo(el.dataset.data || N.hoje(0), el.dataset.foco || "peso"),
    "excluir-corpo": (el) => excluirRegistroCorpo(el.dataset.data),
    "nova-compra": (el) => compra(null, { alimentoId: el.dataset.alimento }),
    "editar-compra": (el) => compra(el.dataset.id),
    "excluir-compra": (el) => excluirCompra(el.dataset.id),
    "status-compra": (el) => definirStatusCompra(el.dataset.id, el.dataset.status),
    "alternar-comprado": (el) => {
      const c = C.compra(D(), el.dataset.id);
      if (c) definirStatusCompra(c.id, c.status === "Comprado" ? "Pendente" : "Comprado");
    },
    "novo-estoque": (el) => estoque(null, { alimentoId: el.dataset.alimento }),
    "editar-estoque": (el) => estoque(el.dataset.id),
    "add-necessidade": (el) => {
      const d = D();
      const it = C.adicionarNecessidade(d, el.dataset.alimento, el.dataset.ini, el.dataset.fim);
      if (it) salvar(`${it.nome} adicionado à lista de compras (${N.qtdLegivel(it.quantidade, it.unidade)}).`);
    },
    "nova-ficha": () => ficha(null),
    "editar-ficha": (el) => ficha(el.dataset.id),
    "novo-treino": (el) => treino(null, { data: el.dataset.data, fichaId: el.dataset.ficha }),
    "editar-treino": (el) => treino(el.dataset.id),
    "excluir-treino": (el) => excluirTreino(el.dataset.id),
    "status-treino": (el) => definirStatusTreino(el.dataset.id, el.dataset.status),
    "nova-serie": (el) => serie(null, el.dataset.treino),
    "editar-serie": (el) => serie(el.dataset.id),
    "novo-plano": (el) => plano(null, Number(el.dataset.dia) || 1),
    "editar-plano": (el) => plano(el.dataset.id),
    "nova-meta": (el) => meta(null, el.dataset.tipo || null),
    "editar-meta": (el) => meta(el.dataset.id),
    "editar-perfil": () => perfil()
  });

  window.Formularios = { alimento, refeicao, favorita, aplicarFavorita, copiarDia, agua, somarAgua, corpo, compra, estoque, ficha, treino, treinoRapido, serie, plano, meta, perfil,
    definirStatusRefeicao, definirStatusCompra, definirStatusTreino, resolverAlimento, tipoPelaHora };
})();
