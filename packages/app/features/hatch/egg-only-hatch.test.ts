import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { HATCH_PRESENTATION_PHASES } from '@acme/core/schemas';
import { HATCH_COPY } from './copy.ts';
import { PHASE_MS, eggPrecrackPose } from './hatch-sequence.ts';

// Decision 29: the capture case is only for capturing encountered Mons. The
// hatch, incubation and incubate screens neither import nor render it, and no
// hatch path names the old case beats outside the v2 → v3 save migration.

const FEATURES = join(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(join(FEATURES, rel), 'utf8');

/** Every source on the egg → incubation → hatch route. */
const HATCH_PATH_SOURCES = [
  'hatch/HatchScreen.tsx',
  'hatch/IncubatingScreen.tsx',
  'hatch/hatch-sequence.ts',
  'hatch/incubation-model.ts',
  'hatch/copy.ts',
  'egg/IncubateScreen.tsx',
  'egg/copy.ts',
] as const;

const CASE_COMPONENTS = ['CaptureCase', 'EggCase', 'CaseDrawing'] as const;

describe('egg-only hatch (Decision 29)', () => {
  for (const rel of ['hatch/HatchScreen.tsx', 'hatch/IncubatingScreen.tsx', 'egg/IncubateScreen.tsx']) {
    it(`${rel} never imports or renders a case component`, () => {
      const code = read(rel);
      for (const name of CASE_COMPONENTS) {
        assert.doesNotMatch(code, new RegExp(`\\b${name}\\b`), `${rel} references ${name}`);
      }
      assert.doesNotMatch(code, /from ['"][^'"]*hatch\/(CaptureCase|EggCase|CaseDrawing)['"]/);
    });
  }

  for (const rel of HATCH_PATH_SOURCES) {
    it(`${rel} names no case, lid, scanner or pad beat`, () => {
      const code = read(rel);
      assert.doesNotMatch(code, /['"]case-open['"]|\bcase_open\b|['"]scanner['"]/);
      assert.doesNotMatch(code, /\blidProgress\b|\bpadGlow\b|\bhatchLatch\b|\bcaseState\b/);
    });
  }

  it('core sim hatch takes its phase order from the schema and names no legacy beat', () => {
    const sim = readFileSync(join(FEATURES, '..', '..', 'core', 'sim', 'hatch.ts'), 'utf8');
    assert.match(sim, /HATCH_PRESENTATION_PHASES/);
    assert.doesNotMatch(sim, /['"]case-open['"]|['"]scanner['"]/);
  });

  it('plays stir, pressure, crack, burst, emerge, attention', () => {
    assert.deepEqual([...HATCH_PRESENTATION_PHASES], ['stir', 'pressure', 'crack', 'burst', 'emerge', 'attention']);
  });

  it('times every phase in both motion modes, about eight seconds in full', () => {
    for (const mode of ['full', 'reduced'] as const) {
      assert.deepEqual(Object.keys(PHASE_MS[mode]).sort(), [...HATCH_PRESENTATION_PHASES].sort());
    }
    assert.deepEqual(PHASE_MS.full, { stir: 1000, pressure: 800, crack: 2400, burst: 500, emerge: 1800, attention: 1500 });
    assert.deepEqual(PHASE_MS.reduced, { stir: 300, pressure: 400, crack: 450, burst: 300, emerge: 400, attention: 1500 });
    assert.equal(Object.values(PHASE_MS.full).reduce((a, b) => a + b, 0), 8000);
  });

  it('copy announces stir and pressure and has no case strings', () => {
    assert.ok(HATCH_COPY['m12.a11y.stir'].length > 0);
    assert.ok(HATCH_COPY['m12.a11y.pressure'].length > 0);
    assert.equal('m12.a11y.case_open' in HATCH_COPY, false);
    for (const [id, text] of Object.entries(HATCH_COPY)) assert.doesNotMatch(text, /\bcase\b/i, id);
  });
});

describe('eggPrecrackPose', () => {
  it('rests at both ends of stir and pressure, so crack starts from the still egg', () => {
    for (const [s, p] of [[0, 0], [1, 0], [1, 1]] as const) {
      const pose = eggPrecrackPose(s, p, false);
      assert.ok(Math.abs(pose.rotateDeg) < 1e-9);
      assert.ok(Math.abs(pose.scale - 1) < 1e-9);
    }
  });

  it('wobbles during stir, stronger in the second nudge, within 3 degrees', () => {
    const samples = Array.from({ length: 101 }, (_, i) => eggPrecrackPose(i / 100, 0, false).rotateDeg);
    const first = Math.max(...samples.slice(0, 50).map(Math.abs));
    const second = Math.max(...samples.slice(50).map(Math.abs));
    assert.ok(first > 0.1);
    assert.ok(second > first);
    assert.ok(Math.max(...samples.map(Math.abs)) <= 3);
  });

  it('swells in growing pulses during pressure, at most 3%', () => {
    const scales = Array.from({ length: 101 }, (_, i) => eggPrecrackPose(1, i / 100, false).scale);
    assert.ok(Math.max(...scales.slice(50)) > Math.max(...scales.slice(0, 50)));
    assert.ok(Math.max(...scales) <= 1.03 + 1e-9);
    assert.ok(Math.min(...scales) >= 1 - 1e-9);
  });

  it('reduced motion never rotates and holds one fuller still through pressure', () => {
    for (let i = 0; i <= 10; i++) assert.equal(eggPrecrackPose(i / 10, 0, true).rotateDeg, 0);
    assert.equal(eggPrecrackPose(1, 0.5, true).scale, 1.02);
    assert.equal(eggPrecrackPose(1, 1, true).scale, 1);
  });
});
