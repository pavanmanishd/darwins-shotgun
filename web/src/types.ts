export const TICRATE = 35;

export type GameEvent =
  | { kind: "levelStart"; tic: number }
  | { kind: "spawn"; uid: number; species: number; tic: number }
  | { kind: "hitPlayer"; uid: number; damage: number; aimOffset: number; tic: number }
  | { kind: "death"; uid: number; playerWeapon: number; dist: number; aimOffset: number; tic: number }
  | { kind: "playerFire"; weapon: number; tic: number }
  | { kind: "playerDeath"; killer: number; tic: number };

export interface SpeciesStats {
  individuals: number;
  damage: number;
  flankDamage: number;
  kills: number;
  aliveTics: number;
  deathsByWeapon: Record<number, number>;
}

export interface AudienceMutation {
  text: string;
  handle?: string;
}

export interface Species {
  id: number;
  name: string;
  note: string;
  gen: number;
  parents: number[];
  code: string;
  scores: number[];
  stats: SpeciesStats;
  audience?: AudienceMutation;
}

export interface PlayerProfile {
  favoriteWeapon: number | null;
  medianKillDist: number | null;
  crosshairKillShare: number | null;
  avgShotGapTics: number | null;
  damageFrom: { front: number; side: number; behind: number };
}

export const WEAPON_NAMES = [
  "fist",
  "pistol",
  "shotgun",
  "chaingun",
  "rocket launcher",
  "plasma rifle",
  "BFG",
  "chainsaw",
  "super shotgun",
] as const;
