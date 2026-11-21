import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Footage } from "../Footage";
import { COLORS, FlashAt, RgbSplit, SliceGlitch } from "../fx";
import { BEAT } from "../timing";
import { Chip, MONO, Rise, Slam } from "../type";
import { FamilyTree } from "./Tree";
import { story } from "../story";

export const Outro: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  const settle = interpolate(frame, [0, 20], [30, 0], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [length - 60, length - 5], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ opacity: fadeOut }}>
        <Footage clip="evolved-b" from={9} zoom={1.2} style={{ filter: "brightness(0.2) blur(8px) saturate(0.6)" }} />
        <div style={{ position: "absolute", right: 90, bottom: 120, opacity: 0.55 }}>
          <FamilyTree width={560} height={260} showUpToGen={story.topGen} labels />
        </div>
        <RgbSplit amount={settle}>
          <SliceGlitch active={frame < 10} seed="logo">
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 10, marginTop: -60 }}>
              <Slam at={0} size={210} from={2.2}>
                Darwin's <span style={{ color: COLORS.fire }}>Shotgun</span>
              </Slam>
              <Rise at={BEAT * 2} style={{ fontFamily: MONO, fontSize: 36, color: COLORS.bone }}>
                DOOM's imps, rewritten mid-fight by <b style={{ color: COLORS.fire }}>Kimi K3.1 Pro</b> on <b>Cerebras</b>.
              </Rise>
              <Rise at={BEAT * 5} style={{ display: "flex", gap: 16, marginTop: 34 }}>
                <Chip>play it in your browser</Chip>
                <Chip color={COLORS.code}>open source · GPL</Chip>
                <Chip color={COLORS.bone}>real DOOM engine</Chip>
              </Rise>
            </AbsoluteFill>
          </SliceGlitch>
        </RgbSplit>
      </AbsoluteFill>
      <FlashAt frame={0} strength={1} length={12} />
    </AbsoluteFill>
  );
};
