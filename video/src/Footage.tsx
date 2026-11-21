import type { CSSProperties } from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import clips from "./data/clips.json";
import { FPS } from "./timing";

export type ClipName = keyof typeof clips;
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAGE: Rect = { x: 0, y: 0, w: 1920, h: 1080 };

export function region(clip: ClipName, part: "screen" | "panel" | "page" | "code"): Rect {
  const layout = clips[clip].layout as { screen: Rect; panel: Rect | null };
  if (part === "page") return PAGE;
  if (part === "screen") return layout.screen;
  const panel = layout.panel ?? PAGE;
  if (part === "panel") return panel;
  return { x: panel.x, y: panel.y, w: panel.w, h: Math.round(panel.h * 0.6) };
}

export const Footage: React.FC<{
  clip: ClipName;
  from?: number;
  part?: "screen" | "panel" | "page" | "code";
  crop?: Rect;
  box?: { w: number; h: number };
  fit?: "cover" | "contain";
  rate?: number;
  zoom?: number;
  style?: CSSProperties;
}> = ({ clip, from = 0, part = "screen", crop, box = { w: 1920, h: 1080 }, fit = "cover", rate = 1, zoom = 1, style }) => {
  const r = crop ?? region(clip, part);
  const base = fit === "cover" ? Math.max(box.w / r.w, box.h / r.h) : Math.min(box.w / r.w, box.h / r.h);
  const s = base * zoom;
  const left = box.w / 2 - (r.x + r.w / 2) * s;
  const top = box.h / 2 - (r.y + r.h / 2) * s;
  return (
    <AbsoluteFill style={{ overflow: "hidden", width: box.w, height: box.h, background: "#000", ...style }}>
      <OffthreadVideo
        src={staticFile(clips[clip].file)}
        trimBefore={Math.round(from * FPS)}
        playbackRate={rate}
        muted
        style={{ position: "absolute", left, top, width: 1920 * s, height: 1080 * s, maxWidth: "none", imageRendering: "pixelated" }}
      />
    </AbsoluteFill>
  );
};

interface HudSample {
  at: number;
  bred: number;
  tokens: number;
  gen: number;
}

export function hudAt(clip: ClipName, seconds: number): HudSample {
  const samples = ((clips[clip] as { hud?: HudSample[] }).hud ?? []) as HudSample[];
  if (!samples.length) return { at: seconds, bred: 0, tokens: 0, gen: 0 };
  const i = samples.findIndex((s) => s.at > seconds);
  if (i <= 0) return i === 0 ? samples[0]! : samples[samples.length - 1]!;
  const a = samples[i - 1]!;
  const b = samples[i]!;
  const k = (seconds - a.at) / Math.max(0.001, b.at - a.at);
  return { at: seconds, bred: a.bred, tokens: Math.round(a.tokens + (b.tokens - a.tokens) * k), gen: a.gen };
}
