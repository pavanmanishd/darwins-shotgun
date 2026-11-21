import { spawnSync } from "node:child_process";

const DEFAULT = [
  "full-speed-phonk",
  "full-evolve-phonk",
  "full-ai-darksynth",
  "full-evolve-darksynth",
  "teaser-speed-phonk",
  "teaser-evolve-darksynth",
  "vertical-evolve-phonk",
  "vertical-speed-darksynth",
];

const ids = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT;
for (const id of ids) {
  const r = spawnSync("pnpm", ["exec", "remotion", "render", id, `out/${id}.mp4`, "--log=error"], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
  console.log(`rendered out/${id}.mp4`);
}
