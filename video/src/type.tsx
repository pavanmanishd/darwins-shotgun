import type { CSSProperties, ReactNode } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { COLORS } from "./fx";

export const DISPLAY = loadAnton("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
export const MONO = loadMono("normal", { weights: ["400", "700", "800"], subsets: ["latin"] }).fontFamily;

export const Slam: React.FC<{
  at: number;
  until?: number;
  children: ReactNode;
  size?: number;
  color?: string;
  style?: CSSProperties;
  from?: number;
}> = ({ at, until, children, size = 120, color = COLORS.bone, style, from = 1.8 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at || (until !== undefined && frame >= until)) return null;
  const s = spring({ frame: frame - at, fps, config: { damping: 14, stiffness: 260, mass: 0.6 } });
  const scale = interpolate(s, [0, 1], [from, 1]);
  const blur = interpolate(s, [0, 1], [10, 0]);
  return (
    <div
      style={{
        fontFamily: DISPLAY,
        fontSize: size,
        lineHeight: 0.95,
        color,
        textTransform: "uppercase",
        letterSpacing: "0.01em",
        transform: `scale(${scale})`,
        filter: `blur(${blur}px)`,
        opacity: Math.min(1, s * 1.6),
        textShadow: "0 6px 0 rgba(0,0,0,0.55), 0 0 40px rgba(0,0,0,0.6)",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Rise: React.FC<{ at: number; children: ReactNode; style?: CSSProperties; distance?: number }> = ({
  at,
  children,
  style,
  distance = 30,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const s = spring({ frame: frame - at, fps, config: { damping: 18, stiffness: 180 } });
  return <div style={{ opacity: s, transform: `translateY(${(1 - s) * distance}px)`, ...style }}>{children}</div>;
};

export const Typewriter: React.FC<{ text: string; at: number; cps: number; style?: CSSProperties; caret?: boolean }> = ({
  text,
  at,
  cps,
  style,
  caret = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const n = Math.min(text.length, Math.floor(((frame - at) / fps) * cps));
  const blink = Math.floor(frame / 8) % 2 === 0;
  return (
    <span style={{ fontFamily: MONO, whiteSpace: "pre-wrap", ...style }}>
      {text.slice(0, n)}
      {caret && (n < text.length || blink) ? <span style={{ color: COLORS.fire }}>▌</span> : null}
    </span>
  );
};

export function countUp(frame: number, at: number, length: number, to: number, from = 0): number {
  return interpolate(frame, [at, at + length], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
}

export const fmt = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const Chip: React.FC<{ children: ReactNode; color?: string; style?: CSSProperties }> = ({ children, color = COLORS.fire, style }) => (
  <span
    style={{
      fontFamily: MONO,
      fontWeight: 800,
      fontSize: 22,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "#000",
      background: color,
      padding: "6px 14px 5px",
      ...style,
    }}
  >
    {children}
  </span>
);
