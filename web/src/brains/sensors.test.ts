import { describe, expect, it } from "vitest";
import { MOVES, SENSOR, SENSOR_COUNT, decodeSensors, packDecision } from "./sensors";

describe("packDecision", () => {
  it("puts the move index in the low bits and attack in bit 4", () => {
    expect(packDecision({ move: "advance", attack: false })).toBe(0);
    expect(packDecision({ move: "hold", attack: true })).toBe(MOVES.indexOf("hold") | 16);
  });
});

describe("decodeSensors", () => {
  it("maps raw slots to named fields", () => {
    const raw = new Int32Array(SENSOR_COUNT);
    raw[SENSOR.DIST] = 512;
    raw[SENSOR.AIM_OFFSET] = 60;
    raw[SENSOR.CAN_SEE] = 1;
    raw[SENSOR.PLAYER_WEAPON] = 2;
    const s = decodeSensors(raw, 7, 3);
    expect(s).toMatchObject({ uid: 7, dist: 512, aimOffset: 60, canSee: true, canMelee: false, playerWeapon: 2, alliesAlive: 3 });
  });
});
