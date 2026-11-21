import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import puppeteer from "puppeteer-core";
import { CHROME, RESULTS, instrument, startVite } from "./lib.mjs";

const MINUTES = Number(process.env.MINUTES ?? 4);
const RUNS = Number(process.env.RUNS ?? 3);
const TICRATE = 35;

const [name = "seeds", poolFile] = process.argv.slice(2);
const pool = poolFile ? JSON.parse(await readFile(poolFile, "utf8")).finalPool : null;

async function runOnce(port) {
  const vite = await startVite({ tps: 0 }, port);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
    defaultViewport: { width: 1280, height: 720 },
  });
  try {
    const page = await browser.newPage();
    await instrument(page, pool);
    await page.goto(`http://localhost:${port}/?champions&autopilot`);
    await new Promise((r) => setTimeout(r, MINUTES * 60_000));
    return await page.evaluate(() => ({ ...window.__sim }));
  } finally {
    await browser.close();
    vite.kill();
  }
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const spread = (xs) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

await mkdir(RESULTS, { recursive: true });
const basePort = Number(process.env.PORT ?? 5600);
const runs = await Promise.all(Array.from({ length: RUNS }, (_, i) => runOnce(basePort + i)));

const perRun = runs.map((s) => {
  const minutes = s.gameTics / TICRATE / 60;
  return {
    gameMinutes: +minutes.toFixed(2),
    playerDeaths: s.playerDeaths,
    damageTakenPerMin: +(s.damage / minutes).toFixed(1),
    impKillsPerMin: +(s.deaths / minutes).toFixed(2),
    flankShare: s.damage ? +(s.flankDamage / s.damage).toFixed(3) : 0,
    lifeSeconds: s.lives.map((t) => +(t / TICRATE).toFixed(1)),
  };
});
const lives = perRun.flatMap((r) => r.lifeSeconds);
const summary = {
  name,
  pool: poolFile ?? "seeds",
  minutesPerRun: MINUTES,
  runs: RUNS,
  meanLifeSeconds: +mean(lives).toFixed(1),
  lifeSpreadSeconds: +spread(lives).toFixed(1),
  completedLives: lives.length,
  damageTakenPerMin: +mean(perRun.map((r) => r.damageTakenPerMin)).toFixed(1),
  damageTakenSpread: +spread(perRun.map((r) => r.damageTakenPerMin)).toFixed(1),
  impKillsPerMin: +mean(perRun.map((r) => r.impKillsPerMin)).toFixed(2),
  flankShare: +mean(perRun.map((r) => r.flankShare)).toFixed(3),
  perRun,
};
await writeFile(join(RESULTS, `bench-${name}.json`), JSON.stringify(summary, null, 2));
const { perRun: _, ...brief } = summary;
console.log(JSON.stringify(brief));
