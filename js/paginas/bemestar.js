/**
 * paginas/bemestar.js — "Bem-estar", em quatro abas:
 *   Resumo    — check-in de hoje, sono, humor/energia, passos, calendário
 *               do humor e o que influencia o seu bem-estar
 *   Hábitos   — hábitos próprios e desafios, com sequência e histórico
 *   Remédios  — doses de hoje, estoque, adesão e histórico da semana
 *   Jejum     — jejum em andamento (ao vivo), estatísticas e histórico
 */
(function () {
  "use strict";

  const N = window.Nucleo, UI = window.UI, BE = window.BemEstar, G = window.Graficos, App = window.App;
  const esc = UI.esc;
  const ABAS = [{ k: "resumo", r: "Resumo" }, { k: "habitos", r: "Hábitos" }, { k: "remedios", r: "Remédios" }, { k: "jejum", r: "Jejum" }];
  const COR_NIVEL = { 1: "#FF453A", 2: "#FF9F0A", 3: "#FFD60A", 4: "#86D93A", 5: "#30D158" };
  const COR_ESTRESSE = { 1: "#30D158", 2: "#86D93A", 3: "#FFD60A", 4: "#FF9F0A", 5: "#FF453A" };
  const nf = (v, c) => UI.numAuto(v, c == null ? 1 : c);

  // ==================================================================
  // RESUMO
  // ==================================================================
  function kpis(d) {
    const ini = N.hoje(-6), hj = N.hoje(0);
    const sono = BE.media(d, "sono", ini, hj), humor = BE.media(d, "humor", ini, hj), energia = BE.media(d, "energia", ini, hj), passos = BE.media(d, "passos", ini, hj);
    const mSono = BE.metaDe(d, "sono"), mPassos = BE.metaDe(d, "passos");
    return `<div class="kpi-row">
      ${UI.kpi({ rotulo: "😴 Sono médio", valor: sono.media == null ? UI.SEM_DADOS : `${BE.fmtHoras(sono.media)}`, gauge: mSono && sono.media != null ? (sono.media / mSono) * 100 : null, cor: "var(--c-bem)", sub: sono.media == null ? "registre no check-in" : mSono ? `meta ${BE.fmtHoras(mSono)} · 7 dias` : "últimos 7 dias", dica: "Média das noites registradas nos últimos 7 dias." })}
      ${UI.kpi({ rotulo: "Humor", valor: humor.media == null ? UI.SEM_DADOS : `${BE.emoji("humor", humor.media)} ${nf(humor.media)}<small>/5</small>`, sub: humor.media == null ? "" : `${humor.dias} ${UI.plural(humor.dias, "dia", "dias")} · ${BE.nivel("humor", humor.media).r.toLowerCase()}` })}
      ${UI.kpi({ rotulo: "Energia", valor: energia.media == null ? UI.SEM_DADOS : `${BE.emoji("energia", energia.media)} ${nf(energia.media)}<small>/5</small>`, sub: energia.media == null ? "" : BE.nivel("energia", energia.media).r.toLowerCase() })}
      ${UI.kpi({ rotulo: "👟 Passos por dia", valor: passos.media == null ? UI.SEM_DADOS : nf(passos.media, 0), gauge: mPassos && passos.media != null ? (passos.media / mPassos) * 100 : null, cor: "var(--c-treino)", sub: passos.media == null ? "" : mPassos ? `meta ${nf(mPassos, 0)}` : "média de 7 dias" })}
    </div>`;
  }

  function cartaoHoje(d) {
    const hj = N.hoje(0), r = BE.checkin(d, hj);
    const h = BE.horasSono(r);
    const linha = (rot, esc_, v, extra) => v == null ? "" : `<div class="ck-linha"><span>${rot}</span><b>${BE.emoji(esc_, v)} ${BE.nivel(esc_, v).r}</b>${extra || ""}</div>`;
    let corpo;
    if (!r) {
      corpo = `<div class="ck-vazio"><p>Leva 10 segundos e mostra, com o tempo, o que melhora o seu dia.</p>
        <div class="botoes-linha"><button class="btn primario" data-acao="checkin" data-data="${hj}" data-foco="sono">😴 Registrar sono</button><button class="btn" data-acao="checkin" data-data="${hj}" data-foco="humor">🙂 Como estou</button><button class="btn" data-acao="checkin" data-data="${hj}" data-foco="passos">👟 Passos</button></div></div>`;
    } else {
      corpo = `<div class="ck-resumo">
        ${h != null ? `<div class="ck-linha"><span>Sono</span><b>${BE.fmtHoras(h)}${r.dormiu && r.acordou ? ` <small class="dim">${r.dormiu} → ${r.acordou}</small>` : ""}</b>${r.sonoQualidade ? `<small>${BE.emoji("sonoQualidade", r.sonoQualidade)} ${BE.nivel("sonoQualidade", r.sonoQualidade).r.toLowerCase()}</small>` : ""}</div>` : ""}
        ${linha("Humor", "humor", r.humor)}${linha("Energia", "energia", r.energia)}${linha("Estresse", "estresse", r.estresse)}
        ${N.temValor(r.passos) || N.temValor(r.minutosAtivos) ? `<div class="ck-linha"><span>Atividade</span><b>${N.temValor(r.passos) ? nf(r.passos, 0) + " passos" : ""}${N.temValor(r.passos) && N.temValor(r.minutosAtivos) ? " · " : ""}${N.temValor(r.minutosAtivos) ? nf(r.minutosAtivos, 0) + " min ativos" : ""}</b></div>` : ""}
        ${(r.sintomas || []).length ? `<div class="ck-linha"><span>Sintomas</span><b>${r.sintomas.map((s) => `<span class="tag">${esc(s)}</span>`).join(" ")}</b></div>` : ""}
        ${r.obs ? `<p class="ck-obs">“${esc(r.obs)}”</p>` : ""}
        ${h == null || r.humor == null || !N.temValor(r.passos) ? `<div class="botoes-linha">${h == null ? `<button class="btn pequeno" data-acao="checkin" data-data="${hj}" data-foco="sono">+ sono</button>` : ""}${r.humor == null ? `<button class="btn pequeno" data-acao="checkin" data-data="${hj}" data-foco="humor">+ humor</button>` : ""}${!N.temValor(r.passos) ? `<button class="btn pequeno" data-acao="checkin" data-data="${hj}" data-foco="passos">+ passos</button>` : ""}</div>` : ""}
      </div>`;
    }
    return UI.card({ titulo: "Check-in de hoje", sub: UI.dataLonga(hj), acoes: r ? UI.botao("checkin", "Editar", { icone: "editar", dados: `data-data="${hj}"` }) : "", corpo: `<div class="pad">${corpo}</div>` });
  }

  function cartaoSono(d) {
    const s = BE.serie(d, "sono", N.hoje(-29), N.hoje(0));
    const deb = BE.debitoSono(d, 7);
    const mSono = BE.metaDe(d, "sono");
    const corpo = s.length < 2 ? UI.vazio({ icone: "😴", titulo: "Sem dados suficientes", texto: "O gráfico aparece a partir de 2 noites registradas.", acao: "checkin", rotulo: "Registrar sono", dados: `data-foco="sono"` })
      : `<div class="grafico" style="height:210px"><canvas id="graf-be-sono" aria-label="Horas de sono nos últimos 30 dias"></canvas></div>
        ${deb ? `<p class="ajuda pad-x">${deb.debito >= 0.5 ? `Nos últimos 7 dias você dormiu <b>${BE.fmtHoras(deb.debito)}</b> a menos do que ${mSono ? "a sua meta" : "7 h por noite"} (média de ${BE.fmtHoras(deb.media)} em ${deb.noites} ${UI.plural(deb.noites, "noite", "noites")}).` : `Você está dormindo o suficiente: média de <b>${BE.fmtHoras(deb.media)}</b> nos últimos 7 dias.`}</p>` : ""}`;
    return UI.card({ titulo: "Sono", sub: "horas por noite · últimos 30 dias", corpo, acoes: mSono ? "" : `<button class="link-acao" data-acao="nova-meta" data-tipo="sono">+ meta de sono</button>` });
  }

  function cartaoHumor(d) {
    const ini = N.hoje(-29);
    const n = BE.serie(d, "humor", ini).length + BE.serie(d, "energia", ini).length;
    const corpo = n < 3 ? UI.vazio({ icone: "🙂", titulo: "Sem dados suficientes", texto: "Registre humor e energia por alguns dias para ver a evolução.", acao: "checkin", rotulo: "Fazer check-in", dados: `data-foco="humor"` })
      : `<div class="grafico" style="height:300px"><canvas id="graf-be-humor" aria-label="Humor, energia e estresse"></canvas></div>`;
    return UI.card({ titulo: "Humor, energia e estresse", sub: "de 1 a 5 · últimos 30 dias", corpo });
  }

  function calendarioHumor(d) {
    const ref = App.estado.bemestar.mesHumor || N.inicioMes();
    const ini = N.inicioMes(ref), fim = N.fimMes(ref), hj = N.hoje(0);
    const vazios = N.diaSemana(ini) - 1;
    const celulas = [];
    for (let i = 0; i < vazios; i++) celulas.push(`<span class="cal-h vazio"></span>`);
    N.intervalo(ini, fim).forEach((dia) => {
      const r = BE.checkin(d, dia), v = r && r.humor;
      celulas.push(`<button class="cal-h${dia === hj ? " hoje" : ""}${dia > hj ? " futuro" : ""}" ${dia > hj ? "disabled" : `data-acao="checkin" data-data="${dia}" data-foco="humor"`} style="${v ? `--h:${COR_NIVEL[v]}` : ""}" title="${esc(UI.dataLonga(dia))}${v ? " · " + BE.nivel("humor", v).r : ""}">
        <span>${Number(dia.slice(8))}</span>${v ? `<i>${BE.emoji("humor", v)}</i>` : ""}</button>`);
    });
    const regs = d.bemEstar.filter((r) => N.entre(r.data, ini, fim) && r.humor);
    const cont = [1, 2, 3, 4, 5].map((v) => regs.filter((r) => r.humor === v).length);
    return UI.card({ titulo: "Calendário do humor", sub: UI.mesRotulo(ref), acoes: `<div class="nav-data"><button class="btn pequeno" data-acao="be-mes-humor" data-delta="-1" aria-label="Mês anterior">‹</button><button class="btn pequeno" data-acao="be-mes-humor" data-delta="1" aria-label="Próximo mês"${ref >= N.inicioMes() ? " disabled" : ""}>›</button></div>`,
      corpo: `<div class="pad"><div class="cal-h-semana">${["S", "T", "Q", "Q", "S", "S", "D"].map((x) => `<span>${x}</span>`).join("")}</div><div class="cal-h-grade">${celulas.join("")}</div>
        ${regs.length ? `<div class="cal-h-leg">${BE.HUMOR.slice().reverse().map((x) => `<span style="--h:${COR_NIVEL[x.v]}"><i></i>${x.e} ${cont[x.v - 1]}</span>`).join("")}</div>` : `<p class="ajuda">Toque num dia para registrar como você estava.</p>`}</div>` });
  }

  function cartaoPassos(d) {
    const s = BE.serie(d, "passos", N.hoje(-13), N.hoje(0));
    const corpo = s.length < 2 ? UI.vazio({ icone: "👟", titulo: "Sem dados suficientes", texto: "Anote os passos do dia no check-in (copiando do app de saúde do celular ou do relógio).", acao: "checkin", rotulo: "Registrar passos", dados: `data-foco="passos"` })
      : `<div class="grafico" style="height:190px"><canvas id="graf-be-passos" aria-label="Passos nos últimos 14 dias"></canvas></div>`;
    return UI.card({ titulo: "Passos", sub: "últimos 14 dias", corpo, acoes: BE.metaDe(d, "passos") ? "" : `<button class="link-acao" data-acao="nova-meta" data-tipo="passos">+ meta de passos</button>` });
  }

  function cartaoRelacoes(d) {
    const lista = BE.relacoes(d).slice(0, 5);
    return UI.card({ titulo: "O que influencia o seu bem-estar", sub: "comparações dos seus próprios registros (últimos 60 dias)",
      corpo: lista.length ? `<ul class="insights">${lista.map((x) => `<li class="ins-${x.bom ? "positivo" : "atencao"}"><div class="ins-linha"><span class="ins-ic">${x.icone}</span><span>${esc(x.texto)}</span></div></li>`).join("")}</ul>
        <p class="ajuda pad-x">São tendências dos seus dados, não regras — mostram o que costuma acompanhar os seus dias bons.</p>`
        : UI.vazio({ icone: "🔍", titulo: "Sem dados suficientes", texto: "Depois de algumas semanas de check-in, o app compara: sono × energia, treino × humor, água × disposição…" }) });
  }

  function historico(d) {
    const lista = d.bemEstar.slice().sort((a, b) => b.data.localeCompare(a.data)).slice(0, 14);
    if (!lista.length) return "";
    const v = (r, k) => r[k] ? `<span title="${esc(BE.nivel(k, r[k]).r)}">${BE.emoji(k, r[k])}</span>` : `<span class="dim">—</span>`;
    return UI.card({ titulo: "Últimos check-ins", corpo: `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Dia</th><th>Sono</th><th>Humor</th><th>Energia</th><th>Estresse</th><th class="num">Passos</th><th></th></tr></thead><tbody>
      ${lista.map((r) => { const h = BE.horasSono(r); return `<tr><td>${esc(UI.rotuloRelativo(r.data))}</td><td>${h != null ? BE.fmtHoras(h) + (r.sonoQualidade ? " " + BE.emoji("sonoQualidade", r.sonoQualidade) : "") : `<span class="dim">—</span>`}</td><td>${v(r, "humor")}</td><td>${v(r, "energia")}</td><td>${v(r, "estresse")}</td><td class="num">${N.temValor(r.passos) ? nf(r.passos, 0) : `<span class="dim">—</span>`}</td><td>${UI.botaoIcone("checkin", "editar", "Editar", `data-data="${r.data}"`)}</td></tr>`; }).join("")}
    </tbody></table></div>` });
  }

  function abaResumo(d) {
    return `${kpis(d)}
      <div class="grid"><div class="c5">${cartaoHoje(d)}</div><div class="c7">${cartaoSono(d)}</div></div>
      <div class="grid"><div class="c7">${cartaoHumor(d)}</div><div class="c5">${calendarioHumor(d)}</div></div>
      <div class="grid"><div class="c5">${cartaoPassos(d)}</div><div class="c7">${cartaoRelacoes(d)}</div></div>
      <div class="grid"><div class="c12">${historico(d)}</div></div>`;
  }

  // ==================================================================
  // HÁBITOS
  // ==================================================================
  function mapaHabito(d, h) {
    const hj = N.hoje(0);
    return `<div class="hab-mapa" aria-hidden="true">${N.intervalo(N.hoje(-27), hj).map((dia) => {
      if (!BE.previstoNoDia(h, dia)) return `<i class="fora"></i>`;
      const p = BE.progressoNoDia(d, h, dia);
      return `<i style="--p:${p.toFixed(2)}" class="${p >= 1 ? "ok" : p > 0 ? "parcial" : dia < hj ? "perdido" : ""}" title="${esc(UI.dataCurta(dia))}"></i>`;
    }).join("")}</div>`;
  }
  function botaoHabito(d, h, data) {
    const feito = BE.cumpridoNoDia(d, h, data);
    if (h.tipo === "quantidade" || BE.automatico(h)) {
      const v = BE.valorNoDia(d, h, data), meta = Number(h.meta) || 1, p = Math.min(1, v / meta), r = 17, c = 2 * Math.PI * r;
      return `<button class="hab-check qtd${feito ? " feito" : ""}" data-acao="habito-alternar" data-id="${h.id}" data-data="${data}" title="Registrar" style="--hc:${h.cor || "var(--cy)"}">
        <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="${r}" class="hc-trilho"/><circle cx="20" cy="20" r="${r}" class="hc-valor" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c - c * p).toFixed(1)}"/></svg>
        <span>${feito ? "✓" : Math.round(p * 100) + "%"}</span></button>`;
    }
    return `<button class="hab-check${feito ? " feito" : ""}" data-acao="habito-alternar" data-id="${h.id}" data-data="${data}" aria-pressed="${feito}" title="${feito ? "Desmarcar" : "Marcar como feito"}" style="--hc:${h.cor || "var(--cy)"}"><span>${feito ? "✓" : ""}</span></button>`;
  }
  function cartaoHabito(d, h) {
    const hj = N.hoje(0), seq = BE.sequencia(d, h), tx = BE.taxa(d, h, 30), ds = BE.desafio(d, h), hoje = BE.previstoNoDia(h, hj);
    const dias = Array.isArray(h.dias) && h.dias.length && h.dias.length < 7 ? h.dias.map((x) => N.DIA_CURTO[x]).join(" ") : "todo dia";
    const v = BE.valorNoDia(d, h, hj);
    return `<article class="hab-card${h.ativo === false ? " pausado" : ""}" style="--hc:${h.cor || "var(--cy)"}">
      <header>
        <span class="hab-ic">${esc(h.emoji || "✅")}</span>
        <div class="hab-tit"><b>${esc(h.nome)}</b><small>${h.tipo === "quantidade" ? `${nf(h.meta)} ${esc(h.unidade || "")} · ` : ""}${dias}${h.horario ? " · " + h.horario : ""}</small></div>
        ${h.ativo !== false && hoje ? botaoHabito(d, h, hj) : h.ativo === false ? `<span class="selo-tag selo-cat">pausado</span>` : `<span class="dim hab-folga">folga hoje</span>`}
      </header>
      ${ds ? `<div class="hab-desafio"><div class="hd-topo"><span>🏆 ${ds.estado === "concluido" ? "<b>Desafio concluído!</b>" : ds.estado === "encerrado" ? "Desafio encerrado" : `Dia <b>${ds.dia}</b> de ${h.duracao}`}</span><span>${ds.cumpridos}/${ds.total}</span></div>${UI.barra(ds.pct, ds.estado === "concluido" ? "var(--up)" : h.cor || "var(--cy)", true)}</div>` : ""}
      ${mapaHabito(d, h)}
      <div class="hab-stats">
        <span title="Dias seguidos cumprindo">🔥 <b>${seq.atual}</b> ${UI.plural(seq.atual, "dia", "dias")}</span>
        <span title="Melhor sequência">🏅 recorde <b>${seq.melhor}</b></span>
        <span title="Dias cumpridos nos últimos 30 dias">${tx.pct == null ? "—" : `<b>${Math.round(tx.pct)}%</b> em 30 dias`}</span>
        ${h.tipo === "quantidade" && hoje ? `<span>hoje: <b>${nf(v)}</b>/${nf(h.meta)}</span>` : ""}
      </div>
      ${h.obs ? `<p class="hab-motivo">💬 ${esc(h.obs)}</p>` : ""}
      <footer><button class="link-acao" data-acao="editar-habito" data-id="${h.id}">editar</button><button class="link-acao" data-acao="habito-pausar" data-id="${h.id}">${h.ativo === false ? "retomar" : "pausar"}</button></footer>
    </article>`;
  }
  function abaHabitos(d) {
    const hj = N.hoje(0);
    const ativos = BE.habitosAtivos(d), pausados = d.habitos.filter((h) => h.ativo === false);
    const deHoje = BE.habitosDoDia(d, hj), feitos = deHoje.filter((h) => BE.cumpridoNoDia(d, h, hj)).length;
    const desafios = ativos.filter((h) => { const x = BE.desafio(d, h); return x && x.estado === "ativo"; });
    const topo = `<div class="hab-topo card">
      <div class="ht-prog">${UI.gaugeSVG(deHoje.length ? (feitos / deHoje.length) * 100 : 0, "var(--c-bem)", 64)}<span>${deHoje.length ? Math.round((feitos / deHoje.length) * 100) + "%" : "—"}</span></div>
      <div class="ht-txt"><b>${deHoje.length ? `${feitos} de ${deHoje.length} hábitos de hoje` : ativos.length ? "Nenhum hábito previsto para hoje" : "Crie hábitos do seu jeito"}</b>
        <small>${desafios.length ? `${desafios.length} ${UI.plural(desafios.length, "desafio em andamento", "desafios em andamento")}` : "Feito / não feito ou com quantidade, nos dias que você escolher."}</small></div>
      <div class="botoes-linha">${UI.botao("habito-modelos", "Desafios prontos", { icone: "estrela" })}${UI.botao("novo-habito", "Novo hábito", { classe: "primario", icone: "mais" })}</div>
    </div>`;
    if (!d.habitos.length) return topo + `<div class="grid"><div class="c12">${UI.card({ titulo: "Hábitos", corpo: UI.vazio({ icone: "🌱", titulo: "Nenhum hábito ainda.", texto: "Exemplos: beber 2 L de água, ler 10 páginas, meditar, passar fio dental, dormir antes das 23h, 21 dias sem açúcar…", acao: "habito-modelos", rotulo: "Ver desafios prontos" }) })}</div></div>`;
    return topo + `<div class="hab-grade">${ativos.map((h) => cartaoHabito(d, h)).join("")}</div>
      ${pausados.length ? `<details class="sec-pausados"><summary>${pausados.length} ${UI.plural(pausados.length, "hábito pausado", "hábitos pausados")}</summary><div class="hab-grade">${pausados.map((h) => cartaoHabito(d, h)).join("")}</div></details>` : ""}`;
  }

  // ==================================================================
  // REMÉDIOS
  // ==================================================================
  function linhaDose(x, data) {
    const r = x.remedio, st = x.status, hj = N.hoje(0);
    const atraso = data === hj && st === "Pendente" ? BE.atrasoMin(x.horario) : null;
    return `<li class="dose st-${st.toLowerCase()}${atraso != null && atraso > 30 ? " atrasada" : ""}">
      <button class="dose-check" data-acao="dose-alternar" data-id="${r.id}" data-data="${data}" data-hora="${x.horario}" aria-pressed="${st === "Tomado"}" title="${st === "Tomado" ? "Desmarcar" : "Marcar como tomado"}"><span>${st === "Tomado" ? "✓" : st === "Pulado" ? "–" : ""}</span></button>
      <div class="dose-info"><b><span class="check-hora">${x.horario}</span>${BE.EMOJI_REMEDIO[r.tipo] || "💊"} ${esc(r.nome)}</b>
        <small>${esc(r.dose || "")}${r.instrucao && r.instrucao !== "Indiferente" ? " · " + esc(r.instrucao.toLowerCase()) : ""}${st === "Tomado" && x.dose && x.dose.hora ? ` · tomado às ${x.dose.hora}` : st === "Pulado" ? " · pulada" : atraso != null && atraso > 30 ? ` · atrasada ${atraso >= 60 ? Math.floor(atraso / 60) + "h" : atraso + " min"}` : ""}${x.extra ? " · dose extra" : ""}</small></div>
      ${st === "Pendente" ? `<button class="btn pequeno" data-acao="dose-status" data-id="${r.id}" data-data="${data}" data-hora="${x.horario}" data-status="Pulado">Pular</button>` : ""}
    </li>`;
  }
  function cartaoRemedio(d, r) {
    const est = BE.estoque(r), ad = BE.adesao({ remedios: [r], doses: d.doses.filter((x) => x.remedioId === r.id), bemEstar: [], habitos: [] }, N.hoje(-29), N.hoje(0));
    const freq = r.frequencia === "sob-demanda" ? "quando precisar" : r.frequencia === "intervalo" ? `a cada ${r.intervaloDias} dias` : r.frequencia === "dias" ? (r.dias || []).map((x) => N.DIA_CURTO[x]).join(" ") : "todo dia";
    const naLista = d.compras.some((c) => c.remedioId === r.id && c.status === "Pendente");
    const acabou = r.fim && r.fim < N.hoje(0);
    return `<article class="rem-card${r.ativo === false || acabou ? " pausado" : ""}${est && est.baixo ? " baixo" : ""}">
      <header><span class="rem-ic">${BE.EMOJI_REMEDIO[r.tipo] || "💊"}</span><div><b>${esc(r.nome)}</b><small>${esc(r.dose || "")} · ${freq}${(r.horarios || []).length ? " · " + r.horarios.join(", ") : ""}</small></div>${UI.botaoIcone("editar-remedio", "editar", "Editar", `data-id="${r.id}"`)}</header>
      ${r.obs ? `<p class="rem-obs">${esc(r.obs)}</p>` : ""}
      <div class="rem-dados">
        ${est ? `<div><small>Estoque</small><b class="${est.baixo ? "down" : ""}">${nf(est.qtd)} <small>${esc(BE.unidade(est.qtd, r.unidadeDose || ""))}</small></b>${est.dias != null ? `<small>${est.dias === 0 ? "acaba hoje" : `≈ ${est.dias} ${UI.plural(est.dias, "dia", "dias")}`}</small>` : ""}</div>` : `<div><small>Estoque</small><b class="dim">—</b><small>não controlado</small></div>`}
        ${r.frequencia === "sob-demanda" ? (() => { const usos = d.doses.filter((x) => x.remedioId === r.id && x.status === "Tomado" && x.data >= N.hoje(-29)); const ult = usos.map((x) => x.data).sort().pop(); return `<div><small>Usos</small><b>${usos.length}</b><small>${ult ? "último " + UI.rotuloRelativo(ult).toLowerCase() : "em 30 dias"}</small></div>`; })()
          : `<div><small>Adesão</small><b>${ad.pct == null ? "—" : Math.round(ad.pct) + "%"}</b><small>${ad.previstas ? `${ad.tomadas}/${ad.previstas} · 30 dias` : "30 dias"}</small></div>`}
        <div><small>Período</small><b>${r.fim ? (acabou ? "encerrado" : "até " + UI.dataCurta(r.fim)) : "contínuo"}</b><small>desde ${UI.dataCurta(r.inicio)}</small></div>
      </div>
      <footer>
        ${r.frequencia === "sob-demanda" && r.ativo !== false ? `<button class="btn pequeno primario" data-acao="dose-extra" data-id="${r.id}">Tomei agora</button>` : ""}
        ${est ? `<button class="btn pequeno" data-acao="remedio-repor" data-id="${r.id}">Repor</button>` : ""}
        ${est && est.baixo ? (naLista ? `<span class="selo-tag selo-pago">na lista de compras</span>` : `<button class="btn pequeno" data-acao="remedio-comprar" data-id="${r.id}">${UI.svg("carrinho")}Pôr na lista</button>`) : ""}
        <button class="link-acao" data-acao="remedio-pausar" data-id="${r.id}">${r.ativo === false ? "reativar" : "pausar"}</button>
      </footer>
    </article>`;
  }
  function gradeSemana(d) {
    const dias = N.intervalo(N.hoje(-6), N.hoje(0));
    const ativos = d.remedios.filter((r) => dias.some((x) => BE.previstoRemedio(r, x)));
    if (!ativos.length) return "";
    return UI.card({ titulo: "Últimos 7 dias", sub: "✓ tomado · – pulado · ✕ esquecido", corpo: `<div class="tabela-wrap"><table class="tabela rem-semana"><thead><tr><th></th>${dias.map((x) => `<th>${N.DIA_CURTO[N.diaSemana(x)]}<br><small>${UI.dataCurta(x)}</small></th>`).join("")}</tr></thead><tbody>
      ${ativos.map((r) => `<tr><td><b>${esc(r.nome)}</b></td>${dias.map((x) => {
        if (!BE.previstoRemedio(r, x)) return `<td class="dim">·</td>`;
        const doses = (r.horarios || []).map((h) => BE.dose(d, r.id, x, h));
        const tom = doses.filter((y) => y && y.status === "Tomado").length, pul = doses.filter((y) => y && y.status === "Pulado").length, tot = doses.length;
        const hoje = x === N.hoje(0);
        const cls = tom === tot ? "ok" : hoje && tom + pul < tot ? "pend" : tom ? "parcial" : pul === tot ? "pulado" : "falta";
        return `<td class="rs-${cls}" title="${tom} de ${tot}">${tom === tot ? "✓" : cls === "pend" ? (tom ? tom + "/" + tot : "…") : tom ? tom + "/" + tot : pul === tot ? "–" : "✕"}</td>`;
      }).join("")}</tr>`).join("")}
    </tbody></table></div>` });
  }
  function abaRemedios(d) {
    const hj = N.hoje(0);
    const doses = BE.dosesDoDia(d, hj);
    const tomadas = doses.filter((x) => x.status === "Tomado").length;
    const ad7 = BE.adesao(d, N.hoje(-6), hj), ad30 = BE.adesao(d, N.hoje(-29), hj);
    const ativos = d.remedios.filter((r) => r.ativo !== false && !(r.fim && r.fim < hj)), outros = d.remedios.filter((r) => r.ativo === false || (r.fim && r.fim < hj));
    const baixos = ativos.filter((r) => { const e = BE.estoque(r); return e && e.baixo; });
    const cab = `<div class="botoes-linha fim">${UI.botao("exportar-ics", "Pôr no calendário", { icone: "calendario", titulo: "Lembretes no calendário do celular (funcionam com o app fechado)" })}${UI.botao("novo-remedio", "Novo remédio", { classe: "primario", icone: "mais" })}</div>`;
    if (!d.remedios.length) return cab + `<div class="grid"><div class="c12">${UI.card({ titulo: "Remédios e suplementos", corpo: UI.vazio({ icone: "💊", titulo: "Nenhum remédio ou suplemento cadastrado.", texto: "Cadastre com horários, dias e estoque: cada dose aparece no roteiro do dia, o estoque desconta sozinho e o app avisa quando estiver acabando.", acao: "novo-remedio", rotulo: "Cadastrar" }) })}</div></div>`;
    return cab + `<div class="kpi-row">
        ${UI.kpi({ rotulo: "Doses de hoje", valor: doses.length ? `${tomadas}<small> / ${doses.length}</small>` : "0", gauge: doses.length ? (tomadas / doses.length) * 100 : null, cor: "var(--c-bem)" })}
        ${UI.kpi({ rotulo: "Adesão 7 dias", valor: ad7.pct == null ? UI.SEM_DADOS : UI.pct(ad7.pct), sub: ad7.previstas ? `${ad7.tomadas} de ${ad7.previstas} doses` : "", dica: "Doses tomadas ÷ doses previstas até agora (as de hoje que ainda não chegaram não contam)." })}
        ${UI.kpi({ rotulo: "Adesão 30 dias", valor: ad30.pct == null ? UI.SEM_DADOS : UI.pct(ad30.pct), sub: ad30.previstas ? `${ad30.tomadas} de ${ad30.previstas} doses` : "" })}
        ${UI.kpi({ rotulo: "Acabando", valor: String(baixos.length), sub: baixos.length ? baixos.map((r) => r.nome).slice(0, 2).join(", ") : "estoque em dia" })}
      </div>
      <div class="grid"><div class="c5">${UI.card({ titulo: "Hoje", sub: UI.dataLonga(hj), corpo: doses.length ? `<ul class="doses">${doses.map((x) => linhaDose(x, hj)).join("")}</ul>` : UI.vazio({ icone: "✅", titulo: "Nenhuma dose prevista para hoje." }) })}</div>
        <div class="c7"><div class="rem-grade">${ativos.map((r) => cartaoRemedio(d, r)).join("")}</div></div></div>
      <div class="grid"><div class="c12">${gradeSemana(d)}</div></div>
      ${outros.length ? `<details class="sec-pausados"><summary>${outros.length} ${UI.plural(outros.length, "pausado ou encerrado", "pausados ou encerrados")}</summary><div class="rem-grade">${outros.map((r) => cartaoRemedio(d, r)).join("")}</div></details>` : ""}`;
  }

  // ==================================================================
  // JEJUM
  // ==================================================================
  function aneisJejum(j) {
    const h = BE.horasJejum(j), meta = Number(j.metaHoras) || 16, p = N.limitar(h / meta, 0, 1), r = 88, c = 2 * Math.PI * r;
    const fimPrev = new Date(new Date(j.inicio).getTime() + meta * 3600000);
    return `<div class="jj-anel" data-jejum-vivo="${esc(j.inicio)}" data-jejum-meta="${meta}">
      <svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="${r}" class="jj-trilho"/><circle cx="100" cy="100" r="${r}" class="jj-valor" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c - c * p).toFixed(1)}" data-c="${c.toFixed(1)}"/></svg>
      <div class="jj-centro"><small>${p >= 1 ? "Meta atingida 🎉" : "Em jejum há"}</small><b data-jj="tempo">${BE.fmtHoras(h)}</b><small data-jj="resta">${p >= 1 ? "+" + BE.fmtHoras(h - meta) + " além da meta" : "faltam " + BE.fmtHoras(meta - h)}</small></div>
    </div>
    <div class="jj-horas"><div><small>Começou</small><b>${new Date(j.inicio).toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}</b></div><div><small>Meta</small><b>${BE.fmtHoras(meta)}</b></div><div><small>Termina</small><b>${fimPrev.toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}</b></div></div>`;
  }
  function abaJejum(d) {
    const at = BE.jejumAtivo(d), e = BE.estatJejum(d, 30), lista = BE.jejunsConcluidos(d);
    const atual = at ? `${aneisJejum(at)}<div class="botoes-linha centro"><button class="btn primario" data-acao="jejum-encerrar">Encerrar jejum</button><button class="btn" data-acao="editar-jejum" data-id="${at.id}">Editar</button></div>`
      : `<div class="jj-inicio"><p>Escolha a duração e comece agora — dá para ajustar o horário de início depois.</p>
          <div class="protocolos">${BE.PROTOCOLOS.map((p) => `<button class="protocolo" data-acao="jejum-rapido" data-h="${p.h}"><b>${p.r}</b><small>${p.s}</small></button>`).join("")}</div>
          <p class="ajuda">Jejum não é indicado para todo mundo — gestantes, crianças, diabéticos ou quem tem histórico de transtorno alimentar devem conversar antes com um profissional de saúde.</p></div>`;
    return `<div class="grid"><div class="c5">${UI.card({ titulo: at ? "Jejum em andamento" : "Começar um jejum", corpo: `<div class="pad">${atual}</div>` })}</div>
      <div class="c7">
        <div class="kpi-row compacta">
          ${UI.kpi({ rotulo: "Jejuns em 30 dias", valor: String(e.total) })}
          ${UI.kpi({ rotulo: "Metas atingidas", valor: e.pct == null ? UI.SEM_DADOS : UI.pct(e.pct), sub: e.total ? `${e.atingidos} de ${e.total}` : "" })}
          ${UI.kpi({ rotulo: "Duração média", valor: e.media == null ? UI.SEM_DADOS : BE.fmtHoras(e.media) })}
          ${UI.kpi({ rotulo: "Mais longo", valor: e.maior == null ? UI.SEM_DADOS : BE.fmtHoras(e.maior) })}
        </div>
        ${UI.card({ titulo: "Últimos jejuns", corpo: lista.length >= 2 ? `<div class="grafico" style="height:200px"><canvas id="graf-be-jejum" aria-label="Duração dos últimos jejuns"></canvas></div>` : UI.vazio({ icone: "⏳", titulo: "Sem dados suficientes", texto: "O gráfico aparece a partir de 2 jejuns concluídos." }) })}
      </div></div>
      ${lista.length ? `<div class="grid"><div class="c12">${UI.card({ titulo: "Histórico", corpo: `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Início</th><th>Fim</th><th class="num">Duração</th><th class="num">Meta</th><th></th><th></th></tr></thead><tbody>
        ${lista.slice(0, 30).map((j) => { const h = BE.horasJejum(j), ok = h >= Number(j.metaHoras) - 0.01; return `<tr><td>${new Date(j.inicio).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td><td>${new Date(j.fim).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td><td class="num"><b>${BE.fmtHoras(h)}</b></td><td class="num">${BE.fmtHoras(j.metaHoras)}</td><td>${ok ? `<span class="selo-tag selo-ok">✓ meta</span>` : `<span class="selo-tag selo-cat">${Math.round((h / j.metaHoras) * 100)}%</span>`}</td><td>${UI.botaoIcone("editar-jejum", "editar", "Editar", `data-id="${j.id}"`)}</td></tr>`; }).join("")}
      </tbody></table></div>` })}</div></div>` : ""}`;
  }

  // atualiza os contadores de jejum na tela (Hoje e Bem-estar) a cada 30 s
  function atualizarJejumVivo() {
    document.querySelectorAll("[data-jejum-vivo]").forEach((el) => {
      const h = Math.max(0, (Date.now() - new Date(el.dataset.jejumVivo)) / 3600000), meta = Number(el.dataset.jejumMeta) || 16;
      const t = el.querySelector('[data-jj="tempo"]'), r = el.querySelector('[data-jj="resta"]'), v = el.querySelector(".jj-valor");
      if (t) t.textContent = BE.fmtHoras(h);
      if (r) r.textContent = h >= meta ? "+" + BE.fmtHoras(h - meta) + " além da meta" : "faltam " + BE.fmtHoras(meta - h);
      if (v) { const c = Number(v.dataset.c); v.setAttribute("stroke-dashoffset", (c - c * N.limitar(h / meta, 0, 1)).toFixed(1)); }
    });
  }
  setInterval(atualizarJejumVivo, 30000);

  // ==================================================================
  App.estado.bemestar = { mesHumor: N.inicioMes() };
  App.registrarPagina("bemestar", {
    titulo: "Bem-estar",
    render(d, rota) {
      const AR = window.Areas, MAPA = { resumo: "checkin", habitos: "habitos", remedios: "remedios", jejum: "jejum" };
      const disp = ABAS.filter((x) => !AR || AR.area(d, MAPA[x.k]));
      if (!disp.length) return `<div class="cabecalho-pagina"><div><h1>Bem-estar</h1></div></div>` + UI.card({ titulo: "Bem-estar", corpo: UI.vazio({ icone: "💚", titulo: "As partes do Bem-estar estão desligadas.", texto: "Ligue sono e humor, hábitos, remédios ou jejum em Ajustes → O que você usa.", acao: "ir", rotulo: "Abrir ajustes", dados: 'data-secao="configuracoes" data-param="areas"' }) });
      const aba = disp.some((x) => x.k === rota.param) ? rota.param : disp[0].k;
      const corpo = aba === "habitos" ? abaHabitos(d) : aba === "remedios" ? abaRemedios(d) : aba === "jejum" ? abaJejum(d) : abaResumo(d);
      const at = BE.jejumAtivo(d);
      const abas = disp.map((x) => Object.assign({}, x, x.k === "jejum" && at ? { r: "Jejum ⏳" } : {}));
      return `<div class="cabecalho-pagina"><div><h1>Bem-estar</h1><p class="sub">Sono, humor, hábitos, remédios e jejum</p></div>${UI.abas(abas, aba, "aba-bemestar")}</div>${corpo}`;
    },
    depois(d, rota) {
      const aba = rota.param || "resumo";
      // (as abas desligadas não chegam aqui: o render já escolheu a primeira disponível)
      const cor = getComputedStyle(document.body).getPropertyValue("--marca").trim() || "#5AC8FA";
      if (document.getElementById("graf-be-sono")) {
        const s = BE.serie(d, "sono", N.hoje(-29), N.hoje(0));
        G.renderBarrasMeta("graf-be-sono", s.map((p) => ({ rotulo: UI.dataCurta(p.data), valor: N.arred(p.valor, 2) })), { meta: BE.metaDe(d, "sono") || 7, un: "h", rotulo: "Sono", cor, casas: 1 });
      }
      if (document.getElementById("graf-be-humor")) {
        const ini = N.hoje(-29);
        G.renderMultiplas("graf-be-humor", [
          { nome: "Humor", cor: "#30D158", pontos: BE.serie(d, "humor", ini) },
          { nome: "Energia", cor: "#FFD60A", pontos: BE.serie(d, "energia", ini) },
          { nome: "Estresse", cor: "#FF453A", pontos: BE.serie(d, "estresse", ini), tracejado: true }
        ], { casas: 1, min: 1, max: 5, passo: 1 });
      }
      if (document.getElementById("graf-be-passos")) {
        const s = BE.serie(d, "passos", N.hoje(-13), N.hoje(0));
        G.renderBarrasMeta("graf-be-passos", s.map((p) => ({ rotulo: UI.dataCurta(p.data), valor: p.valor })), { meta: BE.metaDe(d, "passos"), un: "passos", rotulo: "Passos", cor: "#30D158" });
      }
      if (document.getElementById("graf-be-jejum")) {
        const l = BE.jejunsConcluidos(d).slice(0, 14).reverse();
        G.renderBarrasMeta("graf-be-jejum", l.map((j) => ({ rotulo: UI.dataCurta(N.isoLocal(new Date(j.inicio))), valor: N.arred(BE.horasJejum(j), 1) })), { meta: Number(d.config.jejumPadrao) || 16, un: "h", rotulo: "Duração", cor, casas: 1 });
      }
      if (aba === "jejum" || aba === "resumo") atualizarJejumVivo();
    }
  });

  App.registrarAcoes({
    "aba-bemestar": (el) => App.ir("bemestar", el.dataset.k, { manterRolagem: true }),
    "be-mes-humor": (el) => {
      const st = App.estado.bemestar;
      const novo = N.addMeses(st.mesHumor || N.inicioMes(), Number(el.dataset.delta));
      if (novo > N.inicioMes()) return;
      st.mesHumor = novo;
      App.renderizar();
    },
    "jejum-rapido": (el) => {
      const d = App.dados();
      if (BE.jejumAtivo(d)) return;
      const h = Number(el.dataset.h) || 16;
      d.jejuns.push({ id: N.novoId(), usuarioId: d.usuarios[0].id, inicio: new Date().toISOString(), fim: null, metaHoras: h, obs: "" });
      d.config.jejumPadrao = h;
      App.salvar(`⏳ Jejum de ${BE.fmtHoras(h)} começou. Termina às ${new Date(Date.now() + h * 3600000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`, { semIntegracao: true });
    }
  });

  window.PaginaBemEstar = { aneisJejum, atualizarJejumVivo, botaoHabito, COR_NIVEL, COR_ESTRESSE };
})();
