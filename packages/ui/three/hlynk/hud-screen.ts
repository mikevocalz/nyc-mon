import type { StoreApi } from 'zustand/vanilla';
import { drawHud } from './hud-draw.ts';
import { HUD_SIZE, HUD_TABS, hudTabAt, type HudContent, type HudHover, type HudState, type HudTab } from './hud.ts';
import type { DeviceScreen } from './screen.ts';

const isTab = (target: string): target is HudTab => (HUD_TABS as readonly string[]).includes(target);

/**
 * The website's H-Lynk HUD (PS-037) as a DeviceScreen: five tabs drawn by
 * hud-draw.ts, the tab bar as the hit area, and the stage's HUD store as the
 * state, shared with the tab control under the stage.
 */
export function createHudScreen(content: HudContent, store: StoreApi<HudState>): DeviceScreen {
  return {
    size: HUD_SIZE,
    draw: (ctx, font, hover) => drawHud(ctx, font, content, store.getState().tab, hover as HudHover | null),
    hitTest: (u, v) => hudTabAt(u, v),
    select: (target) => {
      if (isTab(target) && target !== store.getState().tab) store.setState({ tab: target });
    },
    subscribe: (onChange) => store.subscribe((next, prev) => {
      if (next.tab !== prev.tab) onChange();
    }),
    selected: () => store.getState().tab,
  };
}
