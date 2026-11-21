import type { AudienceMutation, PlayerProfile, Species } from "../types";
import type { BreedMetrics, streamCompletion } from "./client";
import { parseBrain } from "./parse";
import { buildUserPrompt } from "./prompt";

export type BreedOutcome =
  | { ok: true; name: string; note: string; code: string; metrics: BreedMetrics[] }
  | { ok: false; error: string; metrics: BreedMetrics[] };

interface BreedInput {
  a: Species;
  b: Species;
  profile: PlayerProfile;
  mutation?: AudienceMutation;
}

interface BreedDeps {
  stream: typeof streamCompletion;
  validate: (code: string) => Promise<string | null>;
  onToken: (t: string) => void;
  onAttempt?: (n: 1 | 2) => void;
}

export async function breed(input: BreedInput, deps: BreedDeps): Promise<BreedOutcome> {
  const metrics: BreedMetrics[] = [];
  let repairOf: { code: string; error: string } | undefined;
  for (const attempt of [1, 2] as const) {
    deps.onAttempt?.(attempt);
    const { text, metrics: m } = await deps.stream(buildUserPrompt({ ...input, repairOf }), deps.onToken);
    metrics.push(m);
    const brain = parseBrain(text);
    if (!brain) {
      repairOf = { code: text, error: "No complete function think(s, mem, squad) found in the reply." };
      continue;
    }
    const error = await deps.validate(brain.code);
    if (error === null) return { ok: true, ...brain, metrics };
    repairOf = { code: brain.code, error };
  }
  return { ok: false, error: repairOf!.error, metrics };
}
