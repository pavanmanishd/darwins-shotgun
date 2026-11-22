import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { Footage } from "../Footage";
import { COLORS } from "../fx";
import { story } from "../story";
import { BAR, BEAT } from "../timing";
import { Chip, MONO, Rise, Slam, Typewriter } from "../type";

const FALLBACK_PROFILE = ["Favourite weapon: shotgun.", "Usually kills imps at about 300 map units.", "Fires about every 0.8 s."];

const Terminal: React.FC<{ title: string; children: React.ReactNode; width: number }> = ({ title, children, width }) => (
  <div style={{ width, background: "rgba(8,8,8,0.88)", border: `1px solid ${COLORS.ash}66`, boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${COLORS.ash}44` }}>
      {["#ff5f56", "#ffbd2e", "#27c93f"].map((c) => (
        <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
      ))}
      <span style={{ fontFamily: MONO, fontSize: 18, color: COLORS.ash, marginLeft: 12 }}>{title}</span>
    </div>
    <div style={{ padding: "22px 26px" }}>{children}</div>
  </div>
);

const Profile: React.FC = () => {
  const lines = (story.profile.length ? story.profile : FALLBACK_PROFILE).slice(0, 5);
  return (
    <AbsoluteFill style={{ padding: "110px 120px", gap: 36 }}>
      <Slam at={0} size={110}>
        Kimi reads <span style={{ color: COLORS.fire }}>how you play</span>
      </Slam>
      <Rise at={BEAT}>
        <Terminal title="breeding prompt · player profile" width={1500}>
          {lines.map((l, i) => (
            <div key={l} style={{ fontSize: 34, lineHeight: 1.55, color: COLORS.bone }}>
              <span style={{ fontFamily: MONO, color: COLORS.fire }}>{"› "}</span>
              <Typewriter text={l} at={BEAT + i * 10} cps={90} caret={i === lines.length - 1} />
            </div>
          ))}
        </Terminal>
      </Rise>
    </AbsoluteFill>
  );
};

const CodeRewrite: React.FC = () => {
  const frame = useCurrentFrame();
  const d = story.codeDiff;
  if (!d) return null;
  const flash = 0.55 + 0.45 * Math.sin(frame / 3);
  return (
    <AbsoluteFill style={{ padding: "80px 120px", gap: 24 }}>
      <Slam at={0} size={100}>
        …and <span style={{ color: COLORS.fire }}>rewrites their brains</span>
      </Slam>
      <Rise at={BEAT}>
        <div style={{ display: "flex", gap: 22, alignItems: "center", fontFamily: MONO, fontSize: 30, color: COLORS.bone }}>
          <Chip color={COLORS.ash}>parent · gen {d.parent.gen}</Chip>
          <span>{d.parent.name}</span>
          <span style={{ color: COLORS.fire, fontSize: 44 }}>→</span>
          <Chip>child · gen {d.child.gen}</Chip>
          <span style={{ color: COLORS.fire }}>{d.child.name}</span>
        </div>
      </Rise>
      <Rise at={BEAT * 2}>
        <Terminal title="brain.js · new lines from Kimi" width={1680}>
          <div style={{ fontFamily: MONO, fontSize: 21, lineHeight: 1.4, whiteSpace: "pre", overflow: "hidden" }}>
            {d.lines.map((l, i) => (
              <div key={i} style={{ color: l.added ? COLORS.code : COLORS.ash, background: l.added ? `rgba(120,220,120,${0.12 * flash})` : "transparent" }}>
                {l.added ? "+ " : "  "}
                {l.text.length > 120 ? `${l.text.slice(0, 117)}…` : l.text}
              </div>
            ))}
          </div>
        </Terminal>
      </Rise>
    </AbsoluteFill>
  );
};

const Rewrite: React.FC = () => {
  const frame = useCurrentFrame();
  const diff = story.diff;
  if (!diff) return <CodeRewrite />;
  const keys = Object.keys(diff.child.genes);
  const flash = 0.55 + 0.45 * Math.sin(frame / 3);
  return (
    <AbsoluteFill style={{ padding: "100px 120px", gap: 30 }}>
      <Slam at={0} size={110}>
        …and <span style={{ color: COLORS.fire }}>rewrites their DNA</span>
      </Slam>
      <Rise at={BEAT}>
        <div style={{ display: "flex", gap: 22, alignItems: "center", fontFamily: MONO, fontSize: 30, color: COLORS.bone }}>
          <Chip color={COLORS.ash}>parent · gen {diff.parent.gen}</Chip>
          <span>{diff.parent.name}</span>
          <span style={{ color: COLORS.fire, fontSize: 44 }}>→</span>
          <Chip>child · gen {diff.child.gen}</Chip>
          <span style={{ color: COLORS.fire }}>{diff.child.name}</span>
        </div>
      </Rise>
      <Rise at={BEAT * 2}>
        <Terminal title="brain.js · const G" width={1300}>
          <div style={{ display: "grid", gridTemplateColumns: "300px 260px 80px 260px", rowGap: 6, fontFamily: MONO, fontSize: 30 }}>
            {keys.map((k) => {
              const changed = diff.changed.includes(k);
              const bg = changed ? `rgba(255,77,26,${0.25 * flash})` : "transparent";
              return [
                <span key={`${k}k`} style={{ color: changed ? COLORS.fire : COLORS.ash, background: bg, padding: "2px 8px" }}>
                  {k}
                </span>,
                <span key={`${k}a`} style={{ color: changed ? "#ff8a80" : COLORS.ash, background: bg, padding: "2px 8px", textDecoration: changed ? "line-through" : "none" }}>
                  {diff.parent.genes[k]}
                </span>,
                <span key={`${k}x`} style={{ color: changed ? COLORS.fire : "transparent", background: bg, padding: "2px 8px" }}>
                  →
                </span>,
                <span key={`${k}b`} style={{ color: changed ? COLORS.code : COLORS.bone, background: bg, padding: "2px 8px", fontWeight: changed ? 800 : 400 }}>
                  {diff.child.genes[k]}
                </span>,
              ];
            })}
          </div>
        </Terminal>
      </Rise>
      <Rise at={BEAT * 4} style={{ fontFamily: MONO, fontSize: 38, color: COLORS.ember }}>
        NOTE: {diff.child.note}
      </Rise>
    </AbsoluteFill>
  );
};

export const Reads: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Footage clip="evolved-b" from={2} rate={0.5} zoom={1.15} style={{ filter: "blur(14px) brightness(0.3) saturate(0.7)" }} />
      <AbsoluteFill style={{ transform: `scale(${interpolate(frame, [0, BAR * 4], [1, 1.04])})` }}>
        <Sequence durationInFrames={BAR * 2}>
          <Profile />
        </Sequence>
        <Sequence from={BAR * 2} durationInFrames={BAR * 2}>
          <Rewrite />
        </Sequence>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
