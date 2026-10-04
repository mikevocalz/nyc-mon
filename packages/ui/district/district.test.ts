import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTROL_TONES, DISTRICTS, DISTRICT_CHART_TONE, DISTRICT_NAME, DISTRICT_TONE, DISTRICT_TONES, THEMES, TONES, TONE_CLASSES,
  resolveControlTone, resolveTone,
} from './index.ts';

test('one district list drives names, tones, chart tones and themes', () => {
  assert.deepEqual([...DISTRICTS], ['downtown', 'midtown', 'harlem', 'megacity']);
  for (const map of [DISTRICT_NAME, DISTRICT_TONE, DISTRICT_TONES, DISTRICT_CHART_TONE, THEMES]) {
    assert.deepEqual(Object.keys(map).sort(), [...DISTRICTS].sort());
  }
});

test('control and surface resolvers agree on the district tone', () => {
  for (const d of DISTRICTS) assert.equal(resolveControlTone(undefined, d), resolveTone(d));
});

test('every tone carries every class role', () => {
  assert.deepEqual(Object.keys(TONE_CLASSES).sort(), [...TONES].sort());
  for (const t of CONTROL_TONES) {
    for (const v of Object.values(TONE_CLASSES[t])) assert.ok(typeof v === 'string' && v.length > 0);
  }
  // Harlem controls keep the lighter edge they shipped with.
  assert.equal(TONE_CLASSES.brick.controlBorder, 'border-orange-700');
  assert.equal(TONE_CLASSES.brick.border, 'border-orange-800');
});

test('text on every control face holds AA (4.5:1)', async () => {
  const { palette } = await import('@acme/theme');
  const hex = (cls: string): string => {
    const m = /(?:bg|text)-(\w+)-(\d+)$/.exec(cls);
    if (cls === 'text-white') return '#FFFFFF';
    const fam = (palette as unknown as Record<string, Record<string, string>>)[m![1]!]!;
    return fam[m![2]!]!;
  };
  const lum = (h: string) => {
    const c = [1, 3, 5].map((i) => {
      const v = parseInt(h.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi! + 0.05) / (lo! + 0.05);
  };
  for (const t of CONTROL_TONES) {
    const c = TONE_CLASSES[t];
    for (const fg of [c.onFace, c.on]) {
      const r = ratio(hex(fg), hex(c.face));
      assert.ok(r >= 4.5, `${t}: ${fg} on ${c.face} is ${r.toFixed(2)}:1`);
    }
    const night = palette.ink[950];
    assert.ok(ratio(hex(c.text), night) >= 4.5, `${t}: ${c.text} on night`);
  }
});
