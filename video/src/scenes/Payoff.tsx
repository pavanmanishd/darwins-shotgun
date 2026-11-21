import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { Footage } from "../Footage";
import { COLORS, Flash, FlashAt, RgbSplit, glitchAmount, shake } from "../fx";
import { story } from "../story";
import { BAR, BEAT } from "../timing";
import { Chip, DISPLAY, MONO, Rise, Slam, countUp, fmt } from "../type";

const HYPER = Array.from({ length: 8 }, (_, i) => ({ clip: i % 2 ? ("evolved-b" as const) : ("evolved-a" as const), from: 1 + i * 1.6 }));

export const HyperCut: React.FC = () => {
  const frame = useCurrentFrame();
  const step = BEAT * 2;
  const shot = Math.min(HYPER.length - 1, Math.floor(frame / step));
  const notes = story.montage.map((m) => m.note);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <RgbSplit amount={glitchAmount(frame, HYPER.map((_, i) => i * step), 5, 22)} style={shake(frame, 12)}>
        {HYPER.map((c, i) => (
          <Sequence key={i} from={i * step} durationInFrames={step}>
            <Footage clip={c.clip} from={c.from} zoom={interpolate(frame - i * step, [0, step], [1.18, 1.05])} style={{ filter: "saturate(1.2) contrast(1.1)" }} />
          </Sequence>
        ))}
      </RgbSplit>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 20% 30%, rgba(0,0,0,0.65), rgba(0,0,0,0) 60%)" }} />
      <div style={{ position: "absolute", left: 80, top: 70 }}>
        <Slam at={0} size={250} color={COLORS.fire} from={2.6}>
          gen {story.topGen}
        </Slam>
        <Rise at={BEAT} style={{ fontFamily: MONO, fontSize: 34, color: COLORS.bone, marginTop: 8 }}>
          {story.speciesCreated} species later{story.minutes ? ` · ${story.minutes} game-minutes of fighting` : ""}
        </Rise>
      </div>
      <div style={{ position: "absolute", left: 84, bottom: 100 }}>
        <Chip>evolved behaviour</Chip>
        <Slam key={shot} at={shot * step} size={84} style={{ marginTop: 14, maxWidth: 1500 }}>
          {notes[shot % Math.max(1, notes.length)] ?? ""}
        </Slam>
      </div>
      <Flash every={step} strength={0.3} />
      <FlashAt frame={0} length={10} />
    </AbsoluteFill>
  );
};

interface Row {
  label: string;
  before: number;
  after: number;
  unit: string;
  digits: number;
}

function rows(): { rows: Row[]; headline: string } {
  const b = story.bench;
  if (b) {
    const r: Row[] = [
      { label: "damage you take / min", before: b.seeds.damageTakenPerMin, after: b.evolved.damageTakenPerMin, unit: "", digits: 0 },
      { label: "your average life", before: b.seeds.meanLifeSeconds, after: b.evolved.meanLifeSeconds, unit: "s", digits: 1 },
      { label: "imps you kill / min", before: b.seeds.impKillsPerMin, after: b.evolved.impKillsPerMin, unit: "", digits: 1 },
    ];
    const more = Math.round((b.evolved.damageTakenPerMin / b.seeds.damageTakenPerMin - 1) * 100);
    return { rows: r, headline: `${more >= 0 ? "+" : ""}${more}% damage to you` };
  }
  const ratio = story.finalistMean / Math.max(0.1, story.seedMean);
  return {
    rows: [
      { label: "fitness score", before: story.seedMean, after: story.finalistMean, unit: "", digits: 1 },
      { label: "best species", before: story.seedBest, after: story.champion.score, unit: "", digits: 1 },
    ],
    headline: `${ratio.toFixed(1)}× fitter`,
  };
}

const Scoreboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { rows: list, headline } = rows();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Footage clip="evolved-a" from={8} zoom={1.1} style={{ filter: "brightness(0.22) blur(6px)" }} />
      <AbsoluteFill style={{ padding: "90px 140px", ...shake(frame, 5, BAR) }}>
        <div style={{ display: "grid", gridTemplateColumns: "640px 380px 380px", alignItems: "end", rowGap: 22 }}>
          <span />
          <Rise at={0} style={{ fontFamily: DISPLAY, fontSize: 80, color: COLORS.ash, textAlign: "right" }}>
            GEN 0
          </Rise>
          <Rise at={0} style={{ fontFamily: DISPLAY, fontSize: 80, color: COLORS.fire, textAlign: "right" }}>
            GEN {story.topGen}
          </Rise>
          {list.flatMap((r, i) => {
            const at = BEAT * 2 + i * BEAT * 2;
            return [
              <Rise key={`${r.label}l`} at={at} style={{ fontFamily: MONO, fontSize: 40, color: COLORS.bone, paddingBottom: 10 }}>
                {r.label}
              </Rise>,
              <Rise key={`${r.label}b`} at={at} style={{ fontFamily: DISPLAY, fontSize: 104, color: COLORS.ash, textAlign: "right" }}>
                {fmt(countUp(frame, at, BEAT * 2, r.before), r.digits)}
                {r.unit}
              </Rise>,
              <Rise key={`${r.label}a`} at={at + 4} style={{ fontFamily: DISPLAY, fontSize: 104, color: COLORS.fire, textAlign: "right" }}>
                {fmt(countUp(frame, at + 4, BEAT * 2, r.after), r.digits)}
                {r.unit}
              </Rise>,
            ];
          })}
        </div>
        <div style={{ position: "absolute", bottom: 90, left: 0, right: 0, textAlign: "center" }}>
          <Slam at={BAR * 3} size={170} color={COLORS.fire} from={2.4}>
            {headline}
          </Slam>
        </div>
      </AbsoluteFill>
      <FlashAt frame={BAR * 3} strength={0.8} length={8} />
    </AbsoluteFill>
  );
};

export const Payoff: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={BAR * 4}>
      <HyperCut />
    </Sequence>
    <Sequence from={BAR * 4}>
      <Scoreboard />
    </Sequence>
  </AbsoluteFill>
);
