import { describe, expect, it } from "vitest";
import { TICRATE, type GameEvent } from "../types";
import { ProfileTracker } from "./profile";

function profileOf(events: GameEvent[]) {
  const t = new ProfileTracker();
  for (const e of events) t.handle(e);
  return t.profile();
}

const kill = (playerWeapon: number, dist: number, aimOffset: number): GameEvent => ({ kind: "death", uid: 0, playerWeapon, dist, aimOffset, tic: 0 });
const fire = (tic: number): GameEvent => ({ kind: "playerFire", weapon: 1, tic });

describe("ProfileTracker", () => {
  it("is empty before anything happens", () => {
    expect(profileOf([])).toEqual({
      favoriteWeapon: null,
      medianKillDist: null,
      crosshairKillShare: null,
      avgShotGapTics: null,
      damageFrom: { front: 0, side: 0, behind: 0 },
    });
  });

  it("derives kill stats", () => {
    const p = profileOf([kill(2, 100, 0), kill(2, 300, 10), kill(1, 200, 40), kill(3, 900, 20)]);
    expect(p.favoriteWeapon).toBe(2);
    expect(p.medianKillDist).toBe(250);
    expect(p.crosshairKillShare).toBe(0.5);
  });

  it("only looks at the last 30 kills for distance and crosshair share", () => {
    const old = Array.from({ length: 30 }, () => kill(1, 5000, 90));
    const recent = Array.from({ length: 30 }, () => kill(2, 100, 0));
    const p = profileOf([...old, ...recent]);
    expect(p.medianKillDist).toBe(100);
    expect(p.crosshairKillShare).toBe(1);
  });

  it("ignores pauses between shots", () => {
    const p = profileOf([fire(0), fire(10), fire(30), fire(30 + 6 * TICRATE), fire(40 + 6 * TICRATE)]);
    expect(p.avgShotGapTics).toBeCloseTo((10 + 20 + 10) / 3);
  });

  it("does not measure a gap across a level restart", () => {
    const p = profileOf([fire(100), { kind: "levelStart", tic: 0 }, fire(0), fire(8)]);
    expect(p.avgShotGapTics).toBe(8);
  });

  it("buckets damage by direction", () => {
    const hit = (damage: number, aimOffset: number): GameEvent => ({ kind: "hitPlayer", uid: 0, damage, aimOffset, tic: 0 });
    const p = profileOf([hit(1, 0), hit(2, 44), hit(4, 45), hit(8, 135), hit(16, 136), hit(32, 180)]);
    expect(p.damageFrom).toEqual({ front: 7, side: 8, behind: 48 });
  });
});
