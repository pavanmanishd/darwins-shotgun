import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { COLORS, RgbSplit, shake } from "../fx";
import { story } from "../story";
import { BAR, BEAT } from "../timing";
import { MONO, Slam, countUp, fmt } from "../type";

const COLUMNS = 9;

export const CodeRain: React.FC<{ intensity: number; speed?: number }> = ({ intensity, speed = 9 }) => {
  const frame = useCurrentFrame();
  const lines = story.championCode.split("\n");
  const text = Array.from({ length: 6 }, () => lines.join("\n")).join("\n");
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {Array.from({ length: COLUMNS }, (_, i) => {
        const offset = random(`col${i}`) * 1400;
        const v = speed * (0.6 + random(`v${i}`) * 0.9);
        return (
          <pre
            key={i}
            style={{
              position: "absolute",
              left: `${(i / COLUMNS) * 100}%`,
              top: -3000 + ((offset + frame * v) % 2400),
              margin: 0,
              width: `${100 / COLUMNS}%`,
              fontFamily: MONO,
              fontSize: 15,
              lineHeight: 1.35,
              color: COLORS.code,
              opacity: intensity * (0.25 + random(`o${i}`) * 0.5),
              whiteSpace: "pre",
              overflow: "hidden",
              textShadow: `0 0 12px ${COLORS.code}`,
            }}
          >
            {text}
          </pre>
        );
      })}
    </AbsoluteFill>
  );
};

interface Line {
  at: number;
  text: string;
  size: number;
  color: string;
}

const LINES: Line[] = [
  { at: 0, text: "so I let", size: 110, color: COLORS.bone },
  { at: BEAT * 2, text: "Kimi K3.1 Pro", size: 170, color: COLORS.fire },
  { at: BEAT * 4, text: "rewrite them", size: 150, color: COLORS.bone },
  { at: BEAT * 6, text: "mid-fight.", size: 230, color: COLORS.fire },
];

export const TEASER_LINES: Line[] = [
  { at: 0, text: "every imp you kill", size: 120, color: COLORS.bone },
  { at: BEAT * 2, text: "Kimi K3.1 Pro", size: 170, color: COLORS.fire },
  { at: BEAT * 4, text: "breeds a new brain", size: 140, color: COLORS.bone },
  { at: BEAT * 6, text: "mid-fight.", size: 230, color: COLORS.fire },
];

export const Riser: React.FC<{ lines?: Line[] }> = ({ lines = LINES }) => {
  const frame = useCurrentFrame();
  const t = frame / (BAR * 2);
  const gap = frame >= BAR * 2 - BEAT / 2;
  const tps = countUp(frame, 0, BAR * 2 - BEAT, story.speed.fast);
  const current = [...lines].reverse().find((l) => frame >= l.at);
  if (gap) return <AbsoluteFill style={{ background: "#000" }} />;
  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      <RgbSplit amount={t * 10} style={shake(frame, 2 + t * 16)}>
        <CodeRain intensity={interpolate(t, [0, 1], [0.15, 0.9])} speed={6 + t * 30} />
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          {current && (
            <Slam key={current.text} at={current.at} size={current.size} color={current.color}>
              {current.text}
            </Slam>
          )}
        </AbsoluteFill>
      </RgbSplit>
      <div
        style={{
          position: "absolute",
          bottom: 90,
          width: "100%",
          textAlign: "center",
          fontFamily: MONO,
          fontWeight: 800,
          fontSize: 44,
          color: COLORS.code,
          letterSpacing: "0.06em",
        }}
      >
        {fmt(tps)} <span style={{ color: COLORS.ash, fontWeight: 400 }}>tokens / second</span>
      </div>
    </AbsoluteFill>
  );
};
