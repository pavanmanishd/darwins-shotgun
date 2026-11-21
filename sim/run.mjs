import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import puppeteer from "puppeteer-core";
import { CHROME, POOL_KEY, RESULTS, instrument, startVite } from "./lib.mjs";

const MINUTES = Number(process.env.MINUTES ?? 6);
const SAMPLE_MS = 2000;

const CONFIGS = [
  { name: "cerebras-2000", tps: 2000, ttftMs: 200 },
  { name: "cerebras-1000", tps: 1000, ttftMs: 300 },
  { name: "gpu-150", tps: 150, ttftMs: 500 },
  { name: "gpu-50", tps: 50, ttftMs: 800 },
  { name: "seeds-only", tps: 0, ttftMs: 0 },
  { name: "kimi-openclaw", tps: 0, ttftMs: 0, real: true },
];

function sample(page) {
  return page.evaluate((key) => {
    const text = (id) => document.getElementById(id)?.textContent ?? "";
    return {
      t: performance.now(),
      pool: JSON.parse(localStorage.getItem(key) ?? "null"),
      events: { ...window.__sim },
      tps: text("tps"),
      ttft: text("ttft"),
      bred: text("bred"),
    };
  }, POOL_KEY);
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const genesOf = (code) => {
  const m = /const G = (\{[^}]*\});/.exec(code);
  return m ? JSON.parse(m[1]) : null;
};

function summarize(config, samples) {
  const last = samples[samples.length - 1];
  const species = last.pool?.species ?? [];
  const pooled = samples.filter((s) => s.pool);
  const emptySlotShare = mean(pooled.map((s) => (4 - s.pool.living.length) / 4));
  const gameMinutes = last.events.gameTics / 35 / 60;

  const byGen = new Map();
  for (const s of species) {
    if (!s.scores.length) continue;
    const bucket = s.gen === 0 ? "0" : s.gen <= 3 ? "1-3" : s.gen <= 7 ? "4-7" : s.gen <= 15 ? "8-15" : "16+";
    byGen.set(bucket, [...(byGen.get(bucket) ?? []), mean(s.scores)]);
  }

  const ordered = species.filter((s) => s.scores.length).sort((a, b) => a.id - b.id);
  const third = Math.max(1, Math.floor(ordered.length / 3));
  const early = mean(ordered.slice(0, third).map((s) => mean(s.scores)));
  const late = mean(ordered.slice(-third).map((s) => mean(s.scores)));

  const finalists = [...(last.pool?.living ?? []), ...(last.pool?.hallOfFame ?? [])]
    .map((id) => species.find((s) => s.id === id))
    .filter(Boolean);
  const genes = finalists.map((s) => genesOf(s.code)).filter(Boolean);
  const geneMeans = genes.length ? Object.fromEntries(Object.keys(genes[0]).map((k) => [k, +mean(genes.map((g) => g[k])).toFixed(2)])) : {};

  const bredMatch = /(\d+) bred · (\d+) stillborn/.exec(last.bred);
  const e = last.events;
  return {
    config,
    gameMinutes: +gameMinutes.toFixed(2),
    maxGen: Math.max(0, ...species.map((s) => s.gen)),
    speciesCreated: species.length,
    bred: Number(bredMatch?.[1] ?? 0),
    stillborn: Number(bredMatch?.[2] ?? 0),
    measuredTps: last.tps,
    measuredTtftMs: last.ttft,
    emptySlotShare: +emptySlotShare.toFixed(3),
    impsSpawned: e.spawns,
    impDeaths: e.deaths,
    playerDeaths: e.playerDeaths,
    damagePerGameMinute: gameMinutes ? +(e.damage / gameMinutes).toFixed(1) : 0,
    flankShare: e.damage ? +(e.flankDamage / e.damage).toFixed(3) : 0,
    fitnessByGen: Object.fromEntries([...byGen].map(([k, v]) => [k, { n: v.length, mean: +mean(v).toFixed(2) }])),
    fitnessEarly: +early.toFixed(2),
    fitnessLate: +late.toFixed(2),
    finalistGeneMeans: geneMeans,
    finalists: finalists.map((s) => ({ name: s.name, gen: s.gen, note: s.note, score: +mean(s.scores.slice(-3)).toFixed(1) })),
    timeline: samples.map((s) => ({
      seconds: Math.round((s.t - samples[0].t) / 1000),
      maxGen: Math.max(0, ...(s.pool?.species ?? []).map((sp) => sp.gen)),
      living: s.pool?.living?.length ?? 0,
      damage: s.events.damage,
    })),
  };
}

async function runOne(config, port) {
  const vite = await startVite(config, port);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
    defaultViewport: { width: 1920, height: 1080 },
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await instrument(page);
    const query = config.tps > 0 || config.real ? "?live&autopilot" : "?champions&autopilot";
    await page.goto(`http://localhost:${port}/${query}`);

    const samples = [];
    const end = Date.now() + MINUTES * 60_000;
    while (Date.now() < end) {
      await new Promise((r) => setTimeout(r, SAMPLE_MS));
      samples.push(await sample(page));
    }
    await page.screenshot({ path: join(RESULTS, `${config.name}.png`) });
    const summary = { ...summarize(config, samples), pageErrors: errors };
    await writeFile(join(RESULTS, `${config.name}.json`), JSON.stringify({ summary, finalPool: samples.at(-1).pool }, null, 2));
    return summary;
  } finally {
    await browser.close();
    vite.kill();
  }
}

await mkdir(RESULTS, { recursive: true });
const only = process.argv.slice(2);
const configs = only.length ? CONFIGS.filter((c) => only.includes(c.name)) : CONFIGS;
console.log(`Simulating ${configs.map((c) => c.name).join(", ")} for ${MINUTES} min each, in parallel`);
const settled = await Promise.allSettled(configs.map((c, i) => runOne(c, 5300 + i)));
const summaries = settled.filter((r) => r.status === "fulfilled").map((r) => r.value);
for (const r of settled) if (r.status === "rejected") console.error(r.reason);
await writeFile(join(RESULTS, "summary.json"), JSON.stringify(summaries, null, 2));
for (const s of summaries) {
  const { timeline, finalists, ...rest } = s;
  console.log(JSON.stringify(rest));
}
