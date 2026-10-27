import assert from 'node:assert/strict';
import test from 'node:test';
import { createStore } from 'zustand/vanilla';
import type { Ctx2D } from './canvas2d-types.ts';
import { CHOICE_ROW, choiceActionRect, choiceModelRect, choiceSlotAt, choiceSlotRect, createChoiceScreen, type ChoiceItem } from './choice-screen.ts';
import { HUD_SIZE } from './hud.ts';

/** A Ctx2D that records the text it draws and accepts every other call. */
function recordingCtx(): { ctx: Ctx2D; texts: string[] } {
  const texts: string[] = [];
  const gradient = { addColorStop: () => undefined };
  const ctx: Ctx2D = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', font: '', textAlign: 'left', textBaseline: 'alphabetic',
    fillRect: () => undefined,
    fillText: (text) => void texts.push(text),
    measureText: (text) => ({ width: text.length * 16 }),
    beginPath: () => undefined, moveTo: () => undefined, lineTo: () => undefined, arcTo: () => undefined, closePath: () => undefined,
    fill: () => undefined, stroke: () => undefined,
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4), width, height }),
    putImageData: () => undefined,
  };
  return { ctx, texts };
}

const source = (eggId: string) => ({ eggId, manifest: {}, glb: `/${eggId}.glb` });
const items: ChoiceItem[] = [
  { target: 'F01', label: 'Metro Egg', detail: 'Bloodline one', source: source('metro-egg') },
  { target: 'F02', label: 'Corner Egg', detail: 'Bloodline two', source: source('corner-egg') },
  { target: 'F12', label: 'Prism Egg', detail: 'Bloodline three', source: null },
];
/** Canvas px to screen UV, the inverse of what a raycast hands hitTest. */
const uv = (x: number, y: number) => [x / HUD_SIZE.width, 1 - y / HUD_SIZE.height] as const;

function screenWithStore() {
  const store = createStore<{ focused: number | null }>(() => ({ focused: null }));
  const screen = createChoiceScreen({
    title: 'Choose an egg',
    hint: 'Tap an egg.',
    comingSoon: 'Coming Soon',
    items,
    focused: () => store.getState().focused,
    subscribe: (onChange) => store.subscribe(onChange),
    onSelect: (i) => store.setState({ focused: i }),
  });
  return { store, screen };
}

test('three slots tile the row inside the screen, left to right, without overlap', () => {
  let right = 0;
  for (let i = 0; i < 3; i++) {
    const r = choiceSlotRect(i, 3);
    assert.ok(r.x > right, `slot ${i} starts after slot ${i - 1}`);
    assert.ok(r.x + r.width <= HUD_SIZE.width && r.y + r.height <= HUD_SIZE.height);
    right = r.x + r.width;
    const m = choiceModelRect(i, 3);
    assert.ok(m.height < r.height && m.y === r.y, 'the model stands above the label strip');
  }
});

test('a tap at a slot\'s centre and inner corners hits that slot; between slots and outside the row hits nothing', () => {
  for (let i = 0; i < 3; i++) {
    const r = choiceSlotRect(i, 3);
    for (const [x, y] of [[r.x + r.width / 2, r.y + r.height / 2], [r.x + 1, r.y + 1], [r.x + r.width - 1, r.y + r.height - 1]] as const) {
      assert.equal(choiceSlotAt(...uv(x, y), 3), i);
    }
  }
  const gap = choiceSlotRect(0, 3).x + choiceSlotRect(0, 3).width + 5;
  assert.equal(choiceSlotAt(...uv(gap, 400), 3), null);
  assert.equal(choiceSlotAt(...uv(HUD_SIZE.width / 2, 60), 3), null);
  assert.equal(choiceSlotAt(...uv(HUD_SIZE.width / 2, 960), 3), null);
});

test('the screen\'s hit targets are the items\' targets, and selecting one writes the focus', () => {
  const { store, screen } = screenWithStore();
  const r = choiceSlotRect(1, 3);
  const target = screen.hitTest(...uv(r.x + 10, r.y + 10));
  assert.equal(target, 'F02');
  screen.select(target!);
  assert.equal(store.getState().focused, 1);
  assert.equal(screen.selected?.(), 'F02');
});

test('every model stands in its own slot, and a slot with no model has no source', () => {
  const { screen } = screenWithStore();
  assert.deepEqual(screen.models?.map((m) => [m.target, m.source?.eggId ?? null]), [['F01', 'metro-egg'], ['F02', 'corner-egg'], ['F12', null]]);
});

test('the screen draws each label, Coming Soon only where a model is missing, and the focused detail', () => {
  const { store, screen } = screenWithStore();
  const browsing = recordingCtx();
  screen.draw(browsing.ctx, () => '', null);
  for (const item of items) assert.ok(browsing.texts.includes(item.label), item.label);
  assert.equal(browsing.texts.filter((t) => t === 'Coming Soon').length, 1);
  assert.ok(browsing.texts.includes('Tap an egg.'));

  store.setState({ focused: 0 });
  const focused = recordingCtx();
  screen.draw(focused.ctx, () => '', null);
  assert.ok(focused.texts.includes('Bloodline one'));
  assert.ok(!focused.texts.includes('Tap an egg.'));
});

test('a focus change reaches the screen\'s subscriber, so the glass repaints', () => {
  const { store, screen } = screenWithStore();
  let repaints = 0;
  const unsubscribe = screen.subscribe(() => void repaints++);
  store.setState({ focused: 2 });
  unsubscribe();
  store.setState({ focused: 1 });
  assert.equal(repaints, 1);
});

test('with a panel, its buttons are hit targets that reach onAction, drawn below the slots', () => {
  const store = createStore<{ focused: number | null }>(() => ({ focused: 0 }));
  const actions: string[] = [];
  const screen = createChoiceScreen({
    title: 'Choose an egg', hint: 'Tap an egg.', comingSoon: 'Coming Soon', items,
    focused: () => store.getState().focused,
    subscribe: (onChange) => store.subscribe(onChange),
    onSelect: (i) => store.setState({ focused: i }),
    panel: () => ({
      heading: 'Metro Egg', meta: '#001', body: 'Each egg holds one Mon.',
      actions: [{ target: 'yes', label: 'Choose this egg', tone: 'primary' }, { target: 'no', label: 'Keep looking', tone: 'secondary' }],
    }),
    onAction: (target) => void actions.push(target),
  });
  const yes = choiceActionRect(0, 2);
  const no = choiceActionRect(1, 2);
  assert.ok(yes.y > CHOICE_ROW.y + CHOICE_ROW.height, 'buttons sit under the slot row');
  assert.ok(yes.x + yes.width < no.x && no.x + no.width <= HUD_SIZE.width);
  assert.equal(screen.hitTest(...uv(yes.x + 10, yes.y + 10)), 'yes');
  assert.equal(screen.hitTest(...uv(no.x + no.width - 10, no.y + no.height - 10)), 'no');
  screen.select('no');
  screen.select('F02');
  assert.deepEqual(actions, ['no']);
  assert.equal(store.getState().focused, 1, 'a slot target still focuses its egg');
  const drawn = recordingCtx();
  screen.draw(drawn.ctx, () => '', null);
  for (const text of ['Metro Egg', '#001', 'Choose this egg', 'Keep looking']) assert.ok(drawn.texts.includes(text), text);
});
