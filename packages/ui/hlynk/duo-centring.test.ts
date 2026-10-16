// The H-Lynk centred in the right panel of a spanned Surface Duo (1080 x 720 dp
// window, vertical hinge at x ~ 540), on both arrangement backends: the
// library's Android arrange() (the native backend's pane frames) and the
// Decision H-2 fallback planner. Unit fixtures, not device evidence.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { primaryEdgeFor } from '../arrangement/backend.ts';
import { HLYNK_GEOMETRY, placeBodyInFrame, planHLynkPlacement, type HLynkRect } from './layout.ts';

interface Frame { left: number; top: number; width: number; height: number }
interface Arrange {
  (
    geometry: { width: number; height: number; window: { width: number; height: number }; fold?: { x: number; y: number; width: number; height: number; orientation: 'vertical' | 'horizontal'; separating: boolean; halfOpened: boolean } },
    options: { arrangement: 'split' | 'overlay'; axes: 'both' | 'horizontal' | 'vertical'; primaryEdge?: 'leading' | 'trailing'; rtl?: boolean },
  ): { primary: Frame; secondary: Frame | null };
}
// The installed library's own compiled policy (lib/module/arrange.js, 0.4.0).
// Imported by file path: its exports map does not expose the file, and Node
// does not strip types under node_modules.
const arrangeUrl = new URL('../node_modules/react-native-arrangement-view/lib/module/arrange.js', import.meta.url);
const { arrange } = (await import(fileURLToPath(arrangeUrl))) as { arrange: Arrange };

const W = 1080;
const H = 720;
// The shell's host loses a 24 dp status bar at the top.
const HOST_H = H - 24;

function check(region: HLynkRect, label: string, layout: 'standard' | 'compact' = 'standard') {
  const { geo, left, top } = placeBodyInFrame(region);
  const body = { x: region.x + left, y: region.y + top, width: geo.bodyWidthPt, height: geo.bodyHeightPt };
  const cx = body.x + body.width / 2;
  const cy = body.y + body.height / 2;
  assert.ok(Math.abs(cx - (region.x + region.width / 2)) <= 1, `${label}: horizontal centre ${cx} vs region ${region.x + region.width / 2}`);
  assert.ok(Math.abs(cy - (region.y + region.height / 2)) <= 1, `${label}: vertical centre ${cy} vs region ${region.y + region.height / 2}`);
  assert.ok(body.x >= region.x && body.x + body.width <= region.x + region.width, `${label}: both rails inside the region`);
  assert.ok(body.y >= region.y && body.y + body.height <= region.y + region.height, `${label}: head and control row inside the region`);
  assert.equal(geo.layout, layout, `${label}: ${layout} device`);
  return body;
}

for (const hinge of [0, 34]) {
  test(`native backend, Duo spanned, ${hinge} dp hinge at 540: device centred in the right pane`, () => {
    const frames = arrange(
      { width: W, height: HOST_H, window: { width: W, height: H }, fold: { x: 540, y: 0, width: hinge, height: HOST_H, orientation: 'vertical', separating: true, halfOpened: false } },
      { arrangement: 'overlay', axes: 'both', primaryEdge: primaryEdgeFor('right', false), rtl: false },
    );
    assert.ok(frames.secondary, 'the brand pane is shown');
    const right = { x: frames.primary.left, y: frames.primary.top, width: frames.primary.width, height: frames.primary.height };
    assert.ok(right.x >= 540 + hinge / 2, 'the device pane starts after the hinge');
    assert.ok(frames.secondary!.left + frames.secondary!.width <= 540 + hinge / 2, 'the brand pane ends before the hinge');
    const body = check(right, 'native');
    assert.ok(body.x >= 540 + hinge, 'no device pixel under the hinge');
  });

  test(`native backend in RTL, ${hinge} dp hinge: the device stays physically right`, () => {
    const frames = arrange(
      { width: W, height: HOST_H, window: { width: W, height: H }, fold: { x: 540, y: 0, width: hinge, height: HOST_H, orientation: 'vertical', separating: true, halfOpened: false } },
      { arrangement: 'overlay', axes: 'both', primaryEdge: primaryEdgeFor('right', true), rtl: true },
    );
    assert.ok(frames.primary.left >= 540, 'device pane on the physical right');
  });

  test(`fallback planner, Duo spanned, ${hinge} dp hinge at 540: device centred in the right region`, () => {
    const p = planHLynkPlacement({
      widthPt: W, heightPt: HOST_H,
      folds: [{ orientation: 'vertical', separating: true, occlusionType: hinge > 0 ? 'full' : 'none', x: 540, y: 0, width: hinge, height: HOST_H }],
    });
    assert.equal(p.arrangement, 'book');
    assert.ok(p.brand && p.brand.x === 0, 'brand pane on the left');
    const body = check(p.device, 'fallback');
    assert.ok(body.x >= 540 + hinge, 'no device pixel under the hinge');
  });
}

test('native backend, tabletop: brand above, H-Lynk below the fold', () => {
  const frames = arrange(
    { width: 840, height: 900, window: { width: 840, height: 900 }, fold: { x: 0, y: 440, width: 840, height: 0, orientation: 'horizontal', separating: true, halfOpened: true } },
    { arrangement: 'overlay', axes: 'both', primaryEdge: primaryEdgeFor('right', false), rtl: false },
  );
  assert.ok(frames.secondary && frames.secondary.top + frames.secondary.height <= 440, 'brand above the fold');
  assert.ok(frames.primary.top >= 440, 'device below the fold');
  check({ x: frames.primary.left, y: frames.primary.top, width: frames.primary.width, height: frames.primary.height }, 'tabletop', 'compact');
  // A 448 dp half is short, so the device takes its compact strip, centred: the same rule as phone landscape.
});

test('native backend, one Duo panel or a phone: the H-Lynk alone, full box', () => {
  for (const [w, h] of [[540, 696], [375, 647]] as const) {
    const frames = arrange(
      { width: w, height: h, window: { width: w, height: h + 24 } },
      { arrangement: 'overlay', axes: 'both', primaryEdge: primaryEdgeFor('right', false) },
    );
    assert.deepEqual(frames.primary, { left: 0, top: 0, width: w, height: h });
    // Overlay with no fold: the brand pane is covered; ArrangementPanes hides it.
    assert.deepEqual(frames.secondary, frames.primary);
  }
});

test('placeBodyInFrame centres every width from a phone to a tablet', () => {
  for (const width of [320, 375, 430, 480, 540, 600, 720, 834]) {
    for (const height of [480, 647, 696, 900, 1100]) {
      const { geo, left, top } = placeBodyInFrame({ width, height });
      assert.ok(geo.bodyWidthPt <= width && geo.bodyHeightPt <= height, `${width}x${height} fits`);
      assert.ok(Math.abs(left * 2 + geo.bodyWidthPt - width) < 1e-6, `${width}x${height} centred across`);
      assert.ok(Math.abs(top * 2 + geo.bodyHeightPt - height) < 1e-6, `${width}x${height} centred down`);
    }
  }
  assert.equal(HLYNK_GEOMETRY.railPt, 12);
});
