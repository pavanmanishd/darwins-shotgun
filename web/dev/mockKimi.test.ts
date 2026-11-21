import { describe, expect, it } from "vitest";
import { validateBrain } from "../src/brains/validate";
import { parseBrain } from "../src/breeder/parse";
import { brainFromGenes, breedGenes, mockReply, randomGenes, type MockOptions } from "./mockKimi";

function seeded(seed: number): () => number {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

const clean: MockOptions = { tps: 1000, ttftMs: 0, brokenRate: 0, fencedRate: 0, wildRate: 0 };

describe("mock Kimi", () => {
  it("writes valid brains for any genome", async () => {
    const rng = seeded(7);
    for (let i = 0; i < 40; i++) {
      expect(await validateBrain(brainFromGenes("Test Brood", "note", randomGenes(rng)))).toBeNull();
    }
  });

  it("breeds children from both parents' genes plus one mutation", () => {
    const rng = seeded(3);
    const a = randomGenes(rng) as unknown as Record<string, number>;
    const b = randomGenes(rng) as unknown as Record<string, number>;
    const brain = (name: string, g: Record<string, number>) => brainFromGenes(name, "n", g as never);
    const prompt = `Parent A: "A"\nCode:\n${brain("A", a)}\n\nParent B: "B"\nCode:\n${brain("B", b)}`;
    const child = parseBrain(mockReply(prompt, clean, rng));
    const genes = JSON.parse(/const G = (\{[^}]*\});/.exec(child!.code)![1]!) as Record<string, number>;
    const fromNeither = Object.keys(a).filter((k) => genes[k] !== a[k] && genes[k] !== b[k]);
    expect(fromNeither.length).toBeLessThanOrEqual(1);
  });

  it("ignores parent genes that are not strict JSON", () => {
    const prompt = 'Parent A: "A"\nCode:\nfunction think(s) {\n  const G = { engage: 500 };\n}\n';
    expect(() => mockReply(prompt, clean, seeded(1))).not.toThrow();
  });

  it("repairs a rejected brain back into valid code", async () => {
    const rng = seeded(11);
    const broken = brainFromGenes("X", "y", randomGenes(rng)).replace('"advance"', '"charge"');
    const reply = mockReply(`This imp brain was rejected with this error:\nbad move\n\nCode:\n${broken}`, clean, rng);
    expect(await validateBrain(parseBrain(reply)!.code)).toBeNull();
  });

  it("produces broken code at roughly the configured rate", async () => {
    const rng = seeded(5);
    const opts = { ...clean, brokenRate: 0.3 };
    let rejected = 0;
    for (let i = 0; i < 60; i++) {
      const parsed = parseBrain(mockReply("", opts, rng));
      if (!parsed || (await validateBrain(parsed.code)) !== null) rejected++;
    }
    expect(rejected).toBeGreaterThan(8);
    expect(rejected).toBeLessThan(30);
  });

  it("always changes the mutated gene", () => {
    const rng = seeded(9);
    for (let i = 0; i < 200; i++) {
      const a = randomGenes(rng);
      const { genes, changed } = breedGenes(a, a, rng);
      expect(genes[changed]).not.toBe(a[changed]);
    }
  });
});

describe("mock Kimi with seed parents", () => {
  it("reads a seed parent as its equivalent genome", () => {
    const rng = seeded(13);
    const prompt = `Parent A: "Charger" (generation 0)\nCode:\nfunction think(){}\n\nParent B: "Charger" (generation 0)\nCode:\nfunction think(){}`;
    const child = parseBrain(mockReply(prompt, clean, rng))!;
    const genes = JSON.parse(/const G = (\{[^}]*\});/.exec(child.code)![1]!) as Record<string, number>;
    const nonDefault = Object.entries(genes).filter(([k, v]) => v !== (k === "engage" ? 128 : 0));
    expect(nonDefault.length).toBeLessThanOrEqual(1);
  });
});
