import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Footage } from "../Footage";
import { COLORS, FlashAt, RgbSplit, glitchAmount, shake } from "../fx";
import { story } from "../story";
import { BAR, BEAT } from "../timing";
import { MONO, Rise, Slam } from "../type";

export type HookVariant = "speed" | "evolve" | "ai";

const seconds = story.speed.brainSeconds.toFixed(1);

const HOOKS: Record<HookVariant, { words: string[]; kicker: string; big: string; bigSize: number; sub: ReactNode }> = {
  speed: {
    words: ["THIS", "IMP'S", "BRAIN", "WAS WRITTEN IN"],
    kicker: "this imp's brain was written in",
    big: `${seconds} seconds`,
    bigSize: 280,
    sub: (
      <>
        by <b style={{ color: COLORS.fire }}>Kimi K3.1 Pro</b> on <b>Cerebras</b> · while you were fighting it
      </>
    ),
  },
  evolve: {
    words: ["THESE", "IMPS", "ARE", "EVOLVING"],
    kicker: "these imps are evolving",
    big: "against you",
    bigSize: 300,
    sub: (
      <>
        a new brain every {seconds} s · written by <b style={{ color: COLORS.fire }}>Kimi K3.1 Pro</b> on <b>Cerebras</b>
      </>
    ),
  },
  ai: {
    words: ["I LET", "AN AI", "REWRITE", "DOOM'S MONSTERS"],
    kicker: "I let an AI rewrite DOOM's monsters",
    big: "mid-fight",
    bigSize: 340,
    sub: (
      <>
        <b style={{ color: COLORS.fire }}>Kimi K3.1 Pro</b> on <b>Cerebras</b> · one new imp brain every {seconds} s
      </>
    ),
  },
};

export const Hook: React.FC<{ variant?: HookVariant }> = ({ variant = "speed" }) => {
  const frame = useCurrentFrame();
  const h = HOOKS[variant];
  const hit = frame >= BAR;
  const zoom = hit ? interpolate(frame - BAR, [0, 10, BAR], [1.28, 1.12, 1.06], { extrapolateRight: "clamp" }) : interpolate(frame, [0, BAR], [1.2, 1.1]);
  const look = hit ? "brightness(0.55) saturate(1.25) contrast(1.1)" : "brightness(0.22) blur(10px) saturate(0.6)";

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <RgbSplit amount={glitchAmount(frame, [BAR], 10, 26)} style={hit ? shake(frame, 14, BAR) : undefined}>
        <Footage clip="evolved-a" from={5} zoom={zoom} style={{ filter: look }} />
      </RgbSplit>

      {!hit && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 18, flexDirection: "row", flexWrap: "wrap", padding: 120 }}>
          {h.words.map((w, i) => (
            <Slam key={w} at={i * BEAT} size={110} from={1.3} color={i === h.words.length - 1 && variant !== "speed" ? COLORS.fire : COLORS.bone}>
              {w}
            </Slam>
          ))}
        </AbsoluteFill>
      )}

      {hit && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          <Slam at={BAR} size={58} from={1.1} style={{ letterSpacing: "0.08em" }}>
            {h.kicker}
          </Slam>
          <Slam at={BAR} size={h.bigSize} color={COLORS.fire} from={2.4}>
            {h.big}
          </Slam>
          <Rise at={BAR + BEAT * 2} style={{ fontFamily: MONO, fontSize: 34, color: COLORS.bone, marginTop: 10, letterSpacing: "0.04em" }}>
            {h.sub}
          </Rise>
        </AbsoluteFill>
      )}
      <FlashAt frame={BAR} strength={1} length={9} />
    </AbsoluteFill>
  );
};
