// Gera dados/personagens.json: os personagens que aparecem em "Editar avatar".
// Roda no GitHub Actions (toda semana ou à mão) para o app não depender da
// velocidade das APIs de anime na hora de abrir a galeria.
// Fonte: AniList (https://anilist.co), com o id do MyAnimeList de cada anime.
import { mkdir, readFile, writeFile } from "node:fs/promises";

const SERIES = [
  [20, "Naruto"], [1735, "Naruto Shippuden"], [21, "One Piece"], [813, "Dragon Ball Z"], [38000, "Demon Slayer"],
  [40748, "Jujutsu Kaisen"], [16498, "Attack on Titan"], [31964, "My Hero Academia"], [52299, "Solo Leveling"],
  [52991, "Frieren"], [50265, "Spy x Family"], [44511, "Chainsaw Man"], [11061, "Hunter x Hunter"], [1535, "Death Note"],
  [5114, "Fullmetal Alchemist"], [30276, "One Punch Man"], [269, "Bleach"], [20583, "Haikyuu!!"], [527, "Pokémon"],
  [530, "Sailor Moon"], [22319, "Tokyo Ghoul"], [32182, "Mob Psycho 100"], [1575, "Code Geass"], [9253, "Steins;Gate"],
  [1, "Cowboy Bebop"], [49596, "Blue Lock"], [47917, "Bocchi the Rock!"], [52034, "Oshi no Ko"], [37999, "Kaguya-sama"], [57334, "Dandadan"]
];
const API = "https://graphql.anilist.co";
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function gql(query, variables, tentativa = 0) {
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query, variables }) });
  if ((r.status === 429 || r.status >= 500) && tentativa < 4) { await espera(5000 * (tentativa + 1)); return gql(query, variables, tentativa + 1); }
  const j = await r.json();
  if (j.errors && !j.data) throw new Error(JSON.stringify(j.errors).slice(0, 300));
  return j.data;
}
const PERS = "name { full } image { large } siteUrl";
function enxuto(c) {
  const u = c && c.image && c.image.large;
  if (!u || /default\.(jpg|png)$/i.test(u)) return null;
  return { n: c.name.full, u, l: c.siteUrl };
}

async function main() {
  const saida = { atualizado: new Date().toISOString(), fonte: "AniList", top: [], series: [] };
  const top = await gql(`query { Page(perPage: 40) { characters(sort: FAVOURITES_DESC) { ${PERS} } } }`);
  saida.top = top.Page.characters.map(enxuto).filter(Boolean);
  for (let i = 0; i < SERIES.length; i += 5) {
    const lote = SERIES.slice(i, i + 5);
    const q = `query { ${lote.map(([id]) => `m${id}: Media(idMal: ${id}, type: ANIME) { idMal title { romaji english } characters(sort: [ROLE, FAVOURITES_DESC], perPage: 20) { nodes { ${PERS} } } }`).join("\n")} }`;
    const d = await gql(q);
    for (const [id, nome] of lote) {
      const m = d["m" + id];
      if (!m) { console.warn("não achei", id, nome); continue; }
      const lista = m.characters.nodes.map(enxuto).filter(Boolean);
      console.log(id, nome, "→", m.title.english || m.title.romaji, lista.length);
      if (lista.length) saida.series.push({ id, t: nome, original: m.title.english || m.title.romaji, l: lista });
    }
    await espera(2500);
  }
  if (saida.top.length < 10 || saida.series.length < 10) throw new Error("poucos personagens — mantendo o arquivo anterior");
  const novo = JSON.stringify(saida);
  let antigo = "";
  try { antigo = await readFile("dados/personagens.json", "utf8"); } catch (e) { /* primeiro */ }
  const semData = (s) => s.replace(/"atualizado":"[^"]*"/, "");
  if (semData(antigo) === semData(novo)) { console.log("sem mudanças"); return; }
  await mkdir("dados", { recursive: true });
  await writeFile("dados/personagens.json", novo);
  console.log("gravado:", saida.top.length, "populares,", saida.series.length, "animes,", novo.length, "bytes");
}
main().catch((e) => { console.error(e); process.exit(1); });
