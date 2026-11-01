/**
 * formularios-saude.js
 * -----------------------------------------------------------------------
 * Formulários de bem-estar: check-in (sono, humor, energia, estresse,
 * passos), hábitos e desafios, remédios e doses, e jejum.
 * Mesma regra dos outros formulários: lê, valida, altera App.dados() e
 * chama App.salvar(). Nada é obrigatório além do mínimo.
 * -----------------------------------------------------------------------
 */
(function () {
  "use strict";

  const N = window.Nucleo, UI = window.UI, BE = window.BemEstar, App = window.App;
  const esc = UI.esc;
  const D = () => App.dados();
  const salvar = (msg, o) => App.salvar(msg, Object.assign({ semIntegracao: true }, o || {}));
  const uid = () => D().usuarios[0].id;
  const DIAS = [1, 2, 3, 4, 5, 6, 7];

  function vibrar() {
    const ap = D().config.aparencia || {};
    if (ap.vibrar !== false && navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* sem suporte */ } }
  }

  // escala de emojis (1 a 5) — toque de novo para desmarcar
  function escala(id, lista, atual) {
    return `<div class="escala" id="${id}" role="radiogroup">${lista.map((x) => `<button type="button" role="radio" aria-checked="${Number(atual) === x.v}" class="${Number(atual) === x.v ? "ativo" : ""}" data-v="${x.v}" title="${esc(x.r)}"><span>${x.e}</span><small>${esc(x.r)}</small></button>`).join("")}</div>`;
  }
  function ligarEscalas(m) {
    m.querySelectorAll(".escala").forEach((g) => g.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-v]");
      if (!b) return;
      const era = b.classList.contains("ativo");
      g.querySelectorAll("button").forEach((x) => { x.classList.remove("ativo"); x.setAttribute("aria-checked", "false"); });
      if (!era) { b.classList.add("ativo"); b.setAttribute("aria-checked", "true"); }
    }));
  }
  function lerEscala(m, id) { const b = m.querySelector(`#${id} .ativo`); return b ? Number(b.dataset.v) : null; }
  function diasChips(id, sel) {
    return `<div class="chips dias-chips" id="${id}">${DIAS.map((x) => `<label class="chip"><input type="checkbox" value="${x}"${(sel || DIAS).indexOf(x) !== -1 ? " checked" : ""}><span>${N.DIA_CURTO[x]}</span></label>`).join("")}</div>`;
  }
  function lerDias(id) { return UI.chips(id).map(Number); }
  function coresChips(atual) {
    return `<div class="ap-cores pequenas" id="f_cor">${BE.CORES_HABITO.map((c) => `<button type="button" class="ap-cor${atual === c ? " ativo" : ""}" data-c="${c}" style="--c:${c}" aria-label="Cor"></button>`).join("")}</div>`;
  }
  function ligarCores(m) {
    const g = m.querySelector("#f_cor");
    if (g) g.addEventListener("click", (e) => { const b = e.target.closest("[data-c]"); if (!b) return; g.querySelectorAll(".ativo").forEach((x) => x.classList.remove("ativo")); b.classList.add("ativo"); });
  }
  function lerCor(m) { const b = m.querySelector("#f_cor .ativo"); return b ? b.dataset.c : null; }

  // =====================================================================
  // CHECK-IN
  // =====================================================================
  const SINTOMAS = ["Dor de cabeça", "Dor muscular", "Cólica", "Gripe ou resfriado", "Alergia", "Enjoo", "Azia", "Ansiedade", "Insônia", "Cansaço", "Inchaço", "Menstruação"];
  function checkin(data, foco) {
    const d = D();
    data = data || N.hoje(0);
    const r = BE.checkin(d, data) || {};
    const h = BE.horasSono(r);
    const m = UI.abrirModal(`
      <h3>Check-in</h3>
      <div class="campo"><label for="f_data">Dia</label><input id="f_data" type="date" value="${esc(data)}" max="${N.hoje(0)}"></div>
      <div class="ck-bloco" id="ck-sono"><div class="ck-tit">😴 Sono da noite</div>
        <div class="par3">
          <div class="campo"><label for="f_dormiu">Dormi às</label><input id="f_dormiu" type="time" value="${esc(r.dormiu || "")}"></div>
          <div class="campo"><label for="f_acordou">Acordei às</label><input id="f_acordou" type="time" value="${esc(r.acordou || "")}"></div>
          <div class="campo"><label for="f_horas">Horas ${UI.dica("Calculado pelos horários. Se preferir, digite direto.")}</label><input id="f_horas" type="number" step="0.25" min="0" max="24" value="${N.temValor(r.sonoHoras) ? r.sonoHoras : ""}" placeholder="${h != null ? String(N.arred(h, 2)).replace(".", ",") : "7,5"}"></div>
        </div>
        <span class="ck-rot">Qualidade</span>${escala("f_qual", BE.QUALIDADE, r.sonoQualidade)}
      </div>
      <div class="ck-bloco" id="ck-humor"><div class="ck-tit">🙂 Como você está</div>
        <span class="ck-rot">Humor</span>${escala("f_humor", BE.HUMOR, r.humor)}
        <span class="ck-rot">Energia</span>${escala("f_energia", BE.ENERGIA, r.energia)}
        <span class="ck-rot">Estresse</span>${escala("f_estresse", BE.ESTRESSE, r.estresse)}
      </div>
      <div class="ck-bloco" id="ck-passos"><div class="ck-tit">👟 Atividade</div>
        <div class="par">
          <div class="campo"><label for="f_passos">Passos ${UI.dica("Copie do app de saúde do celular ou do relógio.")}</label><input id="f_passos" type="number" min="0" step="100" inputmode="numeric" value="${N.temValor(r.passos) ? r.passos : ""}" placeholder="ex.: 8000"></div>
          <div class="campo"><label for="f_ativos">Minutos ativos</label><input id="f_ativos" type="number" min="0" step="5" inputmode="numeric" value="${N.temValor(r.minutosAtivos) ? r.minutosAtivos : ""}" placeholder="ex.: 30"></div>
        </div>
      </div>
      <div class="ck-bloco"><div class="ck-tit">🩹 Sintomas <small class="dim">opcional</small></div>${UI.campoChips("f_sint", SINTOMAS, r.sintomas || [])}
        <div class="campo"><label for="f_obs">Anotações</label><input id="f_obs" value="${esc(r.obs || "")}" placeholder="como foi o dia, o que pode ter influenciado…"></div></div>
      ${UI.botoesModal(!!r.id)}`, { largo: true, semFoco: true });
    ligarEscalas(m);
    m.querySelector("#f_data").addEventListener("change", (e) => { if (e.target.value) checkin(e.target.value, foco); });
    const atualizaHoras = () => {
      const hh = BE.horasEntre(UI.valor("f_dormiu"), UI.valor("f_acordou"));
      m.querySelector("#f_horas").placeholder = hh != null ? String(N.arred(hh, 2)).replace(".", ",") : "7,5";
    };
    m.querySelector("#f_dormiu").addEventListener("change", atualizaHoras);
    m.querySelector("#f_acordou").addEventListener("change", atualizaHoras);
    if (foco) { const el = m.querySelector("#ck-" + foco); if (el) setTimeout(() => el.scrollIntoView({ block: "start", behavior: "smooth" }), 60); }
    m.querySelector("#btnSalvar").onclick = () => {
      const reg = {
        dormiu: UI.valor("f_dormiu") || null, acordou: UI.valor("f_acordou") || null, sonoHoras: UI.numero("f_horas"),
        sonoQualidade: lerEscala(m, "f_qual"), humor: lerEscala(m, "f_humor"), energia: lerEscala(m, "f_energia"), estresse: lerEscala(m, "f_estresse"),
        passos: UI.numero("f_passos"), minutosAtivos: UI.numero("f_ativos"), sintomas: UI.chips("f_sint"), obs: UI.texto("f_obs")
      };
      if (reg.sonoHoras != null && (reg.sonoHoras < 0 || reg.sonoHoras > 24)) { UI.toast("Horas de sono entre 0 e 24."); return; }
      const vazio = Object.keys(reg).every((k) => reg[k] == null || reg[k] === "" || (Array.isArray(reg[k]) && !reg[k].length));
      const atual = BE.checkin(d, data);
      if (vazio) { if (atual) d.bemEstar = d.bemEstar.filter((x) => x !== atual); UI.fecharModal(); salvar(atual ? "Check-in apagado." : null); return; }
      if (atual) Object.assign(atual, reg);
      else d.bemEstar.push(Object.assign({ id: N.novoId(), usuarioId: uid(), data }, reg));
      UI.fecharModal();
      vibrar();
      salvar("Check-in salvo.");
    };
    if (r.id) m.querySelector("#btnExcluir").onclick = () => UI.confirmar({ titulo: "Apagar check-in", texto: `Apagar o check-in de ${UI.dataLonga(data)}?`, rotulo: "Apagar",
      aoConfirmar: () => App.comDesfazer("Check-in apagado.", () => { d.bemEstar = d.bemEstar.filter((x) => x.id !== r.id); }) });
  }

  // =====================================================================
  // HÁBITOS
  // =====================================================================
  const EMOJIS_HABITO = ["✅", "💧", "🚶", "🏃", "🧘", "📖", "🍎", "🥗", "😴", "🦷", "💊", "🧴", "🙏", "✍️", "🎸", "📵", "🍬", "🚭", "🍷", "☀️", "🌙", "🧹", "🐶", "💰"];
  function habito(id, modelo) {
    const d = D();
    const h = id ? BE.habito(d, id) : null;
    const ini = h || Object.assign({ nome: "", emoji: "✅", tipo: "sim", meta: null, unidade: "", dias: DIAS.slice(), horario: "", cor: BE.CORES_HABITO[3], duracao: null, inicio: N.hoje(0) }, modelo || {});
    const m = UI.abrirModal(`
      <h3>${h ? "Editar hábito" : modelo ? "Novo desafio" : "Novo hábito"}</h3>
      <div class="par">
        <div class="campo"><label for="f_nome">Nome</label><input id="f_nome" value="${esc(ini.nome)}" placeholder="ex.: Ler antes de dormir"></div>
        <div class="campo"><label for="f_emoji">Ícone</label><input id="f_emoji" value="${esc(ini.emoji || "")}" maxlength="4" class="campo-emoji"></div>
      </div>
      <div class="emoji-sugestoes" id="f_emojis">${EMOJIS_HABITO.map((e) => `<button type="button" data-e="${e}">${e}</button>`).join("")}</div>
      ${BE.automatico(ini) ? `<p class="ajuda">${ini.agua ? "💧 Este hábito conta sozinho pela água registrada no dia." : "👟 Este hábito conta sozinho pelos passos do check-in."}</p>` : `
      <div class="campo"><label>Tipo</label>${window.Personalizar.seg("f-tipo-habito", [{ k: "sim", r: "Feito / não feito" }, { k: "quantidade", r: "Quantidade com meta" }], ini.tipo)}</div>`}
      <div class="par" id="f_qtd"${ini.tipo === "quantidade" ? "" : " hidden"}>
        <div class="campo"><label for="f_meta">Meta por dia</label><input id="f_meta" type="number" min="0" step="any" value="${N.temValor(ini.meta) ? ini.meta : ""}" placeholder="ex.: 10"></div>
        <div class="campo"><label for="f_un">Unidade</label><input id="f_un" value="${esc(ini.unidade || "")}" placeholder="páginas, min, copos…"${BE.automatico(ini) ? " readonly" : ""}></div>
      </div>
      <div class="campo"><label>Dias da semana</label>${diasChips("f_dias", ini.dias)}</div>
      <div class="par">
        <div class="campo"><label for="f_hora">Horário ${UI.dica("Opcional. Com horário, aparece em ordem no roteiro do dia e pode virar lembrete.")}</label><input id="f_hora" type="time" value="${esc(ini.horario || "")}"></div>
        <div class="campo"><label>Cor</label>${coresChips(ini.cor)}</div>
      </div>
      <div class="ck-bloco"><div class="ck-tit">🏆 Desafio <small class="dim">opcional</small></div>
        <div class="par">
          <div class="campo"><label for="f_dur">Duração (dias) ${UI.dica("Com duração, vira um desafio: mostra o dia atual, o progresso e termina sozinho.")}</label><input id="f_dur" type="number" min="1" max="366" value="${N.temValor(ini.duracao) ? ini.duracao : ""}" placeholder="sem fim"></div>
          <div class="campo"><label for="f_ini">Começa em</label><input id="f_ini" type="date" value="${esc(ini.inicio || N.hoje(0))}"></div>
        </div>
      </div>
      <div class="campo"><label for="f_obs">Por que este hábito? <small class="dim">opcional</small></label><input id="f_obs" value="${esc(ini.obs || "")}" placeholder="sua motivação aparece no cartão do hábito"></div>
      ${UI.botoesModal(!!h)}`, { largo: true });
    let tipo = ini.tipo;
    m.querySelectorAll("[data-acao='f-tipo-habito']").forEach((b) => { b.removeAttribute("data-acao"); b.addEventListener("click", () => {
      tipo = b.dataset.k;
      m.querySelectorAll(".seg-opcoes button").forEach((x) => { x.classList.toggle("ativo", x === b); x.setAttribute("aria-checked", x === b); });
      m.querySelector("#f_qtd").hidden = tipo !== "quantidade";
    }); });
    m.querySelector("#f_emojis").addEventListener("click", (e) => { const b = e.target.closest("[data-e]"); if (b) m.querySelector("#f_emoji").value = b.dataset.e; });
    ligarCores(m);
    m.querySelector("#btnSalvar").onclick = () => {
      const nome = UI.texto("f_nome");
      if (!nome) { UI.toast("Dê um nome ao hábito."); return; }
      const dias = lerDias("f_dias");
      if (!dias.length) { UI.toast("Escolha pelo menos um dia da semana."); return; }
      const meta = UI.numero("f_meta");
      if (tipo === "quantidade" && !(meta > 0)) { UI.toast("Informe a meta por dia."); return; }
      const reg = { nome, emoji: UI.texto("f_emoji") || "✅", tipo, meta: tipo === "quantidade" ? meta : null, unidade: tipo === "quantidade" ? UI.texto("f_un") : "",
        dias, horario: UI.valor("f_hora") || "", cor: lerCor(m) || ini.cor, duracao: UI.numero("f_dur"), inicio: UI.valor("f_ini") || N.hoje(0), obs: UI.texto("f_obs") };
      if (h) Object.assign(h, reg);
      else d.habitos.push(Object.assign({ id: N.novoId(), usuarioId: uid(), ativo: true, criadoEm: new Date().toISOString(), ordem: d.habitos.length, agua: !!ini.agua, passos: !!ini.passos }, reg));
      UI.fecharModal();
      salvar(h ? "Hábito atualizado." : reg.duracao ? `Desafio “${nome}” começou!` : `Hábito “${nome}” criado.`);
    };
    if (h) m.querySelector("#btnExcluir").onclick = () => UI.confirmar({ titulo: "Excluir hábito", html: `Excluir <b>${esc(h.nome)}</b> e todas as marcações? Se quiser só parar por um tempo, use <b>Pausar</b> no cartão do hábito.`, rotulo: "Excluir",
      aoConfirmar: () => App.comDesfazer("Hábito excluído.", () => { d.habitos = d.habitos.filter((x) => x.id !== h.id); d.habitoRegistros = d.habitoRegistros.filter((x) => x.habitoId !== h.id); }) });
  }
  function modelos() {
    UI.abrirModal(`<h3>Desafios prontos</h3><p class="ajuda" style="margin-top:0">Escolha um para começar hoje — dá para ajustar tudo antes de salvar.</p>
      <div class="modelos-grade">${BE.MODELOS.map((x, i) => `<button class="modelo-card" data-acao="habito-modelo" data-i="${i}" style="--c:${x.cor}"><span class="mc-ic">${x.emoji}</span><span><b>${esc(x.nome)}</b><small>${esc(x.desc)}</small></span><span class="mc-dur">${x.duracao} dias</span></button>`).join("")}</div>
      <div class="modal-acoes"><button class="btn" data-acao="novo-habito">Criar do zero</button><button class="btn" data-acao="fechar-modal">Fechar</button></div>`, { largo: true });
  }
  function definirValorHabito(h, data, valor) {
    const d = D();
    const r = BE.registro(d, h.id, data);
    if (!valor) { if (r) d.habitoRegistros = d.habitoRegistros.filter((x) => x !== r); }
    else if (r) r.valor = valor;
    else d.habitoRegistros.push({ id: N.novoId(), habitoId: h.id, data, valor });
  }
  function alternarHabito(id, data) {
    const d = D(), h = BE.habito(d, id);
    if (!h) return;
    data = data || N.hoje(0);
    if (BE.automatico(h)) { if (h.agua) window.Formularios.agua(data); else checkin(data, "passos"); return; }
    if (h.tipo === "quantidade") { quantidadeHabito(id, data); return; }
    const feito = BE.cumpridoNoDia(d, h, data);
    definirValorHabito(h, data, feito ? 0 : 1);
    vibrar();
    const ds = BE.desafio(d, h);
    salvar(feito ? null : ds && ds.estado === "concluido" ? `🏆 Desafio “${h.nome}” concluído!` : `${h.emoji || "✅"} ${h.nome} ✓`);
  }
  function quantidadeHabito(id, data) {
    const d = D(), h = BE.habito(d, id);
    if (!h) return;
    data = data || N.hoje(0);
    const meta = Number(h.meta) || 1;
    const passo = meta >= 1000 ? Math.round(meta / 10) : meta >= 20 ? 5 : 1;
    const desenhar = () => {
      const v = BE.valorNoDia(D(), h, data);
      return `<h3>${esc(h.emoji || "")} ${esc(h.nome)}</h3><p class="ajuda" style="margin-top:0">${UI.dataLonga(data)} · meta ${UI.numAuto(meta, 1)} ${esc(h.unidade || "")}</p>
        <div class="qtd-habito"><button class="btn" data-acao="habito-somar" data-id="${h.id}" data-data="${data}" data-v="${-passo}" aria-label="Menos">−</button>
          <div class="qh-valor"><b>${UI.numAuto(v, 1)}</b><small>de ${UI.numAuto(meta, 1)} ${esc(h.unidade || "")}</small></div>
          <button class="btn" data-acao="habito-somar" data-id="${h.id}" data-data="${data}" data-v="${passo}" aria-label="Mais">+</button></div>
        ${UI.barra(Math.min(100, (v / meta) * 100), v >= meta ? "var(--up)" : h.cor || "var(--cy)")}
        <div class="botoes-linha centro"><button class="btn" data-acao="habito-somar" data-id="${h.id}" data-data="${data}" data-v="${meta - v}" ${v >= meta ? "disabled" : ""}>Completar meta</button></div>
        <div class="par"><div class="campo"><label for="f_qv">Valor exato</label><input id="f_qv" type="number" min="0" step="any" value="${v || ""}"></div>
          <div class="campo"><label>&nbsp;</label><button class="btn primario" data-acao="habito-definir" data-id="${h.id}" data-data="${data}">Salvar valor</button></div></div>
        <div class="modal-acoes"><button class="btn salvar" data-acao="fechar-modal">Fechar</button></div>`;
    };
    UI.abrirModal(desenhar(), { semFoco: true });
    redesenharQtd = () => { if (UI.modalAberto() && document.querySelector("#modal .qtd-habito")) document.getElementById("modal").innerHTML = `<button class="modal-fechar" data-acao="fechar-modal" aria-label="Fechar">${UI.svg("fechar")}</button>` + desenhar(); };
  }
  let redesenharQtd = null;
  function pausarHabito(id) {
    const d = D(), h = BE.habito(d, id);
    if (!h) return;
    h.ativo = h.ativo === false;
    salvar(h.ativo ? `“${h.nome}” voltou para o seu dia.` : `“${h.nome}” pausado. Ele não aparece mais no roteiro.`);
  }

  // =====================================================================
  // REMÉDIOS
  // =====================================================================
  const INSTRUCOES = ["Indiferente", "Em jejum", "Antes de comer", "Com comida", "Depois de comer", "Antes de dormir"];
  function remedio(id) {
    const d = D();
    const r = id ? BE.remedio(d, id) : null;
    const ini = r || { nome: "", tipo: "Remédio", qtdDose: 1, unidadeDose: "comprimido", frequencia: "diario", dias: DIAS.slice(), intervaloDias: 2, horarios: ["08:00"], inicio: N.hoje(0), fim: null, estoque: null, estoqueMinimo: null, instrucao: "Indiferente", obs: "", cor: "#0A84FF" };
    const freq = [{ k: "diario", r: "Todo dia" }, { k: "dias", r: "Dias da semana" }, { k: "intervalo", r: "A cada X dias" }, { k: "sob-demanda", r: "Quando precisar" }];
    const m = UI.abrirModal(`
      <h3>${r ? "Editar remédio" : "Novo remédio ou suplemento"}</h3>
      <div class="par">
        <div class="campo"><label for="f_nome">Nome</label><input id="f_nome" value="${esc(ini.nome)}" placeholder="ex.: Vitamina D 2000 UI"></div>
        <div class="campo"><label for="f_tipo">Tipo</label><select id="f_tipo">${UI.opcoes(BE.TIPOS_REMEDIO, ini.tipo)}</select></div>
      </div>
      <div class="par3">
        <div class="campo"><label for="f_qd">Dose</label><input id="f_qd" type="number" min="0" step="any" value="${N.temValor(ini.qtdDose) ? ini.qtdDose : 1}"></div>
        <div class="campo"><label for="f_ud">Unidade</label><select id="f_ud">${UI.opcoes(BE.UNIDADES_DOSE, ini.unidadeDose)}</select></div>
        <div class="campo"><label for="f_instr">Como tomar</label><select id="f_instr">${UI.opcoes(INSTRUCOES, ini.instrucao)}</select></div>
      </div>
      <div class="campo"><label>Frequência</label>${window.Personalizar.seg("f-freq", freq, ini.frequencia)}</div>
      <div class="campo" id="f_bloco_dias"${ini.frequencia === "dias" ? "" : " hidden"}><label>Dias da semana</label>${diasChips("f_dias", ini.dias)}</div>
      <div class="campo" id="f_bloco_int"${ini.frequencia === "intervalo" ? "" : " hidden"}><label for="f_int">A cada quantos dias</label><input id="f_int" type="number" min="2" max="60" value="${ini.intervaloDias || 2}"></div>
      <div class="campo" id="f_bloco_horas"${ini.frequencia === "sob-demanda" ? " hidden" : ""}><label>Horários</label><div id="f_horas" class="horas-lista">${(ini.horarios || ["08:00"]).map((h) => campoHora(h)).join("")}</div>
        <button type="button" class="link-acao" id="f_add_hora">+ adicionar horário</button></div>
      <div class="par">
        <div class="campo"><label for="f_inicio">Início</label><input id="f_inicio" type="date" value="${esc(ini.inicio || N.hoje(0))}"></div>
        <div class="campo"><label for="f_fim">Até ${UI.dica("Opcional. Para tratamentos com prazo, como um antibiótico de 7 dias.")}</label><input id="f_fim" type="date" value="${esc(ini.fim || "")}"></div>
      </div>
      <div class="ck-bloco"><div class="ck-tit">📦 Estoque <small class="dim">opcional</small></div>
        <div class="par">
          <div class="campo"><label for="f_est">Tenho em casa</label><input id="f_est" type="number" min="0" step="any" value="${N.temValor(ini.estoque) ? ini.estoque : ""}" placeholder="ex.: 30"></div>
          <div class="campo"><label for="f_min">Avisar com ${UI.dica("Quando o estoque chegar aqui (ou faltar 5 dias), aparece um alerta e o botão para pôr na lista de compras.")}</label><input id="f_min" type="number" min="0" step="any" value="${N.temValor(ini.estoqueMinimo) ? ini.estoqueMinimo : ""}" placeholder="ex.: 5"></div>
        </div>
        <p class="ajuda">Cada dose marcada como tomada desconta do estoque.</p>
      </div>
      <div class="campo"><label for="f_obs">Para que serve / observações</label><input id="f_obs" value="${esc(ini.obs || "")}" placeholder="opcional — ex.: pressão, receita do Dr. Silva"></div>
      <p class="ajuda">⚕️ O app ajuda a lembrar e registrar. Siga sempre a orientação do médico ou farmacêutico.</p>
      ${UI.botoesModal(!!r)}`, { largo: true });
    let frequencia = ini.frequencia;
    m.querySelectorAll("[data-acao='f-freq']").forEach((b) => { b.removeAttribute("data-acao"); b.addEventListener("click", () => {
      frequencia = b.dataset.k;
      b.parentElement.querySelectorAll("button").forEach((x) => { x.classList.toggle("ativo", x === b); x.setAttribute("aria-checked", x === b); });
      m.querySelector("#f_bloco_dias").hidden = frequencia !== "dias";
      m.querySelector("#f_bloco_int").hidden = frequencia !== "intervalo";
      m.querySelector("#f_bloco_horas").hidden = frequencia === "sob-demanda";
    }); });
    m.querySelector("#f_add_hora").addEventListener("click", () => {
      const lista = m.querySelector("#f_horas");
      const ult = Array.from(lista.querySelectorAll("input")).map((i) => i.value).filter(Boolean).sort().pop();
      let nova = "20:00";
      if (ult) { const [hh, mm] = ult.split(":").map(Number); nova = String(Math.min(23, hh + 8)).padStart(2, "0") + ":" + String(mm).padStart(2, "0"); }
      lista.insertAdjacentHTML("beforeend", campoHora(nova));
    });
    m.querySelector("#f_horas").addEventListener("click", (e) => { const b = e.target.closest("[data-remover-hora]"); if (b && m.querySelectorAll("#f_horas .hora-item").length > 1) b.parentElement.remove(); });
    m.querySelector("#btnSalvar").onclick = () => {
      const nome = UI.texto("f_nome");
      if (!nome) { UI.toast("Informe o nome."); return; }
      const horarios = Array.from(m.querySelectorAll("#f_horas input")).map((i) => i.value).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).sort();
      if (frequencia !== "sob-demanda" && !horarios.length) { UI.toast("Informe pelo menos um horário."); return; }
      const dias = lerDias("f_dias");
      if (frequencia === "dias" && !dias.length) { UI.toast("Escolha os dias da semana."); return; }
      const qd = UI.numero("f_qd") || 1, ud = UI.valor("f_ud");
      const fim = UI.valor("f_fim") || null, inicio = UI.valor("f_inicio") || N.hoje(0);
      if (fim && fim < inicio) { UI.toast("A data final é antes do início."); return; }
      const reg = { nome, tipo: UI.valor("f_tipo"), qtdDose: qd, unidadeDose: ud, porDose: qd, dose: `${UI.numAuto(qd, 2)} ${BE.unidade(qd, ud)}`,
        frequencia, dias: frequencia === "dias" ? dias : DIAS.slice(), intervaloDias: UI.numero("f_int") || 2, horarios: frequencia === "sob-demanda" ? [] : horarios,
        inicio, fim, estoque: UI.numero("f_est"), estoqueMinimo: UI.numero("f_min"), instrucao: UI.valor("f_instr"), obs: UI.texto("f_obs") };
      if (r) Object.assign(r, reg);
      else d.remedios.push(Object.assign({ id: N.novoId(), usuarioId: uid(), ativo: true, criadoEm: new Date().toISOString() }, reg));
      UI.fecharModal();
      salvar(r ? "Remédio atualizado." : `${nome} cadastrado.`);
    };
    if (r) m.querySelector("#btnExcluir").onclick = () => UI.confirmar({ titulo: "Excluir remédio", html: `Excluir <b>${esc(r.nome)}</b> e o histórico de doses? Se o tratamento só acabou, edite e preencha a data <b>Até</b> — o histórico fica guardado.`, rotulo: "Excluir",
      aoConfirmar: () => App.comDesfazer("Remédio excluído.", () => { d.remedios = d.remedios.filter((x) => x.id !== r.id); d.doses = d.doses.filter((x) => x.remedioId !== r.id); }) });
  }
  function campoHora(h) {
    return `<span class="hora-item"><input type="time" value="${esc(h || "")}"><button type="button" class="btn fantasma pequeno" data-remover-hora aria-label="Remover horário">${UI.svg("fechar")}</button></span>`;
  }
  // marca/desmarca uma dose — mexe no estoque junto
  function definirDose(rid, data, horario, status, extra) {
    const d = D(), r = BE.remedio(d, rid);
    if (!r) return;
    let x = BE.dose(d, rid, data, horario);
    const antes = x ? x.status : "Pendente";
    if (status === "Pendente") { if (x) d.doses = d.doses.filter((y) => y !== x); }
    else if (x) { x.status = status; x.hora = N.horaAgora(); }
    else d.doses.push(x = { id: N.novoId(), remedioId: rid, data, horario, status, hora: N.horaAgora(), extra: !!extra });
    const porDose = Number(r.porDose) || 1;
    if (N.temValor(r.estoque)) {
      if (antes !== "Tomado" && status === "Tomado") r.estoque = Math.max(0, Number(r.estoque) - porDose);
      if (antes === "Tomado" && status !== "Tomado") r.estoque = Number(r.estoque) + porDose;
    }
    if (status === "Tomado") vibrar();
    const est = BE.estoque(r);
    salvar(status === "Tomado" ? `💊 ${r.nome} tomado${est && est.baixo ? ` · restam ${UI.numAuto(est.qtd, 1)}` : ""}.` : status === "Pulado" ? `${r.nome}: dose pulada.` : null);
  }
  function repor(rid) {
    const d = D(), r = BE.remedio(d, rid);
    if (!r) return;
    const m = UI.abrirModal(`<h3>Repor estoque — ${esc(r.nome)}</h3>
      <p class="ajuda" style="margin-top:0">Em casa agora: <b>${N.temValor(r.estoque) ? UI.numAuto(r.estoque, 1) + " " + esc(BE.unidade(r.estoque, r.unidadeDose || "")) : "não controlado"}</b></p>
      <div class="campo"><label for="f_qtd">Quantidade comprada</label><input id="f_qtd" type="number" min="0" step="any" placeholder="ex.: 30"></div>
      ${UI.botoesModal(false, "Somar ao estoque")}`);
    m.querySelector("#btnSalvar").onclick = () => {
      const q = UI.numero("f_qtd");
      if (!(q > 0)) { UI.toast("Informe a quantidade."); return; }
      r.estoque = (Number(r.estoque) || 0) + q;
      UI.fecharModal();
      salvar(`Estoque de ${r.nome}: ${UI.numAuto(r.estoque, 1)}.`);
    };
  }
  function paraListaDeCompras(rid) {
    const d = D(), r = BE.remedio(d, rid), C = window.Compras;
    if (!r) return;
    const mes = C.mesAtual ? C.mesAtual() : N.hoje(0).slice(0, 7);
    if (d.compras.some((c) => c.remedioId === r.id && c.status === "Pendente")) { UI.toast(`${r.nome} já está na lista de compras.`); return; }
    d.compras.push({ id: N.novoId(), usuarioId: uid(), alimentoId: null, remedioId: r.id, nome: r.nome, categoria: r.tipo === "Remédio" ? "Outros" : "Suplementos",
      quantidade: 1, unidade: "cx", precoEstimado: null, precoPago: null, mercado: "Farmácia", prioridade: "Alta", status: "Pendente",
      dataCompra: null, dataPrevista: null, origem: "manual", auto: false, motivo: "remédio acabando", criadoEm: N.hoje(0), mes, obs: "" });
    App.salvar(`${r.nome} adicionado à lista de compras (Farmácia).`);
  }

  // =====================================================================
  // JEJUM
  // =====================================================================
  function localDT(iso) { const x = new Date(iso); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); }
  function deLocalDT(v) { return v ? new Date(v).toISOString() : null; }
  function jejum() {
    const d = D(), at = BE.jejumAtivo(d);
    if (at) { editarJejum(at.id); return; }
    const padrao = Number(d.config.jejumPadrao) || 16;
    const m = UI.abrirModal(`<h3>Começar jejum</h3>
      <div class="campo"><label>Duração</label><div class="protocolos">${BE.PROTOCOLOS.map((p) => `<button type="button" class="protocolo${p.h === padrao ? " ativo" : ""}" data-h="${p.h}"><b>${p.r}</b><small>${p.s}</small></button>`).join("")}</div></div>
      <div class="par"><div class="campo"><label for="f_h">Ou horas</label><input id="f_h" type="number" min="1" max="72" step="0.5" value="${padrao}"></div>
        <div class="campo"><label for="f_ini">Começou em</label><input id="f_ini" type="datetime-local" value="${localDT(new Date().toISOString())}"></div></div>
      <p class="ajuda">Pode ajustar o início se esqueceu de marcar na hora da última refeição. Jejum não é indicado para todo mundo (gestantes, diabéticos, quem tem histórico de transtorno alimentar…) — na dúvida, fale com um profissional de saúde.</p>
      ${UI.botoesModal(false, "Começar")}`, { semFoco: true });
    m.querySelector(".protocolos").addEventListener("click", (e) => {
      const b = e.target.closest("[data-h]"); if (!b) return;
      m.querySelectorAll(".protocolo").forEach((x) => x.classList.toggle("ativo", x === b));
      m.querySelector("#f_h").value = b.dataset.h;
    });
    m.querySelector("#btnSalvar").onclick = () => {
      const h = UI.numero("f_h"), ini = deLocalDT(UI.valor("f_ini"));
      if (!(h > 0)) { UI.toast("Informe a duração em horas."); return; }
      if (!ini || new Date(ini) > new Date(Date.now() + 60000)) { UI.toast("O início não pode ser no futuro."); return; }
      d.jejuns.push({ id: N.novoId(), usuarioId: uid(), inicio: ini, fim: null, metaHoras: h, obs: "" });
      d.config.jejumPadrao = h;
      UI.fecharModal();
      salvar(`⏳ Jejum de ${BE.fmtHoras(h)} começou. Termina às ${new Date(new Date(ini).getTime() + h * 3600000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`);
    };
  }
  function encerrarJejum() {
    const d = D(), at = BE.jejumAtivo(d);
    if (!at) return;
    at.fim = new Date().toISOString();
    const h = BE.horasJejum(at), ok = h >= Number(at.metaHoras) - 0.01;
    vibrar();
    salvar(ok ? `🎉 Jejum concluído: ${BE.fmtHoras(h)}!` : `Jejum encerrado com ${BE.fmtHoras(h)} (meta ${BE.fmtHoras(at.metaHoras)}).`);
  }
  function editarJejum(id) {
    const d = D(), j = d.jejuns.find((x) => x.id === id);
    if (!j) return;
    const m = UI.abrirModal(`<h3>${j.fim ? "Editar jejum" : "Jejum em andamento"}</h3>
      <div class="par3">
        <div class="campo"><label for="f_ini">Início</label><input id="f_ini" type="datetime-local" value="${localDT(j.inicio)}"></div>
        <div class="campo"><label for="f_fim">Fim</label><input id="f_fim" type="datetime-local" value="${j.fim ? localDT(j.fim) : ""}"${j.fim ? "" : ' placeholder="em andamento"'}></div>
        <div class="campo"><label for="f_h">Meta (horas)</label><input id="f_h" type="number" min="1" max="72" step="0.5" value="${j.metaHoras}"></div>
      </div>
      <div class="campo"><label for="f_obs">Anotação</label><input id="f_obs" value="${esc(j.obs || "")}" placeholder="opcional — como se sentiu"></div>
      ${j.fim ? "" : `<p class="ajuda">Deixe o fim vazio para continuar contando.</p>`}
      ${UI.botoesModal(true)}`, { semFoco: true });
    m.querySelector("#btnSalvar").onclick = () => {
      const ini = deLocalDT(UI.valor("f_ini")), fim = deLocalDT(UI.valor("f_fim")), h = UI.numero("f_h");
      if (!ini) { UI.toast("Informe o início."); return; }
      if (fim && fim <= ini) { UI.toast("O fim precisa ser depois do início."); return; }
      if (!fim && d.jejuns.some((x) => x !== j && !x.fim)) { UI.toast("Já existe outro jejum em andamento."); return; }
      Object.assign(j, { inicio: ini, fim, metaHoras: h || j.metaHoras, obs: UI.texto("f_obs") });
      UI.fecharModal();
      salvar("Jejum atualizado.");
    };
    m.querySelector("#btnExcluir").onclick = () => UI.confirmar({ titulo: "Excluir jejum", texto: "Excluir este jejum do histórico?", rotulo: "Excluir",
      aoConfirmar: () => App.comDesfazer("Jejum excluído.", () => { d.jejuns = d.jejuns.filter((x) => x.id !== j.id); }) });
  }

  // =====================================================================
  // ações
  // =====================================================================
  App.registrarAcoes({
    "rapido-checkin": () => checkin(N.hoje(0)),
    "checkin": (el) => checkin(el.dataset.data || N.hoje(0), el.dataset.foco),
    "novo-habito": () => habito(null),
    "editar-habito": (el) => habito(el.dataset.id),
    "habito-modelos": () => modelos(),
    "habito-modelo": (el) => { const x = BE.MODELOS[Number(el.dataset.i)]; if (x) habito(null, Object.assign({}, x, { dias: DIAS.slice(), inicio: N.hoje(0) })); },
    "habito-alternar": (el) => alternarHabito(el.dataset.id, el.dataset.data),
    "habito-quantidade": (el) => quantidadeHabito(el.dataset.id, el.dataset.data),
    "habito-somar": (el) => {
      const d = D(), h = BE.habito(d, el.dataset.id); if (!h) return;
      const v = Math.max(0, BE.valorNoDia(d, h, el.dataset.data) + Number(el.dataset.v || 0));
      definirValorHabito(h, el.dataset.data, N.arred(v, 2));
      if (v >= Number(h.meta)) vibrar();
      salvar(v >= Number(h.meta) ? `${h.emoji || "✅"} Meta de ${h.nome.toLowerCase()} batida!` : null);
      if (redesenharQtd) redesenharQtd();
    },
    "habito-definir": (el) => {
      const d = D(), h = BE.habito(d, el.dataset.id); if (!h) return;
      const v = UI.numero("f_qv");
      definirValorHabito(h, el.dataset.data, v && v > 0 ? v : 0);
      UI.fecharModal();
      salvar("Valor salvo.");
    },
    "habito-pausar": (el) => pausarHabito(el.dataset.id),
    "novo-remedio": () => remedio(null),
    "editar-remedio": (el) => remedio(el.dataset.id),
    "dose-alternar": (el) => {
      const d = D(), x = BE.dose(d, el.dataset.id, el.dataset.data, el.dataset.hora);
      definirDose(el.dataset.id, el.dataset.data, el.dataset.hora, x && x.status === "Tomado" ? "Pendente" : "Tomado");
    },
    "dose-status": (el) => definirDose(el.dataset.id, el.dataset.data, el.dataset.hora, el.dataset.status),
    "dose-extra": (el) => definirDose(el.dataset.id, N.hoje(0), N.horaAgora(), "Tomado", true),
    "remedio-repor": (el) => repor(el.dataset.id),
    "remedio-comprar": (el) => paraListaDeCompras(el.dataset.id),
    "remedio-pausar": (el) => { const r = BE.remedio(D(), el.dataset.id); if (!r) return; r.ativo = r.ativo === false; salvar(r.ativo ? `${r.nome} reativado.` : `${r.nome} pausado.`); },
    "rapido-jejum": () => jejum(),
    "jejum": () => jejum(),
    "jejum-encerrar": () => encerrarJejum(),
    "editar-jejum": (el) => editarJejum(el.dataset.id)
  });

  window.FormulariosSaude = { checkin, habito, modelos, alternarHabito, quantidadeHabito, remedio, definirDose, repor, jejum, encerrarJejum, editarJejum };
})();
