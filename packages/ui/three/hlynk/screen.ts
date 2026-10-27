import type { CanvasFont, Ctx2D } from './canvas2d-types.ts';

/** An egg the scene stands on the screen: its hatch manifest JSON and the bundled GLB. */
export interface ScreenEggSource {
  readonly kind?: 'egg';
  readonly eggId: string;
  readonly manifest: unknown;
  /** URL string on web, Metro asset id on native. */
  readonly glb: string | number;
}

/**
 * A Baby the scene stands on the screen (M09, M13-M18): its rigged GLB, the
 * clip list for its mood (first match wins) and its mouth's rest pose. It
 * idles through the same rig as its full-window stage (mon-rig.ts).
 */
export interface ScreenMonSource {
  readonly kind: 'mon';
  readonly key: string;
  /** URL string on web, Metro asset id on native. */
  readonly glb: string | number;
  readonly clips: readonly string[];
  readonly mouth?: { readonly jawBone: string; readonly jawClosedRad: number; readonly rest: Readonly<Record<string, number>> };
}

/** What stands in a slot of the drawn screen. */
export type ScreenModelSource = ScreenEggSource | ScreenMonSource;

/** A 3D model standing in a slot of the drawn screen. */
export interface ScreenModel {
  /** The hit target a tap on the model selects (the same id the screen's hitTest returns for its slot). */
  readonly target: string;
  /** The slot on the screen canvas, px from the top-left. The model stands centred in it. */
  readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** null: no model exists yet; the screen draws "Coming Soon" in the slot instead. */
  readonly source: ScreenModelSource | null;
  /** Tint of the glow and radiating rings behind the model while it is selected. A `hud`/theme token; default by slot. */
  readonly glow?: string;
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
  /**
   * Screen UV from a raycast (v runs bottom-up) to the target there, or null.
   * Targets are the screen's own: a model's slot (`ScreenModel.target`) or an
   * action drawn on the glass (a button, see screen-actions.ts). The scene
   * never interprets them; it hands them back through `select`.
   */
  hitTest(u: number, v: number): string | null;
  /** A tap or click landed on `target` (a model target or an action target). */
  select(target: string): void;
  /** Called whenever the screen's own state changes and it needs a repaint. Returns the unsubscribe. */
  subscribe(onChange: () => void): () => void;
  /** Models standing on the screen. Read once, when the scene builds. */
  readonly models?: readonly ScreenModel[];
  /** The selected target, for the scene to bring its model forward and light its glow. */
  selected?(): string | null;
  /**
   * Extra warmth on the selected model's glow, 0..1, read every frame (M10:
   * up once incubation starts). The scene adds the trackpad's hold on top.
   */
  warmth?(): number;
  /**
   * The clips a Baby standing on the screen plays now, read every frame
   * (its mood changes while the screen shows). A new list cross-fades in
   * place; unset keeps the source's own `clips`.
   */
  monClips?(): readonly string[];
  /** Whether the models show, read every frame (M16: the Baby hides while the Caller looks for it). Unset: always. */
  modelsVisible?(): boolean;
  /**
   * Where the models stand across the glass, read every frame, as a share of
   * the glass width from their slot (M16: the Baby peeks out at the spot it
   * hid behind, -0.3 left .. 0.3 right). The scene eases toward it. Unset: 0.
   */
  modelsOffset?(): number;
  /**
   * Where the Babies stand now, read every frame: a slot rect in canvas px
   * (the Baby is re-seated there, its tap box and glow with it), or null to
   * hide them. Unset keeps each model's own `rect`. One persistent stage
   * shows many screens this way without reloading its models.
   */
  modelRect?(): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null;
  /**
   * A press counter, read every frame (M11 "Keep it warm"). Each change gives
   * the selected model one short V-pet wobble, rocking on its base, and a
   * glow pulse; a press mid-wobble restarts it. Under reduced motion only the
   * pulse plays.
   */
  nudge?(): number;
}

/** UV (v bottom-up) to canvas px (y top-down) on a screen of `size`. */
export function uvToScreenPx(u: number, v: number, size: DeviceScreen['size']): { x: number; y: number } {
  return { x: u * size.width, y: (1 - v) * size.height };
}
