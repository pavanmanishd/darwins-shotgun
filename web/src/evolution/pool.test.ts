import { describe, expect, it } from "vitest";
import type { IndividualResult } from "./fitness";
import { GenePool } from "./pool";

function seed(pool: GenePool, name: string, parents: number[] = []) {
  return pool.createSpecies({ name, note: "", code: "", parents });
}

function result(species: number, fitness: number, playerWeapon = 1): IndividualResult {
  return { uid: 0, species, fitness, damage: 3, flankDamage: 1, kills: 1, aliveTics: 70, playerWeapon };
}

function sequence(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("GenePool", () => {
  it("assigns ids and generations", () => {
    const pool = new GenePool();
    const a = seed(pool, "a");
    const b = seed(pool, "b");
    const c = seed(pool, "c", [a.id, b.id]);
    const d = seed(pool, "d", [c.id, a.id]);
    expect([a.id, b.id, c.id, d.id]).toEqual([1, 2, 3, 4]);
    expect([a.gen, b.gen, c.gen, d.gen]).toEqual([0, 0, 1, 2]);
  });

  it("caps living species at four", () => {
    const pool = new GenePool();
    for (let i = 0; i < 5; i++) seed(pool, `s${i}`);
    for (let id = 1; id <= 4; id++) pool.addLiving(id);
    expect(() => pool.addLiving(5)).toThrow();
    expect(pool.isLiving(4)).toBe(true);
    expect(pool.isLiving(5)).toBe(false);
  });

  it("records results into scores and stats", () => {
    const pool = new GenePool();
    const s = seed(pool, "s");
    pool.record(result(s.id, 10, 2));
    pool.record(result(s.id, 20, 2));
    pool.record(result(s.id, 30, 5));
    expect(s.scores).toEqual([10, 20, 30]);
    expect(s.stats).toEqual({ individuals: 3, damage: 9, flankDamage: 3, kills: 3, aliveTics: 210, deathsByWeapon: { 2: 2, 5: 1 } });
  });

  it("keeps the best 10 retired species in the hall of fame", () => {
    const pool = new GenePool();
    for (let i = 1; i <= 12; i++) {
      const s = seed(pool, `s${i}`);
      pool.record(result(s.id, i));
      pool.addLiving(s.id);
      pool.retire(s.id);
    }
    expect(pool.living()).toEqual([]);
    expect(pool.hallOfFame().map((s) => s.id)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
  });

  it("ranks a species proven over many imps above one lucky imp", () => {
    const pool = new GenePool();
    const average = seed(pool, "average");
    for (let i = 0; i < 10; i++) pool.record(result(average.id, 10));
    const lucky = seed(pool, "lucky");
    pool.record(result(lucky.id, 60));
    const proven = seed(pool, "proven");
    for (let i = 0; i < 9; i++) pool.record(result(proven.id, 40));
    for (const s of [lucky, proven]) {
      pool.addLiving(s.id);
      pool.retire(s.id);
    }
    expect(pool.hallOfFame().map((s) => s.name)).toEqual(["proven", "lucky"]);
  });

  it("re-ranks a champion after a re-test", () => {
    const pool = new GenePool();
    const a = seed(pool, "a");
    const b = seed(pool, "b");
    pool.record(result(a.id, 50));
    pool.record(result(b.id, 40));
    for (const s of [a, b]) {
      pool.addLiving(s.id);
      pool.retire(s.id);
    }
    expect(pool.leastTestedChampion(new Set())?.name).toBe("a");
    pool.addLiving(a.id);
    for (let i = 0; i < 3; i++) pool.record(result(a.id, 0));
    pool.retire(a.id);
    expect(pool.hallOfFame().map((s) => s.name)).toEqual(["b", "a"]);
  });

  it("keeps retired elites selectable as parents", () => {
    const pool = new GenePool();
    const elite = seed(pool, "elite");
    pool.record(result(elite.id, 1000));
    pool.record(result(seed(pool, "average").id, 10));
    pool.addLiving(elite.id);
    pool.retire(elite.id);
    const weak = seed(pool, "weak");
    pool.addLiving(weak.id);
    expect(pool.pickParents(sequence(0, 0.99, 0.5))).toEqual([elite, weak]);
  });

  it("picks two distinct parents when possible", () => {
    const pool = new GenePool();
    for (let i = 0; i < 4; i++) {
      const s = seed(pool, `s${i}`);
      pool.record(result(s.id, 10 * i));
      pool.addLiving(s.id);
    }
    for (let trial = 0; trial < 50; trial++) {
      const [a, b] = pool.pickParents();
      expect(a).not.toBe(b);
    }
    const [best] = pool.pickParents(sequence(0, 0.3, 0.9));
    expect(best.id).toBe(4);
  });

  it("returns the only candidate twice", () => {
    const pool = new GenePool();
    const s = seed(pool, "only");
    pool.addLiving(s.id);
    expect(pool.pickParents()).toEqual([s, s]);
  });

  it("ignores ready species beyond eight", () => {
    const pool = new GenePool();
    const species = ["a", "b", "c", "d", "e", "f", "g", "h", "i"].map((n) => seed(pool, n));
    for (const s of species.slice(0, 8)) expect(pool.enqueueReady(s)).toBe(true);
    expect(pool.enqueueReady(species[8]!)).toBe(false);
    expect(pool.readyCount()).toBe(8);
    expect(pool.takeReady()).toBe(species[0]);
    for (let i = 0; i < 7; i++) pool.takeReady();
    expect(pool.takeReady()).toBeUndefined();
  });

  it("reports the highest living generation", () => {
    const pool = new GenePool();
    expect(pool.highestLivingGen()).toBe(0);
    const a = seed(pool, "a");
    const b = seed(pool, "b", [a.id]);
    const c = seed(pool, "c", [b.id]);
    pool.addLiving(a.id);
    pool.addLiving(b.id);
    expect(pool.highestLivingGen()).toBe(1);
    pool.addLiving(c.id);
    expect(pool.highestLivingGen()).toBe(2);
  });

  it("round-trips through JSON", () => {
    const pool = new GenePool();
    const a = seed(pool, "a");
    const b = pool.createSpecies({ name: "b", note: "n", code: "x", parents: [a.id], audience: { text: "faster", handle: "@p" } });
    const c = seed(pool, "c");
    const d = seed(pool, "d", [b.id, c.id]);
    pool.record(result(a.id, 12, 3));
    pool.addLiving(a.id);
    pool.retire(a.id);
    pool.addLiving(b.id);
    pool.enqueueReady(d);

    const restored = GenePool.fromJSON(JSON.parse(JSON.stringify(pool)));
    expect(restored.toJSON()).toEqual(pool.toJSON());
    expect(restored.takeReady()?.id).toBe(d.id);
    expect(restored.hallOfFame().map((s) => s.id)).toEqual([a.id]);
    expect(restored.get(a.id)?.stats.deathsByWeapon[3]).toBe(1);
    expect(seed(restored, "e").id).toBe(5);
  });
});
