import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { streamMockReply, type MockOptions } from "./dev/mockKimi";
import { upstreamRequest, type UpstreamEnv } from "./src/breeder/upstream";

const MAX_BODY_BYTES = 32 * 1024;

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

function fromThisPage(req: IncomingMessage): boolean {
  return (req.headers["content-type"] ?? "").startsWith("application/json") && req.headers["sec-fetch-site"] !== "cross-site";
}

function mockOptions(env: Record<string, string>): MockOptions | null {
  const tps = Number(env.MOCK_KIMI_TPS);
  if (!(tps > 0)) return null;
  return {
    tps,
    ttftMs: Number(env.MOCK_KIMI_TTFT_MS ?? 200),
    brokenRate: Number(env.MOCK_KIMI_BROKEN_RATE ?? 0.1),
    fencedRate: Number(env.MOCK_KIMI_FENCED_RATE ?? 0.1),
    wildRate: Number(env.MOCK_KIMI_WILD_RATE ?? 0.1),
  };
}

function breedProxy(env: UpstreamEnv & Record<string, string>): Plugin {
  const mock = mockOptions(env);
  return {
    name: "breed-proxy",
    configureServer(server) {
      server.middlewares.use("/api/breed", async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== "POST" || !fromThisPage(req)) {
          res.statusCode = 403;
          res.end();
          return;
        }
        const body = await readJson(req);
        if (mock) {
          const prompt = (body as { prompt?: unknown } | null)?.prompt;
          if (typeof prompt !== "string") {
            res.statusCode = 400;
            res.end();
            return;
          }
          let closed = false;
          res.on("close", () => (closed = true));
          res.writeHead(200, { "content-type": "text/event-stream" });
          await streamMockReply(prompt, mock, (sse) => res.write(sse), () => closed);
          res.end();
          return;
        }
        const upstream = upstreamRequest(body, env);
        if ("error" in upstream) {
          res.statusCode = upstream.status;
          res.end(upstream.error);
          return;
        }
        try {
          const response = await fetch(upstream.url, upstream.init);
          res.writeHead(response.status, { "content-type": response.headers.get("content-type") ?? "text/event-stream" });
          if (!response.body) {
            res.end();
            return;
          }
          const reader = response.body.getReader();
          res.on("close", () => void reader.cancel().catch(() => {}));
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        } catch (err) {
          res.statusCode = 502;
          res.end(err instanceof Error ? err.message : String(err));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [breedProxy(loadEnv(mode, process.cwd(), ["CEREBRAS_", "MOCK_KIMI_"]))],
}));
