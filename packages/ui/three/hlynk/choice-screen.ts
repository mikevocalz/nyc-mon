import { hud } from '@acme/theme';
import { roundRect, wrap } from './hud-draw.ts';
import { HUD_SIZE } from './hud.ts';
import { uvToScreenPx, type DeviceScreen, type ScreenModel, type ScreenModelSource } from './screen.ts';

/** One choice on the screen: a slot with a model standing in it and a label under it. */
export interface ChoiceItem {
  /** Stable id; also the hit target. */
  readonly target: string;
  /** Under the slot, e.g. the egg's name. */
  readonly label: string;
  /** Shown at the foot of the screen while this choice is focused, e.g. the Bloodline. */
  readonly detail: string;
  /** The model standing in the slot; null draws the "Coming Soon" badge. */
  readonly source: ScreenModelSource | null;
}

export interface ChoiceScreenOptions {
  /** Status row and heading, e.g. "Choose an egg". */
  readonly title: string;
  /** Foot line while nothing is focused. */
  readonly hint: string;
  /** The badge for a slot with no model (the kit's "Coming Soon" convention). */
  readonly comingSoon: string;
  readonly items: readonly ChoiceItem[];
  /** The focused index, or null while browsing. Read on every repaint. */
  readonly focused: () => number | null;
  /** Calls `onChange` when the focus changes. Returns the unsubscribe. */
  readonly subscribe: (onChange: () => void) => () => void;
  /** A tap on slot `index`. */
  readonly onSelect: (index: number) => void;
}

const { width: W, height: H } = HUD_SIZE;
const PAD = 40;
const GAP = 20;
/** The slot row, canvas px. */
export const CHOICE_ROW = { y: 236, height: 540 } as const;
/** Label strip at the bottom of each slot. */
const LABEL_H = 104;

/** Canvas rect of slot `i` of `count`. */
export function choiceSlotRect(i: number, count: number): { x: number; y: number; width: number; height: number } {
  const n = Math.max(1, count);
  const width = (W - PAD * 2 - GAP * (n - 1)) / n;
  return { x: PAD + i * (width + GAP), y: CHOICE_ROW.y, width, height: CHOICE_ROW.height };
}

/** Where a slot's model stands: the slot above its label strip. */
export function choiceModelRect(i: number, count: number): { x: number; y: number; width: number; height: number } {
  const r = choiceSlotRect(i, count);
  return { x: r.x, y: r.y, width: r.width, height: r.height - LABEL_H };
}

/** Screen UV (v bottom-up) to the slot under it, or null. */
export function choiceSlotAt(u: number, v: number, count: number): number | null {
  const { x, y } = uvToScreenPx(u, v, HUD_SIZE);
  for (let i = 0; i < count; i++) {
    const r = choiceSlotRect(i, count);
    if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) return i;
  }
  return null;
}

/**
 * A choice of two to four things on the H-Lynk's glass, each standing as a
 * 3D model in its slot (M08's three eggs). The screen draws the slots, the
 * labels, the focus and hover state, and "Coming Soon" where a model is
 * missing; the scene stands the models in front of the glass. Every colour
 * is a `hud` token.
 */
export function createChoiceScreen(options: ChoiceScreenOptions): DeviceScreen {
  const { items } = options;
  const count = items.length;
  const models: ScreenModel[] = items.map((item, i) => ({ target: item.target, rect: choiceModelRect(i, count), source: item.source }));

  return {
    size: HUD_SIZE,
    models,
    hitTest: (u, v) => {
      const i = choiceSlotAt(u, v, count);
      return i === null ? null : (items[i]?.target ?? null);
    },
    select: (target) => {
      const i = items.findIndex((item) => item.target === target);
      if (i >= 0) options.onSelect(i);
    },
    subscribe: options.subscribe,
    selected: () => {
      const i = options.focused();
      return i === null ? null : (items[i]?.target ?? null);
    },
    draw: (ctx, font, hover) => {
      const focused = options.focused();
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, hud.bg1);
      bg.addColorStop(0.4, hud.bg0);
      bg.addColorStop(1, hud.bg0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Status row: the title and signal bars, as on the HUD.
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = hud.dim;
      ctx.font = font(30, 600);
      ctx.fillText(options.title, PAD, 56);
      for (let i = 0; i < 4; i++) {
        const h = 10 + i * 7;
        ctx.fillRect(W - 112 + i * 16, 70 - h, 10, h);
      }
      ctx.fillStyle = hud.line;
      ctx.fillRect(PAD, 100, W - PAD * 2, 3);

      // Heading: the scanner's red rule, then the title.
      ctx.fillStyle = hud.red;
      ctx.fillRect(PAD, 132, 72, 6);
      ctx.fillStyle = hud.text;
      ctx.font = font(56, 700);
      ctx.fillText(options.title, PAD, 188);

      items.forEach((item, i) => {
        const r = choiceSlotRect(i, count);
        const on = i === focused;
        const lit = item.target === hover;
        roundRect(ctx, r.x, r.y, r.width, r.height, 20);
        ctx.fillStyle = hud.panel;
        ctx.fill();
        ctx.strokeStyle = on ? hud.red : lit ? hud.text : hud.line;
        ctx.lineWidth = on ? 6 : lit ? 4 : 2;
        ctx.stroke();

        // Label strip: red under the focused choice.
        const strip = r.y + r.height - LABEL_H;
        roundRect(ctx, r.x + 8, strip, r.width - 16, LABEL_H - 8, 14);
        ctx.fillStyle = on ? hud.red : hud.bg0;
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.fillStyle = on || lit ? hud.text : hud.dim;
        ctx.font = font(30, 700);
        const lines = wrap(ctx, item.label, r.width - 28).slice(0, 2);
        const lineH = 34;
        const top = strip + (LABEL_H - 8) / 2 - ((lines.length - 1) * lineH) / 2;
        lines.forEach((line, j) => ctx.fillText(line, r.x + r.width / 2, top + j * lineH));

        if (item.source === null) {
          // No model yet: the kit's Coming Soon badge, centred where the model would stand.
          const badgeW = r.width - 32;
          const badgeH = 56;
          const cy = r.y + (r.height - LABEL_H) / 2;
          roundRect(ctx, r.x + 16, cy - badgeH / 2, badgeW, badgeH, 12);
          ctx.fillStyle = hud.amber;
          ctx.fill();
          ctx.fillStyle = hud.bg0;
          ctx.font = font(26, 700);
          ctx.fillText(options.comingSoon, r.x + r.width / 2, cy);
        }
      });

      // Foot: the focused choice's name and detail, or the hint while browsing.
      const chosen = focused === null ? undefined : items[focused];
      if (chosen) {
        ctx.textAlign = 'center';
        ctx.fillStyle = hud.text;
        ctx.font = font(48, 700);
        ctx.fillText(chosen.label, W / 2, 846);
        ctx.fillStyle = hud.dim;
        ctx.font = font(32, 500);
        wrap(ctx, chosen.detail, W - PAD * 2).slice(0, 2).forEach((line, j) => ctx.fillText(line, W / 2, 910 + j * 44));
      } else {
        ctx.textAlign = 'center';
        ctx.fillStyle = hud.dim;
        ctx.font = font(34, 500);
        wrap(ctx, options.hint, W - PAD * 2).slice(0, 3).forEach((line, j) => ctx.fillText(line, W / 2, 850 + j * 46));
      }
    },
  };
}
