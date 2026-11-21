import type { BrainHost } from "../brains/sandbox";
import { SEEDS } from "../brains/seeds";
import { decodeSensors, packDecision } from "../brains/sensors";
import { validateBrain } from "../brains/validate";
import { breed, type BreedOutcome } from "../breeder/breed";
import { streamCompletion } from "../breeder/client";
import { MT_TROOP, type Engine } from "../engine";
import type { AudienceMutation, GameEvent, Species } from "../types";
import { FitnessTracker, type IndividualResult } from "./fitness";
import { GenePool } from "./pool";
import { ProfileTracker } from "./profile";

const INDIVIDUALS = 3;
const SPECIES_SLOTS = 4;
const READY_TARGET = 8;
const MAX_LIVE_FAILURES = 2;
const RETEST_EVERY = 4;

export interface DirectorListener {
  breedingStarted(requestId: number, a: Species, b: Species, attempt: 1 | 2): void;
  token(requestId: number, text: string): void;
  bred(requestId: number, outcome: BreedOutcome): void;
  arrived(s: Species, returning: boolean): void;
  extinct(s: Species, reason: string): void;
  liveStopped(reason: string): void;
}

export interface Thought {
  species: Species;
  decision: number;
}

interface Incarnation {
  remaining: number;
  alive: number;
}

export class Director {
  private readonly fitness = new FitnessTracker();
  private readonly profile = new ProfileTracker();
  private readonly incarnations = new Map<number, Incarnation>();
  private readonly extinct = new Set<number>();
  private readonly mutations: AudienceMutation[] = [];
  private readonly decisions = new Map<number, { species: number; decision: number }>();
  private inFlight = 0;
  private liveFailures = 0;
  private nextRequestId = 1;
  private fills = 0;
  private engine: Engine | null = null;

  constructor(
    readonly pool: GenePool,
    private readonly host: BrainHost,
    private readonly listener: DirectorListener,
    private liveMode: boolean,
  ) {
    if (pool.living().length === 0 && pool.hallOfFame().length === 0) {
      for (const seed of SEEDS) pool.addLiving(pool.createSpecies({ ...seed, parents: [] }).id);
    }
    for (const s of pool.living()) {
      if (!this.incarnate(s)) pool.discard(s.id);
    }
  }

  attach(engine: Engine): void {
    this.engine = engine;
  }

  get live(): boolean {
    return this.liveMode;
  }

  setLive(on: boolean): void {
    this.liveMode = on;
    this.liveFailures = 0;
  }

  queueMutation(m: AudienceMutation): void {
    this.mutations.push(m);
  }

  aliveCount(): number {
    let n = 0;
    for (const inc of this.incarnations.values()) n += inc.alive;
    return n;
  }

  think(uid: number, species: number, raw: Int32Array): number {
    if (this.extinct.has(species)) return -1;
    const decision = this.host.think(species, decodeSensors(raw, uid, this.incarnations.get(species)?.alive ?? 0));
    if (decision) {
      const packed = packDecision(decision);
      this.decisions.set(uid, { species, decision: packed });
      return packed;
    }
    const s = this.pool.get(species);
    const inc = this.incarnations.get(species);
    this.extinct.add(species);
    this.host.remove(species);
    if (s) this.listener.extinct(s, "brain crashed or ran out of time");
    if (inc) inc.remaining = inc.alive;
    return -1;
  }

  thought(uid: number): Thought | null {
    const d = this.decisions.get(uid);
    const species = d && this.pool.get(d.species);
    return d && species ? { species, decision: d.decision } : null;
  }

  handle(e: GameEvent): void {
    this.profile.handle(e);
    if (e.kind === "spawn") {
      const inc = this.incarnations.get(e.species);
      if (inc) inc.alive++;
    }
    for (const r of this.fitness.handle(e)) this.ended(r);
  }

  tick(): void {
    this.breedIfNeeded();
    this.fillSlots();
    this.spawnPending();
  }

  private incarnate(s: Species): boolean {
    const error = this.host.install(s.id, s.code);
    if (error) {
      this.listener.extinct(s, error);
      return false;
    }
    this.extinct.delete(s.id);
    this.incarnations.set(s.id, { remaining: INDIVIDUALS, alive: 0 });
    return true;
  }

  private ended(r: IndividualResult): void {
    if (!this.extinct.has(r.species)) this.pool.record(r);
    this.host.forget(r.species, r.uid);
    this.decisions.delete(r.uid);
    const inc = this.incarnations.get(r.species);
    if (!inc) return;
    inc.alive--;
    inc.remaining--;
    if (inc.remaining <= 0) this.retire(r.species);
  }

  private retire(id: number): void {
    this.incarnations.delete(id);
    this.host.remove(id);
    if (this.extinct.has(id)) this.pool.discard(id);
    else this.pool.retire(id);
    this.fillSlots();
  }

  private fillSlots(): void {
    const tried = new Set<number>();
    while (this.pool.living().length < SPECIES_SLOTS) {
      const retest = this.live && this.fills % RETEST_EVERY === RETEST_EVERY - 1 ? this.pool.leastTestedChampion(tried) : undefined;
      const next = retest ?? this.pool.takeReady() ?? (this.live ? undefined : this.revival(tried));
      if (!next) return;
      this.fills++;
      tried.add(next.id);
      this.pool.addLiving(next.id);
      if (this.incarnate(next)) this.listener.arrived(next, next === retest);
      else this.pool.discard(next.id);
    }
  }

  private revival(tried: Set<number>): Species | undefined {
    const candidates = this.pool.hallOfFame().filter((s) => !this.pool.isLiving(s.id) && !tried.has(s.id));
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private breedIfNeeded(): void {
    if (!this.live) return;
    while (this.pool.readyCount() + this.inFlight < READY_TARGET) {
      this.inFlight++;
      void this.breedOne().finally(() => this.inFlight--);
    }
  }

  private async breedOne(): Promise<void> {
    const [a, b] = this.pool.pickParents();
    const mutation = this.mutations.shift();
    const requestId = this.nextRequestId++;
    try {
      const outcome = await breed(
        { a, b, profile: this.profile.profile(), ...(mutation ? { mutation } : {}) },
        {
          stream: streamCompletion,
          validate: validateBrain,
          onToken: (t) => this.listener.token(requestId, t),
          onAttempt: (n) => this.listener.breedingStarted(requestId, a, b, n),
        },
      );
      this.liveFailures = 0;
      this.listener.bred(requestId, outcome);
      if (outcome.ok) {
        const child = this.pool.createSpecies({
          name: outcome.name,
          note: outcome.note,
          code: outcome.code,
          parents: [a.id, b.id],
          ...(mutation ? { audience: mutation } : {}),
        });
        this.pool.enqueueReady(child);
      }
    } catch (err) {
      if (mutation) this.mutations.unshift(mutation);
      if (++this.liveFailures >= MAX_LIVE_FAILURES && this.liveMode) {
        this.liveMode = false;
        this.listener.liveStopped(err instanceof Error ? err.message : String(err));
      }
    }
  }

  private spawnPending(): void {
    if (!this.engine) return;
    for (const [species, inc] of [...this.incarnations]) {
      if (inc.remaining <= 0) {
        this.retire(species);
        continue;
      }
      if (inc.alive < inc.remaining) this.engine.spawnMonster(MT_TROOP, species);
    }
  }
}
