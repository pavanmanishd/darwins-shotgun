export interface Seed {
  name: string;
  note: string;
  code: string;
}

function seed(name: string, note: string, body: string): Seed {
  return { name, note, code: `// NAME: ${name} | NOTE: ${note}\n${body}\n` };
}

export const SEEDS: Seed[] = [
  seed(
    "Charger",
    "runs straight at you, firing the whole way",
    `function think(s, mem, squad) {
  return { move: "advance", attack: true };
}`,
  ),
  seed(
    "Turret",
    "stands still and shoots whenever it sees you",
    `function think(s, mem, squad) {
  return { move: "hold", attack: s.canSee };
}`,
  ),
  seed(
    "Drunk",
    "stumbles in a random direction every step",
    `function think(s, mem, squad) {
  const moves = ["advance", "retreat", "strafeL", "strafeR", "flankL", "flankR", "hold"];
  return { move: moves[Math.floor(Math.random() * moves.length)], attack: Math.random() < 0.3 };
}`,
  ),
  seed(
    "Coward",
    "backs off for a couple of seconds after taking a hit",
    `function think(s, mem, squad) {
  if (s.hurtAgo < 70) return { move: "retreat", attack: s.canShoot };
  return { move: "advance", attack: s.canShoot };
}`,
  ),
];
