import { upstreamRequest, type UpstreamEnv } from "../web/src/breeder/upstream";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const recent = new Map<string, number[]>();

function rateLimited(ip: string, now: number): boolean {
  if (recent.size > 10_000) recent.clear();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > MAX_PER_WINDOW;
}

export default {
  async fetch(request: Request, env: UpstreamEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/api/breed") return new Response("not found", { status: 404 });
    if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
    if (rateLimited(request.headers.get("cf-connecting-ip") ?? "unknown", Date.now())) {
      return new Response("slow down", { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const upstream = upstreamRequest(body, env);
    if ("error" in upstream) return new Response(upstream.error, { status: upstream.status });

    const response = await fetch(upstream.url, upstream.init);
    return new Response(response.body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "text/event-stream" },
    });
  },
};
