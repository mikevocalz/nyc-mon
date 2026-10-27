import assert from 'node:assert/strict';
import test from 'node:test';
import { createStore } from 'zustand/vanilla';
import type { Ctx2D } from './canvas2d-types.ts';
import { HUD_SIZE } from './hud.ts';
import {
  createIncubateScreen, INCUBATE_EGG_RECT, INCUBATE_EGG_TARGET, INCUBATE_START_TARGET, incubateOptionRect, incubateOptionTarget,
} from './incubate-screen.ts';
import { keyFromTarget, keyTarget } from './stage-state.ts';

function recordingCtx(): { ctx: Ctx2D; texts: string[] } {
  const texts: string[] = [];
  const gradient = { addColorStop: () => undefined };
  const ctx: Ctx2D = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', font: '', textAlign: 'left', textBaseline: 'alphabetic',
    fillRect: () => undefined, fillText: (text) => void texts.push(text), measureText: (text) => ({ width: text.length * 16 }),
    beginPath: () => undefined, moveTo: () => undefined, lineTo: () => undefined, arcTo: () => undefined, closePath: () => undefined,
    fill: () => undefined, stroke: () => undefined, createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4), width, height }), putImageData: () => undefined,
  };
  return { ctx, texts };
}
const uv = (x: number, y: number) => [x / HUD_SIZE.width, 1 - y / HUD_SIZE.height] as const;

function setup() {
  const store = createStore<{ selected: number | null; phase: 'choose' | 'starting' | 'confirmed' | 'error' }>(() => ({ selected: null, phase: 'choose' }));
  const started: number[] = [];
  const screen = createIncubateScreen({
    title: 'How long should the egg incubate?', body: 'Pick the wait that fits your day.',
    status: () => 'The Metro Egg',
    egg: { source: { eggId: 'metro-egg', manifest: {}, glb: '/metro.glb' } },
    comingSoon: 'Coming Soon',
    options: ['15 min', '30 min', '1 hour'],
    selected: () => store.getState().selected,
    ready: () => (store.getState().selected === null ? '' : 'Ready at 3:15'),
    start: () => ({ label: 'Start incubating', disabled: store.getState().selected === null || store.getState().phase !== 'choose' }),
    busy: () => store.getState().phase === 'starting' || store.getState().phase === 'confirmed',
    error: () => (store.getState().phase === 'error' ? { title: 'Incubation didn\'t start.', body: 'Nothing was saved.' } : null),
    warmth: () => (store.getState().phase === 'confirmed' ? 1 : 0),
    subscribe: (onChange) => store.subscribe(onChange),
    onOption: (i) => store.setState({ selected: i }),
    onStart: () => void started.push(store.getState().selected ?? -1),
  });
  return { store, screen, started };
}

test('the egg stands as one large 3D model, selected so it glows', () => {
  const { screen } = setup();
  assert.equal(screen.models?.length, 1);
  assert.equal(screen.models?.[0]?.target, INCUBATE_EGG_TARGET);
  assert.equal(screen.models?.[0]?.source?.eggId, 'metro-egg');
  assert.equal(screen.selected?.(), INCUBATE_EGG_TARGET);
  assert.ok(INCUBATE_EGG_RECT.width > HUD_SIZE.width / 2, 'the egg is the largest thing on the glass');
});

test('option buttons pick a time; Start is dead until one is picked, then starts', () => {
  const { store, screen, started } = setup();
  const start = { x: HUD_SIZE.width / 2, y: 900 };
  assert.equal(screen.hitTest(...uv(start.x, start.y)), null, 'disabled Start is not a target');
  const r = incubateOptionRect(1, 3);
  const target = screen.hitTest(...uv(r.x + r.width / 2, r.y + r.height / 2));
  assert.equal(target, incubateOptionTarget(1));
  screen.select(target!);
  assert.equal(store.getState().selected, 1);
  assert.equal(screen.hitTest(...uv(start.x, start.y)), INCUBATE_START_TARGET);
  screen.select(INCUBATE_START_TARGET);
  assert.deepEqual(started, [1]);
});

test('once started, the other times stop answering', () => {
  const { store, screen } = setup();
  store.setState({ selected: 0, phase: 'confirmed' });
  const r = incubateOptionRect(2, 3);
  assert.equal(screen.hitTest(...uv(r.x + 10, r.y + 10)), null);
  screen.select(incubateOptionTarget(2));
  assert.equal(store.getState().selected, 0);
  assert.equal(screen.warmth?.(), 1);
});

test('the glass draws the title, the times, ready-at and the error', () => {
  const { store, screen } = setup();
  store.setState({ selected: 0 });
  const a = recordingCtx();
  screen.draw(a.ctx, () => '', null);
  for (const text of ['The Metro Egg', '15 min', '30 min', '1 hour', 'Ready at 3:15', 'Start incubating']) assert.ok(a.texts.includes(text), text);
  store.setState({ phase: 'error' });
  const b = recordingCtx();
  screen.draw(b.ctx, () => '', null);
  assert.ok(b.texts.includes('Incubation didn\'t start.'));
});

test('front-key targets round-trip, and other targets are not keys', () => {
  for (const key of ['prev', 'next', 'activate', 'back', 'home', 'menu'] as const) assert.equal(keyFromTarget(keyTarget(key)), key);
  assert.equal(keyFromTarget('side-key'), null);
  assert.equal(keyFromTarget('F01'), null);
  assert.equal(keyFromTarget('key:volume'), null);
  assert.equal(keyFromTarget(null), null);
});
