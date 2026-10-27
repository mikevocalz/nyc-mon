import { HUD_SIZE } from './hud.ts';
import type { DeviceScreen, ScreenModel } from './screen.ts';

export interface SwitchScreenOptions {
  /** The models the persistent stage loads once and keeps (the active Baby). */
  readonly models: readonly ScreenModel[];
  /** The screen showing now. */
  readonly current: () => DeviceScreen;
  /** Calls `onChange` whenever `current` starts returning a different screen. Returns the unsubscribe. */
  readonly watch: (onChange: () => void) => () => void;
}

/**
 * One DeviceScreen for a persistent 3D H-Lynk that many routes share. The
 * stage builds its scene, glass texture and models once; each route publishes
 * its own screen, and this one draws, hit-tests and selects through whichever
 * is current, repainting the glass when the screen changes. Its models stay
 * loaded and are re-seated per screen (`modelRect`), so moving between routes
 * never reloads a GLB, replays the intro or shows the loader. A tap counter
 * that restarts with a new screen does not wobble the Baby: only a change
 * within one screen counts.
 */
export function createSwitchScreen(options: SwitchScreenOptions): DeviceScreen {
  let total = 0;
  let seen: DeviceScreen | null = null;
  let seenCount = 0;
  return {
    size: HUD_SIZE,
    models: options.models,
    draw: (ctx, font, hover) => options.current().draw(ctx, font, hover),
    hitTest: (u, v) => options.current().hitTest(u, v),
    select: (target) => options.current().select(target),
    subscribe: (onChange) => {
      let inner = options.current().subscribe(onChange);
      const stop = options.watch(() => {
        inner();
        inner = options.current().subscribe(onChange);
        onChange();
      });
      return () => {
        stop();
        inner();
      };
    },
    selected: () => options.current().selected?.() ?? null,
    warmth: () => options.current().warmth?.() ?? 0,
    nudge: () => {
      const screen = options.current();
      const count = screen.nudge?.() ?? 0;
      if (screen !== seen) {
        seen = screen;
        seenCount = count;
      } else if (count !== seenCount) {
        seenCount = count;
        total += 1;
      }
      return total;
    },
    monClips: () => options.current().monClips?.() ?? [],
    modelsVisible: () => options.current().modelsVisible?.() ?? true,
    modelsOffset: () => options.current().modelsOffset?.() ?? 0,
    modelRect: () => {
      const screen = options.current();
      return screen.modelRect ? screen.modelRect() : (options.models[0]?.rect ?? null);
    },
  };
}
