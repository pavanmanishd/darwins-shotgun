import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { COLORS, Grain, pulse } from "./fx";
import type { HookVariant } from "./scenes/Hook";
import { story } from "./story";
import { Badge, type Music, Trailer } from "./Trailer";
import { BAR, FPS, duration } from "./timing";
import { Chip, DISPLAY, MONO, Typewriter, fmt } from "./type";

export type VerticalProps = { hook: HookVariant; music: Music };

const W = 1080;
const VIDEO_H = Math.round((W * 1080) / 1920);
const TOP = 560;
const CODE_TOP = TOP + VIDEO_H + 64;

const REPLAY_EVERY = 6 * FPS;

const HEADLINES: Record<HookVariant, [string, string]> = {
  speed: ["a new imp brain", `every ${story.speed.brainSeconds.toFixed(1)} seconds`],
  evolve: ["DOOM's imps are", "evolving"],
  ai: ["AI rewrites DOOM's", "monsters mid-fight"],
};

export const Vertical: React.FC<VerticalProps> = ({ hook, music }) => {
  const frame = useCurrentFrame();
  const beat = pulse(frame, BAR / 4, 6);
  const [lineA, lineB] = HEADLINES[hook];
  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      <div style={{ position: "absolute", top: 120, left: 60, right: 60, textAlign: "center" }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 104, lineHeight: 1, color: COLORS.bone, textTransform: "uppercase" }}>{lineA}</div>
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: lineB.length > 12 ? 118 : 150,
            lineHeight: 1,
            color: COLORS.fire,
            textTransform: "uppercase",
            transform: `scale(${1 + beat * 0.035})`,
            textShadow: `0 0 ${30 + beat * 40}px ${COLORS.fire}55`,
          }}
        >
          {lineB}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 30, color: COLORS.ash, marginTop: 26, letterSpacing: "0.04em" }}>
          <b style={{ color: COLORS.fire }}>Kimi K3.1 Pro</b> on <b style={{ color: COLORS.bone }}>Cerebras</b> · real DOOM engine
        </div>
      </div>

      <div style={{ position: "absolute", top: TOP, left: 0, width: W, height: VIDEO_H, overflow: "hidden", boxShadow: `0 0 0 2px ${COLORS.fire}66, 0 0 90px ${COLORS.fire}33` }}>
        <div style={{ width: 1920, height: 1080, transform: `scale(${W / 1920})`, transformOrigin: "top left" }}>
          <Trailer cut="teaser" hook={hook} music={music} badge={false} />
        </div>
      </div>

      <div style={{ position: "absolute", top: CODE_TOP, left: 60, width: 960 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <Chip color={COLORS.code}>a brain Kimi wrote · measured speed</Chip>
          <span style={{ fontFamily: MONO, fontSize: 26, color: COLORS.ash, letterSpacing: "0.08em" }}>
            <b style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: 64, color: COLORS.code, letterSpacing: 0, lineHeight: 1 }}>{fmt(story.speed.fast)}</b> TOK/S
          </span>
        </div>
        <div style={{ position: "relative", marginTop: 16, width: 960, height: 440, overflow: "hidden", boxShadow: `0 0 0 2px ${COLORS.code}55, 0 0 60px ${COLORS.code}22` }}>
          {Array.from({ length: Math.ceil(duration("teaser") / REPLAY_EVERY) }, (_, i) => (
            <Sequence key={i} from={i * REPLAY_EVERY} durationInFrames={REPLAY_EVERY}>
              <div style={{ position: "absolute", inset: 0, padding: "18px 22px", background: "#0b0d0b" }}>
                <Typewriter text={story.championCode} at={6} cps={story.speed.fast * 3.6} style={{ fontSize: 15, lineHeight: 1.4, color: COLORS.code }} />
              </div>
            </Sequence>
          ))}
        </div>
      </div>

      {story.rehearsal && <Badge style={{ right: "auto", left: "50%", transform: "translateX(-50%)", bottom: 56, fontSize: 18, whiteSpace: "nowrap" }} />}
      <Grain opacity={0.06} />
    </AbsoluteFill>
  );
};
