import assert from 'node:assert/strict';
import test from 'node:test';
import { createStore } from 'zustand/vanilla';
import { W01_COPY } from './copy.ts';
import {
  DEFAULT_HUD_TAB, HUD_BANNED, HUD_SIZE, HUD_TAB_BAR, HUD_TABS, hudCaption, hudTabAt, hudTabRect, initialHudState,
  type HudContent,
} from './hlynk-hud.ts';
import { hudContent } from './hlynk-hud-content.ts';

const content: HudContent = hudContent();

/** Canvas px to screen UV, the inverse of what hudTabAt does. */
const uv = (x: number, y: number) => [x / HUD_SIZE.width, 1 - y / HUD_SIZE.height] as const;

test('the tabs are the creator\'s five, in order, and open on Crew', () => {
  assert.deepEqual([...HUD_TABS], ['dex', 'crew', 'care', 'bag', 'city']);
  assert.deepEqual(HUD_TABS.map((t) => content.tabs[t]), ['Dex', 'Crew', 'Care', 'Bag', 'City']);
  assert.equal(DEFAULT_HUD_TAB, 'crew');
  assert.deepEqual(initialHudState(), { tab: 'crew', hover: null, sound: true, presses: 0, taps: 0 });
});

test('each tab rect hit-tests to its own tab at its centre and inner corners', () => {
  HUD_TABS.forEach((tab, i) => {
    const r = hudTabRect(i);
    for (const [x, y] of [
      [r.x + r.width / 2, r.y + r.height / 2],
      [r.x + 1, r.y + 1],
      [r.x + r.width - 1, r.y + r.height - 1],
    ]) {
      assert.equal(hudTabAt(...uv(x, y)), tab, `${tab} at ${x},${y}`);
    }
  });
});

test('tab rects tile the bar with no gaps and stay inside the screen', () => {
  const last = hudTabRect(HUD_TABS.length - 1);
  assert.equal(hudTabRect(0).x, HUD_TAB_BAR.x);
  assert.equal(last.x + last.width, HUD_TAB_BAR.x + HUD_TAB_BAR.width);
  assert.ok(HUD_TAB_BAR.x + HUD_TAB_BAR.width <= HUD_SIZE.width);
  assert.ok(HUD_TAB_BAR.y + HUD_TAB_BAR.height <= HUD_SIZE.height);
  // Big enough to hit on a phone: the screen is ~0.8 of a ~300 px-wide model.
  assert.ok(hudTabRect(0).width >= 128 && HUD_TAB_BAR.height >= 96);
});

test('outside the tab bar nothing is hit', () => {
  for (const [x, y] of [
    [HUD_SIZE.width / 2, 100], // status row
    [HUD_SIZE.width / 2, HUD_SIZE.height / 2], // tab content
    [HUD_TAB_BAR.x - 1, HUD_TAB_BAR.y + 10], // left of the bar
    [HUD_TAB_BAR.x + HUD_TAB_BAR.width + 1, HUD_TAB_BAR.y + 10], // right of the bar
    [HUD_SIZE.width / 2, HUD_TAB_BAR.y - 1], // just above
    [HUD_SIZE.width / 2, HUD_SIZE.height], // bottom edge, below the bar
  ]) {
    assert.equal(hudTabAt(...uv(x, y)), null, `${x},${y}`);
  }
});

test('the default tab is the static screen: the first starter\'s Baby name and "Your Mon"', () => {
  assert.equal(content.mon, 'Squeaklet');
  assert.equal(content.note, 'Your Mon');
  assert.equal(hudCaption('crew', content), 'Crew: Squeaklet. Your Mon.');
});

test('Dex lists the three starters with their Dex numbers from @acme/content', () => {
  assert.equal(content.dex.length, 3);
  for (const entry of content.dex) assert.match(entry.no, /^No\. \d{3}$/);
  assert.equal(content.dex[0]?.name, 'Squeaklet');
  assert.equal(new Set(content.dex.map((d) => d.no)).size, 3);
});

test('Care shows Energy, Fullness and Social at the CARE section\'s example levels, labelled as examples', () => {
  assert.deepEqual(content.care.meters.map((m) => m.name), ['Energy', 'Fullness', 'Social']);
  for (const meter of content.care.meters) {
    const item = W01_COPY.care.items.find((i) => i.meter === meter.name);
    assert.equal(meter.value, item?.value, meter.name);
    assert.ok(meter.value >= 0 && meter.value <= 100);
  }
  assert.match(hudCaption('care', content), /Example levels, not a live reading\.$/);
  // No HP: an open canon question (Q41).
  assert.doesNotMatch(hudCaption('care', content), /\bHP\b/);
});

test('every caption starts with its tab label and stays clear of banned words', () => {
  for (const tab of HUD_TABS) {
    const caption = hudCaption(tab, content);
    assert.ok(caption.startsWith(`${content.tabs[tab]}: `), caption);
    assert.doesNotMatch(caption, HUD_BANNED, caption);
  }
});

test('no string on the screen or its controls uses a banned word', () => {
  const s = W01_COPY.hlynk.screen;
  const strings = [
    content.title, content.mon, content.note, content.bag, content.city.line, content.care.note,
    ...Object.values(content.tabs), ...content.city.districts, ...content.dex.map((d) => `${d.no} ${d.name}`),
    ...content.care.meters.map((m) => m.name), s.controlLabel, s.sideKey, s.sound,
  ];
  for (const str of strings) assert.doesNotMatch(str, HUD_BANNED, str);
  // The side key is named for what it does; "push to talk" is not canon.
  assert.doesNotMatch(s.sideKey, /push|talk|ptt/i);
});

test('the banned-word check catches what it should', () => {
  for (const bad of ['the device', 'a wild Mon', 'its Caller', 'they eat', 'catch them', 'Owner', 'capture it', 'user']) {
    assert.match(bad, HUD_BANNED, bad);
  }
  for (const ok of ['H-Lynk Core', 'Your Mon', 'Hood Mon', 'Midtown', 'City']) {
    assert.doesNotMatch(ok, HUD_BANNED, ok);
  }
});

test('one store carries the tab both ways: DOM writes reach a subscriber, and the screen writes back', () => {
  const store = createStore(initialHudState);
  const seen: string[] = [];
  const unsubscribe = store.subscribe((next, prev) => {
    if (next.tab !== prev.tab) seen.push(next.tab);
  });
  store.setState({ tab: 'care' }); // the radio group
  const hit = hudTabAt(...uv(hudTabRect(4).x + 10, hudTabRect(4).y + 10)); // a click on City in 3D
  if (hit) store.setState({ tab: hit });
  store.setState({ hover: 'dex' }); // hover alone does not change the tab
  unsubscribe();
  assert.deepEqual(seen, ['care', 'city']);
  assert.equal(store.getState().tab, 'city');
});
