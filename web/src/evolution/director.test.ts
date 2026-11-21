import { describe, expect, it } from "vitest";
import type { BrainHost } from "../brains/sandbox";
import { SENSOR_COUNT } from "../brains/sensors";
import type { GameEvent } from "../types";
import { Director, type DirectorListener } from "./director";
import { GenePool } from "./pool";

const quiet: DirectorListener = {
  breedingStarted() {},
  token() {},
  bred() {},
  arrived() {},
  extinct() {},
  liveStopped() {},
};

function fakeHost(overrides: Partial<BrainHost> = {}): BrainHost {
  return {
    install: () => null,
    think: () => ({ move: "advance", attack: true }),
    forget() {},
    remove() {},
    ...overrides,
  };
}

function lifeAndDeath(director: Director, species: number, firstUid: number): void {
  const events: GameEvent[] = [];
  for (let i = 0; i < 3; i++) events.push({ kind: "spawn", uid: firstUid + i, species, tic: 0 });
  for (let i = 0; i < 3; i++) events.push({ kind: "death", uid: firstUid + i, playerWeapon: 2, dist: 100, aimOffset: 0, tic: 70 });
  for (const e of events) director.handle(e);
}

describe("Director", () => {
  it("retires a species after its three imps end and revives from the hall of fame in champions mode", () => {
    const pool = new GenePool();
    const director = new Director(pool, fakeHost(), quiet, false);
    const first = pool.living()[0]!;

    lifeAndDeath(director, first.id, 1);

    expect(pool.hallOfFame().map((s) => s.id)).toContain(first.id);
    expect(pool.living()).toHaveLength(4);
    expect(pool.living().map((s) => s.id)).toContain(first.id);
  });

  it("discards a species whose brain crashes instead of keeping it in the hall of fame", () => {
    const pool = new GenePool();
    const director = new Director(pool, fakeHost({ think: () => null }), quiet, false);
    const crashed = pool.living()[0]!;

    expect(director.think(1, crashed.id, new Int32Array(SENSOR_COUNT))).toBe(-1);
    lifeAndDeath(director, crashed.id, 1);

    expect(pool.hallOfFame().map((s) => s.id)).not.toContain(crashed.id);
    expect(crashed.scores).toEqual([]);
  });

  it("stops filling slots when every revival fails to install", () => {
    const pool = new GenePool();
    let installs = 0;
    const director = new Director(pool, fakeHost({ install: () => (++installs > 4 ? "broken" : null) }), quiet, false);
    const first = pool.living()[0]!;

    lifeAndDeath(director, first.id, 1);

    expect(pool.living()).toHaveLength(3);
  });
});
