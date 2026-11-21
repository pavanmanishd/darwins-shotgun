import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = dirname(fileURLToPath(import.meta.url));
export const WEB = join(ROOT, "..", "web");
export const RESULTS = join(ROOT, "results");
export const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const POOL_KEY = "darwins-shotgun-pool";

export function startVite(config, port) {
  const env = { ...process.env };
  delete env.MOCK_KIMI_TPS;
  if (config.tps > 0) {
    env.MOCK_KIMI_TPS = String(config.tps);
    env.MOCK_KIMI_TTFT_MS = String(config.ttftMs);
  }
  const child = spawn(join(WEB, "node_modules", ".bin", "vite"), ["--port", String(port), "--strictPort"], { cwd: WEB, env });
  child.stderr.resume();
  return new Promise((resolve, reject) => {
    child.stdout.on("data", (d) => String(d).includes("Local:") && resolve(child));
    child.on("exit", (code) => reject(new Error(`vite exited ${code}`)));
  });
}

export async function instrument(page, pool = null) {
  await page.evaluateOnNewDocument((key, data) => {
    if (data) localStorage.setItem(key, data);
    else localStorage.removeItem(key);
    window.__sim = { deaths: 0, playerDeaths: 0, hits: 0, damage: 0, flankDamage: 0, spawns: 0, gameTics: 0, lastTic: 0, lifeStart: 0, lives: [] };
    const hook = setInterval(() => {
      const M = window.Module;
      if (!M?.brainEvent || M.__simHooked) return;
      M.__simHooked = true;
      const original = M.brainEvent;
      M.brainEvent = (kind, tic, a, b, c, d) => {
        const s = window.__sim;
        s.gameTics += tic >= s.lastTic ? tic - s.lastTic : tic;
        s.lastTic = tic;
        if (kind === 1) s.spawns++;
        if (kind === 2) {
          s.hits++;
          s.damage += b;
          if (c > 45) s.flankDamage += b;
        }
        if (kind === 3) s.deaths++;
        if (kind === 5) {
          s.playerDeaths++;
          s.lives.push(s.gameTics - s.lifeStart);
          s.lifeStart = s.gameTics;
        }
        return original(kind, tic, a, b, c, d);
      };
      clearInterval(hook);
    }, 5);
  }, POOL_KEY, pool ? JSON.stringify(pool) : null);
}
