import { hud } from '@acme/theme';
import { HUD_SIZE, HUD_TABS, hudTabRect, type HudContent, type HudHover, type HudTab } from './hlynk-hud.ts';

/** Canvas font string for a size and weight, in the page's body face. */
export type HudFont = (size: number, weight?: number) => string;

const { width: W, height: H } = HUD_SIZE;
const PAD = 40;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Greedy word wrap to `maxWidth`; returns the lines. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** A tab's heading: the scanner's red rule, then the label. */
function heading(ctx: CanvasRenderingContext2D, font: HudFont, label: string) {
  ctx.fillStyle = hud.red;
  ctx.fillRect(PAD, 132, 72, 6);
  ctx.textAlign = 'left';
  ctx.fillStyle = hud.text;
  ctx.font = font(60, 700);
  ctx.fillText(label, PAD, 192);
}

/** Exhaustive over HudTab: a new tab fails the typecheck until it has a screen. */
function drawTab(ctx: CanvasRenderingContext2D, font: HudFont, tab: HudTab, c: HudContent) {
  switch (tab) {
    case 'crew': {
      // The resting face (PS-019's static screen): the Mon's name with the line under it.
      const y = H * 0.42;
      ctx.textAlign = 'center';
      ctx.fillStyle = hud.red;
      ctx.fillRect(W / 2 - 36, y - 104, 72, 6);
      ctx.fillStyle = hud.text;
      ctx.font = font(96, 700);
      ctx.fillText(c.mon, W / 2, y);
      ctx.fillStyle = hud.dim;
      ctx.font = font(36, 500);
      ctx.fillText(c.note, W / 2, y + 84);
      return;
    }
    case 'dex': {
      heading(ctx, font, c.tabs.dex);
      c.dex.forEach((entry, i) => {
        const y = 250 + i * 148;
        roundRect(ctx, PAD, y, W - PAD * 2, 124, 18);
        ctx.fillStyle = hud.panel;
        ctx.fill();
        ctx.strokeStyle = hud.line;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.textAlign = 'left';
        ctx.fillStyle = hud.dim;
        ctx.font = font(32, 600);
        ctx.fillText(entry.no, PAD + 32, y + 62);
        ctx.fillStyle = hud.text;
        ctx.font = font(52, 700);
        ctx.fillText(entry.name, PAD + 200, y + 62);
      });
      return;
    }
    case 'care': {
      heading(ctx, font, c.tabs.care);
      c.care.meters.forEach((meter, i) => {
        const y = 270 + i * 150;
        ctx.textAlign = 'left';
        ctx.fillStyle = hud.text;
        ctx.font = font(40, 700);
        ctx.fillText(meter.name, PAD, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = hud.dim;
        ctx.font = font(34, 600);
        ctx.fillText(String(meter.value), W - PAD, y);
        roundRect(ctx, PAD, y + 36, W - PAD * 2, 22, 11);
        ctx.fillStyle = hud.line;
        ctx.fill();
        roundRect(ctx, PAD, y + 36, Math.max(22, ((W - PAD * 2) * meter.value) / 100), 22, 11);
        ctx.fillStyle = hud[meter.tone];
        ctx.fill();
      });
      ctx.textAlign = 'left';
      ctx.fillStyle = hud.dim;
      ctx.font = font(32, 500);
      wrap(ctx, c.care.note, W - PAD * 2).forEach((line, i) => ctx.fillText(line, PAD, 760 + i * 44));
      return;
    }
    case 'bag': {
      heading(ctx, font, c.tabs.bag);
      ctx.textAlign = 'center';
      ctx.fillStyle = hud.dim;
      ctx.font = font(38, 500);
      wrap(ctx, c.bag, W - PAD * 2).forEach((line, i) => ctx.fillText(line, W / 2, 520 + i * 52));
      return;
    }
    case 'city': {
      heading(ctx, font, c.tabs.city);
      c.city.districts.forEach((name, i) => {
        const y = 290 + i * 100;
        ctx.fillStyle = hud.red;
        ctx.fillRect(PAD, y - 9, 18, 18);
        ctx.textAlign = 'left';
        ctx.fillStyle = hud.text;
        ctx.font = font(50, 700);
        ctx.fillText(name, PAD + 44, y);
      });
      ctx.fillStyle = hud.dim;
      ctx.font = font(32, 500);
      wrap(ctx, c.city.line, W - PAD * 2).forEach((line, i) => ctx.fillText(line, PAD, 726 + i * 44));
      return;
    }
  }
}

/**
 * The H-Lynk screen: status row, the active tab's screen, and the tab bar.
 * `hover` lights the tab under the pointer. Every colour is a `hud` token.
 * Called only when the tab, the hover target or the fonts change.
 */
export function drawHud(
  ctx: CanvasRenderingContext2D,
  font: HudFont,
  content: HudContent,
  tab: HudTab,
  hover: HudHover | null,
): void {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, hud.bg1);
  bg.addColorStop(0.4, hud.bg0);
  bg.addColorStop(1, hud.bg0);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Status row: the tier name and signal bars.
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = hud.dim;
  ctx.font = font(30, 600);
  ctx.fillText(content.title, PAD, 56);
  for (let i = 0; i < 4; i++) {
    const h = 10 + i * 7;
    ctx.fillRect(W - 112 + i * 16, 70 - h, 10, h);
  }
  ctx.fillStyle = hud.line;
  ctx.fillRect(PAD, 100, W - PAD * 2, 3);

  drawTab(ctx, font, tab, content);

  // Tab bar.
  HUD_TABS.forEach((id, i) => {
    const r = hudTabRect(i);
    const on = id === tab;
    const lit = id === hover;
    roundRect(ctx, r.x + 6, r.y, r.width - 12, r.height, 16);
    ctx.fillStyle = on ? hud.red : hud.panel;
    ctx.fill();
    if (!on || lit) {
      ctx.strokeStyle = lit ? hud.text : hud.line;
      ctx.lineWidth = lit ? 4 : 2;
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = on || lit ? hud.text : hud.dim;
    ctx.font = font(32, 700);
    ctx.fillText(content.tabs[id], r.x + r.width / 2, r.y + r.height / 2);
  });
}
