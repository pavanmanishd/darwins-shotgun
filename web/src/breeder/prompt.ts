import { TICRATE, WEAPON_NAMES } from "../types";
import type { AudienceMutation, PlayerProfile, Species } from "../types";

export const SYSTEM_PROMPT = `You write brains for imps in DOOM. A brain is a JavaScript function that the engine calls about 12 times per second for every living imp. It only decides how the imp moves and whether it attacks; it never changes the imp's stats.

Imps are slow-ish, throw fireballs at range, claw in melee and have 60 hp.

Contract:
function think(s, mem, squad) returns { move, attack }.

move is one of "advance", "retreat", "strafeL", "strafeR", "flankL", "flankR", "hold". Directions are relative to the line from the imp to the player: advance goes toward the player, retreat goes away, strafeL/strafeR go 90° left/right of that line, flankL/flankR go 45° left/right of it, hold stands still.

attack is a boolean. The engine only attacks when the imp is in melee range or has a clear shot; asking to attack otherwise does nothing. An imp can attack at most once per second.

s holds what the imp senses right now:
- uid: this imp's id
- dist: distance to the player in map units (64 = one wall tile; melee range is about 64)
- aimOffset: 0-180 degrees between the player's aim and this imp; 0 = in the player's crosshair, above 45 = off the player's screen
- canSee, canMelee, canShoot: booleans
- hp, maxHp: this imp's health
- hurtAgo: tics since this imp was last hurt
- playerHp: the player's health
- playerWeapon: 0 fist, 1 pistol, 2 shotgun, 3 chaingun, 4 rocket launcher, 5 plasma rifle, 6 BFG, 7 chainsaw, 8 super shotgun
- playerFiredAgo: tics since the player last fired
- playerSpeed: how fast the player is moving
- alliesNear: imps of the same species within 512 units
- alliesAlive: imps of the same species still alive
- aliveTics: tics this imp has been alive
35 tics = 1 second.

mem is an object that persists for this imp between calls. squad is one object shared by every imp of the species, for coordination.

Fitness, which the species is maximising: damage dealt to the player, plus damage dealt from outside the player's view (aimOffset > 45) counted a second time, plus 25 per player kill, plus 0.2 per second alive capped at 60 seconds. Hiding forever does not pay.

Rules:
- Plain JavaScript (no TypeScript). No side effects except on mem and squad.
- At most 60 lines.
- No loop runs more than 100 iterations.
- No globals besides mem and squad. No Date, no async.

Output format. The first line is exactly:
// NAME: <2-3 word species name> | NOTE: <what changed, max 10 words>
Then the function. Nothing else: no prose, no markdown fences.`;

interface PromptInput {
  a: Species;
  b: Species;
  profile: PlayerProfile;
  mutation?: AudienceMutation;
  repairOf?: { code: string; error: string };
}

export function buildUserPrompt(input: PromptInput): string {
  if (input.repairOf) return repairPrompt(input.repairOf);
  const sections = [parentSection("A", input.a), parentSection("B", input.b), profileSection(input.profile)];
  if (input.mutation) sections.push(mutationSection(input.mutation));
  sections.push(
    "Breed one child brain. Combine what works in both parents and make one targeted change that addresses how they died. " +
      "Reply with the NAME/NOTE line and the function, nothing else.",
  );
  return sections.join("\n\n");
}

function repairPrompt(repair: { code: string; error: string }): string {
  return [
    `This imp brain was rejected with this error:\n${repair.error}`,
    `Code:\n${repair.code}`,
    "Fix it so it follows every rule of the contract, changing as little else as possible. " +
      "Reply in the same format: the NAME/NOTE line, then the function, nothing else.",
  ].join("\n\n");
}

function parentSection(label: string, sp: Species): string {
  const { stats } = sp;
  const runs = sp.scores.length;
  const score = runs ? `${fmt(sp.scores.reduce((a, b) => a + b, 0) / runs)} (mean of ${runs} runs)` : "not scored yet";
  const perImp = (n: number) => (stats.individuals > 0 ? n / stats.individuals : 0);
  const flankShare = stats.damage > 0 ? Math.round((stats.flankDamage / stats.damage) * 100) : 0;
  const lines = [
    `Parent ${label}: "${sp.name}" (generation ${sp.gen})`,
    sp.note && `Note: ${sp.note}`,
    `Score: ${score}`,
    `Imps fielded: ${stats.individuals}`,
    `Damage per imp: ${fmt(perImp(stats.damage))}`,
    `Share of damage dealt from outside the player's view: ${flankShare}%`,
    `Player kills: ${stats.kills}`,
    `Average lifetime: ${fmt(perImp(stats.aliveTics) / TICRATE)} s`,
    `Killed most by: ${topDeathWeapons(stats.deathsByWeapon)}`,
    `Code:\n${sp.code}`,
  ];
  return lines.filter(Boolean).join("\n");
}

function topDeathWeapons(deaths: Record<number, number>): string {
  const top = Object.entries(deaths)
    .filter(([, n]) => n > 0)
    .sort(([, x], [, y]) => y - x)
    .slice(0, 3);
  if (!top.length) return "no deaths recorded";
  return top.map(([w, n]) => `${weaponName(Number(w))} (${n})`).join(", ");
}

function profileSection(p: PlayerProfile): string {
  const lines = ["How the player plays:"];
  if (p.favoriteWeapon !== null) lines.push(`- Favourite weapon: ${weaponName(p.favoriteWeapon)}.`);
  if (p.medianKillDist !== null) {
    lines.push(`- Usually kills imps at about ${Math.round(p.medianKillDist)} map units (${fmt(p.medianKillDist / 64)} wall tiles).`);
  }
  if (p.crosshairKillShare !== null) {
    lines.push(`- ${Math.round(p.crosshairKillShare * 100)}% of their kills are on imps near the crosshair.`);
  }
  if (p.avgShotGapTics !== null) {
    lines.push(`- Fires about every ${fmt(p.avgShotGapTics / TICRATE)} s (${Math.round(p.avgShotGapTics)} tics).`);
  }
  const { front, side, behind } = p.damageFrom;
  lines.push(`- Damage the player has taken by direction: front ${front}, side ${side}, behind ${behind}.`);
  return lines.join("\n");
}

function mutationSection(m: AudienceMutation): string {
  const from = m.handle ? ` from ${m.handle}` : "";
  return `Audience request${from}, which the child must honour:\n"${m.text}"`;
}

function weaponName(w: number): string {
  return WEAPON_NAMES[w] ?? `weapon ${w}`;
}

function fmt(n: number): string {
  return String(Math.round(n * 10) / 10);
}
