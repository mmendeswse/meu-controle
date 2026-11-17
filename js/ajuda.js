/**
 * ajuda.js
 * -----------------------------------------------------------------------
 * Central de ajuda — tudo o que ensina a usar o app num lugar só:
 *  - "Aproveite melhor o app": uma lista do que ainda vale configurar;
 *  - "Como faço para…": perguntas por assunto, com o passo a passo e um
 *    botão que leva direto ao lugar;
 *  - os tutoriais guiados de cada tela e de cada aba;
 *  - glossário (kcal, macros, IMC, RPE…) e atalhos de teclado;
 *  - a "dica do dia", um cartão pequeno na tela Hoje.
 *
 * Abre por Ajustes → Central de ajuda, pelo menu "Mais", pela busca e
 * pelo botão "?" da barra lateral. #/ajuda/<tópico> abre já no tópico.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo, UI = global.UI, A = global.Armazenamento;
  const esc = UI.esc;
  const App = () => global.App;
  const AR = () => global.Areas;
  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // ---------------------------------------------------------------------
  // "Como faço para…"
  // b: botão [rótulo, rota ou "acao:nome", dados]
  // ---------------------------------------------------------------------
  const ASSUNTOS = [
    { k: "inicio", r: "Começando", ic: "🚀" }, { k: "alimentacao", r: "Alimentação e água", ic: "🍽️", area: "alimentacao" },
    { k: "academia", r: "Treino", ic: "🏋️", area: "academia" }, { k: "evolucao", r: "Corpo e metas", ic: "⚖️" },
    { k: "bemestar", r: "Bem-estar, hábitos e remédios", ic: "💚", area: "bemestar" }, { k: "compras", r: "Compras e estoque", ic: "🛒", area: "compras" },
    { k: "dados", r: "Seus dados e aparelhos", ic: "🛟" }, { k: "jeito", r: "Deixar do meu jeito", ic: "🎨" }
  ];
  const TOPICOS = [
    // começando
    { k: "por-onde-comeco", a: "inicio", q: "Por onde eu começo?", p: "primeiros passos iniciar novo configurar",
      passos: ["Abra a <b>Configuração inicial</b>: ela pergunta o que você quer acompanhar e liga só essas áreas.", "Registre o <b>peso de hoje</b> e crie <b>uma meta</b> — já dá para ver progresso.", "No dia a dia, use só a tela <b>Hoje</b> e o botão <b>+</b>. O resto o app calcula."],
      b: ["Abrir a configuração inicial", "acao:primeiro-uso"] },
    { k: "registro-rapido", a: "inicio", q: "Como registro algo rápido, sem procurar a tela?", p: "botao mais atalho rapido registrar",
      passos: ["Toque no botão <b>+</b>, que aparece em todas as telas.", "Escolha o que registrar: refeição, água, peso, treino, check-in…", "No computador, a tecla <b>N</b> abre o mesmo menu. Em Ajustes → Navegação você escolhe quais atalhos aparecem e a ordem."],
      b: ["Personalizar o botão +", "configuracoes/navegacao"] },
    { k: "buscar", a: "inicio", q: "Como acho uma tela, um ajuste ou um alimento?", p: "busca procurar encontrar lupa pesquisar",
      passos: ["Toque na <b>lupa</b> (no topo do celular ou no menu do computador).", "Digite o que procura: “backup”, “remédio”, “frango”, “tema”…", "Toque no resultado. No computador: <b>/</b> ou <b>Ctrl + K</b>."],
      b: ["Abrir a busca", "acao:busca-abrir"] },
    { k: "tela-hoje", a: "inicio", q: "O que é a tela Hoje e como marco o que já fiz?", p: "roteiro seu dia marcar concluido aneis semana",
      passos: ["<b>Seu dia</b> lista refeições, remédios, hábitos e treino na ordem dos seus horários.", "Toque num item para marcar como feito. O que já foi feito fica recolhido.", "Em <b>Sua semana</b>, toque num dia para ver tudo o que foi registrado nele."],
      b: ["Ver o tutorial da tela Hoje", "acao:tour", { k: "dashboard" }] },
    { k: "dia-passado", a: "inicio", q: "Esqueci de registrar ontem. Dá para lançar depois?", p: "ontem dia anterior passado esqueci retroativo historico",
      passos: ["Na tela Hoje, toque no dia em <b>Sua semana</b> (ou busque “Ver um dia em detalhe”).", "Na janela do dia, toque no que quer lançar: alimentação, peso, check-in, água…", "No diário de Alimentação, as setas ‹ › também trocam o dia."],
      b: ["Abrir o dia de ontem", "acao:dia-detalhe", { data: "ontem" }] },
    { k: "exemplo", a: "inicio", q: "Posso ver o app cheio antes de usar?", p: "dados de exemplo demonstracao demo testar",
      passos: ["Em Ajustes → Excluir dados e exemplo, toque em <b>Carregar dados de exemplo</b>.", "Explore à vontade: é tudo fictício e marcado com um aviso amarelo.", "Quando quiser, <b>Apagar exemplo e começar do zero</b>.", "Atenção: o exemplo substitui os dados que já estiverem no aparelho — faça um backup antes."],
      b: ["Abrir Excluir dados e exemplo", "configuracoes/dados"] },

    // alimentação
    { k: "registrar-refeicao", a: "alimentacao", q: "Como registro o que comi?", p: "refeicao diario comer almoco cafe jantar lancar",
      passos: ["Botão <b>+</b> → <b>Refeição</b> (ou Alimentação → Diário → Refeição).", "Escolha o tipo (café, almoço…) e adicione os alimentos com a quantidade.", "Marque ✓ quando comer: entra nas calorias do dia e desconta do estoque."],
      b: ["Registrar refeição", "acao:rapido-refeicao"] },
    { k: "cadastrar-alimento", a: "alimentacao", q: "O alimento que eu como não está na lista. E agora?", p: "novo alimento cadastrar tabela nutricional calorias rotulo",
      passos: ["Alimentação → aba <b>Alimentos</b> → <b>Novo</b> (ou digite o nome novo direto na refeição).", "Copie do rótulo: porção, calorias, proteína, carboidratos e gorduras.", "Preço é opcional — com ele o app estima o custo das refeições e das compras."],
      b: ["Cadastrar alimento", "acao:rapido-alimento"] },
    { k: "favoritas", a: "alimentacao", q: "Como repito uma refeição sem montar tudo de novo?", p: "favorita repetir copiar refeicao igual modelo",
      passos: ["Na refeição pronta, toque na <b>estrela</b> para salvar como favorita.", "Depois, ao criar uma refeição, escolha a favorita: os itens entram de uma vez.", "<b>Copiar dia</b> (no Diário) repete um dia inteiro em outra data."],
      b: ["Abrir o Diário", "alimentacao"] },
    { k: "cardapio", a: "alimentacao", q: "Como planejo o cardápio da semana?", p: "planejar semana cardapio planejamento marmita",
      passos: ["Alimentação → aba <b>Semana</b>.", "Toque num espaço vazio para planejar a refeição daquele dia.", "O cartão <b>Compras para o cardápio</b> mostra o que falta — um toque manda para a lista."],
      b: ["Abrir a Semana", "alimentacao/semana"] },
    { k: "agua", a: "alimentacao", q: "Como registro água e mudo o tamanho do copo?", p: "agua copo ml litros beber hidratacao",
      passos: ["Na tela Hoje, o botão <b>+250 ml</b> soma um copo com um toque.", "Para outro valor ou para corrigir, toque em <b>Água</b> no “Seu dia”.", "O tamanho do copo fica em Ajustes → Aparência → Copo de água."],
      b: ["Registrar água", "acao:rapido-agua"] },
    { k: "quanto-comer", a: "alimentacao", q: "Quantas calorias e quanta proteína eu deveria comer?", p: "calculadora metas calorias proteina tmb gasto deficit emagrecer ganhar massa",
      passos: ["Abra a <b>Calculadora de metas</b>.", "Informe sexo, idade, altura, peso, nível de atividade e objetivo.", "Ela estima calorias, proteína e água e cria as metas para você. É uma estimativa — um nutricionista ajusta para o seu caso."],
      b: ["Abrir a calculadora", "acao:calc-metas"], crianca: false },

    // treino
    { k: "montar-ficha", a: "academia", q: "Como monto minhas fichas de treino?", p: "ficha treino a b c exercicios series repeticoes",
      passos: ["Treino → aba <b>Fichas e plano</b> → <b>Nova ficha</b>.", "Dê um nome (ex.: “A — Peito e tríceps”) e adicione exercícios com séries e repetições.", "No <b>Plano semanal</b>, diga em que dia cai cada ficha — o treino do dia aparece sozinho na tela Hoje."],
      b: ["Abrir Fichas e plano", "academia/fichas"] },
    { k: "fazer-treino", a: "academia", q: "Como registro um treino na academia?", p: "iniciar treino series carga registrar academia",
      passos: ["Toque em <b>Iniciar</b> no treino de hoje (ou botão + → Treino).", "Em cada exercício, ajuste carga e repetições e toque no círculo para marcar ✓.", "O <b>cronômetro de descanso</b> começa sozinho a cada série marcada.", "No fim, <b>Concluir treino</b>."],
      b: ["Ir para Treino", "academia"] },
    { k: "descanso", a: "academia", q: "Como funciona o cronômetro de descanso?", p: "descanso timer cronometro intervalo entre series",
      passos: ["Ele aparece na tela do treino aberto.", "Marque uma série como feita e a contagem começa; no fim, o celular vibra e apita.", "Toque no tempo para trocar (30 s a 3 min) ou em ✕ para parar. Dá para desligar o início automático ali mesmo."],
      b: ["Ir para Treino", "academia"] },
    { k: "carga", a: "academia", q: "Como vejo se estou evoluindo nas cargas?", p: "evolucao carga progressao exercicio grafico",
      passos: ["Treino → aba <b>Carga</b>.", "Escolha o exercício: o gráfico mostra a carga ao longo das semanas.", "Durante o treino, cada linha mostra a carga da última vez (e ▲ quando você subiu)."],
      b: ["Abrir Carga", "academia/carga"] },

    // corpo e metas
    { k: "peso", a: "evolucao", q: "Como registro peso e medidas?", p: "peso balanca medidas cintura bioimpedancia", area: "evolucao",
      passos: ["Botão <b>+</b> → <b>Peso e medidas</b>.", "Só o peso já serve. Medidas e bioimpedância são opcionais.", "Pese sempre no mesmo horário (de manhã, em jejum) para o gráfico ficar confiável."],
      b: ["Registrar peso", "acao:rapido-peso"], crianca: false },
    { k: "criar-meta", a: "evolucao", q: "Como crio uma meta e sei se estou no caminho?", p: "meta objetivo prazo progresso status verde amarelo vermelho", area: "metas",
      passos: ["Metas → <b>Nova meta</b>: escolha o tipo, o valor e o prazo.", "🟢 no caminho · 🟡 atenção · 🔴 fora da meta.", "A avaliação olha a <b>tendência</b> dos registros, não só o último valor — um dia ruim não muda a cor."],
      b: ["Criar meta", "acao:nova-meta"] },
    { k: "relatorio-consulta", a: "evolucao", q: "Como levo meus dados para o médico ou nutricionista?", p: "relatorio pdf imprimir consulta medico nutricionista exportar", area: "relatorios",
      passos: ["Relatórios → escolha o período (semana, mês ou trimestre).", "Toque em <b>PDF</b> para imprimir ou salvar, ou em planilha para abrir no Excel."],
      b: ["Abrir Relatórios", "relatorios"] },

    // bem-estar
    { k: "checkin", a: "bemestar", q: "O que é o check-in do dia?", p: "checkin sono humor energia estresse passos", area: "checkin",
      passos: ["Um registro de 10 segundos: como dormiu, humor, energia, estresse e passos.", "Faça pelo botão <b>+</b> → Check-in ou pelos itens “Sono” e “Como foi o dia” na tela Hoje.", "Com alguns dias, o app mostra o que mais influencia o seu bem-estar."],
      b: ["Fazer o check-in", "acao:rapido-checkin"] },
    { k: "habito", a: "bemestar", q: "Como crio um hábito ou um desafio de 21 dias?", p: "habito desafio 21 dias sequencia rotina", area: "habitos",
      passos: ["Bem-estar → aba <b>Hábitos</b> → <b>Novo hábito</b> (ou use um modelo pronto).", "Escolha os dias, o horário e, se quiser, uma duração — vira um desafio com contagem de dias.", "Ele aparece no “Seu dia”; toque para marcar. A sequência 🔥 cresce a cada dia cumprido."],
      b: ["Ver hábitos prontos", "acao:habito-modelos"] },
    { k: "remedio", a: "bemestar", q: "Como o app me lembra dos remédios?", p: "remedio lembrete horario dose estoque acabando notificacao", area: "remedios",
      passos: ["Bem-estar → aba <b>Remédios</b> → <b>Novo</b>: nome, dose, horários e quantos você tem em casa.", "Cada dose aparece no “Seu dia”. Ao marcar, o estoque baixa e o app avisa quando estiver acabando.", "Para tocar na hora: Ajustes → <b>Lembretes</b> (app aberto) ou <b>Google Agenda</b> (mesmo com o app fechado)."],
      b: ["Cadastrar remédio", "acao:novo-remedio"] },
    { k: "jejum", a: "bemestar", q: "Como uso o cronômetro de jejum?", p: "jejum intermitente 16 8 cronometro", area: "jejum",
      passos: ["Botão <b>+</b> → <b>Jejum</b> e escolha a meta de horas.", "O contador aparece no topo da tela Hoje.", "Ao fazer a próxima refeição, toque em <b>Encerrar</b>."],
      b: ["Abrir Jejum", "bemestar/jejum"], crianca: false },

    // compras
    { k: "lista", a: "compras", q: "Como funciona a lista de compras?", p: "lista compras mercado comprar item automatica",
      passos: ["Compras → aba <b>Lista</b> → <b>Novo</b>, ou botão + → Item na lista.", "No mercado, marque cada item: <b>comprado</b> entra no estoque e nos gastos.", "O que falta para o cardápio planejado e para o estoque mínimo entra sozinho, marcado como “auto”."],
      b: ["Abrir a Lista", "compras"] },
    { k: "estoque", a: "compras", q: "Como controlo o que tenho em casa?", p: "estoque despensa em casa minimo acabando",
      passos: ["Compras → aba <b>Em casa</b>.", "Defina a quantidade e o <b>mínimo</b> de cada alimento.", "Quando ficar abaixo do mínimo, o app avisa e põe na lista de compras."],
      b: ["Abrir Em casa", "compras/estoque"] },
    { k: "gastos", a: "compras", q: "Onde vejo quanto gastei com comida?", p: "gastos dinheiro quanto gastei mes mercado categoria",
      passos: ["Compras → aba <b>Gastos</b>.", "Veja por mês, por categoria e por mercado, e o histórico de preços de cada item.", "Uma <b>meta de gastos</b> (em Metas) avisa quando o mês passar do limite."],
      b: ["Abrir Gastos", "compras/gastos"] },

    // dados
    { k: "backup", a: "dados", q: "Meus dados ficam onde? Posso perder tudo?", p: "backup perder dados seguranca copia salvar onde ficam privacidade",
      passos: ["Tudo fica <b>só neste aparelho</b> — nada vai para servidor.", "Por isso, faça <b>backup</b>: Ajustes → Backup → “Fazer backup”. O app lembra quando estiver atrasado.", "No computador, dá para escolher uma pasta e o backup passa a ser automático."],
      b: ["Abrir Backup", "configuracoes/backup"] },
    { k: "sincronizar", a: "dados", q: "Como uso no celular e no computador com os mesmos dados?", p: "sincronizar dois aparelhos celular computador tablet qr code",
      passos: ["Ajustes → <b>Sincronização</b> → criar conta (usa um repositório privado seu no GitHub; os dados vão criptografados).", "No outro aparelho, abra o app e leia o <b>QR code</b> (ou cole o código).", "Depois disso, o que você registra num aparelho aparece no outro."],
      b: ["Abrir Sincronização", "configuracoes/sync"] },
    { k: "trocar-celular", a: "dados", q: "Vou trocar de celular. Como levo meus dados?", p: "trocar celular novo aparelho migrar restaurar transferir",
      passos: ["No aparelho antigo: Ajustes → Backup → <b>Fazer backup</b> e guarde o arquivo (e-mail, nuvem…).", "No novo: abra o app → Ajustes → Backup → <b>Restaurar</b> e escolha o arquivo.", "Com a Sincronização ligada, basta ler o QR code no aparelho novo."],
      b: ["Abrir Backup", "configuracoes/backup"] },
    { k: "pin", a: "dados", q: "Como impeço que outra pessoa abra o app?", p: "pin senha bloquear face id digital privacidade",
      passos: ["Ajustes → <b>Segurança</b> → criar um PIN de 6 dígitos.", "Se o aparelho tiver Face ID ou digital, dá para usar no lugar do PIN.", "Guarde o PIN: sem ele, só restaurando um backup."],
      b: ["Abrir Segurança", "configuracoes/seguranca"] },
    { k: "instalar", a: "dados", q: "Como instalo o app no celular?", p: "instalar icone tela inicial pwa offline sem internet",
      passos: ["Android (Chrome): menu ⋮ → <b>Instalar app</b>.", "iPhone/iPad (Safari): <b>Compartilhar → Adicionar à Tela de Início</b>.", "Instalado, ele abre em tela cheia e funciona sem internet."],
      b: ["Ver como instalar", "configuracoes/instalar"] },
    { k: "atualizar", a: "dados", q: "Como pego a versão nova do app?", p: "atualizar versao nova update puxar",
      passos: ["Ele se atualiza sozinho quando há internet.", "Para forçar: no celular, <b>puxe a tela para baixo</b> no topo de qualquer tela; no computador, feche e abra.", "A versão aparece no rodapé e em Ajustes."] },

    // do meu jeito
    { k: "aparencia", a: "jeito", q: "Como mudo cores, tema e tamanho da letra?", p: "tema cor escuro claro fonte letra grande aparencia visual",
      passos: ["Ajustes → <b>Aparência</b>.", "Escolha um <b>tema pronto</b> ou monte o seu: claro/escuro, cor, fundo, cantos e tipo de letra.", "<b>Tamanho da letra</b> e <b>Alto contraste</b> ajudam quem enxerga com dificuldade."],
      b: ["Abrir Aparência", "configuracoes/aparencia"] },
    { k: "simplificar", a: "jeito", q: "O app tem coisa demais para mim. Dá para simplificar?", p: "simplificar esconder desligar areas menos coisas idoso crianca perfil",
      passos: ["Ajustes → <b>O que você usa</b>.", "Escolha um <b>perfil pronto</b> (ex.: Saúde e remédios) ou desligue área por área.", "O que você desliga some do menu, do botão + e dos alertas — os dados continuam guardados."],
      b: ["Abrir O que você usa", "configuracoes/areas"] },
    { k: "menu", a: "jeito", q: "Como mudo a ordem do menu e as abas do celular?", p: "ordem menu abas barra tela inicial navegacao",
      passos: ["Ajustes → <b>Navegação</b>.", "Suba e desça as telas com as setas, escolha as 4 abas do celular e a tela que abre primeiro.", "Ali também ficam o lado e os atalhos do botão <b>+</b>."],
      b: ["Abrir Navegação", "configuracoes/navegacao"] },
    { k: "tela-hoje-cartoes", a: "jeito", q: "Como escolho o que aparece na tela Hoje?", p: "tela hoje cartoes esconder ordem destaque",
      passos: ["Ajustes → <b>Tela Hoje</b>: ligue, desligue e reordene os cartões.", "Em Ajustes → <b>Rotina do dia</b> você define os horários e o que entra no “Seu dia”."],
      b: ["Abrir Tela Hoje", "configuracoes/hoje"] },
    { k: "familia", a: "jeito", q: "Dá para a família toda usar?", p: "familia varias pessoas filhos avos perfil crianca",
      passos: ["Cada pessoa usa no <b>seu próprio aparelho</b> (ou no seu navegador): os dados são separados.", "Na Configuração inicial, cada um escolhe um perfil: completo, saúde e remédios, criança ou fitness.", "O perfil <b>Criança</b> não mostra peso, calorias, dietas nem jejum."],
      b: ["Abrir a configuração inicial", "acao:primeiro-uso"] }
  ];
  function topicos(d) {
    const crianca = d.config.perfilUso === "crianca";
    return TOPICOS.filter((t) => {
      const as = ASSUNTOS.find((x) => x.k === t.a);
      if (as && as.area && !AR().area(d, as.area)) return false;
      if (t.area && !AR().area(d, t.area)) return false;
      return !(crianca && t.crianca === false);
    });
  }

  const GLOSSARIO = [
    ["kcal (calorias)", "A energia dos alimentos. Comer menos do que você gasta emagrece; comer mais, engorda."],
    ["Macros", "Os três grupos que dão calorias: proteína, carboidrato e gordura."],
    ["Proteína", "Constrói e mantém músculo. Carnes, ovos, leite, feijão, whey. Costuma-se mirar em 1,6 a 2 g por kg de peso para quem treina."],
    ["TMB e gasto diário", "TMB é o que o corpo gasta parado. Somando o seu dia (trabalho, treino), dá o gasto diário — a base da meta de calorias."],
    ["IMC", "Peso dividido pela altura ao quadrado. É uma referência geral: não distingue músculo de gordura."],
    ["Bioimpedância", "A medição das balanças que estimam gordura, músculo e água do corpo."],
    ["Série, repetição e carga", "3×12 com 20 kg = 3 séries de 12 repetições levantando 20 kg."],
    ["Volume de treino", "Séries × repetições × carga, somado. Mostra o quanto você trabalhou no treino."],
    ["RPE", "Nota de esforço de 1 a 10. RPE 8 = terminou a série e ainda faria umas 2 repetições."],
    ["Jejum intermitente", "Ficar um período sem comer (ex.: 16 h) e comer no restante (8 h). Converse com um profissional antes."],
    ["Check-in", "O registro rápido do dia: sono, humor, energia, estresse e passos."],
    ["Sequência 🔥", "Quantos dias seguidos você cumpriu um hábito ou o plano de treino."],
    ["Backup", "Uma cópia dos seus dados num arquivo, para restaurar se trocar ou perder o aparelho."],
    ["Sincronização", "Manter os mesmos dados em mais de um aparelho, atualizando sozinho."]
  ];

  // ---------------------------------------------------------------------
  // "Aproveite melhor o app": o que ainda vale configurar
  // ---------------------------------------------------------------------
  function lista(d) {
    const u = d.usuarios[0], usa = (k) => AR().area(d, k), l = [];
    const add = (ok, t, s, b) => l.push({ ok: !!ok, t, s, b });
    add(u.nome && u.nome !== "Eu", "Dizer o seu nome", "O app passa a te chamar pelo nome.", ["Aparência", "configuracoes/aparencia"]);
    if (usa("evolucao")) add(d.pesagens.length, "Registrar o primeiro peso", "O ponto de partida dos gráficos.", ["Registrar", "acao:rapido-peso"]);
    if (usa("metas")) add(d.metas.length, "Criar uma meta", "Peso, água, treinos por semana, sono…", ["Criar meta", "acao:nova-meta"]);
    if (usa("alimentacao")) add(d.refeicoes.length, "Registrar uma refeição", "Para acompanhar calorias e proteína.", ["Registrar", "acao:rapido-refeicao"]);
    if (usa("academia")) add(d.fichas.length, "Montar uma ficha de treino", "Depois é só tocar em Iniciar.", ["Nova ficha", "acao:nova-ficha"]);
    if (usa("habitos")) add(d.habitos.length, "Criar um hábito", "Algo pequeno para fazer todo dia.", ["Modelos", "acao:habito-modelos"]);
    if (usa("remedios")) add(d.remedios.length, "Cadastrar remédios ou suplementos", "Com horários e estoque.", ["Cadastrar", "acao:novo-remedio"]);
    if (usa("checkin")) add(d.bemEstar.length, "Fazer o primeiro check-in", "Sono e humor em 10 segundos.", ["Check-in", "acao:rapido-checkin"]);
    add(d.config.ultimoBackup || (d.config.backup && (d.config.backup.pasta || d.config.backup.ultimoAuto)) || (global.Sync && global.Sync.conectado && global.Sync.conectado()), "Proteger os dados", "Backup ou sincronização: para não perder nada.", ["Backup", "configuracoes/backup"]);
    add(d.config.lembretes && d.config.lembretes.ativos, "Ligar os lembretes", "Avisos de remédios, hábitos e água.", ["Lembretes", "configuracoes/lembretes"]);
    if (global.Instalar && global.Instalar.instalado) add(global.Instalar.instalado(), "Instalar o app", "Ícone na tela de início e uso sem internet.", ["Como instalar", "configuracoes/instalar"]);
    add((d.config.tutoriais || {}).dashboard, "Ver o tutorial da tela Hoje", "30 segundos para entender o dia a dia.", ["Ver agora", "acao:tour", { k: "dashboard" }]);
    return l;
  }

  // ---------------------------------------------------------------------
  // página
  // ---------------------------------------------------------------------
  function botao(b, classe) {
    if (!b) return "";
    const dados = Object.keys(b[2] || {}).map((k) => ` data-${k}="${esc(b[2][k] === "ontem" ? N.hoje(-1) : b[2][k])}"`).join("");
    if (b[1].indexOf("acao:") === 0) return `<button class="btn pequeno ${classe || ""}" data-acao="${b[1].slice(5)}"${dados}>${esc(b[0])}</button>`;
    const p = b[1].split("/");
    return `<button class="btn pequeno ${classe || ""}" data-acao="ir" data-secao="${p[0]}"${p[1] ? ` data-param="${p.slice(1).join("/")}"` : ""}>${esc(b[0])} ›</button>`;
  }
  function htmlTopico(t, aberto) {
    return `<details class="aj-top" id="top-${t.k}" data-p="${esc(norm(t.q + " " + t.p + " " + t.passos.join(" ").replace(/<[^>]+>/g, "")))}"${aberto ? " open" : ""}>
      <summary>${esc(t.q)}</summary>
      <div class="aj-top-corpo"><ol>${t.passos.map((p) => `<li>${p}</li>`).join("")}</ol>${botao(t.b, "primario")}</div></details>`;
  }
  function pagina(d, rota) {
    const tops = topicos(d), abrir = rota.param;
    const cl = lista(d), feitos = cl.filter((x) => x.ok).length, falta = cl.filter((x) => !x.ok);
    const T = global.Tutorial, vistos = d.config.tutoriais || {};
    const tours = Object.keys(T.TOURS).filter((k) => !T.TOURS[k].area || AR().area(d, T.TOURS[k].area));
    const telas = tours.filter((k) => k.indexOf("/") === -1), abas = tours.filter((k) => k.indexOf("/") !== -1);
    const itemTour = (k) => `<button class="tour-item" data-acao="tour" data-k="${k}"><span class="tour-ic">${T.TOURS[k].icone}</span><span><b>${esc(T.TOURS[k].nome)}</b><small>${vistos[k] ? "✓ visto" : "não visto"}</small></span><i>›</i></button>`;
    return `<button class="voltar" data-acao="ir" data-secao="configuracoes">${UI.svg("voltar")}Ajustes</button>
      <div class="cabecalho-pagina"><div><h1>Central de ajuda</h1><p class="sub">Como fazer cada coisa, sem precisar adivinhar</p></div></div>
      <label class="aj-busca ajuda-busca">${UI.svg("buscar")}<input type="search" placeholder="O que você quer fazer? Ex.: backup, remédio, meta" data-digitar="ajuda-busca" autocomplete="off" aria-label="Buscar na ajuda"></label>
      <div class="ajuda-rapidos">
        <button data-acao="tour" data-k="dashboard"><span>🏠</span><b>Tour da tela Hoje</b><small>o essencial em 30 s</small></button>
        <button data-acao="primeiro-uso"><span>✨</span><b>Configuração inicial</b><small>escolha o que usar</small></button>
        <button data-acao="busca-abrir"><span>🔎</span><b>Buscar em tudo</b><small>telas, ações, ajustes</small></button>
        <button data-acao="ir" data-secao="ajuda" data-param="glossario"><span>📖</span><b>Glossário</b><small>kcal, macros, RPE…</small></button>
      </div>
      <div class="grid ajuda-grid"><div class="c7">
        ${ASSUNTOS.map((as) => { const l = tops.filter((t) => t.a === as.k); return l.length ? `<section class="card ajuda-assunto"><header><div><h2>${as.ic} ${esc(as.r)}</h2></div></header><div class="body">${l.map((t) => htmlTopico(t, t.k === abrir)).join("")}</div></section>` : ""; }).join("")}
        <p class="aj-vazio ajuda-vazio" hidden>Não achei nada com essas palavras. <button class="link-acao" data-acao="busca-abrir">Buscar no app todo</button></p>
      </div><div class="c5">
        ${UI.card({ titulo: "Aproveite melhor o app", sub: `${feitos} de ${cl.length} feitos`, classe: "ajuda-lado", corpo: `<div class="pad"><span class="progresso"><i style="width:${Math.round((feitos / cl.length) * 100)}%;background:var(--up)"></i></span>
          <ul class="ajuda-check">${falta.slice(0, 5).map((x) => `<li><span class="ac-txt"><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span>${botao(x.b)}</li>`).join("")}</ul>
          ${falta.length ? "" : `<p class="ajuda" style="margin-bottom:0">🎉 Tudo configurado. Bom uso!</p>`}
          ${feitos ? `<details class="ajuda-feitos"><summary>${feitos} ${UI.plural(feitos, "já feito", "já feitos")}</summary><ul>${cl.filter((x) => x.ok).map((x) => `<li>✓ ${esc(x.t)}</li>`).join("")}</ul></details>` : ""}</div>` })}
        ${UI.card({ titulo: "Tutoriais guiados", sub: "o app mostra, passo a passo, na própria tela", classe: "ajuda-lado", id: "top-tutoriais", corpo: `<div class="pad">
          <div class="tour-lista">${telas.map(itemTour).join("")}</div>
          ${abas.length ? `<details class="ajuda-feitos"${abas.some((k) => !vistos[k]) ? "" : ""}><summary>Tutoriais das abas (${abas.length})</summary><div class="tour-lista" style="margin-top:10px">${abas.map(itemTour).join("")}</div></details>` : ""}
          <p class="ajuda" style="margin-bottom:0">Em qualquer tela, o botão <b class="tour-q">?</b> ao lado do título explica a aba em que você está.</p></div>` })}
        ${UI.card({ titulo: "Dica do dia", sub: "um cartão pequeno na tela Hoje", classe: "ajuda-lado", corpo: `<div class="pad">${global.Personalizar.interruptor("dica_on", "Mostrar a dica do dia", d.config.dicas.ativo !== false, "Uma dica curta por dia, para descobrir o app aos poucos.", 'data-mudar="dica-ativo"')}
          <p class="dica-previa">💡 ${dicaAtual(d, true).t}</p></div>` })}
        ${UI.card({ titulo: "Glossário", sub: "os termos que aparecem no app", classe: "ajuda-lado", id: "top-glossario", corpo: `<dl class="glossario">${GLOSSARIO.map((g) => `<div data-p="${esc(norm(g[0] + " " + g[1]))}"><dt>${esc(g[0])}</dt><dd>${esc(g[1])}</dd></div>`).join("")}</dl>` })}
        ${UI.card({ titulo: "Atalhos de teclado", sub: "no computador", classe: "ajuda-lado so-pc", corpo: `<ul class="lista-atalhos pad">${global.Navegacao.ATALHOS.map((a) => `<li><kbd>${esc(a[0])}</kbd><span>${esc(a[1])}</span></li>`).join("")}</ul>` })}
      </div></div>`;
  }
  App().registrarPagina("ajuda", {
    titulo: "Ajuda", menu: "configuracoes",
    render: pagina,
    depois(d, rota) {
      if (!rota.param) return;
      const el = document.getElementById("top-" + rota.param);
      if (el) setTimeout(() => { el.scrollIntoView({ block: "center", behavior: "auto" }); el.classList.add("destaque"); setTimeout(() => el.classList.remove("destaque"), 1800); }, 60);
      // abre uma vez só: os próximos redesenhos ficam onde estão
      rota.param = null;
      try { history.replaceState(null, "", "#/ajuda"); } catch (e) { /* sem histórico */ }
    }
  });
  App().registrarMudancas({
    "ajuda-busca": (el) => {
      const q = norm(el.value.trim()).split(/\s+/).filter(Boolean);
      let n = 0;
      document.querySelectorAll(".aj-top").forEach((t) => { const ok = q.every((x) => t.dataset.p.indexOf(x) !== -1); t.hidden = !ok; if (ok) n++; t.open = !!q.length && ok && n <= 3; });
      document.querySelectorAll(".ajuda-assunto").forEach((s) => { s.hidden = !s.querySelector(".aj-top:not([hidden])"); });
      document.querySelectorAll(".glossario > div").forEach((g) => { g.hidden = !q.every((x) => g.dataset.p.indexOf(x) !== -1); });
      const v = document.querySelector(".ajuda-vazio"); if (v) v.hidden = n > 0;
    },
    "dica-ativo": (el) => { App().dados().config.dicas.ativo = el.checked; App().salvar(el.checked ? "Dica do dia ligada." : "Dica do dia desligada.", { semIntegracao: true }); }
  });

  // ---------------------------------------------------------------------
  // dica do dia (tela Hoje)
  // ---------------------------------------------------------------------
  const DICAS = [
    { t: "Toque num dia em <b>Sua semana</b> para ver tudo o que você registrou nele — e lançar o que esqueceu.", b: ["Ver ontem", "acao:dia-detalhe", { data: "ontem" }] },
    { t: "A <b>lupa</b> acha qualquer coisa: uma tela, um ajuste, um alimento. No computador, tecle <b>/</b>.", b: ["Buscar", "acao:busca-abrir"] },
    { t: "Não sabe quanto comer? A <b>calculadora de metas</b> estima calorias, proteína e água para o seu objetivo.", b: ["Calcular", "acao:calc-metas"], area: "alimentacao", crianca: false },
    { t: "Refeição que se repete? Toque na <b>estrela</b> dela e, da próxima vez, ela entra com um toque.", b: ["Abrir o diário", "alimentacao"], area: "alimentacao" },
    { t: "No treino, o <b>cronômetro de descanso</b> começa sozinho quando você marca uma série.", b: ["Ir para Treino", "academia"], area: "academia" },
    { t: "Tocar de novo na aba em que você já está <b>volta ao topo</b> da tela.", },
    { t: "O botão <b>+</b> pode ficar à esquerda e mostrar só os atalhos que você usa.", b: ["Personalizar", "configuracoes/navegacao"] },
    { t: "Escolha um <b>tema pronto</b> — Oceano, Floresta, Pôr do sol… — ou monte o seu com qualquer cor.", b: ["Ver temas", "configuracoes/aparencia"] },
    { t: "O botão <b>?</b> ao lado do título explica a aba em que você está, passo a passo." },
    { t: "Planeje as refeições na aba <b>Semana</b>: o que faltar vai sozinho para a lista de compras.", b: ["Abrir a Semana", "alimentacao/semana"], area: "alimentacao" },
    { t: "Cadastre a quantidade de cada remédio em casa: o app avisa <b>antes de acabar</b>.", b: ["Remédios", "bemestar/remedios"], area: "remedios" },
    { t: "Um hábito com duração vira <b>desafio</b>: “21 dias sem refrigerante”, com contagem de dias.", b: ["Hábitos prontos", "acao:habito-modelos"], area: "habitos" },
    { t: "Seus dados ficam só neste aparelho. Um <b>backup</b> por semana evita perder tudo.", b: ["Backup", "configuracoes/backup"] },
    { t: "Use no celular e no computador com os mesmos dados: ligue a <b>Sincronização</b>.", b: ["Sincronizar", "configuracoes/sync"] },
    { t: "Pese-se sempre no <b>mesmo horário</b> (de manhã, em jejum): o gráfico fica muito mais confiável.", area: "evolucao", crianca: false },
    { t: "As metas olham a <b>tendência</b>, não o último registro. Um dia fora da curva não muda a cor.", b: ["Ver metas", "metas"], area: "metas" },
    { t: "Vai à consulta? Em <b>Relatórios</b> você gera um PDF do período para mostrar ao profissional.", b: ["Relatórios", "relatorios"], area: "relatorios" },
    { t: "Desligue as áreas que você não usa: o menu e a tela Hoje ficam mais simples.", b: ["O que você usa", "configuracoes/areas"] },
    { t: "Com o <b>Google Agenda</b>, os remédios tocam mesmo com o app fechado — até no relógio.", b: ["Google Agenda", "configuracoes/agenda"], area: "remedios" },
    { t: "Um <b>PIN</b> impede que alguém veja seus dados se pegar o seu celular.", b: ["Segurança", "configuracoes/seguranca"] },
    { t: "Em <b>Ajustes → Tela Hoje</b> você escolhe quais cartões aparecem aqui e em que ordem.", b: ["Tela Hoje", "configuracoes/hoje"] },
    { t: "O check-in leva 10 segundos e mostra, com o tempo, <b>o que mexe com o seu sono e humor</b>.", b: ["Check-in", "acao:rapido-checkin"], area: "checkin" },
    { t: "Na aba <b>Carga</b> do Treino, veja a evolução de cada exercício ao longo das semanas.", b: ["Ver carga", "academia/carga"], area: "academia" },
    { t: "A <b>Central de ajuda</b> tem o passo a passo de tudo, com botões que levam direto ao lugar.", b: ["Abrir a ajuda", "ajuda"] }
  ];
  function dicaAtual(d, ignorarOculta) {
    const crianca = d.config.perfilUso === "crianca";
    const l = DICAS.filter((x) => (!x.area || AR().area(d, x.area)) && !(crianca && x.crianca === false));
    const dia = Math.floor(N.paraData(N.hoje(0)).getTime() / 86400000);
    const c = d.config.dicas || {};
    if (!ignorarOculta && (c.ativo === false || c.ocultaEm === N.hoje(0))) return null;
    return l[(((dia + (Number(c.salto) || 0)) % l.length) + l.length) % l.length];
  }
  function cartaoDica(d) {
    // só depois das boas-vindas (ou explorando o exemplo), para não disputar atenção
    if (!d.config.onboardingFeito && !d.demo) return "";
    const x = dicaAtual(d);
    if (!x) return "";
    return `<section class="dica-dia" aria-label="Dica do dia"><span class="dd-lamp">💡</span>
      <p><small>Dica do dia</small>${x.t}</p>
      <div class="dica-botoes">${botao(x.b)}<button class="btn pequeno fantasma" data-acao="dica-outra" title="Ver outra dica">Outra</button><button class="btn pequeno fantasma" data-acao="dica-fechar" aria-label="Fechar a dica de hoje" title="Fechar por hoje">✕</button></div>
    </section>`;
  }
  App().registrarAcoes({
    "dica-outra": () => { const d = App().dados(); d.config.dicas.salto = (Number(d.config.dicas.salto) || 0) + 1; A.salvarDados(d, true, true); App().renderizar(); },
    "dica-fechar": () => { const d = App().dados(); d.config.dicas.ocultaEm = N.hoje(0); A.salvarDados(d, true, true); App().renderizar(); UI.toast("Volta amanhã com outra. Para desligar: Ajustes → Tela Hoje."); }
  });

  global.Ajuda = { TOPICOS, ASSUNTOS, GLOSSARIO, DICAS, topicos, lista, cartaoDica, dicaAtual };
})(window);
