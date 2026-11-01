import { hud } from '@acme/theme';
import type { Ctx2D } from './canvas2d-types.ts';
import { roundRect, wrap } from './hud-draw.ts';
import { HUD_SIZE } from './hud.ts';
import { buttonAt, drawButton, type ScreenButton, type ScreenRect } from './screen-actions.ts';
import { uvToScreenPx, type DeviceScreen, type ScreenModel, type ScreenModelSource } from './screen.ts';

/** The egg's hit target (the scene's box over its slot): a tap there is `onEgg`. */
export const INCUBATING_EGG_TARGET = 'egg';
/** The main action: "Keep it warm" while counting, "Hatch your egg" once ready. */
export const INCUBATING_ACTION_TARGET = 'action';
/** The notification row's action ("Turn on" / "Open Settings"). */
export const INCUBATING_NOTIFY_TARGET = 'notify';

/** What the glass shows. Read on every repaint; change it only through the store `subscribe` watches. */
export interface IncubatingView {
  /** Status row: "Incubating, 12 min left" or "Ready to hatch". */
  readonly status: string;
  /** 0..1 incubation progress, drawn as the status row's rule and the timer ring. */
  readonly progress: number;
  /** True once the egg is ready (or overdue, or mid-hatch): the ring goes and the action opens the hatch. */
  readonly ready: boolean;
  /** The big time line: "15 min left", "Ready to hatch". */
  readonly time: string;
  /** Under it: "Metro Egg · ready at 4:04 PM", "Ready since …", or ''. */
  readonly detail: string;
  /** "Your egg is resting.", or ''. */
  readonly caption: string;
  /** The action button's label. */
  readonly action: string;
  /** The notification status row, or null when notifications are on. */
  readonly notify: { readonly label: string; readonly action: string | null } | null;
}

export interface IncubatingScreenOptions {
  /** The incubating egg, standing large in the middle of the glass. null source: the Coming Soon badge. */
  readonly egg: { readonly source: ScreenModelSource | null; readonly glow?: string };
  readonly comingSoon: string;
  readonly view: () => IncubatingView;
  /** 0..1, the egg's glow warmth, read every frame. The scene adds a held trackpad on top. */
  readonly warmth: () => number;
  /** "Keep it warm" presses so far, read every frame: each new one wobbles the egg (DeviceScreen.nudge). */
  readonly nudge?: () => number;
  /** Calls `onChange` whenever `view` changes. Returns the unsubscribe. */
  readonly subscribe: (onChange: () => void) => () => void;
  readonly onAction: () => void;
  /** A tap on the egg itself. */
  readonly onEgg?: () => void;
  readonly onNotify: () => void;
}

const { width: W, height: H } = HUD_SIZE;
const PAD = 40;
/** Where the egg stands: centred, the largest thing on the glass. */
export const INCUBATING_EGG_RECT: ScreenRect = { x: 124, y: 196, width: 520, height: 400 };
/** The notification row's action button, top right under the status row. */
export const INCUBATING_NOTIFY_RECT: ScreenRect = { x: W - PAD - 250, y: 116, width: 250, height: 64 };
/** The main action, along the bottom edge. */
export const INCUBATING_ACTION_RECT: ScreenRect = { x: PAD, y: 852, width: W - PAD * 2, height: 124 };
const TIME_Y = 660;
const RING_R = 30;

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

/**
 * M11 Incubating on the H-Lynk's glass: the status row with the incubation
 * progress as its rule, the egg as its 3D model large and glowing in the
 * middle, the timer ring and time line, the ready-at line, and "Keep it
 * warm" (or, once ready, "Hatch your egg") as a glass button. The trackpad
 * and the keys are the app's (DeviceStage `onKey`). Every colour is a `hud` token.
 */
export function createIncubatingScreen(options: IncubatingScreenOptions): DeviceScreen {
  const models: ScreenModel[] = [{
    target: INCUBATING_EGG_TARGET, rect: INCUBATING_EGG_RECT, source: options.egg.source,
    ...(options.egg.glow ? { glow: options.egg.glow } : {}),
  }];
  const buttons = (): ScreenButton[] => {
    const view = options.view();
    const list: ScreenButton[] = [
      { target: INCUBATING_ACTION_TARGET, label: view.action, tone: 'primary', rect: INCUBATING_ACTION_RECT },
    ];
    if (view.notify?.action) {
      list.push({ target: INCUBATING_NOTIFY_TARGET, label: view.notify.action, tone: 'secondary', rect: INCUBATING_NOTIFY_RECT });
    }
    return list;
  };

  return {
    size: HUD_SIZE,
    models,
    selected: () => INCUBATING_EGG_TARGET,
    warmth: options.warmth,
    ...(options.nudge ? { nudge: options.nudge } : {}),
    subscribe: options.subscribe,
    hitTest: (u, v) => {
      const { x, y } = uvToScreenPx(u, v, HUD_SIZE);
      return buttonAt(buttons(), x, y)?.target ?? null;
    },
    select: (target) => {
      if (target === INCUBATING_EGG_TARGET) {
        options.onEgg?.();
        return;
      }
      if (!buttons().some((b) => b.target === target)) return;
      if (target === INCUBATING_ACTION_TARGET) options.onAction();
      else if (target === INCUBATING_NOTIFY_TARGET) options.onNotify();
    },
    draw: (ctx, font, hover) => {
      const view = options.view();
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, hud.bg1);
      bg.addColorStop(0.4, hud.bg0);
      bg.addColorStop(1, hud.bg0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Status row; its rule fills with the incubation progress.
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = view.ready ? hud.green : hud.dim;
      ctx.font = font(30, 600);
      ctx.fillText(view.status, PAD, 56);
      ctx.fillStyle = hud.dim;
      for (let i = 0; i < 4; i++) {
        const h = 10 + i * 7;
        ctx.fillRect(W - 112 + i * 16, 70 - h, 10, h);
      }
      const progress = view.ready ? 1 : Math.min(1, Math.max(0, view.progress));
      ctx.fillStyle = hud.line;
      ctx.fillRect(PAD, 100, W - PAD * 2, 3);
      ctx.fillStyle = view.ready ? hud.green : hud.red;
      ctx.fillRect(PAD, 100, (W - PAD * 2) * progress, 3);

      // Notifications off: the reason, and its action when there is one.
      if (view.notify) {
        ctx.fillStyle = hud.amber;
        ctx.font = font(26, 600);
        const width = view.notify.action ? INCUBATING_NOTIFY_RECT.x - PAD - 20 : W - PAD * 2;
        wrap(ctx, view.notify.label, width).slice(0, 2).forEach((line, j, all) => {
          ctx.fillText(line, PAD, INCUBATING_NOTIFY_RECT.y + INCUBATING_NOTIFY_RECT.height / 2 + (j - (all.length - 1) / 2) * 30);
        });
      }

      if (options.egg.source === null) {
        // No model for this egg yet: the kit's Coming Soon badge where it would stand.
        const r = INCUBATING_EGG_RECT;
        const cy = r.y + r.height / 2;
        roundRect(ctx, r.x + 80, cy - 30, r.width - 160, 60, 12);
        ctx.fillStyle = hud.amber;
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.fillStyle = hud.bg0;
        ctx.font = font(28, 700);
        ctx.fillText(options.comingSoon, r.x + r.width / 2, cy);
      }

      // The timer: the ring (while counting) beside the time line, centred as a pair.
      ctx.font = font(60, 700);
      const timeWidth = ctx.measureText(view.time).width;
      const ringSpace = view.ready ? 0 : RING_R * 2 + 24;
      const left = W / 2 - (timeWidth + ringSpace) / 2;
      if (!view.ready) {
        const cx = left + RING_R;
        ctx.lineCap = 'round';
        ctx.lineWidth = 8;
        ctx.strokeStyle = hud.line;
        strokeArc(ctx, cx, TIME_Y, RING_R, 1);
        if (progress > 0) {
          ctx.strokeStyle = hud.red;
          strokeArc(ctx, cx, TIME_Y, RING_R, progress);
        }
        ctx.lineCap = 'butt';
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = view.ready ? hud.green : hud.text;
      ctx.fillText(view.time, left + ringSpace, TIME_Y);

      ctx.textAlign = 'center';
      if (view.detail !== '') {
        ctx.fillStyle = hud.dim;
        ctx.font = font(32, 600);
        ctx.fillText(wrap(ctx, view.detail, W - PAD * 2)[0] ?? '', W / 2, 734);
      }
      if (view.caption !== '') {
        ctx.fillStyle = hud.dim;
        ctx.font = font(28, 500);
        ctx.fillText(wrap(ctx, view.caption, W - PAD * 2)[0] ?? '', W / 2, 786);
      }

      for (const button of buttons()) drawButton(ctx, font, button, hover);
    },
  };
}
