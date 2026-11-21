import { interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../fx";
import { story } from "../story";
import { MONO } from "../type";

export const FamilyTree: React.FC<{ width: number; height: number; showUpToGen: number; labels?: boolean }> = ({
  width,
  height,
  showUpToGen,
  labels = false,
}) => {
  const frame = useCurrentFrame();
  const { nodes, edges } = story.tree;
  const maxGen = Math.max(1, ...nodes.map((n) => n.gen));
  const byGen = new Map<number, typeof nodes>();
  for (const n of nodes) byGen.set(n.gen, [...(byGen.get(n.gen) ?? []), n]);
  const pos = new Map<number, { x: number; y: number }>();
  for (const [gen, list] of byGen) {
    list.sort((a, b) => a.id - b.id);
    list.forEach((n, i) => pos.set(n.id, { x: 20 + (gen / maxGen) * (width - 40), y: ((i + 1) / (list.length + 1)) * height }));
  }
  const visible = (gen: number) => gen <= showUpToGen;
  const glow = 0.6 + 0.4 * Math.sin(frame / 4);

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      {edges.map(([a, b]) => {
        const p = pos.get(a);
        const q = pos.get(b);
        const child = nodes.find((n) => n.id === b);
        if (!p || !q || !child || !visible(child.gen)) return null;
        const mid = (p.x + q.x) / 2;
        return (
          <path
            key={`${a}-${b}`}
            d={`M${p.x},${p.y} C${mid},${p.y} ${mid},${q.y} ${q.x},${q.y}`}
            stroke={child.finalist ? COLORS.fire : COLORS.ash}
            strokeOpacity={child.finalist ? 0.9 : 0.45}
            strokeWidth={child.finalist ? 2.4 : 1.4}
            fill="none"
          />
        );
      })}
      {nodes.filter((n) => visible(n.gen)).map((n) => {
        const p = pos.get(n.id)!;
        const r = n.champion ? 11 : n.finalist ? 7 : 4.5;
        const appear = interpolate(showUpToGen - n.gen, [0, 0.6], [0.3, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
        return (
          <g key={n.id} opacity={appear}>
            {n.champion && <circle cx={p.x} cy={p.y} r={r * 2.4} fill={COLORS.fire} opacity={0.25 * glow} />}
            <circle cx={p.x} cy={p.y} r={r} fill={n.finalist ? COLORS.fire : n.gen === 0 ? COLORS.bone : "#5d5a54"} />
            {labels && (n.champion || n.gen === 0) && (
              <text x={p.x} y={p.y - r - 10} fill={n.champion ? COLORS.fire : COLORS.bone} fontFamily={MONO} fontSize={16} fontWeight={700} textAnchor="middle">
                {n.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};
