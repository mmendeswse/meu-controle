/**
 * lembretes.js
 * -----------------------------------------------------------------------
 * Dois jeitos de lembrar:
 *
 * 1. Notificações do aparelho enquanto o app está aberto (ou minimizado,
 *    no computador). Um app da web sem servidor não consegue acordar o
 *    celular sozinho, então isto é um complemento.
 * 2. Calendário: gera um arquivo .ics com os horários dos remédios e dos
 *    hábitos. Aberto no celular, entra no app de calendário com alarme —
 *    esse lembra de verdade, mesmo com o Meu Controle fechado.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo, UI = global.UI, BE = global.BemEstar, A = global.Armazenamento;
  const esc = UI.esc;
  let timers = [];
  const disparados = {}; // tag → true (não repete o mesmo lembrete no dia)

  const suporta = () => "Notification" in window;
  const permissao = () => (suporta() ? Notification.permission : "indisponivel");
  const ehIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const instalado = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  function msAte(hora) {
    const [h, m] = hora.split(":").map(Number), agora = new Date(), alvo = new Date();
    alvo.setHours(h, m, 0, 0);
    return alvo - agora;
  }

  function notificar(titulo, corpo, tag, rota) {
    if (disparados[tag]) return;
    disparados[tag] = true;
    const opc = { body: corpo, tag, icon: "assets/icons/icon-192.png", badge: "assets/icons/icon-192.png", data: { rota: rota || "dashboard" }, renotify: false };
    const vibrar = (A.carregarDados().config.aparencia || {}).vibrar !== false;
    if (vibrar) opc.vibrate = [120, 60, 120];
    if (permissao() === "granted") {
      const viaSW = "serviceWorker" in navigator && location.protocol.indexOf("http") === 0
        ? navigator.serviceWorker.getRegistration().then((r) => { if (r) return r.showNotification(titulo, opc); throw new Error("sem sw"); })
        : Promise.reject(new Error("sem sw"));
      viaSW.catch(() => { try { new Notification(titulo, opc); } catch (e) { /* alguns navegadores só aceitam pelo service worker */ } });
    }
    if (document.visibilityState === "visible") UI.toast("🔔 " + titulo + " — " + corpo);
  }

  // o que ainda vai acontecer hoje
  function eventosDeHoje(d) {
    const cfg = d.config.lembretes || {}, hj = N.hoje(0), out = [];
    const P = global.Personalizar;
    if (cfg.remedios !== false) BE.dosesDoDia(d, hj).forEach((x) => {
      if (x.extra || x.status !== "Pendente") return;
      const r = x.remedio;
      out.push({ hora: x.horario, tag: `rem:${r.id}:${hj}:${x.horario}`, titulo: `💊 ${r.nome}`, corpo: `Hora da dose: ${r.dose || "1 " + (r.unidadeDose || "dose")}${r.instrucao && r.instrucao !== "Indiferente" ? " · " + r.instrucao.toLowerCase() : ""}`, rota: "bemestar/remedios" });
    });
    if (cfg.habitos !== false) BE.habitosDoDia(d, hj).forEach((h) => {
      if (!h.horario || BE.automatico(h) || BE.cumpridoNoDia(d, h, hj)) return;
      out.push({ hora: h.horario, tag: `hab:${h.id}:${hj}`, titulo: `${h.emoji || "✅"} ${h.nome}`, corpo: h.tipo === "quantidade" ? `Meta de hoje: ${h.meta} ${h.unidade || ""}` : "Hora do seu hábito", rota: "bemestar/habitos" });
    });
    if (cfg.checkin !== false && P) {
      const c = BE.checkin(d, hj);
      if (!c || c.humor == null) out.push({ hora: P.horario(d, "checkin"), tag: `chk:${hj}`, titulo: "🙂 Como foi o seu dia?", corpo: "Registre humor, energia e estresse em poucos segundos.", rota: "bemestar" });
    }
    if (cfg.agua && P && global.Alimentacao) {
      const meta = global.Alimentacao.metaDiaria(d, "agua");
      const ini = P.horario(d, "acordar"), fim = P.horario(d, "dormir");
      const passo = Math.max(1, Number(cfg.aguaIntervalo) || 2) * 60;
      const [hi, mi] = ini.split(":").map(Number), [hf, mf] = fim.split(":").map(Number);
      for (let t = hi * 60 + mi + passo; t < hf * 60 + mf; t += passo) {
        const hora = String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
        out.push({ hora, tag: `agua:${hj}:${hora}`, titulo: "💧 Hora de beber água", corpo: meta ? `Meta de hoje: ${UI.litros(meta)}` : "Um copo agora ajuda a bater a meta.", rota: "alimentacao", condicao: () => !meta || global.Alimentacao.aguaDoDia(global.App.dados(), N.hoje(0)) < meta });
      }
    }
    return out;
  }

  function agendar(d) {
    timers.forEach(clearTimeout);
    timers = [];
    d = d || A.carregarDados();
    const cfg = d.config.lembretes || {};
    if (!cfg.ativos || permissao() !== "granted") return;
    eventosDeHoje(d).forEach((ev) => {
      const ms = msAte(ev.hora);
      if (ms < -15 * 60000 || ms > 24 * 3600000) return; // passou há mais de 15 min: o roteiro já mostra
      timers.push(setTimeout(() => {
        if (ev.condicao && !ev.condicao()) return;
        notificar(ev.titulo, ev.corpo, ev.tag, ev.rota);
      }, Math.max(0, ms)));
    });
    // reagenda à meia-noite e a cada meia hora (timers atrasam em segundo plano)
    timers.push(setTimeout(() => agendar(), 30 * 60000));
  }

  function ativar() {
    if (!suporta()) {
      UI.toast(ehIOS() && !instalado() ? "No iPhone, instale o app (Mais → Instalar app) para receber notificações." : "Este navegador não mostra notificações.");
      return;
    }
    Notification.requestPermission().then((p) => {
      const d = global.App.dados();
      if (p === "granted") {
        d.config.lembretes.ativos = true;
        global.App.salvar("Lembretes ligados.", { semIntegracao: true });
        agendar(d);
        notificar("🔔 Lembretes ligados", "É assim que os avisos vão aparecer.", "teste:" + Date.now());
      } else {
        d.config.lembretes.ativos = false;
        global.App.salvar(null, { semIntegracao: true });
        UI.toast(p === "denied" ? "As notificações estão bloqueadas nas configurações do navegador." : "Permissão não concedida.");
      }
    });
  }

  // ---------------------------------------------------------------------
  // calendário (.ics)
  // ---------------------------------------------------------------------
  const BYDAY = { 1: "MO", 2: "TU", 3: "WE", 4: "TH", 5: "FR", 6: "SA", 7: "SU" };
  function icsTexto(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }
  function icsData(iso, hora) { return iso.replace(/-/g, "") + "T" + hora.replace(":", "") + "00"; }
  function dobrar(linha) {
    // linhas de no máximo 75 caracteres (RFC 5545)
    const out = [];
    let resto = linha;
    while (resto.length > 74) { out.push(resto.slice(0, 74)); resto = " " + resto.slice(74); }
    out.push(resto);
    return out.join("\r\n");
  }
  function evento(uid, titulo, desc, inicioISO, hora, rrule) {
    const carimbo = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    return ["BEGIN:VEVENT", "UID:" + uid + "@meu-controle", "DTSTAMP:" + carimbo, "DTSTART:" + icsData(inicioISO, hora),
      "DURATION:PT10M", "SUMMARY:" + icsTexto(titulo), "DESCRIPTION:" + icsTexto(desc), rrule ? "RRULE:" + rrule : null,
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsTexto(titulo), "TRIGGER:-PT0M", "END:VALARM", "END:VEVENT"].filter(Boolean).map(dobrar).join("\r\n");
  }
  function regra(dias, fim, intervalo) {
    const ate = fim ? ";UNTIL=" + fim.replace(/-/g, "") + "T235959" : "";
    if (intervalo) return "FREQ=DAILY;INTERVAL=" + intervalo + ate;
    const lista = Array.isArray(dias) && dias.length && dias.length < 7 ? dias : null;
    return lista ? "FREQ=WEEKLY;BYDAY=" + lista.map((x) => BYDAY[x]).join(",") + ate : "FREQ=DAILY" + ate;
  }
  function gerarICS(d, opc) {
    opc = opc || {};
    const hj = N.hoje(0), evs = [];
    if (opc.remedios !== false) d.remedios.filter((r) => r.ativo !== false && r.frequencia !== "sob-demanda" && (!r.fim || r.fim >= hj)).forEach((r) => {
      const ini = r.inicio && r.inicio > hj ? r.inicio : hj;
      (r.horarios || []).forEach((h, i) => {
        evs.push(evento(`rem-${r.id}-${i}`, `💊 ${r.nome}`, [r.dose, r.instrucao && r.instrucao !== "Indiferente" ? r.instrucao : "", r.obs].filter(Boolean).join(" · "),
          r.frequencia === "intervalo" && r.inicio ? r.inicio : ini, h, regra(r.frequencia === "dias" ? r.dias : null, r.fim, r.frequencia === "intervalo" ? Number(r.intervaloDias) || 2 : null)));
      });
    });
    if (opc.habitos !== false) BE.habitosAtivos(d).filter((h) => h.horario && !BE.automatico(h)).forEach((h) => {
      const fim = BE.fimDesafio(h);
      if (fim && fim < hj) return;
      evs.push(evento(`hab-${h.id}`, `${h.emoji || "✅"} ${h.nome}`, h.tipo === "quantidade" ? `Meta: ${h.meta} ${h.unidade || ""}` : "Hábito do Meu Controle",
        h.inicio && h.inicio > hj ? h.inicio : hj, h.horario, regra(h.dias, fim)));
    });
    if (!evs.length) return null;
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Meu Controle//Lembretes//PT-BR", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Meu Controle"].join("\r\n") + "\r\n" + evs.join("\r\n") + "\r\nEND:VCALENDAR\r\n";
  }
  function exportarICS(opc) {
    const texto = gerarICS(global.App.dados(), opc);
    if (!texto) { UI.toast("Cadastre um remédio ou um hábito com horário primeiro."); return; }
    A.baixarArquivo("meu-controle-lembretes.ics", texto, "text/calendar");
    UI.abrirModal(`<h3>Lembretes no calendário</h3>
      <p class="modal-texto">O arquivo <b>meu-controle-lembretes.ics</b> foi baixado.</p>
      <ol class="passos-instalar">
        <li><span class="num-passo">1</span><div><b>iPhone/iPad:</b> toque no arquivo baixado (ou em Downloads) e depois em <b>Adicionar todos</b>.</div></li>
        <li><span class="num-passo">2</span><div><b>Android:</b> abra o arquivo e escolha o <b>Google Agenda</b> (ou importe em calendar.google.com → Configurações → Importar).</div></li>
        <li><span class="num-passo">3</span><div><b>Computador:</b> dê dois cliques no arquivo para abrir no Outlook ou no Calendário.</div></li>
      </ol>
      <p class="ajuda">Se mudar horários depois, apague os eventos antigos “Meu Controle” do calendário e gere de novo.</p>
      <div class="modal-acoes"><button class="btn primario" data-acao="fechar-modal">Entendi</button></div>`);
  }

  // ---------------------------------------------------------------------
  // cartão de Ajustes
  // ---------------------------------------------------------------------
  function cartaoAjustes(d) {
    const cfg = d.config.lembretes, p = permissao(), P = global.Personalizar;
    let status;
    if (p === "indisponivel") status = ehIOS() && !instalado() ? `No iPhone e no iPad, as notificações só funcionam com o app instalado (Mais → Instalar app).` : "Este navegador não mostra notificações — use o calendário abaixo.";
    else if (p === "denied") status = "As notificações estão bloqueadas para este site nas configurações do navegador.";
    else if (cfg.ativos && p === "granted") status = "Ligados. Os avisos aparecem enquanto o app estiver aberto ou minimizado.";
    else status = "Desligados.";
    const ligados = cfg.ativos && p === "granted";
    return UI.card({ titulo: "Lembretes", sub: "remédios, hábitos, check-in e água", id: "sec-lembretes", corpo: `<div class="pad">
      <p class="ajuda" style="margin-top:0"><b>${ligados ? "🔔" : "🔕"} ${esc(status)}</b></p>
      ${ligados ? `<div class="lista-interruptores">
        ${P.interruptor("lem_rem", "💊 Remédios", cfg.remedios !== false, "Na hora de cada dose.", 'data-mudar="lem" data-k="remedios"')}
        ${P.interruptor("lem_hab", "✅ Hábitos com horário", cfg.habitos !== false, "", 'data-mudar="lem" data-k="habitos"')}
        ${P.interruptor("lem_chk", "🙂 Check-in do dia", cfg.checkin !== false, "No horário do check-in, se ainda não tiver feito.", 'data-mudar="lem" data-k="checkin"')}
        ${P.interruptor("lem_agua", "💧 Água", !!cfg.agua, "Entre acordar e dormir, enquanto a meta não for batida.", 'data-mudar="lem" data-k="agua"')}
        ${cfg.agua ? `<label class="linha-sel"><span><b>Intervalo da água</b></span><select class="sel" data-mudar="lem-intervalo">${UI.opcoes([1, 2, 3, 4].map((v) => ({ v, r: "a cada " + v + " h" })), cfg.aguaIntervalo || 2)}</select></label>` : ""}
      </div>
      <div class="botoes-linha"><button class="btn" data-acao="lembrete-teste">Testar aviso</button><button class="btn" data-acao="lembretes-desligar">Desligar</button></div>`
      : p !== "indisponivel" && p !== "denied" ? `<button class="btn primario" data-acao="lembretes-ligar">🔔 Ligar notificações</button>` : ""}
      <div class="sechead">Lembrete que funciona com o app fechado</div>
      <p class="ajuda">Coloque os horários dos remédios e dos hábitos no calendário do celular, com alarme.</p>
      <div class="botoes-linha"><button class="btn" data-acao="exportar-ics">${UI.svg("calendario")}Adicionar ao calendário (.ics)</button></div>
    </div>` });
  }

  global.App.registrarAcoes({
    "lembretes-ligar": ativar,
    "lembretes-desligar": () => { const d = global.App.dados(); d.config.lembretes.ativos = false; global.App.salvar("Lembretes desligados.", { semIntegracao: true }); agendar(d); },
    "lembrete-teste": () => { notificar("🔔 Teste do Meu Controle", "Os lembretes estão funcionando.", "teste:" + Date.now()); },
    "exportar-ics": () => exportarICS()
  });
  global.App.registrarMudancas({
    "lem": (el) => { const d = global.App.dados(); d.config.lembretes[el.dataset.k] = el.checked; global.App.salvar(null, { semIntegracao: true }); agendar(d); },
    "lem-intervalo": (el) => { const d = global.App.dados(); d.config.lembretes.aguaIntervalo = Number(el.value) || 2; global.App.salvar(null, { semIntegracao: true }); agendar(d); }
  });

  // reagenda ao abrir e depois de cada registro (uma dose marcada não deve mais avisar)
  global.App.aoSalvar((d) => agendar(d));

  global.Lembretes = { agendar, ativar, notificar, gerarICS, exportarICS, cartaoAjustes, eventosDeHoje, permissao };
})(window);
