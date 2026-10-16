// The lobby's panes on foldable and wide windows, run through the installed
// react-native-arrangement-view 0.4.0 policy (lib/module/arrange.js), the
// native backend's Android frames. Unit fixtures, not device evidence.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { primaryEdgeFor } from '../arrangement/backend.ts';
import { LOBBY_PRIMARY_SIDE, lobbyPaneArrangement } from './lobby-arrangement.ts';

interface Frame { left: number; top: number; width: number; height: number }
type Fold = { x: number; y: number; width: number; height: number; orientation: 'vertical' | 'horizontal'; separating: boolean; halfOpened: boolean };
type Arrange = (
  geometry: { width: number; height: number; window: { width: number; height: number }; fold?: Fold },
  options: { arrangement: 'split' | 'overlay'; axes: 'both'; primaryEdge?: 'leading' | 'trailing'; rtl?: boolean },
) => { primary: Frame; secondary: Frame | null };
const url = new URL('../node_modules/react-native-arrangement-view/lib/module/arrange.js', import.meta.url);
const { arrange } = (await import(fileURLToPath(url))) as { arrange: Arrange };

const run = (profile: Parameters<typeof lobbyPaneArrangement>[0], width: number, height: number, window: { width: number; height: number }, fold?: Fold, rtl = false) =>
  arrange({ width, height, window, fold }, { arrangement: lobbyPaneArrangement(profile), axes: 'both', primaryEdge: primaryEdgeFor(LOBBY_PRIMARY_SIDE, rtl), rtl });

// Spanned Duo, 1080 x 720 window, an 80 dp rail outside the lobby on the physical right.
const HOST = { w: 1000, h: 696 };
const WINDOW = { width: 1080, height: 720 };

for (const hinge of [0, 34]) {
  test(`Duo spanned, ${hinge} dp hinge at 540: resume + START right of the hinge, identity + rank left`, () => {
    const f = run('fold-book', HOST.w, HOST.h, WINDOW, { x: 540, y: 0, width: hinge, height: HOST.h, orientation: 'vertical', separating: true, halfOpened: false });
    assert.ok(f.secondary, 'identity + rank shown');
    assert.ok(f.secondary!.left + f.secondary!.width <= 540, 'identity + rank end before the hinge');
    assert.ok(f.primary.left >= 540 + hinge, 'START pane starts after the hinge, so START never crosses it');
    assert.ok(f.primary.left + f.primary.width <= HOST.w, 'START pane ends before the rail');
    // 44 pt targets: the START pane is far wider than the button's minimum.
    assert.ok(f.primary.width - 32 >= 44 && f.primary.height >= 44);
  });
}

test('RTL keeps resume + START physically right', () => {
  const f = run('fold-book', HOST.w, HOST.h, WINDOW, { x: 540, y: 0, width: 34, height: HOST.h, orientation: 'vertical', separating: true, halfOpened: false }, true);
  assert.ok(f.primary.left >= 540);
});

test('tabletop: identity + rank above the fold, resume + START below', () => {
  const f = run('fold-tabletop', 840, 900, { width: 840, height: 900 }, { x: 0, y: 440, width: 840, height: 0, orientation: 'horizontal', separating: true, halfOpened: true });
  assert.ok(f.secondary && f.secondary.top + f.secondary.height <= 440);
  assert.ok(f.primary.top >= 440);
});

test('regular width with no fold: side by side, START pane on the right', () => {
  const f = run('tablet', 1194, 790, { width: 1194, height: 834 });
  assert.ok(f.secondary && f.secondary.left === 0);
  assert.ok(f.primary.left >= f.secondary!.width);
});

test('compact windows show one pane: the lobby keeps its single column', () => {
  for (const [profile, w, h] of [['phone-portrait', 412, 860], ['phone-landscape', 915, 380], ['fold-outer', 320, 700]] as const) {
    const f = run(profile, w, h, { width: w, height: h + 32 });
    assert.equal(f.secondary, null, `${profile}: no companion pane`);
    assert.deepEqual(f.primary, { left: 0, top: 0, width: w, height: h });
  }
});
