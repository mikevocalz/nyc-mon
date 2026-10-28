// Decisions H-1 to H-3 (docs/design/hlynk/ADAPTIVE.md): device sizing,
// brand-left / device-right placement on wide and folded windows, and
// content that fits the H-Lynk screen without scrolling. Viewports are unit
// fixtures in dp, not device evidence.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { foldLayoutsFromRegions } from '../adaptive-panes/fold-layout.ts';
import type { ReservedRegion } from '../reserved-regions.types.ts';
import { fitHLynkContent, type FitBlock } from './content-fit.ts';
import {
  HLYNK_BRAND_MIN_PT,
  HLYNK_GEOMETRY,
  HLYNK_STAGE_SHELL_MAX_PT,
  HLYNK_TWO_PANE_MIN_PT,
  STANDARD_ROW_NEED_PT,
  hlynkUsableRegions,
  measureShell,
  planHLynkPlacement,
  planHLynkStageSplit,
  type HLynkFold,
  type HLynkPlacement,
  type HLynkRect,
} from './layout.ts';

const G = HLYNK_GEOMETRY;

const vfold = (x: number, width: number, height: number, extra: Partial<HLynkFold> = {}): HLynkFold => ({
  orientation: 'vertical', separating: true, occlusionType: width > 0 ? 'full' : 'none', x, y: 0, width, height, ...extra,
});
const hfold = (y: number, height: number, width: number): HLynkFold => ({
  orientation: 'horizontal', separating: true, occlusionType: height > 0 ? 'full' : 'none', x: 0, y, width, height,
});

function overlaps(a: HLynkRect, b: HLynkRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
function inside(inner: HLynkRect, outer: HLynkRect): boolean {
  return inner.x >= outer.x - 1e-6 && inner.y >= outer.y - 1e-6
    && inner.x + inner.width <= outer.x + outer.width + 1e-6 && inner.y + inner.height <= outer.y + outer.height + 1e-6;
}
/** The body's rect, centred in the device region as HLynkShell draws it. */
function bodyRect(p: HLynkPlacement): HLynkRect {
  const geo = measureShell({ widthPt: p.device.width, heightPt: p.device.height, safeTopPt: 0, safeBottomPt: 0 });
  const centred = p.arrangement !== 'single' || p.device.width >= G.mediumWidthPt;
  return {
    x: p.device.x + (p.device.width - geo.bodyWidthPt) / 2,
    y: centred ? p.device.y + (p.device.height - geo.bodyHeightPt) / 2 : p.device.y,
    width: geo.bodyWidthPt,
    height: geo.bodyHeightPt,
  };
}

// Surface Duo, one panel 540 × 720 dp; the shell's host loses a 24 dp status bar.
const DUO_PANEL = { w: 540, h: 696 };
const DUO_HINGE = 34;

// ---- H-1: device sizing ----------------------------------------------------

test('phones up to 440 pt wide lay out exactly as before', () => {
  const se = measureShell({ widthPt: 375, heightPt: 667, safeTopPt: 20, safeBottomPt: 0 });
  assert.deepEqual([se.layout, se.bodyWidthPt, se.screenHeightPt, se.rowPt], ['standard', 375, 468, 139]);
  // A short 360 × 640 Android stays compact, as today: the height fit only applies wider than a phone.
  const short = measureShell({ widthPt: 360, heightPt: 640, safeTopPt: 24, safeBottomPt: 48 });
  assert.equal(short.layout, 'compact');
  assert.equal(short.bodyWidthPt, 360);
});

test('phone landscape goes compact across the full width, with no brand pane', () => {
  const g = measureShell({ widthPt: 844, heightPt: 390, safeTopPt: 0, safeBottomPt: 21 });
  assert.equal(g.layout, 'compact');
  assert.equal(g.bodyWidthPt, 844);
  assert.equal(g.screenWidthPt, 844);
  const p = planHLynkPlacement({ widthPt: 844, heightPt: 369, folds: [] });
  assert.equal(p.arrangement, 'single');
  assert.equal(p.brand, null);
});

test('a Duo panel fits the body to its height instead of going compact', () => {
  const g = measureShell({ widthPt: DUO_PANEL.w, heightPt: DUO_PANEL.h, safeTopPt: 0, safeBottomPt: 0 });
  assert.equal(g.layout, 'standard');
  assert.equal(g.bodyWidthPt, 414);
  assert.ok(g.rowPt >= STANDARD_ROW_NEED_PT);
  assert.ok(g.bodyHeightPt <= DUO_PANEL.h);
  assert.equal(g.trackpadPt, G.trackpadPt, 'the trackpad keeps its size (HIG: consistent control sizes)');
});

test('tablet landscape keeps 440; the grown body never passes 600', () => {
  const land = measureShell({ widthPt: 1194, heightPt: 834, safeTopPt: 24, safeBottomPt: 20 });
  assert.equal(land.bodyWidthPt, 440);
  const huge = measureShell({ widthPt: 2560, heightPt: 1400, safeTopPt: 0, safeBottomPt: 0 });
  assert.equal(huge.bodyWidthPt, G.maxGrownWidthPt);
});

// ---- H-2: placement ----------------------------------------------------------

test('phone portrait: the device alone fills the host (no brand pane)', () => {
  const p = planHLynkPlacement({ widthPt: 390, heightPt: 800, folds: [] });
  assert.equal(p.arrangement, 'single');
  assert.equal(p.brand, null);
  assert.deepEqual(p.device, { x: 0, y: 0, width: 390, height: 800 });
});

test('Duo cover / single panel, no fold: the device alone', () => {
  const p = planHLynkPlacement({ widthPt: DUO_PANEL.w, heightPt: DUO_PANEL.h, folds: [] });
  assert.equal(p.arrangement, 'single');
  assert.equal(p.brand, null);
});

test('Duo spanned, vertical occluding hinge: brand left, device right, nothing on the hinge', () => {
  const width = DUO_PANEL.w * 2 + DUO_HINGE;
  const hinge: HLynkRect = { x: DUO_PANEL.w, y: 0, width: DUO_HINGE, height: DUO_PANEL.h };
  const p = planHLynkPlacement({ widthPt: width, heightPt: DUO_PANEL.h, folds: [vfold(hinge.x, hinge.width, hinge.height)] });
  assert.equal(p.arrangement, 'book');
  assert.deepEqual(p.brand, { x: 0, y: 0, width: DUO_PANEL.w, height: DUO_PANEL.h });
  assert.deepEqual(p.device, { x: DUO_PANEL.w + DUO_HINGE, y: 0, width: DUO_PANEL.w, height: DUO_PANEL.h });
  const body = bodyRect(p);
  assert.ok(!overlaps(body, hinge), 'device body off the hinge');
  assert.ok(!overlaps(p.brand!, hinge));
  assert.ok(inside(body, p.device), 'device wholly in the right panel');
  assert.equal(measureShell({ widthPt: p.device.width, heightPt: p.device.height, safeTopPt: 0, safeBottomPt: 0 }).bodyWidthPt, 414);
});

test('zero-width separating fold still splits the host', () => {
  const p = planHLynkPlacement({ widthPt: 1000, heightPt: 700, folds: [vfold(500, 0, 700)] });
  assert.equal(p.arrangement, 'book');
  assert.equal(p.brand!.x + p.brand!.width, 500);
  assert.equal(p.device.x, 500);
});

test('flat, non-separating, non-occluding crease cuts nothing', () => {
  const crease = vfold(500, 0, 700, { separating: false, occlusionType: 'none' });
  const p = planHLynkPlacement({ widthPt: 1000, heightPt: 700, folds: [crease] });
  assert.equal(p.arrangement, 'wide');
  assert.equal(p.regions.length, 1);
  assert.equal(p.brand!.width + p.device.width, 1000, 'no dead strip');
});

test('tabletop: brand above the fold, device below, nothing on the fold', () => {
  const fold: HLynkRect = { x: 0, y: 540, width: 1114, height: 34 };
  const p = planHLynkPlacement({ widthPt: 1114, heightPt: 1114, folds: [hfold(fold.y, fold.height, fold.width)] });
  assert.equal(p.arrangement, 'tabletop');
  assert.equal(p.brand!.y, 0);
  assert.equal(p.device.y, 574);
  assert.ok(!overlaps(bodyRect(p), fold));
});

test('multiple features, an off-row feature and a nonzero host origin', () => {
  // Window-space reserved regions; the host sits at (80, 24) in the window.
  const region = (x: number, width: number, extra: Partial<ReservedRegion> = {}): ReservedRegion => ({
    kind: 'division', x, y: 24, width, height: 696, margins: { top: 0, left: 0, bottom: 0, right: 0 }, active: true,
    orientation: 'vertical', state: 'flat', occlusionType: 'full', separating: true, ...extra,
  });
  const regions = [region(20, 10), region(80 + 600, 20), region(80 + 1100, 0, { occlusionType: 'none' })];
  const folds = foldLayoutsFromRegions(regions, 80).map((f) => ({ ...f, y: f.y - 24 }));
  const p = planHLynkPlacement({ widthPt: 1500, heightPt: 696, folds });
  assert.equal(p.regions.length, 3, 'two in-host folds make three regions; the off-row one is ignored');
  assert.equal(p.brand!.x, 0);
  assert.equal(p.device.x, 1100, 'device in the rightmost region');
  for (const r of p.regions) assert.ok(r.x >= 0 && r.x + r.width <= 1500);
});

test('RTL: placement is physical, and a rail on the right is never overlapped', () => {
  // planHLynkPlacement takes no locale: brand stays left, device right, like the rail (skill §2).
  const railRightPt = 80;
  const width = DUO_PANEL.w * 2 + DUO_HINGE + railRightPt;
  const p = planHLynkPlacement({ widthPt: width, heightPt: DUO_PANEL.h, folds: [vfold(DUO_PANEL.w, DUO_HINGE, DUO_PANEL.h)], railRightPt });
  assert.ok(p.device.x + p.device.width <= width - railRightPt);
  assert.ok(p.brand!.x < p.device.x);
});

test('unknown capability then a reported hinge: never stuck as a phone', () => {
  const width = DUO_PANEL.w * 2 + DUO_HINGE;
  const before = planHLynkPlacement({ widthPt: width, heightPt: DUO_PANEL.h, folds: [] });
  assert.equal(before.arrangement, 'wide', 'no hinge yet: the wide window already shows brand and device');
  const after = planHLynkPlacement({ widthPt: width, heightPt: DUO_PANEL.h, folds: [vfold(DUO_PANEL.w, DUO_HINGE, DUO_PANEL.h)] });
  assert.equal(after.arrangement, 'book');
  assert.ok(after.brand && before.brand, 'both arrangements keep the brand pane and the device');
});

test('regular-width single window: brand left at least its minimum, device right', () => {
  for (const [w, h] of [[600, 900], [1194, 834], [1280, 800]] as const) {
    const p = planHLynkPlacement({ widthPt: w, heightPt: h, folds: [] });
    assert.equal(p.arrangement, 'wide', `${w}×${h}`);
    assert.ok(p.brand!.width >= HLYNK_BRAND_MIN_PT);
    assert.ok(inside(bodyRect(p), p.device));
    assert.equal(p.device.x + p.device.width, w);
  }
});

// ---- H-3: content fits the screen ------------------------------------------

/** The screen's content area: the screen minus its bezel and one status row (worst case). */
function contentArea(p: HLynkPlacement): { width: number; height: number } {
  const geo = measureShell({ widthPt: p.device.width, heightPt: p.device.height, safeTopPt: 0, safeBottomPt: 0 });
  const bezel = G.bezelPt * 2;
  const statusRow = 36;
  return { width: geo.screenWidthPt - bezel, height: geo.screenHeightPt - bezel - statusRow };
}

// Mirrors incubateFitBlocks and meetFitBlocks (packages/app/features/egg/window-layout.ts)
// with the shipped copy lengths: m10.title 33, m10.body 76, "Ready at 12:45 PM tomorrow" 26,
// m08.title 13, m08.santoro.caption 42. The app cannot import this file (no ./hlynk/layout export).
const M10_STACK: FitBlock[] = [
  { kind: 'text', role: 'title', chars: 33 },
  { kind: 'text', role: 'body', chars: 76, tight: true },
  { kind: 'media', minPt: 144, maxPt: 260 },
  { kind: 'text', role: 'strong', chars: 26 },
  { kind: 'controls', size: 'sm', minRowWidthPt: 240 },
  { kind: 'controls', size: 'lg' },
];
const M10_SIDE: FitBlock[] = M10_STACK.map((b) => (b.kind === 'media' ? { ...b, maxPt: 360 } : b));
const M08: FitBlock[] = [
  { kind: 'text', role: 'title', chars: 13 },
  { kind: 'text', role: 'body', chars: 42, tight: true },
  { kind: 'media', minPt: 96, maxPt: 10_000 },
  { kind: 'controls', size: 'sm', minRowWidthPt: 320 },
];

const VIEWPORTS: { name: string; w: number; h: number; folds?: HLynkFold[] }[] = [
  { name: 'iPhone SE 3 portrait', w: 375, h: 647 },
  { name: 'iPhone 16 Pro Max portrait', w: 440, h: 860 },
  { name: 'Pixel 8 portrait', w: 412, h: 867 },
  { name: 'phone landscape', w: 844, h: 369 },
  { name: 'Duo single panel', w: DUO_PANEL.w, h: DUO_PANEL.h },
  { name: 'Duo spanned, vertical hinge', w: DUO_PANEL.w * 2 + DUO_HINGE, h: DUO_PANEL.h, folds: [vfold(DUO_PANEL.w, DUO_HINGE, DUO_PANEL.h)] },
  { name: 'tablet landscape', w: 1194, h: 790 },
  { name: 'tablet portrait', w: 834, h: 1150 },
  { name: 'very short window', w: 640, h: 360 },
];

for (const v of VIEWPORTS) {
  test(`content fits the H-Lynk screen without scrolling: ${v.name} (${v.w}×${v.h})`, () => {
    const p = planHLynkPlacement({ widthPt: v.w, heightPt: v.h, folds: v.folds ?? [] });
    const area = contentArea(p);
    const side = area.width > area.height;
    for (const [label, blocks] of [['M10', side ? M10_SIDE : M10_STACK], ['M08', M08]] as const) {
      const fit = fitHLynkContent({
        widthPt: area.width, heightPt: area.height, fontScale: 1, ramp: 'mobile', blocks, arrangement: side && label === 'M10' ? 'side' : 'stack',
      });
      assert.ok(fit.fits, `${label} at ${v.name}: content ${fit.contentPt} pt in ${area.width}×${area.height}`);
      assert.ok(fit.contentPt <= area.height, `${label} at ${v.name}: ${fit.contentPt} > ${area.height}`);
    }
  });
}

test('the ladder shrinks media first, then steps the type down', () => {
  const roomy = fitHLynkContent({ widthPt: 400, heightPt: 900, fontScale: 1, ramp: 'mobile', blocks: M10_STACK, arrangement: 'stack' });
  assert.deepEqual([roomy.step, roomy.mediaPt], [0, 260]);
  const tight = fitHLynkContent({ widthPt: 400, heightPt: 520, fontScale: 1, ramp: 'mobile', blocks: M10_STACK, arrangement: 'stack' });
  assert.equal(tight.step, 0);
  assert.ok(tight.mediaPt < 260 && tight.mediaPt >= 144);
  const tighter = fitHLynkContent({ widthPt: 400, heightPt: 420, fontScale: 1, ramp: 'mobile', blocks: M10_STACK, arrangement: 'stack' });
  assert.ok(tighter.step > 0);
  assert.ok(tighter.fits);
});

test('layout finding: below 360 pt tall at 640 wide, M10 cannot fit at the minimum step', () => {
  // Recorded in ADAPTIVE.md as a finding, not fixed with a scroll view.
  const p = planHLynkPlacement({ widthPt: 640, heightPt: 320, folds: [] });
  const area = contentArea(p);
  const fit = fitHLynkContent({ widthPt: area.width, heightPt: area.height, fontScale: 1, ramp: 'mobile', blocks: M10_SIDE, arrangement: 'side' });
  assert.equal(fit.fits, false);
  assert.equal(fit.step, 2);
});

test('too small at the last step reports fits: false instead of scrolling', () => {
  const fit = fitHLynkContent({ widthPt: 300, heightPt: 200, fontScale: 1, ramp: 'mobile', blocks: M10_STACK, arrangement: 'stack' });
  assert.equal(fit.fits, false);
  assert.equal(fit.step, 2);
  assert.equal(fit.mediaPt, 144);
});

// Tablet open-foldable stage (HLynkStage, 2026-10-27): the companion pane
// takes the brand pane's place on landscape md+ windows, and a fold decides
// where it ends. Fixtures are iPad Pro 12.9 / iPad 11 / Duo sizes in pt, not
// device evidence.

test('stage: the landscape shell slot cap is below the brand threshold, and the class says the same number', () => {
  assert.ok(HLYNK_STAGE_SHELL_MAX_PT < HLYNK_TWO_PANE_MIN_PT);
  const source = readFileSync(new URL('./HLynkStage.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes(`md:landscape:max-w-[${HLYNK_STAGE_SHELL_MAX_PT}px]`));
});

test('stage: a capped shell slot on tablet landscape holds the device alone, standard and filling the height', () => {
  for (const [name, w, h] of [['iPad Pro 12.9', 1366, 1024 - 24 - 20], ['iPad 11', 1194, 834 - 24 - 20]] as const) {
    const slot = Math.min(Math.round(w * 0.46), HLYNK_STAGE_SHELL_MAX_PT);
    const p = planHLynkPlacement({ widthPt: slot, heightPt: h, folds: [] });
    assert.equal(p.arrangement, 'single', name);
    assert.equal(p.brand, null, name);
    const geo = measureShell({ widthPt: slot, heightPt: h, safeTopPt: 0, safeBottomPt: 0 });
    assert.equal(geo.layout, 'standard', name);
    assert.ok(geo.bodyWidthPt <= slot && geo.bodyWidthPt >= G.minBodyPt, `${name}: body ${geo.bodyWidthPt}`);
    assert.ok(geo.bodyHeightPt <= h, name);
  }
});

test('stage: no fold, no split; the classes decide', () => {
  assert.equal(planHLynkStageSplit(hlynkUsableRegions(1366, 1024, [])), null);
  // A flat, non-separating crease cuts nothing (skill §4).
  assert.equal(planHLynkStageSplit(hlynkUsableRegions(1080, 720, [vfold(540, 0, 720, { separating: false, occlusionType: 'none' })])), null);
});

test('stage: a vertical hinge ends the companion pane at the hinge; the shell gets the right region', () => {
  for (const hinge of [0, 34]) {
    const split = planHLynkStageSplit(hlynkUsableRegions(1080, 720, [vfold(540, hinge, 720)]));
    assert.deepEqual(split, { axis: 'row', panePt: 540 });
  }
});

test('stage: a horizontal hinge puts the pane above it and the shell below', () => {
  const split = planHLynkStageSplit(hlynkUsableRegions(720, 1080, [hfold(540, 34, 720)]));
  assert.deepEqual(split, { axis: 'column', panePt: 540 });
});
