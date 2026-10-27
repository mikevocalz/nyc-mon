import type { CanvasFont, Ctx2D } from './canvas2d-types.ts';

/** An egg (or any posed model) the scene stands on the screen: the manifest JSON and the bundled GLB. */
export interface ScreenModelSource {
  readonly eggId: string;
  readonly manifest: unknown;
  /** URL string on web, Metro asset id on native. */
  readonly glb: string | number;
}

/** A 3D model standing in a slot of the drawn screen. */
export interface ScreenModel {
  /** The hit target a tap on the model selects (the same id the screen's hitTest returns for its slot). */
  readonly target: string;
  /** The slot on the screen canvas, px from the top-left. The model stands centred in it. */
  readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** null: no model exists yet; the screen draws "Coming Soon" in the slot instead. */
  readonly source: ScreenModelSource | null;
}

/**
 * What the H-Lynk shows on its glass. The device scene owns the 3D body,
 * the lights, the pointer and the side key; a screen owns the pixels on the
 * glass, what a tap there selects, and any models standing in front of it.
 * The website's HUD and the app's egg choice are both screens on the one
 * DeviceStage.
 */
export interface DeviceScreen {
  /** Canvas size, px. The glass is 0.8 x 1.0 body widths, so keep 4:5. */
  readonly size: { readonly width: number; readonly height: number };
  /** Paint the current state. `hover` is the target under the pointer, or null. */
  draw(ctx: Ctx2D, font: CanvasFont, hover: string | null): void;
  /** Screen UV from a raycast (v runs bottom-up) to the target there, or null. */
  hitTest(u: number, v: number): string | null;
  /** A tap or click landed on `target`. */
  select(target: string): void;
  /** Called whenever the screen's own state changes and it needs a repaint. Returns the unsubscribe. */
  subscribe(onChange: () => void): () => void;
  /** Models standing on the screen. Read once, when the scene builds. */
  readonly models?: readonly ScreenModel[];
  /** The selected target, for the scene to bring its model forward. */
  selected?(): string | null;
}

/** UV (v bottom-up) to canvas px (y top-down) on a screen of `size`. */
export function uvToScreenPx(u: number, v: number, size: DeviceScreen['size']): { x: number; y: number } {
  return { x: u * size.width, y: (1 - v) * size.height };
}
