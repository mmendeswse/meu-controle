/**
 * paginas/dashboard.js — "Hoje": o roteiro do dia em ordem de horário,
 * a semana em números, o progresso do corpo e os insights.
 * Tudo calculado a partir dos registros; sem dados → "Sem dados suficientes".
 */
(function () {
  "use strict";

  const N = window.Nucleo, UI = window.UI, AL = window.Alimentacao, C = window.Compras, F = window.Fitness, M = window.Metas, I = window.Insights, G = window.Graficos;
  const esc = UI.esc;

  function semRegistros(d) {
    return !d.pesagens.length && !d.medidas.length && !d.refeicoes.length && !d.treinos.length && !d.compras.length && !d.alimentos.length && !d.metas.length && !d.fichas.length;
  }

  // primeiros passos, na ordem em que o sistema é montado
  function boasVindas(d) {
    const u = d.usuarios[0];
    const passos = [
      { ok: u.nome && u.nome !== "Eu" && u.altura, acao: "editar-perfil", t: "Perfil", s: "Nome, altura e objetivo (usados no IMC)." },
      { ok: d.pesagens.length > 0, acao: "rapido-peso", t: "Peso de hoje", s: "O ponto de partida. Medidas são opcionais." },
      { ok: d.metas.length > 0, acao: "nova-meta", t: "Metas", s: "Peso, calorias, proteína, água, treinos por semana…" },
      { ok: d.alimentos.length > 0, acao: "novo-alimento", t: "Alimentos", s: "Com calorias, macros e preço — base das refeições e compras." },
      { ok: d.fichas.length > 0, acao: "nova-ficha", t: "Ficha de treino", s: "Exercícios, séries e repetições. Depois, o plano da semana." }
    ];
    return `<section class="boas-vindas">
      <div class="bv-texto"><h1>Bem-vindo ao Meu Controle</h1>
        <p>Siga os passos na ordem — depois, é só usar a tela <b>Hoje</b> e o botão <b>+</b> no dia a dia. Tudo fica salvo só neste aparelho.</p>
        <button class="btn" data-acao="carregar-demo">Explorar com dados de exemplo</button></div>
      <ol class="bv-passos">${passos.map((p, i) => `<li class="${p.ok ? "feito" : ""}"><button data-acao="${p.acao}"><span class="bv-check">${p.ok ? "✓" : i + 1}</span><span><b>${p.t}</b><small>${p.s}</small></span></button></li>`).join("")}</ol>
    </section>`;
  }

  // ------------------------------------------------------------------
  // Roteiro de hoje: peso → refeições → treino → água, por horário
  // ------------------------------------------------------------------
  const PRINCIPAIS = ["Café da manhã", "Almoço", "Lanche da tarde", "Jantar"];
  function roteiro(d) {
    const hj = N.hoje(0);
    const itens = [];
    const p = F.pesagemDoDia(d, hj);
    itens.push(p ? { hora: "06:00", feito: true, texto: "Peso: " + UI.kg(p.peso), sub: "registrado", acao: `data-acao="registrar-corpo" data-data="${hj}"` }
      : { hora: "06:00", texto: "Peso", sub: "em jejum, ao acordar (opcional)", acao: `data-acao="rapido-peso"`, opcional: true });

    const refs = AL.refeicoesNoDia(d, hj);
    refs.forEach((r) => {
      const n = AL.nutricaoRefeicao(d, r.id), feito = r.status === "Realizada";
      itens.push({ hora: r.horario || N.HORARIO_SUGERIDO[r.tipo] || "12:00", feito, pulado: r.status === "Pulada", texto: (N.EMOJI_REFEICAO[r.tipo] || "") + " " + r.tipo,
        sub: (n.kcal ? Math.round(n.kcal) + " kcal" : AL.itensDe(d, r.id).length + " itens") + (feito ? "" : r.status === "Pulada" ? " · pulada" : " · planejada"),
        acao: `data-acao="ciclar-refeicao" data-id="${r.id}" title="${feito ? "Desmarcar" : "Marcar como realizada"}"` });
    });
    PRINCIPAIS.filter((t) => !refs.some((r) => r.tipo === t)).forEach((t) => {
      itens.push({ hora: N.HORARIO_SUGERIDO[t], texto: N.EMOJI_REFEICAO[t] + " " + t, sub: "registrar", vazio: true, acao: `data-acao="nova-refeicao" data-data="${hj}" data-tipo="${t}" data-status="Realizada"` });
    });

    const th = F.treinoDeHoje(d);
    if (th && th.origem === "descanso") itens.push({ hora: "18:00", feito: true, texto: "😴 Descanso", sub: "dia de descanso no plano" });
    else if (th) {
      const feito = th.status === "Realizado";
      itens.push({ hora: th.horario || (th.treino && th.treino.horario) || "18:00", feito, texto: "🏋️ " + th.nome, sub: feito ? "realizado" : th.origem === "plano" ? "previsto no plano — toque para iniciar" : "planejado",
        acao: th.origem === "treino" ? `data-acao="ir" data-secao="treino" data-id="${th.treino.id}"` : `data-acao="rapido-treino"` });
    } else itens.push({ hora: "18:00", texto: "🏋️ Treino", sub: "nada planejado", vazio: true, opcional: true, acao: `data-acao="rapido-treino"` });

    itens.sort((a, b) => a.hora.localeCompare(b.hora));

    const metaAgua = AL.metaDiaria(d, "agua"), agua = AL.aguaDoDia(d, hj);
    itens.push({ hora: "", feito: metaAgua ? agua >= metaAgua : false, texto: "💧 Água: " + (agua ? UI.litros(agua) : "0 L"), sub: metaAgua ? "meta " + UI.litros(metaAgua) + " · ao longo do dia" : "ao longo do dia",
      acao: `data-acao="agua" data-data="${hj}"`, extra: `<button class="btn pequeno" data-acao="agua-rapida" data-data="${hj}" title="Somar um copo">+${d.config.copoAgua || 250} ml</button>` });

    const obrig = itens.filter((l) => !l.opcional || l.feito);
    const feitos = obrig.filter((l) => l.feito).length;
    const proximo = itens.find((l) => !l.feito && !l.pulado && !l.opcional && l.hora);
    const corpo = `<ul class="checklist">${itens.map((l) => `<li class="${l.feito ? "feito" : ""}${l.vazio || l.opcional ? " dim-item" : ""}${l.pulado ? " pulado" : ""}${l === proximo ? " proximo" : ""}">
        <button class="check-btn" ${l.acao || "disabled"}><span class="check-ic">${l.feito ? "✓" : l.pulado ? "–" : ""}</span><span class="check-txt"><b>${l.hora ? `<span class="check-hora">${l.hora}</span>` : ""}${esc(l.texto)}</b><small>${esc(l.sub || "")}${l === proximo ? " · próximo" : ""}</small></span></button>
        ${l.extra || ""}</li>`).join("")}</ul>`;
    return UI.card({ titulo: "Roteiro de hoje", sub: `${feitos} de ${obrig.length} concluídos · toque para marcar`, acoes: `<button class="btn pequeno" data-acao="ir" data-secao="alimentacao">diário →</button>`, corpo, classe: "card-checklist" });
  }

  // ------------------------------------------------------------------
  // A semana em números (um número por área, com link)
  // ------------------------------------------------------------------
  function semana(d) {
    const hj = N.hoje(0);
    const c = AL.consumoDoDia(d, hj), mt = AL.metasDiarias(d);
    const sem = F.semanaAtual(d), seq = F.sequencias(d), rc = C.resumo(d);
    const macro = (rot, atual, meta, un) => UI.mini({ rotulo: rot + " hoje", valor: `${UI.numAuto(atual, 0)}${meta ? ` <small>/ ${UI.numAuto(meta, 0)}</small>` : ""} <small>${un}</small>`, barra: meta ? (atual / meta) * 100 : null, corBarra: meta && atual >= meta ? "var(--up)" : "var(--cy)", sub: meta ? "" : "sem meta", rota: "alimentacao" });
    const minis = [
      macro("Calorias", c.kcal, mt.kcal, "kcal"),
      macro("Proteína", c.proteina, mt.proteina, "g"),
      UI.mini({ rotulo: "Água hoje", valor: `${UI.num(c.agua / 1000, 1)}${mt.agua ? ` <small>/ ${UI.num(mt.agua / 1000, 1)}</small>` : ""} <small>L</small>`, barra: mt.agua ? (c.agua / mt.agua) * 100 : null, corBarra: mt.agua && c.agua >= mt.agua ? "var(--up)" : "var(--azul)", sub: mt.agua ? "" : "sem meta", rota: "alimentacao" }),
      UI.mini({ rotulo: "Treinos na semana", dica: "Realizados / planejados (segunda a domingo), contando o plano semanal.", valor: `${sem.realizados} <small>/ ${sem.planejados}</small>`, barra: sem.planejados ? (sem.realizados / sem.planejados) * 100 : null, corBarra: "var(--up)", sub: seq.atual ? `🔥 ${seq.atual} ${UI.plural(seq.atual, "dia", "dias")} seguidos` : "", rota: "academia" }),
      UI.mini({ rotulo: "Gasto no mês", dica: "Soma do preço pago dos itens comprados neste mês.", valor: UI.brl(rc.gastoMes), sub: rc.pendentes ? `${rc.pendentes} na lista · ${UI.brl(rc.totalEstimado)}` : "lista em dia", rota: "compras" }),
      UI.mini({ rotulo: "Estoque baixo", valor: String(rc.estoqueBaixo), cor: rc.estoqueBaixo ? "var(--down)" : null, sub: rc.estoqueBaixo ? "abaixo do mínimo" : d.estoque.length ? "tudo em ordem" : "não controlado", rota: "estoque" })
    ];
    return UI.card({ titulo: "Em números", sub: "hoje, esta semana e este mês", corpo: `<div class="pg-grade numeros">${minis.join("")}</div>` });
  }

  // ------------------------------------------------------------------
  // Progresso: primeiro → atual → meta, com o gráfico do peso
  // ------------------------------------------------------------------
  function progresso(d) {
    const linhas = [["peso", "Peso", "kg", "peso"], ["massaMuscular", "Massa muscular", "kg", "massaMuscular"], ["gorduraPct", "Gordura", "%", "gordura"]].map((x) => {
      const s = F.serie(d, x[0]);
      if (!s.length) return "";
      const meta = M.metaDoTipo(d, x[3]), av = meta ? M.avaliar(d, meta) : null;
      const ini = s[0], atu = s[s.length - 1], delta = atu.valor - ini.valor;
      const dir = meta ? Math.sign(Number(meta.valorAlvo) - (av.inicial != null ? av.inicial : ini.valor)) : (x[0] === "massaMuscular" ? 1 : x[0] === "gorduraPct" ? -1 : 0);
      const bom = !dir || Math.abs(delta) < 0.05 ? null : delta * dir > 0;
      return `<div class="prog-linha-dash">
        <span class="pl-rot">${x[1]}</span>
        <span class="pl-val">${s.length > 1 ? `<span class="dim">${UI.num(ini.valor, 1)}</span> → ` : ""}<b>${UI.num(atu.valor, 1)} ${x[2]}</b>${s.length > 1 ? " " + UI.deltaPill(UI.sinal(delta, 1, x[2]), bom) : ""}</span>
        ${meta ? `<span class="pl-meta">Meta <b>${M.fmt(meta.tipo, meta.valorAlvo)}</b> ${UI.statusMeta(av.status)}</span>` : ""}
      </div>`;
    }).join("");
    const s90 = F.serie(d, "peso", N.hoje(-90));
    const av = M.avaliarTodas(d), ok = av.filter((a) => a.status === "ok" || a.status === "atingida").length;
    const corpo = !d.pesagens.length && !d.medidas.length ? UI.vazio({ icone: "⚖️", titulo: "Você ainda não registrou peso nem medidas.", acao: "rapido-peso", rotulo: "Registrar peso" })
      : `<div class="prog-dash">${linhas}</div>` + (s90.length >= 2 ? `<div class="grafico" style="height:200px"><canvas id="graf-dash-peso" aria-label="Peso nos últimos 90 dias"></canvas></div>` : `<p class="ajuda pad-x">O gráfico do peso aparece a partir de 2 pesagens.</p>`);
    return UI.card({ titulo: "Progresso", sub: "primeiro registro → atual · peso dos últimos 90 dias", corpo,
      acoes: `<button class="btn pequeno" data-acao="ir" data-secao="evolucao">corpo →</button>`,
      rodape: av.length ? `<span>${ok} de ${av.length} ${UI.plural(av.length, "meta", "metas")} no caminho certo</span><button class="link-acao" data-acao="ir" data-secao="metas">ver metas →</button>` : `<span>Nenhuma meta definida</span><button class="link-acao" data-acao="nova-meta">+ criar meta</button>` });
  }

  function insights(d) {
    const lista = I.gerarInsights(d).slice(0, 4);
    return UI.card({ titulo: "Insights", sub: "a partir dos seus registros", acoes: `<button class="btn pequeno" data-acao="ir" data-secao="relatorios" data-param="insights">todos →</button>`,
      corpo: lista.length ? `<ul class="insights">${lista.map((x) => `<li class="ins-${x.tipo}"><button data-acao="ir" data-secao="${x.rota}"><span class="ins-ic">${x.icone}</span><span>${esc(x.texto)}</span></button></li>`).join("")}</ul>`
        : UI.vazio({ icone: "💡", titulo: "Sem dados suficientes", texto: "Os insights aparecem depois de alguns dias de registros." }) });
  }

  function frase(d) {
    const hj = N.hoje(0), p = [];
    const c = AL.consumoDoDia(d, hj), mk = AL.metaDiaria(d, "kcal");
    if (c.kcal) p.push(`${UI.numAuto(c.kcal, 0)}${mk ? " de " + UI.numAuto(mk, 0) : ""} kcal`);
    const th = F.treinoDeHoje(d);
    if (th && th.origem !== "descanso") p.push(th.status === "Realizado" ? "treino feito ✓" : "treino pendente");
    const alertas = I.gerarAlertas(d).filter((x) => x.nivel === "perigo").length;
    if (alertas) p.push(`<span class="down">${alertas} ${UI.plural(alertas, "alerta importante", "alertas importantes")}</span>`);
    return p.join(" · ");
  }

  window.App.registrarPagina("dashboard", {
    titulo: "Hoje",
    render(d) {
      const u = d.usuarios[0];
      const h = new Date().getHours();
      const saud = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
      const f = frase(d);
      return `${semRegistros(d) && !d.demo ? boasVindas(d) : ""}
        <div class="cabecalho-pagina">
          <div><h1>${saud}${u.nome && u.nome !== "Eu" ? ", " + esc(u.nome.split(" ")[0]) : ""}!</h1>
          <p class="sub">${UI.dataLonga(N.hoje(0))}${f ? " · " + f : ""}</p></div>
        </div>
        <div class="grid">
          <div class="c5">${roteiro(d)}</div>
          <div class="c7">${semana(d)}<div class="espaco"></div>${insights(d)}</div>
        </div>
        <div class="grid"><div class="c12">${progresso(d)}</div></div>`;
    },
    depois(d) {
      if (document.getElementById("graf-dash-peso")) {
        const m = M.metaDoTipo(d, "peso");
        G.renderMetrica("graf-dash-peso", F.serie(d, "peso", N.hoje(-90)), { un: "kg", rotulo: "Peso", meta: m ? Number(m.valorAlvo) : null });
      }
    }
  });
})();
