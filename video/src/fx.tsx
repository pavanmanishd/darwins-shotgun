import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { BEAT } from "./timing";

export const COLORS = {
  ink: "#060606",
  fire: "#ff4d1a",
  ember: "#ffb199",
  code: "#b6f09c",
  bone: "#f2ede4",
  ash: "#8b877d",
};

export function sinceBeat(frame: number, every = BEAT): number {
  return ((frame % every) + every) % every;
}

export function pulse(frame: number, every = BEAT, decay = 5): number {
  return Math.exp(-sinceBeat(frame, every) / decay);
}

export function shake(frame: number, strength: number, every = BEAT): CSSProperties {
  const p = pulse(frame, every, 3) * strength;
  const beat = Math.floor(frame / every);
  const x = (random(`x${beat}`) - 0.5) * 2 * p;
  const y = (random(`y${beat}`) - 0.5) * 2 * p;
  return { transform: `translate(${x}px, ${y}px)` };
}

export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.09 }) => {
  const frame = useCurrentFrame();
  const id = `grain-${frame}`;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity }}>
      <svg width="100%" height="100%">
        <filter id={id}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={frame % 12} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${id})`} />
      </svg>
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.75 }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);

export const Scanlines: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      opacity: 0.07,
      background: "repeating-linear-gradient(0deg, #000 0px, #000 1px, transparent 2px, transparent 4px)",
    }}
  />
);

export const Flash: React.FC<{ every?: number; strength?: number; color?: string }> = ({ every = BEAT * 4, strength = 0.5, color = "#fff" }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: color, opacity: pulse(frame, every, 2.2) * strength, pointerEvents: "none" }} />;
};

export const FlashAt: React.FC<{ frame: number; strength?: number; color?: string; length?: number }> = ({
  frame: at,
  strength = 1,
  color = "#fff",
  length = 8,
}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame - at, [0, length], [strength, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return frame < at ? null : <AbsoluteFill style={{ background: color, opacity: o, pointerEvents: "none" }} />;
};

export const Letterbox: React.FC<{ size?: number }> = ({ size = 86 }) => (
  <>
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: size, background: "#000" }} />
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: size, background: "#000" }} />
  </>
);

export const RgbSplit: React.FC<{ amount: number; children: ReactNode; style?: CSSProperties }> = ({ amount, children, style }) => {
  const frame = useCurrentFrame();
  if (amount < 0.5) return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
  const id = `rgb-${frame}-${Math.round(amount * 10)}`;
  return (
    <AbsoluteFill style={{ ...style, filter: `url(#${id})` }}>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter id={id} colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
          <feOffset in="r" dx={amount} dy="0" result="r2" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
          <feOffset in="b" dx={-amount} dy="0" result="b2" />
          <feBlend in="r2" in2="g" mode="screen" result="rg" />
          <feBlend in="rg" in2="b2" mode="screen" />
        </filter>
      </svg>
      {children}
    </AbsoluteFill>
  );
};

export function glitchAmount(frame: number, cuts: number[], length = 6, peak = 18): number {
  let best = 0;
  for (const c of cuts) {
    const d = frame - c;
    if (d >= 0 && d < length) best = Math.max(best, peak * (1 - d / length));
  }
  return best;
}

export const SliceGlitch: React.FC<{ active: boolean; seed: string; children: ReactNode }> = ({ active, seed, children }) => {
  const frame = useCurrentFrame();
  if (!active) return <>{children}</>;
  const slices = 7;
  return (
    <AbsoluteFill>
      {Array.from({ length: slices }, (_, i) => {
        const top = (i / slices) * 100;
        const bottom = 100 - ((i + 1) / slices) * 100;
        const dx = (random(`${seed}-${frame}-${i}`) - 0.5) * 80;
        return (
          <AbsoluteFill key={i} style={{ clipPath: `inset(${top}% 0 ${bottom}% 0)`, transform: `translateX(${dx}px)` }}>
            {children}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};
