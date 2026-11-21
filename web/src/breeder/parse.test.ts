import { describe, expect, it } from "vitest";
import { parseBrain } from "./parse";

const BRAIN = `// NAME: Ash Lurkers | NOTE: strafe when shotgun is out
function think(s, mem, squad) {
  if (s.playerWeapon === 2) { return { move: "strafeL", attack: s.canShoot }; }
  return { move: "advance", attack: true };
}`;

describe("parseBrain", () => {
  it("reads a clean reply", () => {
    expect(parseBrain(BRAIN)).toEqual({ name: "Ash Lurkers", note: "strafe when shotgun is out", code: BRAIN });
  });

  it("strips markdown fences, leading prose and trailing text", () => {
    const text = `Here is the child brain:\n\n\`\`\`javascript\n${BRAIN}\n\`\`\`\n\nIt should flank more.`;
    expect(parseBrain(text)).toEqual({ name: "Ash Lurkers", note: "strafe when shotgun is out", code: BRAIN });
  });

  it("falls back to Unnamed when the NAME line is missing", () => {
    const fn = BRAIN.split("\n").slice(1).join("\n");
    expect(parseBrain(`Sure!\n${fn}\nDone.`)).toEqual({ name: "Unnamed", note: "", code: fn });
  });

  it("keeps the name when NOTE is missing", () => {
    expect(parseBrain(BRAIN.replace(" | NOTE: strafe when shotgun is out", ""))?.name).toBe("Ash Lurkers");
  });

  it("ignores braces inside strings and comments", () => {
    const code = `function think(s, mem) {\n  // a stray } here\n  mem.tag = "}{";\n  return { move: "hold", attack: false };\n}`;
    expect(parseBrain(`${code}\nextra`)?.code).toBe(code);
  });

  it("returns null without a complete think function", () => {
    expect(parseBrain("I cannot help with that.")).toBeNull();
    expect(parseBrain("// NAME: Cut Off\nfunction think(s, mem, squad) {\n  return {")).toBeNull();
  });
});

describe("parseBrain helpers", () => {
  it("keeps helper functions declared before and after think", () => {
    const text = [
      "Here you go:",
      "// NAME: Helpers | NOTE: uses helpers",
      "const far = (s) => s.dist > 800;",
      "function think(s, mem, squad) {",
      "  return { move: far(s) ? 'advance' : side(s), attack: true };",
      "}",
      "function side(s) {",
      "  return s.uid % 2 ? 'strafeL' : 'strafeR';",
      "}",
      "Hope this helps!",
    ].join("\n");
    const parsed = parseBrain(text);
    expect(parsed?.code.startsWith("// NAME: Helpers")).toBe(true);
    expect(parsed?.code).toContain("const far");
    expect(parsed?.code.endsWith("'strafeL' : 'strafeR';\n}")).toBe(true);
  });
});
