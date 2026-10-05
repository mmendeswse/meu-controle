/**
 * armazenamento.js
 * -----------------------------------------------------------------------
 * Camada de persistência do Meu Controle. Tudo fica em uma única chave do
 * localStorage, como um objeto JSON. Este arquivo não sabe nada sobre a
 * interface — só salva, carrega, migra, exporta, importa e apaga.
 *
 * MODELO DE DADOS (versão 2) — cada coleção é uma "tabela":
 *
 *   usuarios        users              perfil único de quem usa
 *   alimentos       foods              cadastro com nutrição e preço
 *   refeicoes       meals              data, tipo, horário, status
 *   refeicaoItens   meal_items         refeicaoId → alimentoId + quantidade
 *   favoritas       (refeições modelo) nome + itens [{alimentoId, qtd}]
 *   agua            (registro de água) data + ml
 *   compras         shopping_items     lista de compras / compras feitas
 *   estoque         inventory          alimentoId → quantidade em casa
 *   fichas          (fichas de treino) "Treino A — Peito + Tríceps"
 *   exercicios      exercises          fichaId → séries/reps alvo
 *   treinos         workouts           sessão de treino por data
 *   series          workout_sets       treinoId → séries, reps, carga, RPE
 *   planoSemanal    (calendário)       dia da semana → ficha
 *   pesagens        weight_records     data + peso
 *   medidas         body_measurements  composição corporal e medidas
 *   metas           goals              tipo, valor inicial, alvo, prazo
 *   notificacoes    notifications      estado (lida) dos alertas gerados
 *   config          settings           preferências, alertas, integração
 *
 * Relações por id (nunca copiando dados): um item de refeição aponta para
 * o alimento; o estoque e a compra também. Peso atual, IMC, calorias do
 * dia, gastos do mês etc. NÃO são armazenados — são sempre calculados.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo;
  const CHAVE = "meuControle:v1"; // a chave é a mesma desde a v1 (o objeto tem `versao`)
  const VERSAO = 2;
  const ouvintes = [];

  function lerBruto() {
    try { return localStorage.getItem(CHAVE); } catch (e) { return null; }
  }
  function gravarBruto(texto) { localStorage.setItem(CHAVE, texto); }

  function aoMudar(fn) { if (typeof fn === "function") ouvintes.push(fn); }
  function notificar() {
    ouvintes.forEach((fn) => { try { fn(); } catch (e) { console.error("Erro em ouvinte de dados:", e); } });
  }

  // ---------------------------------------------------------------------
  // esquema
  // ---------------------------------------------------------------------
  function perfilPadrao() {
    return { id: N.novoId(), nome: "Eu", altura: null, pesoInicial: null, objetivo: "Saúde e bem-estar", dataInicio: N.hoje(0), obs: "" };
  }
  const TIPOS_ALERTA = {
    treinoNaoRealizado: "Treino planejado não realizado",
    pesoSemRegistro: "Peso sem registro há vários dias",
    estoqueBaixo: "Estoque abaixo do mínimo",
    itemImportante: "Item de alta prioridade pendente",
    metaAtrasada: "Meta atrasada ou fora do ritmo",
    refeicaoPlanejada: "Próxima refeição planejada",
    aguaAbaixo: "Água abaixo da meta",
    proteinaAbaixo: "Proteína abaixo da meta",
    mudancaRelevante: "Mudança relevante nas métricas",
    backupAntigo: "Backup antigo"
  };
  function configPadrao() {
    const alertas = {};
    Object.keys(TIPOS_ALERTA).forEach((k) => { alertas[k] = true; });
    return {
      ultimoBackup: null,
      alertas,
      diasSemPesagem: 7,
      copoAgua: 250,
      integracao: {
        baixarEstoqueAoComer: true,   // refeição realizada desconta do estoque
        somarEstoqueAoComprar: true,  // item comprado entra no estoque
        listaAutomatica: true,        // planejamento + estoque mínimo geram a lista
        diasPlanejamento: 7           // quantos dias à frente o planejamento olha
      },
      boasVindas: true
    };
  }
  function esquemaVazio() {
    return {
      versao: VERSAO,
      demo: false,
      usuarios: [perfilPadrao()],
      alimentos: [], refeicoes: [], refeicaoItens: [], favoritas: [], agua: [],
      compras: [], estoque: [],
      fichas: [], exercicios: [], treinos: [], series: [], planoSemanal: [],
      pesagens: [], medidas: [],
      metas: [],
      notificacoes: [],
      config: configPadrao(),
      atualizadoEm: null
    };
  }
  const COLECOES = ["alimentos", "refeicoes", "refeicaoItens", "favoritas", "agua", "compras", "estoque", "fichas", "exercicios", "treinos", "series", "planoSemanal", "pesagens", "medidas", "metas", "notificacoes"];

  function perfil(d) { return d.usuarios[0]; }

  // ---------------------------------------------------------------------
  // migração v1 → v2 (preserva tudo o que o usuário já registrou)
  // ---------------------------------------------------------------------
  const MAPA_CATEGORIA_V1 = {
    "Carnes": "Proteínas", "Frango": "Proteínas", "Peixes": "Proteínas", "Ovos": "Proteínas",
    "Grãos": "Carboidratos", "Padaria": "Carboidratos", "Laticínios": "Laticínios", "Verduras": "Verduras",
    "Legumes": "Legumes", "Frutas": "Frutas", "Bebidas": "Bebidas"
  };
  const UNIDADE_BASE_V1 = { kg: "g", g: "g", L: "ml", ml: "ml", un: "un", dz: "un", pct: "porção", cx: "porção" };

  function migrarV1(v1) {
    const d = esquemaVazio();
    d.demo = !!v1.demo;
    d.atualizadoEm = v1.atualizadoEm || null;
    if (Array.isArray(v1.usuarios) && v1.usuarios.length) {
      const u = v1.usuarios[0];
      d.usuarios = [{ id: u.id || N.novoId(), nome: u.nome || "Eu", altura: u.altura || null, pesoInicial: u.pesoInicial || null,
        objetivo: u.objetivo || "Saúde e bem-estar", dataInicio: u.dataInicio || N.hoje(0), obs: u.obs || "" }];
    }
    const uid = d.usuarios[0].id;
    if (v1.config && v1.config.ultimoBackup) d.config.ultimoBackup = v1.config.ultimoBackup;

    // catálogo de produtos → alimentos (mantém os ids, as compras apontam para eles)
    (v1.produtos || []).forEach((p) => {
      const base = UNIDADE_BASE_V1[p.unidade] || "porção";
      d.alimentos.push({
        id: p.id, nome: p.nome, emoji: p.emoji || "", categoria: MAPA_CATEGORIA_V1[p.categoria] || "Outros", marca: "",
        porcao: base === "g" || base === "ml" ? 100 : 1, unidade: base,
        kcal: null, proteina: null, carbo: null, gordura: null, fibra: null,
        preco: N.temValor(p.precoRef) ? Number(p.precoRef) : null, precoQtd: 1, precoUnidade: p.unidade || N.unidadeCompraPadrao(base),
        mercado: p.local || "Mercado", obs: "", criadoEm: N.hoje(0)
      });
    });
    function alimentoPorNome(nome, emoji, unidadeItem, categoria) {
      const chave = String(nome || "").trim().toLowerCase();
      let a = d.alimentos.filter((x) => x.nome.toLowerCase() === chave)[0];
      if (a) return a;
      const base = UNIDADE_BASE_V1[unidadeItem] || unidadeItem || "porção";
      a = { id: N.novoId(), nome: String(nome || "Alimento").trim(), emoji: emoji || "", categoria: categoria || "Outros", marca: "",
        porcao: base === "g" || base === "ml" ? 100 : 1, unidade: base,
        kcal: null, proteina: null, carbo: null, gordura: null, fibra: null,
        preco: null, precoQtd: 1, precoUnidade: N.unidadeCompraPadrao(base), mercado: "Mercado", obs: "", criadoEm: N.hoje(0) };
      d.alimentos.push(a);
      return a;
    }

    // refeições: na v1 cada linha era um alimento; agora a refeição agrupa itens
    const grupos = {};
    (v1.refeicoes || []).forEach((r) => {
      const k = (r.data || "") + "|" + (r.horario || "") + "|" + (r.tipo || "");
      (grupos[k] = grupos[k] || []).push(r);
    });
    Object.keys(grupos).forEach((k) => {
      const linhas = grupos[k], r0 = linhas[0];
      const realizadas = linhas.filter((x) => x.status === "Realizada").length;
      const puladas = linhas.filter((x) => x.status === "Pulada").length;
      const ref = { id: N.novoId(), usuarioId: uid, data: r0.data || N.hoje(0), tipo: N.TIPOS_REFEICAO.indexOf(r0.tipo) !== -1 ? r0.tipo : "Almoço",
        horario: r0.horario || "", status: realizadas ? "Realizada" : (puladas === linhas.length ? "Pulada" : "Planejada"), favoritaId: null, obs: "" };
      d.refeicoes.push(ref);
      linhas.forEach((x) => {
        const a = alimentoPorNome(x.alimento, x.emoji, x.unidade);
        let qtd = Number(x.quantidade) || 0, un = x.unidade || a.unidade;
        const conv = N.converter(qtd, un, a.unidade);
        if (conv != null) { qtd = conv; un = a.unidade; }
        d.refeicaoItens.push({ id: N.novoId(), refeicaoId: ref.id, alimentoId: a.id, quantidade: qtd, unidade: un });
      });
    });

    // compras
    const STATUS = { "Planejado": "Pendente", "Comprar": "Pendente", "Comprado": "Comprado", "Não comprado": "Cancelado" };
    (v1.compras || []).forEach((c) => {
      const st = STATUS[c.status] || "Pendente";
      const total = (Number(c.quantidade) || 0) * (Number(c.precoUnit) || 0);
      let alimentoId = c.produtoId && d.alimentos.some((a) => a.id === c.produtoId) ? c.produtoId : null;
      if (!alimentoId && c.nome) alimentoId = alimentoPorNome(c.nome, c.emoji, c.unidade, MAPA_CATEGORIA_V1[c.categoria]).id;
      d.compras.push({
        id: c.id || N.novoId(), usuarioId: uid, alimentoId, nome: c.nome || "Item", categoria: MAPA_CATEGORIA_V1[c.categoria] || "Outros",
        quantidade: Number(c.quantidade) || 0, unidade: c.unidade || "un",
        precoEstimado: total || null, precoPago: st === "Comprado" ? total : null,
        mercado: c.local || "Mercado", prioridade: c.prioridade === "Alta" ? "Alta" : c.prioridade === "Baixa" ? "Baixa" : "Normal",
        status: st, dataCompra: st === "Comprado" ? (c.data || null) : null, dataPrevista: st !== "Comprado" ? (c.data || null) : null,
        origem: "manual", auto: false, motivo: "", criadoEm: c.data || N.hoje(0), obs: c.obs || ""
      });
    });

    // treinos e exercícios realizados (os registros de carga viram "series")
    (v1.treinos || []).forEach((t) => {
      d.treinos.push({ id: t.id, usuarioId: uid, fichaId: null, nome: t.nome || "Treino", data: t.data || N.hoje(0),
        grupos: Array.isArray(t.grupos) ? t.grupos : [], status: t.status === "Adiado" ? "Planejado" : (N.STATUS_TREINO.indexOf(t.status) !== -1 ? t.status : "Planejado"),
        duracao: Number(t.duracao) || 0, obs: t.obs || "" });
    });
    const ordemPorTreino = {};
    (v1.exercicios || []).forEach((e) => {
      ordemPorTreino[e.treinoId] = (ordemPorTreino[e.treinoId] || 0) + 1;
      d.series.push({ id: e.id || N.novoId(), treinoId: e.treinoId, exercicioId: null, exercicio: e.nome || "Exercício", grupo: e.grupo || "",
        ordem: ordemPorTreino[e.treinoId], series: Number(e.series) || 0, repeticoes: Number(e.repeticoes) || 0, carga: Number(e.carga) || 0,
        rpe: null, descanso: e.descanso || "", status: N.STATUS_SERIE.indexOf(e.status) !== -1 ? e.status : "Feito", obs: e.obs || "" });
    });
    (v1.planoSemanal || []).forEach((p) => {
      const descanso = String(p.treino || "").trim().toLowerCase() === "descanso";
      d.planoSemanal.push({ id: p.id || N.novoId(), usuarioId: uid, diaSemana: Number(p.diaSemana) || 1, fichaId: null,
        treino: p.treino || "", grupos: p.grupos || [], horario: p.horario || "", tipo: descanso ? "descanso" : "treino", obs: p.obs || "" });
    });
    (v1.pesagens || []).forEach((p) => {
      d.pesagens.push({ id: p.id || N.novoId(), usuarioId: uid, data: p.data, peso: Number(p.peso), altura: p.altura || null, obs: p.obs || "" });
    });
    return d;
  }

  // completa chaves que faltem (backups de versões intermediárias, etc.)
  function normalizar(d) {
    if (!d || typeof d !== "object") return esquemaVazio();
    if (!d.versao || d.versao < 2) d = migrarV1(d);
    const base = esquemaVazio();
    Object.keys(base).forEach((k) => { if (d[k] === undefined) d[k] = base[k]; });
    COLECOES.forEach((k) => { if (!Array.isArray(d[k])) d[k] = []; });
    if (!Array.isArray(d.usuarios) || !d.usuarios.length) d.usuarios = [perfilPadrao()];
    if (d.usuarios.length > 1) d.usuarios = [d.usuarios[0]];
    const cfg = configPadrao();
    d.config = Object.assign({}, cfg, d.config || {});
    d.config.alertas = Object.assign({}, cfg.alertas, (d.config && d.config.alertas) || {});
    d.config.integracao = Object.assign({}, cfg.integracao, (d.config && d.config.integracao) || {});
    d.versao = VERSAO;
    return d;
  }

  // ---------------------------------------------------------------------
  // carregar / salvar
  // ---------------------------------------------------------------------
  let cache = null;
  function carregarDados() {
    if (cache) return cache;
    const bruto = lerBruto();
    if (!bruto) {
      cache = esquemaVazio();
      salvarDados(cache, true, true);
      return cache;
    }
    try {
      const obj = JSON.parse(bruto);
      const versaoAntes = obj && obj.versao;
      cache = normalizar(obj);
      if (versaoAntes !== VERSAO) {
        // guarda uma cópia da versão antiga antes de migrar (segurança)
        try { localStorage.setItem(CHAVE + ":antes-da-v" + VERSAO, bruto); } catch (e) { /* sem espaço: segue */ }
        salvarDados(cache, true, true);
      }
      return cache;
    } catch (e) {
      console.error("Dados corrompidos — guardando cópia e recomeçando vazio.", e);
      try { localStorage.setItem(CHAVE + ":corrompido", bruto); } catch (e2) { /* ignora */ }
      cache = esquemaVazio();
      salvarDados(cache, true, true);
      return cache;
    }
  }

  function salvarDados(dados, semNotificar, semCarimbo) {
    cache = dados;
    if (!semCarimbo) dados.atualizadoEm = new Date().toISOString();
    try {
      gravarBruto(JSON.stringify(dados));
    } catch (e) {
      console.error("Não foi possível salvar os dados:", e);
      if (global.UI && global.UI.toast) global.UI.toast("Não consegui salvar — armazenamento cheio ou bloqueado.");
    }
    if (!semNotificar) notificar();
  }

  function substituir(dados) {
    const d = normalizar(dados);
    salvarDados(d);
    return d;
  }

  // reset completo: volta ao sistema vazio (com tela de boas-vindas)
  function resetCompleto() {
    try { localStorage.removeItem(CHAVE + ":antes-da-v" + VERSAO); } catch (e) { /* ignora */ }
    const vazio = esquemaVazio();
    salvarDados(vazio);
    return vazio;
  }
  // apaga só os registros, mantendo perfil e configurações
  function limparRegistros(d) {
    const novo = esquemaVazio();
    novo.usuarios = [Object.assign({}, perfil(d), { nome: d.demo ? "Eu" : perfil(d).nome })];
    novo.config = Object.assign({}, d.config, { boasVindas: false });
    salvarDados(novo);
    return novo;
  }

  // grupos de exclusão parcial (Configurações → Excluir dados)
  const GRUPOS_EXCLUSAO = {
    refeicoes: { rotulo: "Refeições e água", colecoes: ["refeicoes", "refeicaoItens", "agua"], ajuda: "Diário e planejamento de refeições e registros de água." },
    favoritas: { rotulo: "Refeições favoritas", colecoes: ["favoritas"], ajuda: "Modelos como “Almoço padrão”." },
    compras: { rotulo: "Lista de compras e gastos", colecoes: ["compras"], ajuda: "Itens pendentes e o histórico de compras (os gastos são calculados a partir dele)." },
    estoque: { rotulo: "Estoque", colecoes: ["estoque"], ajuda: "Quantidades em casa e estoques mínimos." },
    treinos: { rotulo: "Treinos realizados", colecoes: ["treinos", "series"], ajuda: "Sessões de treino e cargas registradas." },
    fichas: { rotulo: "Fichas e plano semanal", colecoes: ["fichas", "exercicios", "planoSemanal"], ajuda: "Fichas de treino e o calendário semanal." },
    corpo: { rotulo: "Peso e medidas", colecoes: ["pesagens", "medidas"], ajuda: "Pesagens, composição corporal e medidas." },
    metas: { rotulo: "Metas", colecoes: ["metas"], ajuda: "Todas as metas cadastradas." },
    alimentos: { rotulo: "Cadastro de alimentos", colecoes: ["alimentos", "refeicaoItens", "favoritas", "estoque"], ajuda: "Os alimentos e tudo que depende deles (itens das refeições, favoritas e estoque)." }
  };
  function apagarGrupo(d, chave) {
    const g = GRUPOS_EXCLUSAO[chave];
    if (!g) return 0;
    let n = 0;
    g.colecoes.forEach((c) => { n += d[c].length; d[c] = []; });
    return n;
  }

  // ---------------------------------------------------------------------
  // backup
  // ---------------------------------------------------------------------
  function baixarArquivo(nome, conteudo, tipo) {
    const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function exportarDados() {
    const dados = carregarDados();
    dados.config.ultimoBackup = new Date().toISOString();
    salvarDados(dados, false, true);
    baixarArquivo("meu-controle-backup-" + N.hoje(0) + ".json", JSON.stringify(dados, null, 2), "application/json");
  }
  function validarBackup(obj) {
    return !!(obj && typeof obj === "object" && Array.isArray(obj.usuarios));
  }
  function importarDados(arquivo) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => {
        let obj;
        try { obj = JSON.parse(leitor.result); } catch (e) {
          reject(new Error("Não consegui ler esse arquivo. Verifique se é o JSON exportado pelo próprio sistema.")); return;
        }
        if (!validarBackup(obj)) { reject(new Error("Esse arquivo não parece ser um backup do Meu Controle.")); return; }
        resolve(substituir(obj));
      };
      leitor.onerror = () => reject(new Error("Falha ao ler o arquivo."));
      leitor.readAsText(arquivo);
    });
  }

  function carregarExemplo() {
    const demo = global.Demo.gerar(esquemaVazio());
    if (global.Compras && global.Compras.sincronizarAutomaticos) global.Compras.sincronizarAutomaticos(demo);
    salvarDados(demo);
    return demo;
  }

  function usoArmazenamento() {
    const b = lerBruto();
    return b ? b.length * 2 : 0; // UTF-16 ≈ 2 bytes por caractere
  }

  global.Armazenamento = {
    VERSAO, COLECOES, TIPOS_ALERTA, GRUPOS_EXCLUSAO,
    carregarDados, salvarDados, substituir, resetCompleto, limparRegistros, apagarGrupo,
    perfil, carregarExemplo, exportarDados, importarDados, validarBackup, baixarArquivo, usoArmazenamento,
    esquemaVazio, configPadrao, migrarV1, normalizar,
    novoId: N.novoId, hoje: N.hoje, isoLocal: N.isoLocal, aoMudar
  };
})(window);
