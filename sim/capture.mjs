import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import puppeteer from "puppeteer-core";
import { CHROME, POOL_KEY, RESULTS, ROOT, startVite } from "./lib.mjs";

const run = promisify(execFile);
const VIDEO = join(ROOT, "..", "video");
const CLIPS = join(VIDEO, "public", "clips");
const DATA = join(VIDEO, "src", "data");
const POOL_FROM = process.env.POOL_FROM ?? join(RESULTS, "cerebras-2000.json");
const FPS = 30;
const ENCODER = process.env.ENCODER ?? "h264_videotoolbox";

const FAST = { tps: 2000, ttftMs: 200 };
const SLOW = { tps: 50, ttftMs: 800 };
const NONE = { tps: 0, ttftMs: 0 };
const FILM = "?champions&autopilot&film&thoughts";
const LIVE = "?live&autopilot&thoughts";

const rect = (page, selector) =>
  page.$eval(selector, (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });

async function record({ name, model, query, warmupS, seconds, pool, port }) {
  const vite = await startVite(model, port);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
    defaultViewport: { width: 1920, height: 1080 },
  });
  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(
      (key, data) => (data ? localStorage.setItem(key, data) : localStorage.removeItem(key)),
      POOL_KEY,
      pool ? JSON.stringify(pool) : null,
    );
    const prompts = [];
    let startedAt = 0;
    page.on("request", (req) => {
      if (!req.url().endsWith("/api/breed") || !startedAt) return;
      const prompt = JSON.parse(req.postData() ?? "{}").prompt;
      if (prompt) prompts.push({ at: (Date.now() - startedAt) / 1000, prompt });
    });
    await page.goto(`http://localhost:${port}/${query}`);
    await page.waitForSelector("#canvas");
    await new Promise((r) => setTimeout(r, warmupS * 1000));
    const webm = join(CLIPS, `${name}.webm`);
    const recorder = await page.screencast({ path: webm, fps: FPS });
    startedAt = Date.now();
    const hud = [];
    while (Date.now() - startedAt < seconds * 1000) {
      const at = (Date.now() - startedAt) / 1000;
      const text = await page.evaluate(() => ({
        bred: document.getElementById("bred")?.textContent ?? "",
        tokens: document.getElementById("tokens")?.textContent ?? "",
        gen: document.getElementById("gen")?.textContent ?? "",
      }));
      hud.push({
        at: +at.toFixed(2),
        bred: Number(/(\d+) bred/.exec(text.bred)?.[1] ?? 0),
        tokens: Number(text.tokens.replace(/\D/g, "") || 0),
        gen: Number(text.gen || 0),
      });
      await new Promise((r) => setTimeout(r, 200));
    }
    await recorder.stop();
    const finalPool = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), POOL_KEY);
    const layout = { screen: await rect(page, ".screen"), panel: query.includes("film") ? null : await rect(page, ".panel") };

    const mp4 = join(CLIPS, `${name}.mp4`);
    await run("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-r", String(FPS), "-vf", "format=yuv420p", "-c:v", ENCODER, "-b:v", "16M", "-g", String(FPS), mp4]);
    await rm(webm);
    return { name, file: `clips/${name}.mp4`, seconds, layout, prompts, hud, finalPool };
  } finally {
    await browser.close();
    vite.kill();
  }
}

const pool = JSON.parse(await readFile(POOL_FROM, "utf8")).finalPool;
await mkdir(CLIPS, { recursive: true });
await mkdir(DATA, { recursive: true });

console.log("recording gameplay…");
const shots = [];
shots.push(await record({ name: "gen0", model: NONE, query: FILM, warmupS: 3, seconds: 14, port: 5500 }));
shots.push(await record({ name: "evolved-a", model: NONE, query: FILM, warmupS: 4, seconds: 16, pool, port: 5501 }));
shots.push(await record({ name: "evolved-b", model: NONE, query: FILM, warmupS: 22, seconds: 16, pool, port: 5502 }));
console.log("recording the speed race…");
shots.push(
  ...(await Promise.all([
    record({ name: "live-fast", model: FAST, query: LIVE, warmupS: 2, seconds: 20, port: 5503 }),
    record({ name: "live-slow", model: SLOW, query: LIVE, warmupS: 2, seconds: 20, port: 5504 }),
  ])),
);

const manifest = Object.fromEntries(shots.map(({ finalPool, ...s }) => [s.name, s]));
await writeFile(join(DATA, "clips.json"), JSON.stringify(manifest, null, 2));
await writeFile(join(DATA, "race-pools.json"), JSON.stringify({ fast: shots.at(-2).finalPool, slow: shots.at(-1).finalPool }));
console.log(Object.keys(manifest).join(", "));
