/**
 * agenda.js
 * -----------------------------------------------------------------------
 * Integração com o Google Agenda: cria na conta Google da pessoa uma
 * agenda "Meu Controle" com
 *   💊 horários dos remédios (repetindo nos dias certos, com alerta),
 *   🏋️ treinos do plano semanal,
 *   ⏳ jejum em andamento (início e fim, com alerta no fim),
 *   🍽️ refeições planejadas dos próximos 7 dias (opcional).
 * Mudou no app, a agenda acompanha. O app só mexe nessa agenda — a
 * permissão pedida ("calendar.app.created") não dá acesso às outras.
 *
 * Os alertas da agenda tocam mesmo com o app fechado (no celular, no
 * relógio e no computador) — coisa que um app web sozinho não garante.
 *
 * A configuração do Google (ID do cliente OAuth) é feita uma vez só por
 * quem cuida do app; cada pessoa só toca em "Conectar" e entra com a
 * própria conta. A agenda fica guardada nos dados (config.agenda), então
 * celular e computador sincronizados usam a mesma.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  // ID do cliente OAuth (Google Cloud → APIs e serviços → Credenciais). Público por natureza.
  const CLIENT_ID_PADRAO = "";
  const idCliente = () => global.MC_GOOGLE_CLIENT_ID || CLIENT_ID_PADRAO;
  const ESCOPO = "https://www.googleapis.com/auth/calendar.app.created";
  const API = "https://www.googleapis.com/calendar/v3";

  const N = global.Nucleo, UI = global.UI, A = global.Armazenamento;
  const esc = UI.esc;
  const App = () => global.App;
  const CHAVE = "meuControle:agenda"; // token deste aparelho (vale ~1 h)
  const DIAS_RRULE = ["", "MO", "TU", "WE", "TH", "FR", "SA", "SU"];
  const fuso = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo"; } catch (e) { return "America/Sao_Paulo"; } };

  function lerLocal() { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; } }
  function gravarLocal(s) { try { localStorage.setItem(CHAVE, JSON.stringify(s)); } catch (e) { /* ignora */ } }
  function cfg(d) {
    d = d || App().dados();
    const padrao = { ativa: false, calendarioId: null, itens: { remedios: true, treinos: true, jejum: true, refeicoes: false }, ultimoHash: null, ultimaVez: null };
    // completa no próprio objeto (quem guardou a referência continua valendo)
    const c = d.config.agenda && typeof d.config.agenda === "object" ? d.config.agenda : (d.config.agenda = {});
    Object.keys(padrao).forEach((k) => { if (c[k] === undefined) c[k] = padrao[k]; });
    c.itens = Object.assign({}, padrao.itens, c.itens || {});
    return c;
  }
  const configurado = () => !!idCliente();
  const conectadoAqui = () => !!lerLocal().conectado;
  function tokenValido() { const s = lerLocal(); return s.token && s.exp && s.exp > Date.now() + 60000 ? s.token : null; }

  // ---------------------------------------------------------------------
  // login Google (Google Identity Services)
  // ---------------------------------------------------------------------
  let gisP = null, cliente = null, pedido = null;
  function carregarGIS() {
    if (gisP) return gisP;
    gisP = new Promise((ok, erro) => {
      if (global.google && global.google.accounts && global.google.accounts.oauth2) { ok(); return; }
      const t = document.createElement("script");
      t.src = "https://accounts.google.com/gsi/client"; t.async = true;
      t.onload = () => ok(); t.onerror = () => { gisP = null; erro(new Error("Não consegui carregar o login do Google. Verifique a internet.")); };
      document.head.appendChild(t);
    });
    return gisP;
  }
  // precisa vir de um toque (o Google abre uma janelinha)
  function pedirToken(consentir) {
    return carregarGIS().then(() => new Promise((ok, erro) => {
      if (!cliente) {
        cliente = global.google.accounts.oauth2.initTokenClient({
          client_id: idCliente(), scope: ESCOPO,
          callback: (r) => {
            const p = pedido; pedido = null; if (!p) return;
            if (r && r.access_token && (!global.google.accounts.oauth2.hasGrantedAllScopes || global.google.accounts.oauth2.hasGrantedAllScopes(r, ESCOPO))) {
              const s = lerLocal(); Object.assign(s, { token: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000, conectado: true }); gravarLocal(s);
              p.ok(r.access_token);
            } else p.erro(new Error(r && r.error === "access_denied" ? "Você não autorizou o acesso à agenda." : "O Google não liberou o acesso à agenda."));
          },
          error_callback: (e) => { const p = pedido; pedido = null; if (p) p.erro(new Error(e && e.type === "popup_closed" ? "A janela do Google foi fechada antes de terminar." : e && e.type === "popup_failed_to_open" ? "O navegador bloqueou a janela do Google. Permita pop-ups para este site." : "Não deu certo entrar no Google.")); }
        });
      }
      pedido = { ok, erro };
      cliente.requestAccessToken({ prompt: consentir ? "consent" : "" });
    }));
  }

  // ---------------------------------------------------------------------
  // Calendar API
  // ---------------------------------------------------------------------
  function api(token, metodo, caminho, corpo) {
    return fetch(API + caminho, { method: metodo, headers: Object.assign({ Authorization: "Bearer " + token }, corpo ? { "Content-Type": "application/json" } : {}), body: corpo ? JSON.stringify(corpo) : undefined })
      .catch(() => { throw Object.assign(new Error(navigator.onLine ? "Não consegui falar com o Google Agenda." : "Sem internet agora."), { tipo: "rede" }); })
      .then((r) => {
        if (r.status === 204) return null;
        return r.json().catch(() => null).then((j) => {
          if (r.ok) return j;
          const e = new Error(r.status === 401 ? "O acesso ao Google expirou." : r.status === 403 ? "O Google recusou (permissão ou limite de uso)." : r.status === 404 ? "não encontrado" : "O Google Agenda respondeu com erro " + r.status + ".");
          e.status = r.status; throw e;
        });
      });
  }

  // ---------------------------------------------------------------------
  // o que deve estar na agenda
  // ---------------------------------------------------------------------
  const hhmm = (h) => /^\d{1,2}:\d{2}$/.test(h || "") ? h.padStart(5, "0") : null;
  function somarMin(data, h, min) {
    const [y, m, d] = data.split("-").map(Number), [hh, mm] = h.split(":").map(Number);
    const x = new Date(y, m - 1, d, hh, mm + min);
    return N.isoLocal(x) + "T" + String(x.getHours()).padStart(2, "0") + ":" + String(x.getMinutes()).padStart(2, "0") + ":00";
  }
  const dataHora = (data, h) => data + "T" + h + ":00";
  function proximoDia(desde, dias) {
    for (let i = 0; i < 7; i++) { const x = N.addDias(desde, i); if (dias.indexOf(N.diaSemana(x)) !== -1) return x; }
    return desde;
  }
  function ate(fim) { return fim ? ";UNTIL=" + fim.replace(/-/g, "") + "T235959Z" : ""; }
  function evento(chave, titulo, inicioData, h, duracaoMin, opc) {
    opc = opc || {};
    const tz = fuso();
    const e = {
      summary: titulo,
      description: (opc.descricao ? opc.descricao + "\n\n" : "") + "Criado pelo app Meu Controle. Para mudar, altere no app.",
      start: { dateTime: dataHora(inicioData, h), timeZone: tz },
      end: { dateTime: somarMin(inicioData, h, duracaoMin), timeZone: tz },
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: opc.alerta == null ? 0 : opc.alerta }] },
      transparency: "transparent"
    };
    if (opc.rrule) e.recurrence = ["RRULE:" + opc.rrule];
    if (opc.cor) e.colorId = opc.cor;
    return { chave, corpo: e };
  }
  function desejados(d) {
    const c = cfg(d), hoje = N.hoje(0), lista = [];
    const area = (k) => !global.Areas || global.Areas.area(d, k);
    if (c.itens.remedios && area("remedios")) {
      d.remedios.forEach((r) => {
        if (r.ativo === false || r.frequencia === "sob-demanda") return;
        if (r.fim && r.fim < hoje) return;
        // início fixo (o do remédio): a agenda não muda a cada dia que passa
        const desde = r.inicio || "2026-01-01";
        const qtd = r.qtdDose ? ` — ${String(r.qtdDose).replace(".", ",")} ${r.unidadeDose || ""}`.trimEnd() : "";
        (r.horarios || []).map(hhmm).filter(Boolean).forEach((h) => {
          let rrule, inicio = desde;
          if (r.frequencia === "intervalo") {
            const a = Number(r.intervaloDias) || 2;
            inicio = desde;
            rrule = "FREQ=DAILY;INTERVAL=" + a;
          } else {
            const dias = Array.isArray(r.dias) && r.dias.length ? r.dias.slice().sort() : [1, 2, 3, 4, 5, 6, 7];
            if (dias.length === 7) rrule = "FREQ=DAILY";
            else { rrule = "FREQ=WEEKLY;BYDAY=" + dias.map((x) => DIAS_RRULE[x]).join(","); inicio = proximoDia(desde, dias); }
          }
          lista.push(evento(`rem:${r.id}:${h}`, `💊 ${r.nome}${qtd}`, inicio, h, 10, { rrule: rrule + ate(r.fim), descricao: r.instrucao && r.instrucao !== "Indiferente" ? "Tomar: " + r.instrucao.toLowerCase() : "", cor: "7" }));
        });
      });
    }
    if (c.itens.treinos && area("academia")) {
      d.planoSemanal.forEach((p) => {
        if (p.tipo === "descanso") return;
        const h = hhmm(p.horario) || hhmm((d.config.rotina && d.config.rotina.horarios && d.config.rotina.horarios.treino) || "") || "18:00";
        const dia = proximoDia("2026-01-05", [Number(p.diaSemana) || 1]); // segunda-feira fixa como âncora
        lista.push(evento(`trn:${p.id}`, `🏋️ ${p.treino || "Treino"}`, dia, h, 60, { rrule: "FREQ=WEEKLY;BYDAY=" + DIAS_RRULE[Number(p.diaSemana) || 1], alerta: 30, descricao: (p.grupos || []).join(", "), cor: "10" }));
      });
    }
    if (c.itens.jejum && area("jejum")) {
      const j = d.jejuns.find((x) => !x.fim);
      if (j && j.metaHoras) {
        const ini = new Date(j.inicio), fim = new Date(ini.getTime() + Number(j.metaHoras) * 3600e3);
        if (fim > new Date()) {
          const dIni = N.isoLocal(ini), hIni = String(ini.getHours()).padStart(2, "0") + ":" + String(ini.getMinutes()).padStart(2, "0");
          const dFim = N.isoLocal(fim), hFim = String(fim.getHours()).padStart(2, "0") + ":" + String(fim.getMinutes()).padStart(2, "0");
          const e = evento(`jej:${j.id}`, `⏳ Jejum de ${j.metaHoras} h`, dIni, hIni, Math.round(Number(j.metaHoras) * 60), { alerta: 0, cor: "5" });
          e.corpo.reminders = { useDefault: false, overrides: [] };
          lista.push(e);
          lista.push(evento(`jejfim:${j.id}`, "✅ Fim do jejum — pode comer", dFim, hFim, 5, { alerta: 0, cor: "5" }));
        }
      }
    }
    if (c.itens.refeicoes && area("alimentacao")) {
      const ate7 = N.hoje(7);
      d.refeicoes.forEach((r) => {
        if (r.status !== "Planejada" || r.data < hoje || r.data > ate7 || !hhmm(r.horario)) return;
        lista.push(evento(`ref:${r.id}`, `🍽️ ${r.tipo || "Refeição"}`, r.data, hhmm(r.horario), 30, { alerta: 0, cor: "6" }));
      });
    }
    return lista;
  }
  function estavel(v) {
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(estavel).join(",") + "]";
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + estavel(v[k])).join(",") + "}";
  }
  function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function hashTudo(d) { const c = cfg(d); return hash(estavel([c.itens, desejados(d)])); }

  // ---------------------------------------------------------------------
  // enviar para a agenda
  // ---------------------------------------------------------------------
  const st = { rodando: false, msg: "", erro: null };
  function garantirCalendario(token, d) {
    const c = cfg(d);
    const criar = () => api(token, "POST", "/calendars", { summary: "Meu Controle", description: "Remédios, treinos e jejum do app Meu Controle. Para mudar, altere no app.", timeZone: fuso() })
      .then((cal) => { c.calendarioId = cal.id; A.salvarDados(d, true); return cal.id; });
    if (!c.calendarioId) return criar();
    return api(token, "GET", `/calendars/${encodeURIComponent(c.calendarioId)}`).then(() => c.calendarioId)
      .catch((e) => { if (e.status === 404) { c.calendarioId = null; return criar(); } throw e; });
  }
  function listar(token, cal) {
    const tudo = [];
    const pagina = (pt) => api(token, "GET", `/calendars/${encodeURIComponent(cal)}/events?maxResults=2500&showDeleted=false&fields=items(id,extendedProperties),nextPageToken${pt ? "&pageToken=" + encodeURIComponent(pt) : ""}`)
      .then((j) => { (j.items || []).forEach((x) => tudo.push(x)); return j.nextPageToken ? pagina(j.nextPageToken) : tudo; });
    return pagina(null);
  }
  function enviar(token) {
    const d = App().dados(), c = cfg(d);
    if (st.rodando) return Promise.resolve();
    st.rodando = true; st.erro = null; atualizarCartao();
    const alvo = desejados(d);
    let n = { novos: 0, mudados: 0, removidos: 0 };
    return garantirCalendario(token, d).then((cal) => listar(token, cal).then((atuais) => {
      const porChave = {};
      atuais.forEach((e) => { const k = e.extendedProperties && e.extendedProperties.private && e.extendedProperties.private.mc; if (k) { if (porChave[k]) porChave[k + "#dup" + e.id] = e; else porChave[k] = e; } else porChave["?" + e.id] = e; });
      const tarefas = [];
      const quer = {};
      alvo.forEach((x) => {
        const h = hash(estavel(x.corpo));
        quer[x.chave] = true;
        const corpo = Object.assign({}, x.corpo, { extendedProperties: { private: { mc: x.chave, h } } });
        const e = porChave[x.chave];
        if (!e) { n.novos++; tarefas.push(() => api(token, "POST", `/calendars/${encodeURIComponent(cal)}/events`, corpo)); }
        else if (e.extendedProperties.private.h !== h) { n.mudados++; tarefas.push(() => api(token, "PUT", `/calendars/${encodeURIComponent(cal)}/events/${encodeURIComponent(e.id)}`, corpo)); }
      });
      Object.keys(porChave).forEach((k) => {
        if (quer[k]) return;
        n.removidos++;
        tarefas.push(() => api(token, "DELETE", `/calendars/${encodeURIComponent(cal)}/events/${encodeURIComponent(porChave[k].id)}`).catch((e) => { if (e.status !== 404 && e.status !== 410) throw e; }));
      });
      // poucos de cada vez (o Google limita pedidos por segundo)
      const rodar = (i) => i >= tarefas.length ? Promise.resolve() : Promise.all(tarefas.slice(i, i + 4).map((f) => f())).then(() => rodar(i + 4));
      return rodar(0);
    })).then(() => {
      c.ultimoHash = hashTudo(d); c.ultimaVez = new Date().toISOString(); c.ativa = true;
      A.salvarDados(d, true);
      st.msg = n.novos + n.mudados + n.removidos ? `${n.novos ? n.novos + " adicionados" : ""}${n.mudados ? (n.novos ? ", " : "") + n.mudados + " atualizados" : ""}${n.removidos ? (n.novos || n.mudados ? ", " : "") + n.removidos + " removidos" : ""}` : "nada mudou";
      return n;
    }).catch((e) => {
      if (e.status === 401) { const s = lerLocal(); delete s.token; delete s.exp; gravarLocal(s); }
      st.erro = e.message; throw e;
    }).finally(() => { st.rodando = false; atualizarCartao(); atualizarAviso(); });
  }
  // com token válido: envia sozinho; sem: mostra o aviso "Atualizar Google Agenda"
  function talvezEnviar() {
    if (!configurado() || !conectadoAqui()) return;
    const d = App().dados(), c = cfg(d);
    if (!c.ativa || c.ultimoHash === hashTudo(d)) { atualizarAviso(); return; }
    const t = tokenValido();
    if (t) enviar(t).catch(() => {}); else atualizarAviso();
  }
  function enviarComToque(consentir) {
    const t = tokenValido();
    return (t ? Promise.resolve(t) : pedirToken(consentir)).then((tok) => enviar(tok));
  }

  // ---------------------------------------------------------------------
  // telas
  // ---------------------------------------------------------------------
  function pendente(d) { const c = cfg(d); return c.ativa && conectadoAqui() && c.ultimoHash !== hashTudo(d); }
  function atualizarAviso() {
    let el = document.getElementById("agendaAviso");
    const mostrar = configurado() && pendente(App().dados()) && !tokenValido() && !st.rodando;
    if (!mostrar) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement("button");
      el.id = "agendaAviso"; el.className = "agenda-aviso"; el.dataset.acao = "agenda-enviar";
      el.innerHTML = `<span>📅</span><span><b>Atualizar Google Agenda</b><small>há mudanças nos remédios, treinos ou jejum</small></span>`;
      document.body.appendChild(el);
    }
  }
  function cartaoAjustes(d) {
    const c = cfg(d);
    let corpo;
    if (!configurado()) {
      corpo = `<div class="sy-status"><span>📅</span><div><b>Ainda não configurado</b><small>Quem cuida do app precisa fazer a configuração do Google uma única vez (Google Cloud → ID do cliente). Depois, cada pessoa só toca em “Conectar”.</small></div></div>`;
    } else if (!c.ativa || !conectadoAqui()) {
      corpo = `<div class="sy-status"><span>📅</span><div><b>Leve seus horários para o Google Agenda</b><small>O app cria uma agenda “Meu Controle” na sua conta Google com os remédios, treinos e jejum. Os alertas tocam mesmo com o app fechado — no celular, no relógio e no computador.</small></div></div>
        <button class="btn primario" data-acao="agenda-conectar">Conectar Google Agenda</button>
        <p class="ajuda">O Google vai pedir para você escolher a conta e autorizar. O app só consegue mexer na agenda que ele mesmo cria — não vê nem altera as suas outras agendas.${c.ativa ? " Esta conta já está ligada em outro aparelho: conectar aqui usa a mesma agenda." : ""}</p>`;
    } else {
      const pend = pendente(d);
      corpo = `${st.erro ? `<div class="sy-status erro"><span>⚠️</span><div><b>Não atualizou</b><small>${esc(st.erro)}</small></div></div>`
        : st.rodando ? `<div class="sy-status"><span class="sy-gira">🔄</span><div><b>Atualizando a agenda…</b></div></div>`
        : `<div class="sy-status ${pend ? "" : "ok"}"><span>${pend ? "🕒" : "✅"}</span><div><b>${pend ? "Há mudanças para enviar" : "Agenda em dia"}</b><small>Última atualização: ${c.ultimaVez ? new Date(c.ultimaVez).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}${st.msg ? " · " + esc(st.msg) : ""}</small></div></div>`}
        <span class="ap-rot">O que vai para a agenda</span>
        <div class="lista-interruptores">
          ${global.Personalizar.interruptor("ag_rem", "💊 Remédios", c.itens.remedios, "Cada horário, com alerta na hora.", 'data-mudar="agenda-item" data-k="remedios"')}
          ${global.Personalizar.interruptor("ag_trn", "🏋️ Treinos", c.itens.treinos, "O plano da semana, com alerta 30 min antes.", 'data-mudar="agenda-item" data-k="treinos"')}
          ${global.Personalizar.interruptor("ag_jej", "⏳ Jejum", c.itens.jejum, "O jejum em andamento e um alerta quando terminar.", 'data-mudar="agenda-item" data-k="jejum"')}
          ${global.Personalizar.interruptor("ag_ref", "🍽️ Refeições planejadas", c.itens.refeicoes, "Próximos 7 dias, com alerta na hora.", 'data-mudar="agenda-item" data-k="refeicoes"')}
        </div>
        <div class="botoes-linha"><button class="btn pequeno primario" data-acao="agenda-enviar">📅 Atualizar agora</button><a class="btn pequeno" href="https://calendar.google.com/" target="_blank" rel="noopener">Abrir o Google Agenda</a><button class="btn pequeno perigo" data-acao="agenda-desligar">Desconectar</button></div>
        <p class="ajuda">Para marcar um remédio como tomado, continue usando o app. Se a agenda não atualizar sozinha, aparece um botão “Atualizar Google Agenda” — o Google pede para confirmar o acesso de tempos em tempos.</p>`;
    }
    return UI.card({ titulo: "Google Agenda", sub: "alertas mesmo com o app fechado", id: "sec-agenda", corpo: `<div class="pad">${corpo}</div>` });
  }
  function atualizarCartao() {
    const el = document.getElementById("sec-agenda");
    if (!el || UI.modalAberto()) return;
    const tmp = document.createElement("div"); tmp.innerHTML = cartaoAjustes(App().dados());
    el.replaceWith(tmp.firstElementChild);
  }

  App().registrarAcoes({
    "agenda-conectar": () => {
      pedirToken(true).then((t) => { const d = App().dados(); cfg(d).ativa = true; A.salvarDados(d, true); return enviar(t); })
        .then((n) => { App().renderizar(); UI.toast(`Pronto! Agenda “Meu Controle” criada com ${n.novos} ${n.novos === 1 ? "evento" : "eventos"}.`); })
        .catch((e) => { UI.toast(e.message); atualizarCartao(); });
    },
    "agenda-enviar": () => {
      const b = document.getElementById("agendaAviso"); if (b) b.remove();
      enviarComToque(false).then(() => UI.toast("Google Agenda atualizado" + (st.msg && st.msg !== "nada mudou" ? ": " + st.msg : "") + "."))
        .catch((e) => { UI.toast(e.message); atualizarAviso(); });
    },
    "agenda-desligar": () => UI.confirmar({
      titulo: "Desconectar o Google Agenda", texto: "A agenda “Meu Controle” é apagada da sua conta Google (com todos os eventos que o app criou) e o app para de atualizá-la.", rotulo: "Desconectar",
      aoConfirmar: () => {
        const d = App().dados(), c = cfg(d), cal = c.calendarioId;
        const tok = tokenValido();
        (tok ? Promise.resolve(tok) : pedirToken(false)).then((t) => (cal ? api(t, "DELETE", `/calendars/${encodeURIComponent(cal)}`).catch(() => {}) : null).then(() => {
          try { global.google.accounts.oauth2.revoke(t, () => {}); } catch (e) { /* ignora */ }
        })).catch(() => {}).then(() => {
          Object.assign(c, { ativa: false, calendarioId: null, ultimoHash: null, ultimaVez: null });
          gravarLocal({}); App().salvar("Google Agenda desconectado.", { semIntegracao: true });
        });
      }
    })
  });
  App().registrarMudancas({
    "agenda-item": (el) => { const d = App().dados(); cfg(d).itens[el.dataset.k] = el.checked; App().salvar(null, { semIntegracao: true }); }
  });
  App().aoSalvar((d, abertura) => { setTimeout(talvezEnviar, abertura ? 2500 : 800); });
  App().aoRenderizar(() => atualizarAviso());

  global.Agenda = { configurado, conectadoAqui, desejados, cartaoAjustes, enviar, pedirToken, estado: st };
})(window);
