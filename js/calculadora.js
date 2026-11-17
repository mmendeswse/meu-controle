/**
 * calculadora.js
 * -----------------------------------------------------------------------
 * Calculadora de metas: a partir de sexo, idade, altura, peso, nível de
 * atividade e objetivo, estima o gasto diário de energia (fórmula de
 * Mifflin-St Jeor) e sugere metas de calorias, proteína, água,
 * carboidratos e gorduras — criando ou atualizando as metas escolhidas.
 *
 * É uma estimativa para dar um ponto de partida; o próprio formulário
 * avisa que um profissional ajusta para cada caso. Não aparece no perfil
 * "Criança ou adolescente".
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo, UI = global.UI, F = global.Fitness, M = global.Metas;
  const esc = UI.esc;
  const App = () => global.App;

  const ATIVIDADES = [
    { k: "sedentario", r: "Sedentário", s: "trabalho sentado, sem exercício", f: 1.2 },
    { k: "leve", r: "Leve", s: "exercício 1 a 3 vezes por semana", f: 1.375 },
    { k: "moderado", r: "Moderado", s: "exercício 3 a 5 vezes por semana", f: 1.55 },
    { k: "intenso", r: "Intenso", s: "exercício 6 a 7 vezes por semana", f: 1.725 },
    { k: "muito", r: "Muito intenso", s: "treino pesado diário ou trabalho braçal", f: 1.9 }
  ];
  const OBJETIVOS = [
    { k: "perder", r: "Emagrecer", ajuste: { leve: -0.10, moderado: -0.20 }, prot: 2.0 },
    { k: "manter", r: "Manter o peso", ajuste: { leve: 0, moderado: 0 }, prot: 1.6 },
    { k: "ganhar", r: "Ganhar massa", ajuste: { leve: 0.05, moderado: 0.12 }, prot: 1.8 }
  ];
  const PISO = { f: 1200, m: 1500 };

  function calcular(e) {
    if (!e.sexo || !e.idade || !e.altura || !e.peso) return null;
    const cm = e.altura * 100;
    const tmb = 10 * e.peso + 6.25 * cm - 5 * e.idade + (e.sexo === "m" ? 5 : -161);
    const at = ATIVIDADES.find((x) => x.k === e.atividade) || ATIVIDADES[1];
    const ob = OBJETIVOS.find((x) => x.k === e.objetivo) || OBJETIVOS[1];
    const gasto = tmb * at.f;
    let kcal = gasto * (1 + (ob.ajuste[e.ritmo] != null ? ob.ajuste[e.ritmo] : 0));
    const piso = PISO[e.sexo], noPiso = kcal < piso;
    if (noPiso) kcal = piso;
    kcal = Math.round(kcal / 10) * 10;
    const proteina = Math.round((ob.prot * e.peso) / 5) * 5;
    const gordura = Math.round((0.9 * e.peso) / 5) * 5;
    const carbo = Math.max(0, Math.round(((kcal - proteina * 4 - gordura * 9) / 4) / 5) * 5);
    const agua = Math.round((35 * e.peso) / 100) * 100;
    return { tmb: Math.round(tmb), gasto: Math.round(gasto), kcal, proteina, gordura, carbo, agua, noPiso, dif: Math.round(kcal - gasto) };
  }

  function objetivoInicial(u) {
    const o = String(u.objetivo || "");
    return /emagre/i.test(o) ? "perder" : /massa/i.test(o) ? "ganhar" : "manter";
  }

  function abrir() {
    const d = App().dados(), u = d.usuarios[0];
    if (d.config.perfilUso === "crianca") { UI.toast("A calculadora não está disponível no perfil Criança ou adolescente."); return; }
    const pesoAtual = F.atual(d, "peso");
    const e = {
      sexo: u.sexo || "", idade: u.anoNascimento ? new Date().getFullYear() - u.anoNascimento : null,
      altura: u.altura || null, peso: pesoAtual ? pesoAtual.valor : (u.pesoInicial || null),
      atividade: u.atividade || "leve", objetivo: objetivoInicial(u), ritmo: "leve"
    };
    const seg = global.Personalizar.seg;
    const m = UI.abrirModal(`<div id="calcRaiz"><h3>Calculadora de metas</h3>
      <p class="ajuda" style="margin-top:0">Estima quanto você gasta por dia e sugere metas de calorias, proteína e água para o seu objetivo.</p>
      <div class="campo"><label>Sexo <span class="dim">(entra na fórmula)</span></label><div id="calcSexo"></div></div>
      <div class="par3">
        <div class="campo"><label for="c_idade">Idade</label><input id="c_idade" type="number" inputmode="numeric" min="14" max="100" value="${e.idade || ""}" placeholder="anos"></div>
        <div class="campo"><label for="c_alt">Altura (m)</label><input id="c_alt" type="number" inputmode="decimal" step="0.01" min="1" max="2.5" value="${e.altura || ""}" placeholder="1,70"></div>
        <div class="campo"><label for="c_peso">Peso (kg)</label><input id="c_peso" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${e.peso || ""}"></div>
      </div>
      <div class="campo"><label for="c_ativ">Nível de atividade</label><select id="c_ativ">${UI.opcoes(ATIVIDADES.map((a) => ({ v: a.k, r: a.r + " — " + a.s })), e.atividade)}</select></div>
      <div class="campo"><label>Objetivo</label><div id="calcObj"></div></div>
      <div class="campo" id="calcRitmoCampo"><label>Ritmo</label><div id="calcRitmo"></div></div>
      <div id="calcResultado" class="calc-res"></div>
      <div class="modal-acoes"><button class="btn primario salvar" id="btnCalcSalvar" disabled>Criar metas</button><button class="btn" data-acao="fechar-modal">Cancelar</button></div></div>`, { largo: true, semFoco: true });
    m.classList.add("modal-calc");
    const raiz = m.querySelector("#calcRaiz"); // os ouvintes ficam no conteúdo, que some ao fechar
    const marcados = { calorias: true, proteina: true, agua: true, carboidratos: false, gorduras: false };

    function ler() {
      e.idade = UI.numero("c_idade"); e.altura = UI.numero("c_alt"); e.peso = UI.numero("c_peso"); e.atividade = UI.valor("c_ativ");
      // altura digitada em centímetros (175) vira metros
      if (e.altura && e.altura > 3) e.altura = e.altura / 100;
    }
    function desenhar() {
      m.querySelector("#calcSexo").innerHTML = seg("calc-sexo", [{ k: "f", r: "Feminino" }, { k: "m", r: "Masculino" }], e.sexo);
      m.querySelector("#calcObj").innerHTML = seg("calc-obj", OBJETIVOS.map((o) => ({ k: o.k, r: o.r })), e.objetivo);
      m.querySelector("#calcRitmoCampo").hidden = e.objetivo === "manter";
      m.querySelector("#calcRitmo").innerHTML = seg("calc-ritmo", e.objetivo === "perder" ? [{ k: "leve", r: "Devagar (−10%)" }, { k: "moderado", r: "Moderado (−20%)" }] : [{ k: "leve", r: "Devagar (+5%)" }, { k: "moderado", r: "Moderado (+12%)" }], e.ritmo);
      resultado();
    }
    function resultado() {
      const r = calcular(e), cx = m.querySelector("#calcResultado"), b = m.querySelector("#btnCalcSalvar");
      const valido = r && e.idade >= 14 && e.idade <= 100 && e.altura >= 1 && e.altura <= 2.5 && e.peso >= 30 && e.peso <= 300;
      b.disabled = !valido;
      if (!valido) { cx.innerHTML = `<p class="ajuda">Preencha sexo, idade, altura e peso para ver a sugestão.</p>`; return; }
      const linhas = [
        ["calorias", "🔥 Calorias", UI.numAuto(r.kcal, 0) + " kcal", Math.abs(r.dif) >= 15 ? (r.dif > 0 ? "+" : "−") + UI.numAuto(Math.abs(r.dif), 0) + " kcal em relação ao que você gasta" : "igual ao que você gasta"],
        ["proteina", "🥩 Proteína", r.proteina + " g", UI.num(r.proteina / e.peso, 1) + " g por kg de peso"],
        ["agua", "💧 Água", UI.num(r.agua / 1000, 1) + " L", "35 ml por kg de peso"],
        ["carboidratos", "🍚 Carboidratos", r.carbo + " g", "o restante das calorias"],
        ["gorduras", "🥑 Gorduras", r.gordura + " g", "0,9 g por kg de peso"]
      ];
      cx.innerHTML = `<div class="calc-base"><div><small>Em repouso (TMB)</small><b>${UI.numAuto(r.tmb, 0)} kcal</b></div><div><small>Gasto por dia</small><b>${UI.numAuto(r.gasto, 0)} kcal</b></div></div>
        <div class="sechead">METAS SUGERIDAS — marque as que quer criar</div>
        <ul class="calc-metas">${linhas.map((l) => { const ex = M.metaDoTipo(d, l[0]); return `<li><label><input type="checkbox" data-calc="${l[0]}"${marcados[l[0]] ? " checked" : ""}><span class="cm-txt"><b>${l[1]}</b><small>${esc(l[3])}${ex ? " · hoje: " + M.fmt(l[0], ex.valorAlvo) : ""}</small></span><span class="cm-val">${l[2]}</span></label></li>`; }).join("")}</ul>
        ${r.noPiso ? `<p class="ajuda aviso-calc">⚠️ A conta daria menos que ${PISO[e.sexo]} kcal. Mantive esse mínimo: abaixo disso, só com acompanhamento profissional.</p>` : ""}
        <p class="ajuda">É uma estimativa (fórmula de Mifflin-St Jeor). Gestantes, lactantes, menores de 18 e quem tem alguma condição de saúde devem definir as metas com um profissional.</p>`;
      b.textContent = "Criar metas";
    }
    raiz.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-acao^='calc-']");
      if (!b) return;
      ev.stopPropagation();
      ler();
      if (b.dataset.acao === "calc-sexo") e.sexo = b.dataset.k;
      if (b.dataset.acao === "calc-obj") e.objetivo = b.dataset.k;
      if (b.dataset.acao === "calc-ritmo") e.ritmo = b.dataset.k;
      desenhar();
    });
    raiz.addEventListener("input", (ev) => { if (ev.target.matches("#c_idade, #c_alt, #c_peso")) { ler(); resultado(); } });
    raiz.addEventListener("change", (ev) => {
      if (ev.target.dataset.calc) { marcados[ev.target.dataset.calc] = ev.target.checked; return; }
      if (ev.target.id === "c_ativ") { ler(); resultado(); }
    });
    m.querySelector("#btnCalcSalvar").onclick = () => {
      ler();
      const r = calcular(e);
      if (!r) return;
      const valores = { calorias: r.kcal, proteina: r.proteina, agua: r.agua, carboidratos: r.carbo, gorduras: r.gordura };
      const escolhidas = Object.keys(marcados).filter((k) => marcados[k]);
      if (!escolhidas.length) { UI.toast("Marque pelo menos uma meta."); return; }
      App().comDesfazer(`${escolhidas.length} ${UI.plural(escolhidas.length, "meta definida", "metas definidas")} pela calculadora.`, () => {
        escolhidas.forEach((tipo) => {
          const ex = M.metaDoTipo(d, tipo);
          if (ex) ex.valorAlvo = valores[tipo];
          else d.metas.push({ id: N.novoId(), tipo, titulo: "", valorAlvo: valores[tipo], prazo: null, obs: "Sugerida pela calculadora", dataInicio: N.hoje(0), criadoEm: new Date().toISOString(), ativa: true });
        });
        Object.assign(u, { sexo: e.sexo, anoNascimento: new Date().getFullYear() - e.idade, atividade: e.atividade });
        if (!u.altura) u.altura = N.arred(e.altura, 2);
      });
      UI.fecharModal();
    };
    desenhar();
  }

  App().registrarAcoes({ "calc-metas": abrir });
  global.Calculadora = { abrir, calcular, ATIVIDADES, OBJETIVOS };
})(window);
