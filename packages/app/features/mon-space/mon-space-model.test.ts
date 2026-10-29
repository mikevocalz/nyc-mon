import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MonCareView } from '@acme/core/sim';
import { COMPANION_COPY } from '../companion/copy.ts';
import {
  ANSWER_ICON, MON_SPACE_ICONS, ageLine, callCopy, dosesLine, feedbackFor, iconCopy, iconDisabled, iconIndex, initialUi,
  intentFor, keyFromKeyboard, lampFor, lcdField, newCall, poopLine, pressKey, statusLine, tapIcon,
} from './mon-space-model.ts';

const VIEW: MonCareView = {
  hearts: { fullness: 3, social: 2, energy: 4 },
  poop: 0,
  cold: null,
  discipline: 1,
  weight: 5,
  asleep: false,
  lights: 'on',
  paused: false,
  call: null,
  attention: 'none',
  ageDays: 2,
  stage: 'Baby',
};
const view = (patch: Partial<MonCareView>): MonCareView => ({ ...VIEW, ...patch });
const call = (kind: NonNullable<MonCareView['call']>['kind'], openedAt = 1) => ({ kind, openedAt, msLeft: 60_000 });

describe('M32 icon loop (A cycles, B selects, C cancels)', () => {
  it('A wraps both ways through all nine icons in the fixed order', () => {
    assert.deepEqual([...MON_SPACE_ICONS], ['meal', 'snack', 'play', 'lights', 'clean', 'medicine', 'boundary', 'status', 'pause']);
    let ui = initialUi(VIEW);
    assert.equal(ui.focus, 0);
    for (let i = 0; i < 9; i++) ui = pressKey(ui, 'next').ui;
    assert.equal(ui.focus, 0);
    assert.equal(pressKey(ui, 'prev').ui.focus, 8);
  });

  it('B acts on the focused icon; C leaves from the bar', () => {
    const ui = { focus: iconIndex('clean'), layer: 'bar' as const };
    assert.deepEqual(pressKey(ui, 'select').effect, { kind: 'act', icon: 'clean' });
    assert.deepEqual(pressKey(ui, 'cancel').effect, { kind: 'exit' });
  });

  it('C backs out of the status page and the pause confirm one level; B on the confirm pauses', () => {
    const status = { focus: iconIndex('status'), layer: 'status' as const };
    assert.deepEqual(pressKey(status, 'cancel'), { ui: { ...status, layer: 'bar' }, effect: { kind: 'closed' } });
    const confirm = { focus: iconIndex('pause'), layer: 'pause-confirm' as const };
    assert.deepEqual(pressKey(confirm, 'select').effect, { kind: 'act', icon: 'pause' });
    assert.equal(pressKey(confirm, 'cancel').effect.kind, 'closed');
  });

  it('a tap on an icon moves the cursor there and acts at once', () => {
    const r = tapIcon(initialUi(VIEW), 'medicine');
    assert.equal(r.ui.focus, iconIndex('medicine'));
    assert.deepEqual(r.effect, { kind: 'act', icon: 'medicine' });
  });

  it('opens on the icon that answers the open call, so one B answers it', () => {
    for (const [kind, icon] of Object.entries(ANSWER_ICON)) {
      const ui = initialUi(view({ call: call(kind as keyof typeof ANSWER_ICON) }));
      assert.equal(MON_SPACE_ICONS[ui.focus], icon, kind);
      assert.equal(intentFor(icon, view({ call: call(kind as keyof typeof ANSWER_ICON) })).kind === 'explain', false);
    }
    assert.equal(MON_SPACE_ICONS[initialUi(view({ paused: true })).focus], 'pause');
  });

  it('maps the hardware keyboard', () => {
    assert.equal(keyFromKeyboard('ArrowRight'), 'next');
    assert.equal(keyFromKeyboard('ArrowUp'), 'prev');
    assert.equal(keyFromKeyboard('Enter'), 'select');
    assert.equal(keyFromKeyboard(' '), 'select');
    assert.equal(keyFromKeyboard('Escape'), 'cancel');
    assert.equal(keyFromKeyboard('q'), null);
  });
});

describe('M32 intents', () => {
  it('lights puts an awake Mon to bed, turns the lights back on when off', () => {
    assert.deepEqual(intentFor('lights', VIEW), { kind: 'lights-off', alsoRest: true });
    assert.deepEqual(intentFor('lights', view({ asleep: true })), { kind: 'lights-off', alsoRest: false });
    assert.deepEqual(intentFor('lights', view({ lights: 'off', asleep: true })), { kind: 'lights-on' });
  });

  it('pause confirms first; while paused only Resume acts and the rest explain', () => {
    assert.deepEqual(intentFor('pause', VIEW), { kind: 'confirm-pause' });
    const paused = view({ paused: true });
    assert.deepEqual(intentFor('pause', paused), { kind: 'resume' });
    for (const icon of MON_SPACE_ICONS.filter((i) => i !== 'pause')) {
      assert.deepEqual(intentFor(icon, paused), { kind: 'explain', copy: 'monspace.decline.paused' }, icon);
      assert.equal(iconDisabled(icon, paused), true, icon);
    }
    assert.equal(iconDisabled('pause', paused), false);
  });

  it('clean with no piles explains and is greyed; medicine and boundary always go to the sim', () => {
    assert.deepEqual(intentFor('clean', VIEW), { kind: 'explain', copy: 'monspace.decline.nothing_to_clean' });
    assert.equal(iconDisabled('clean', VIEW), true);
    assert.deepEqual(intentFor('clean', view({ poop: 2 })), { kind: 'clean' });
    assert.deepEqual(intentFor('medicine', VIEW), { kind: 'medicine' });
    assert.deepEqual(intentFor('boundary', VIEW), { kind: 'boundary' });
    assert.deepEqual(intentFor('play', VIEW), { kind: 'peek' });
    assert.equal(intentFor('play', view({ asleep: true })).kind, 'explain');
  });

  it('labels flip for lights and pause', () => {
    assert.equal(iconCopy('lights', VIEW).label, 'monspace.menu.lights_off');
    assert.equal(iconCopy('lights', view({ lights: 'off' })).label, 'monspace.menu.lights_on');
    assert.equal(iconCopy('pause', view({ paused: true })).label, 'monspace.menu.resume');
  });
});

describe('M32 status, lamp and feedback', () => {
  it('the lamp is dark while paused and lights for a false call like a real one', () => {
    assert.equal(lampFor(view({ attention: 'call' })), 'call');
    assert.equal(lampFor(view({ attention: 'false-call' })), 'false-call');
    assert.equal(lampFor(view({ attention: 'call', paused: true })), 'off');
    assert.equal(COMPANION_COPY[callCopy('false-call')], 'Calling for you');
  });

  it('status line: pause outranks a call, a call outranks lights out', () => {
    assert.equal(statusLine(view({ paused: true, call: call('hunger') })).copy, 'monspace.status.paused');
    assert.equal(statusLine(view({ call: call('hunger'), lights: 'off', asleep: true })).copy, 'monspace.call.hunger');
    assert.equal(statusLine(view({ lights: 'off', asleep: true })).copy, 'monspace.status.lights_out');
    assert.equal(statusLine(view({ cold: { dosesRemaining: 2 } })).copy, 'monspace.status.cold');
    assert.equal(statusLine(VIEW).copy, 'monspace.status.content');
  });

  it('counts read in words with singular and plural', () => {
    assert.equal(poopLine(0), null);
    assert.equal(poopLine(1)?.copy, 'monspace.status.poop.one');
    assert.deepEqual(poopLine(3), { copy: 'monspace.status.poop.many', tokens: { count: 3 } });
    assert.equal(dosesLine({ dosesRemaining: 1 })?.copy, 'monspace.status.cold.doses.one');
    assert.deepEqual(ageLine(4), { copy: 'monspace.status.age.many', tokens: { days: 4 } });
    assert.equal(ageLine(1).copy, 'monspace.status.age.one');
  });

  it('a call is new once, not on every tick', () => {
    const c = call('energy', 100);
    assert.deepEqual(newCall(null, c), c);
    assert.equal(newCall(c, { ...c, msLeft: 10 }), null);
    assert.deepEqual(newCall(c, call('energy', 200)), call('energy', 200));
    assert.equal(newCall(c, null), null);
  });

  it('feedback names the action and never blames', () => {
    assert.equal(feedbackFor({ kind: 'eaten' }, { kind: 'snack' }).copy, 'monspace.result.snack');
    assert.equal(feedbackFor({ kind: 'cleaned', piles: 3 }, { kind: 'clean' }).cue, 'flush');
    assert.deepEqual(feedbackFor({ kind: 'dosed', remaining: 2 }, { kind: 'medicine' }).tokens, { count: 2 });
    assert.equal(feedbackFor({ kind: 'declined', reason: 'has-cold' }, { kind: 'snack' }).copy, 'monspace.decline.cold');
    assert.equal(feedbackFor({ kind: 'nothing-to-discipline' }, { kind: 'boundary' }).copy, 'monspace.decline.no_false_call');
  });

  it('every monspace string avoids the banned words (D20e, Law 8, COPY_DECK)', () => {
    const banned = /\b(sick|dead|died|death|killed|neglect\w*|punish\w*|scold\w*|mistakes?|missed|overweight|underweight|fat)\b/i;
    for (const [id, text] of Object.entries(COMPANION_COPY)) {
      if (id.startsWith('monspace.')) assert.doesNotMatch(text, banned, id);
    }
  });

  it('the LCD field inverts for lights out and caps piles at 4', () => {
    assert.equal(lcdField(view({ lights: 'off' })).inverted, true);
    assert.equal(lcdField(view({ poop: 7 as 4 })).piles, 4);
    assert.equal(lcdField(view({ call: call('cold'), paused: true })).callGlyph, false);
  });
});
