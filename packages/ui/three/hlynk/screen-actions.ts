import { hud } from '@acme/theme';
import type { CanvasFont, Ctx2D } from './canvas2d-types.ts';
import { roundRect, wrap } from './hud-draw.ts';

/** A rect on the screen canvas, px from the top-left. */
export interface ScreenRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * A button drawn on the glass. Its `target` is what the screen's `hitTest`
 * returns for a tap inside `rect`, and what `select` then acts on, the same
 * way a model's target works.
 */
export interface ScreenButton {
  readonly target: string;
  readonly label: string;
  readonly rect: ScreenRect;
  /** `primary`: the red CTA. `secondary`: outlined. `selected`: a chosen option. */
  readonly tone: 'primary' | 'secondary' | 'selected';
  /** Drawn dimmed and never hit. */
  readonly disabled?: boolean;
}

/** True when canvas point (x, y) is inside `r`. */
export function inRect(r: ScreenRect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
}

/** The enabled button under canvas point (x, y), or null. */
export function buttonAt(buttons: readonly ScreenButton[], x: number, y: number): ScreenButton | null {
  return buttons.find((b) => !b.disabled && inRect(b.rect, x, y)) ?? null;
}

/** Paints `button`; `hover` is the stage's hover target. Every colour is a `hud` token. */
export function drawButton(ctx: Ctx2D, font: CanvasFont, button: ScreenButton, hover: string | null): void {
  const { rect: r, tone, disabled } = button;
  const lit = !disabled && hover === button.target;
  roundRect(ctx, r.x, r.y, r.width, r.height, 18);
  ctx.fillStyle = disabled ? hud.panel : tone === 'primary' ? (lit ? hud.redDeep : hud.red) : tone === 'selected' ? hud.red : hud.panel;
  ctx.fill();
  ctx.strokeStyle = disabled ? hud.line : tone === 'secondary' ? (lit ? hud.text : hud.dim) : lit ? hud.text : hud.red;
  ctx.lineWidth = lit ? 5 : 3;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = disabled ? hud.dim : hud.text;
  const size = Math.min(40, Math.round(r.height * 0.36));
  ctx.font = font(size, 700);
  const lines = wrap(ctx, button.label, r.width - 32).slice(0, 2);
  const lineH = size * 1.15;
  const top = r.y + r.height / 2 - ((lines.length - 1) * lineH) / 2;
  lines.forEach((line, i) => ctx.fillText(line, r.x + r.width / 2, top + i * lineH));
}
