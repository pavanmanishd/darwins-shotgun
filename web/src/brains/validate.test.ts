import { describe, expect, it } from "vitest";
import { SEEDS } from "./seeds";
import { validateBrain } from "./validate";

describe("validateBrain", () => {
  it.each(SEEDS)("accepts the $name seed", async ({ code }) => {
    expect(await validateBrain(code)).toBeNull();
  });

  it("accepts a brain that uses mem and squad", async () => {
    const code = `function think(s, mem, squad) {
      mem.seen = (mem.seen || 0) + 1;
      squad.total = (squad.total || 0) + 1;
      return { move: mem.seen % 2 ? "flankL" : "flankR", attack: squad.total > 3 };
    }`;
    expect(await validateBrain(code)).toBeNull();
  });

  it("rejects an unknown move", async () => {
    expect(await validateBrain(`function think() { return { move: "charge", attack: true }; }`)).toBe(
      'returned move "charge" which is not one of advance, retreat, strafeL, strafeR, flankL, flankR, hold',
    );
  });

  it("rejects a non-boolean attack", async () => {
    expect(await validateBrain(`function think(s) { return { move: "hold", attack: s.canSee ? 1 : 0 }; }`)).toMatch(
      /^returned attack [01] which is not a boolean$/,
    );
  });

  it("rejects a non-object result", async () => {
    expect(await validateBrain(`function think() {}`)).toBe("returned undefined instead of an object { move, attack }");
  });

  it("rejects a syntax error", async () => {
    expect(await validateBrain(`function think(s) { return { move: "hold" attack: true }; }`)).toMatch(/^syntax error: /);
  });

  it("rejects code without think", async () => {
    expect(await validateBrain(`function brain() { return { move: "hold", attack: true }; }`)).toBe("no function named think");
  });

  it("rejects a brain that throws", async () => {
    expect(await validateBrain(`function think(s, mem) { return mem.plan.next(); }`)).toMatch(/^threw TypeError: /);
  });

  it("rejects slow code", async () => {
    const code = `function think(s) {
      let x = 0;
      for (let i = 0; i < 200000; i++) x += i % 7;
      return { move: "hold", attack: x > 0 };
    }`;
    expect(await validateBrain(code)).toMatch(/^exceeded time budget/);
  });

  it("rejects an infinite loop", async () => {
    expect(await validateBrain(`function think() { for (;;) {} }`)).toMatch(/^exceeded time budget/);
  });
});
