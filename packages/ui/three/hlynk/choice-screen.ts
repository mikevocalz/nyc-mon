import { hud } from '@acme/theme';
import { roundRect, wrap } from './hud-draw.ts';
import { HUD_SIZE } from './hud.ts';
import { buttonAt, drawButton, type ScreenButton, type ScreenRect } from './screen-actions.ts';
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
  /** Glow tint behind the model while it is focused; a theme token. Default by slot. */
  readonly glow?: string;
}

/** A button on the panel under the slots. */
export interface ChoiceAction {
  /** The hit target; `onAction` receives it. */
  readonly target: string;
  readonly label: string;
  readonly tone: 'primary' | 'secondary';
}

/**
 * The panel under the slots, read on every repaint: what the focused choice
 * is and what can be done with it (M08: the egg's card and its Choose /
 * confirm buttons). Without a panel the screen draws the focused detail or the hint.
 */
export interface ChoicePanel {
  /** Large line, e.g. the egg's name or the confirm question. */
  readonly heading?: string;
  /** Small line under it, e.g. "#001 · Bloodline". */
  readonly meta?: string;
  /** Up to three wrapped lines. */
  readonly body?: string;
  /** Up to two buttons, side by side. */
  readonly actions: readonly ChoiceAction[];
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
  /** The panel under the slots, read on every repaint. `subscribe` must fire when it changes. */
  readonly panel?: () => ChoicePanel;
  /** A tap on a panel button. */
  readonly onAction?: (target: string) => void;
}

const { width: W, height: H } = HUD_SIZE;
const PAD = 40;
const GAP = 20;
/** The slot row, canvas px. */
// Under the heading, leaving the lower 40% of the glass to the panel (the
// focused egg's card, its buttons, the hint); slots are about as tall as
// they are wide plus the label, not long columns.
export const CHOICE_ROW = { y: 226, height: 344 } as const;
/** The panel's text starts here; its buttons sit on the ACTION_ROW. */
const PANEL_Y = 616;
/** The panel's button row, canvas px. */
export const ACTION_ROW = { y: 846, height: 128 } as const;
/** Label strip at the bottom of each slot. */
const LABEL_H = 84;

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

/** Canvas rect of panel button `i` of `count` (one or two, side by side). */
export function choiceActionRect(i: number, count: number): ScreenRect {
  const n = Math.max(1, Math.min(2, count));
  const width = (W - PAD * 2 - GAP * (n - 1)) / n;
  return { x: PAD + i * (width + GAP), y: ACTION_ROW.y, width, height: ACTION_ROW.height };
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
  const models: ScreenModel[] = items.map((item, i) => ({
    target: item.target, rect: choiceModelRect(i, count), source: item.source, ...(item.glow ? { glow: item.glow } : {}),
  }));
  const buttons = (): ScreenButton[] => {
    const actions = options.panel?.().actions.slice(0, 2) ?? [];
    return actions.map((a, i) => ({ target: a.target, label: a.label, tone: a.tone, rect: choiceActionRect(i, actions.length) }));
  };

  return {
    size: HUD_SIZE,
    models,
    hitTest: (u, v) => {
      const { x, y } = uvToScreenPx(u, v, HUD_SIZE);
      const button = buttonAt(buttons(), x, y);
      if (button) return button.target;
      const i = choiceSlotAt(u, v, count);
      return i === null ? null : (items[i]?.target ?? null);
    },
    select: (target) => {
      if (buttons().some((b) => b.target === target)) {
        options.onAction?.(target);
        return;
      }
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

      const panel = options.panel?.();
      if (panel) {
        drawPanel(ctx, font, panel);
        for (const button of buttons()) drawButton(ctx, font, button, hover);
        return;
      }

      // Foot: the focused choice's name and detail, or the hint while browsing.
      const chosen = focused === null ? undefined : items[focused];
      if (chosen) {
        ctx.textAlign = 'center';
        ctx.fillStyle = hud.text;
        ctx.font = font(48, 700);
        ctx.fillText(chosen.label, W / 2, PANEL_Y + 40);
        ctx.fillStyle = hud.dim;
        ctx.font = font(32, 500);
        wrap(ctx, chosen.detail, W - PAD * 2).slice(0, 2).forEach((line, j) => ctx.fillText(line, W / 2, PANEL_Y + 104 + j * 44));
      } else {
        ctx.textAlign = 'center';
        ctx.fillStyle = hud.dim;
        ctx.font = font(34, 500);
        wrap(ctx, options.hint, W - PAD * 2).slice(0, 3).forEach((line, j) => ctx.fillText(line, W / 2, PANEL_Y + 44 + j * 46));
      }
    },
  };
}

/** The panel's text block, centred above the button row. */
function drawPanel(ctx: Parameters<DeviceScreen['draw']>[0], font: Parameters<DeviceScreen['draw']>[1], panel: ChoicePanel) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let y = PANEL_Y + 30;
  if (panel.heading) {
    ctx.fillStyle = hud.text;
    ctx.font = font(50, 700);
    const lines = wrap(ctx, panel.heading, W - PAD * 2).slice(0, 2);
    lines.forEach((line, j) => ctx.fillText(line, W / 2, y + j * 56));
    y += lines.length * 56 + 6;
  }
  if (panel.meta) {
    ctx.fillStyle = hud.dim;
    ctx.font = font(34, 600);
    ctx.fillText(panel.meta, W / 2, y);
    y += 50;
  }
  if (panel.body) {
    ctx.fillStyle = hud.text;
    ctx.font = font(32, 500);
    // Lines that would run into the button row are dropped, never drawn over it.
    const room = Math.max(1, Math.floor((ACTION_ROW.y - 16 - y + 20) / 42));
    wrap(ctx, panel.body, W - PAD * 2).slice(0, Math.min(3, room)).forEach((line, j) => ctx.fillText(line, W / 2, y + j * 42));
  }
}
