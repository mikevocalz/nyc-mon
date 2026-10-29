import assert from 'node:assert/strict';
import test from 'node:test';
import { createStore } from 'zustand/vanilla';
import type { Ctx2D } from './canvas2d-types.ts';
import { createGlassScreen, GLASS_MON_TARGET, glassGeometry, type GlassLayout, type GlassView } from './glass-screen.ts';
import { HUD_SIZE } from './hud.ts';

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

const LAYOUT: GlassLayout = { model: 'large', rings: true, lineRows: 1, actionRows: 1, perRow: 4 };
const HOME: GlassView = {
  status: { text: 'Squeaklet is hungry', tone: 'request' },
  title: 'Squeaklet',
  subtitle: 'Hood Ratti Bloodline',
  rings: [{ id: 'fullness', label: 'Food', hearts: 1, low: true, lowLabel: 'Low' }],
  lines: [{ text: 'A line' }],
  actions: [
    { target: 'feed', label: 'Feed', tone: 'primary' },
    { target: 'rest', label: 'Rest', tone: 'secondary' },
    { target: 'play', label: 'Play', tone: 'secondary', disabled: true },
  ],
};

function setup(layout = LAYOUT, source: { kind: 'mon'; key: string; glb: string; clips: readonly string[] } | null = { kind: 'mon', key: 'squeaklet', glb: '/s.glb', clips: ['tail_swish'] }) {
  const store = createStore<{ view: GlassView }>(() => ({ view: HOME }));
  const actions: string[] = [];
  let taps = 0;
  const screen = createGlassScreen({
    layout, model: { source }, comingSoon: 'Coming Soon',
    view: () => store.getState().view, subscribe: (fn) => store.subscribe(fn),
    onAction: (t) => void actions.push(t), onModel: () => void taps++,
  });
  return { screen, store, actions, taps: () => taps };
}

test('the Baby stands in one slot between the header and the text block, inside the glass', () => {
  const geo = glassGeometry(LAYOUT);
  const { screen } = setup();
  const model = screen.models?.[0];
  assert.equal(model?.target, GLASS_MON_TARGET);
  assert.equal((model?.source as { kind?: string } | null)?.kind, 'mon');
  const r = geo.model!;
  assert.ok(r.y >= geo.headerBottom, 'below the header and rings');
  assert.ok(r.y + r.height <= geo.linesTop, 'above the text block');
  assert.ok(r.x >= 0 && r.x + r.width <= HUD_SIZE.width);
  assert.equal(screen.selected?.(), GLASS_MON_TARGET);
});

test('draws the status, title, heart rows with their low word, lines and buttons', () => {
  const { screen } = setup();
  const { ctx, texts } = recordingCtx();
  screen.draw(ctx, (size) => `${size}px x`, null);
  for (const t of ['Squeaklet is hungry', 'Squeaklet', 'Hood Ratti Bloodline', 'Food · Low', 'A line', 'Feed', 'Rest', 'Play']) {
    assert.ok(texts.includes(t), `draws ${t}`);
  }
  // Care meters are hearts: no percent number on the glass (M13 direction).
  assert.ok(!texts.some((t) => /^\d+$/.test(t)), 'draws no meter number');
});

test('a tap on a button acts; a disabled one does nothing; the model tap goes to onModel', () => {
  const { screen, actions, taps } = setup();
  const geo = glassGeometry(LAYOUT);
  const feed = geo.actionRect(0);
  const play = geo.actionRect(2);
  const hitFeed = screen.hitTest(...uv(feed.x + 10, feed.y + 10));
  assert.equal(hitFeed, 'feed');
  screen.select('feed');
  assert.equal(screen.hitTest(...uv(play.x + 10, play.y + 10)), null);
  screen.select('play');
  screen.select(GLASS_MON_TARGET);
  assert.deepEqual(actions, ['feed']);
  assert.equal(taps(), 1);
});

test('no model source draws Coming Soon, never a picture; no model layout has no slot', () => {
  const soon = setup(LAYOUT, null);
  const { ctx, texts } = recordingCtx();
  soon.screen.draw(ctx, (size) => `${size}px x`, null);
  assert.ok(texts.includes('Coming Soon'));
  const none = createGlassScreen({
    layout: { ...LAYOUT, model: 'none' }, model: null, comingSoon: 'Coming Soon', view: () => HOME,
    subscribe: () => () => undefined, onAction: () => undefined,
  });
  assert.deepEqual(none.models, []);
  assert.equal(none.selected?.(), null);
});
