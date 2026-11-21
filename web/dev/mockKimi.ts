export interface MockOptions {
  tps: number;
  ttftMs: number;
  brokenRate: number;
  fencedRate: number;
  wildRate: number;
}

interface Genes {
  engage: number;
  flankAim: number;
  pincer: number;
  rushAfterShot: number;
  retreatHp: number;
  ambush: number;
  sneaky: number;
  squad: number;
}

type GeneKey = keyof Genes;

const RANGES: Record<GeneKey, [number, number, "int" | "bit" | "frac"]> = {
  engage: [128, 1400, "int"],
  flankAim: [0, 90, "int"],
  pincer: [0, 1, "bit"],
  rushAfterShot: [0, 40, "int"],
  retreatHp: [0, 0.8, "frac"],
  ambush: [0, 240, "int"],
  sneaky: [0, 1, "bit"],
  squad: [0, 2, "int"],
};

const ADJECTIVES = ["Pillar", "Ash", "Hollow", "Cinder", "Gutter", "Crooked", "Silent", "Ember", "Rust", "Grave", "Patient", "Split"];
const NOUNS = ["Saints", "Stalkers", "Choir", "Pack", "Lurkers", "Flankers", "Wardens", "Brood", "Jackals", "Widows", "Tide", "Coven"];

const pick = <T>(items: readonly T[], rng: () => number): T => items[Math.floor(rng() * items.length)]!;

function clampGene(key: GeneKey, value: number): number {
  const [min, max, kind] = RANGES[key];
  const v = Math.min(max, Math.max(min, value));
  return kind === "frac" ? Math.round(v * 100) / 100 : Math.round(v);
}

export function randomGenes(rng: () => number): Genes {
  const g = {} as Genes;
  for (const key of Object.keys(RANGES) as GeneKey[]) {
    const [min, max] = RANGES[key];
    g[key] = clampGene(key, min + rng() * (max - min));
  }
  return g;
}

function describe(key: GeneKey, g: Genes): string {
  switch (key) {
    case "engage":
      return `fights from about ${g.engage} units away`;
    case "flankAim":
      return g.flankAim > 0 ? "sidesteps whenever you aim at it" : "stops dodging your aim";
    case "pincer":
      return g.pincer ? "splits left and right to pincer you" : "circles you from one side";
    case "rushAfterShot":
      return g.rushAfterShot > 0 ? "rushes in right after you fire" : "ignores your shots";
    case "retreatHp":
      return g.retreatHp > 0.2 ? "backs off when badly hurt" : "never backs off";
    case "ambush":
      return g.ambush > 0 ? `lurks off-screen for ${(g.ambush / 35).toFixed(1)} s first` : "attacks on arrival";
    case "sneaky":
      return g.sneaky ? "only fires when you can't see it" : "fires whenever it has a shot";
    case "squad":
      return g.squad > 0 ? "waits for backup before pushing" : "pushes alone";
  }
}

export function breedGenes(a: Genes | null, b: Genes | null, rng: () => number): { genes: Genes; changed: GeneKey } {
  const base = a ?? b ?? randomGenes(rng);
  const other = b ?? a ?? base;
  const genes = {} as Genes;
  for (const key of Object.keys(RANGES) as GeneKey[]) genes[key] = rng() < 0.5 ? base[key] : other[key];

  const keys = Object.keys(RANGES) as GeneKey[];
  const changed = pick(keys, rng);
  const [min, max, kind] = RANGES[changed];
  const before = genes[changed];
  while (genes[changed] === before) {
    genes[changed] = kind === "bit" ? 1 - before : clampGene(changed, before + (rng() - 0.5) * (max - min) * 0.6);
  }
  return { genes, changed };
}

export function brainFromGenes(name: string, note: string, g: Genes): string {
  return `// NAME: ${name} | NOTE: ${note}
function think(s, mem, squad) {
  const G = ${JSON.stringify(g)};
  const side = G.pincer ? (s.uid % 2 ? "L" : "R") : "L";
  const offScreen = s.aimOffset > 45;
  if (s.hp < s.maxHp * G.retreatHp && s.hurtAgo < 70) return { move: "retreat", attack: s.canShoot };
  if (G.ambush > 0 && s.aliveTics < G.ambush && offScreen) return { move: "hold", attack: false };
  if (G.rushAfterShot > 0 && s.playerFiredAgo < G.rushAfterShot) return { move: "flank" + side, attack: true };
  if (s.canSee && s.aimOffset < G.flankAim) return { move: "strafe" + side, attack: s.canShoot && !G.sneaky };
  if (s.alliesNear < G.squad && s.dist > 400) return { move: "hold", attack: s.canShoot && !G.sneaky };
  const attack = s.canMelee || (s.canShoot && (!G.sneaky || offScreen));
  if (s.dist > G.engage) return { move: "advance", attack };
  if (s.dist < G.engage * 0.5) return { move: "retreat", attack };
  return { move: "flank" + side, attack };
}`;
}

const WILD: { name: string; note: string; body: string }[] = [
  {
    name: "Shot Baiters",
    note: "fakes a retreat, then charges while you reload",
    body: `function think(s, mem, squad) {
  mem.phase = (mem.phase || 0) + 1;
  if (s.playerFiredAgo < 25) return { move: s.uid % 2 ? "flankL" : "flankR", attack: true };
  if (mem.phase % 60 < 25) return { move: "retreat", attack: false };
  return { move: s.dist > 300 ? "advance" : "strafeL", attack: s.canShoot };
}`,
  },
  {
    name: "Orbit Choir",
    note: "circles you and switches direction every second",
    body: `function think(s, mem, squad) {
  mem.t = (mem.t || 0) + 1;
  if (mem.t % 12 === 0) mem.left = !mem.left;
  const move = s.dist > 700 ? "advance" : mem.left ? "strafeL" : "strafeR";
  return { move, attack: s.canShoot && s.aimOffset > 20 };
}`,
  },
  {
    name: "Pack Hunters",
    note: "one imp draws your aim while the rest flank",
    body: `function think(s, mem, squad) {
  if (!squad.bait || squad.baitSeen + 100 < s.aliveTics) {
    squad.bait = s.uid;
    squad.baitSeen = s.aliveTics;
  }
  if (squad.bait === s.uid) {
    squad.baitSeen = s.aliveTics;
    return { move: s.dist > 500 ? "advance" : "strafeL", attack: s.canShoot };
  }
  return { move: s.aimOffset < 60 ? "flankR" : "advance", attack: s.aimOffset > 45 && s.canShoot };
}`,
  },
];

const BROKEN: ((code: string) => string)[] = [
  (code) => code.slice(0, code.lastIndexOf("}")),
  (code) => code.replace(/"advance"/, '"charge"'),
  (code) => code.replace("function think(s, mem, squad) {\n", "function think(s, mem, squad) {\n  while (s.dist > 0) {}\n"),
  (code) => code.replace("{\n", '{\n  if (s.uid > 0) return { move: "hold", attack: 1 };\n'),
];

const PLAIN: Genes = { engage: 128, flankAim: 0, pincer: 0, rushAfterShot: 0, retreatHp: 0, ambush: 0, sneaky: 0, squad: 0 };

const SEED_GENES: Record<string, Genes> = {
  Charger: PLAIN,
  Turret: { ...PLAIN, engage: 1400 },
  Drunk: { ...PLAIN, engage: 700, flankAim: 45, pincer: 1 },
  Coward: { ...PLAIN, engage: 500, retreatHp: 0.6 },
};

function genesIn(text: string): Genes | null {
  const json = /const G = (\{[^}]*\});/.exec(text)?.[1];
  if (!json) return null;
  try {
    return JSON.parse(json) as Genes;
  } catch {
    return null;
  }
}

function readGenes(text: string): Genes[] {
  const out: Genes[] = [];
  for (const section of text.split(/^Parent [AB]: /m).slice(1)) {
    const name = /^"([^"]+)"/.exec(section)?.[1] ?? "";
    const genes = genesIn(section) ?? SEED_GENES[name];
    if (genes) out.push(genes);
  }
  const whole = out.length === 0 ? genesIn(text) : null;
  return whole ? [whole] : out;
}

export function mockReply(prompt: string, opts: MockOptions, rng: () => number = Math.random): string {
  const name = `${pick(ADJECTIVES, rng)} ${pick(NOUNS, rng)}`;
  if (prompt.startsWith("This imp brain was rejected")) {
    const [genes] = readGenes(prompt);
    return brainFromGenes(name, "fixed and back in the fight", genes ?? randomGenes(rng));
  }

  if (rng() < opts.wildRate) {
    const wild = pick(WILD, rng);
    return `// NAME: ${wild.name} | NOTE: ${wild.note}\n${wild.body}`;
  }

  const [a, b] = readGenes(prompt);
  const { genes, changed } = breedGenes(a ?? null, b ?? null, rng);
  const audience = /Audience request[^\n]*:\n"([^"]+)"/.exec(prompt)?.[1];
  const note = audience ? `audience: ${audience}` : describe(changed, genes);
  const code = brainFromGenes(name, note, genes);

  const roll = rng();
  if (roll < opts.brokenRate) return pick(BROKEN, rng)(code);
  if (roll < opts.brokenRate + opts.fencedRate) return `Here is the evolved brain:\n\n\`\`\`js\n${code}\n\`\`\`\n\nIt should outlast both parents.`;
  return code;
}

function tokenize(text: string): string[] {
  return text.match(/\s*[^\s]{1,4}|\s+/g) ?? [];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function streamMockReply(prompt: string, opts: MockOptions, write: (sse: string) => void, isClosed: () => boolean): Promise<void> {
  const tokens = tokenize(mockReply(prompt, opts));
  await sleep(opts.ttftMs);
  const start = Date.now();
  let sent = 0;
  while (sent < tokens.length && !isClosed()) {
    const due = Math.min(tokens.length, Math.floor(((Date.now() - start) * opts.tps) / 1000) + 1);
    if (due > sent) {
      const content = tokens.slice(sent, due).join("");
      sent = due;
      write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
    }
    if (sent < tokens.length) await sleep(10);
  }
  write(`data: ${JSON.stringify({ choices: [], usage: { completion_tokens: tokens.length } })}\n\n`);
  write("data: [DONE]\n\n");
}
