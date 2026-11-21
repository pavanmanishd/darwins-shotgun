import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { Footage } from "../Footage";
import { COLORS, Flash, FlashAt, RgbSplit, glitchAmount, shake } from "../fx";
import { story } from "../story";
import { BAR, BEAT } from "../timing";
import { Chip, DISPLAY, MONO, Rise, Slam, countUp, fmt } from "../type";
import { FamilyTree } from "./Tree";

const CODE_BARS = 2;

const CodeWriting: React.FC = () => {
  const frame = useCurrentFrame();
  const tps = countUp(frame, 0, BEAT * 3, story.speed.fast, 900);
  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      <div style={{ position: "absolute", left: 90, top: 120, width: 860, height: 870, ...shake(frame, 6, BAR) }}>
        <div style={{ position: "absolute", inset: 0, boxShadow: `0 0 0 2px ${COLORS.code}55, 0 0 80px ${COLORS.code}33`, overflow: "hidden" }}>
          <Footage clip="live-fast" part="code" from={3} box={{ w: 860, h: 870 }} fit="cover" />
        </div>
        <div style={{ position: "absolute", left: 0, top: -54 }}>
          <Chip color={COLORS.code}>Kimi writing a new imp brain · at measured speed</Chip>
        </div>
      </div>
      <div style={{ position: "absolute", left: 1060, top: 150, display: "flex", flexDirection: "column", gap: 34 }}>
        <div>
          <Slam at={0} size={190} color={COLORS.fire}>
            {fmt(tps)}
          </Slam>
          <Rise at={2} style={{ fontFamily: MONO, fontSize: 32, color: COLORS.bone, letterSpacing: "0.1em" }}>
            TOKENS / SECOND
          </Rise>
        </div>
        <div>
          <Slam at={BEAT * 4} size={120}>
            {story.speed.fastTtftMs} ms
          </Slam>
          <Rise at={BEAT * 4 + 2} style={{ fontFamily: MONO, fontSize: 28, color: COLORS.ash, letterSpacing: "0.1em" }}>
            TO FIRST TOKEN
          </Rise>
        </div>
        <div>
          <Slam at={BEAT * 6} size={120} color={COLORS.code}>
            1 brain / {story.speed.brainSeconds.toFixed(1)} s
          </Slam>
          <Rise at={BEAT * 6 + 2} style={{ fontFamily: MONO, fontSize: 28, color: COLORS.ash, letterSpacing: "0.1em" }}>
            ~{story.speed.brainTokens} TOKENS OF JAVASCRIPT
          </Rise>
        </div>
      </div>
      <Flash every={BAR} strength={0.35} />
    </AbsoluteFill>
  );
};

const MONTAGE_CLIPS: { clip: "evolved-a" | "evolved-b"; from: number }[] = [
  { clip: "evolved-a", from: 0.5 },
  { clip: "evolved-b", from: 1 },
  { clip: "evolved-a", from: 5 },
  { clip: "evolved-b", from: 6 },
  { clip: "evolved-a", from: 10 },
  { clip: "evolved-b", from: 11 },
];

const Montage: React.FC<{ bars: number }> = ({ bars }) => {
  const frame = useCurrentFrame();
  const clipsShown = MONTAGE_CLIPS.slice(0, bars);
  const shot = Math.min(clipsShown.length - 1, Math.floor(frame / BAR));
  const cards = story.montage.slice(-clipsShown.length);
  const card = cards[Math.min(shot, cards.length - 1)];
  const genShown = Math.round(
    interpolate(frame, clipsShown.map((_, i) => i * BAR), clipsShown.map((_, i) => cards[Math.min(i, cards.length - 1)]?.gen ?? 0), {
      extrapolateRight: "clamp",
    }),
  );
  const cuts = clipsShown.map((_, i) => i * BAR);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <RgbSplit amount={glitchAmount(frame, cuts, 6, 20)} style={shake(frame, 9)}>
        {clipsShown.map((c, i) => (
          <Sequence key={i} from={i * BAR} durationInFrames={BAR}>
            <Footage clip={c.clip} from={c.from} zoom={interpolate(frame - i * BAR, [0, BAR], [1.12, 1.02])} style={{ filter: "saturate(1.15) contrast(1.08)" }} />
          </Sequence>
        ))}
      </RgbSplit>
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 55%)" }} />

      <div style={{ position: "absolute", left: 80, top: 70, display: "flex", alignItems: "flex-end", gap: 14 }}>
        <span style={{ fontFamily: DISPLAY, fontSize: 56, color: COLORS.bone, paddingBottom: 22 }}>GEN</span>
        <span style={{ fontFamily: DISPLAY, fontSize: 200, color: COLORS.fire, lineHeight: 0.85 }}>{genShown}</span>
      </div>

      <div style={{ position: "absolute", right: 60, top: 60, padding: 18, background: "rgba(0,0,0,0.55)", border: `1px solid ${COLORS.ash}55` }}>
        <div style={{ fontFamily: MONO, fontSize: 18, color: COLORS.ash, letterSpacing: "0.14em", marginBottom: 8 }}>FAMILY TREE</div>
        <FamilyTree width={420} height={230} showUpToGen={interpolate(frame, [0, BAR * bars], [0, story.topGen], { extrapolateRight: "clamp" })} />
      </div>

      {card && (
        <Sequence from={shot * BAR} durationInFrames={BAR} layout="none">
          <div style={{ position: "absolute", left: 84, bottom: 110, maxWidth: 1250 }}>
            <Rise at={0}>
              <Chip>new species · gen {card.gen}</Chip>
            </Rise>
            <Slam at={2} size={150} style={{ marginTop: 18 }}>
              {card.name}
            </Slam>
            <Rise at={BEAT} style={{ fontFamily: MONO, fontSize: 42, color: COLORS.ember, marginTop: 10 }}>
              learned: {card.note}
            </Rise>
          </div>
        </Sequence>
      )}
      <Flash every={BAR} strength={0.45} />
    </AbsoluteFill>
  );
};

export const Drop: React.FC<{ bars?: number }> = ({ bars = 8 }) => (
  <AbsoluteFill>
    <Sequence durationInFrames={BAR * CODE_BARS}>
      <CodeWriting />
    </Sequence>
    <Sequence from={BAR * CODE_BARS}>
      <Montage bars={bars - CODE_BARS} />
    </Sequence>
    <FlashAt frame={0} strength={1} length={10} />
  </AbsoluteFill>
);
