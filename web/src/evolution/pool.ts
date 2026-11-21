import type { AudienceMutation, Species } from "../types";
import { speciesScore, type IndividualResult } from "./fitness";

const MAX_LIVING = 4;
const MAX_READY = 8;
const HALL_SIZE = 10;
const TOURNAMENT = 3;

export interface GenePoolData {
  nextId: number;
  species: Species[];
  living: number[];
  hallOfFame: number[];
  ready: number[];
}

export class GenePool {
  private nextId = 1;
  private byId = new Map<number, Species>();
  private livingIds: number[] = [];
  private fameIds: number[] = [];
  private readyIds: number[] = [];

  createSpecies(input: { name: string; note: string; code: string; parents: number[]; audience?: AudienceMutation }): Species {
    const parentGens = input.parents.map((p) => this.byId.get(p)?.gen ?? 0);
    const s: Species = {
      id: this.nextId++,
      name: input.name,
      note: input.note,
      gen: parentGens.length ? Math.max(...parentGens) + 1 : 0,
      parents: [...input.parents],
      code: input.code,
      scores: [],
      stats: { individuals: 0, damage: 0, flankDamage: 0, kills: 0, aliveTics: 0, deathsByWeapon: {} },
      ...(input.audience ? { audience: input.audience } : {}),
    };
    this.byId.set(s.id, s);
    return s;
  }

  get(id: number): Species | undefined {
    return this.byId.get(id);
  }

  addLiving(id: number): void {
    if (!this.byId.has(id)) throw new Error(`unknown species ${id}`);
    if (this.livingIds.includes(id)) return;
    if (this.livingIds.length >= MAX_LIVING) throw new Error(`already ${MAX_LIVING} living species`);
    this.livingIds.push(id);
  }

  isLiving(id: number): boolean {
    return this.livingIds.includes(id);
  }

  living(): Species[] {
    return this.livingIds.map((id) => this.byId.get(id)!);
  }

  hallOfFame(): Species[] {
    return this.fameIds.map((id) => this.byId.get(id)!);
  }

  record(result: IndividualResult): void {
    const s = this.byId.get(result.species);
    if (!s) return;
    s.scores.push(result.fitness);
    const st = s.stats;
    st.individuals++;
    st.damage += result.damage;
    st.flankDamage += result.flankDamage;
    st.kills += result.kills;
    st.aliveTics += result.aliveTics;
    if (result.playerWeapon !== undefined) {
      st.deathsByWeapon[result.playerWeapon] = (st.deathsByWeapon[result.playerWeapon] ?? 0) + 1;
    }
  }

  score(s: Species): number {
    return speciesScore(s.scores, this.meanFitness());
  }

  retire(id: number): void {
    this.livingIds = this.livingIds.filter((l) => l !== id);
    if (!this.byId.has(id)) return;
    const prior = this.meanFitness();
    this.fameIds = [...new Set([...this.fameIds, id])]
      .sort((a, b) => speciesScore(this.byId.get(b)!.scores, prior) - speciesScore(this.byId.get(a)!.scores, prior))
      .slice(0, HALL_SIZE);
  }

  leastTestedChampion(exclude: Set<number>): Species | undefined {
    return this.hallOfFame()
      .filter((s) => !this.isLiving(s.id) && !exclude.has(s.id))
      .sort((a, b) => a.scores.length - b.scores.length)[0];
  }

  private meanFitness(): number {
    let sum = 0;
    let n = 0;
    for (const s of this.byId.values()) {
      for (const f of s.scores) sum += f;
      n += s.scores.length;
    }
    return n ? sum / n : 0;
  }

  discard(id: number): void {
    this.livingIds = this.livingIds.filter((l) => l !== id);
    this.fameIds = this.fameIds.filter((f) => f !== id);
  }

  enqueueReady(s: Species): boolean {
    if (this.readyIds.length >= MAX_READY) return false;
    this.readyIds.push(s.id);
    return true;
  }

  takeReady(): Species | undefined {
    const id = this.readyIds.shift();
    return id === undefined ? undefined : this.byId.get(id);
  }

  readyCount(): number {
    return this.readyIds.length;
  }

  pickParents(rng: () => number = Math.random): [Species, Species] {
    const candidates = [...new Set([...this.livingIds, ...this.fameIds])].map((id) => this.byId.get(id)!);
    if (candidates.length === 0) throw new Error("no candidates to breed from");
    const prior = this.meanFitness();
    const first = tournament(candidates, prior, rng);
    const rest = candidates.filter((c) => c !== first);
    return [first, rest.length ? tournament(rest, prior, rng) : first];
  }

  highestLivingGen(): number {
    return Math.max(0, ...this.living().map((s) => s.gen));
  }

  toJSON(): GenePoolData {
    return {
      nextId: this.nextId,
      species: [...this.byId.values()],
      living: [...this.livingIds],
      hallOfFame: [...this.fameIds],
      ready: [...this.readyIds],
    };
  }

  static fromJSON(data: GenePoolData): GenePool {
    const pool = new GenePool();
    pool.nextId = data.nextId;
    for (const s of data.species) pool.byId.set(s.id, s);
    pool.livingIds = [...data.living];
    pool.fameIds = [...data.hallOfFame];
    pool.readyIds = [...data.ready];
    return pool;
  }
}

function tournament(candidates: Species[], prior: number, rng: () => number): Species {
  let best: Species | undefined;
  for (let i = 0; i < TOURNAMENT; i++) {
    const c = candidates[Math.floor(rng() * candidates.length)]!;
    if (!best || speciesScore(c.scores, prior) > speciesScore(best.scores, prior)) best = c;
  }
  return best!;
}
