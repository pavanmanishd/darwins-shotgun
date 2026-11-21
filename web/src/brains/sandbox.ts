import { getQuickJS, type QuickJSContext, type QuickJSHandle, type QuickJSWASMModule } from "quickjs-emscripten";
import { MOVES, type Decision, type Sensors } from "./sensors";

const MEMORY_LIMIT = 1024 * 1024;
// Without a QuickJS stack cap, deep recursion overflows the host's native stack and kills the shared wasm module.
const STACK_LIMIT = 64 * 1024;
const CALL_DEADLINE_MS = 1;
const INSTALL_DEADLINE_MS = 20;

const BIND = `(function (think) {
  if (typeof think !== "function") return undefined;
  const parse = JSON.parse;
  const stringify = JSON.stringify;
  const moves = ${JSON.stringify(MOVES)};
  const mems = new Map();
  const squad = {};
  const show = (v) => (typeof v === "string" ? stringify(v) : v === null || typeof v !== "object" ? String(v) : typeof v);
  return {
    run(json) {
      const s = parse(json);
      let mem = mems.get(s.uid);
      if (mem === undefined) {
        mem = {};
        mems.set(s.uid, mem);
      }
      const d = think(s, mem, squad);
      if (d === null || typeof d !== "object") return "returned " + show(d) + " instead of an object { move, attack }";
      const move = d.move;
      const attack = d.attack;
      const i = moves.indexOf(move);
      if (i < 0) return "returned move " + show(move) + " which is not one of " + moves.join(", ");
      if (typeof attack !== "boolean") return "returned attack " + show(attack) + " which is not a boolean";
      return i * 2 + (attack ? 1 : 0);
    },
    forget(uid) {
      mems.delete(uid);
    },
  };
})(typeof think === "undefined" ? undefined : think)`;

export interface Brain {
  run(sensors: Sensors): Decision | string;
  forget(uid: number): void;
  dispose(): void;
}

export interface BrainHost {
  install(speciesId: number, code: string): string | null;
  think(speciesId: number, sensors: Sensors): Decision | null;
  forget(speciesId: number, uid: number): void;
  remove(speciesId: number): void;
}

function describeError(ctx: QuickJSContext, error: QuickJSHandle, budgetMs: number): string {
  try {
    const e: unknown = ctx.dump(error);
    if (typeof e !== "object" || e === null) return `threw ${String(e)}`;
    const { name, message } = e as { name?: unknown; message?: unknown };
    if (message === "interrupted") return `exceeded time budget (${budgetMs} ms)`;
    if (message === "out of memory") return `exceeded memory limit (${MEMORY_LIMIT / 1024} KB)`;
    if (name === "SyntaxError") return `syntax error: ${String(message)}`;
    if (typeof name === "string" && typeof message === "string") return `threw ${name}: ${message}`;
    return `threw ${JSON.stringify(e)}`;
  } catch {
    return "threw an error that could not be read";
  } finally {
    if (error.alive) error.dispose();
  }
}

export function compileBrain(qjs: QuickJSWASMModule, code: string): Brain | string {
  const runtime = qjs.newRuntime();
  runtime.setMemoryLimit(MEMORY_LIMIT);
  runtime.setMaxStackSize(STACK_LIMIT);
  let deadline = performance.now() + INSTALL_DEADLINE_MS;
  runtime.setInterruptHandler(() => performance.now() > deadline);
  const ctx = runtime.newContext();
  const close = () => {
    ctx.dispose();
    runtime.dispose();
  };
  try {
    return bind(ctx, code, close, (ms) => (deadline = performance.now() + ms));
  } catch (e) {
    close();
    return `sandbox failure: ${String(e)}`;
  }
}

function bind(ctx: QuickJSContext, code: string, close: () => void, armDeadline: (ms: number) => void): Brain | string {
  const loaded = ctx.evalCode(code, "brain.js", { type: "global" });
  if (loaded.error) {
    const message = describeError(ctx, loaded.error, INSTALL_DEADLINE_MS);
    close();
    return message;
  }
  loaded.value.dispose();

  const bound = ctx.evalCode(BIND, "host.js", { type: "global" });
  if (bound.error) {
    const message = describeError(ctx, bound.error, INSTALL_DEADLINE_MS);
    close();
    return message;
  }
  if (ctx.typeof(bound.value) !== "object") {
    bound.value.dispose();
    close();
    return "no function named think";
  }
  const runFn = ctx.getProp(bound.value, "run");
  const forgetFn = ctx.getProp(bound.value, "forget");
  bound.value.dispose();

  return {
    run(sensors) {
      try {
        armDeadline(CALL_DEADLINE_MS);
        const json = ctx.newString(JSON.stringify(sensors));
        let result;
        try {
          result = ctx.callFunction(runFn, ctx.undefined, json);
        } finally {
          json.dispose();
        }
        if (result.error) return describeError(ctx, result.error, CALL_DEADLINE_MS);
        const value = result.value;
        const out = ctx.typeof(value) === "number" ? ctx.getNumber(value) : ctx.getString(value);
        value.dispose();
        if (typeof out === "string") return out;
        const move = MOVES[out >> 1];
        return move === undefined ? "returned an invalid decision" : { move, attack: (out & 1) === 1 };
      } catch (e) {
        return `sandbox failure: ${String(e)}`;
      }
    },
    forget(uid) {
      try {
        armDeadline(CALL_DEADLINE_MS);
        const arg = ctx.newNumber(uid);
        try {
          ctx.callFunction(forgetFn, ctx.undefined, arg).dispose();
        } finally {
          arg.dispose();
        }
      } catch {
        // A brain that broke its own forget only hurts itself.
      }
    },
    dispose() {
      runFn.dispose();
      forgetFn.dispose();
      close();
    },
  };
}

export async function createBrainHost(): Promise<BrainHost> {
  const qjs = await getQuickJS();
  const brains = new Map<number, Brain>();
  const remove = (speciesId: number) => {
    brains.get(speciesId)?.dispose();
    brains.delete(speciesId);
  };
  return {
    install(speciesId, code) {
      remove(speciesId);
      const brain = compileBrain(qjs, code);
      if (typeof brain === "string") return brain;
      brains.set(speciesId, brain);
      return null;
    },
    think(speciesId, sensors) {
      const result = brains.get(speciesId)?.run(sensors);
      return typeof result === "object" ? result : null;
    },
    forget(speciesId, uid) {
      brains.get(speciesId)?.forget(uid);
    },
    remove,
  };
}
