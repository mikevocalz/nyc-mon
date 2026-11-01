import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { hlynk, led, palette, signage } from '@acme/theme';
import {
  RIVE_LOADER_ARTBOARD,
  RIVE_LOADER_BINDINGS,
  RIVE_LOADER_MACHINE,
  RIVE_LOADER_VIEW_MODEL,
  clampRiveLoaderProgress,
  resolveRiveLoaderPhase,
  riveLoaderColors,
} from './rive-loader-bindings.ts';

const scene = readFileSync(new URL('./rive/loader/scene.rml', import.meta.url), 'utf8');

test('the scene names the artboard, machine and view model the forks use', () => {
  assert.match(scene, new RegExp(`<Artboard [^>]*name="${RIVE_LOADER_ARTBOARD}"`));
  assert.match(scene, new RegExp(`<StateMachine name="${RIVE_LOADER_MACHINE}"`));
  assert.match(scene, new RegExp(`<ViewModel [^>]*name="${RIVE_LOADER_VIEW_MODEL}"`));
});

test('every bound property exists in the view model with the type its setter writes', () => {
  const kinds: Record<keyof typeof RIVE_LOADER_BINDINGS, string> = {
    ringPrimary: 'Color', ringAccent: 'Color', core: 'Color', track: 'Color', phase: 'String', progress: 'Number',
  };
  for (const [key, path] of Object.entries(RIVE_LOADER_BINDINGS)) {
    const kind = kinds[key as keyof typeof RIVE_LOADER_BINDINGS];
    assert.match(scene, new RegExp(`<ViewModelProperty${kind} name="${path}"`), `${path} as ${kind}`);
  }
});

test('the machine handles every phase the host can set', () => {
  for (const phase of ['loading', 'complete', 'error', 'reduced']) {
    assert.match(scene, new RegExp(`<TransitionValueStringComparator value="${phase}"/>`), phase);
  }
});

test('the built .riv is committed beside the source', () => {
  assert.ok(statSync(new URL('./rive/loader/build/loader.riv', import.meta.url)).size > 0);
});

test('colours come from the theme tokens for each scheme', () => {
  assert.deepEqual(riveLoaderColors('dark'), {
    ringPrimary: led.on, ringAccent: palette.orange[500], core: signage.white, track: palette.ink[800],
  });
  assert.deepEqual(riveLoaderColors('light'), {
    ringPrimary: hlynk.core.body, ringAccent: palette.orange[600], core: signage.black, track: palette.ink[200],
  });
  assert.deepEqual(riveLoaderColors(), riveLoaderColors('dark'));
});

test('reduced motion turns loading into the pulse and leaves one-shot phases alone', () => {
  assert.equal(resolveRiveLoaderPhase('loading', true), 'reduced');
  assert.equal(resolveRiveLoaderPhase('loading', false), 'loading');
  assert.equal(resolveRiveLoaderPhase('complete', true), 'complete');
  assert.equal(resolveRiveLoaderPhase('error', true), 'error');
});

test('progress clamps to 0-1', () => {
  assert.equal(clampRiveLoaderProgress(-1), 0);
  assert.equal(clampRiveLoaderProgress(0.4), 0.4);
  assert.equal(clampRiveLoaderProgress(3), 1);
  assert.equal(clampRiveLoaderProgress(Number.NaN), 0);
});
