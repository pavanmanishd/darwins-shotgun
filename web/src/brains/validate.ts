import { getQuickJS } from "quickjs-emscripten";
import { compileBrain } from "./sandbox";
import type { Sensors } from "./sensors";

const CALLS = 300;
const UIDS = 8;
const TOTAL_BUDGET_MS = 50;

const int = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

function randomSensors(uid: number): Sensors {
  const dist = int(32, 2000);
  const canSee = Math.random() < 0.7;
  const alliesAlive = int(1, 12);
  return {
    uid,
    dist,
    aimOffset: int(0, 180),
    canSee,
    canMelee: canSee && dist <= 64,
    canShoot: canSee && Math.random() < 0.8,
    hp: int(1, 60),
    maxHp: 60,
    hurtAgo: int(0, 2000),
    playerHp: int(1, 200),
    playerWeapon: int(0, 8),
    playerFiredAgo: int(0, 600),
    playerSpeed: int(0, 30),
    alliesNear: int(0, alliesAlive - 1),
    alliesAlive,
    aliveTics: int(0, 20000),
  };
}

export async function validateBrain(code: string): Promise<string | null> {
  const brain = compileBrain(await getQuickJS(), code);
  if (typeof brain === "string") return brain;
  try {
    const snapshots = Array.from({ length: CALLS }, () => randomSensors(int(1, UIDS)));
    const start = performance.now();
    for (const s of snapshots) {
      const result = brain.run(s);
      if (typeof result === "string") return result;
      if (performance.now() - start > TOTAL_BUDGET_MS) {
        return `exceeded time budget: ${CALLS} calls must take under ${TOTAL_BUDGET_MS} ms in total`;
      }
    }
    return null;
  } finally {
    brain.dispose();
  }
}
