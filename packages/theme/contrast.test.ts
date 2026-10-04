import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  FORBIDDEN,
  PAIRS,
  THRESHOLD,
  contrastRatio,
  measure,
  measureForbidden,
  relativeLuminance,
} from './contrast.ts';
import { hlynk, led, motion, motionTokens, semantic, typeRamp, type MotionToken } from './tokens.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const r2 = (n: number) => Math.round(n * 100) / 100;

test('WCAG 2.2 math', () => {
  assert.equal(relativeLuminance('#FFFFFF'), 1);
  assert.equal(relativeLuminance('#000000'), 0);
  assert.equal(r2(contrastRatio('#FFFFFF', '#000000')), 21);
  assert.equal(contrastRatio('#BEC0C2', '#BEC0C2'), 1);
  // The classic AA boundary grey.
  assert.equal(r2(contrastRatio('#767676', '#FFFFFF')), 4.54);
  // Order does not matter.
  assert.equal(contrastRatio('#0058F8', '#F8F8F8'), contrastRatio('#F8F8F8', '#0058F8'));
  // Black at 0x80 alpha over white composites to #7F7F7F.
  assert.equal(r2(contrastRatio('#00000080', '#FFFFFF')), r2(contrastRatio('#7F7F7F', '#FFFFFF')));
});

test('every used text and UI pair clears its WCAG threshold', async (t) => {
  for (const pair of PAIRS) {
    if (pair.role === 'decorative' || pair.role === 'disabled') continue;
    for (const m of measure(pair)) {
      await t.test(`${pair.id} [${m.mode}]`, () => {
        assert.ok(
          m.pass,
          `${pair.fg} ${m.fgHex} on ${pair.bg.join(' + ')} ${m.bgHex} is ${m.ratio.toFixed(2)}:1, ` +
            `${pair.role} needs ${THRESHOLD[pair.role]}:1. Used at ${pair.usedAt.join(', ') || '(token contract)'}`,
        );
      });
    }
  }
});

test('exempt pairs say why', () => {
  for (const p of PAIRS) {
    if (p.role === 'decorative' || p.role === 'disabled') {
      assert.ok(p.reason && p.reason.length > 10, `${p.id} is ${p.role} without a reason`);
      assert.ok(p.usedAt.length > 0, `${p.id} is ${p.role} but names no usage`);
    }
  }
});

test('pair ids are unique and every cited file exists', () => {
  const ids = new Set<string>();
  for (const p of PAIRS) {
    assert.ok(!ids.has(p.id), `duplicate pair id ${p.id}`);
    ids.add(p.id);
    for (const at of p.usedAt) {
      const [file, line] = at.split(':') as [string, string];
      const abs = join(ROOT, file);
      assert.ok(existsSync(abs), `${p.id}: ${file} does not exist`);
      const lines = readFileSync(abs, 'utf8').split('\n').length;
      assert.ok(Number(line) >= 1 && Number(line) <= lines, `${p.id}: ${at} is past the end of the file`);
    }
  }
});

test('Law 10: every semantic token is measured', () => {
  const measured = new Set(PAIRS.flatMap((p) => [p.fg, ...p.bg]).map((n) => n.split('/')[0]));
  for (const token of Object.keys(semantic)) {
    assert.ok(measured.has(token), `semantic token "${token}" has no contrast measurement`);
  }
});

test('Law 10: every LED and H-Lynk token is measured', () => {
  const measured = new Set(PAIRS.flatMap((p) => [p.fg, ...p.bg]).map((n) => n.split('/')[0]));
  for (const key of Object.keys(led)) assert.ok(measured.has(`led-${key}`), `led.${key} has no contrast measurement`);
  for (const [tier, group] of Object.entries(hlynk)) {
    for (const key of Object.keys(group)) {
      const kebab = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      assert.ok(measured.has(`hlynk-${tier}-${kebab}`), `hlynk.${tier}.${key} has no contrast measurement`);
    }
  }
});

test('§0A.2: every motion token has an authored reduced-motion sibling', () => {
  const durations = new Set(Object.values(motion.duration).map((d) => Number.parseInt(d, 10)));
  for (const [name, { full, reduced }] of Object.entries(motionTokens) as [string, MotionToken][]) {
    assert.notDeepEqual(reduced, full, `${name}: reduced is a copy of full`);
    // Reduced never adds movement: no scale or travel, and never longer than full.
    if (reduced.kind === 'tween') {
      assert.equal(reduced.scale, undefined, `${name}: reduced scales`);
      assert.equal(reduced.risePt, undefined, `${name}: reduced rises`);
      assert.equal(reduced.slidePt, undefined, `${name}: reduced slides`);
      if (full.kind === 'tween') assert.ok(reduced.durationMs <= full.durationMs, `${name}: reduced is slower than full`);
    }
    assert.notEqual(reduced.kind, 'breathe', `${name}: reduced loops`);
    assert.notEqual(reduced.kind, 'blink', `${name}: reduced blinks`);
    // WCAG 2.3.1: no more than three flashes in any one-second window. A burst
    // is `count` flashes; bursts repeat far apart, so one window sees one burst.
    if (full.kind === 'blink') {
      const period = full.onMs + full.offMs;
      const perSecond = Math.min(full.count, Math.floor(1000 / period) + 1);
      assert.ok(perSecond <= 3, `${name}: ${perSecond} flashes in one second`);
      assert.ok(full.intervalMs >= full.count * period + 1000, `${name}: bursts overlap one second window`);
    }
    // UI tweens reuse the duration scale; the LED ramp (240) and fan (400) are new by design.
    if (full.kind === 'tween' && !['motion-power-on', 'motion-scan-fan'].includes(name)) {
      assert.ok(durations.has(full.durationMs), `${name}: ${full.durationMs} ms is off the motion.duration scale`);
    }
  }
});

test('type ramp: nothing under 13 pt, line height at least the size', () => {
  for (const [name, t] of Object.entries(typeRamp)) {
    assert.ok(t.sizePt >= 13, `${name} is ${t.sizePt} pt`);
    assert.ok(t.lineHeightPt >= t.sizePt, `${name} line height under its size`);
  }
});

test('§1.3 forbidden pairs still measure under threshold', () => {
  for (const f of FORBIDDEN) {
    const { ratio, threshold } = measureForbidden(f);
    assert.ok(ratio < threshold, `${f.id} now measures ${ratio.toFixed(2)}:1; the rule is stale`);
  }
});

// Same-line scan of class strings. tv() slot maps and tone tables put a face
// and its label on one line, so this catches the table-driven cases; it does
// not follow classes composed across lines.
const SCAN_DIRS = ['packages/ui', 'packages/app', 'apps/web/app', 'apps/web/components', 'apps/mobile/app', 'apps/mobile/components'];
const RULES: { name: string; a: RegExp; b: RegExp }[] = [
  // In dark mode bg-primary is brand orange, so white on it is white-on-orange too.
  { name: 'white on orange', a: /\b(?:text-white|text-ink-50)\b(?!\/)/, b: /\bbg-(?:orange-500|primary)\b(?!\/|-)/ },
  { name: 'orange on royal', a: /\b(?:text|border|stroke|fill)-orange-\d+\b/, b: /\bbg-royal-\d+\b(?!\/)/ },
];

function* sourceFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) yield* sourceFiles(abs);
    else if (/\.tsx?$/.test(name) && !/\.(stories|test)\.tsx?$/.test(name)) yield abs;
  }
}

test('§1.3: no white-on-orange or orange-on-royal in component code', () => {
  const hits: string[] = [];
  for (const d of SCAN_DIRS) {
    const dir = join(ROOT, d);
    if (!existsSync(dir)) continue;
    for (const file of sourceFiles(dir)) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        for (const r of RULES) {
          if (r.a.test(line) && r.b.test(line)) hits.push(`${r.name}: ${file.slice(ROOT.length + 1)}:${i + 1}`);
        }
      });
    }
  }
  assert.deepEqual(hits, []);
});
