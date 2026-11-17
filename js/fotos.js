/**
 * fotos.js
 * -----------------------------------------------------------------------
 * Corpo → aba "Fotos": fotos de evolução física com data, pose (frente,
 * lado, costas) e observação; "Antes e depois" lado a lado com o peso de
 * cada data; linha do tempo por mês.
 *
 * Os dados de cada foto (data, pose…) ficam em d.fotos; a imagem fica só
 * neste aparelho (imagens.js). Não aparece no perfil "Criança".
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo, UI = global.UI, F = global.Fitness, IM = global.Imagens;
  const esc = UI.esc;
  const App = () => global.App;
  const POSES = [{ k: "frente", r: "Frente" }, { k: "lado", r: "Lado" }, { k: "costas", r: "Costas" }, { k: "outra", r: "Outra" }];
  const rotPose = (k) => (POSES.find((p) => p.k === k) || POSES[3]).r;
  const st = { pose: "", antes: null, depois: null };
  const chave = (f) => "foto:" + f.id;

  function disponivel(d) { return d.config.perfilUso !== "crianca" && global.Areas.area(d, "evolucao"); }
  function ordenadas(d) { return (d.fotos || []).slice().sort((a, b) => a.data.localeCompare(b.data) || String(a.criadoEm || "").localeCompare(String(b.criadoEm || ""))); }
  // peso mais próximo da data da foto (até 7 dias de distância)
  function pesoPerto(d, data) {
    let melhor = null;
    d.pesagens.forEach((p) => { const dist = Math.abs(N.diasEntre(p.data, data)); if (dist <= 7 && (!melhor || dist < melhor.dist)) melhor = { dist, peso: p.peso }; });
    return melhor ? melhor.peso : null;
  }
  const quadro = (f, classe) => `<span class="ft-quadro ${classe || ""}" data-sem-foto><img data-img="${chave(f)}" alt="Foto de ${UI.dataBR(f.data)}, ${rotPose(f.pose).toLowerCase()}" loading="lazy"><span class="ft-falta">📷<small>foto em outro aparelho</small></span></span>`;

  function comparar(d, lista) {
    if (lista.length < 2) return "";
    const acha = (id) => lista.find((f) => f.id === id);
    const a = acha(st.antes) || lista[0], b = acha(st.depois) || lista[lista.length - 1];
    const pa = pesoPerto(d, a.data), pb = pesoPerto(d, b.data), dias = N.diasEntre(a.data, b.data);
    const op = (f) => ({ v: f.id, r: UI.dataBR(f.data) + " · " + rotPose(f.pose) });
    const lado = (f, rot, qual, peso) => `<div class="ft-lado"><button class="ft-abrir" data-acao="foto-ver" data-id="${f.id}" aria-label="Ampliar a foto">${quadro(f, "grande")}</button>
      <select class="sel" data-mudar="foto-comparar" data-qual="${qual}" aria-label="${rot}">${UI.opcoes(lista.map(op), f.id)}</select>
      <span class="ft-leg"><b>${rot}</b>${peso != null ? " · " + UI.kg(peso) : ""}</span></div>`;
    const tempo = dias >= 60 ? Math.round(dias / 30) + " meses" : dias + " " + UI.plural(dias, "dia", "dias");
    return UI.card({ titulo: "Antes e depois", sub: dias > 0 ? `${tempo} entre as duas fotos${pa != null && pb != null ? " · " + UI.sinal(pb - pa, 1, "kg") : ""}` : "escolha duas fotos para comparar", classe: "card-fotos-comp",
      corpo: `<div class="ft-comparar" data-sem-deslize>${lado(a, "Antes", "antes", pa)}${lado(b, "Depois", "depois", pb)}</div>` });
  }
  function galeria(d, lista) {
    if (!lista.length) return "";
    const porMes = {};
    lista.slice().reverse().forEach((f) => { (porMes[f.data.slice(0, 7)] || (porMes[f.data.slice(0, 7)] = [])).push(f); });
    return UI.card({ titulo: "Linha do tempo", sub: `${lista.length} ${UI.plural(lista.length, "foto", "fotos")} · toque para ampliar`,
      corpo: Object.keys(porMes).map((m) => `<div class="sechead ft-mes">${esc(UI.mesRotulo(m + "-01"))}</div><div class="ft-grade">${porMes[m].map((f) => `<button class="ft-item" data-acao="foto-ver" data-id="${f.id}">${quadro(f)}<span class="ft-info"><b>${UI.dataCurta(f.data)}</b><small>${rotPose(f.pose)}</small></span></button>`).join("")}</div>`).join("") });
  }
  function aba(d) {
    const todas = ordenadas(d), lista = st.pose ? todas.filter((f) => f.pose === st.pose) : todas;
    const poses = POSES.filter((p) => todas.some((f) => f.pose === p.k));
    const filtros = poses.length > 1 ? `<div class="chips-filtro ft-filtros"><button class="${!st.pose ? "ativo" : ""}" data-acao="foto-pose" data-k="">Todas</button>${poses.map((p) => `<button class="${st.pose === p.k ? "ativo" : ""}" data-acao="foto-pose" data-k="${p.k}">${p.r}</button>`).join("")}</div>` : "";
    if (!todas.length) return UI.card({ titulo: "Fotos de evolução", corpo: UI.vazio({ icone: "📸", titulo: "Nenhuma foto ainda.", texto: "A balança não mostra tudo. Tire uma foto por semana ou por mês — sempre no mesmo lugar, com a mesma luz e a mesma pose — e compare o antes e o depois.", acao: "nova-foto", rotulo: "Adicionar a primeira foto" }) }) + aviso(false);
    return filtros + `<div class="grid"><div class="c12">${comparar(d, lista)}</div></div><div class="grid"><div class="c12">${galeria(d, lista) || UI.card({ titulo: "Linha do tempo", corpo: `<div class="vazio"><p>Nenhuma foto com essa pose.</p></div>` })}</div></div>` + aviso(true);
  }
  function aviso(temFotos) {
    return `<div class="ft-aviso"><span>🔒</span><p><b>As fotos ficam só neste aparelho.</b> Elas não entram na sincronização nem no arquivo de backup.${temFotos ? " Para guardar uma cópia ou levar para outro aparelho, exporte." : ""}</p>
      <span class="botoes-linha">${temFotos ? `<button class="btn pequeno" data-acao="fotos-exportar">${UI.svg("download")}Exportar fotos</button>` : ""}<button class="btn pequeno" data-acao="fotos-importar">${UI.svg("upload")}Importar fotos</button></span></div>`;
  }

  // ---------------------------------------------------------------------
  // formulário
  // ---------------------------------------------------------------------
  function formulario(id) {
    const d = App().dados(), f = id ? d.fotos.find((x) => x.id === id) : null;
    let blob = null, pose = f ? f.pose : (st.pose || "frente");
    const m = UI.abrirModal(`<div id="fotoRaiz"><h3>${f ? "Editar foto" : "Nova foto"}</h3>
      <div class="ft-previa" id="ftPrevia">${f ? quadro(f, "grande") : `<span class="ft-vazia">📸<small>Escolha ou tire uma foto</small></span>`}</div>
      ${f ? "" : `<div class="botoes-linha ft-origem"><label class="btn primario">${UI.svg("mais")}Tirar foto<input type="file" accept="image/*" capture="environment" hidden></label><label class="btn">Escolher da galeria<input type="file" accept="image/*" hidden></label></div>`}
      <div class="par">
        <div class="campo"><label for="ft_data">Data</label><input id="ft_data" type="date" max="${N.hoje(0)}" value="${esc(f ? f.data : N.hoje(0))}"></div>
        <div class="campo"><label>Pose</label><div id="ftPose"></div></div>
      </div>
      <div class="campo"><label for="ft_obs">Observação</label><input id="ft_obs" value="${esc(f ? f.obs || "" : "")}" placeholder="opcional — ex.: fim do 1º mês de treino" maxlength="120"></div>
      <p class="ajuda">Dica: mesmo lugar, mesma luz e mesma distância deixam a comparação muito mais clara.</p>
      ${UI.botoesModal(!!f)}</div>`, { semFoco: true });
    const raiz = m.querySelector("#fotoRaiz");
    const desenharPose = () => { raiz.querySelector("#ftPose").innerHTML = global.Personalizar.seg("ft-pose", POSES, pose); };
    desenharPose();
    raiz.addEventListener("click", (e) => { const b = e.target.closest("[data-acao='ft-pose']"); if (b) { pose = b.dataset.k; desenharPose(); } });
    raiz.addEventListener("change", (e) => {
      const arq = e.target.type === "file" && e.target.files[0];
      if (!arq) return;
      raiz.querySelector("#ftPrevia").innerHTML = `<span class="ft-vazia">⏳<small>Preparando a foto…</small></span>`;
      IM.reduzir(arq).then((b) => { blob = b; raiz.querySelector("#ftPrevia").innerHTML = `<span class="ft-quadro grande"><img class="carregada" src="${URL.createObjectURL(b)}" alt="Prévia"></span>`; })
        .catch((err) => { raiz.querySelector("#ftPrevia").innerHTML = `<span class="ft-vazia">⚠️<small>${esc(err.message)}</small></span>`; });
    });
    raiz.querySelector("#btnSalvar").onclick = () => {
      const data = UI.valor("ft_data") || N.hoje(0);
      if (data > N.hoje(0)) { UI.toast("A data não pode ser no futuro."); return; }
      if (f) { Object.assign(f, { data, pose, obs: UI.texto("ft_obs") }); UI.fecharModal(); App().salvar("Foto atualizada.", { semIntegracao: true }); return; }
      if (!blob) { UI.toast("Escolha ou tire uma foto primeiro."); return; }
      const nova = { id: N.novoId(), data, pose, obs: UI.texto("ft_obs"), criadoEm: new Date().toISOString() };
      const b = raiz.querySelector("#btnSalvar"); b.disabled = true;
      IM.salvar(chave(nova), blob).then(() => {
        d.fotos.push(nova);
        UI.fecharModal();
        App().salvar("Foto guardada neste aparelho.", { semIntegracao: true });
        if (App().rota().secao !== "evolucao" || App().rota().param !== "fotos") App().ir("evolucao", "fotos");
      }).catch((err) => { b.disabled = false; UI.toast(err.message || "Não consegui guardar a foto."); });
    };
    if (f) raiz.querySelector("#btnExcluir").onclick = () => excluir(f.id);
  }
  function excluir(id) {
    UI.confirmar({ titulo: "Excluir foto", texto: "A foto será apagada deste aparelho. Não dá para recuperar depois de fechar o app.", rotulo: "Excluir",
      aoConfirmar: () => App().comDesfazer("Foto excluída.", () => { const d = App().dados(); d.fotos = d.fotos.filter((x) => x.id !== id); }) });
  }
  function ver(id) {
    const d = App().dados(), lista = ordenadas(d), i = lista.findIndex((x) => x.id === id), f = lista[i];
    if (!f) return;
    const peso = pesoPerto(d, f.data);
    const m = UI.abrirModal(`<div class="ft-ver" data-sem-deslize>
      <div class="ft-ver-img">${quadro(f, "inteira")}</div>
      <div class="ft-ver-nav"><button class="btn pequeno" data-acao="foto-ver" data-id="${i > 0 ? lista[i - 1].id : ""}"${i > 0 ? "" : " disabled"} aria-label="Foto anterior">‹</button>
        <div><b>${esc(UI.dataLonga(f.data))} de ${f.data.slice(0, 4)}</b><small>${rotPose(f.pose)}${peso != null ? " · " + UI.kg(peso) : ""}${f.obs ? " · " + esc(f.obs) : ""}</small></div>
        <button class="btn pequeno" data-acao="foto-ver" data-id="${i < lista.length - 1 ? lista[i + 1].id : ""}"${i < lista.length - 1 ? "" : " disabled"} aria-label="Próxima foto">›</button></div>
      <div class="modal-acoes"><button class="btn" data-acao="foto-editar" data-id="${f.id}">${UI.svg("editar")}Editar</button><button class="btn" data-acao="foto-baixar" data-id="${f.id}">${UI.svg("download")}Baixar</button><button class="btn perigo" data-acao="foto-excluir" data-id="${f.id}">Excluir</button></div></div>`, { largo: true, semFoco: true });
    m.classList.add("modal-foto");
  }
  function baixarArquivo(nome, blobOuTexto, tipo) {
    const b = blobOuTexto instanceof Blob ? blobOuTexto : new Blob([blobOuTexto], { type: tipo || "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function importarArquivo() {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/json,.json";
    inp.onchange = () => {
      const arq = inp.files[0]; if (!arq) return;
      arq.text().then((t) => IM.importar(JSON.parse(t))).then((n) => { UI.toast(`${n} ${UI.plural(n, "foto importada", "fotos importadas")}.`); App().renderizar(); })
        .catch((e) => UI.toast(e instanceof SyntaxError ? "Esse arquivo não é uma cópia de fotos do Meu Controle." : e.message));
    };
    inp.click();
  }

  App().registrarAcoes({
    "nova-foto": () => { if (!disponivel(App().dados())) { UI.toast("As fotos de evolução não estão disponíveis neste perfil."); return; } formulario(null); },
    "foto-editar": (el) => formulario(el.dataset.id),
    "foto-ver": (el) => { if (el.dataset.id) ver(el.dataset.id); },
    "foto-excluir": (el) => excluir(el.dataset.id),
    "foto-pose": (el) => { st.pose = el.dataset.k; st.antes = st.depois = null; App().renderizar(); },
    "foto-baixar": (el) => { const f = App().dados().fotos.find((x) => x.id === el.dataset.id); if (f) IM.ler(chave(f)).then((b) => b ? baixarArquivo(`foto-${f.data}-${f.pose}.jpg`, b) : UI.toast("Essa foto não está neste aparelho.")); },
    "fotos-exportar": () => { UI.toast("Preparando as fotos…"); IM.exportar(["foto:", "prod:"]).then((o) => { if (!o.itens.length) { UI.toast("Não há fotos neste aparelho."); return; } baixarArquivo(`meu-controle-fotos-${N.hoje(0)}.json`, JSON.stringify(o)); UI.toast(`${o.itens.length} ${UI.plural(o.itens.length, "foto exportada", "fotos exportadas")} (inclui os rótulos dos produtos).`); }).catch((e) => UI.toast(e.message)); },
    "fotos-importar": importarArquivo
  });
  App().registrarMudancas({
    "foto-comparar": (el) => { st[el.dataset.qual] = el.value; App().renderizar(); }
  });

  global.Fotos = { POSES, aba, disponivel, ordenadas, baixarArquivo };
})(window);
