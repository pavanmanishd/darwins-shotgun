import { TICRATE, type GameEvent } from "./types";
import type { GenePoolData } from "./evolution/pool";

export type ArenaId = "gen0" | "evolved";

export interface Arena {
  id: ArenaId;
  label: string;
  data: GenePoolData | null;
}

const BEST_KEY = "darwins-shotgun-best";

async function fetchPool(path: string): Promise<GenePoolData | null> {
  try {
    const res = await fetch(path);
    return res.ok ? ((await res.json()) as GenePoolData) : null;
  } catch {
    return null;
  }
}

function topGen(data: GenePoolData | null): number {
  return data ? Math.max(0, ...data.species.map((s) => s.gen)) : 0;
}

export async function chooseArena(params: URLSearchParams): Promise<Arena> {
  const evolved = await fetchPool("/pools/evolved.json");
  const arenas: Record<ArenaId, Arena> = {
    gen0: { id: "gen0", label: "Gen 0", data: null },
    evolved: { id: "evolved", label: `Gen ${topGen(evolved)}`, data: evolved },
  };
  const asked = params.get("vs");
  if (asked === "gen0" || (asked === "evolved" && evolved)) return arenas[asked];

  const picker = document.getElementById("arena-picker")!;
  document.getElementById("arena-evolved-gen")!.textContent = arenas.evolved.label;
  document.getElementById("arena-evolved")!.toggleAttribute("disabled", !evolved);
  picker.hidden = false;
  document.body.classList.add("picking");
  const id = await new Promise<ArenaId>((resolve) => {
    picker.addEventListener("click", (ev) => {
      const choice = (ev.target as HTMLElement).closest<HTMLButtonElement>("button[data-arena]");
      if (choice && !choice.disabled) resolve(choice.dataset.arena as ArenaId);
    });
  });
  picker.hidden = true;
  document.body.classList.remove("picking");
  const url = new URL(location.href);
  url.searchParams.set("vs", id);
  history.replaceState(null, "", url);
  return arenas[id];
}

function readBest(arena: ArenaId): number {
  try {
    return Number(localStorage.getItem(`${BEST_KEY}-${arena}`)) || 0;
  } catch {
    return 0;
  }
}

function writeBest(arena: ArenaId, seconds: number): void {
  try {
    localStorage.setItem(`${BEST_KEY}-${arena}`, String(seconds));
  } catch {
    // A best time that can't be stored only costs the player their record.
  }
}

export class Survival {
  private lifeStart: number | null = null;
  private kills = 0;
  private shareUrl = "";
  private readonly card = document.getElementById("death-card")!;

  constructor(private readonly arena: Arena) {
    document.getElementById("death-share")!.addEventListener("click", () => window.open(this.shareUrl, "_blank", "noopener"));
  }

  handle(e: GameEvent): void {
    if (e.kind === "levelStart" || this.lifeStart === null) {
      this.lifeStart = e.tic;
      this.kills = 0;
      this.card.hidden = true;
    }
    if (e.kind === "death") this.kills++;
    if (e.kind === "playerDeath") this.died((e.tic - this.lifeStart) / TICRATE);
  }

  private died(seconds: number): void {
    const best = Math.max(readBest(this.arena.id), seconds);
    writeBest(this.arena.id, best);
    const s = seconds.toFixed(1);
    const imps = this.kills === 1 ? "1 imp" : `${this.kills} imps`;
    document.getElementById("death-time")!.textContent = `${s} s`;
    document.getElementById("death-detail")!.textContent = `${imps} killed · vs ${this.arena.label} · best ${best.toFixed(1)} s`;
    const brains = this.arena.id === "gen0" ? "hand-written brains" : "brains evolved by Kimi K3.1 Pro on @Cerebras";
    const text = `I lasted ${s} s and killed ${imps} against ${this.arena.label} DOOM imps with ${brains}. Can you beat it? #KimiOnCerebras`;
    const link = new URL(location.pathname, location.origin);
    link.searchParams.set("vs", this.arena.id);
    this.shareUrl = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link.toString())}`;
    this.card.hidden = false;
  }
}
