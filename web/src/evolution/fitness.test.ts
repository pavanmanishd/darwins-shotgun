import { describe, expect, it } from "vitest";
import { TICRATE, type GameEvent } from "../types";
import { FitnessTracker, individualFitness, speciesScore } from "./fitness";

function run(tracker: FitnessTracker, events: GameEvent[]) {
  return events.flatMap((e) => tracker.handle(e));
}

describe("individualFitness", () => {
  it("counts a flank hit twice", () => {
    expect(individualFitness({ damage: 10, flankDamage: 10, kills: 0, aliveTics: 0 })).toBe(20);
  });

  it("caps the survival bonus at 60 seconds", () => {
    const at60 = individualFitness({ damage: 0, flankDamage: 0, kills: 0, aliveTics: 60 * TICRATE });
    const at600 = individualFitness({ damage: 0, flankDamage: 0, kills: 0, aliveTics: 600 * TICRATE });
    expect(at60).toBeCloseTo(12);
    expect(at600).toBeCloseTo(12);
  });

  it("weights kills at 25", () => {
    expect(individualFitness({ damage: 0, flankDamage: 0, kills: 2, aliveTics: 0 })).toBe(50);
  });
});

describe("speciesScore", () => {
  it("pulls a species with few scores toward the prior", () => {
    expect(speciesScore([40], 10)).toBe(17.5);
  });

  it("trusts a species more as its scores pile up", () => {
    expect(speciesScore([40, 40, 40, 40, 40, 40, 40, 40, 40], 10)).toBe(32.5);
  });

  it("is the prior with no scores", () => {
    expect(speciesScore([], 12)).toBe(12);
  });
});

describe("FitnessTracker", () => {
  it("reports a result on death with flank damage counted twice", () => {
    const results = run(new FitnessTracker(), [
      { kind: "spawn", uid: 1, species: 7, tic: 0 },
      { kind: "hitPlayer", uid: 1, damage: 10, aimOffset: 90, tic: 10 },
      { kind: "hitPlayer", uid: 1, damage: 5, aimOffset: 10, tic: 20 },
      { kind: "death", uid: 1, playerWeapon: 2, dist: 300, aimOffset: 5, tic: 10 * TICRATE },
    ]);
    expect(results).toEqual([
      { uid: 1, species: 7, fitness: 15 + 10 + 0.2 * 10, damage: 15, flankDamage: 10, kills: 0, aliveTics: 10 * TICRATE, playerWeapon: 2 },
    ]);
  });

  it("credits the killer and scores every survivor when the player dies", () => {
    const results = run(new FitnessTracker(), [
      { kind: "spawn", uid: 1, species: 1, tic: 0 },
      { kind: "spawn", uid: 2, species: 1, tic: 0 },
      { kind: "hitPlayer", uid: 1, damage: 50, aimOffset: 0, tic: 1 },
      { kind: "hitPlayer", uid: 2, damage: 10, aimOffset: 0, tic: 2 },
      { kind: "playerDeath", killer: 2, tic: 3 },
      { kind: "levelStart", tic: 0 },
    ]);
    expect(results.map((r) => [r.uid, r.kills, r.aliveTics, r.playerWeapon])).toEqual([
      [1, 0, 3, undefined],
      [2, 1, 3, undefined],
    ]);
  });

  it("scores leftovers at the last seen tic when a level starts", () => {
    const results = run(new FitnessTracker(), [
      { kind: "spawn", uid: 1, species: 1, tic: 10 },
      { kind: "hitPlayer", uid: 1, damage: 5, aimOffset: 0, tic: 80 },
      { kind: "levelStart", tic: 0 },
    ]);
    expect(results).toMatchObject([{ uid: 1, aliveTics: 70 }]);
  });

  it("ignores events from monsters it never saw spawn", () => {
    const results = run(new FitnessTracker(), [
      { kind: "hitPlayer", uid: 9, damage: 4, aimOffset: 0, tic: 10 },
      { kind: "death", uid: 9, playerWeapon: 0, dist: 0, aimOffset: 0, tic: 10 },
    ]);
    expect(results).toEqual([]);
  });
});
