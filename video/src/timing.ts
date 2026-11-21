import full from "./timing-full.json";
import teaser from "./timing-teaser.json";

export const FPS = 30;
export const BEAT = Math.round((60 / full.bpm) * FPS);
export const BAR = BEAT * 4;
export const TAIL = 18;

const CUTS = { full, teaser };
export type Cut = keyof typeof CUTS;

export const duration = (cut: Cut) => CUTS[cut].bars * BAR + TAIL;

export interface Section {
  name: string;
  from: number;
  span: number;
}

export function sections(cut: Cut): Section[] {
  return Object.entries(CUTS[cut].sections).map(([name, s]) => ({ name, from: s.from * BAR, span: (s.to - s.from) * BAR }));
}
