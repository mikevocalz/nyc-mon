import { hud } from '@acme/theme';
import type { CanvasFont, Ctx2D } from './canvas2d-types.ts';
import { roundRect, wrap } from './hud-draw.ts';
import { HUD_SIZE } from './hud.ts';
import { buttonAt, drawButton, type ScreenButton, type ScreenRect } from './screen-actions.ts';
import { uvToScreenPx, type DeviceScreen, type ScreenModel, type ScreenModelSource } from './screen.ts';

/** The Baby's hit target on a glass screen: a tap on the model. */
export const GLASS_MON_TARGET = 'mon';

/** The status row's tone: plain, asking for something, or done. */
export type GlassTone = 'neutral' | 'request' | 'ready';

/** One care meter drawn as a ring (M13's CareMeterRing on the glass). */
export interface GlassRing {
  readonly id: string;
  readonly label: string;
  /** 0..1. */
  readonly value: number;
  /** Under the needs-you line: the arc turns red and the label says so. */
  readonly low: boolean;
  readonly lowLabel: string;
  /** A `hud` token. */
  readonly tint: string;
}

/** One line of text in the screen's lower block. */
export interface GlassLine {
  readonly text: string;
  readonly size?: 'plate' | 'body' | 'caption';
  readonly tone?: 'text' | 'dim' | 'amber' | 'green' | 'red';
  /** A small badge after the text (the Journal's "First"). */
  readonly badge?: string;
  /** Left-aligned (a list row) instead of centred. */
  readonly align?: 'left' | 'center';
}

/** A button on the glass. `target` is what `onAction` receives. */
export interface GlassAction {
  readonly target: string;
  readonly label: string;
  readonly tone: 'primary' | 'secondary' | 'selected';
  readonly disabled?: boolean;
}

/** What the glass shows. Read on every repaint; change it only through `subscribe`. */
export interface GlassView {
  readonly status: { readonly text: string; readonly tone: GlassTone } | null;
  readonly title: string;
  readonly subtitle: string;
  readonly rings: readonly GlassRing[];
  readonly lines: readonly GlassLine[];
  readonly actions: readonly GlassAction[];
}

/**
 * The screen's fixed layout, chosen when it is built (the scene reads the
 * model slot once). `model` sizes the Baby's slot; `rings` reserves the ring
 * row under the title; `lineRows` the text block under the model, in body
 * lines; `actionRows` the button rows along the bottom, `perRow` buttons each.
 */
export interface GlassLayout {
  readonly model: 'large' | 'medium' | 'small' | 'none';
  readonly rings: boolean;
  readonly lineRows: number;
  readonly actionRows: 0 | 1 | 2 | 3;
  readonly perRow: number;
}

export interface GlassScreenOptions {
  readonly layout: GlassLayout;
  /** The Baby standing on the glass, or null for none. A null `source` draws the Coming Soon badge in its slot. */
  readonly model: { readonly source: ScreenModelSource | null; readonly glow?: string } | null;
  readonly comingSoon: string;
  readonly view: () => GlassView;
  readonly subscribe: (onChange: () => void) => () => void;
  readonly onAction: (target: string) => void;
  /** A tap on the Baby. */
  readonly onModel?: () => void;
  /** Taps on the Baby so far: each new one wobbles it (DeviceScreen.nudge). */
  readonly nudge?: () => number;
  /** The Baby's clips now (its mood can change while the screen shows). */
  readonly monClips?: () => readonly string[];
  /** Whether the Baby shows now (M16 hides it during the rounds). */
  readonly modelVisible?: () => boolean;
  /** Where the Baby stands across the glass now, a share of its width (M16's peek). */
  readonly modelOffset?: () => number;
}

const { width: W, height: H } = HUD_SIZE;
const PAD = 40;
const ACTION_H = 104;
const ACTION_GAP = 16;
const BODY_LINE = 44;
const LINE_HEIGHT = { plate: 88, body: BODY_LINE, caption: 38 } as const;
const LINE_FONT = { plate: [60, 800], body: [32, 600], caption: [26, 500] } as const;
const RING_R = 46;
const TONE_COLOUR = { text: hud.text, dim: hud.dim, amber: hud.amber, green: hud.green, red: hud.red } as const;

/** Where everything sits for a layout: header, ring row, model slot, text block and action rows. */
export function glassGeometry(layout: GlassLayout) {
  const headerBottom = layout.rings ? 404 : 236;
  const rows = layout.actionRows;
  const actionsTop = rows === 0 ? H - PAD : H - PAD - rows * ACTION_H - (rows - 1) * ACTION_GAP;
  const linesHeight = layout.lineRows * BODY_LINE;
  const linesTop = actionsTop - 24 - linesHeight;
  const room = Math.max(0, linesTop - 16 - headerBottom);
  const share = { large: 1, medium: 0.78, small: 0.55, none: 0 }[layout.model];
  const modelHeight = Math.round(room * share);
  const modelWidth = Math.min(W - PAD * 2, Math.round(modelHeight * 1.1));
  const model: ScreenRect | null = layout.model === 'none' || modelHeight < 80 ? null : {
    x: Math.round((W - modelWidth) / 2),
    y: headerBottom + Math.round((room - modelHeight) / 2),
    width: modelWidth,
    height: modelHeight,
  };
  const actionRect = (index: number): ScreenRect => {
    const perRow = Math.max(1, layout.perRow);
    const row = Math.floor(index / perRow);
    const col = index % perRow;
    const width = (W - PAD * 2 - (perRow - 1) * ACTION_GAP) / perRow;
    return { x: PAD + col * (width + ACTION_GAP), y: actionsTop + row * (ACTION_H + ACTION_GAP), width, height: ACTION_H };
  };
  return { headerBottom, actionsTop, linesTop, linesHeight, model, actionRect };
}

/** An arc as a polyline (Ctx2D has no `arc`), clockwise from 12 o'clock over `turn` of a circle. */
function strokeArc(ctx: Ctx2D, cx: number, cy: number, r: number, turn: number): void {
  const steps = Math.max(2, Math.ceil(64 * turn));
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * turn * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawRings(ctx: Ctx2D, font: CanvasFont, rings: readonly GlassRing[]): void {
  const slot = (W - PAD * 2) / Math.max(1, rings.length);
  rings.forEach((ring, i) => {
    const cx = PAD + slot * (i + 0.5);
    const cy = 296;
    const value = Math.min(1, Math.max(0, ring.value));
    ctx.lineCap = 'round';
    ctx.lineWidth = 12;
    ctx.strokeStyle = hud.line;
    strokeArc(ctx, cx, cy, RING_R, 1);
    if (value > 0) {
      ctx.strokeStyle = ring.low ? hud.red : ring.tint;
      strokeArc(ctx, cx, cy, RING_R, value);
    }
    ctx.lineCap = 'butt';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = hud.text;
    ctx.font = font(26, 700);
    ctx.fillText(`${Math.round(value * 100)}`, cx, cy);
    ctx.fillStyle = ring.low ? hud.amber : hud.dim;
    ctx.font = font(24, 600);
    ctx.fillText(ring.low ? `${ring.label} · ${ring.lowLabel}` : ring.label, cx, cy + RING_R + 32);
  });
}

/**
 * A screen on the H-Lynk's glass for the companion loop (M09 naming, M13
 * home, M14-M16 care, M17 Dex, M18 Journal): the status row with its rule,
 * the title and its caption, an optional row of care rings, the Baby as its
 * 3D model standing in the middle (or the Coming Soon badge), a block of text
 * lines under it, and the screen's actions as glass buttons along the bottom.
 * The trackpad and the keys stay the app's (DeviceStage `onKey`). Every
 * colour is a `hud` token. What it shows comes from `view`; the layout is
 * fixed when it is built, because the scene reads the model slot once.
 */
export function createGlassScreen(options: GlassScreenOptions): DeviceScreen {
  const geo = glassGeometry(options.layout);
  const models: ScreenModel[] = options.model === null || geo.model === null ? [] : [{
    target: GLASS_MON_TARGET,
    rect: geo.model,
    source: options.model.source,
    ...(options.model.glow ? { glow: options.model.glow } : {}),
  }];
  const capacity = options.layout.actionRows * Math.max(1, options.layout.perRow);
  const buttons = (): ScreenButton[] =>
    options.view().actions.slice(0, capacity).map((a, i) => ({
      target: a.target, label: a.label, tone: a.tone, rect: geo.actionRect(i), ...(a.disabled ? { disabled: true } : {}),
    }));

  return {
    size: HUD_SIZE,
    models,
    selected: () => (models.length > 0 ? GLASS_MON_TARGET : null),
    ...(options.nudge ? { nudge: options.nudge } : {}),
    ...(options.monClips ? { monClips: options.monClips } : {}),
    ...(options.modelVisible ? { modelsVisible: options.modelVisible } : {}),
    ...(options.modelOffset ? { modelsOffset: options.modelOffset } : {}),
    // The slot this layout gives the Baby, so a persistent stage re-seats it per screen.
    modelRect: () => (models.length > 0 ? geo.model : null),
    subscribe: options.subscribe,
    hitTest: (u, v) => {
      const { x, y } = uvToScreenPx(u, v, HUD_SIZE);
      return buttonAt(buttons(), x, y)?.target ?? null;
    },
    select: (target) => {
      if (target === GLASS_MON_TARGET) {
        options.onModel?.();
        return;
      }
      if (buttons().some((b) => b.target === target && !b.disabled)) options.onAction(target);
    },
    draw: (ctx, font, hover) => {
      const view = options.view();
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, hud.bg1);
      bg.addColorStop(0.4, hud.bg0);
      bg.addColorStop(1, hud.bg0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Status row and its rule.
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      if (view.status) {
        ctx.fillStyle = view.status.tone === 'request' ? hud.amber : view.status.tone === 'ready' ? hud.green : hud.dim;
        ctx.font = font(30, 600);
        ctx.fillText(wrap(ctx, view.status.text, W - PAD * 2 - 90)[0] ?? '', PAD, 56);
      }
      ctx.fillStyle = hud.dim;
      for (let i = 0; i < 4; i++) {
        const h = 10 + i * 7;
        ctx.fillRect(W - 112 + i * 16, 70 - h, 10, h);
      }
      ctx.fillStyle = hud.line;
      ctx.fillRect(PAD, 100, W - PAD * 2, 3);
      ctx.fillStyle = view.status?.tone === 'request' ? hud.amber : hud.red;
      ctx.fillRect(PAD, 100, 120, 3);

      // Title and caption.
      ctx.textAlign = 'center';
      ctx.fillStyle = hud.text;
      ctx.font = font(46, 800);
      ctx.fillText(wrap(ctx, view.title, W - PAD * 2)[0] ?? '', W / 2, 152);
      if (view.subtitle !== '') {
        ctx.fillStyle = hud.dim;
        ctx.font = font(28, 600);
        ctx.fillText(wrap(ctx, view.subtitle, W - PAD * 2)[0] ?? '', W / 2, 200);
      }

      if (options.layout.rings && view.rings.length > 0) drawRings(ctx, font, view.rings);

      if (models.length > 0 && options.model?.source === null && geo.model) {
        // No model for this form yet: the kit's Coming Soon badge where it would stand.
        const r = geo.model;
        const cy = r.y + r.height / 2;
        roundRect(ctx, r.x + r.width / 2 - 150, cy - 30, 300, 60, 12);
        ctx.fillStyle = hud.amber;
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.fillStyle = hud.bg0;
        ctx.font = font(28, 700);
        ctx.fillText(options.comingSoon, r.x + r.width / 2, cy);
      }

      // The text block: as many lines as fit its rows, top down.
      let y = geo.linesTop;
      const bottom = geo.linesTop + geo.linesHeight;
      for (const line of view.lines) {
        const size = line.size ?? 'body';
        const height = LINE_HEIGHT[size];
        if (y + height > bottom + 1) break;
        const [px, weight] = LINE_FONT[size];
        ctx.font = font(px, weight);
        ctx.fillStyle = TONE_COLOUR[line.tone ?? (size === 'body' ? 'text' : 'dim')];
        const left = line.align === 'left';
        ctx.textAlign = left ? 'left' : 'center';
        const badgeW = line.badge ? 120 : 0;
        const text = wrap(ctx, line.text, W - PAD * 2 - badgeW)[0] ?? '';
        const cy = y + height / 2;
        ctx.fillText(text, left ? PAD : W / 2, cy);
        if (line.badge) {
          const textW = ctx.measureText(text).width;
          const bx = left ? PAD + textW + 16 : W / 2 + textW / 2 + 16;
          roundRect(ctx, bx, cy - 16, 100, 32, 8);
          ctx.fillStyle = hud.panel;
          ctx.fill();
          ctx.strokeStyle = hud.dim;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.textAlign = 'center';
          ctx.fillStyle = hud.text;
          ctx.font = font(20, 700);
          ctx.fillText(line.badge, bx + 50, cy);
        }
        y += height;
      }

      for (const button of buttons()) drawButton(ctx, font, button, hover);
    },
  };
}
