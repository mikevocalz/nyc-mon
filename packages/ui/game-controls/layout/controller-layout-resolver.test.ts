import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FoldLayout } from '../../adaptive-panes/fold-layout.ts';
import {
  CONTROL_SIZE_DP,
  RAIL_CLEARANCE_DP,
  USABLE_SCALE_MIN,
  resolveControllerLayout,
  resolveLayoutProfile,
  type ControllerLayout,
  type ControllerLayoutInput,
} from './controller-layout-resolver.ts';
import { insideOneRegion, intersects, type Rect } from './geometry.ts';
import { sixButtonArch } from '../six-button-arch.ts';
import { STICK_GEOMETRY_DP } from '../touch-geometry.ts';

const none = { top: 0, right: 0, bottom: 0, left: 0 };
const base: ControllerLayoutInput = {
  width: 412,
  height: 915,
  insets: none,
  folds: [],
  railEdge: null,
  isRTL: false,
  hardwareFamily: 'phone',
  runtime: 'native',
  controller: { handedness: 'right', scale: 1 },
};

const vfold = (x: number, width: number, height: number, extra: Partial<FoldLayout> = {}): FoldLayout => ({
  orientation: 'vertical', state: 'halfOpened', posture: 'book', separating: true, x, y: 0, width, height, ...extra,
});
const hfold = (y: number, width: number, extra: Partial<FoldLayout> = {}): FoldLayout => ({
  orientation: 'horizontal', state: 'halfOpened', posture: 'tabletop', separating: true, x: 0, y, width, height: 0, ...extra,
});

/** Every guarantee the resolver makes, checked on every layout a test produces. */
function assertSafe(input: ControllerLayoutInput): ControllerLayout {
  const layout = resolveControllerLayout(input);
  for (const [name, rect] of Object.entries({ stick: layout.stick, cluster: layout.cluster, pill: layout.pill })) {
    assert.ok(insideOneRegion(rect, layout.regions), `${name} ${JSON.stringify(rect)} straddles a fold or leaves the safe area`);
    assert.ok(rect.width >= 0 && rect.height >= 0, `${name} has a negative size`);
  }
  assert.ok(!intersects(layout.stick, layout.cluster), 'stick and cluster overlap');
  assert.ok(!intersects(layout.stick, layout.pill), 'stick and pill overlap');
  assert.ok(!intersects(layout.cluster, layout.pill), 'cluster and pill overlap');
  for (const control of [layout.stick, layout.cluster, layout.pill]) {
    assert.ok(!intersects(layout.stage, control), 'stage is not clear of a control');
  }
  assert.ok(layout.pill.height >= 44, `pill height ${layout.pill.height} is under the 44 pt target`);
  return layout;
}

const right = (r: Rect) => r.x + r.width;
const bottom = (r: Rect) => r.y + r.height;

/* ---------- §10 profiles ---------- */

test('compact portrait: stick lower-left, cluster lower-right, pill in the upper band, stage between', () => {
  const l = assertSafe(base);
  assert.equal(l.profile, 'phone-portrait');
  assert.ok(l.stick.x < l.cluster.x);
  assert.ok(l.stick.y > 915 / 2 && l.cluster.y > 915 / 2);
  assert.ok(l.pill.y < 100);
  assert.ok(Math.abs(l.pill.x + l.pill.width / 2 - 206) < 1, 'pill is centred');
  assert.ok(l.stage.y >= bottom(l.pill) && bottom(l.stage) <= Math.min(l.stick.y, l.cluster.y));
  assert.equal(l.scale, 1);
});

test('landscape phone: both groups in the lower grip zones, the stage spans the centre', () => {
  const l = assertSafe({ ...base, width: 915, height: 412 });
  assert.equal(l.profile, 'phone-landscape');
  assert.ok(bottom(l.stick) > 300 && bottom(l.cluster) > 300);
  assert.ok(l.stage.x >= right(l.stick) && right(l.stage) <= l.cluster.x, 'stage sits between the groups');
  assert.ok(l.stage.width > 300);
});

test('foldable cover with no fold feature is the compact outer layout, not a phone regression', () => {
  const l = assertSafe({ ...base, width: 360, height: 880, hardwareFamily: 'foldable' });
  assert.equal(l.profile, 'fold-outer');
  assert.ok(l.stick.x < l.cluster.x);
});

test('foldable inner display open flat with a non-separating crease lays out as a tablet', () => {
  const crease = vfold(420, 0, 900, { state: 'flat', posture: 'flat', separating: false, occlusionType: 'none' });
  const l = assertSafe({ ...base, width: 840, height: 900, hardwareFamily: 'foldable', folds: [crease] });
  assert.equal(l.profile, 'tablet');
  assert.equal(l.regions.length, 1, 'a flat crease must not fabricate a dead strip');
});

test('book posture: groups in separate segments, nothing on the hinge, pill off the hinge', () => {
  const l = assertSafe({ ...base, width: 840, height: 700, hardwareFamily: 'foldable', folds: [vfold(420, 0, 700)] });
  assert.equal(l.profile, 'fold-book');
  assert.equal(l.posture, 'book');
  assert.equal(l.regions.length, 2);
  assert.ok(right(l.stick) <= 420 && l.cluster.x >= 420);
  assert.ok(right(l.pill) <= 420 || l.pill.x >= 420);
});

test('dual screen with an occluding hinge: no control or stage under the 34 dp gap', () => {
  const l = assertSafe({ ...base, width: 1114, height: 720, hardwareFamily: 'foldable', folds: [vfold(540, 34, 720, { state: 'flat', posture: 'flat', occlusionType: 'full' })] });
  assert.equal(l.profile, 'fold-book');
  const hinge: Rect = { x: 540, y: 0, width: 34, height: 720 };
  for (const rect of [l.stick, l.cluster, l.pill, l.stage]) assert.ok(!intersects(rect, hinge));
});

test('tabletop: stage in the upper region, controller lower, pill centred on the lower region upper edge', () => {
  const l = assertSafe({ ...base, width: 840, height: 700, hardwareFamily: 'foldable', folds: [hfold(350, 840)] });
  assert.equal(l.profile, 'fold-tabletop');
  assert.equal(l.posture, 'tabletop');
  assert.ok(bottom(l.stage) <= 350, 'stage stays above the hinge');
  assert.ok(l.stick.y >= 350 && l.cluster.y >= 350);
  assert.equal(l.pill.y, 350 + 16);
  assert.ok(Math.abs(l.pill.x + l.pill.width / 2 - 420) < 1);
});

test('trifold: every fold processed; stick leftmost, cluster rightmost, pill in the centre segment', () => {
  const l = assertSafe({ ...base, width: 1290, height: 900, hardwareFamily: 'foldable', folds: [vfold(430, 0, 900), vfold(860, 0, 900)] });
  assert.equal(l.regions.length, 3);
  assert.ok(right(l.stick) <= 430);
  assert.ok(l.cluster.x >= 860);
  assert.ok(l.pill.x >= 430 && right(l.pill) <= 860);
});

test('trifold with a narrow middle segment: the pill is never hidden in a segment too small for it', () => {
  const l = assertSafe({ ...base, width: 1000, height: 900, hardwareFamily: 'foldable', folds: [vfold(420, 0, 900), vfold(580, 0, 900)] });
  assert.equal(l.regions.length, 3);
  assert.ok(!(l.pill.x >= 420 && right(l.pill) <= 580), 'pill avoided the 160 dp segment');
  assert.ok(l.pill.width >= CONTROL_SIZE_DP.pill.width);
});

test('tablet: groups sit low in the bottom corners, broad stage in the centre', () => {
  const l = assertSafe({ ...base, width: 1366, height: 1024, hardwareFamily: 'tablet' });
  assert.equal(l.profile, 'tablet');
  // No grip raise since 2026-10-16: the stick sits 8 dp above the bottom edge.
  assert.ok(Math.abs(bottom(l.stick) - (1024 - 8)) < 1e-6);
  assert.ok(l.stage.width > 800 && l.stage.height > 500);
});

test('headset 2D panel takes the tablet arrangement', () => {
  assert.equal(resolveLayoutProfile({ ...base, width: 1280, height: 800, hardwareFamily: 'headset' }), 'tablet');
});

test('web: pointer runtime regardless of family, same hinge-safe guarantees', () => {
  const l = assertSafe({ ...base, width: 1280, height: 720, hardwareFamily: 'unknown', runtime: 'web' });
  assert.equal(l.profile, 'web');
});

test('unknown family: a splitting fold wins first, then size decides', () => {
  assert.equal(resolveLayoutProfile({ ...base, hardwareFamily: 'unknown', width: 840, height: 700, folds: [vfold(420, 0, 700)] }), 'fold-book');
  assert.equal(resolveLayoutProfile({ ...base, hardwareFamily: 'unknown', width: 800, height: 1200 }), 'tablet');
  assert.equal(resolveLayoutProfile({ ...base, hardwareFamily: 'unknown', width: 412, height: 915 }), 'phone-portrait');
  assert.equal(resolveLayoutProfile({ ...base, hardwareFamily: 'unknown', width: 915, height: 412 }), 'phone-landscape');
});

/* ---------- handedness, RTL, rail ---------- */

test('left-handed mirrors the groups; RTL alone does not', () => {
  const left = assertSafe({ ...base, controller: { handedness: 'left', scale: 1 } });
  assert.ok(left.mirrored);
  assert.ok(left.stick.x > left.cluster.x);
  const rtl = assertSafe({ ...base, isRTL: true });
  assert.ok(!rtl.mirrored);
  assert.ok(rtl.stick.x < rtl.cluster.x);
  assert.equal(rtl.isRTL, true);
});

test('left-handed in book posture: stick in the trailing segment, cluster in the leading one', () => {
  const l = assertSafe({ ...base, width: 840, height: 700, hardwareFamily: 'foldable', folds: [vfold(420, 0, 700)], controller: { handedness: 'left', scale: 1 } });
  assert.ok(l.stick.x >= 420 && right(l.cluster) <= 420);
});

test('a physical-right rail adds clearance on the right, also in RTL', () => {
  const plain = assertSafe({ ...base, width: 1366, height: 1024, hardwareFamily: 'tablet' });
  const railed = assertSafe({ ...base, width: 1366, height: 1024, hardwareFamily: 'tablet', railEdge: 'right' });
  assert.equal(plain.cluster.x - railed.cluster.x, RAIL_CLEARANCE_DP);
  const rtlRailed = assertSafe({ ...base, width: 1366, height: 1024, hardwareFamily: 'tablet', railEdge: 'right', isRTL: true });
  assert.equal(rtlRailed.cluster.x, railed.cluster.x);
});

/* ---------- scale ---------- */

test('scale 1.4 fits a 412 dp phone by shrinking until both groups sit side by side', () => {
  const l = assertSafe({ ...base, controller: { handedness: 'right', scale: 1.4 } });
  assert.ok(l.scale < 1.4 && l.scale >= USABLE_SCALE_MIN);
  assert.equal(l.cramped, false);
  assert.ok(right(l.stick) <= l.cluster.x);
});

test('scale 1.4 stays 1.4 on a tablet', () => {
  const l = assertSafe({ ...base, width: 1366, height: 1024, hardwareFamily: 'tablet', controller: { handedness: 'right', scale: 1.4 } });
  assert.equal(l.scale, 1.4);
  assert.equal(l.stick.width, CONTROL_SIZE_DP.stick.width * 1.4);
});

test('scale 0.8 keeps the pill at full size', () => {
  const l = assertSafe({ ...base, controller: { handedness: 'right', scale: 0.8 } });
  assert.equal(l.pill.height, CONTROL_SIZE_DP.pill.height);
  assert.equal(l.stick.width, CONTROL_SIZE_DP.stick.width * 0.8);
});

test('a segment too small to play shrinks without overlap and reports cramped', () => {
  const l = assertSafe({ ...base, width: 200, height: 160 });
  assert.ok(l.scale < USABLE_SCALE_MIN);
  assert.equal(l.cramped, true);
  assert.ok(right(l.stick) <= l.cluster.x);
});

test('an uncramped layout always fits the arch and the stick it renders (M3)', () => {
  // Sweep widths and heights across the phone, fold-segment and landscape range.
  for (let width = 180; width <= 900; width += 20) {
    for (const height of [140, 180, 240, 320, 480, 915]) {
      const l = resolveControllerLayout({ ...base, width, height });
      if (l.cramped) continue;
      const arch = sixButtonArch({ scale: l.scale, handedness: 'right' });
      assert.ok(arch.widthDp <= l.cluster.width + 1e-9 && arch.heightDp <= l.cluster.height + 1e-9,
        `${width}×${height}: arch ${arch.widthDp}×${arch.heightDp} overflows cluster slot ${l.cluster.width}×${l.cluster.height} at scale ${l.scale}`);
      assert.ok(STICK_GEOMETRY_DP.housing * l.scale >= 44, `${width}×${height}: stick under 44 at scale ${l.scale}`);
    }
  }
});

/* ---------- insets and coordinates ---------- */

test('safe-area insets are respected on every edge', () => {
  const insets = { top: 59, right: 0, bottom: 34, left: 0 };
  const l = assertSafe({ ...base, insets });
  assert.ok(l.pill.y >= 59);
  assert.ok(bottom(l.stick) <= 915 - 34 && bottom(l.cluster) <= 915 - 34);
  const side = assertSafe({ ...base, width: 915, height: 412, insets: { top: 0, right: 47, bottom: 21, left: 47 } });
  assert.ok(side.stick.x >= 47 && right(side.cluster) <= 915 - 47);
});

test('a fold entirely outside the container (nonzero host origin already subtracted) is ignored', () => {
  const l = assertSafe({ ...base, folds: [vfold(-300, 0, 915), vfold(1500, 0, 915)] });
  assert.equal(l.regions.length, 1);
});

test('zero-width separating fold still splits; non-finite fold geometry is skipped', () => {
  assert.equal(assertSafe({ ...base, width: 840, folds: [vfold(420, 0, 915)] }).regions.length, 2);
  assert.equal(assertSafe({ ...base, folds: [vfold(Number.NaN, 0, 915)] }).regions.length, 1);
});

test('a zero-size container yields zero rects without throwing', () => {
  const l = resolveControllerLayout({ ...base, width: 0, height: 0 });
  assert.equal(l.stick.width, 0);
  assert.equal(l.regions.length, 1);
});

test('equal input yields an identical layout (stable assignments across equivalent updates)', () => {
  assert.deepEqual(resolveControllerLayout(base), resolveControllerLayout({ ...base }));
});

/* ---------- saved positions ---------- */

test('a saved offset moves the stick and is kept when it fits', () => {
  const plain = resolveControllerLayout(base);
  const moved = assertSafe({ ...base, saved: { 'phone-portrait': { stick: { dx: 40, dy: -60 } } } });
  assert.equal(moved.stick.x, plain.stick.x + 40);
  assert.equal(moved.stick.y, plain.stick.y - 60);
});

test('a saved offset onto the hinge stops at the hinge-side margin; one dragged past it lands clear on the other side', () => {
  const book: ControllerLayoutInput = { ...base, width: 840, height: 700, hardwareFamily: 'foldable', folds: [vfold(420, 0, 700)] };
  const nudged = assertSafe({ ...book, saved: { 'fold-book': { stick: { dx: 300, dy: 0 } } } });
  assert.ok(Math.abs(right(nudged.stick) - (420 - 16)) < 1e-6, 'stick stopped at the hinge-side margin');
  const crossed = assertSafe({ ...book, saved: { 'fold-book': { stick: { dx: 380, dy: 0 } } } });
  assert.ok(crossed.stick.x >= 420 + 16 - 1e-6, 'stick is wholly in the trailing segment, never on the hinge');
});

test('a saved offset that drags the stick off-screen is pulled back inside the safe area', () => {
  const l = assertSafe({ ...base, saved: { 'phone-portrait': { stick: { dx: -4000, dy: 4000 } } } });
  assert.ok(l.stick.x >= 16 && bottom(l.stick) <= 915 - 16);
});

test('saved offsets that make the groups collide are discarded as a pair', () => {
  const plain = resolveControllerLayout(base);
  const l = assertSafe({ ...base, saved: { 'phone-portrait': { stick: { dx: 200, dy: 0 }, cluster: { dx: -10, dy: 0 } } } });
  assert.deepEqual(l.stick, plain.stick);
  assert.deepEqual(l.cluster, plain.cluster);
});

test('saved layouts apply only to their own profile', () => {
  const plain = resolveControllerLayout(base);
  const l = assertSafe({ ...base, saved: { 'phone-landscape': { stick: { dx: 40, dy: 0 } } } });
  assert.deepEqual(l.stick, plain.stick);
});

test('a saved scale replaces the profile scale for that layout profile', () => {
  const l = assertSafe({ ...base, width: 1366, height: 1024, hardwareFamily: 'tablet', saved: { tablet: { scale: 1.2 } } });
  assert.equal(l.scale, 1.2);
});

test('the same saved layout re-resolved under new metrics (rotation) never leaves the safe area', () => {
  const saved = { 'phone-portrait': { stick: { dx: 60, dy: -400 } }, 'phone-landscape': { cluster: { dx: 500, dy: 0 } } } as const;
  assertSafe({ ...base, saved });
  assertSafe({ ...base, width: 915, height: 412, saved });
  assertSafe({ ...base, width: 915, height: 412, insets: { top: 0, right: 47, bottom: 21, left: 47 }, saved });
});
