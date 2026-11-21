import { describe, expect, it } from "vitest";
import { SEEDS } from "./seeds";

describe("SEEDS", () => {
  it("has the four starting brains", () => {
    expect(SEEDS.map((s) => s.name)).toEqual(["Charger", "Turret", "Drunk", "Coward"]);
  });

  it.each(SEEDS)("$name starts with its NAME | NOTE header and defines think", ({ name, note, code }) => {
    expect(code.split("\n")[0]).toBe(`// NAME: ${name} | NOTE: ${note}`);
    expect(code).toMatch(/^function think\(s, mem, squad\) \{$/m);
  });
});
