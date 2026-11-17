/**
 * tutorial.js
 * -----------------------------------------------------------------------
 * Tutoriais guiados: na primeira visita a cada tela aparece um convite
 * ("Quer ver como funciona?") e, se a pessoa aceitar, um passo a passo que
 * destaca as partes reais da tela, uma de cada vez, com um balão
 * explicando. O botão "?" no título de cada tela mostra de novo, e em
 * Ajustes → Tutoriais dá para rever qualquer um ou ligar/desligar o convite.
 *
 * Alvos dos passos: seletor CSS, "card:Título" (o cartão com esse título)
 * ou uma lista deles (vale o primeiro visível). Passo sem alvo visível vira
 * um balão no meio da tela — ou é pulado, se for "opcional".
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const UI = global.UI, A = global.Armazenamento;
  const esc = UI.esc;
  const App = () => global.App;
  const celular = () => global.matchMedia("(max-width: 860px)").matches;

  const ABAS = ".cabecalho-pagina .abas";
  const NAV = ["#tabBar", "#navPrincipal"];
  const navTexto = () => celular() ? "As abas de baixo levam às outras partes do app. O que não cabe nelas fica em <b>Mais</b>." : "O menu ao lado leva às outras partes do app.";

  const TOURS = {
    dashboard: {
      nome: "Tela Hoje", icone: "🏠",
      intro: "Tudo do seu dia num lugar só: comida, água, treino, remédios e hábitos.",
      passos: [
        { alvo: ".boas-vindas", titulo: "Primeiros passos", texto: "Enquanto o app está vazio, este cartão sugere por onde começar. Ele some sozinho quando você tiver registros.", opcional: true },
        { alvo: "card:Sua semana", titulo: "Sua semana", texto: "Cada anel é um dia: quanto mais cheio, mais perto das suas metas você ficou. <b>Toque num dia</b> para ver tudo o que foi registrado nele.", opcional: true },
        { alvo: ".dica-dia", titulo: "Dica do dia", texto: "Uma dica curta por dia para descobrir o app aos poucos. Dá para trocar, fechar ou desligar.", opcional: true },
        { alvo: "card:Resumo do dia", titulo: "Resumo do dia", texto: "Calorias, proteína e água de hoje comparadas com as suas metas. O botão de água soma um copo com um toque.", opcional: true },
        { alvo: "card:Seu dia", titulo: "Seu dia", texto: "Refeições, remédios e hábitos na ordem da sua rotina. Toque num item para marcar como feito.", opcional: true },
        { alvo: ".tiles-saude", titulo: "Seus números", texto: "Treinos, peso, sono e outros. Toque num cartão para abrir a tela dele.", opcional: true },
        { alvo: "#fab", titulo: "Registro rápido", texto: "O botão <b>+</b> aparece em todas as telas: registre refeição, água, peso, treino ou humor sem procurar o lugar certo." },
        { alvo: NAV, titulo: "Navegação", texto: navTexto },
        { alvo: "#btnLogo", titulo: "Menu e gestos", texto: () => celular() ? "Toque na <b>logo</b> para abrir o menu com todas as telas. E <b>deslize para os lados</b> para passar para a próxima aba ou tela." : "A logo leva de volta à tela Hoje.", opcional: true },
        { alvo: ["#btnBuscaTopo", "#btnBuscaLateral"], titulo: "Busca", texto: "A lupa encontra qualquer coisa: uma tela, um ajuste, um alimento, uma ação.", opcional: true },
        { alvo: [".cab-hoje .avatar", "#avatarBarra", "#perfilLateral"], titulo: "Seu avatar", texto: "Toque na sua foto para trocar: personagens de anime, emojis ou uma foto sua.", opcional: true },
        { alvo: "#btnNotificacoes", titulo: "Alertas", texto: "O sino avisa quando algo precisa de atenção: remédio acabando, meta fora do caminho, backup atrasado.", opcional: true },
        { titulo: "Pronto!", texto: "Em cada tela, o botão <b class=\"tour-q\">?</b> ao lado do título explica a aba em que você está. E a <b>Central de ajuda</b> (em Mais → Ajuda) tem o passo a passo de tudo." }
      ]
    },
    alimentacao: {
      area: "alimentacao", nome: "Alimentação", icone: "🍽️",
      intro: "Aqui você registra o que come e acompanha calorias e proteína.",
      passos: [
        { alvo: ABAS, titulo: "Quatro abas", texto: "<b>Diário</b>: o que você comeu no dia. <b>Semana</b>: cardápio planejado e as compras dele. <b>Alimentos</b>: sua tabela com as calorias de cada alimento. <b>Produtos</b>: as marcas e os rótulos do que você compra." },
        { alvo: ".barra-ferramentas", titulo: "Escolher o dia", texto: "Use as setas para ver ou registrar outros dias.", opcional: true },
        { alvo: "card:Resumo do dia", titulo: "Resumo do dia", texto: "Quanto você já comeu de calorias, proteína, carboidratos e gorduras.", opcional: true },
        { alvo: '[data-acao="nova-refeicao"]', titulo: "Nova refeição", texto: "Adicione café, almoço, jantar… e escolha os alimentos. A refeição que se repete pode virar favorita e entra depois com um toque." },
        { alvo: '[data-acao="agua-rapida"]', titulo: "Água", texto: "Cada toque soma um copo.", opcional: true }
      ]
    },
    academia: {
      area: "academia", nome: "Treino", icone: "🏋️",
      intro: "Planeje e registre seus treinos, série por série.",
      passos: [
        { alvo: ABAS, titulo: "Quatro abas", texto: "<b>Treinos</b>: o de hoje e o histórico. <b>Fichas</b>: seus treinos A, B, C e o plano da semana. <b>Calendário</b> e <b>Carga</b>: como os pesos evoluem." },
        { alvo: ".kpi-row", titulo: "Sua semana de treino", texto: "Treinos feitos, dias seguidos e volume levantado.", opcional: true },
        { alvo: ['[data-acao="novo-treino"]', '[data-acao="rapido-treino"]'], titulo: "Começar um treino", texto: "Escolha uma ficha ou faça um treino livre. Durante o treino, marque cada série — o app mostra a carga que você usou da última vez." },
        { titulo: "Dica", texto: "Monte suas fichas primeiro na aba <b>Fichas</b>. Depois é só tocar em <b>Iniciar</b> e seguir." }
      ]
    },
    bemestar: {
      area: "bemestar", nome: "Bem-estar", icone: "💚",
      intro: "Sono, humor, hábitos, remédios e jejum.",
      passos: [
        { alvo: ABAS, titulo: "As partes do Bem-estar", texto: "<b>Resumo</b>: check-in e gráficos. <b>Hábitos</b>: o que você quer fazer todo dia. <b>Remédios</b>: horários, lembretes e estoque. <b>Jejum</b>: cronômetro e histórico.", opcional: true },
        { alvo: ['[data-acao="checkin"]', "card:Check-in de hoje"], titulo: "Check-in do dia", texto: "Leva 10 segundos: como dormiu, humor, energia e passos. Com o tempo, o app mostra o que mais influencia o seu bem-estar.", opcional: true },
        { alvo: ".kpi-row", titulo: "Suas médias", texto: "Sono, humor, energia e passos dos últimos 7 dias.", opcional: true },
        { alvo: "card:Calendário do humor", titulo: "Calendário do humor", texto: "Cada dia ganha a cor do seu humor. Toque num dia para registrar como você estava.", opcional: true },
        { titulo: "Remédios", texto: "Na aba <b>Remédios</b>, cadastre horários e quantidade em casa: o app lembra a hora de tomar e avisa quando estiver acabando." }
      ]
    },
    compras: {
      area: "compras", nome: "Compras", icone: "🛒",
      intro: "Lista de compras, o que tem em casa e quanto você gasta com comida.",
      passos: [
        { alvo: ABAS, titulo: "Três abas", texto: "<b>Lista</b>: o que comprar no mês. <b>Em casa</b>: o estoque, com aviso quando algo está acabando. <b>Gastos</b>: quanto foi por mês, categoria e mercado." },
        { alvo: ".barra-mes", titulo: "Mês", texto: "Cada mês tem a sua lista. Dá para copiar a lista do mês anterior.", opcional: true },
        { alvo: '[data-acao="nova-compra"]', titulo: "Adicionar item", texto: "Coloque o nome, a quantidade e o preço. Quando comprar, marque o item: ele entra no estoque e nos gastos." }
      ]
    },
    evolucao: {
      area: "evolucao", nome: "Corpo", icone: "📈",
      intro: "Peso, gordura, músculo e medidas ao longo do tempo.",
      passos: [
        { alvo: '[data-acao="rapido-peso"]', titulo: "Só o peso", texto: "Registre o peso em dois toques. Melhor de manhã, sempre no mesmo horário." },
        { alvo: '[data-acao="rapido-medida"]', titulo: "Medição completa", texto: "Peso, bioimpedância (gordura, músculo, água) e medidas como cintura e braço." },
        { alvo: ".cabecalho-pagina .abas", titulo: "Medidas e Fotos", texto: "Na aba <b>Fotos</b>, guarde fotos de evolução e compare o antes e o depois.", opcional: true },
        { alvo: "card:Evolução corporal", titulo: "Comparação", texto: "A primeira medição comparada com a mais recente.", opcional: true },
        { alvo: "card:Gráficos", titulo: "Gráficos", texto: "Escolha o que ver e o período. A linha da meta aparece quando você cria uma em Metas.", opcional: true }
      ]
    },
    metas: {
      area: "metas", nome: "Metas", icone: "🎯",
      intro: "Defina objetivos com prazo e veja se você está no caminho.",
      passos: [
        { alvo: ABAS, titulo: "Metas e Conquistas", texto: "Em <b>Conquistas</b> ficam as medalhas que você ganha registrando com constância." },
        { alvo: '[data-acao="calc-metas"]', titulo: "Calculadora", texto: "Não sabe que números usar? Ela estima calorias, proteína e água para o seu objetivo e cria as metas.", opcional: true },
        { alvo: '[data-acao="nova-meta"]', titulo: "Nova meta", texto: "Peso, calorias, proteína, água, treinos por semana, sono… escolha o tipo, o valor e o prazo." },
        { alvo: ".kpi-row", titulo: "Como estão as metas", texto: "🟢 no caminho, 🟡 atenção, 🔴 fora. A conta usa a tendência dos seus registros, não só o último valor.", opcional: true }
      ]
    },
    relatorios: {
      area: "relatorios", nome: "Relatórios", icone: "📊",
      intro: "Resumo da semana, do mês ou do trimestre comparado ao período anterior.",
      passos: [
        { alvo: [".barra-ferramentas:has([data-acao='rel-tipo'])", '[data-acao="rel-tipo"]'], titulo: "Período", texto: "Escolha semanal, mensal ou trimestral e navegue com as setas." },
        { alvo: [".barra-ferramentas:has([data-acao='rel-pdf'])", '[data-acao="rel-pdf"]'], titulo: "Levar para a consulta", texto: "Gere um PDF para imprimir ou mostrar ao nutricionista ou médico, ou uma planilha.", opcional: true },
        { alvo: "#sec-insights", titulo: "Insights", texto: "Observações automáticas a partir dos seus registros.", opcional: true }
      ]
    },
    configuracoes: {
      nome: "Ajustes", icone: "⚙️",
      intro: "Deixe o app com a sua cara e mantenha seus dados seguros.",
      passos: [
        { alvo: ".aj-lista .aj-busca", titulo: "Buscar nos ajustes", texto: "Não sabe onde fica? Digite o que procura: “tema”, “backup”, “abas”…" },
        { alvo: ".aj-lista .aj-grupo:nth-of-type(1)", titulo: "Você", texto: "<b>Aparência</b> tem temas prontos, cores, tipo e tamanho da letra e o seu avatar." },
        { alvo: ".aj-lista .aj-grupo:nth-of-type(2)", titulo: "O app do seu jeito", texto: "Desligue as áreas que não usa, mude a ordem do menu, as abas do celular, o botão <b>+</b> e os cartões da tela Hoje.", opcional: true },
        { alvo: ".aj-lista .aj-grupo:nth-of-type(4)", titulo: "Seus dados — importante!", texto: "Os dados ficam só neste aparelho. Ative o <b>Backup</b> ou a <b>Sincronização</b> para não perder nada.", opcional: true },
        { alvo: ".aj-lista .aj-grupo:nth-of-type(5)", titulo: "Ajuda", texto: "A <b>Central de ajuda</b> tem o passo a passo de tudo, e os tutoriais podem ser revistos quando quiser.", opcional: true }
      ]
    },

    // ---- a tela de um treino aberto ----
    treino: {
      area: "academia", nome: "Durante o treino", icone: "⏱️",
      intro: "A tela do treino aberto: marque as séries e descanse no tempo certo.",
      passos: [
        { alvo: ".tabela-series .rw", titulo: "Cada exercício", texto: "Ajuste séries, repetições e carga direto na linha. Embaixo do nome aparece o que você fez da última vez.", opcional: true },
        { alvo: ".tabela-series .ex-status", titulo: "Marcar como feito", texto: "Toque no círculo ao terminar o exercício. Outro toque marca como pulado.", opcional: true },
        { alvo: ".descanso", titulo: "Descanso", texto: "A contagem começa sozinha quando você marca um exercício. Toque nos tempos para trocar; no fim, o celular vibra e apita.", opcional: true },
        { alvo: ".kpi-row", titulo: "Como está indo", texto: "Exercícios feitos, volume levantado (comparado com o treino anterior) e a duração.", opcional: true },
        { alvo: '[data-acao="status-treino"][data-status="Realizado"]', titulo: "Concluir", texto: "No fim, toque em <b>Concluir treino</b>: ele conta para a sua semana e para a sequência 🔥.", opcional: true }
      ]
    },

    // ---- abas (o botão "?" explica a aba aberta) ----
    "alimentacao/semana": {
      area: "alimentacao", nome: "Alimentação · Semana", icone: "🗓️",
      intro: "Planeje o cardápio e descubra o que precisa comprar.",
      passos: [
        { alvo: "card:Cardápio da semana", titulo: "Cardápio", texto: "Um quadro com os dias e as refeições. Toque num espaço vazio para planejar; toque numa refeição para editar." },
        { alvo: "card:Refeições favoritas", titulo: "Favoritas", texto: "Refeições que você salvou com a estrela. Use-as para preencher a semana em poucos toques.", opcional: true },
        { alvo: "card:Compras para o cardápio", titulo: "O que falta comprar", texto: "O app compara o cardápio com o estoque e lista o que falta. Um toque manda para a lista de compras.", opcional: true }
      ]
    },
    "alimentacao/alimentos": {
      area: "alimentacao", nome: "Alimentação · Alimentos", icone: "🥦",
      intro: "A sua tabela de alimentos: a base das refeições, do estoque e das compras.",
      passos: [
        { alvo: ['[data-acao="novo-alimento"]', '[data-acao="rapido-alimento"]'], titulo: "Novo alimento", texto: "Copie do rótulo a porção, as calorias e os macros. O preço é opcional e serve para estimar custos." },
        { alvo: ".filtros-linha", titulo: "Buscar e filtrar", texto: "Procure pelo nome ou filtre por categoria.", opcional: true },
        { titulo: "Dica", texto: "Não precisa cadastrar tudo antes: ao montar uma refeição, digite um nome novo e o app oferece o cadastro na hora." }
      ]
    },
    "alimentacao/produtos": {
      area: "alimentacao", nome: "Alimentação · Produtos", icone: "🏷️",
      intro: "O seu caderno de marcas: o que comprar — e o que não comprar de novo.",
      passos: [
        { alvo: '[data-acao="novo-produto"]', titulo: "Adicionar produto", texto: "Fotografe o rótulo e anote marca, embalagem, preço e onde achou. Avalie: ⭐ preferido, 👍 bom ou 🚫 não comprar." },
        { alvo: ".pd-card", titulo: "Cada produto", texto: "Toque para ver o rótulo em tamanho grande. <b>Lista</b> põe o produto na lista de compras do mês.", opcional: true },
        { titulo: "Na hora da compra", texto: "Ligue o produto a um alimento do cadastro: a marca preferida aparece ao lado dele na <b>lista de compras</b>. Toque nela para conferir o rótulo na prateleira." }
      ]
    },
    "evolucao/fotos": {
      area: "evolucao", nome: "Corpo · Fotos", icone: "📸",
      intro: "Fotos de evolução: o que a balança não mostra.",
      passos: [
        { alvo: '[data-acao="nova-foto"]', titulo: "Adicionar foto", texto: "Tire na hora ou escolha da galeria. Informe a data e a pose: frente, lado ou costas." },
        { alvo: ".card-fotos-comp", titulo: "Antes e depois", texto: "Escolha duas fotos e veja lado a lado, com o tempo entre elas e a diferença de peso.", opcional: true },
        { alvo: ".ft-aviso", titulo: "Privacidade", texto: "As fotos ficam <b>só neste aparelho</b> — não vão para a sincronização nem para o backup. <b>Exportar fotos</b> gera uma cópia para guardar.", opcional: true }
      ]
    },
    "academia/fichas": {
      area: "academia", nome: "Treino · Fichas e plano", icone: "📋",
      intro: "Monte os treinos uma vez e deixe o app dizer qual é o de hoje.",
      passos: [
        { alvo: ["card:Fichas de treino", ".fichas", ".ficha"], titulo: "Fichas", texto: "Cada ficha é um treino (A, B, C…) com exercícios, séries e repetições. <b>Iniciar</b> começa o treino na hora." },
        { alvo: "card:Plano semanal", titulo: "Plano da semana", texto: "Diga em que dia cai cada ficha — e os dias de descanso. O treino do dia aparece sozinho na tela Hoje.", opcional: true }
      ]
    },
    "academia/calendario": {
      area: "academia", nome: "Treino · Calendário", icone: "📆",
      intro: "O mês inteiro: o que foi feito, o que faltou e o que vem.",
      passos: [
        { alvo: "card:Calendário", titulo: "Calendário", texto: "Verde = treino feito. Toque no número de um dia para registrar um treino nele — inclusive em dias passados." }
      ]
    },
    "academia/carga": {
      area: "academia", nome: "Treino · Carga", icone: "📈",
      intro: "Veja se as cargas estão subindo.",
      passos: [
        { alvo: '[data-mudar="exercicio-carga"]', titulo: "Escolha o exercício", texto: "O gráfico mostra a carga usada em cada treino.", opcional: true },
        { titulo: "Como ler", texto: "Linha subindo = você está ficando mais forte. Se ficar reta por semanas, tente aumentar um pouco a carga ou as repetições." }
      ]
    },
    "bemestar/habitos": {
      area: "habitos", nome: "Bem-estar · Hábitos", icone: "✅",
      intro: "Pequenas coisas feitas todo dia — e desafios com prazo.",
      passos: [
        { alvo: ['[data-acao="habito-modelos"]', '[data-acao="novo-habito"]'], titulo: "Criar", texto: "Comece por um <b>modelo pronto</b> (água, leitura, alongamento…) ou crie o seu, com dias e horário." },
        { alvo: ".hab-card", titulo: "Cada hábito", texto: "Toque para marcar o dia. O mapa mostra as últimas semanas e a sequência 🔥 de dias seguidos.", opcional: true },
        { titulo: "Desafios", texto: "Dê uma <b>duração</b> ao hábito (ex.: 21 dias) e ele vira um desafio com contagem regressiva." }
      ]
    },
    "bemestar/remedios": {
      area: "remedios", nome: "Bem-estar · Remédios", icone: "💊",
      intro: "Horários, doses e estoque dos remédios e suplementos.",
      passos: [
        { alvo: '[data-acao="novo-remedio"]', titulo: "Cadastrar", texto: "Nome, dose, horários, dias da semana e quantos você tem em casa." },
        { alvo: "card:Hoje", titulo: "Doses de hoje", texto: "Toque para marcar como tomada. Cada dose marcada baixa o estoque.", opcional: true },
        { alvo: ".rem-card", titulo: "Estoque", texto: "O app calcula para quantos dias ainda dá e avisa antes de acabar. <b>Repor</b> soma uma caixa nova.", opcional: true },
        { titulo: "Para tocar na hora", texto: "Ligue os avisos em Ajustes → <b>Lembretes</b>. Para tocar com o app fechado, use Ajustes → <b>Google Agenda</b>." }
      ]
    },
    "bemestar/jejum": {
      area: "jejum", nome: "Bem-estar · Jejum", icone: "⏳",
      intro: "Um cronômetro para o jejum intermitente.",
      passos: [
        { alvo: ".protocolos", titulo: "Começar", texto: "Escolha um protocolo (14 h, 16 h, 18 h…). O contador passa a aparecer no topo da tela Hoje.", opcional: true },
        { alvo: '[data-acao="jejum-encerrar"]', titulo: "Encerrar", texto: "Toque ao fazer a próxima refeição. O jejum entra no histórico.", opcional: true },
        { titulo: "Atenção", texto: "Jejum não é para todo mundo. Se você tem alguma condição de saúde, converse com um profissional antes." }
      ]
    },
    "compras/estoque": {
      area: "compras", nome: "Compras · Em casa", icone: "📦",
      intro: "O que você tem na despensa e na geladeira.",
      passos: [
        { alvo: "card:Em casa", titulo: "Estoque", texto: "Quantidade de cada alimento e o <b>mínimo</b> que você quer manter. Abaixo do mínimo, o app avisa e põe na lista." },
        { titulo: "Ele se atualiza sozinho", texto: "Item marcado como comprado <b>entra</b> no estoque; refeição marcada como feita <b>sai</b>. Dá para desligar isso em Ajustes → Integração." }
      ]
    },
    "compras/gastos": {
      area: "compras", nome: "Compras · Gastos", icone: "💰",
      intro: "Para onde vai o dinheiro da comida.",
      passos: [
        { alvo: "card:Gasto por mês", titulo: "Mês a mês", texto: "Quanto você gastou em cada mês, a partir dos itens marcados como comprados (com o preço pago).", opcional: true },
        { alvo: "card:Por categoria", titulo: "Por categoria e mercado", texto: "Veja o que pesa mais: carnes, frutas, suplementos… e em qual mercado.", opcional: true },
        { alvo: "card:Histórico de preços", titulo: "Histórico de preços", texto: "Como o preço de cada item mudou ao longo do tempo.", opcional: true }
      ]
    },
    "metas/conquistas": {
      area: "metas", nome: "Conquistas", icone: "🏆",
      intro: "Medalhas pela sua constância.",
      passos: [
        { alvo: ".cq-topo", titulo: "Seu placar", texto: "Quantas medalhas você já tem.", opcional: true },
        { alvo: ".cq-grade", titulo: "Medalhas", texto: "As que estão <b>quase lá</b> aparecem primeiro, com a barra do quanto falta. Toque numa conquistada para compartilhar.", opcional: true }
      ]
    }
  };

  // ---------------------------------------------------------------------
  // encontrar alvos
  // ---------------------------------------------------------------------
  function visivel(e) {
    if (!e || !e.getClientRects().length) return false;
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(e);
    return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05;
  }
  function achar(alvo) {
    if (!alvo) return null;
    const lista = Array.isArray(alvo) ? alvo : [alvo];
    for (const s of lista) {
      let els = [];
      try {
        if (s.indexOf("card:") === 0) {
          const t = s.slice(5).toLowerCase();
          els = Array.from(document.querySelectorAll("#conteudo .card")).filter((c) => { const h = c.querySelector("h2"); return h && h.textContent.trim().toLowerCase().indexOf(t) === 0; });
        } else els = Array.from(document.querySelectorAll(s));
      } catch (e) { els = []; } // seletor sem suporte neste navegador (ex.: :has)
      const v = els.find(visivel);
      if (v) return v;
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // o passo a passo
  // ---------------------------------------------------------------------
  const st = { k: null, i: 0, passos: [], el: null, alvo: null, voltaPropria: false };
  function ativo() { return !!st.k; }

  function montar() {
    let el = document.getElementById("tour");
    if (!el) {
      el = document.createElement("div");
      el.id = "tour"; el.className = "tour";
      el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Tutorial");
      el.innerHTML = `<div class="tour-foco"></div><div class="tour-balao"><i class="tour-seta"></i><div class="tour-conteudo" aria-live="polite"></div></div>`;
      // a tela por baixo não rola nem recebe toques durante o tutorial
      ["wheel", "touchmove"].forEach((ev) => el.addEventListener(ev, (e) => { if (!e.target.closest(".tour-balao")) e.preventDefault(); }, { passive: false }));
      // fora do <body>: o "tamanho da letra" usa zoom no body, e as posições
      // dos alvos (getBoundingClientRect) já vêm na escala da tela
      document.documentElement.appendChild(el);
    }
    return el;
  }

  // k: tela; opc.convite: começa com o convite "Quer ver como funciona?"
  function iniciar(k, opc) {
    opc = opc || {};
    const t = TOURS[k];
    if (!t) return;
    if (ativo()) fechar(false, true);
    const go = () => {
      const passos = t.passos.filter((p) => !p.opcional || achar(p.alvo));
      st.k = k; st.i = 0;
      st.passos = (opc.convite ? [{ convite: true }] : [{ intro: true }]).concat(passos);
      st.el = montar();
      document.body.classList.add("tour-on");
      requestAnimationFrame(() => st.el.classList.add("on"));
      UI.aposVoltar(() => { if (ativo()) { try { history.pushState({ tour: true }, "", location.href); } catch (e) { /* sem histórico */ } } });
      mostrar();
    };
    // vai para a tela (e a aba) que os passos explicam
    const rota = App().rota(), partes = k.split("/"), tela = partes[0], aba = partes[1] || null;
    if (k === "treino") {
      if (rota.secao !== "treino") { UI.toast("Abra um treino (Treino → Iniciar) e toque no ? para ver este tutorial."); return; }
      go();
    } else if (rota.secao !== tela || (rota.param || null) !== aba) { App().ir(tela, aba); setTimeout(go, 400); } else go();
  }

  function mostrar() {
    const p = st.passos[st.i], t = TOURS[st.k];
    if (!p) { concluir(); return; }
    const reais = st.passos.filter((x) => !x.convite && !x.intro).length;
    const n = st.passos.slice(0, st.i + 1).filter((x) => !x.convite && !x.intro).length;
    const ultimo = st.i === st.passos.length - 1;
    let html;
    if (p.convite || p.intro) {
      html = `<div class="tour-cab"><span class="tour-ic">${t.icone}</span><div><small>${p.convite ? "Primeira vez aqui?" : "Como funciona"}</small><b>${esc(t.nome)}</b></div></div>
        <p>${t.intro}${p.convite ? " Quer que eu mostre as partes principais? Leva uns 30 segundos." : ""}</p>
        <div class="tour-botoes">${p.convite ? `<button class="btn" data-acao="tour-fechar">Agora não</button><button class="btn primario" data-acao="tour-proximo">Mostrar</button>`
          : `<button class="btn fantasma" data-acao="tour-fechar">Fechar</button><button class="btn primario" data-acao="tour-proximo">Começar</button>`}</div>`;
    } else {
      const texto = typeof p.texto === "function" ? p.texto() : p.texto;
      html = `<div class="tour-topo"><span class="tour-pontos">${Array.from({ length: reais }, (_, j) => `<i class="${j < n - 1 ? "feito" : j === n - 1 ? "ativo" : ""}"></i>`).join("")}</span><small>${n} de ${reais}</small></div>
        <b class="tour-titulo">${esc(p.titulo)}</b><p>${texto}</p>
        <div class="tour-botoes">${ultimo ? "" : `<button class="btn fantasma tour-pular" data-acao="tour-fechar">Pular</button>`}
          ${n > 1 ? `<button class="btn" data-acao="tour-voltar">Voltar</button>` : ""}
          <button class="btn primario" data-acao="tour-proximo">${ultimo ? "Entendi" : "Próximo"}</button></div>
          ${ultimo ? `<button class="link-acao tour-mais" data-acao="tour-ajuda">Mais ajuda: como fazer cada coisa ›</button>` : ""}`;
    }
    st.el.querySelector(".tour-conteudo").innerHTML = html;
    st.alvo = p.convite || p.intro ? null : achar(p.alvo);
    if (st.alvo && getComputedStyle(st.alvo).position !== "fixed" && !st.alvo.closest("#tabBar, .sidebar")) {
      const r = st.alvo.getBoundingClientRect(), vh = global.innerHeight;
      const margemBaixo = celular() ? 90 : 20;
      const alto = r.height > vh * 0.4;
      // alvos altos sobem para o topo (sobra lugar para o balão embaixo)
      if (alto ? (r.top < 60 || r.top > vh * 0.3) : (r.top < 70 || r.bottom > vh - margemBaixo)) {
        st.alvo.style.scrollMarginTop = (celular() ? 76 : 24) + "px";
        st.alvo.scrollIntoView({ block: alto ? "start" : "center", behavior: "auto" });
      }
    }
    posicionar();
    const b = st.el.querySelector("[data-acao='tour-proximo']");
    if (b) b.focus({ preventScroll: true });
  }

  function posicionar() {
    if (!ativo()) return;
    const el = st.el, foco = el.querySelector(".tour-foco"), balao = el.querySelector(".tour-balao"), seta = el.querySelector(".tour-seta");
    const vw = global.innerWidth, vh = global.innerHeight;
    const w = Math.min(380, vw - 24);
    balao.style.width = w + "px";
    if (!st.alvo || !visivel(st.alvo)) {
      el.classList.add("sem-alvo");
      Object.assign(foco.style, { top: vh / 2 + "px", left: vw / 2 + "px", width: "0px", height: "0px" });
      const h = balao.offsetHeight;
      Object.assign(balao.style, { left: (vw - w) / 2 + "px", top: Math.max(16, (vh - h) / 2) + "px" });
      seta.className = "tour-seta";
      return;
    }
    el.classList.remove("sem-alvo");
    const r0 = st.alvo.getBoundingClientRect(), pad = 6;
    // só a parte visível do alvo (cartões compridos)
    const r = { top: Math.max(r0.top, 8), left: Math.max(r0.left, 8), bottom: Math.min(r0.bottom, vh - 8), right: Math.min(r0.right, vw - 8) };
    Object.assign(foco.style, { top: r.top - pad + "px", left: r.left - pad + "px", width: r.right - r.left + pad * 2 + "px", height: r.bottom - r.top + pad * 2 + "px" });
    const h = balao.offsetHeight, gap = 16;
    let embaixo = vh - r.bottom - pad - gap, emcima = r.top - pad - gap;
    const direita = vw - r.right - pad - gap, esquerda = r.left - pad - gap;
    let top, left, lado;
    const cxDe = () => (r.left + r.right) / 2;
    if (embaixo < h + 8 && emcima < h + 8 && (direita >= w + 8 || esquerda >= w + 8)) {
      // alvo alto e estreito (menu lateral, cartão no PC): balão ao lado
      left = direita >= w + 8 ? r.right + pad + gap : r.left - pad - gap - w;
      top = Math.min(Math.max(12, r.top), vh - h - 12);
      lado = direita >= w + 8 ? "esq" : "dir";
    } else {
      if (embaixo < h + 8 && emcima < h + 8) {
        // alvo maior que a tela: destaca só o começo dele e põe o balão embaixo
        r.bottom = Math.max(r.top + 56, vh - h - gap - pad - (celular() ? 20 : 16));
        Object.assign(foco.style, { height: r.bottom - r.top + pad * 2 + "px" });
        embaixo = vh - r.bottom - pad - gap;
      }
      if (embaixo >= h + 8 || emcima < h + 8) { top = Math.min(r.bottom + pad + gap, vh - h - 12); lado = "cima"; }
      else { top = r.top - pad - gap - h; lado = "baixo"; }
      left = Math.min(Math.max(12, cxDe() - w / 2), vw - w - 12);
    }
    Object.assign(balao.style, { left: left + "px", top: top + "px" });
    seta.className = "tour-seta " + lado;
    if (lado === "esq" || lado === "dir") { seta.style.left = ""; seta.style.top = Math.min(Math.max(22, (r.top + Math.min(r.bottom, r.top + 120)) / 2 - top), h - 22) + "px"; }
    else { seta.style.top = ""; seta.style.left = Math.min(Math.max(22, cxDe() - left), w - 22) + "px"; }
  }

  function marcarVisto(k) {
    const d = App().dados();
    if (!d) return;
    d.config.tutoriais = d.config.tutoriais || {};
    if (d.config.tutoriais[k]) return;
    d.config.tutoriais[k] = new Date().toISOString().slice(0, 10);
    A.salvarDados(d, true, true);
  }
  function fechar(peloVoltar, semMarcar) {
    if (!ativo()) return;
    const k = st.k;
    st.k = null; st.alvo = null;
    st.el.classList.remove("on");
    document.body.classList.remove("tour-on");
    if (!semMarcar) marcarVisto(k);
    if (!peloVoltar && history.state && history.state.tour) { st.voltaPropria = true; try { history.back(); } catch (e) { st.voltaPropria = false; } }
  }
  function concluir() { fechar(); }

  UI.aoVoltar(() => {
    if (st.voltaPropria) { st.voltaPropria = false; return true; }
    if (ativo()) { fechar(true); return true; }
    return false;
  });
  document.addEventListener("keydown", (e) => {
    if (!ativo()) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); proximo(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); voltar(); }
  }, true);
  let timerPos = null;
  global.addEventListener("resize", () => { if (!ativo()) return; clearTimeout(timerPos); timerPos = setTimeout(() => { st.alvo = st.alvo && visivel(st.alvo) ? st.alvo : achar((st.passos[st.i] || {}).alvo); posicionar(); }, 120); });

  function proximo() { if (st.i >= st.passos.length - 1) { concluir(); return; } st.i++; mostrar(); }
  function voltar() { if (st.i > 0) { st.i--; if (st.passos[st.i].convite || st.passos[st.i].intro) st.i++; mostrar(); } }

  // ---------------------------------------------------------------------
  // convite automático na primeira visita e botão "?" no título
  // ---------------------------------------------------------------------
  const api = { auto: true };
  let novidadesPendentes = false;
  let timerAuto = null;
  function podeConvidar(d, k) {
    if (!api.auto || !TOURS[k] || ativo() || novidadesPendentes) return false;
    const c = d.config;
    if (c.dicasAuto === false || (c.tutoriais || {})[k]) return false;
    if (!c.onboardingFeito && !d.demo) return false; // as boas-vindas vêm primeiro
    return true;
  }
  function ocupado() {
    return document.documentElement.classList.contains("travado") || UI.modalAberto() || document.body.classList.contains("av-aberta") || document.querySelector(".abertura") || document.body.classList.contains("mais-aberto") || document.body.classList.contains("fab-aberto") || document.body.classList.contains("tour-on");
  }
  App().aoRenderizar((d, rota) => {
    const k = rota && rota.secao;
    // botão "?" ao lado do título: explica a aba aberta (ou a tela)
    const kAba = rota && rota.param && TOURS[k + "/" + rota.param] ? k + "/" + rota.param : k;
    if (TOURS[kAba] && k !== "configuracoes" || (k === "configuracoes" && TOURS[k])) {
      const lugar = document.querySelector("#conteudo .cabecalho-pagina h1, #conteudo .cab-hoje .cab-direita");
      if (lugar && !lugar.querySelector(".tour-ajuda")) {
        const kBotao = k === "configuracoes" ? k : kAba;
        const novo = kBotao !== k && !(d.config.tutoriais || {})[kBotao] && d.config.dicasAuto !== false;
        const b = `<button class="tour-ajuda${novo ? " novo" : ""}" data-acao="tour" data-k="${kBotao}" aria-label="Como funciona esta ${kBotao !== k ? "aba" : "tela"}" title="Como funciona esta ${kBotao !== k ? "aba" : "tela"}">?</button>`;
        if (lugar.tagName === "H1") lugar.insertAdjacentHTML("beforeend", b); else lugar.insertAdjacentHTML("afterbegin", b);
      }
    }
    clearTimeout(timerAuto);
    if (!podeConvidar(d, k)) return;
    // espera a tela assentar (e o "olá" de abertura sair)
    const tentar = (n) => {
      timerAuto = setTimeout(() => {
        const r = App().rota();
        if (!r || r.secao !== k || !podeConvidar(App().dados(), k)) return;
        if (ocupado()) { if (n < 20) tentar(n + 1); return; }
        iniciar(k, { convite: true });
      }, n ? 700 : 900);
    };
    tentar(0);
  });

  // cartão em Ajustes
  function cartaoAjustes(d) {
    const vistos = d.config.tutoriais || {};
    return UI.card({ titulo: "Tutoriais", sub: "o passo a passo de cada tela", id: "sec-tutoriais", corpo: `<div class="pad">
      <div class="tour-lista">${Object.keys(TOURS).filter((k) => k.indexOf("/") === -1 && k !== "treino" && (!TOURS[k].area || global.Areas.area(d, TOURS[k].area))).map((k) => `<button class="tour-item" data-acao="tour" data-k="${k}"><span class="tour-ic">${TOURS[k].icone}</span><span><b>${esc(TOURS[k].nome)}</b><small>${vistos[k] ? "✓ visto" : "não visto"}</small></span><i>›</i></button>`).join("")}</div>
      ${global.Personalizar.interruptor("tour_auto", "Mostrar ao abrir uma tela pela primeira vez", d.config.dicasAuto !== false, "Um convite rápido; dá para dizer “Agora não”.", 'data-mudar="tour-auto"')}
      <p class="ajuda">Cada aba também tem o seu: toque no <b class="tour-q">?</b> ao lado do título. Todos ficam na <button class="link-acao" data-acao="ir" data-secao="ajuda" data-param="tutoriais">Central de ajuda</button>.</p>
      <div class="botoes-linha"><button class="btn pequeno" data-acao="tour-zerar">Mostrar todos de novo</button><button class="btn pequeno" data-acao="primeiro-uso">✨ Configuração inicial</button><button class="btn pequeno" data-acao="novidades">🎉 O que há de novo</button></div>
    </div>` });
  }

  App().registrarAcoes({
    "tour": (el) => iniciar(el.dataset.k),
    "tour-ajuda": () => { fechar(); UI.aposVoltar(() => App().ir("ajuda")); },
    "novidades": () => abrirNovidades(),
    "tour-proximo": proximo,
    "tour-voltar": voltar,
    "tour-fechar": () => fechar(),
    "tour-zerar": () => { const d = App().dados(); d.config.tutoriais = {}; d.config.dicasAuto = true; App().salvar("Pronto! As explicações aparecem de novo na primeira visita a cada tela."); }
  });
  App().registrarMudancas({
    "tour-auto": (el) => { const d = App().dados(); d.config.dicasAuto = el.checked; App().salvar(el.checked ? "Convites ligados." : "Convites desligados — use o ? de cada tela quando quiser."); }
  });

  // ---------------------------------------------------------------------
  // "O que há de novo": aparece uma vez depois de uma atualização
  // ---------------------------------------------------------------------
  const NOVIDADES = {
    versao: "4.1",
    itens: [
      ["📸", "Fotos de evolução", "Em Corpo → <b>Fotos</b>: guarde fotos com data e pose e compare o antes e o depois, com o peso de cada data. Ficam só neste aparelho."],
      ["🏷️", "Produtos, marcas e rótulos", "Em Alimentação → <b>Produtos</b>: fotografe o rótulo, anote marca, preço e onde achou. A marca preferida aparece na lista de compras."],
      ["👆", "Deslizar para os lados", "No celular, arraste para a esquerda ou direita para trocar de aba e de tela."],
      ["☰", "Menu pela logo", "Toque na logo, no canto de cima, para abrir o menu com todas as telas, a busca, a ajuda e o tema."],
      ["⚡", "Abertura mais discreta", "A tela com o seu avatar aparece só ao abrir o app — não a cada recarregada."],
      ["🔎", "Da versão 4.0", "Busca em tudo, Ajustes em categorias, Central de ajuda, um dia em detalhe, calculadora de metas, cronômetro de descanso e temas prontos."]
    ]
  };
  function abrirNovidades() {
    const d = App().dados();
    UI.abrirModal(`<div class="nov"><span class="nov-selo">Novidades · versão ${NOVIDADES.versao}</span><h3>O app ficou melhor 🎉</h3>
      <ul class="nov-lista">${NOVIDADES.itens.map((x) => `<li><span class="nov-ic">${x[0]}</span><span><b>${esc(x[1])}</b><small>${x[2]}</small></span></li>`).join("")}</ul>
      <div class="pu-rodape"><button class="btn" data-acao="nov-fechar">Fechar</button><button class="btn primario" data-acao="nov-ajuda">Abrir a Central de ajuda</button></div></div>`,
    { largo: true, semFoco: true, aoFechar: () => {
      d.config.novidadesVistas = NOVIDADES.versao; A.salvarDados(d, true, true);
      novidadesPendentes = false;
      // a tela atual pode ter um convite esperando
      setTimeout(() => { const r = App().rota(); if (r && podeConvidar(App().dados(), r.secao) && !ocupado()) iniciar(r.secao, { convite: true }); }, 700);
    } });
    document.getElementById("modal").classList.add("modal-pu");
  }
  App().aoSalvar((d, abertura) => {
    if (!abertura) return;
    const c = d.config;
    if (c.novidadesVistas === NOVIDADES.versao) return;
    const antigo = c.onboardingFeito || (global.Backup && global.Backup.temDados(d));
    // quem está chegando agora não precisa das novidades: já começa com tudo
    if (!antigo || d.demo) { if (!c.onboardingFeito && !d.demo) return; c.novidadesVistas = NOVIDADES.versao; A.salvarDados(d, true, true); return; }
    if (!api.auto) return;
    novidadesPendentes = true;
    const tentar = (n) => setTimeout(() => {
      if (App().dados().config.novidadesVistas === NOVIDADES.versao) { novidadesPendentes = false; return; }
      if (ocupado() || ativo()) { if (n < 30) tentar(n + 1); else novidadesPendentes = false; return; }
      clearTimeout(timerAuto);
      abrirNovidades();
    }, n ? 600 : 1700);
    tentar(0);
  });
  App().registrarAcoes({
    // quem fechou já leu sobre o "?" — a tela Hoje não precisa do convite agora
    "nov-fechar": () => { UI.fecharModal(); marcarVisto("dashboard"); },
    "nov-ajuda": () => { UI.fecharModal(); marcarVisto("dashboard"); App().ir("ajuda"); },
    "nov-tour": () => { UI.fecharModal(); App().ir("dashboard"); setTimeout(() => UI.aposVoltar(() => iniciar("dashboard")), 450); }
  });

  Object.assign(api, { TOURS, iniciar, fechar, ativo, cartaoAjustes, achar, abrirNovidades, NOVIDADES });
  global.Tutorial = api;
})(window);
