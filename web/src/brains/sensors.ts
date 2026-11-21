export const SENSOR = {
  DIST: 0,
  AIM_OFFSET: 1,
  CAN_SEE: 2,
  CAN_MELEE: 3,
  CAN_SHOOT: 4,
  HP: 5,
  MAX_HP: 6,
  HURT_AGO: 7,
  PLAYER_HP: 8,
  PLAYER_WEAPON: 9,
  PLAYER_FIRED_AGO: 10,
  PLAYER_SPEED: 11,
  ALLIES_NEAR: 12,
  ALIVE_TICS: 13,
} as const;

export const SENSOR_COUNT = Object.keys(SENSOR).length;

export const MOVES = ["advance", "retreat", "strafeL", "strafeR", "flankL", "flankR", "hold"] as const;
export type Move = (typeof MOVES)[number];

export const ATTACK_BIT = 16;

export interface Sensors {
  uid: number;
  dist: number;
  aimOffset: number;
  canSee: boolean;
  canMelee: boolean;
  canShoot: boolean;
  hp: number;
  maxHp: number;
  hurtAgo: number;
  playerHp: number;
  playerWeapon: number;
  playerFiredAgo: number;
  playerSpeed: number;
  alliesNear: number;
  alliesAlive: number;
  aliveTics: number;
}

export interface Decision {
  move: Move;
  attack: boolean;
}

export function decodeSensors(raw: ArrayLike<number>, uid: number, alliesAlive: number): Sensors {
  const at = (i: number) => raw[i] ?? 0;
  return {
    uid,
    dist: at(SENSOR.DIST),
    aimOffset: at(SENSOR.AIM_OFFSET),
    canSee: at(SENSOR.CAN_SEE) !== 0,
    canMelee: at(SENSOR.CAN_MELEE) !== 0,
    canShoot: at(SENSOR.CAN_SHOOT) !== 0,
    hp: at(SENSOR.HP),
    maxHp: at(SENSOR.MAX_HP),
    hurtAgo: at(SENSOR.HURT_AGO),
    playerHp: at(SENSOR.PLAYER_HP),
    playerWeapon: at(SENSOR.PLAYER_WEAPON),
    playerFiredAgo: at(SENSOR.PLAYER_FIRED_AGO),
    playerSpeed: at(SENSOR.PLAYER_SPEED),
    alliesNear: at(SENSOR.ALLIES_NEAR),
    alliesAlive,
    aliveTics: at(SENSOR.ALIVE_TICS),
  };
}

export function packDecision(d: Decision): number {
  return MOVES.indexOf(d.move) | (d.attack ? ATTACK_BIT : 0);
}
