import { SENSOR_COUNT } from "./brains/sensors";
import type { GameEvent } from "./types";

export const MT_TROOP = 11;
export const LABEL_FIELDS = 4;

export interface EngineHandlers {
  think(uid: number, species: number, sensors: Int32Array): number;
  event(e: GameEvent): void;
  labels(data: Int32Array, count: number): void;
}

export interface Engine {
  spawnMonster(type: number, species: number): number;
  setAutopilot(on: boolean): void;
}

interface EngineModule {
  canvas: HTMLCanvasElement;
  locateFile(path: string): string;
  HEAP32: Int32Array;
  callMain(args: string[]): void;
  _spawn_monster(type: number, species: number): number;
  _set_autopilot(on: number): void;
  brainThink(uid: number, species: number, index: number): number;
  brainEvent(kind: number, tic: number, a: number, b: number, c: number, d: number): void;
  brainLabels(index: number, count: number): void;
  onRuntimeInitialized(): void;
  print(text: string): void;
  printErr(text: string): void;
}

const ARGS = ["-iwad", "doom1.wad", "-warp", "1", "1", "-skill", "3", "-nomonsters"];

function toEvent(kind: number, tic: number, a: number, b: number, c: number, d: number): GameEvent | null {
  switch (kind) {
    case 0:
      return { kind: "levelStart", tic };
    case 1:
      return { kind: "spawn", uid: a, species: b, tic };
    case 2:
      return { kind: "hitPlayer", uid: a, damage: b, aimOffset: c, tic };
    case 3:
      return { kind: "death", uid: a, playerWeapon: b, dist: c, aimOffset: d, tic };
    case 4:
      return { kind: "playerFire", weapon: a, tic };
    case 5:
      return { kind: "playerDeath", killer: a, tic };
    default:
      return null;
  }
}

export function startEngine(canvas: HTMLCanvasElement, handlers: EngineHandlers): Promise<Engine> {
  return new Promise((resolve, reject) => {
    const module: Partial<EngineModule> = {
      canvas,
      locateFile: (path) => `/engine/${path}`,
      print: (text) => console.log(text),
      printErr: (text) => console.warn(text),
      // Exceptions must not unwind through the wasm frames that called us, or the runtime aborts.
      brainThink(uid, species, index) {
        try {
          return handlers.think(uid, species, module.HEAP32!.subarray(index, index + SENSOR_COUNT));
        } catch (err) {
          console.error(err);
          return -1;
        }
      },
      brainEvent(kind, tic, a, b, c, d) {
        try {
          const e = toEvent(kind, tic, a, b, c, d);
          if (e) handlers.event(e);
        } catch (err) {
          console.error(err);
        }
      },
      brainLabels(index, count) {
        try {
          handlers.labels(module.HEAP32!.subarray(index, index + count * LABEL_FIELDS), count);
        } catch (err) {
          console.error(err);
        }
      },
      onRuntimeInitialized() {
        const m = module as EngineModule;
        resolve({
          spawnMonster: (type, species) => m._spawn_monster(type, species),
          setAutopilot: (on) => m._set_autopilot(on ? 1 : 0),
        });
        m.callMain(ARGS);
      },
    };
    (window as unknown as { Module: Partial<EngineModule> }).Module = module;

    const script = document.createElement("script");
    script.src = "/engine/doomgeneric.js";
    script.onerror = () => reject(new Error("engine failed to load; run `make -f Makefile.web` in engine/"));
    document.body.appendChild(script);
  });
}
