import { describe, expect, it } from "vitest";
import type { PlayerProfile, Species } from "../types";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";

const species = (over: Partial<Species>): Species => ({
  id: 1,
  name: "Ember Stalkers",
  note: "",
  gen: 2,
  parents: [],
  code: "function think(s, mem, squad) { return { move: 'advance', attack: true }; }",
  scores: [],
  stats: { individuals: 0, damage: 0, flankDamage: 0, kills: 0, aliveTics: 0, deathsByWeapon: {} },
  ...over,
});

const a = species({
  name: "Ember Stalkers",
  note: "flank on shotgun",
  code: "function think(s) { return { move: 'flankL', attack: true }; } // A",
  scores: [100, 10, 20, 30],
  stats: { individuals: 4, damage: 80, flankDamage: 20, kills: 1, aliveTics: 4 * 35 * 12, deathsByWeapon: { 2: 3, 3: 1 } },
});
const b = species({ name: "Ash Lurkers", code: "function think(s) { return { move: 'hold', attack: false }; } // B" });

const profile: PlayerProfile = {
  favoriteWeapon: 8,
  medianKillDist: 320,
  crosshairKillShare: null,
  avgShotGapTics: null,
  damageFrom: { front: 40, side: 12, behind: 3 },
};

describe("buildUserPrompt", () => {
  it("includes both parents' code and stats in plain words", () => {
    const p = buildUserPrompt({ a, b, profile });
    expect(p).toContain(a.code);
    expect(p).toContain(b.code);
    expect(p).toContain("Score: 40 (mean of 4 runs)");
    expect(p).toContain("Damage per imp: 20");
    expect(p).toContain("outside the player's view: 25%");
    expect(p).toContain("Average lifetime: 12 s");
    expect(p).toContain("Killed most by: shotgun (3), chaingun (1)");
    expect(p).toContain("Score: not scored yet");
    expect(p).toContain("no deaths recorded");
  });

  it("describes the player and skips null profile fields", () => {
    const p = buildUserPrompt({ a, b, profile });
    expect(p).toContain("Favourite weapon: super shotgun");
    expect(p).toContain("about 320 map units (5 wall tiles)");
    expect(p).toContain("front 40, side 12, behind 3");
    expect(p).not.toContain("crosshair");
    expect(p).not.toContain("Fires about");
  });

  it("asks the child to honour an audience mutation", () => {
    const p = buildUserPrompt({ a, b, profile, mutation: { text: "only attack from behind", handle: "@zed" } });
    expect(p).toContain("Audience request from @zed, which the child must honour");
    expect(p).toContain('"only attack from behind"');
    expect(buildUserPrompt({ a, b, profile })).not.toContain("Audience request");
  });

  it("asks for a fix instead of a child when repairing", () => {
    const p = buildUserPrompt({ a, b, profile, repairOf: { code: "function think( {", error: "SyntaxError: unexpected token" } });
    expect(p).toContain("function think( {");
    expect(p).toContain("SyntaxError: unexpected token");
    expect(p).toContain("NAME/NOTE line");
    expect(p).not.toContain(a.code);
  });
});

describe("SYSTEM_PROMPT", () => {
  it("states the contract and output format", () => {
    expect(SYSTEM_PROMPT).toContain("function think(s, mem, squad)");
    expect(SYSTEM_PROMPT).toContain("// NAME: <2-3 word species name> | NOTE: <what changed, max 10 words>");
  });
});
