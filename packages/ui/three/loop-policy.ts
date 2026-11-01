/**
 * On-demand rendering for a ThreeCanvas scene. The scene reports how much it
 * is moving; the stage turns that into the canvas's `paused` and `maxFps`.
 *
 * - `active`: the intro, a tween easing to a goal, a press or a pointer
 *   tilt. The loop runs at the display rate so input feels immediate.
 * - `ambient`: only looping decoration moves (a Baby's idle clip, the live
 *   beam and its motes, an egg's idle). The loop runs, capped at
 *   {@linkcode AMBIENT_FPS}: these are delta-timed and read smoothly at half
 *   the frames.
 * - `still`: nothing moves (or reduced motion holds everything). The loop
 *   stops; a state change, a model landing or a pointer calls `invalidate`
 *   and draws exactly one frame.
 *
 * Off screen or backgrounded the canvas stops whatever the scene says:
 * ThreeCanvas folds `useOnScreen` (AppState on native, IntersectionObserver
 * plus page visibility on web) and reduced motion into its own run check.
 */
export type SceneMotion = 'still' | 'ambient' | 'active';

/** The ambient cap, fps. */
export const AMBIENT_FPS = 30;

export interface LoopPlan {
  /** Pass to ThreeCanvas `paused`. */
  readonly paused: boolean;
  /** Pass to ThreeCanvas `maxFps`; undefined runs at the display rate. */
  readonly maxFps: number | undefined;
}

/** The canvas settings for a scene's motion. `visible` is the stage's own in-view signal (web scroll). */
export function loopPlan(motion: SceneMotion, visible = true): LoopPlan {
  if (!visible || motion === 'still') return { paused: true, maxFps: undefined };
  return { paused: false, maxFps: motion === 'ambient' ? AMBIENT_FPS : undefined };
}

/** What a frame moved, from the scene's own flags. Reduced motion has already zeroed the ambient ones. */
export function sceneMotion(flags: { readonly active: boolean; readonly ambient: boolean }): SceneMotion {
  if (flags.active) return 'active';
  return flags.ambient ? 'ambient' : 'still';
}

/**
 * Whether ThreeCanvas's loop draws on a display tick: the same budget test
 * as its `tick` (a millisecond of slack keeps 60 Hz at exactly 30 fps).
 * Exported so the loop and the measurement harness share one rule.
 */
export function tickDue(nowMs: number, lastDrawMs: number, maxFps: number | undefined): boolean {
  const budgetMs = maxFps !== undefined && maxFps > 0 ? 1000 / maxFps - 1 : 0;
  return budgetMs === 0 || nowMs - lastDrawMs >= budgetMs;
}
