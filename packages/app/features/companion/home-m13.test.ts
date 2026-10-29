import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createInitialCareState } from '@acme/core/sim';
import type { CareState, MonInstance } from '@acme/core/types';
import {
  CHOOSE_CLOSE, CHOOSE_MORE, canChooseMon, chooserActions, chooserOptions, chooserPages, chosenFromTarget, closeMonChooser,
  nextChooserPage, openMonChooser, shouldAskOnOpen, useActiveMonChoice,
} from './active-mon-choice.ts';
import { COMPANION_COPY } from './copy.ts';
import { homeReaction, panRoom, ROOM_PAN_BOUND, ROOM_PAN_PT_PER_GLASS } from './home-model.ts';
import { MON_REACTIONS, reactionClipsFor } from './mon-models.ts';

const T0 = new Date(2026, 9, 28, 15, 0, 0).getTime();
const care = (patch: Partial<CareState> = {}): CareState => ({ ...createInitialCareState('mon-1', T0), energy: 0.8, fullness: 0.8, social: 0.8, ...patch });
const asleep = care({ activity: { kind: 'asleep', since: T0 } });

const nameOf = (m: MonInstance) => m.nickname ?? `form-${m.speciesId}`;

function mon(id: string, speciesId: string, nickname: string | null = null): MonInstance {
  return {
    monInstanceId: id, speciesId, nickname, callerId: 'caller-1', hatchedAt: T0, bond: 0, stage: 'Baby',
    gender: null, voiceLineageId: null, originBlock: null, habitatTags: [], activeHours: null,
  };
}

/** Clip names straight from the GLB's JSON chunk (apps/web/public/mons). */
function glbClips(file: string): Set<string> {
  const bytes = readFileSync(new URL(`../../../../apps/web/public/mons/${file}`, import.meta.url));
  const length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length).toString('utf8')) as { animations?: { name: string }[] };
  return new Set((json.animations ?? []).map((a) => a.name));
}

describe('M13 reaction clips (attention on tap, approach on resume)', () => {
  it('maps every reaction clip onto a clip that really is in the GLB', () => {
    const files: Record<number, string> = { 2: 'squeaklet.glb', 3: 'lil-ratti.glb' };
    for (const [dex, intents] of Object.entries(MON_REACTIONS)) {
      const clips = glbClips(files[Number(dex)]!);
      for (const list of Object.values(intents)) for (const clip of list ?? []) assert.ok(clips.has(clip), `${clip} missing from dex ${dex}`);
    }
  });
  it('neither GLB has a clip literally named attention or approach (why the table exists)', () => {
    for (const file of ['squeaklet.glb', 'lil-ratti.glb']) {
      const clips = glbClips(file);
      assert.equal(clips.has('attention'), false);
      assert.equal(clips.has('approach'), false);
    }
  });
  it("Lil' Ratti looks on a tap and waves on a return; Squeaklet has neither", () => {
    assert.deepEqual(reactionClipsFor(3, 'attention'), ['up_look_listen', 'emote_curious']);
    assert.deepEqual(reactionClipsFor(3, 'approach'), ['wave', 'emote_happy']);
    assert.equal(reactionClipsFor(2, 'attention'), null);
    assert.equal(reactionClipsFor(2, 'approach'), null);
    assert.equal(reactionClipsFor(null, 'attention'), null);
  });
  it('a tap plays attention where the form has it, else the nudge', () => {
    assert.deepEqual(homeReaction(3, care(), 'tap', T0), { kind: 'clip', intent: 'attention', clips: ['up_look_listen', 'emote_curious'] });
    assert.deepEqual(homeReaction(2, care(), 'tap', T0), { kind: 'nudge' });
    assert.deepEqual(homeReaction(3, undefined, 'tap', T0), { kind: 'nudge' });
  });
  it('a return plays approach where the form has it, else nothing (no jostle the Caller did not ask for)', () => {
    assert.deepEqual(homeReaction(3, care(), 'resume', T0), { kind: 'clip', intent: 'approach', clips: ['wave', 'emote_happy'] });
    assert.deepEqual(homeReaction(2, care(), 'resume', T0), { kind: 'none' });
  });
  it('a sleeping Mon plays neither (core deriveAnimationIntent: a tap never wakes it)', () => {
    assert.deepEqual(homeReaction(3, asleep, 'tap', T0), { kind: 'nudge' });
    assert.deepEqual(homeReaction(3, asleep, 'resume', T0), { kind: 'none' });
  });
});

describe('M13 room pan', () => {
  it('a drag right slides the view right (the Baby moves left), clamped to the renderer range', () => {
    assert.ok(panRoom(0, 32) < 0);
    assert.ok(panRoom(0, -32) > 0);
    assert.equal(panRoom(0, ROOM_PAN_PT_PER_GLASS * 10), -ROOM_PAN_BOUND);
    assert.equal(panRoom(0, -ROOM_PAN_PT_PER_GLASS * 10), ROOM_PAN_BOUND);
    assert.equal(panRoom(0.1, 0), 0.1);
  });
  it('a vertical drag (dx 0) does not move the room', () => {
    assert.equal(panRoom(0.2, 0), 0.2);
  });
});

describe('M13 active-Mon chooser (Decision #18)', () => {
  const two = [mon('mon_a', 'dex-002'), mon('mon_b', 'dex-003', 'Pip')];
  it('never shows with one Mon', () => {
    assert.equal(canChooseMon(1), false);
    assert.equal(shouldAskOnOpen(1, false), false);
    assert.equal(canChooseMon(0), false);
  });
  it('asks on open once per session with two Mons', () => {
    assert.equal(shouldAskOnOpen(2, false), true);
    assert.equal(shouldAskOnOpen(2, true), false);
  });
  it('lists every Mon by the name Home gives it, in save order', () => {
    const options = chooserOptions(two, nameOf);
    assert.deepEqual(options.map((o) => o.value), ['mon_a', 'mon_b']);
    assert.deepEqual(options.map((o) => o.label), ['form-dex-002', 'Pip']);
  });
  it('glass: every Mon plus Close when they fit; the active one reads as selected', () => {
    const actions = chooserActions(chooserOptions(two, nameOf), 'mon_b', 0);
    assert.deepEqual(actions.map((a) => a.target), ['choose:mon_a', 'choose:mon_b', CHOOSE_CLOSE]);
    assert.equal(actions[1]?.tone, 'selected');
    assert.equal(actions[0]?.tone, 'primary');
    assert.equal(actions[2]?.label, COMPANION_COPY['m14.close']);
  });
  it('glass: five Mons page two at a time with More and Close always present, wrapping', () => {
    const five = chooserOptions(['a', 'b', 'c', 'd', 'e'].map((id) => mon(id, 'dex-002', id.toUpperCase())), nameOf);
    assert.equal(chooserPages(5), 3);
    const pages = [0, 1, 2, 3].map((p) => chooserActions(five, 'a', p).map((a) => a.target));
    assert.deepEqual(pages[0], ['choose:a', 'choose:b', CHOOSE_MORE, CHOOSE_CLOSE]);
    assert.deepEqual(pages[2], ['choose:e', CHOOSE_MORE, CHOOSE_CLOSE]);
    assert.deepEqual(pages[3], pages[0]);
    for (const p of pages) assert.ok(p.length <= 4);
  });
  it('reads a Mon id back from its target, and nothing from More or Close', () => {
    assert.equal(chosenFromTarget('choose:mon_b'), 'mon_b');
    assert.equal(chosenFromTarget(CHOOSE_MORE), null);
    assert.equal(chosenFromTarget(CHOOSE_CLOSE), null);
  });
  it('session store: open, page, and any answer closes it for the session', () => {
    useActiveMonChoice.setState({ answered: false, open: false, page: 0 });
    openMonChooser();
    assert.equal(useActiveMonChoice.getState().open, true);
    nextChooserPage(5);
    assert.equal(useActiveMonChoice.getState().page, 1);
    closeMonChooser();
    assert.deepEqual(useActiveMonChoice.getState(), { answered: true, open: false, page: 0 });
    assert.equal(shouldAskOnOpen(2, useActiveMonChoice.getState().answered), false);
  });
  it('copy: chooser strings exist, no pronoun for the Mon, no "device"', () => {
    for (const id of ['m13.choose.title', 'm13.choose.body', 'm13.choose.more', 'm13.menu.switch', 'm13.choose.done', 'm13.choose.selected'] as const) {
      const text = COMPANION_COPY[id];
      assert.ok(text.length > 0);
      assert.doesNotMatch(text, /\b(he|she|him|her|his|hers|it|its)\b/i);
      assert.doesNotMatch(text, /device/i);
    }
  });
});
