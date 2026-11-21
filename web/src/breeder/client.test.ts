import { afterEach, describe, expect, it, vi } from "vitest";
import { streamCompletion } from "./client";

const enc = new TextEncoder();

const delta = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
const SSE = [delta("// NAME: Ash"), delta(" Lurkers | NOTE: 90° strafe"), delta("\nfunction think() {}")].join("");
const TEXT = "// NAME: Ash Lurkers | NOTE: 90° strafe\nfunction think() {}";

function bodyOf(bytes: Uint8Array, size: number): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) {
      for (let i = 0; i < bytes.length; i += size) c.enqueue(bytes.slice(i, i + size));
      c.close();
    },
  });
}

function mockFetch(body: string, size = 1e9) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(bodyOf(enc.encode(body), size)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("streamCompletion", () => {
  it("posts the prompt to the proxy", async () => {
    const fetchMock = mockFetch(`${SSE}data: [DONE]\n\n`);
    await streamCompletion("breed them", () => {});
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/breed");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ prompt: "breed them" });
  });

  it.each([1, 2, 3, 7, 13, 64])("reassembles the stream split into %i-byte chunks", async (size) => {
    mockFetch(`${SSE}data: [DONE]\n\n`, size);
    const tokens: string[] = [];
    const { text } = await streamCompletion("p", (t) => tokens.push(t));
    expect(text).toBe(TEXT);
    expect(tokens).toEqual(["// NAME: Ash", " Lurkers | NOTE: 90° strafe", "\nfunction think() {}"]);
  });

  it("takes token count from usage and times from first token to end", async () => {
    vi.spyOn(performance, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1250).mockReturnValueOnce(3250);
    mockFetch(`${SSE}data: {"choices":[],"usage":{"completion_tokens":42}}\r\n\r\ndata: [DONE]\r\n\r\n`, 5);
    const { metrics } = await streamCompletion("p", () => {});
    expect(metrics).toEqual({ ttftMs: 250, totalMs: 2250, completionTokens: 42, tokensPerSecond: 21 });
  });

  it("estimates tokens from characters without usage or [DONE]", async () => {
    vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValueOnce(100).mockReturnValueOnce(600);
    mockFetch(SSE.trimEnd());
    const { metrics } = await streamCompletion("p", () => {});
    expect(metrics.completionTokens).toBe(Math.round(TEXT.length / 4));
    expect(metrics.tokensPerSecond).toBeCloseTo(metrics.completionTokens / 0.5);
  });

  it("throws with status and body on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("rate limited", { status: 429 })));
    await expect(streamCompletion("p", () => {})).rejects.toThrow(/429 rate limited/);
  });

  it("keeps at most 8 requests in flight", async () => {
    const open: ReadableStreamDefaultController<Uint8Array>[] = [];
    const fetchMock = vi.fn(async () => new Response(new ReadableStream<Uint8Array>({ start: (c) => void open.push(c) })));
    vi.stubGlobal("fetch", fetchMock);
    const calls = Array.from({ length: 10 }, () => streamCompletion("p", () => {}));
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).toHaveBeenCalledTimes(8);

    open[0]!.close();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(9));
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).toHaveBeenCalledTimes(9);

    await vi.waitFor(() => expect(open).toHaveLength(9));
    for (const c of open.slice(1)) c.close();
    await vi.waitFor(() => expect(open).toHaveLength(10));
    open[9]!.close();
    await Promise.all(calls);
  });
});
