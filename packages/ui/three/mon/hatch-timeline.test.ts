import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  BEATS,
  CRACKS,
  HATCH_SECONDS,
  hatchDuration,
  hatchFrame,
  lightLevel,
  MIN_RAMP,
  PULSE_HALVES,
  REDUCED_SECONDS,
  riveCues,
  riveIntensity,
  SHARD_BURSTS,
  shardStates,
  soundCues,
  type HatchPhase,
} from './hatch-timeline.ts';

const FPS = 60;
const frames = (reduced: boolean) =>
  Array.from({ length: Math.ceil(hatchDuration(reduced) * FPS) + 30 }, (_, i) => ({ t: i / FPS, ...hatchFrame(i / FPS, reduced) }));

test('full motion runs the Emerald beats in order and ends on the Baby alone, in colour', () => {
  const order: HatchPhase[] = [];
  for (const f of frames(false)) if (order.at(-1) !== f.phase) order.push(f.phase);
  assert.deepEqual(order, ['intro', 'shake1', 'shake2', 'shake3', 'tension', 'whiteout', 'reveal', 'silhouette', 'resolve', 'done']);
  const end = hatchFrame(HATCH_SECONDS, false);
  assert.deepEqual(
    [end.eggOpacity, end.monOpacity, end.monScale, end.camera, end.silhouette, end.white, end.glow, end.dim, end.monShape],
    [0, 1, 1, 1, 0, 0, 0, 0, 0],
  );
  assert.ok(HATCH_SECONDS >= 6 && HATCH_SECONDS <= 7, `length ${HATCH_SECONDS}`);
});

test('beat lengths match pokeemerald egg_hatch.c at 60 fps', () => {
  const frames = (b: readonly [number, number]) => Math.round((b[1] - b[0]) * FPS);
  assert.equal(frames(BEATS.intro), 30);
  assert.equal(frames(BEATS.shake1), 20);
  assert.equal(Math.round((BEATS.shake2[0] - BEATS.shake1[1]) * FPS), 30);
  assert.equal(frames(BEATS.shake2), 20);
  assert.equal(Math.round((BEATS.shake3[0] - BEATS.shake2[1]) * FPS), 30);
  assert.equal(frames(BEATS.shake3), 38);
  assert.equal(frames(BEATS.tension), 50);
  assert.equal(frames(BEATS.reveal), 8);
  CRACKS.forEach((c, i) => assert.equal(Math.round((c - [BEATS.shake1, BEATS.shake2, BEATS.shake3][i]![0]) * FPS), 15));
});

test('the egg shakes only inside the three shakes, the later two at double strength', () => {
  const peak = (b: readonly [number, number]) => Math.max(...frames(false).filter((f) => f.t >= b[0] && f.t < b[1]).map((f) => Math.abs(f.eggTilt)));
  for (const f of frames(false)) {
    const inShake = [BEATS.shake1, BEATS.shake2, BEATS.shake3].some(([a, b]) => f.t >= a && f.t < b);
    if (!inShake) assert.equal(f.eggTilt, 0, `t=${f.t}`);
  }
  assert.ok(peak(BEATS.shake2) > 1.7 * peak(BEATS.shake1));
  assert.ok(peak(BEATS.shake3) > 1.7 * peak(BEATS.shake1));
});

test('crack light steps up at each crack and keeps building through the tension; the Baby stays hidden', () => {
  const at = (t: number) => hatchFrame(t, false);
  assert.equal(at(CRACKS[0]! - 0.01).crackLight, 0);
  assert.ok(at(CRACKS[1]! - 0.01).crackLight > at(CRACKS[0]! - 0.01).crackLight);
  assert.ok(at(CRACKS[2]! - 0.01).crackLight > at(CRACKS[1]! - 0.01).crackLight);
  assert.ok(at(BEATS.tension[1]).crackLight > at(BEATS.tension[0]).crackLight);
  for (const f of frames(false).filter((f) => f.t < BEATS.whiteout[1])) assert.equal(f.monOpacity, 0, `t=${f.t}`);
});

test('the egg and Baby swap only under full white', () => {
  for (const f of frames(false)) {
    if (f.eggOpacity > 0 && f.eggOpacity < 1) assert.fail(`egg half-faded at ${f.t}`);
    const prev = hatchFrame(f.t - 1 / FPS, false);
    if (prev.monOpacity !== f.monOpacity) assert.ok(f.white > 0.99 || prev.white > 0.99, `swap at ${f.t} with white ${f.white}`);
  }
});

test('the silhouette pulses accelerate, the first half at least 350 ms, and only its shape moves', () => {
  assert.ok(PULSE_HALVES[0]! >= MIN_RAMP);
  for (let i = 1; i < PULSE_HALVES.length; i++) assert.ok(PULSE_HALVES[i]! < PULSE_HALVES[i - 1]!);
  const sil = frames(false).filter((f) => f.phase === 'silhouette' && f.white === 0);
  assert.ok(sil.length > 0);
  for (const f of sil) assert.equal(f.silhouette, 1, `brightness moved at ${f.t}`);
  let turns = 0;
  for (let i = 2; i < sil.length; i++) if ((sil[i - 1]!.monShape - sil[i - 2]!.monShape) * (sil[i]!.monShape - sil[i - 1]!.monShape) < 0) turns++;
  assert.ok(turns >= 4, `shape turns ${turns}`);
});

test('reduced motion: no shake, chips, white-out or pulses; one soft glow and a quick cross-fade', () => {
  assert.equal(hatchDuration(true), REDUCED_SECONDS);
  for (const f of frames(true)) {
    assert.equal(f.clipTime, null);
    assert.equal(f.eggTilt, 0);
    assert.equal(f.white, 0);
    assert.equal(f.glow, 0);
    assert.equal(f.charge, 0);
    assert.equal(f.monShape, 0);
    assert.equal(shardStates(f.t, true).length, 0);
  }
  assert.equal(hatchFrame(REDUCED_SECONDS, true).phase, 'done');
  assert.deepEqual(soundCues(true).map((c) => c.cue), ['chime']);
  assert.deepEqual(riveCues(true).map((c) => c.trigger), ['burst', 'reveal']);
});

/**
 * Alexa+ PLATFORM-DOCS §2.9: no more than three flashes in any one second.
 * A flash is a rise of at least 0.1 in stage brightness (lightLevel, 0..1),
 * the general flash threshold's 10% luminance change. Rises are counted from
 * each local low to the next local high.
 */
function flashStarts(reduced: boolean): { t: number; rise: number; seconds: number }[] {
  const f = frames(reduced).map((x) => ({ t: x.t, l: lightLevel(x) }));
  const out: { t: number; rise: number; seconds: number }[] = [];
  let low = f[0]!;
  for (let i = 1; i < f.length; i++) {
    const rising = f[i]!.l > f[i - 1]!.l + 1e-9;
    const nextFalls = i + 1 >= f.length || f[i + 1]!.l < f[i]!.l - 1e-9;
    if (!rising && f[i]!.l < low.l) low = f[i]!;
    if (rising && nextFalls) {
      const rise = f[i]!.l - low.l;
      if (rise >= 0.1) out.push({ t: low.t, rise, seconds: f[i]!.t - low.t });
      low = f[i]!;
    }
  }
  return out;
}

test('flash rate: at most 3 rising edges of 0.1 or more in any second, with exactly one white-out', () => {
  for (const reduced of [false, true]) {
    const starts = flashStarts(reduced);
    for (const s of starts) assert.ok(starts.filter((u) => u.t >= s.t && u.t < s.t + 1).length <= 3, `reduced=${reduced} t=${s.t}`);
  }
  const whites = frames(false).filter((f, i, all) => i > 0 && all[i - 1]!.white < 0.5 && f.white >= 0.5);
  assert.equal(whites.length, 1);
});

test('every brightening ramps over at least 350 ms', () => {
  for (const reduced of [false, true]) {
    const f = frames(reduced).map((x) => lightLevel(x));
    // A smoothstep over MIN_RAMP peaks at 1.5x the linear slope; nothing may rise faster.
    const perFrame = Math.max(...f.slice(1).map((l, i) => l - f[i]!));
    assert.ok(perFrame <= 1 / (MIN_RAMP * FPS) * 1.6, `per-frame rise ${perFrame}`);
  }
});

test('Rive cues: stir, three cracks on the crack beats, burst at the white-out, reveal as it clears', () => {
  const cues = riveCues(false);
  assert.deepEqual(cues.map((c) => c.trigger), ['stir', 'crack', 'crack', 'crack', 'burst', 'reveal']);
  assert.deepEqual(cues.filter((c) => c.trigger === 'crack').map((c) => c.t), [...CRACKS]);
  assert.equal(cues.find((c) => c.trigger === 'burst')!.t, BEATS.whiteout[0]);
  for (const c of cues) assert.equal(hatchFrame(c.t + 1e-6, false).phase === 'done', false);
  assert.ok(riveIntensity(BEATS.tension[1], false) > 0.95);
  assert.equal(riveIntensity(BEATS.whiteout[1] + 0.01, false), 0);
  for (let t = 0; t < HATCH_SECONDS; t += 1 / FPS) {
    const v = riveIntensity(t, false);
    assert.ok(v >= 0 && v <= 1);
  }
});

test('sound cues line up with the cracks, the white-out and the colour resolve', () => {
  const cues = soundCues(false);
  assert.deepEqual(cues.map((c) => c.cue), ['crack', 'crack', 'crack', 'tick', 'shimmer', 'whoosh', 'chime']);
  assert.equal(cues.find((c) => c.cue === 'whoosh')!.t, BEATS.whiteout[0]);
  assert.equal(hatchFrame(cues.find((c) => c.cue === 'chime')!.t + 0.01, false).phase, 'resolve');
});

test('shards: one chip at crack 1, two at crack 3, then 16 in 4 bursts of 4 that fall away', () => {
  assert.deepEqual(SHARD_BURSTS.map((b) => b.count), [1, 2, 4, 4, 4, 4]);
  assert.equal(shardStates(CRACKS[0]! + 0.05, false).length, 1);
  assert.equal(shardStates(BEATS.whiteout[0] + 13 / FPS, false).filter((s) => s.size >= 0.07).length, 16);
  const big = (t: number) => shardStates(t, false).filter((s) => s.size >= 0.07);
  const a = big(BEATS.whiteout[0] + 0.3);
  const b = big(BEATS.whiteout[0] + 0.85);
  assert.ok(Math.min(...b.map((s) => s.y)) < Math.min(...a.map((s) => s.y)), 'gravity pulls them down');
  assert.equal(shardStates(HATCH_SECONDS, false).length, 0);
});

test('the Rive file keys the same beats it is cued with', () => {
  // packages/assets/rive/hatch-evolve: each trigger reaches its own state, and
  // the burst bloom rises over at least MIN_RAMP (frames at 60 fps).
  const rml = readFileSync(new URL('../../../assets/rive/hatch-evolve/scene.rml', import.meta.url), 'utf8');
  for (const name of ['stir', 'crack', 'burst', 'reveal', 'intensity', 'reducedMotion']) assert.match(rml, new RegExp(`name="${name}"`));
  assert.match(rml, /<StateMachine name="Hatch"/);
  const rise = /<!-- bloom-rise-frames: (\d+) -->/.exec(rml);
  assert.ok(rise && Number(rise[1]) / FPS >= MIN_RAMP, 'bloom rise');
});
