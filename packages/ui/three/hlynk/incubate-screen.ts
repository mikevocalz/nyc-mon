import { hud } from '@acme/theme';
import { roundRect, wrap } from './hud-draw.ts';
import { HUD_SIZE } from './hud.ts';
import { buttonAt, drawButton, type ScreenButton, type ScreenRect } from './screen-actions.ts';
import { uvToScreenPx, type DeviceScreen, type ScreenModel, type ScreenModelSource } from './screen.ts';

/** The egg's hit target. A tap on it does nothing; it is there so the scene stands and lights the model. */
export const INCUBATE_EGG_TARGET = 'egg';
/** The Start button's target. */
export const INCUBATE_START_TARGET = 'start';
/** Option `i`'s target. */
export const incubateOptionTarget = (i: number): string => `option:${i}`;

export interface IncubateScreenOptions {
  /** Heading, e.g. "How long should the egg incubate?". */
  readonly title: string;
  /** Under the heading. */
  readonly body: string;
  /** Status row text, read on every repaint: the egg's name, or the incubating chip once started. */
  readonly status: () => string;
  /** The chosen egg, standing large in the middle of the glass. null source: the Coming Soon badge. */
  readonly egg: { readonly source: ScreenModelSource | null; readonly glow?: string };
  readonly comingSoon: string;
  /** The incubation times, shortest first (three). */
  readonly options: readonly string[];
  /** Index of the chosen time, or null. */
  readonly selected: () => number | null;
  /** "Ready at …", or '' while no time is chosen. */
  readonly ready: () => string;
  /** The Start button's label and state. */
  readonly start: () => { readonly label: string; readonly disabled: boolean };
  /** True while starting or started: the options stop answering. */
  readonly busy: () => boolean;
  /** Shown above Start when the start failed. */
  readonly error: () => { readonly title: string; readonly body: string } | null;
  /** 0..1, the egg's glow warmth (up once incubating). */
  readonly warmth: () => number;
  /** Calls `onChange` whenever anything above changes. Returns the unsubscribe. */
  readonly subscribe: (onChange: () => void) => () => void;
  readonly onOption: (index: number) => void;
  readonly onStart: () => void;
}

const { width: W, height: H } = HUD_SIZE;
const PAD = 40;
const GAP = 20;
/** Where the egg stands: centred, the largest thing on the glass. */
export const INCUBATE_EGG_RECT: ScreenRect = { x: 164, y: 318, width: 440, height: 306 };
const OPTION_ROW = { y: 646, height: 104 } as const;
const START_ROW = { y: 852, height: 124 } as const;

/** Canvas rect of option `i` of `count`. */
export function incubateOptionRect(i: number, count: number): ScreenRect {
  const n = Math.max(1, count);
  const width = (W - PAD * 2 - GAP * (n - 1)) / n;
  return { x: PAD + i * (width + GAP), y: OPTION_ROW.y, width, height: OPTION_ROW.height };
}

/**
 * M10 on the H-Lynk's glass: the chosen egg as its 3D model, large and
 * glowing in the middle, the incubation times as buttons under it, the
 * ready-at line and Start. `<`/`>` and the trackpad are the app's (DeviceStage
 * `onKey`). Every colour is a `hud` token.
 */
export function createIncubateScreen(options: IncubateScreenOptions): DeviceScreen {
  const count = options.options.length;
  const models: ScreenModel[] = [{
    target: INCUBATE_EGG_TARGET, rect: INCUBATE_EGG_RECT, source: options.egg.source,
    ...(options.egg.glow ? { glow: options.egg.glow } : {}),
  }];
  const buttons = (): ScreenButton[] => {
    const busy = options.busy();
    const selected = options.selected();
    const start = options.start();
    return [
      ...options.options.map((label, i): ScreenButton => ({
        target: incubateOptionTarget(i), label, rect: incubateOptionRect(i, count),
        tone: i === selected ? 'selected' : 'secondary', disabled: busy && i !== selected,
      })),
      {
        target: INCUBATE_START_TARGET, label: start.label, tone: 'primary', disabled: start.disabled,
        rect: { x: PAD, y: START_ROW.y, width: W - PAD * 2, height: START_ROW.height },
      },
    ];
  };

  return {
    size: HUD_SIZE,
    models,
    selected: () => INCUBATE_EGG_TARGET,
    warmth: options.warmth,
    subscribe: options.subscribe,
    hitTest: (u, v) => {
      const { x, y } = uvToScreenPx(u, v, HUD_SIZE);
      return buttonAt(buttons(), x, y)?.target ?? null;
    },
    select: (target) => {
      const button = buttons().find((b) => b.target === target);
      if (!button || button.disabled) return;
      if (target === INCUBATE_START_TARGET) options.onStart();
      else if (!options.busy()) options.onOption(options.options.findIndex((_, i) => incubateOptionTarget(i) === target));
    },
    draw: (ctx, font, hover) => {
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, hud.bg1);
      bg.addColorStop(0.4, hud.bg0);
      bg.addColorStop(1, hud.bg0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Status row, as on the egg choice.
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = hud.dim;
      ctx.font = font(30, 600);
      ctx.fillText(options.status(), PAD, 56);
      for (let i = 0; i < 4; i++) {
        const h = 10 + i * 7;
        ctx.fillRect(W - 112 + i * 16, 70 - h, 10, h);
      }
      ctx.fillStyle = hud.line;
      ctx.fillRect(PAD, 100, W - PAD * 2, 3);

      // Heading and body.
      ctx.fillStyle = hud.red;
      ctx.fillRect(PAD, 126, 72, 6);
      ctx.fillStyle = hud.text;
      ctx.font = font(46, 700);
      const title = wrap(ctx, options.title, W - PAD * 2).slice(0, 2);
      title.forEach((line, j) => ctx.fillText(line, PAD, 172 + j * 52));
      ctx.fillStyle = hud.dim;
      ctx.font = font(28, 500);
      const bodyTop = 172 + title.length * 52 + 4;
      wrap(ctx, options.body, W - PAD * 2).slice(0, 2).forEach((line, j) => ctx.fillText(line, PAD, bodyTop + j * 36));

      if (options.egg.source === null) {
        // No model for this egg yet: the kit's Coming Soon badge where it would stand.
        const r = INCUBATE_EGG_RECT;
        const cy = r.y + r.height / 2;
        roundRect(ctx, r.x + 60, cy - 30, r.width - 120, 60, 12);
        ctx.fillStyle = hud.amber;
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.fillStyle = hud.bg0;
        ctx.font = font(28, 700);
        ctx.fillText(options.comingSoon, r.x + r.width / 2, cy);
      }

      // Ready-at, or the error, between the times and Start.
      ctx.textAlign = 'center';
      const error = options.error();
      if (error) {
        ctx.fillStyle = hud.amber;
        ctx.font = font(34, 700);
        ctx.fillText(error.title, W / 2, 784);
        ctx.fillStyle = hud.text;
        ctx.font = font(26, 500);
        ctx.fillText(wrap(ctx, error.body, W - PAD * 2)[0] ?? '', W / 2, 824);
      } else {
        const ready = options.ready();
        if (ready !== '') {
          ctx.fillStyle = hud.text;
          ctx.font = font(40, 700);
          ctx.fillText(ready, W / 2, 800);
        }
      }

      for (const button of buttons()) drawButton(ctx, font, button, hover);
    },
  };
}
