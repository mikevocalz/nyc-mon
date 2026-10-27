import assert from 'node:assert/strict';
import test from 'node:test';
import { createStore } from 'zustand/vanilla';
import type { Ctx2D } from './canvas2d-types.ts';
import { HUD_SIZE } from './hud.ts';
import {
  createIncubatingScreen, INCUBATING_ACTION_RECT, INCUBATING_ACTION_TARGET, INCUBATING_EGG_RECT, INCUBATING_EGG_TARGET,
  INCUBATING_NOTIFY_RECT, INCUBATING_NOTIFY_TARGET, type IncubatingView,
} from './incubating-screen.ts';

function recordingCtx(): { ctx: Ctx2D; texts: string[]; strokes: () => number } {
  const texts: string[] = [];
  let strokes = 0;
  const gradient = { addColorStop: () => undefined };
  const ctx: Ctx2D = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', font: '', textAlign: 'left', textBaseline: 'alphabetic',
    fillRect: () => undefined, fillText: (text) => void texts.push(text), measureText: (text) => ({ width: text.length * 16 }),
    beginPath: () => undefined, moveTo: () => undefined, lineTo: () => undefined, arcTo: () => undefined, closePath: () => undefined,
    fill: () => undefined, stroke: () => void strokes++, createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4), width, height }), putImageData: () => undefined,
  };
  return { ctx, texts, strokes: () => strokes };
}
const uv = (x: number, y: number) => [x / HUD_SIZE.width, 1 - y / HUD_SIZE.height] as const;
const centre = (r: { x: number; y: number; width: number; height: number }) => uv(r.x + r.width / 2, r.y + r.height / 2);

const COUNTING: IncubatingView = {
  status: 'Incubating, 12 min left', progress: 0.2, ready: false, time: '12 min left',
  detail: 'Metro Egg · ready at 4:04 PM', caption: 'Your egg is resting.', action: 'Keep it warm', notify: null,
};

function setup() {
  const store = createStore<{ view: IncubatingView; warm: number }>(() => ({ view: COUNTING, warm: 0.3 }));
  const calls: string[] = [];
  const screen = createIncubatingScreen({
    egg: { source: { eggId: 'metro-egg', manifest: {}, glb: '/metro.glb' } },
    comingSoon: 'Coming Soon',
    view: () => store.getState().view,
    warmth: () => store.getState().warm,
    subscribe: (onChange) => store.subscribe(onChange),
    onAction: () => void calls.push('action'),
    onNotify: () => void calls.push('notify'),
    onEgg: () => void calls.push('egg'),
    nudge: () => 3,
  });
  return { store, screen, calls };
}

test('the egg stands as one large 3D model, selected so it glows', () => {
  const { screen } = setup();
  assert.equal(screen.models?.length, 1);
  assert.equal(screen.models?.[0]?.target, INCUBATING_EGG_TARGET);
  assert.equal(screen.models?.[0]?.source?.eggId, 'metro-egg');
  assert.equal(screen.selected?.(), INCUBATING_EGG_TARGET);
  assert.ok(INCUBATING_EGG_RECT.width > HUD_SIZE.width / 2, 'the egg is the largest thing on the glass');
  assert.equal(screen.warmth?.(), 0.3);
});

test('the action button keeps it warm; the egg answers through its model box, not the glass', () => {
  const { screen, calls } = setup();
  assert.equal(screen.hitTest(...centre(INCUBATING_EGG_RECT)), null, 'the glass under the egg is not a button');
  const target = screen.hitTest(...centre(INCUBATING_ACTION_RECT));
  assert.equal(target, INCUBATING_ACTION_TARGET);
  screen.select(target!);
  screen.select(INCUBATING_EGG_TARGET);
  assert.deepEqual(calls, ['action', 'egg']);
  assert.equal(screen.nudge?.(), 3);
});

test('the notify action answers only while notifications are off with an action', () => {
  const { store, screen, calls } = setup();
  assert.equal(screen.hitTest(...centre(INCUBATING_NOTIFY_RECT)), null);
  screen.select(INCUBATING_NOTIFY_TARGET);
  assert.deepEqual(calls, []);
  store.setState({ view: { ...COUNTING, notify: { label: 'Notifications are off', action: 'Turn on' } } });
  assert.equal(screen.hitTest(...centre(INCUBATING_NOTIFY_RECT)), INCUBATING_NOTIFY_TARGET);
  screen.select(INCUBATING_NOTIFY_TARGET);
  assert.deepEqual(calls, ['notify']);
  store.setState({ view: { ...COUNTING, notify: { label: 'Reminder not set', action: null } } });
  assert.equal(screen.hitTest(...centre(INCUBATING_NOTIFY_RECT)), null);
});

test('counting draws the status, the ring, the time, ready-at, the caption and Keep it warm', () => {
  const { screen } = setup();
  const a = recordingCtx();
  screen.draw(a.ctx, () => '', null);
  for (const text of [COUNTING.status, COUNTING.time, COUNTING.detail, COUNTING.caption, COUNTING.action]) assert.ok(a.texts.includes(text), text);
  assert.ok(a.strokes() >= 2, 'the ring track and its progress arc');
});

test('ready drops the ring and offers the hatch', () => {
  const { store, screen } = setup();
  store.setState({ view: { ...COUNTING, ready: true, status: 'Ready to hatch', time: 'Ready to hatch', detail: '', caption: '', action: 'Hatch your egg' } });
  const a = recordingCtx();
  screen.draw(a.ctx, () => '', null);
  assert.ok(a.texts.includes('Hatch your egg'));
  assert.ok(!a.texts.includes(COUNTING.caption));
  // Only the action button's outline strokes: no ring.
  assert.equal(a.strokes(), 1);
});

test('subscribe repaints on a view change only through the given store', () => {
  const { store, screen } = setup();
  let repaints = 0;
  const off = screen.subscribe(() => void repaints++);
  store.setState({ view: { ...COUNTING, time: '11 min left' } });
  off();
  store.setState({ view: { ...COUNTING, time: '10 min left' } });
  assert.equal(repaints, 1);
});
