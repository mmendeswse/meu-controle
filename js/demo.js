/**
 * demo.js
 * -----------------------------------------------------------------------
 * Dados de DEMONSTRAÇÃO, claramente marcados (demo:true). Só são carregados
 * quando o usuário pede ("Explorar com dados de exemplo") e podem ser
 * apagados com um clique. São fictícios, mas coerentes entre si: as
 * refeições usam os alimentos cadastrados, o planejamento + o estoque geram
 * a lista de compras, as cargas progridem semana a semana, etc.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo;

  function gerar(d) {
    const H = (n) => N.hoje(n);
    let semente = 7;
    const rnd = () => { semente = (semente * 9301 + 49297) % 233280; return semente / 233280; };
    const id = N.novoId;

    d.demo = true;
    d.config.boasVindas = false;
    d.config.ultimoBackup = new Date(Date.now() - 9 * 86400000).toISOString();
    const eu = id();
    d.usuarios = [{ id: eu, nome: "Você (exemplo)", altura: 1.75, pesoInicial: null, objetivo: "Recomposição corporal", dataInicio: H(-84), obs: "Perfil de exemplo — edite em Configurações." }];

    // ---------------------------------------------------------------
    // alimentos (valores aproximados de tabelas nutricionais)
    // ---------------------------------------------------------------
    const A = {};
    function al(k, nome, cat, porcao, un, kcal, p, c, g, f, preco, pq, pu, mercado, emoji) {
      A[k] = { id: id(), nome, emoji: emoji || "", categoria: cat, marca: "", porcao, unidade: un, kcal, proteina: p, carbo: c, gordura: g, fibra: f,
        preco, precoQtd: pq, precoUnidade: pu, mercado, obs: "", criadoEm: H(-84) };
      d.alimentos.push(A[k]);
    }
    al("arroz", "Arroz branco cozido", "Carboidratos", 100, "g", 128, 2.5, 28.1, 0.2, 1.6, 6.5, 1, "kg", "Mercado", "🍚");
    al("feijao", "Feijão carioca cozido", "Carboidratos", 100, "g", 76, 4.8, 13.6, 0.5, 8.5, 8.9, 1, "kg", "Mercado", "🫘");
    al("frango", "Peito de frango grelhado", "Proteínas", 100, "g", 159, 32, 0, 2.5, 0, 22, 1, "kg", "Açougue", "🍗");
    al("patinho", "Carne moída (patinho)", "Proteínas", 100, "g", 219, 35.9, 0, 7.3, 0, 44, 1, "kg", "Açougue", "🥩");
    al("tilapia", "Filé de tilápia", "Proteínas", 100, "g", 128, 26, 0, 2.7, 0, 39, 1, "kg", "Mercado", "🐟");
    al("ovo", "Ovo", "Proteínas", 1, "un", 72, 6.3, 0.4, 4.8, 0, 13, 1, "dz", "Mercado", "🥚");
    al("brocolis", "Brócolis", "Verduras", 100, "g", 25, 2.1, 4.4, 0.5, 3.4, 12, 1, "kg", "Feira", "🥦");
    al("alface", "Alface", "Verduras", 100, "g", 11, 1.3, 1.7, 0.2, 2.3, 10, 1, "kg", "Feira", "🥬");
    al("tomate", "Tomate", "Legumes", 100, "g", 15, 1.1, 3.1, 0.2, 1.2, 8, 1, "kg", "Feira", "🍅");
    al("cenoura", "Cenoura", "Legumes", 100, "g", 34, 1.3, 7.7, 0.2, 3.2, 6, 1, "kg", "Feira", "🥕");
    al("batata", "Batata-doce cozida", "Carboidratos", 100, "g", 77, 0.6, 18.4, 0.1, 2.2, 7, 1, "kg", "Feira", "🍠");
    al("macarrao", "Macarrão integral cozido", "Carboidratos", 100, "g", 124, 5, 26, 1, 3.5, 14, 1, "kg", "Mercado", "🍝");
    al("pao", "Pão integral", "Carboidratos", 1, "fatia", 63, 2.4, 11, 0.9, 1.7, 0.45, 1, "fatia", "Padaria", "🍞");
    al("aveia", "Aveia em flocos", "Carboidratos", 100, "g", 394, 13.9, 66.6, 8.5, 9.1, 18, 1, "kg", "Mercado", "🌾");
    al("banana", "Banana", "Frutas", 1, "un", 98, 1.3, 26, 0.1, 2, 0.7, 1, "un", "Feira", "🍌");
    al("maca", "Maçã", "Frutas", 1, "un", 72, 0.3, 19, 0.2, 2.4, 1.3, 1, "un", "Feira", "🍎");
    al("morango", "Morango", "Frutas", 100, "g", 32, 0.7, 7.7, 0.3, 2, 24, 1, "kg", "Feira", "🍓");
    al("leite", "Leite desnatado", "Laticínios", 100, "ml", 35, 3.4, 4.9, 0.1, 0, 5.2, 1, "L", "Mercado", "🥛");
    al("iogurte", "Iogurte natural", "Laticínios", 100, "g", 51, 4.1, 5.6, 1.6, 0, 16, 1, "kg", "Mercado", "🥣");
    al("cottage", "Queijo cottage", "Laticínios", 100, "g", 98, 11, 3.4, 4.3, 0, 40, 1, "kg", "Mercado", "🧀");
    al("whey", "Whey protein", "Suplementos", 30, "g", 120, 24, 3, 1.5, 0, 150, 1, "kg", "Online", "💪");
    al("azeite", "Azeite de oliva", "Outros", 1, "colher", 72, 0, 0, 8, 0, 0.45, 1, "colher", "Mercado", "🫒");
    al("amendoim", "Pasta de amendoim", "Outros", 1, "colher", 90, 4, 3, 7.5, 1, 0.9, 1, "colher", "Mercado", "🥜");
    al("cafe", "Café em pó", "Bebidas", 10, "g", 0, 0, 0, 0, 0, 19, 500, "g", "Mercado", "☕");

    // ---------------------------------------------------------------
    // favoritas
    // ---------------------------------------------------------------
    const it = (k, q, un) => ({ alimentoId: A[k].id, quantidade: q, unidade: un || A[k].unidade });
    const fAlmoco = { id: id(), nome: "Almoço padrão", tipo: "Almoço", obs: "", itens: [it("arroz", 150), it("frango", 150), it("feijao", 100), it("brocolis", 100)] };
    const fCafe = { id: id(), nome: "Café proteico", tipo: "Café da manhã", obs: "", itens: [it("ovo", 3), it("pao", 2), it("leite", 200), it("banana", 1)] };
    const fPos = { id: id(), nome: "Pós-treino", tipo: "Lanche da tarde", obs: "", itens: [it("whey", 30), it("banana", 1), it("amendoim", 1)] };
    d.favoritas = [fAlmoco, fCafe, fPos];

    // ---------------------------------------------------------------
    // refeições: 4 semanas para trás + a semana que vem planejada
    // ---------------------------------------------------------------
    const CARDAPIO = {
      "Café da manhã": [[it("ovo", 3), it("pao", 2), it("leite", 200), it("banana", 1)], [it("aveia", 40), it("iogurte", 170), it("banana", 1), it("whey", 30)]],
      "Lanche da manhã": [[it("iogurte", 170), it("aveia", 30)], [it("maca", 1)]],
      "Almoço": [[it("arroz", 150), it("feijao", 100), it("frango", 150), it("brocolis", 100), it("azeite", 1)], [it("arroz", 150), it("feijao", 100), it("patinho", 130), it("alface", 50), it("tomate", 80)]],
      "Lanche da tarde": [[it("whey", 30), it("banana", 1), it("amendoim", 1)], [it("maca", 1), it("cottage", 100)]],
      "Jantar": [[it("batata", 200), it("tilapia", 150), it("brocolis", 100)], [it("macarrao", 150), it("patinho", 130), it("tomate", 80)], [it("arroz", 100), it("frango", 150), it("cenoura", 80)]],
      "Ceia": [[it("cottage", 100)], [it("leite", 250)]]
    };
    function refeicao(data, tipo, opcao, status) {
      const r = { id: id(), usuarioId: eu, data, tipo, horario: N.HORARIO_SUGERIDO[tipo], status, favoritaId: null, obs: "" };
      d.refeicoes.push(r);
      const lista = CARDAPIO[tipo][opcao % CARDAPIO[tipo].length];
      lista.forEach((x) => d.refeicaoItens.push({ id: id(), refeicaoId: r.id, alimentoId: x.alimentoId, quantidade: x.quantidade, unidade: x.unidade }));
    }
    for (let k = -27; k <= 6; k++) {
      const data = H(k);
      N.TIPOS_REFEICAO.forEach((tipo, t) => {
        if (tipo === "Lanche da manhã" && (k + 100) % 3 === 0) return;
        if (tipo === "Ceia" && (k + 100) % 2 === 0) return;
        let status = k < 0 ? "Realizada" : k > 0 ? "Planejada" : (tipo === "Café da manhã" || tipo === "Lanche da manhã" || tipo === "Almoço" ? "Realizada" : "Planejada");
        if (k < 0 && tipo === "Lanche da tarde" && rnd() < 0.12) status = "Pulada";
        refeicao(data, tipo, (k + 100 + t) % 3, status);
      });
    }

    // água
    for (let k = -27; k < 0; k++) d.agua.push({ id: id(), usuarioId: eu, data: H(k), ml: Math.round((2000 + rnd() * 1300) / 50) * 50, hora: "21:00" });
    [["08:10", 500], ["10:30", 250], ["12:45", 500], ["15:00", 250]].forEach((x) => d.agua.push({ id: id(), usuarioId: eu, data: H(0), ml: x[1], hora: x[0] }));

    // ---------------------------------------------------------------
    // estoque (alguns abaixo do mínimo, de propósito)
    // ---------------------------------------------------------------
    function est(k, q, un, min, validade) { d.estoque.push({ id: id(), alimentoId: A[k].id, quantidade: q, unidade: un, minimo: min, validade: validade || null, obs: "", atualizadoEm: H(-1) }); }
    est("arroz", 2.5, "kg", 1);
    est("feijao", 1.2, "kg", 0.5);
    est("frango", 1.2, "kg", 1.5, H(3));
    est("patinho", 0.6, "kg", 0.5, H(2));
    est("brocolis", 300, "g", 500, H(4));
    est("ovo", 18, "un", 12);
    est("leite", 3, "L", 2, H(12));
    est("aveia", 0.8, "kg", 0.3);
    est("banana", 4, "un", 6);
    est("whey", 0.6, "kg", 0.3);
    est("batata", 1, "kg", 0.5);
    est("iogurte", 0.9, "kg", 0.5, H(6));
    est("cottage", 0.4, "kg", 0.2, H(5));
    est("cafe", 250, "g", 200);

    // ---------------------------------------------------------------
    // compras: idas semanais nos últimos 2 meses + pendentes
    // ---------------------------------------------------------------
    function comprar(k, q, un, data, fator) {
      const a = A[k];
      const est = N.arred((N.converter(q, un, a.precoUnidade) / a.precoQtd) * a.preco, 2);
      const pago = N.arred(est * (fator || (0.92 + rnd() * 0.16)), 2);
      d.compras.push({ id: id(), usuarioId: eu, alimentoId: a.id, nome: a.nome, categoria: a.categoria, quantidade: q, unidade: un, precoEstimado: est, precoPago: pago,
        mercado: a.mercado, prioridade: "Normal", status: "Comprado", dataCompra: data, dataPrevista: null, origem: "manual", auto: false, motivo: "", criadoEm: data, obs: "" });
    }
    [-59, -52, -45, -38, -31, -24, -17, -10, -3].forEach((k, i) => {
      const dt = H(k);
      comprar("frango", 2, "kg", dt); comprar("brocolis", 1, "kg", dt); comprar("banana", 12, "un", dt); comprar("ovo", 2, "dz", dt);
      comprar("morango", 0.5, "kg", dt);
      if (i % 2 === 0) { comprar("arroz", 5, "kg", dt); comprar("feijao", 2, "kg", dt); comprar("patinho", 1, "kg", dt); comprar("leite", 6, "L", dt); }
      else { comprar("tilapia", 1, "kg", dt); comprar("batata", 2, "kg", dt); comprar("iogurte", 1, "kg", dt); comprar("tomate", 1, "kg", dt); comprar("alface", 0.3, "kg", dt); }
      if (i % 3 === 0) { comprar("whey", 1, "kg", dt, 0.95); comprar("aveia", 1, "kg", dt); comprar("cottage", 0.4, "kg", dt); comprar("cafe", 500, "g", dt); }
    });
    d.compras.push({ id: id(), usuarioId: eu, alimentoId: A.morango.id, nome: A.morango.nome, categoria: "Frutas", quantidade: 0.5, unidade: "kg", precoEstimado: 12, precoPago: null,
      mercado: "Feira", prioridade: "Baixa", status: "Pendente", dataCompra: null, dataPrevista: H(2), origem: "manual", auto: false, motivo: "", criadoEm: H(-1), obs: "" });
    d.compras.push({ id: id(), usuarioId: eu, alimentoId: null, nome: "Temperos (alho, cebola)", categoria: "Outros", quantidade: 1, unidade: "un", precoEstimado: 9, precoPago: null,
      mercado: "Feira", prioridade: "Normal", status: "Pendente", dataCompra: null, dataPrevista: H(2), origem: "manual", auto: false, motivo: "", criadoEm: H(-1), obs: "" });

    // ---------------------------------------------------------------
    // fichas, plano semanal, treinos e cargas
    // ---------------------------------------------------------------
    function ficha(nome, grupos, exs, ordem) {
      const f = { id: id(), nome, grupos, obs: "", ordem };
      d.fichas.push(f);
      exs.forEach((e, k) => d.exercicios.push({ id: id(), fichaId: f.id, nome: e[0], grupo: e[1], series: e[2], repMin: e[3], repMax: e[4], descanso: e[7] || "90s", obs: "", ordem: k + 1, _base: e[5], _inc: e[6] }));
      return f;
    }
    const fA = ficha("Treino A — Peito + Tríceps", ["Peito", "Tríceps"], [
      ["Supino reto", "Peito", 4, 8, 12, 60, 1.6], ["Supino inclinado", "Peito", 4, 8, 12, 50, 1.2], ["Crucifixo", "Peito", 3, 10, 15, 14, 0.5, "60s"], ["Tríceps pulley", "Tríceps", 3, 10, 15, 25, 1, "60s"]], 1);
    const fB = ficha("Treino B — Costas + Bíceps", ["Costas", "Bíceps"], [
      ["Puxada frontal", "Costas", 4, 8, 12, 55, 1.5], ["Remada curvada", "Costas", 4, 8, 12, 50, 1.2], ["Remada baixa", "Costas", 3, 10, 12, 45, 1], ["Rosca direta", "Bíceps", 3, 10, 12, 20, 0.5, "60s"], ["Rosca martelo", "Bíceps", 3, 10, 12, 12, 0.5, "60s"]], 2);
    const fC = ficha("Treino C — Pernas", ["Pernas", "Glúteos"], [
      ["Agachamento livre", "Pernas", 4, 6, 10, 80, 2.5, "120s"], ["Leg press", "Pernas", 4, 10, 12, 140, 5], ["Cadeira extensora", "Pernas", 3, 12, 15, 45, 1, "60s"], ["Mesa flexora", "Pernas", 3, 10, 12, 35, 1, "60s"], ["Panturrilha em pé", "Pernas", 4, 12, 15, 60, 2, "45s"]], 3);
    const fD = ficha("Treino D — Ombros + Abdômen", ["Ombros", "Abdômen"], [
      ["Desenvolvimento com halteres", "Ombros", 4, 8, 10, 18, 0.5], ["Elevação lateral", "Ombros", 3, 12, 15, 8, 0.25, "60s"], ["Face pull", "Ombros", 3, 12, 15, 20, 1, "60s"], ["Abdominal na polia", "Abdômen", 3, 12, 15, 30, 1, "60s"]], 4);
    const plano = [[1, fA, "18:00"], [2, fB, "18:00"], [4, fC, "18:00"], [5, fD, "18:00"]];
    plano.forEach((p) => d.planoSemanal.push({ id: id(), usuarioId: eu, diaSemana: p[0], tipo: "treino", fichaId: p[1].id, treino: p[1].nome, grupos: p[1].grupos.slice(), horario: p[2], obs: "" }));
    d.planoSemanal.push({ id: id(), usuarioId: eu, diaSemana: 6, tipo: "treino", fichaId: null, treino: "Cardio (bike)", grupos: ["Cardio"], horario: "09:00", obs: "" });
    [3, 7].forEach((dia) => d.planoSemanal.push({ id: id(), usuarioId: eu, diaSemana: dia, tipo: "descanso", fichaId: null, treino: "Descanso", grupos: [], horario: "", obs: "" }));

    const inicio = H(-41);
    // algumas faltas nas primeiras semanas (frequência realista); as últimas semanas estão em dia
    const falta = (semana, dia) => (semana === 1 && dia === 2) || (semana === 3 && dia === 4) ? "Planejado" : (semana === 2 && dia === 5) ? "Cancelado" : null;
    N.intervalo(inicio, H(-1)).forEach((data) => {
      const dia = N.diaSemana(data);
      const semana = Math.floor(N.diasEntre(inicio, data) / 7);
      const p = plano.find((x) => x[0] === dia);
      if (dia === 6) {
        d.treinos.push({ id: id(), usuarioId: eu, fichaId: null, nome: "Cardio (bike)", data, grupos: ["Cardio"], status: falta(semana, dia) || "Realizado", duracao: 40, obs: "" });
        return;
      }
      if (!p) return;
      const f = p[1];
      const status = falta(semana, dia) || "Realizado";
      const t = { id: id(), usuarioId: eu, fichaId: f.id, nome: f.nome, data, grupos: f.grupos.slice(), status, duracao: status === "Realizado" ? 55 + Math.round(rnd() * 20) : 0, obs: "" };
      d.treinos.push(t);
      if (status !== "Realizado") return;
      d.exercicios.filter((e) => e.fichaId === f.id).forEach((e, k) => {
        const carga = Math.round((e._base + e._inc * semana) * 2) / 2;
        d.series.push({ id: id(), treinoId: t.id, exercicioId: e.id, exercicio: e.nome, grupo: e.grupo, ordem: k + 1, series: e.series, repeticoes: e.repMax - (semana % 3),
          carga, rpe: [7.5, 8, 8, 8.5, 9][Math.floor(rnd() * 5)], descanso: e.descanso, status: "Feito", obs: "" });
      });
    });
    d.exercicios.forEach((e) => { delete e._base; delete e._inc; });

    // ---------------------------------------------------------------
    // peso e medidas
    // ---------------------------------------------------------------
    const pesos = [[-84, 82.5], [-80, 82.3], [-77, 82.4], [-73, 82.0], [-70, 81.9], [-66, 81.7], [-63, 81.8], [-59, 81.4], [-56, 81.3], [-52, 81.2], [-49, 81.0],
      [-45, 81.1], [-42, 80.8], [-38, 80.9], [-35, 80.6], [-31, 80.7], [-28, 80.5], [-24, 80.6], [-21, 80.4], [-17, 80.5], [-14, 80.3], [-10, 80.4], [-7, 80.2], [-3, 80.2], [-1, 80.1]];
    pesos.forEach((p) => d.pesagens.push({ id: id(), usuarioId: eu, data: H(p[0]), peso: p[1], altura: null, obs: p[0] % 2 ? "em jejum" : "" }));
    const med = [
      [-84, 31.8, 24.0, 52.0, 39.0, 101.0, 92.0, 95.0, 100.0, 34.0, 33.8, 58.0, 57.8],
      [-56, 32.1, 23.1, 52.6, 38.8, 101.5, 90.8, 93.6, 99.5, 34.4, 34.1, 58.4, 58.1],
      [-28, 32.4, 22.0, 53.3, 38.7, 102.0, 89.6, 92.2, 99.0, 34.8, 34.6, 58.7, 58.5],
      [-2, 32.6, 21.0, 54.0, 38.5, 102.5, 88.5, 91.0, 98.5, 35.2, 35.0, 59.0, 58.8]
    ];
    med.forEach((m) => d.medidas.push({ id: id(), usuarioId: eu, data: H(m[0]), massaMuscular: m[1], gorduraPct: m[2], massaGordura: null, aguaPct: m[3],
      pescoco: m[4], peito: m[5], cintura: m[6], abdomen: m[7], quadril: m[8], bracoD: m[9], bracoE: m[10], coxaD: m[11], coxaE: m[12], obs: "bioimpedância" }));

    // ---------------------------------------------------------------
    // metas
    // ---------------------------------------------------------------
    function meta(tipo, alvo, prazo, inicial, titulo) {
      d.metas.push({ id: id(), tipo, titulo: titulo || "", valorInicial: inicial == null ? null : inicial, valorAlvo: alvo, prazo: prazo || null, dataInicio: H(-84), criadoEm: new Date(Date.now() - 84 * 86400000).toISOString(), ativa: true, obs: "" });
    }
    meta("peso", 75, H(71), 82.5, "Chegar a 75 kg");
    meta("massaMuscular", 34, H(120), 31.8);
    meta("gordura", 18, H(120), 24);
    meta("cintura", 84, H(120), 92);
    meta("treinosSemana", 4);
    meta("calorias", 2200);
    meta("proteina", 170);
    meta("carboidratos", 230);
    meta("gorduras", 70);
    meta("fibras", 30);
    meta("agua", 3000);
    meta("gastos", 1100);
    return d;
  }

  global.Demo = { gerar };
})(window);
