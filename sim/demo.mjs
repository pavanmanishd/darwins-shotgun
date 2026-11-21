import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import puppeteer from "puppeteer-core";
import { CHROME, POOL_KEY, RESULTS, startVite } from "./lib.mjs";

const run = promisify(execFile);
const OUT = join(RESULTS, "demo");
const POOL_FROM = process.env.POOL_FROM ?? join(RESULTS, "cerebras-2000.json");
const FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf";
const FPS = 30;
const ENCODER = process.env.ENCODER ?? "h264_videotoolbox";

const FAST = { tps: 2000, ttftMs: 200 };
const SLOW = { tps: 50, ttftMs: 800 };
const NONE = { tps: 0, ttftMs: 0 };

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
    await page.goto(`http://localhost:${port}/${query}`);
    await new Promise((r) => setTimeout(r, warmupS * 1000));
    const path = join(OUT, `${name}.webm`);
    const recorder = await page.screencast({ path, fps: FPS });
    await new Promise((r) => setTimeout(r, seconds * 1000));
    await recorder.stop();
    return path;
  } finally {
    await browser.close();
    vite.kill();
  }
}

async function caption(file, text) {
  const path = join(OUT, `${file}.txt`);
  await writeFile(path, text);
  return path;
}

function drawText(textfile, { size = 46, y = "h-170", box = true } = {}) {
  const boxed = box ? ":box=1:boxcolor=black@0.72:boxborderw=18" : "";
  return `drawtext=fontfile='${FONT}':textfile='${textfile}':fontcolor=white:fontsize=${size}:x=(w-text_w)/2:y=${y}${boxed}`;
}

async function ffmpeg(args) {
  await run("ffmpeg", ["-y", "-loglevel", "error", ...args], { maxBuffer: 1 << 26 });
}

async function scene(name, input, filters, seconds) {
  const out = join(OUT, `${name}.mp4`);
  await ffmpeg(["-i", input, "-t", String(seconds), "-vf", [...filters, `fps=${FPS}`, "format=yuv420p"].join(","), "-an", "-c:v", ENCODER, "-b:v", "10M", out]);
  return out;
}

const pool = JSON.parse(await readFile(POOL_FROM, "utf8")).finalPool;
await mkdir(OUT, { recursive: true });
const tag = await caption("tag", "REHEARSAL CUT · simulated model at measured speeds");
const watermark = drawText(tag, { size: 22, y: "24", box: true });

console.log("recording clips…");
const gen0 = await record({ name: "gen0", model: NONE, query: "?champions&autopilot", warmupS: 4, seconds: 9, port: 5400 });
const stream = await record({ name: "stream", model: FAST, query: "?live&autopilot", warmupS: 6, seconds: 9, port: 5401 });
const [raceFast, raceSlow] = await Promise.all([
  record({ name: "race-fast", model: FAST, query: "?live&autopilot", warmupS: 3, seconds: 14, port: 5402 }),
  record({ name: "race-slow", model: SLOW, query: "?live&autopilot", warmupS: 3, seconds: 14, port: 5403 }),
]);
const champions = await record({ name: "champions", model: NONE, query: "?champions&autopilot", warmupS: 4, seconds: 11, pool, port: 5404 });

console.log("editing…");
const champ = pool.species.filter((s) => pool.living.includes(s.id) || pool.hallOfFame.includes(s.id));
const topGen = Math.max(...champ.map((s) => s.gen));

const scenes = [
  await scene("1-gen0", gen0, [watermark, drawText(await caption("c1", "GEN 0 · hand-written imps. They just run at you."))], 8),
  await scene("2-stream", stream, ["crop=960:540:960:0", "scale=1920:1080:flags=neighbor", watermark,
    drawText(await caption("c2", "Every new brain is JavaScript Kimi writes mid-fight. ~2,000 tok/s."))], 8),
];

const fastLabel = await caption("l1", "KIMI ON CEREBRAS · 2,000 tok/s");
const slowLabel = await caption("l2", "TYPICAL GPU SPEED · 50 tok/s");
const raceOut = join(OUT, "3-race.mp4");
await ffmpeg([
  "-i", raceFast, "-i", raceSlow, "-t", "13", "-filter_complex",
  [
    `[0:v]scale=960:540,${drawText(fastLabel, { size: 30, y: "20" })}[a]`,
    `[1:v]scale=960:540,${drawText(slowLabel, { size: 30, y: "20" })}[b]`,
    `[a][b]hstack=inputs=2,pad=1920:1080:0:270:black,${watermark},${drawText(await caption("c3", "Same game, slower model: monsters stand around waiting for their brains."), { size: 40, y: "h-150" })},fps=${FPS},format=yuv420p[v]`,
  ].join(";"),
  "-map", "[v]", "-an", "-c:v", ENCODER, "-b:v", "10M", raceOut,
]);
scenes.push(raceOut);

scenes.push(await scene("4-champions", champions, [watermark,
  drawText(await caption("c4", `GEN ${topGen} after 8 minutes: they dodge your aim and back off when hurt.`))], 10));

const endOut = join(OUT, "5-end.mp4");
await ffmpeg([
  "-f", "lavfi", "-i", `color=c=black:s=1920x1080:d=3:r=${FPS}`, "-vf",
  [drawText(await caption("e1", "DARWIN'S SHOTGUN"), { size: 96, y: "h/2-120", box: false }),
   drawText(await caption("e2", "Open-source DOOM engine + Kimi K3.1 Pro on Cerebras"), { size: 40, y: "h/2+20", box: false }),
   watermark, "format=yuv420p"].join(","),
  "-c:v", ENCODER, "-b:v", "10M", endOut,
]);
scenes.push(endOut);

const list = join(OUT, "scenes.txt");
await writeFile(list, scenes.map((s) => `file '${s}'`).join("\n"));
const final = join(OUT, "demo-rehearsal.mp4");
await ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", final]);
console.log(final);
