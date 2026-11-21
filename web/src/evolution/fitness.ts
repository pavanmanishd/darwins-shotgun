import { TICRATE, type GameEvent } from "../types";

export const FLANK_OFFSET = 45;

export interface IndividualResult {
  uid: number;
  species: number;
  fitness: number;
  damage: number;
  flankDamage: number;
  kills: number;
  aliveTics: number;
  playerWeapon?: number;
}

interface Individual {
  species: number;
  spawnTic: number;
  damage: number;
  flankDamage: number;
  kills: number;
}

export function individualFitness(r: { damage: number; flankDamage: number; kills: number; aliveTics: number }): number {
  const aliveSeconds = Math.min(r.aliveTics / TICRATE, 60);
  return r.damage + r.flankDamage + 25 * r.kills + 0.2 * aliveSeconds;
}

const PRIOR_WEIGHT = 3;

// A species judged on few imps is pulled toward the population mean, so one lucky fight can't crown it.
export function speciesScore(scores: number[], prior = 0): number {
  const sum = scores.reduce((a, b) => a + b, 0);
  return (sum + PRIOR_WEIGHT * prior) / (scores.length + PRIOR_WEIGHT);
}

function result(uid: number, ind: Individual, endTic: number, playerWeapon?: number): IndividualResult {
  const r = { damage: ind.damage, flankDamage: ind.flankDamage, kills: ind.kills, aliveTics: endTic - ind.spawnTic };
  return { uid, species: ind.species, fitness: individualFitness(r), ...r, ...(playerWeapon === undefined ? {} : { playerWeapon }) };
}

export class FitnessTracker {
  private alive = new Map<number, Individual>();
  private lastTic = 0;

  handle(e: GameEvent): IndividualResult[] {
    const ended = e.kind === "levelStart" ? this.endAll(this.lastTic) : [];
    this.lastTic = e.tic;
    switch (e.kind) {
      case "spawn":
        this.alive.set(e.uid, { species: e.species, spawnTic: e.tic, damage: 0, flankDamage: 0, kills: 0 });
        return ended;
      case "hitPlayer": {
        const ind = this.alive.get(e.uid);
        if (!ind) return ended;
        ind.damage += e.damage;
        if (e.aimOffset > FLANK_OFFSET) ind.flankDamage += e.damage;
        return ended;
      }
      case "playerDeath": {
        const killer = this.alive.get(e.killer);
        if (killer) killer.kills++;
        return this.endAll(e.tic);
      }
      case "death": {
        const ind = this.alive.get(e.uid);
        if (!ind) return ended;
        this.alive.delete(e.uid);
        return [result(e.uid, ind, e.tic, e.playerWeapon)];
      }
      default:
        return ended;
    }
  }

  private endAll(tic: number): IndividualResult[] {
    const out = [...this.alive].map(([uid, ind]) => result(uid, ind, tic));
    this.alive.clear();
    return out;
  }
}
