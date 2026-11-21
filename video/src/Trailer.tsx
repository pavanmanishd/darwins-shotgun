import type { ReactNode } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { COLORS, Grain, Scanlines, Vignette } from "./fx";
import { Drop } from "./scenes/Drop";
import { Gen0 } from "./scenes/Gen0";
import { Hook, type HookVariant } from "./scenes/Hook";
import { Outro } from "./scenes/Outro";
import { HyperCut, Payoff } from "./scenes/Payoff";
import { Race } from "./scenes/Race";
import { Reads } from "./scenes/Reads";
import { Riser, TEASER_LINES } from "./scenes/Riser";
import { story } from "./story";
import { BAR, type Cut, duration, sections } from "./timing";
import { MONO } from "./type";

export type Music = "phonk" | "darksynth";
export type TrailerProps = { cut: Cut; hook: HookVariant; music: Music; badge?: boolean };

export const Badge: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <div
    style={{
      position: "absolute",
      right: 24,
      bottom: 14,
      fontFamily: MONO,
      fontSize: 14,
      letterSpacing: "0.1em",
      color: COLORS.bone,
      background: "rgba(0,0,0,0.6)",
      border: `1px solid ${COLORS.ash}88`,
      padding: "6px 12px",
      textTransform: "uppercase",
      ...style,
    }}
  >
    rehearsal cut · simulated model at real speeds
  </div>
);

function scene(cut: Cut, name: string, span: number, hook: HookVariant, outroLength: number): ReactNode {
  switch (name) {
    case "hook":
      return <Hook variant={hook} />;
    case "intro":
      return <Gen0 />;
    case "riser":
      return <Riser lines={cut === "teaser" ? TEASER_LINES : undefined} />;
    case "drop1":
      return <Drop bars={span / BAR} />;
    case "breakdown":
      return <Reads />;
    case "build":
      return <Race />;
    case "drop2":
      return cut === "teaser" ? <HyperCut /> : <Payoff />;
    case "outro":
      return <Outro length={outroLength} />;
    default:
      return null;
  }
}

export const Trailer: React.FC<TrailerProps> = ({ cut, hook, music, badge = true }) => {
  const total = duration(cut);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {sections(cut).map((s) => {
        const length = s.name === "outro" ? total - s.from : s.span;
        return (
          <Sequence key={s.name} from={s.from} durationInFrames={length}>
            {scene(cut, s.name, s.span, hook, length)}
          </Sequence>
        );
      })}
      <Vignette />
      <Scanlines />
      <Grain />
      {badge && story.rehearsal && <Badge />}
      <Audio src={staticFile(`music-${cut}-${music}.wav`)} />
    </AbsoluteFill>
  );
};
