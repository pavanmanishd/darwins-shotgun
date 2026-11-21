import { describe, expect, it, vi } from "vitest";
import type { PlayerProfile, Species } from "../types";
import { breed } from "./breed";
import type { BreedMetrics } from "./client";

const parent = (id: number): Species => ({
  id,
  name: `P${id}`,
  note: "",
  gen: 1,
  parents: [],
  code: `function think(s) { return { move: "advance", attack: true }; } // parent ${id}`,
  scores: [],
  stats: { individuals: 0, damage: 0, flankDamage: 0, kills: 0, aliveTics: 0, deathsByWeapon: {} },
});

const profile: PlayerProfile = {
  favoriteWeapon: null,
  medianKillDist: null,
  crosshairKillShare: null,
  avgShotGapTics: null,
  damageFrom: { front: 0, side: 0, behind: 0 },
};

const metrics: BreedMetrics = { ttftMs: 1, totalMs: 2, completionTokens: 3, tokensPerSecond: 4 };
const GOOD = `// NAME: Ash Lurkers | NOTE: flank more\nfunction think(s) {\n  return { move: "flankL", attack: true };\n}`;
const BAD = `// NAME: Ash Lurkers | NOTE: flank more\nfunction think(s) {\n  while (true) {}\n}`;

function setup(replies: string[], errors: (string | null)[]) {
  const stream = vi.fn(async (_prompt: string, onToken: (t: string) => void) => {
    const text = replies.shift()!;
    onToken(text);
    return { text, metrics };
  });
  const validate = vi.fn(async () => errors.shift() ?? null);
  const onToken = vi.fn();
  const onAttempt = vi.fn();
  return { stream, validate, onToken, onAttempt };
}

const input = { a: parent(1), b: parent(2), profile };

describe("breed", () => {
  it("returns the child when the first reply validates", async () => {
    const deps = setup([GOOD], [null]);
    expect(await breed(input, deps)).toEqual({ ok: true, name: "Ash Lurkers", note: "flank more", code: GOOD, metrics: [metrics] });
    expect(deps.validate).toHaveBeenCalledWith(GOOD);
    expect(deps.onToken).toHaveBeenCalledWith(GOOD);
    expect(deps.onAttempt.mock.calls).toEqual([[1]]);
  });

  it("repairs once when validation fails", async () => {
    const deps = setup([BAD, GOOD], ["loop limit exceeded", null]);
    const outcome = await breed(input, deps);
    expect(outcome).toMatchObject({ ok: true, code: GOOD, metrics: [metrics, metrics] });
    const repairPrompt = deps.stream.mock.calls[1]![0];
    expect(repairPrompt).toContain(BAD);
    expect(repairPrompt).toContain("loop limit exceeded");
    expect(deps.onAttempt.mock.calls).toEqual([[1], [2]]);
  });

  it("repairs once when the reply has no function", async () => {
    const deps = setup(["I would rather not.", GOOD], [null]);
    expect(await breed(input, deps)).toMatchObject({ ok: true, code: GOOD });
    expect(deps.stream.mock.calls[1]![0]).toContain("I would rather not.");
  });

  it("is stillborn after two failures", async () => {
    const deps = setup([BAD, BAD], ["loop limit exceeded", "still loops"]);
    expect(await breed(input, deps)).toEqual({ ok: false, error: "still loops", metrics: [metrics, metrics] });
    expect(deps.stream).toHaveBeenCalledTimes(2);
  });

  it("lets network errors propagate", async () => {
    const deps = setup([], []);
    deps.stream.mockRejectedValueOnce(new Error("offline"));
    await expect(breed(input, deps)).rejects.toThrow("offline");
  });
});
