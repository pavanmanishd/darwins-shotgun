import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Footage, hudAt } from "../Footage";
import { COLORS, shake } from "../fx";
import { story } from "../story";
import { BAR, BEAT, FPS } from "../timing";
import { Chip, DISPLAY, MONO, Rise, Slam, fmt } from "../type";

const W = 900;
const H = Math.round((W * 9) / 16);
const RATE = 2;

const Side: React.FC<{ clip: "live-fast" | "live-slow"; label: string; tps: number; hot: boolean; left: number }> = ({ clip, label, tps, hot, left }) => {
  const frame = useCurrentFrame();
  const end = BAR * 3;
  const fade = hot ? 0 : interpolate(frame, [end - BAR, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glow = hot ? 0.5 + 0.5 * Math.sin(frame / 3) : 0;
  return (
    <div style={{ position: "absolute", left, top: 200, width: W }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 26, letterSpacing: "0.12em", color: hot ? COLORS.fire : COLORS.ash }}>{label}</span>
        <span style={{ fontFamily: DISPLAY, fontSize: 64, color: hot ? COLORS.fire : COLORS.bone }}>
          {fmt(tps)} <span style={{ fontSize: 30 }}>tok/s</span>
        </span>
      </div>
      <div
        style={{
          position: "relative",
          width: W,
          height: H,
          overflow: "hidden",
          boxShadow: hot ? `0 0 0 3px ${COLORS.fire}, 0 0 ${40 + 40 * glow}px ${COLORS.fire}88` : `0 0 0 2px ${COLORS.ash}66`,
          filter: `saturate(${1 - fade * 0.8}) brightness(${1 - fade * 0.35})`,
        }}
      >
        <Footage clip={clip} part="page" from={0} rate={RATE} box={{ w: W, h: H }} />
      </div>
      <Stats clip={clip} hot={hot} />
    </div>
  );
};

const Stats: React.FC<{ clip: "live-fast" | "live-slow"; hot: boolean }> = ({ clip, hot }) => {
  const frame = useCurrentFrame();
  const h = hudAt(clip, (frame / FPS) * RATE);
  const big = { fontFamily: DISPLAY, fontSize: 96, lineHeight: 1, color: hot ? COLORS.fire : COLORS.bone };
  const small = { fontFamily: MONO, fontSize: 20, letterSpacing: "0.12em", color: COLORS.ash };
  return (
    <div style={{ display: "flex", gap: 60, marginTop: 26 }}>
      <div>
        <div style={big}>{fmt(h.tokens)}</div>
        <div style={small}>TOKENS OF MONSTER CODE</div>
      </div>
      <div>
        <div style={big}>{h.bred}</div>
        <div style={small}>NEW BRAINS</div>
      </div>
      <div>
        <div style={big}>{h.gen}</div>
        <div style={small}>GENERATION</div>
      </div>
    </div>
  );
};

export const Race: React.FC = () => {
  const frame = useCurrentFrame();
  const gap = frame >= BAR * 4 - BEAT;
  if (gap) return <AbsoluteFill style={{ background: "#000" }} />;
  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      <div style={{ position: "absolute", top: 40, width: "100%", textAlign: "center" }}>
        <Slam at={0} size={90}>
          same game · <span style={{ color: COLORS.fire }}>different model speed</span>
        </Slam>
      </div>
      <div style={{ position: "absolute", inset: 0, ...shake(frame, interpolate(frame, [0, BAR * 4], [1, 8])) }}>
        <Side clip="live-fast" label="KIMI ON CEREBRAS" tps={story.speed.fast} hot left={40} />
        <Side clip="live-slow" label="TYPICAL GPU SPEED" tps={story.speed.slow} hot={false} left={980} />
      </div>
      <div style={{ position: "absolute", top: 160, width: "100%", display: "flex", justifyContent: "center" }}>
        <Chip color={COLORS.ash}>{RATE}× speed · both start at gen 0</Chip>
      </div>
      <div style={{ position: "absolute", bottom: 52, width: "100%", textAlign: "center" }}>
        <Rise at={BAR * 2} style={{ fontFamily: MONO, fontSize: 40, color: COLORS.bone }}>
          At {story.speed.slow} tok/s the monsters stand around <span style={{ color: COLORS.fire }}>waiting for their brains</span>.
        </Rise>
      </div>
    </AbsoluteFill>
  );
};
