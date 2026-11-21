import { ATTACK_BIT, MOVES, type Move } from "./brains/sensors";
import { LABEL_FIELDS } from "./engine";
import type { Thought } from "./evolution/director";

const SCREEN_W = 320;
const SCREEN_H = 200;
const SCALE_ONE = 256;
const COLORS = ["#ff4d1a", "#4dd0ff", "#c6ff4d", "#ff4dd2", "#ffd24d", "#9d7bff"];

const MOVE_TEXT: Record<Move, string> = {
  advance: "CHARGING",
  retreat: "BACKING OFF",
  strafeL: "◀ SIDESTEP",
  strafeR: "SIDESTEP ▶",
  flankL: "◀ FLANKING",
  flankR: "FLANKING ▶",
  hold: "WAITING",
};

export class Thoughts {
  private readonly nodes = new Map<number, HTMLElement>();
  enabled = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly lookup: (uid: number) => Thought | null,
  ) {}

  update(data: Int32Array, count: number): void {
    const seen = new Set<number>();
    if (this.enabled) {
      for (let i = 0; i < count; i++) {
        const [uid, x, y, scale] = data.subarray(i * LABEL_FIELDS, (i + 1) * LABEL_FIELDS) as unknown as number[];
        const thought = this.lookup(uid!);
        if (!thought) continue;
        seen.add(uid!);
        this.place(this.node(uid!), thought, x!, y!, scale! / SCALE_ONE);
      }
    }
    for (const [uid, node] of this.nodes) {
      if (seen.has(uid)) continue;
      node.remove();
      this.nodes.delete(uid);
    }
  }

  private node(uid: number): HTMLElement {
    let node = this.nodes.get(uid);
    if (!node) {
      node = document.createElement("div");
      node.className = "thought";
      node.innerHTML = '<span class="who"></span><span class="what"></span>';
      this.root.appendChild(node);
      this.nodes.set(uid, node);
    }
    return node;
  }

  private place(node: HTMLElement, t: Thought, x: number, y: number, scale: number): void {
    const move = MOVES[t.decision & ~ATTACK_BIT] ?? "hold";
    const attack = (t.decision & ATTACK_BIT) !== 0;
    node.style.left = `${(x / SCREEN_W) * 100}%`;
    node.style.top = `${(y / SCREEN_H) * 100}%`;
    node.style.setProperty("--s", String(Math.min(1.2, Math.max(0.55, Math.sqrt(scale)))));
    node.style.setProperty("--c", COLORS[t.species.id % COLORS.length]!);
    node.classList.toggle("attack", attack);
    node.children[0]!.textContent = t.species.name;
    node.children[1]!.textContent = attack ? `${MOVE_TEXT[move]} · FIRE` : MOVE_TEXT[move];
  }
}
