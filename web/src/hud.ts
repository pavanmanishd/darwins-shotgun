import type { BreedOutcome } from "./breeder/breed";
import type { Director, DirectorListener } from "./evolution/director";
import type { AudienceMutation, Species } from "./types";

const CAPTION_MS = 9000;
const MAX_CAPTIONS = 3;
const LINEAGE_DEPTH = 4;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

export class Hud implements DirectorListener {
  private readonly code = byId<HTMLPreElement>("code");
  private readonly codeTitle = byId("code-title");
  private readonly captions = byId("captions");
  private focusedRequest = 0;
  private totalTokens = 0;
  private bredCount = 0;
  private stillbornCount = 0;
  private lastTps = 0;
  private lastTtft = 0;

  constructor(
    private readonly onMutation: (m: AudienceMutation) => void,
    private readonly showBrains = false,
  ) {
    const form = byId<HTMLFormElement>("mutation-form");
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const text = byId<HTMLInputElement>("mutation-text").value.trim();
      const handle = byId<HTMLInputElement>("mutation-handle").value.trim().replace(/^@/, "");
      if (!text) return;
      this.onMutation(handle ? { text, handle } : { text });
      form.reset();
      this.caption(`Mutation queued${handle ? ` from @${handle}` : ""}: ${text}`, "info");
    });
  }

  breedingStarted(requestId: number, a: Species, b: Species, attempt: 1 | 2): void {
    this.focusedRequest = requestId;
    this.code.textContent = "";
    this.codeTitle.textContent =
      attempt === 1 ? `Breeding ${a.name} (gen ${a.gen}) × ${b.name} (gen ${b.gen})` : `Repairing broken child of ${a.name} × ${b.name}`;
  }

  showBrain(s: Species): void {
    this.codeTitle.textContent = s.gen === 0 ? `Brain of ${s.name} · written by hand` : `Brain of ${s.name} · gen ${s.gen} · written by Kimi K3.1 Pro`;
    this.code.textContent = s.code;
    this.code.scrollTop = 0;
  }

  token(requestId: number, text: string): void {
    if (requestId !== this.focusedRequest) return;
    this.code.textContent += text;
    this.code.scrollTop = this.code.scrollHeight;
  }

  bred(_requestId: number, outcome: BreedOutcome): void {
    for (const m of outcome.metrics) this.totalTokens += m.completionTokens;
    const last = outcome.metrics[outcome.metrics.length - 1];
    if (last) {
      this.lastTps = last.tokensPerSecond;
      this.lastTtft = last.ttftMs;
    }
    if (outcome.ok) this.bredCount++;
    else {
      this.stillbornCount++;
      this.caption(`💀 Stillborn: ${outcome.error}`, "dead");
    }
  }

  arrived(s: Species, returning: boolean): void {
    if (this.showBrains) this.showBrain(s);
    if (s.gen === 0) return;
    if (returning) {
      this.caption(`🏆 Champion returns for a re-test · Gen ${s.gen} · ${s.name}`, "gen");
      return;
    }
    const credit = s.audience?.handle ? ` (mutation by @${s.audience.handle})` : "";
    this.caption(`Gen ${s.gen} · ${s.name}: ${s.note}${credit}`, "gen");
  }

  extinct(s: Species, reason: string): void {
    this.caption(`💀 ${s.name} went extinct: ${reason}`, "dead");
  }

  liveStopped(reason: string): void {
    byId("banner").textContent = `Live evolution paused (${reason}). Playing against the champions.`;
    byId("banner").hidden = false;
  }

  render(director: Director): void {
    const living = director.pool.living();
    byId("gen").textContent = String(director.pool.highestLivingGen());
    byId("alive").textContent = String(director.aliveCount());
    byId("mode").textContent = director.live ? "LIVE EVOLUTION" : "CHAMPIONS";
    byId("tps").textContent = this.lastTps ? Math.round(this.lastTps).toLocaleString() : "–";
    byId("ttft").textContent = this.lastTtft ? `${Math.round(this.lastTtft)}` : "–";
    byId("tokens").textContent = this.totalTokens.toLocaleString();
    byId("bred").textContent = `${this.bredCount} bred · ${this.stillbornCount} stillborn`;

    const rows = [...living].sort((a, b) => director.pool.score(b) - director.pool.score(a));
    byId("leaderboard").replaceChildren(
      ...rows.map((s) => {
        const tr = el("tr");
        tr.append(el("td", "name", s.name), el("td", "num", String(s.gen)), el("td", "num", director.pool.score(s).toFixed(1)));
        return tr;
      }),
    );

    byId("lineage").replaceChildren(...rows.map((s) => el("li", undefined, this.lineage(director, s))));
  }

  private lineage(director: Director, s: Species): string {
    const chain: string[] = [];
    let current: Species | undefined = s;
    for (let i = 0; current && i < LINEAGE_DEPTH; i++) {
      chain.push(`${current.name} g${current.gen}`);
      current = current.parents[0] === undefined ? undefined : director.pool.get(current.parents[0]);
    }
    return chain.join(" ← ");
  }

  private caption(text: string, kind: "gen" | "dead" | "info"): void {
    const line = el("div", `caption ${kind}`, text);
    this.captions.append(line);
    while (this.captions.children.length > MAX_CAPTIONS) this.captions.firstElementChild?.remove();
    setTimeout(() => line.remove(), CAPTION_MS);
  }
}
