import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import {
  EGG_CLIP_PHASES, EggHatchAssetError, eggPoseFor, hatchClipTime, parseEggHatchManifest, playbackProgress, resolveEggClips,
} from './hatch-manifest.ts';

const EGGS_DIR = new URL('../../../assets/eggs/', import.meta.url);
const read = (eggId: string): unknown => JSON.parse(readFileSync(new URL(`${eggId}/hatch.manifest.json`, EGGS_DIR), 'utf8'));
// An egg folder ships once its build has written a `runtime` block. A folder
// can hold reference art and a blocked manifest first (Signal Egg, no mesh yet).
const eggIds = readdirSync(EGGS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((id) => (read(id) as { runtime?: unknown }).runtime !== undefined);
const metro = parseEggHatchManifest(read('metro-egg'));
const CLIPS = [
  { name: 'egg_idle', duration: 2 },
  { name: 'hatch', duration: 6.5 },
  { name: 'attention_lean_in', duration: 1.5 },
  { name: 'attention_hesitate', duration: 2 },
];

test('every shipped egg manifest parses and names its own folder', () => {
  assert.ok(eggIds.length >= 1);
  for (const id of eggIds) {
    const manifest = parseEggHatchManifest(read(id));
    assert.equal(manifest.eggId, id);
    assert.match(manifest.runtime.glb, new RegExp(`^${id}-hatch\\.glb$`));
  }
});

test('a broken manifest throws a manifest error, not a TypeError later', () => {
  const bad = structuredClone(read('metro-egg')) as { runtime: { phaseSeconds: { crack: number[] } } };
  bad.runtime.phaseSeconds.crack = [4.2, 1.8];
  assert.throws(() => parseEggHatchManifest(bad), (e: unknown) => e instanceof EggHatchAssetError && e.code === 'manifest');
  assert.throws(() => parseEggHatchManifest({}), (e: unknown) => e instanceof EggHatchAssetError && e.code === 'manifest');
});

test('overlapping phases are rejected', () => {
  const bad = structuredClone(read('metro-egg')) as { runtime: { phaseSeconds: { pressure: number[] } } };
  bad.runtime.phaseSeconds.pressure = [0.5, 1.8];
  assert.throws(() => parseEggHatchManifest(bad), EggHatchAssetError);
});

test('seek time is phase start plus progress times phase length', () => {
  for (const phase of EGG_CLIP_PHASES) {
    const [a, b] = metro.runtime.phaseSeconds[phase];
    assert.equal(hatchClipTime(metro, phase, 0), a, `${phase} start`);
    assert.equal(hatchClipTime(metro, phase, 1), b, `${phase} end`);
    assert.ok(Math.abs(hatchClipTime(metro, phase, 0.5) - (a + b) / 2) < 1e-9, `${phase} middle`);
  }
  assert.ok(Math.abs(hatchClipTime(metro, 'crack', 0.25) - 2.4) < 1e-9, 'first crack beat');
});

test('progress is clamped, so resume and overrun land on the phase edges', () => {
  assert.equal(hatchClipTime(metro, 'burst', -3), 4.2);
  assert.equal(hatchClipTime(metro, 'burst', 7), 4.7);
  assert.equal(hatchClipTime(metro, 'burst', Number.NaN), 4.2);
});

test('the phase boundaries are continuous: each phase starts where the last ended', () => {
  for (let i = 1; i < EGG_CLIP_PHASES.length; i++) {
    assert.equal(hatchClipTime(metro, EGG_CLIP_PHASES[i]!, 0), hatchClipTime(metro, EGG_CLIP_PHASES[i - 1]!, 1));
  }
});

test('playback progress scales by the screen duration', () => {
  assert.equal(playbackProgress(0, 2.4), 0);
  assert.equal(playbackProgress(1.2, 2.4), 0.5);
  assert.equal(playbackProgress(9, 2.4), 1);
  assert.equal(playbackProgress(0, 0), 1);
});

test('reduced motion shows phase end poses and a still idle', () => {
  assert.deepEqual(eggPoseFor(metro, 'crack', 0.1, 'lean-in', true), { kind: 'hatch', seconds: 4.2 });
  assert.deepEqual(eggPoseFor(metro, null, 0, 'lean-in', true), { kind: 'hatch', seconds: 0 });
  assert.deepEqual(eggPoseFor(metro, null, 0, 'lean-in', false), { kind: 'idle', loop: true });
  assert.deepEqual(eggPoseFor(metro, 'attention', 0.2, 'hesitate', true), { kind: 'attention', attention: 'hesitate', progress: 1 });
  assert.deepEqual(eggPoseFor(metro, 'attention', 0.2, 'hesitate', false), { kind: 'attention', attention: 'hesitate', progress: 0.2 });
});

test('clip roles resolve by exact name', () => {
  const clips = resolveEggClips(metro, CLIPS);
  assert.equal(clips.hatch.name, 'hatch');
  assert.equal(clips.leanIn.name, 'attention_lean_in');
  assert.equal(clips.hesitate.name, 'attention_hesitate');
  assert.equal(clips.idle.name, 'egg_idle');
});

test('a missing clip throws and names every absent role', () => {
  const without = CLIPS.filter((c) => c.name !== 'attention_hesitate' && c.name !== 'egg_idle');
  assert.throws(
    () => resolveEggClips(metro, without),
    (e: unknown) =>
      e instanceof EggHatchAssetError && e.code === 'missing-clip' && e.message.includes('attention_hesitate') && e.message.includes('egg_idle'),
  );
  // Case differences are not forgiven.
  assert.throws(() => resolveEggClips(metro, CLIPS.map((c) => ({ ...c, name: c.name.toUpperCase() }))), EggHatchAssetError);
});

test('a hatch clip shorter than the phases is rejected', () => {
  assert.throws(
    () => resolveEggClips(metro, CLIPS.map((c) => (c.name === 'hatch' ? { ...c, duration: 4 } : c))),
    (e: unknown) => e instanceof EggHatchAssetError && e.code === 'missing-clip',
  );
});
