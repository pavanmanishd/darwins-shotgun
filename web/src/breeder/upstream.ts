import { SYSTEM_PROMPT } from "./prompt";

export interface UpstreamEnv {
  CEREBRAS_API_KEY?: string;
  CEREBRAS_MODEL?: string;
  CEREBRAS_BASE_URL?: string;
  CEREBRAS_EXTRA_BODY?: string;
}

const MAX_PROMPT_CHARS = 24_000;

export function upstreamRequest(body: unknown, env: UpstreamEnv): { url: string; init: RequestInit } | { error: string; status: number } {
  if (!env.CEREBRAS_API_KEY || !env.CEREBRAS_MODEL) return { error: "CEREBRAS_API_KEY and CEREBRAS_MODEL must be set", status: 500 };
  const prompt = (body as { prompt?: unknown } | null)?.prompt;
  if (typeof prompt !== "string" || prompt.length === 0 || prompt.length > MAX_PROMPT_CHARS) {
    return { error: "body must be { prompt: string } under 24k characters", status: 400 };
  }
  let extra: Record<string, unknown> = {};
  try {
    if (env.CEREBRAS_EXTRA_BODY) extra = JSON.parse(env.CEREBRAS_EXTRA_BODY) as Record<string, unknown>;
  } catch {
    return { error: "CEREBRAS_EXTRA_BODY is not valid JSON", status: 500 };
  }
  return {
    url: `${env.CEREBRAS_BASE_URL ?? "https://api.cerebras.ai/v1"}/chat/completions`,
    init: {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.CEREBRAS_API_KEY}` },
      body: JSON.stringify({
        ...extra,
        model: env.CEREBRAS_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        stream: true,
        temperature: 0.9,
        top_p: 0.95,
        max_completion_tokens: 900,
      }),
    },
  };
}
