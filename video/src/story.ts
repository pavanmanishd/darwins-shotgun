import raw from "./data/story.json";

interface BenchSummary {
  meanLifeSeconds: number;
  damageTakenPerMin: number;
  impKillsPerMin: number;
  flankShare: number;
}

export interface Story {
  rehearsal: boolean;
  minutes: number | null;
  topGen: number;
  speciesCreated: number;
  champion: { name: string; gen: number; note: string; score: number };
  seedBest: number;
  seedMean: number;
  finalistMean: number;
  championCode: string;
  lineage: { name: string; gen: number; note: string }[];
  tree: { nodes: { id: number; name: string; gen: number; score: number; champion: boolean; finalist: boolean }[]; edges: [number, number][] };
  montage: { name: string; gen: number; note: string; score: number }[];
  diff: {
    parent: { name: string; gen: number; genes: Record<string, number> };
    child: { name: string; gen: number; genes: Record<string, number>; note: string };
    changed: string[];
  } | null;
  codeDiff: {
    parent: { name: string; gen: number };
    child: { name: string; gen: number; note: string };
    lines: { text: string; added: boolean }[];
  } | null;
  profile: string[];
  speed: { fast: number; slow: number; fastTtftMs: number; slowTtftMs: number; brainTokens: number; brainSeconds: number };
  bench: { seeds: BenchSummary; evolved: BenchSummary } | null;
}

export const story = raw as unknown as Story;
