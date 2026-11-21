import { TICRATE, type GameEvent, type PlayerProfile } from "../types";
import { FLANK_OFFSET } from "./fitness";

const WINDOW = 30;
const CROSSHAIR_OFFSET = 15;
const BEHIND_OFFSET = 135;
const PAUSE_TICS = 5 * TICRATE;

interface Kill {
  dist: number;
  aimOffset: number;
}

function pushCapped<T>(list: T[], item: T, cap: number): void {
  list.push(item);
  if (list.length > cap) list.shift();
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export class ProfileTracker {
  private killsByWeapon = new Map<number, number>();
  private recentKills: Kill[] = [];
  private shotGaps: number[] = [];
  private lastFireTic: number | null = null;
  private damageFrom = { front: 0, side: 0, behind: 0 };

  handle(e: GameEvent): void {
    switch (e.kind) {
      case "death":
        this.killsByWeapon.set(e.playerWeapon, (this.killsByWeapon.get(e.playerWeapon) ?? 0) + 1);
        pushCapped(this.recentKills, { dist: e.dist, aimOffset: e.aimOffset }, WINDOW);
        break;
      case "playerFire":
        if (this.lastFireTic !== null) pushCapped(this.shotGaps, e.tic - this.lastFireTic, WINDOW - 1);
        this.lastFireTic = e.tic;
        break;
      case "hitPlayer":
        if (e.aimOffset <= FLANK_OFFSET) this.damageFrom.front += e.damage;
        else if (e.aimOffset <= BEHIND_OFFSET) this.damageFrom.side += e.damage;
        else this.damageFrom.behind += e.damage;
        break;
      case "levelStart":
        this.lastFireTic = null;
        break;
    }
  }

  profile(): PlayerProfile {
    let favoriteWeapon: number | null = null;
    let most = 0;
    for (const [weapon, kills] of this.killsByWeapon) {
      if (kills > most) {
        favoriteWeapon = weapon;
        most = kills;
      }
    }
    const kills = this.recentKills;
    const gaps = this.shotGaps.filter((g) => g <= PAUSE_TICS);
    return {
      favoriteWeapon,
      medianKillDist: kills.length ? median(kills.map((k) => k.dist)) : null,
      crosshairKillShare: kills.length ? kills.filter((k) => k.aimOffset < CROSSHAIR_OFFSET).length / kills.length : null,
      avgShotGapTics: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null,
      damageFrom: { ...this.damageFrom },
    };
  }
}
