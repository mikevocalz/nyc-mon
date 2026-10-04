import assert from 'node:assert/strict';
import test from 'node:test';
import { brand, palette } from '@acme/theme';
import {
  bandAt, barLayout, buildingWindows, categoryLabels, describeSeries, donutSegments, formatValue,
  linePoints, nearestIndex, niceTicks, polar, resolveSeries, segmentAt, smoothPath,
} from './chart-model.ts';
import { keylineFor, seriesColor, seriesShades } from './district-tones.ts';
import { skylineProfile } from '../nav/skyline-profile.ts';

const DATA = [
  { name: 'Jan', visits: 120, calls: '40' },
  { name: 'Feb', visits: 300, calls: 55 },
  { name: 'Mar', visits: 90, calls: 'n/a' },
];

test('series resolve from the shorthand and from a list', () => {
  const single = resolveSeries(DATA, undefined, { dataKey: 'visits' });
  assert.deepEqual(single, [{ dataKey: 'visits', label: 'visits', color: undefined, values: [120, 300, 90] }]);
  const multi = resolveSeries(DATA, [{ dataKey: 'visits', label: 'Visits' }, { dataKey: 'calls' }]);
  assert.equal(multi[0]!.label, 'Visits');
  // Strings parse, junk becomes 0 rather than NaN in the geometry.
  assert.deepEqual(multi[1]!.values, [40, 55, 0]);
  assert.deepEqual(categoryLabels(DATA), ['Jan', 'Feb', 'Mar']);
  assert.deepEqual(categoryLabels([{ v: 1 }, { v: 2 }]), ['1', '2']);
});

test('nice ticks cover the data on round numbers', () => {
  const t = niceTicks([12, 87], 4);
  assert.equal(t.min, 0);
  assert.equal(t.max, 100);
  assert.deepEqual(t.ticks, [0, 20, 40, 60, 80, 100]);
  assert.equal(niceTicks([5, 5]).max > niceTicks([5, 5]).min, true);
  assert.equal(niceTicks([40, 60], 4, true).min, 0);
  assert.equal(niceTicks([-30, 10], 4, true).min < 0, true);
});

test('values format short', () => {
  assert.equal(formatValue(950), '950');
  assert.equal(formatValue(1234), '1.2k');
  assert.equal(formatValue(12_345), '12k');
  assert.equal(formatValue(3_400_000), '3.4M');
  assert.equal(formatValue(2.25), '2.3');
});

test('line points span the padded box and invert y', () => {
  const box = { width: 110, height: 60, padX: 5, padY: 10 };
  const pts = linePoints([0, 50, 100], { min: 0, max: 100 }, box);
  assert.deepEqual(pts, [{ x: 5, y: 50 }, { x: 55, y: 30 }, { x: 105, y: 10 }]);
  assert.deepEqual(linePoints([7], { min: 0, max: 10 }, box)[0]!.x, 55);
  assert.equal(nearestIndex(5, 3, box), 0);
  assert.equal(nearestIndex(70, 3, box), 1);
  assert.equal(nearestIndex(500, 3, box), 2);
  assert.equal(nearestIndex(10, 0, box), -1);
});

test('the smoothed path matches react-native-graph: one move, one cubic per point, a closing cubic', () => {
  const cmds = smoothPath([{ x: 0, y: 0 }, { x: 6, y: 6 }, { x: 12, y: 0 }]);
  assert.equal(cmds.length, 4);
  assert.deepEqual(cmds[0], { type: 'M', x: 0, y: 0 });
  // Second point: p0 = p1 = first point, so the cubic ends a sixth of the way to the second.
  assert.deepEqual(cmds[1], { type: 'C', x1: 0, y1: 0, x2: 0, y2: 0, x: 1, y: 1 });
  assert.deepEqual(cmds[3], { type: 'C', x1: 12, y1: 0, x2: 12, y2: 0, x: 12, y: 0 });
});

test('bars stand on the street and share their category band', () => {
  const layout = barLayout({ series: [{ values: [10, 20] }, { values: [5, 40] }], width: 200, height: 100, barGap: 0.5 });
  assert.equal(layout.bars.length, 4);
  assert.equal(layout.band, 100);
  assert.deepEqual(layout.centers, [50, 150]);
  for (const bar of layout.bars) {
    assert.ok(Math.abs(bar.y + bar.h - layout.baseline) < 1e-9, 'every building stands on the baseline');
    assert.ok(bar.x >= 0 && bar.x + bar.w + bar.depth <= 200 + 1e-9, 'face and side wall stay inside the plot');
  }
  const tallest = layout.bars.reduce((a, b) => (b.h > a.h ? b : a));
  assert.equal(tallest.value, 40);
  assert.ok(tallest.y > 0, 'headroom is left for the roof and crown');
  assert.equal(bandAt(120, layout), 1);
  assert.equal(bandAt(-1, layout), -1);
  assert.equal(bandAt(250, layout), -1);

  const flat = barLayout({ series: [{ values: [10] }], width: 200, height: 100, layout: 'horizontal' });
  assert.equal(flat.bars[0]!.x, flat.baseline);
});

test('building windows are deterministic and stay on the face', () => {
  const bar = { x: 10, y: 20, w: 40, h: 80, index: 2, series: 0 };
  const a = buildingWindows(bar);
  assert.deepEqual(a, buildingWindows(bar));
  assert.ok(a.length > 0);
  for (const w of a) {
    assert.ok(w.x >= bar.x && w.x + w.w <= bar.x + bar.w);
    assert.ok(w.y >= bar.y && w.y + w.h <= bar.y + bar.h);
  }
  assert.deepEqual(buildingWindows({ ...bar, w: 6 }), []);
});

test('donut segments fill the ring minus the gaps, and hit tests find them', () => {
  const segs = donutSegments([1, 1, 2], 4);
  assert.equal(segs.length, 3);
  const swept = segs.reduce((a, s) => a + s.sweep, 0);
  assert.ok(Math.abs(swept - (360 - 12)) < 1e-9);
  assert.equal(segs[2]!.fraction, 0.5);
  assert.deepEqual(donutSegments([0, 0]), []);
  // A single visible segment has no gap.
  assert.equal(donutSegments([0, 5])[0]!.sweep, 360);

  const ring = { cx: 100, cy: 100, inner: 40, outer: 80 };
  const top = polar(100, 100, 60, segs[0]!.mid);
  assert.equal(segmentAt(top.x, top.y, ring, segs), 0);
  const last = polar(100, 100, 60, segs[2]!.mid);
  assert.equal(segmentAt(last.x, last.y, ring, segs), 2);
  assert.equal(segmentAt(100, 100, ring, segs), -1, 'the hole is not a segment');
  assert.equal(segmentAt(100, 100 - 60, ring, segs), -1, 'the gap at 12 o\'clock is not a segment');
});

test('series describe themselves for screen readers', () => {
  const text = describeSeries({ label: 'Visits', values: [120, 300, 90] }, ['Jan', 'Feb', 'Mar']);
  assert.equal(text, 'Visits: 3 points from Jan to Mar. Low 90 (Mar), high 300 (Feb), latest 90.');
  assert.equal(describeSeries({ label: 'Empty', values: [] }, []), 'Empty: no data.');
});

test('district tones lead with the district hero and honour explicit colours', () => {
  assert.equal(seriesColor(0, 'midtown'), brand.orange);
  assert.equal(seriesColor(0, 'downtown'), brand.carolina);
  assert.equal(seriesColor(0, 'harlem'), palette.orange[700]);
  assert.equal(seriesColor(0, 'megacity'), brand.royal);
  assert.equal(seriesColor(1, 'midtown'), brand.royal);
  assert.equal(seriesColor(0, 'midtown', 'cyan'), brand.carolina);
  assert.equal(seriesColor(0, 'midtown', '#123456'), '#123456');
  assert.equal(seriesShades(0, 'midtown').side, palette.orange[700]);
  assert.equal(keylineFor(brand.orange), brand.royal);
  assert.equal(keylineFor(brand.royal), palette.royal[950]);
});

test('skyline profiles are deterministic per district and fill the width', () => {
  const a = skylineProfile('downtown', 24);
  assert.deepEqual(a, skylineProfile('downtown', 24));
  assert.equal(a.length, 24);
  assert.notDeepEqual(a.map((b) => b.height), skylineProfile('harlem', 24).map((b) => b.height));
  for (const b of a) assert.ok(b.height > 0 && b.height <= 1);
  // Harlem rows sit low; downtown towers rise higher on average.
  const avg = (d: Parameters<typeof skylineProfile>[0]) => skylineProfile(d, 40).reduce((s, b) => s + b.height, 0) / 40;
  assert.ok(avg('downtown') > avg('harlem'));
});
