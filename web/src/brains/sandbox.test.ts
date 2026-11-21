import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBrainHost, type BrainHost } from "./sandbox";
import type { Sensors } from "./sensors";

const sensors = (overrides: Partial<Sensors> = {}): Sensors => ({
  uid: 1,
  dist: 400,
  aimOffset: 45,
  canSee: true,
  canMelee: false,
  canShoot: true,
  hp: 60,
  maxHp: 60,
  hurtAgo: 1000,
  playerHp: 100,
  playerWeapon: 2,
  playerFiredAgo: 100,
  playerSpeed: 10,
  alliesNear: 1,
  alliesAlive: 3,
  aliveTics: 500,
  ...overrides,
});

const counter = (store: "mem" | "squad") => `
function think(s, mem, squad) {
  ${store}.n = (${store}.n || 0) + 1;
  return { move: ["hold", "advance", "retreat", "strafeL", "strafeR"][${store}.n], attack: false };
}`;

describe("brain host", () => {
  let host: BrainHost;
  const installed = new Set<number>();

  beforeEach(async () => {
    host = await createBrainHost();
  });

  afterEach(() => {
    for (const id of installed) host.remove(id);
    installed.clear();
  });

  const install = (id: number, code: string) => {
    installed.add(id);
    return host.install(id, code);
  };

  it("returns the decision from think", () => {
    expect(install(1, `function think(s) { return { move: s.dist > 300 ? "advance" : "hold", attack: s.canSee }; }`)).toBeNull();
    expect(host.think(1, sensors())).toEqual({ move: "advance", attack: true });
    expect(host.think(1, sensors({ dist: 100, canSee: false }))).toEqual({ move: "hold", attack: false });
  });

  it("returns null for a species that is not installed", () => {
    expect(host.think(42, sensors())).toBeNull();
  });

  it("keeps mem per uid and separate between uids", () => {
    install(1, counter("mem"));
    expect(host.think(1, sensors({ uid: 1 }))?.move).toBe("advance");
    expect(host.think(1, sensors({ uid: 1 }))?.move).toBe("retreat");
    expect(host.think(1, sensors({ uid: 2 }))?.move).toBe("advance");
    expect(host.think(1, sensors({ uid: 1 }))?.move).toBe("strafeL");
  });

  it("forgets a monster's mem", () => {
    install(1, counter("mem"));
    host.think(1, sensors({ uid: 5 }));
    host.think(1, sensors({ uid: 5 }));
    host.forget(1, 5);
    expect(host.think(1, sensors({ uid: 5 }))?.move).toBe("advance");
  });

  it("shares squad across uids of one species but not across species", () => {
    install(1, counter("squad"));
    install(2, counter("squad"));
    expect(host.think(1, sensors({ uid: 1 }))?.move).toBe("advance");
    expect(host.think(1, sensors({ uid: 2 }))?.move).toBe("retreat");
    expect(host.think(1, sensors({ uid: 3 }))?.move).toBe("strafeL");
    expect(host.think(2, sensors({ uid: 4 }))?.move).toBe("advance");
  });

  it("exposes no host globals", () => {
    install(
      1,
      `function think() {
        const leaked = [typeof process, typeof require, typeof fetch, typeof window, typeof document, typeof setTimeout];
        return { move: leaked.every((t) => t === "undefined") ? "hold" : "advance", attack: false };
      }`,
    );
    expect(host.think(1, sensors())?.move).toBe("hold");
  });

  it("interrupts an infinite loop quickly and keeps other species working", () => {
    install(1, `function think() { while (true) {} }`);
    install(2, `function think() { return { move: "hold", attack: true }; }`);
    const start = performance.now();
    expect(host.think(1, sensors())).toBeNull();
    expect(performance.now() - start).toBeLessThan(20);
    expect(host.think(2, sensors())).toEqual({ move: "hold", attack: true });
    expect(host.think(1, sensors())).toBeNull();
  });

  it("returns null on a memory bomb and survives it", () => {
    install(
      1,
      `function think(s) {
        if (s.dist > 1000) mem.huge = "x".repeat(4000000);
        return { move: "hold", attack: false };
      }
      var mem = {};`,
    );
    expect(host.think(1, sensors({ dist: 2000 }))).toBeNull();
    expect(host.think(1, sensors({ dist: 100 }))).toEqual({ move: "hold", attack: false });
  });

  it("returns null on runaway recursion", () => {
    install(1, `function think(s) { return think(s); }`);
    expect(host.think(1, sensors())).toBeNull();
  });

  it("returns null when think throws", () => {
    install(1, `function think(s) { return s.nope.deeper; }`);
    expect(host.think(1, sensors())).toBeNull();
  });

  it("returns null on an invalid shape", () => {
    install(1, `function think() { return { move: "charge", attack: true }; }`);
    install(2, `function think() { return { move: "hold", attack: 1 }; }`);
    install(3, `function think() { return "advance"; }`);
    expect(host.think(1, sensors())).toBeNull();
    expect(host.think(2, sensors())).toBeNull();
    expect(host.think(3, sensors())).toBeNull();
  });

  it("reports install errors", () => {
    expect(install(1, `function think( {`)).toMatch(/^syntax error: /);
    expect(install(2, `function other() {}`)).toBe("no function named think");
    expect(install(3, `throw new Error("boom"); function think() {}`)).toBe("threw Error: boom");
    expect(install(4, `while (true) {} function think() {}`)).toMatch(/^exceeded time budget/);
  });

  it("replaces a species brain on reinstall", () => {
    install(1, `function think() { return { move: "hold", attack: false }; }`);
    install(1, `function think() { return { move: "retreat", attack: true }; }`);
    expect(host.think(1, sensors())).toEqual({ move: "retreat", attack: true });
  });

  it("returns null after remove", () => {
    install(1, `function think() { return { move: "hold", attack: false }; }`);
    host.remove(1);
    expect(host.think(1, sensors())).toBeNull();
  });
});

describe("brain host with hostile installs", () => {
  it("reports a thrown promise as an error instead of crashing", async () => {
    const host = await createBrainHost();
    expect(host.install(1, "throw Promise.resolve(1); function think(){}")).toEqual(expect.any(String));
  });
});
