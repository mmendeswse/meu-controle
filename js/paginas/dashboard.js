/**
 * paginas/dashboard.js — "Como estou hoje?"
 * Tudo calculado a partir dos registros; sem dados → "Sem dados suficientes".
 */
(function () {
  "use strict";

  const N = window.Nucleo, UI = window.UI, AL = window.Alimentacao, C = window.Compras, F = window.Fitness, M = window.Metas, I = window.Insights, G = window.Graficos;
  const esc = UI.esc;

  function semRegistros(d) {
    return !d.pesagens.length && !d.medidas.length && !d.refeicoes.length && !d.treinos.length && !d.compras.length && !d.alimentos.length && !d.metas.length && !d.fichas.length;
  }

  function boasVindas(d) {
    const u = d.usuarios[0];
    const passos = [
      { ok: u.nome && u.nome !== "Eu" && u.altura, acao: "editar-perfil", t: "Complete seu perfil", s: "Nome, altura e objetivo (usados no IMC e nas análises)." },
      { ok: d.pesagens.length > 0, acao: "rapido-peso", t: "Registre seu peso", s: "E, se tiver, massa muscular, gordura e medidas." },
      { ok: d.metas.length > 0, acao: "nova-meta", t: "Defina suas metas", s: "Peso, calorias, proteína, água, treinos por semana…" },
      { ok: d.alimentos.length > 0, acao: "novo-alimento", t: "Cadastre seus alimentos", s: "Com calorias, macros e preço — a base das refeições e das compras." },
      { ok: d.fichas.length > 0, acao: "nova-ficha", t: "Monte sua ficha de treino", s: "Exercícios, séries e repetições." }
    ];
    return `<section class="boas-vindas">
      <div class="bv-texto"><h1>Bem-vindo ao Meu Controle</h1>
        <p>Alimentação, compras, estoque, treinos e evolução corporal — tudo conectado e salvo só neste aparelho. Comece pelos passos abaixo ou explore com dados de exemplo.</p>
        <button class="btn" data-acao="carregar-demo">Explorar com dados de exemplo</button></div>
      <ol class="bv-passos">${passos.map((p) => `<li class="${p.ok ? "feito" : ""}"><button data-acao="${p.acao}"><span class="bv-check">${p.ok ? "✓" : ""}</span><span><b>${p.t}</b><small>${p.s}</small></span></button></li>`).join("")}</ol>
    </section>`;
  }

  // ------------------------------------------------------------------
  // Resumo de hoje (checklist)
  // ------------------------------------------------------------------
  function resumoHoje(d) {
    const hj = N.hoje(0);
    const refs = AL.refeicoesNoDia(d, hj);
    const linhas = [];
    [["Café da manhã", ["Café da manhã"]], ["Almoço", ["Almoço"]], ["Lanche", ["Lanche da tarde", "Lanche da manhã"]], ["Jantar", ["Jantar"]]].forEach((x) => {
      const r = refs.find((y) => x[1].indexOf(y.tipo) !== -1 && y.status === "Realizada") || refs.find((y) => x[1].indexOf(y.tipo) !== -1);
      if (r) {
        const n = AL.nutricaoRefeicao(d, r.id);
        const feito = r.status === "Realizada";
        linhas.push({ feito, pulado: r.status === "Pulada", texto: x[0], sub: (feito ? "" : r.horario ? "às " + r.horario + " · " : "") + (n.kcal ? Math.round(n.kcal) + " kcal" : AL.itensDe(d, r.id).length + " itens"),
          acao: `data-acao="ciclar-refeicao" data-id="${r.id}" title="${feito ? "Desmarcar" : "Marcar como realizada"}"` });
      } else linhas.push({ feito: false, texto: x[0], sub: "não registrado", dim: true, acao: `data-acao="nova-refeicao" data-data="${hj}" data-tipo="${x[1][0]}" data-status="Realizada" title="Registrar"` });
    });
    const metaAgua = AL.metaDiaria(d, "agua");
    const agua = AL.aguaDoDia(d, hj);
    linhas.push({ feito: metaAgua ? agua >= metaAgua : agua > 0, texto: agua ? UI.litros(agua) + " de água" : "Água", sub: metaAgua ? "meta " + UI.litros(metaAgua) : agua ? "" : "nada registrado",
      acao: `data-acao="agua" data-data="${hj}" title="Registrar água"`, extra: `<button class="btn pequeno" data-acao="agua-rapida" data-data="${hj}" title="Somar um copo">+${d.config.copoAgua || 250} ml</button>` });
    const th = F.treinoDeHoje(d);
    if (!th) linhas.push({ feito: false, dim: true, texto: "Treino", sub: "nenhum planejado para hoje", acao: `data-acao="rapido-treino"` });
    else if (th.origem === "descanso") linhas.push({ feito: true, descanso: true, texto: "Descanso", sub: "dia de descanso no plano" });
    else {
      const feito = th.status === "Realizado";
      linhas.push({ feito, texto: th.nome, sub: feito ? "realizado" : th.origem === "plano" ? "previsto no plano" + (th.horario ? " às " + th.horario : "") : "planejado",
        acao: th.origem === "treino" ? `data-acao="ir" data-secao="treino" data-id="${th.treino.id}"` : `data-acao="rapido-treino" title="Iniciar treino"` });
    }
    const p = F.pesagemDoDia(d, hj);
    linhas.push(p ? { feito: true, texto: UI.kg(p.peso), sub: "pesagem de hoje", acao: `data-acao="registrar-corpo" data-data="${hj}"` } : { feito: false, dim: true, texto: "Peso", sub: "sem pesagem hoje (opcional)", acao: `data-acao="rapido-peso"` });
    const feitos = linhas.filter((l) => l.feito).length;
    const corpo = `<ul class="checklist">${linhas.map((l) => `<li class="${l.feito ? "feito" : ""}${l.dim ? " dim-item" : ""}${l.pulado ? " pulado" : ""}">
        <button class="check-btn" ${l.acao || "disabled"}><span class="check-ic">${l.feito ? "✓" : l.pulado ? "–" : ""}</span><span class="check-txt"><b>${esc(l.texto)}</b>${l.sub ? `<small>${esc(l.sub)}</small>` : ""}</span></button>
        ${l.extra || ""}</li>`).join("")}</ul>`;
    return UI.card({ titulo: "Resumo de hoje", sub: `${feitos} de ${linhas.length} concluídos`, acoes: `<button class="btn pequeno" data-acao="ir" data-secao="alimentacao">diário →</button>`, corpo, classe: "card-checklist" });
  }

  // ------------------------------------------------------------------
  // Seu progresso: primeiro → atual (→ meta)
  // ------------------------------------------------------------------
  function progresso(d) {
    const linhas = [["peso", "Peso", "kg", "peso"], ["massaMuscular", "Massa muscular", "kg", "massaMuscular"], ["gorduraPct", "Gordura", "%", "gordura"]].map((x) => {
      const s = F.serie(d, x[0]);
      const meta = M.metaDoTipo(d, x[3]);
      const av = meta ? M.avaliar(d, meta) : null;
      if (!s.length) return `<div class="prog-linha-dash"><span class="pl-rot">${x[1]}</span><span class="pl-val">${UI.SEM_DADOS}</span></div>`;
      const ini = s[0], atu = s[s.length - 1];
      const delta = atu.valor - ini.valor;
      const dir = meta ? Math.sign(Number(meta.valorAlvo) - (av.inicial != null ? av.inicial : ini.valor)) : (x[0] === "massaMuscular" ? 1 : x[0] === "gorduraPct" ? -1 : 0);
      const bom = !dir || Math.abs(delta) < 0.05 ? null : delta * dir > 0;
      return `<div class="prog-linha-dash">
        <span class="pl-rot">${x[1]}</span>
        <span class="pl-val">${s.length > 1 ? `<span class="dim">${UI.num(ini.valor, 1)} ${x[2]}</span> → ` : ""}<b>${UI.num(atu.valor, 1)} ${x[2]}</b>
          ${s.length > 1 ? UI.deltaPill(UI.sinal(delta, 1, x[2]), bom) : ""}</span>
        ${meta ? `<span class="pl-meta">Meta: <b>${M.fmt(meta.tipo, meta.valorAlvo)}</b> ${UI.statusMeta(av.status)}</span>${UI.barra(av.progresso, av.status === "fora" ? "var(--down)" : av.status === "atencao" ? "var(--acc)" : "var(--up)", true)}` : ""}
      </div>`;
    }).join("");
    const temAlgo = d.pesagens.length || d.medidas.length;
    return UI.card({ titulo: "Seu progresso", sub: "primeiro registro → atual", acoes: `<button class="btn pequeno" data-acao="ir" data-secao="evolucao">evolução →</button>`,
      corpo: temAlgo ? `<div class="prog-dash">${linhas}</div>` : UI.vazio({ icone: "⚖️", titulo: "Você ainda não registrou peso nem medidas.", acao: "rapido-peso", rotulo: "Registrar peso" }) });
  }

  function insights(d) {
    const lista = I.gerarInsights(d).slice(0, 4);
    return UI.card({ titulo: "Insights", sub: "observações a partir dos seus dados", acoes: `<button class="btn pequeno" data-acao="ir" data-secao="relatorios" data-param="insights">ver todos →</button>`,
      corpo: lista.length ? `<ul class="insights">${lista.map((x) => `<li class="ins-${x.tipo}"><button data-acao="ir" data-secao="${x.rota}"><span class="ins-ic">${x.icone}</span><span>${esc(x.texto)}</span></button></li>`).join("")}</ul>`
        : UI.vazio({ icone: "💡", titulo: "Sem dados suficientes", texto: "Os insights aparecem quando houver alguns dias de registros (peso, refeições, treinos, compras)." }) });
  }

  // ------------------------------------------------------------------
  // painéis agrupados: Saúde, Alimentação, Academia, Compras
  // ------------------------------------------------------------------
  function painel(titulo, icone, rota, minis) {
    return `<section class="painel-grupo"><header><span class="pg-ic">${icone}</span><h2>${titulo}</h2><button class="btn pequeno" data-acao="ir" data-secao="${rota}">abrir →</button></header><div class="pg-grade">${minis.join("")}</div></section>`;
  }
  function paineis(d) {
    const hj = N.hoje(0);
    // saúde
    const pAtual = F.atual(d, "peso"), v30 = F.variacao(d, "peso", 30), pIni = F.pesoInicial(d);
    const mm = F.atual(d, "massaMuscular"), vmm = F.variacao(d, "massaMuscular", 60);
    const gc = F.atual(d, "gorduraPct"), vgc = F.variacao(d, "gorduraPct", 60);
    const saude = [
      UI.mini({ rotulo: "Peso atual", valor: pAtual ? UI.kg(pAtual.valor) : UI.SEM_DADOS, sub: pAtual ? (v30 ? UI.sinal(v30.delta, 1, "kg") + " em " + v30.dias + " dias" : "em " + UI.dataCurta(pAtual.data)) : "", rota: "evolucao" }),
      UI.mini({ rotulo: "Variação de peso", dica: "Diferença entre o peso atual e o peso inicial (do perfil ou da primeira pesagem).", valor: pAtual && pIni != null && F.pesagens(d).length > 1 ? UI.sinal(pAtual.valor - pIni, 1, "kg") : UI.SEM_DADOS, sub: pIni != null ? "desde " + UI.kg(pIni) : "", rota: "evolucao" }),
      UI.mini({ rotulo: "Massa muscular", dica: F.METRICA.massaMuscular.dica, valor: mm ? UI.kg(mm.valor) : UI.SEM_DADOS, sub: vmm ? UI.sinal(vmm.delta, 1, "kg") + " desde " + UI.dataCurta(vmm.de.data) : "", rota: "evolucao" }),
      UI.mini({ rotulo: "Gordura corporal", dica: F.METRICA.gorduraPct.dica, valor: gc ? UI.num(gc.valor, 1) + "%" : UI.SEM_DADOS, sub: vgc ? UI.sinal(vgc.delta, 1, "p.p.") + " desde " + UI.dataCurta(vgc.de.data) : "", rota: "evolucao" })
    ];
    // alimentação
    const c = AL.consumoDoDia(d, hj), mt = AL.metasDiarias(d), rh = AL.resumoHoje(d);
    const miniMacro = (rot, atual, meta, un, fmt) => UI.mini({ rotulo: rot, valor: `${fmt(atual)}${meta ? ` <small>/ ${fmt(meta)}</small>` : ""} <small>${un}</small>`, barra: meta ? (atual / meta) * 100 : null, corBarra: meta && atual >= meta ? "var(--up)" : "var(--cy)", sub: meta ? "" : "sem meta definida", rota: "alimentacao" });
    const ali = [
      miniMacro("Calorias", c.kcal, mt.kcal, "kcal", (v) => UI.numAuto(v, 0)),
      miniMacro("Proteína", c.proteina, mt.proteina, "g", (v) => UI.numAuto(v, 0)),
      miniMacro("Água", c.agua / 1000, mt.agua ? mt.agua / 1000 : null, "L", (v) => UI.num(v, 1)),
      UI.mini({ rotulo: "Refeições", valor: rh.total ? `${rh.realizadas} <small>/ ${rh.total}</small>` : "0", sub: rh.total ? "realizadas / no dia" : "nenhuma registrada hoje", barra: rh.total ? (rh.realizadas / rh.total) * 100 : null, rota: "alimentacao" })
    ];
    // academia
    const th = F.treinoDeHoje(d), sem = F.semanaAtual(d), mes = F.estatisticas(d, N.inicioMes(), hj), seq = F.sequencias(d);
    const aca = [
      UI.mini({ rotulo: "Treino de hoje", valor: th ? esc(th.nome) : "—", sub: th ? (th.status === "Realizado" ? "✓ realizado" : th.status === "Descanso" ? "dia de descanso" : th.status.toLowerCase()) : "nada planejado", cor: th && th.status === "Realizado" ? "var(--up)" : null, rota: th && th.origem === "treino" ? null : "academia" }),
      UI.mini({ rotulo: "Treinos da semana", dica: "Realizados / planejados nesta semana (segunda a domingo), contando o plano semanal.", valor: sem.planejados ? `${sem.realizados} <small>/ ${sem.planejados}</small>` : "0", barra: sem.planejados ? (sem.realizados / sem.planejados) * 100 : null, corBarra: "var(--up)", rota: "academia" }),
      UI.mini({ rotulo: "Frequência no mês", dica: "Treinos realizados ÷ (realizados + perdidos). Perdido = planejado que passou sem ser feito, ou cancelado.", valor: mes.taxa == null ? UI.SEM_DADOS : UI.pct(mes.taxa), sub: mes.taxa == null ? "" : `${mes.realizados} de ${mes.realizados + mes.perdidos}`, rota: "academia" }),
      UI.mini({ rotulo: "Sequência", dica: seq.modo === "plano" ? "Dias seguidos cumprindo o plano: treinou quando era dia de treino e descansou quando era descanso." : "Dias seguidos com treino realizado.", valor: seq.atual ? "🔥 " + seq.atual + " <small>" + UI.plural(seq.atual, "dia", "dias") + "</small>" : "0", sub: "melhor: " + seq.melhor, rota: "academia" })
    ];
    // compras
    const rc = C.resumo(d);
    const com = [
      UI.mini({ rotulo: "Gastos no mês", dica: "Soma do preço pago dos itens marcados como Comprado neste mês.", valor: UI.brl(rc.gastoMes), sub: rc.economiaMes ? (rc.economiaMes > 0 ? "economia de " : "acima do estimado: ") + UI.brl(Math.abs(rc.economiaMes)) : "", rota: "compras" }),
      UI.mini({ rotulo: "Previsto para compras", dica: "Total estimado dos itens pendentes na lista.", valor: UI.brl(rc.totalEstimado), rota: "compras" }),
      UI.mini({ rotulo: "Itens pendentes", valor: String(rc.pendentes), sub: rc.altaPrioridade ? `<span class="down">${rc.altaPrioridade} de alta prioridade</span>` : "", rota: "compras" }),
      UI.mini({ rotulo: "Estoque baixo", valor: String(rc.estoqueBaixo), cor: rc.estoqueBaixo ? "var(--down)" : null, sub: rc.estoqueBaixo ? "abaixo do mínimo" : d.estoque.length ? "tudo em ordem" : "estoque não controlado", rota: "estoque" })
    ];
    return `<div class="paineis">${painel("Saúde", "❤️", "evolucao", saude)}${painel("Alimentação", "🍽️", "alimentacao", ali)}${painel("Academia", "🏋️", "academia", aca)}${painel("Compras", "🛒", "compras", com)}</div>`;
  }

  function metas(d) {
    const av = M.avaliarTodas(d);
    const corpo = av.length ? `<div class="metas-mini">${av.slice(0, 6).map((a) => `<button class="meta-mini" data-acao="ir" data-secao="metas">
        <span class="mm-topo"><span>${a.tipo.icone} ${esc(a.meta.titulo || a.tipo.rotulo)}</span>${UI.statusMeta(a.status)}</span>
        ${UI.barra(a.progresso || 0, a.status === "fora" ? "var(--down)" : a.status === "atencao" ? "var(--acc)" : a.status === "semdados" ? "var(--dim)" : "var(--up)")}
        <span class="mm-rodape"><span>${a.atual == null ? "sem dados" : "Atual: " + M.fmt(a.meta.tipo, a.atual)}</span><span>Objetivo: ${M.fmt(a.meta.tipo, a.alvo)}${a.progresso != null ? " · <b>" + Math.round(a.progresso) + "%</b>" : ""}</span></span>
      </button>`).join("")}</div>`
      : UI.vazio({ icone: "🎯", titulo: "Você ainda não definiu metas.", texto: "Metas de peso, calorias, proteína, água e treinos dão sentido aos números.", acao: "nova-meta", rotulo: "Criar meta" });
    return UI.card({ titulo: "Metas", sub: av.length ? av.filter((a) => a.status === "ok" || a.status === "atingida").length + " de " + av.length + " no caminho certo" : "", acoes: `<button class="btn pequeno" data-acao="ir" data-secao="metas">todas →</button>`, corpo });
  }

  function graficoPeso(d) {
    const s = F.serie(d, "peso", N.hoje(-90));
    return UI.card({ titulo: "Peso — últimos 90 dias", sub: s.length ? s.length + " pesagens" : "", acoes: `<button class="btn pequeno" data-acao="rapido-peso">+ pesagem</button>`,
      corpo: s.length >= 2 ? `<div class="grafico" style="height:240px"><canvas id="graf-dash-peso" aria-label="Gráfico do peso nos últimos 90 dias"></canvas></div>`
        : UI.vazio({ icone: "📈", titulo: "Sem dados suficientes", texto: "O gráfico aparece a partir de 2 pesagens.", acao: "rapido-peso", rotulo: "Registrar peso" }) });
  }

  function frase(d) {
    const hj = N.hoje(0);
    const p = [];
    const c = AL.consumoDoDia(d, hj), mk = AL.metaDiaria(d, "kcal");
    if (c.kcal) p.push(`${UI.numAuto(c.kcal, 0)}${mk ? " de " + UI.numAuto(mk, 0) : ""} kcal`);
    const th = F.treinoDeHoje(d);
    if (th && th.origem !== "descanso") p.push(th.status === "Realizado" ? "treino feito ✓" : "treino de hoje pendente");
    const a = AL.aguaDoDia(d, hj);
    if (a) p.push(UI.litros(a) + " de água");
    const alertas = I.gerarAlertas(d).filter((x) => x.nivel === "perigo").length;
    if (alertas) p.push(`<span class="down">${alertas} ${UI.plural(alertas, "alerta importante", "alertas importantes")}</span>`);
    return p.join(" · ");
  }

  window.App.registrarPagina("dashboard", {
    titulo: "Dashboard",
    render(d) {
      const u = d.usuarios[0];
      const h = new Date().getHours();
      const saud = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
      return `${semRegistros(d) && !d.demo ? boasVindas(d) : ""}
        <div class="cabecalho-pagina">
          <div><h1>${saud}${u.nome && u.nome !== "Eu" ? ", " + esc(u.nome.split(" ")[0]) : ""}! Como estou hoje?</h1>
          <p class="sub">${UI.dataLonga(N.hoje(0))}${frase(d) ? " · " + frase(d) : ""}</p></div>
        </div>
        <div class="grid">
          <div class="c4">${resumoHoje(d)}</div>
          <div class="c4">${progresso(d)}</div>
          <div class="c4">${insights(d)}</div>
        </div>
        ${paineis(d)}
        <div class="grid">
          <div class="c8">${graficoPeso(d)}</div>
          <div class="c4">${metas(d)}</div>
        </div>`;
    },
    depois(d) {
      if (document.getElementById("graf-dash-peso")) {
        const m = M.metaDoTipo(d, "peso");
        G.renderMetrica("graf-dash-peso", F.serie(d, "peso", N.hoje(-90)), { un: "kg", rotulo: "Peso", meta: m ? Number(m.valorAlvo) : null });
      }
    }
  });
})();
