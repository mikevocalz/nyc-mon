// Error and progress reporting between the worklet render runtime and the
// React Native runtime. Loaded only in worklet mode (worklet-host.ts and
// game-render.ts import it), so the default build never evaluates it.
//
// Two halves, both pure:
// - the runtime half (`describeRuntimeError`, `installFrameGlobals`) runs ON
//   the render runtime. It imports nothing, so a worklet runtime can evaluate
//   it, and the worklet entries in worklet-host.ts reach it by forwarded
//   relative import.
// - the RN half (`routeRenderEvent`) turns the runtime's events into
//   console lines and load milestones on the JS thread.
//
// Why this exists: an exception on a worker runtime that nobody catches,
// and every rejected promise there, disappears. Hermes on a worklet runtime
// reports neither to logcat nor to Metro, so a stalled start used to show
// nothing at all (Surface Duo, 2026-10-16: loadProgress stuck at 0).

/** Events from the render runtime. `detail` is a stage, a breadcrumb, or a formatted error. */
export type GameRenderEventKind = 'backend' | 'stage' | 'firstFrame' | 'failed' | 'trace' | 'error';

/** The load milestones the runtime may report (game-session.ts LOAD_STAGES, minus `done`, which `firstFrame` sets). */
export const RUNTIME_LOAD_STAGES = ['requested', 'moduleLoaded', 'worldBuilt', 'firstRender'] as const;
export type RuntimeLoadStage = (typeof RUNTIME_LOAD_STAGES)[number];

export function isRuntimeLoadStage(value: string): value is RuntimeLoadStage {
  return (RUNTIME_LOAD_STAGES as readonly string[]).includes(value);
}

/**
 * One line for console.error on the JS thread: where it failed, the error,
 * and its stack. Worklets serialise an Error's stack poorly across runtimes,
 * so the runtime formats it before it crosses.
 */
export function describeRuntimeError(where: string, error: unknown): string {
  if (error instanceof Error) {
    const head = `${where}: ${error.name}: ${error.message}`;
    return error.stack ? `${head}\n${error.stack}` : head;
  }
  return `${where}: ${String(error)}`;
}

/**
 * three.js reads the frame loop through `self`: Renderer.init() builds an
 * Animation whose `_context` is `typeof self !== 'undefined' ? self : null`
 * and then calls `_context.requestAnimationFrame` (three r186,
 * renderers/common/Animation.js). React Native defines `self` in
 * setUpGlobals.js, but that runs from InitializeCore, which a worklet runtime
 * never runs (worklets' ScriptLoader intercepts Metro's entry points). With
 * `self` undefined the call throws inside init()'s async promise executor:
 * the rejection is unhandled and `init()` never settles, so the city is never
 * built and no milestone after `requested` ever arrives.
 *
 * This aliases `self` to the runtime's global, as setUpGlobals.js does on the
 * RN runtime. The worklet runtime's polyfilled requestAnimationFrame and
 * cancelAnimationFrame are then reachable through it. Returns true when it
 * installed the alias.
 */
export function installFrameGlobals(target: Record<string, unknown> = globalThis as unknown as Record<string, unknown>): boolean {
  if (target.self !== undefined) return false;
  target.self = target;
  return true;
}

export interface RenderEventSinks {
  log: (message: string) => void;
  error: (message: string) => void;
  loadStage: (stage: RuntimeLoadStage) => void;
}

/**
 * The JS-thread side of `trace`, `error` and `stage` events. Returns true when
 * it handled the event; `backend`, `firstFrame` and `failed` stay with the
 * session (they drive the canvas and the screen store).
 */
export function routeRenderEvent(kind: GameRenderEventKind, detail: string, sinks: RenderEventSinks): boolean {
  switch (kind) {
    case 'trace':
      sinks.log(`[GameRender] render runtime reached: ${detail}`);
      return true;
    case 'error':
      sinks.error(`[GameRender] render runtime error in ${detail}`);
      return true;
    case 'stage':
      if (isRuntimeLoadStage(detail)) {
        sinks.log(`[GameRender] load stage: ${detail}`);
        sinks.loadStage(detail);
      } else {
        sinks.error(`[GameRender] unknown load stage from the render runtime: ${detail}`);
      }
      return true;
    default:
      return false;
  }
}
