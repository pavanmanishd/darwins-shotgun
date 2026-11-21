import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VIDEO = join(dirname(fileURLToPath(import.meta.url)), "..");
const SIM = join(VIDEO, "..", "sim", "results");
const DATA = join(VIDEO, "src", "data");
const POOL_FROM = process.env.POOL_FROM ?? join(SIM, "cerebras-2000.json");
const FAST_TPS = Number(process.env.FAST_TPS ?? 2000);
const FAST_TTFT_MS = Number(process.env.FAST_TTFT_MS ?? 200);
const MAX_TREE = 48;
const MONTAGE = 8;

const readJson = async (path) => (existsSync(path) ? JSON.parse(await readFile(path, "utf8")) : null);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const score = (s) => +mean(s.scores.slice(-3)).toFixed(1);
const genesOf = (code) => {
  const m = /const G = (\{[^}]*\});/.exec(code);
  return m ? JSON.parse(m[1]) : null;
};

const run = await readJson(POOL_FROM);
const pool = run.finalPool;
const clips = await readJson(join(DATA, "clips.json"));
const byId = new Map(pool.species.map((s) => [s.id, s]));
const finalists = [...pool.living, ...pool.hallOfFame].map((id) => byId.get(id)).filter((s) => s && s.scores.length);
const champion = [...finalists].sort((a, b) => b.gen - a.gen || score(b) - score(a))[0];
const topGen = Math.max(...pool.species.map((s) => s.gen));
const seeds = pool.species.filter((s) => s.gen === 0 && s.scores.length);

const tree = new Map();
const queue = [champion, ...finalists];
while (queue.length && tree.size < MAX_TREE) {
  const s = queue.shift();
  if (!s || tree.has(s.id)) continue;
  tree.set(s.id, s);
  for (const p of s.parents) if (byId.has(p)) queue.push(byId.get(p));
}
const nodes = [...tree.values()].map((s) => ({
  id: s.id,
  name: s.name,
  gen: s.gen,
  score: score(s),
  champion: s.id === champion.id,
  finalist: finalists.includes(s),
}));
const edges = [...tree.values()].flatMap((s) => s.parents.filter((p) => tree.has(p)).map((p) => [p, s.id]));

const lineage = [];
for (let s = champion; s; s = byId.get(s.parents[0])) lineage.unshift({ name: s.name, gen: s.gen, note: s.note });

const montage = [];
const seenNotes = new Set();
const candidates = pool.species
  .filter((s) => s.gen > 0 && s.note && !s.note.startsWith("fixed"))
  .sort((a, b) => score(b) - score(a));
for (const s of candidates) {
  const kind = s.note.replace(/[\d.]+/g, "#");
  if (seenNotes.has(kind)) continue;
  seenNotes.add(kind);
  montage.push({ name: s.name, gen: s.gen, note: s.note, score: score(s) });
  if (montage.length === MONTAGE) break;
}
montage.sort((a, b) => a.gen - b.gen);

let diff = null;
for (const child of [champion, ...finalists, ...pool.species.slice().reverse()]) {
  const parent = byId.get(child.parents[0]);
  const a = parent && genesOf(parent.code);
  const b = genesOf(child.code);
  if (!a || !b) continue;
  const changed = Object.keys(b).filter((k) => a[k] !== b[k]);
  if (!changed.length) continue;
  diff = {
    parent: { name: parent.name, gen: parent.gen, genes: a },
    child: { name: child.name, gen: child.gen, genes: b, note: child.note },
    changed,
  };
  break;
}

const prompts = clips?.["live-fast"]?.prompts ?? [];
const profileOf = (p) => {
  const m = /How the player plays:\n((?:- .*\n?)+)/.exec(p);
  return m ? m[1].trim().split("\n").map((l) => l.replace(/^- /, "")) : [];
};
const profile = prompts.map((p) => profileOf(p.prompt)).sort((a, b) => b.length - a.length)[0] ?? [];

const brainTokens = Math.round(mean(pool.species.filter((s) => s.gen > 0).map((s) => s.code.length / 3.6)));
const bench = {
  seeds: await readJson(join(SIM, "bench-seeds.json")),
  evolved: await readJson(join(SIM, "bench-evolved.json")),
};

const story = {
  rehearsal: process.env.REHEARSAL !== "0",
  minutes: run.summary?.gameMinutes ? Math.round(run.summary.gameMinutes) : null,
  topGen,
  speciesCreated: pool.species.length,
  champion: { name: champion.name, gen: champion.gen, note: champion.note, score: score(champion) },
  seedBest: Math.max(...seeds.map(score)),
  seedMean: +mean(seeds.map(score)).toFixed(1),
  finalistMean: +mean(finalists.map(score)).toFixed(1),
  championCode: champion.code,
  lineage,
  tree: { nodes, edges },
  montage,
  diff,
  profile,
  speed: { fast: FAST_TPS, slow: 50, fastTtftMs: FAST_TTFT_MS, slowTtftMs: 800, brainTokens, brainSeconds: +(brainTokens / FAST_TPS).toFixed(2) },
  bench: bench.seeds && bench.evolved ? bench : null,
};
await writeFile(join(DATA, "story.json"), JSON.stringify(story, null, 2));
console.log(JSON.stringify({ ...story, championCode: undefined, tree: { nodes: nodes.length, edges: edges.length } }, null, 1).slice(0, 3000));
