import { readFile, writeFile } from "node:fs/promises";

const [from, to, keep = "8"] = process.argv.slice(2);
if (!from || !to) throw new Error("usage: node export-pool.mjs <run.json> <out.json> [keep]");
const raw = JSON.parse(await readFile(from, "utf8"));
const pool = raw.finalPool ?? raw;
const all = pool.species.flatMap((s) => s.scores);
const prior = all.reduce((a, b) => a + b, 0) / Math.max(1, all.length);
const score = (s) => (s.scores.reduce((a, b) => a + b, 0) + 3 * prior) / (s.scores.length + 3);
const champions = pool.species
  .filter((s) => s.gen > 0 && s.scores.length >= 3)
  .sort((a, b) => score(b) - score(a))
  .slice(0, Number(keep));
await writeFile(to, JSON.stringify({ ...pool, living: [], ready: [], hallOfFame: champions.map((s) => s.id) }));
console.log(champions.map((s) => `${s.name} (gen ${s.gen}, ${s.scores.length} imps, ${score(s).toFixed(1)})`).join("\n"));
