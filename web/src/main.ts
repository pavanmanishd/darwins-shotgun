import { chooseArena, Survival } from "./arena";
import { createBrainHost } from "./brains/sandbox";
import { startEngine } from "./engine";
import { Director } from "./evolution/director";
import { GenePool, type GenePoolData } from "./evolution/pool";
import { Hud } from "./hud";
import { Thoughts } from "./thoughts";

const STORAGE_KEY = "darwins-shotgun-pool";
const TICK_MS = 500;
const RENDER_MS = 1000;

function loadSaved(): GenePoolData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GenePoolData) : null;
  } catch {
    return null;
  }
}

function save(pool: GenePool): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pool.toJSON()));
  } catch {
    // Storage can be full or blocked; the export button still works.
  }
}

async function loadChampions(): Promise<GenePoolData | null> {
  try {
    const res = await fetch("/champions.json");
    return res.ok ? ((await res.json()) as GenePoolData) : null;
  } catch {
    return null;
  }
}

function download(pool: GenePool): void {
  const blob = new Blob([JSON.stringify(pool.toJSON(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `gene-pool-gen${pool.highestLivingGen()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const live = params.has("live") || (import.meta.env.DEV && !params.has("champions") && !params.has("vs"));
  const arenaMode = !live && !params.has("champions");
  document.body.classList.toggle("arena", arenaMode);
  const arena = arenaMode ? await chooseArena(params) : null;
  const data = arena ? arena.data : (loadSaved() ?? (await loadChampions()));
  const pool = data ? GenePool.fromJSON(data) : new GenePool();
  const host = await createBrainHost();

  const hud = new Hud((m) => d.queueMutation(m), arena !== null);
  const d = new Director(pool, host, hud, live);
  const first = pool.living()[0];
  if (arena && first) hud.showBrain(first);
  const survival = arena ? new Survival(arena) : null;

  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const hint = document.getElementById("click-to-play")!;
  canvas.addEventListener("focus", () => (hint.hidden = true));
  canvas.addEventListener("blur", () => (hint.hidden = false));
  hint.addEventListener("click", () => canvas.focus());

  document.getElementById("export")!.addEventListener("click", () => download(pool));
  document.getElementById("live-toggle")!.addEventListener("click", () => {
    d.setLive(!d.live);
    document.getElementById("banner")!.hidden = true;
  });
  document.getElementById("import")!.addEventListener("change", async (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      GenePool.fromJSON(JSON.parse(text) as GenePoolData);
      localStorage.setItem(STORAGE_KEY, text);
      location.reload();
    } catch (err) {
      alert(`Could not import: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  if (params.has("film")) document.body.classList.add("film");
  const thoughts = new Thoughts(document.getElementById("thoughts")!, (uid) => d.thought(uid));
  thoughts.enabled = params.has("thoughts");
  document.getElementById("thoughts-toggle")!.addEventListener("click", () => (thoughts.enabled = !thoughts.enabled));

  const engine = await startEngine(canvas, {
    think: (uid, species, sensors) => d.think(uid, species, sensors),
    event: (e) => {
      d.handle(e);
      survival?.handle(e);
    },
    labels: (data, count) => thoughts.update(data, count),
  });
  d.attach(engine);
  canvas.focus();

  let autopilot = params.has("autopilot");
  engine.setAutopilot(autopilot);
  document.getElementById("autopilot")!.addEventListener("click", () => {
    autopilot = !autopilot;
    engine.setAutopilot(autopilot);
  });

  setInterval(() => d.tick(), TICK_MS);
  setInterval(() => {
    hud.render(d);
    if (!arena) save(pool);
  }, RENDER_MS);
}

void main();
