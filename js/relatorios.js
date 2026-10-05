/**
 * relatorios.js
 * -----------------------------------------------------------------------
 * Relatórios por período (diário, semanal, mensal, trimestral) e as
 * exportações: CSV, Excel (.xlsx gerado aqui mesmo, sem biblioteca e sem
 * internet) e PDF (pela impressão do navegador → "Salvar como PDF").
 *
 * Os números do relatório são os mesmos do resto do sistema: médias de
 * nutrição só consideram dias com refeições realizadas; gastos são o
 * preço pago dos itens comprados no período.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const N = global.Nucleo;
  const F = global.Fitness;
  const AL = global.Alimentacao;
  const C = global.Compras;

  const TIPOS = { diario: "Diário", semanal: "Semanal", mensal: "Mensal", trimestral: "Trimestral" };
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  function dataBR(iso) { return iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : ""; }
  function periodo(tipo, ancora) {
    ancora = ancora || N.hoje(0);
    let ini, fim, rotulo;
    if (tipo === "diario") { ini = fim = ancora; rotulo = N.NOMES_DIA[N.diaSemana(ancora)] + ", " + dataBR(ancora); }
    else if (tipo === "semanal") { ini = N.inicioSemana(ancora); fim = N.fimSemana(ancora); rotulo = "Semana de " + dataBR(ini) + " a " + dataBR(fim); }
    else if (tipo === "trimestral") {
      ini = N.inicioTrimestre(ancora); fim = N.fimTrimestre(ancora);
      rotulo = (Math.floor(Number(ini.slice(5, 7)) / 3) + 1) + "º trimestre de " + ini.slice(0, 4);
    } else { ini = N.inicioMes(ancora); fim = N.fimMes(ancora); const m = MESES[Number(ini.slice(5, 7)) - 1]; rotulo = m.charAt(0).toUpperCase() + m.slice(1) + " de " + ini.slice(0, 4); }
    return { tipo, ini, fim, rotulo, ancora };
  }
  function deslocar(tipo, ancora, passo) {
    if (tipo === "diario") return N.addDias(ancora, passo);
    if (tipo === "semanal") return N.addDias(ancora, 7 * passo);
    if (tipo === "trimestral") return N.addMeses(N.inicioMes(ancora), 3 * passo);
    return N.addMeses(N.inicioMes(ancora), passo);
  }

  function inicioFimSerie(d, chave, ini, fim) {
    const s = F.serie(d, chave);
    const dentro = s.filter((p) => N.entre(p.data, ini, fim));
    if (!dentro.length) return null;
    const antes = s.filter((p) => p.data < ini);
    const base = antes.length ? antes[antes.length - 1] : dentro[0];
    const ult = dentro[dentro.length - 1];
    return { inicio: base, fim: ult, delta: base === ult ? null : ult.valor - base.valor, media: N.media(dentro, (p) => p.valor), registros: dentro.length };
  }

  function gerar(d, tipo, ancora) {
    const p = periodo(tipo, ancora);
    const hj = N.hoje(0);
    const fimReal = p.fim > hj ? hj : p.fim;
    const r = { periodo: p, fimReal };
    r.peso = inicioFimSerie(d, "peso", p.ini, p.fim);
    r.massa = inicioFimSerie(d, "massaMuscular", p.ini, p.fim);
    r.gordura = inicioFimSerie(d, "gorduraPct", p.ini, p.fim);
    r.treinos = p.ini <= hj ? F.estatisticas(d, p.ini, p.fim) : { realizados: 0, perdidos: 0, futuros: 0, planejados: 0, taxa: null };
    r.volume = N.soma(F.treinosNoPeriodo(d, p.ini, p.fim).filter((t) => t.status === "Realizado"), (t) => F.volumeTreino(d, t.id));
    r.grupos = F.treinosPorGrupo(d, p.ini, p.fim);
    r.nutricao = {};
    ["kcal", "proteina", "carbo", "gordura", "fibra", "agua"].forEach((k) => { r.nutricao[k] = AL.mediaNutriente(d, k, p.ini, p.fim); });
    r.metas = AL.metasDiarias(d);
    r.diasComRefeicao = AL.diasComRegistro(d, p.ini, p.fim).length;
    r.gastos = C.gastoNoPeriodo(d, p.ini, p.fim);
    r.economia = C.economiaNoPeriodo(d, p.ini, p.fim);
    r.comprados = C.comprados(d, p.ini, p.fim);
    r.gastoPorCategoria = C.gastoPorCategoria(d, p.ini, p.fim);
    r.custoComido = AL.custoConsumido(d, p.ini, p.fim);
    r.medidas = F.METRICAS.filter((m) => m.fonte === "medidas" && ["massaMuscular", "gorduraPct"].indexOf(m.chave) === -1)
      .map((m) => Object.assign({ metrica: m }, inicioFimSerie(d, m.chave, p.ini, p.fim) || {})).filter((x) => x.fim);
    r.dias = N.intervalo(p.ini, p.fim).map((dia) => {
      const c = AL.consumoDoDia(d, dia);
      const ts = F.treinosDoDia(d, dia);
      const pe = F.pesagemDoDia(d, dia);
      return { data: dia, kcal: c.kcal, proteina: c.proteina, carbo: c.carbo, gordura: c.gordura, fibra: c.fibra, agua: c.agua, refeicoes: c.refeicoes,
        treino: ts.map((t) => t.nome + " (" + t.status.toLowerCase() + ")").join(", "), peso: pe ? Number(pe.peso) : null,
        gasto: C.gastoNoPeriodo(d, dia, dia) };
    });
    // comparação com o período anterior
    const ant = periodo(tipo, deslocar(tipo, p.ini, -1));
    r.anterior = {
      periodo: ant,
      gastos: C.gastoNoPeriodo(d, ant.ini, ant.fim),
      realizados: F.estatisticas(d, ant.ini, ant.fim).realizados,
      kcal: AL.mediaNutriente(d, "kcal", ant.ini, ant.fim).media,
      pesoMedio: (inicioFimSerie(d, "peso", ant.ini, ant.fim) || {}).media || null
    };
    return r;
  }

  // ---------------------------------------------------------------------
  // tabela "plana" do relatório (usada no CSV e no Excel)
  // ---------------------------------------------------------------------
  function linhasResumo(r) {
    const varTxt = (v) => "variação " + (v > 0 ? "+" : "") + Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    const nz = (v, casas) => v == null ? "" : N.arred(v, casas == null ? 1 : casas);
    const L = [["Relatório " + TIPOS[r.periodo.tipo].toLowerCase(), r.periodo.rotulo], ["Período", dataBR(r.periodo.ini) + " a " + dataBR(r.periodo.fim)], []];
    L.push(["Indicador", "Valor", "Observação"]);
    L.push(["Peso médio (kg)", nz(r.peso && r.peso.media), r.peso ? r.peso.registros + " pesagens" : "sem pesagens"]);
    L.push(["Variação de peso (kg)", nz(r.peso && r.peso.delta), r.peso && r.peso.delta != null ? dataBR(r.peso.inicio.data) + " → " + dataBR(r.peso.fim.data) : ""]);
    L.push(["Massa muscular (kg)", nz(r.massa && r.massa.fim.valor), r.massa && r.massa.delta != null ? varTxt(r.massa.delta) : ""]);
    L.push(["Gordura corporal (%)", nz(r.gordura && r.gordura.fim.valor), r.gordura && r.gordura.delta != null ? varTxt(r.gordura.delta) : ""]);
    L.push(["Treinos realizados", r.treinos.realizados, ""]);
    L.push(["Treinos perdidos", r.treinos.perdidos, "planejados e não realizados ou cancelados"]);
    L.push(["Frequência (%)", nz(r.treinos.taxa, 0), ""]);
    L.push(["Volume de treino (kg)", nz(r.volume, 0), "séries × repetições × carga"]);
    L.push(["Calorias médias (kcal/dia)", nz(r.nutricao.kcal.media, 0), r.nutricao.kcal.dias + " dias com registro"]);
    L.push(["Proteína média (g/dia)", nz(r.nutricao.proteina.media, 0), ""]);
    L.push(["Carboidratos médios (g/dia)", nz(r.nutricao.carbo.media, 0), ""]);
    L.push(["Gorduras médias (g/dia)", nz(r.nutricao.gordura.media, 0), ""]);
    L.push(["Água média (ml/dia)", nz(r.nutricao.agua.media, 0), r.nutricao.agua.dias + " dias com registro"]);
    L.push(["Gastos com alimentação (R$)", nz(r.gastos, 2), r.comprados.length + " itens comprados"]);
    L.push(["Economia vs estimado (R$)", nz(r.economia, 2), ""]);
    r.medidas.forEach((m) => L.push([m.metrica.rotulo + " (" + m.metrica.un + ")", nz(m.fim.valor), m.delta != null ? varTxt(m.delta) : ""]));
    return L;
  }
  function linhasDiarias(r) {
    const nz = (v, c) => (v == null || v === 0) ? "" : N.arred(v, c == null ? 0 : c);
    return [["Data", "Calorias (kcal)", "Proteína (g)", "Carboidratos (g)", "Gorduras (g)", "Fibras (g)", "Água (ml)", "Refeições realizadas", "Treino", "Peso (kg)", "Gasto (R$)"]]
      .concat(r.dias.map((x) => [dataBR(x.data), nz(x.kcal), nz(x.proteina), nz(x.carbo), nz(x.gordura), nz(x.fibra), nz(x.agua), x.refeicoes || "", x.treino, x.peso == null ? "" : N.arred(x.peso, 1), nz(x.gasto, 2)]));
  }

  // ---------------------------------------------------------------------
  // CSV (separador ";" e vírgula decimal — abre direto no Excel em pt-BR)
  // ---------------------------------------------------------------------
  function celulaCSV(v) {
    if (v == null) return "";
    let s = typeof v === "number" ? String(v).replace(".", ",") : String(v);
    if (/[";\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function paraCSV(linhas) { return "﻿" + linhas.map((l) => l.map(celulaCSV).join(";")).join("\r\n"); }
  function nomeArquivo(r, ext) { return "meu-controle-relatorio-" + r.periodo.tipo + "-" + r.periodo.ini + "." + ext; }
  function exportarCSV(r) {
    global.Armazenamento.baixarArquivo(nomeArquivo(r, "csv"), paraCSV(linhasResumo(r).concat([[], ["Detalhe por dia"]], linhasDiarias(r))), "text/csv;charset=utf-8");
  }

  // ---------------------------------------------------------------------
  // XLSX mínimo (zip sem compressão + SpreadsheetML)
  // ---------------------------------------------------------------------
  const CRC_TAB = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TAB[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(arquivos) {
    const enc = new TextEncoder();
    const partes = [], central = [];
    let offset = 0;
    const agora = new Date();
    const hora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | (agora.getSeconds() >> 1);
    const data = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
    arquivos.forEach((a) => {
      const nome = enc.encode(a.nome), dados = typeof a.dados === "string" ? enc.encode(a.dados) : a.dados;
      const crc = crc32(dados);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, hora, true); h.setUint16(12, data, true); h.setUint32(14, crc, true);
      h.setUint32(18, dados.length, true); h.setUint32(22, dados.length, true); h.setUint16(26, nome.length, true); h.setUint16(28, 0, true);
      partes.push(new Uint8Array(h.buffer), nome, dados);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, hora, true); c.setUint16(14, data, true); c.setUint32(16, crc, true); c.setUint32(20, dados.length, true); c.setUint32(24, dados.length, true);
      c.setUint16(28, nome.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true);
      c.setUint32(38, 0, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), nome);
      offset += 30 + nome.length + dados.length;
    });
    const tamCentral = central.reduce((s, x) => s + x.length, 0);
    const fim = new DataView(new ArrayBuffer(22));
    fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, arquivos.length, true); fim.setUint16(10, arquivos.length, true);
    fim.setUint32(12, tamCentral, true); fim.setUint32(16, offset, true);
    return new Blob(partes.concat(central, [new Uint8Array(fim.buffer)]), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  function xmlEsc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""); }
  function colLetra(i) { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function planilhaXML(linhas) {
    const larg = [];
    linhas.forEach((l) => l.forEach((v, i) => { larg[i] = Math.min(60, Math.max(larg[i] || 8, String(v == null ? "" : v).length + 2)); }));
    const cols = larg.length ? "<cols>" + larg.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("") + "</cols>" : "";
    const rows = linhas.map((l, r) => `<row r="${r + 1}">` + l.map((v, c) => {
      if (v == null || v === "") return "";
      const ref = colLetra(c) + (r + 1);
      const negrito = r === 0 ? ' s="1"' : "";
      if (typeof v === "number" && isFinite(v)) return `<c r="${ref}"${negrito}><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${negrito}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
    }).join("") + "</row>").join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${rows}</sheetData></worksheet>`;
  }
  // abas: [{nome, linhas: [[...]]}]
  function gerarXLSX(abas) {
    const nomes = abas.map((a, i) => xmlEsc(String(a.nome || "Planilha" + (i + 1)).replace(/[\\/?*[\]:]/g, " ").slice(0, 31)));
    const arquivos = [
      { nome: "[Content_Types].xml", dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        abas.map((a, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") + `</Types>` },
      { nome: "_rels/.rels", dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { nome: "xl/workbook.xml", dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
        nomes.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") + `</sheets></workbook>` },
      { nome: "xl/_rels/workbook.xml.rels", dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        abas.map((a, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
        `<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { nome: "xl/styles.xml", dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>` }
    ];
    abas.forEach((a, i) => arquivos.push({ nome: `xl/worksheets/sheet${i + 1}.xml`, dados: planilhaXML(a.linhas) }));
    return zip(arquivos);
  }
  function exportarXLSX(r) {
    global.Armazenamento.baixarArquivo(nomeArquivo(r, "xlsx"), gerarXLSX([{ nome: "Resumo", linhas: linhasResumo(r) }, { nome: "Por dia", linhas: linhasDiarias(r) }]));
  }

  // todos os dados, uma aba por coleção (Configurações → Exportar planilha)
  function exportarTudoXLSX(d) {
    const abas = [];
    const nomes = { usuarios: "Perfil", alimentos: "Alimentos", refeicoes: "Refeições", refeicaoItens: "Itens das refeições", favoritas: "Favoritas", agua: "Água",
      compras: "Compras", estoque: "Estoque", fichas: "Fichas", exercicios: "Exercícios das fichas", treinos: "Treinos", series: "Séries", planoSemanal: "Plano semanal",
      pesagens: "Pesagens", medidas: "Medidas", metas: "Metas" };
    Object.keys(nomes).forEach((k) => {
      const lista = d[k] || [];
      const cols = [];
      lista.forEach((x) => Object.keys(x).forEach((c) => { if (cols.indexOf(c) === -1) cols.push(c); }));
      const linhas = [cols.length ? cols : ["(vazio)"]].concat(lista.map((x) => cols.map((c) => {
        const v = x[c];
        if (v == null) return "";
        if (typeof v === "object") return JSON.stringify(v);
        return v;
      })));
      abas.push({ nome: nomes[k], linhas });
    });
    global.Armazenamento.baixarArquivo("meu-controle-dados-" + N.hoje(0) + ".xlsx", gerarXLSX(abas));
  }

  global.Relatorios = { TIPOS, periodo, deslocar, gerar, linhasResumo, linhasDiarias, paraCSV, exportarCSV, gerarXLSX, exportarXLSX, exportarTudoXLSX, crc32 };
})(window);
