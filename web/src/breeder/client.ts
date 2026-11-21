export interface BreedMetrics {
  ttftMs: number;
  totalMs: number;
  completionTokens: number;
  tokensPerSecond: number;
}

interface Completion {
  text: string;
  metrics: BreedMetrics;
}

const MAX_IN_FLIGHT = 8;

async function streamCompletionNow(prompt: string, onToken: (text: string) => void): Promise<Completion> {
  const start = performance.now();
  const res = await fetch("/api/breed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error(`breed request failed: ${res.status} ${await res.text()}`);
  if (!res.body) throw new Error("breed request returned no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let usageTokens: number | null = null;
  let firstTokenAt: number | null = null;
  let buffer = "";
  let done = false;

  const handleLine = (raw: string) => {
    const line = raw.trim();
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (data === "[DONE]") {
      done = true;
      return;
    }
    const chunk = JSON.parse(data) as {
      choices?: { delta?: { content?: string } }[];
      usage?: { completion_tokens?: number };
      error?: { message?: string };
    };
    if (chunk.error) throw new Error(`upstream error: ${chunk.error.message ?? JSON.stringify(chunk.error)}`);
    const content = chunk.choices?.[0]?.delta?.content;
    if (content) {
      firstTokenAt ??= performance.now();
      text += content;
      onToken(content);
    }
    if (typeof chunk.usage?.completion_tokens === "number") usageTokens = chunk.usage.completion_tokens;
  };

  try {
    while (!done) {
      const { value, done: streamDone } = await reader.read();
      buffer += decoder.decode(value, { stream: !streamDone });
      const lines = buffer.split("\n");
      buffer = streamDone ? "" : (lines.pop() ?? "");
      for (const line of lines) {
        handleLine(line);
        if (done) break;
      }
      if (streamDone) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  const end = performance.now();
  const completionTokens = usageTokens ?? Math.round(text.length / 4);
  const streamSeconds = (end - (firstTokenAt ?? end)) / 1000;
  return {
    text,
    metrics: {
      ttftMs: (firstTokenAt ?? end) - start,
      totalMs: end - start,
      completionTokens,
      tokensPerSecond: streamSeconds > 0 ? completionTokens / streamSeconds : 0,
    },
  };
}

function limitConcurrency<A extends unknown[], R>(max: number, fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async (...args) => {
    if (active < max) active++;
    else await new Promise<void>((resolve) => waiting.push(resolve));
    try {
      return await fn(...args);
    } finally {
      // Hand the slot straight to the next waiter so a fresh caller cannot slip in between.
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

export const streamCompletion = limitConcurrency(MAX_IN_FLIGHT, streamCompletionNow);
