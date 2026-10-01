/**
 * armazenamento.js
 * -----------------------------------------------------------------------
 * Camada de persistência do Meu Controle (Vida & Fitness).
 *
 * Tudo é guardado em uma única chave do localStorage, como um objeto
 * JSON. Este arquivo não sabe nada sobre a interface — só sabe salvar,
 * carregar, exportar, importar e apagar dados, e oferece um pequeno
 * barramento de eventos para que a interface saiba quando os dados
 * mudaram e precise se redesenhar.
 *
 * Funções públicas (todas em window.Armazenamento):
 *   carregarDados()      -> objeto de dados atual (nunca null)
 *   salvarDados(dados)   -> grava no localStorage e notifica ouvintes
 *   exportarDados()      -> dispara o download de um backup .json
 *   importarDados(file)  -> Promise<void>, lê um backup e substitui os dados
 *   limparDados()        -> apaga tudo e recomeça do zero (sem exemplo)
 *   carregarExemplo()    -> repõe os dados de demonstração
 *   novoId()             -> gera um identificador único simples
 *   hoje(offsetDias)     -> "AAAA-MM-DD" de hoje (ou N dias antes/depois)
 *   aoMudar(fn)          -> registra um ouvinte chamado após cada gravação
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  var CHAVE = "meuControle:v1";
  var ouvintes = [];

  function lerBruto() {
    try { return localStorage.getItem(CHAVE); } catch (e) { return null; }
  }
  function gravarBruto(texto) {
    localStorage.setItem(CHAVE, texto);
  }

  // ---------------------------------------------------------------------
  // utilidades
  // ---------------------------------------------------------------------
  function novoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // data local (sem UTC, para o "hoje" não virar "amanhã" à noite)
  function isoLocal(dt) {
    return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
  }
  function hoje(offsetDias) {
    var d = new Date();
    if (offsetDias) d.setDate(d.getDate() + offsetDias);
    return isoLocal(d);
  }

  function aoMudar(fn) {
    if (typeof fn === "function") ouvintes.push(fn);
  }
  function notificar() {
    ouvintes.forEach(function (fn) {
      try { fn(); } catch (e) { console.error("Erro em ouvinte de dados:", e); }
    });
  }

  // ---------------------------------------------------------------------
  // esquema vazio (usuário que zera tudo cai aqui)
  // ---------------------------------------------------------------------
  function esquemaVazio() {
    return {
      versao: 1,
      demo: false,
      usuarios: [],        // pessoas que usam o sistema (cada registro pertence a uma)
      produtos: [],        // catálogo de produtos (nome, categoria, preço de referência)
      compras: [],         // itens da lista de compras / compras feitas
      refeicoes: [],       // um alimento de uma refeição, com horário
      planoSemanal: [],    // treino previsto para cada dia da semana
      treinos: [],         // treinos por data (planejado / realizado …)
      exercicios: [],      // exercícios de cada treino (séries, repetições, carga)
      pesagens: [],        // registros de peso
      notificacoesLidas: [],
      atualizadoEm: null,
      config: { ultimoBackup: null, usuarioAtivo: "" }
    };
  }

  // ---------------------------------------------------------------------
  // dados de demonstração — claramente marcados (demo:true) para que a
  // interface possa avisar o usuário e oferecer removê-los com um clique.
  // São fictícios: servem só para mostrar como o sistema funciona.
  // ---------------------------------------------------------------------
  function dadosDemo() {
    var d = esquemaVazio();
    d.demo = true;

    var ana = novoId(), joao = novoId();
    d.usuarios = [
      { id: ana, nome: "Ana (exemplo)", altura: 1.65, pesoInicial: 68, objetivo: "Emagrecer", dataInicio: hoje(-57), cor: "#FF5C6A", ativo: true, obs: "Perfil de exemplo — pode editar ou apagar." },
      { id: joao, nome: "João (exemplo)", altura: 1.78, pesoInicial: 82.5, objetivo: "Ganhar massa", dataInicio: hoje(-26), cor: "#38B6FF", ativo: true, obs: "Perfil de exemplo — pode editar ou apagar." }
    ];

    var pBanana = novoId(), pMaca = novoId(), pBrocolis = novoId(), pArroz = novoId(), pOvos = novoId(), pLeite = novoId(), pFrango = novoId(), pCarne = novoId();
    d.produtos = [
      { id: pBanana, nome: "Banana", emoji: "🍌", categoria: "Frutas", unidade: "kg", precoRef: 6, local: "Feira" },
      { id: pMaca, nome: "Maçã", emoji: "🍎", categoria: "Frutas", unidade: "kg", precoRef: 9, local: "Feira" },
      { id: pBrocolis, nome: "Brócolis", emoji: "🥦", categoria: "Verduras", unidade: "un", precoRef: 5, local: "Feira" },
      { id: pArroz, nome: "Arroz", emoji: "🍚", categoria: "Grãos", unidade: "kg", precoRef: 6, local: "Mercado" },
      { id: pOvos, nome: "Ovos", emoji: "🥚", categoria: "Ovos", unidade: "dz", precoRef: 10, local: "Mercado" },
      { id: pLeite, nome: "Leite", emoji: "🥛", categoria: "Laticínios", unidade: "L", precoRef: 5, local: "Mercado" },
      { id: pFrango, nome: "Peito de frango", emoji: "🍗", categoria: "Frango", unidade: "kg", precoRef: 22, local: "Açougue" },
      { id: pCarne, nome: "Carne (patinho)", emoji: "🥩", categoria: "Carnes", unidade: "kg", precoRef: 42, local: "Açougue" }
    ];

    function compra(u, p, qtd, preco, status, data, prioridade) {
      var prod = d.produtos.filter(function (x) { return x.id === p; })[0];
      return { id: novoId(), usuarioId: u, produtoId: p, nome: prod.nome, emoji: prod.emoji, categoria: prod.categoria, local: prod.local,
        quantidade: qtd, unidade: prod.unidade, precoUnit: preco, status: status, prioridade: prioridade || "Média", data: data, obs: "" };
    }
    d.compras = [
      // mês anterior (comprados)
      compra(ana, pArroz, 5, 5.8, "Comprado", mesRelativo(-1, 5)),
      compra(ana, pFrango, 2, 21, "Comprado", mesRelativo(-1, 10)),
      compra(joao, pCarne, 1, 40, "Comprado", mesRelativo(-1, 12)),
      compra(ana, pLeite, 12, 4.9, "Comprado", mesRelativo(-1, 15)),
      // mês atual (comprados)
      compra(ana, pOvos, 2.5, 10, "Comprado", mesRelativo(0, 5)),
      compra(ana, pArroz, 5, 6, "Comprado", mesRelativo(0, 5)),
      compra(ana, pMaca, 1, 9, "Comprado", mesRelativo(0, 6)),
      compra(ana, pBanana, 2, 6, "Comprado", mesRelativo(0, 6)),
      compra(joao, pCarne, 1.5, 42, "Comprado", mesRelativo(0, 12)),
      compra(joao, pOvos, 5, 10, "Comprado", mesRelativo(0, 12)),
      compra(ana, pFrango, 2, 22, "Comprado", mesRelativo(0, 13)),
      // para comprar
      compra(ana, pBrocolis, 3, 5, "Comprar", hoje(1), "Alta"),
      compra(joao, pBanana, 3, 6, "Comprar", hoje(2), "Média"),
      compra(ana, pLeite, 12, 5, "Planejado", hoje(2), "Média")
    ];

    function ref(u, data, horario, tipo, alimento, emoji, qtd, un, status) {
      return { id: novoId(), usuarioId: u, data: data, horario: horario, tipo: tipo, alimento: alimento, emoji: emoji, quantidade: qtd, unidade: un, status: status || "Planejada", obs: "" };
    }
    var H = hoje(0), AM = hoje(1);
    d.refeicoes = [
      ref(ana, H, "07:30", "Café da manhã", "Café", "☕", 200, "ml", "Realizada"),
      ref(ana, H, "07:30", "Café da manhã", "Ovos", "🥚", 3, "un", "Realizada"),
      ref(ana, H, "07:30", "Café da manhã", "Banana", "🍌", 1, "un", "Realizada"),
      ref(ana, H, "12:30", "Almoço", "Arroz", "🍚", 150, "g", "Realizada"),
      ref(ana, H, "12:30", "Almoço", "Frango", "🍗", 200, "g", "Realizada"),
      ref(ana, H, "12:30", "Almoço", "Brócolis", "🥦", 100, "g", "Realizada"),
      ref(ana, H, "16:00", "Lanche da tarde", "Maçã", "🍎", 1, "un"),
      ref(ana, H, "20:00", "Jantar", "Arroz", "🍚", 100, "g"),
      ref(ana, H, "20:00", "Jantar", "Carne", "🥩", 150, "g"),
      ref(ana, H, "20:00", "Jantar", "Salada", "🥗", 150, "g"),
      ref(joao, H, "12:00", "Almoço", "Carne", "🥩", 200, "g", "Realizada"),
      ref(joao, H, "12:00", "Almoço", "Arroz", "🍚", 250, "g", "Realizada"),
      ref(joao, H, "21:00", "Jantar", "Ovos", "🥚", 4, "un"),
      ref(joao, H, "22:30", "Ceia", "Leite", "🥛", 300, "ml"),
      ref(ana, AM, "07:30", "Café da manhã", "Ovos", "🥚", 3, "un"),
      ref(ana, AM, "12:30", "Almoço", "Arroz", "🍚", 150, "g")
    ];

    function plano(u, dia, treino, grupos, horario) {
      return { id: novoId(), usuarioId: u, diaSemana: dia, treino: treino, grupos: grupos, horario: horario || "", obs: "" };
    }
    d.planoSemanal = [
      plano(joao, 1, "Treino de Peito", ["Peito", "Tríceps"], "18:00"),
      plano(joao, 2, "Treino de Costas", ["Costas", "Bíceps"], "18:00"),
      plano(joao, 3, "Treino de Pernas", ["Pernas", "Glúteos"], "18:00"),
      plano(joao, 4, "Ombros + Abdômen", ["Ombros", "Abdômen"], "18:00"),
      plano(joao, 5, "Corpo inteiro", ["Corpo inteiro"], "18:00"),
      plano(joao, 6, "Cardio", ["Cardio"], "09:00"),
      plano(joao, 7, "Descanso", [], ""),
      plano(ana, 1, "Cardio", ["Cardio"], "07:00"),
      plano(ana, 3, "Pernas + Glúteos", ["Pernas", "Glúteos"], "07:00"),
      plano(ana, 5, "Corpo inteiro", ["Corpo inteiro"], "07:00"),
      plano(ana, 7, "Caminhada leve", ["Cardio"], "08:00")
    ];

    function treino(u, nome, data, grupos, status, duracao) {
      return { id: novoId(), usuarioId: u, nome: nome, data: data, grupos: grupos, status: status, duracao: duracao || 60, obs: "" };
    }
    var tPeito = treino(joao, "Treino de Peito", hoje(-6), ["Peito", "Tríceps"], "Realizado", 65);
    var tPernas = treino(joao, "Treino de Pernas", hoje(-4), ["Pernas", "Glúteos"], "Realizado", 70);
    var tCostas = treino(joao, "Treino de Costas", hoje(-5), ["Costas", "Bíceps"], "Realizado", 60);
    d.treinos = [
      treino(joao, "Cardio (bike)", hoje(-20), ["Cardio"], "Realizado", 40),
      treino(joao, "Treino de Peito", hoje(-13), ["Peito", "Tríceps"], "Realizado", 60),
      treino(joao, "Treino de Pernas", hoje(-11), ["Pernas", "Glúteos"], "Realizado", 70),
      tPeito, tCostas, tPernas,
      treino(joao, "Ombros + Abdômen", hoje(-3), ["Ombros", "Abdômen"], "Realizado", 55),
      treino(joao, "Treino de Peito", hoje(1), ["Peito", "Tríceps"], "Planejado", 60),
      treino(joao, "Treino de Costas", hoje(3), ["Costas", "Bíceps"], "Planejado", 60),
      treino(ana, "Cardio", hoje(-7), ["Cardio"], "Realizado", 35),
      treino(ana, "Pernas + Glúteos", hoje(-5), ["Pernas", "Glúteos"], "Realizado", 50),
      treino(ana, "Cardio", hoje(-1), ["Cardio"], "Realizado", 30),
      treino(ana, "Caminhada leve", hoje(0), ["Cardio"], "Planejado", 40),
      treino(ana, "Pernas + Glúteos", hoje(1), ["Pernas", "Glúteos"], "Planejado", 50)
    ];

    function ex(t, nome, grupo, series, reps, carga, descanso, status) {
      return { id: novoId(), treinoId: t.id, nome: nome, grupo: grupo, series: series, repeticoes: reps, carga: carga, descanso: descanso, status: status || "Feito", obs: "" };
    }
    d.exercicios = [
      ex(tPeito, "Supino reto", "Peito", 4, 10, 60, "90s"),
      ex(tPeito, "Supino inclinado", "Peito", 3, 12, 50, "90s"),
      ex(tPeito, "Crucifixo", "Peito", 3, 12, 14, "60s"),
      ex(tPeito, "Tríceps corda", "Tríceps", 3, 15, 25, "60s"),
      ex(tCostas, "Puxada frontal", "Costas", 4, 10, 55, "90s"),
      ex(tCostas, "Remada curvada", "Costas", 3, 10, 50, "90s"),
      ex(tCostas, "Rosca direta", "Bíceps", 3, 12, 20, "60s"),
      ex(tPernas, "Agachamento livre", "Pernas", 4, 8, 80, "120s"),
      ex(tPernas, "Leg press", "Pernas", 3, 12, 140, "90s"),
      ex(tPernas, "Cadeira extensora", "Pernas", 3, 15, 45, "60s"),
      ex(tPernas, "Elevação pélvica", "Glúteos", 3, 12, 60, "60s", "Pulado")
    ];

    function peso(u, data, kg) { return { id: novoId(), usuarioId: u, data: data, peso: kg, altura: null, obs: "" }; }
    d.pesagens = [
      peso(joao, hoje(-26), 82.5), peso(joao, hoje(-19), 82.0), peso(joao, hoje(-12), 81.4), peso(joao, hoje(-5), 80.7),
      peso(ana, hoje(-57), 68.0), peso(ana, hoje(-43), 67.4), peso(ana, hoje(-29), 66.8), peso(ana, hoje(-15), 66.3), peso(ana, hoje(-1), 65.9)
    ];

    return d;
  }

  // "AAAA-MM-DD" do dia `dia` de N meses atrás/à frente
  function mesRelativo(offsetMeses, dia) {
    var d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offsetMeses);
    d.setDate(Math.min(dia, 28));
    return isoLocal(d);
  }

  // ---------------------------------------------------------------------
  // carregar / salvar
  // ---------------------------------------------------------------------
  function migrar(d) {
    var base = esquemaVazio();
    Object.keys(base).forEach(function (k) {
      if (d[k] === undefined) d[k] = base[k];
    });
    if (!d.config) d.config = base.config;
    if (d.config.usuarioAtivo === undefined) d.config.usuarioAtivo = "";
    return d;
  }

  function carregarDados() {
    var bruto = lerBruto();
    if (!bruto) {
      var demo = dadosDemo();
      salvarDados(demo, true);
      return demo;
    }
    try {
      return migrar(JSON.parse(bruto));
    } catch (e) {
      console.error("Dados corrompidos, recomeçando com exemplo.", e);
      var reset = dadosDemo();
      salvarDados(reset, true);
      return reset;
    }
  }

  function salvarDados(dados, semNotificar, semCarimbo) {
    if (!semCarimbo) dados.atualizadoEm = new Date().toISOString();
    try {
      gravarBruto(JSON.stringify(dados));
    } catch (e) {
      console.error("Não foi possível salvar os dados:", e);
      if (global.UI && global.UI.toast) global.UI.toast("Não consegui salvar — armazenamento cheio ou bloqueado.");
    }
    if (!semNotificar) notificar();
  }

  function limparDados() {
    var vazio = esquemaVazio();
    salvarDados(vazio);
    return vazio;
  }

  function carregarExemplo() {
    var demo = dadosDemo();
    salvarDados(demo);
    return demo;
  }

  // ---------------------------------------------------------------------
  // backup
  // ---------------------------------------------------------------------
  function exportarDados() {
    var dados = carregarDados();
    dados.config.ultimoBackup = new Date().toISOString();
    salvarDados(dados);
    var texto = JSON.stringify(dados, null, 2);
    var blob = new Blob([texto], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "meu-controle-backup-" + hoje(0) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importarDados(arquivo) {
    return new Promise(function (resolve, reject) {
      var leitor = new FileReader();
      leitor.onload = function () {
        try {
          var obj = JSON.parse(leitor.result);
          if (!obj || !Array.isArray(obj.usuarios)) {
            reject(new Error("Esse arquivo não parece ser um backup do Meu Controle."));
            return;
          }
          salvarDados(migrar(obj));
          resolve(obj);
        } catch (e) {
          reject(new Error("Não consegui ler esse arquivo. Verifique se é o JSON exportado pelo próprio sistema."));
        }
      };
      leitor.onerror = function () { reject(new Error("Falha ao ler o arquivo.")); };
      leitor.readAsText(arquivo);
    });
  }

  global.Armazenamento = {
    carregarDados: carregarDados,
    salvarDados: salvarDados,
    limparDados: limparDados,
    carregarExemplo: carregarExemplo,
    exportarDados: exportarDados,
    importarDados: importarDados,
    novoId: novoId,
    hoje: hoje,
    isoLocal: isoLocal,
    aoMudar: aoMudar
  };
})(window);
