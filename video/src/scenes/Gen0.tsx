import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { Footage } from "../Footage";
import { COLORS, Letterbox, RgbSplit, glitchAmount, shake } from "../fx";
import { BAR, BEAT } from "../timing";
import { DISPLAY, MONO, Rise, Slam } from "../type";

const CUTS = [
  { at: 0, from: 1 },
  { at: BAR * 2, from: 5 },
  { at: BAR * 4, from: 9 },
];

export const Gen0: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <RgbSplit amount={glitchAmount(frame, CUTS.map((c) => c.at).slice(1), 5, 14)} style={shake(frame, 4, BAR)}>
        {CUTS.map((c, i) => (
          <Sequence key={c.at} from={c.at} durationInFrames={(CUTS[i + 1]?.at ?? BAR * 6) - c.at}>
            <Footage clip="gen0" from={c.from} style={{ filter: "saturate(0.3) contrast(1.15) brightness(0.8)" }} />
          </Sequence>
        ))}
      </RgbSplit>
      <Letterbox />

      <div style={{ position: "absolute", left: 90, top: 120, display: "flex", alignItems: "flex-end", gap: 18 }}>
        <span style={{ fontFamily: DISPLAY, fontSize: 60, color: COLORS.bone, lineHeight: 1, paddingBottom: 26 }}>GEN</span>
        <span style={{ fontFamily: DISPLAY, fontSize: 220, color: COLORS.fire, lineHeight: 0.85 }}>0</span>
      </div>

      <div style={{ position: "absolute", left: 96, bottom: 140, display: "flex", flexDirection: "column", gap: 12 }}>
        <Sequence from={BEAT} durationInFrames={BAR * 2 - BEAT} layout="none">
          <Rise at={0} style={{ fontFamily: MONO, fontSize: 46, color: COLORS.bone }}>
            4 hand-written brains.
          </Rise>
        </Sequence>
        <Sequence from={BAR * 2} durationInFrames={BAR * 2} layout="none">
          <Rise at={0} style={{ fontFamily: MONO, fontSize: 46, color: COLORS.bone }}>
            Fixed rules, written by a human.
          </Rise>
          <Slam at={BAR} size={150} color={COLORS.fire}>
            they never change.
          </Slam>
        </Sequence>
        <Sequence from={BAR * 4} durationInFrames={BAR * 2} layout="none">
          <Rise at={0} style={{ fontFamily: MONO, fontSize: 46, color: COLORS.bone }}>
            Easy kills.
          </Rise>
          <Rise at={BAR} style={{ fontFamily: MONO, fontSize: 46, color: COLORS.ash }}>
            So I stopped writing them.
          </Rise>
        </Sequence>
      </div>
    </AbsoluteFill>
  );
};
