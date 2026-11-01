import { describe, expect, it } from 'vitest';
import { careSentence, composerSubmit, mergeMonCard, monCard, percent } from '../src/client/companionMon.ts';

const mon = (over: object = {}) => ({
  monId: 'm1', name: null, speciesId: 'dex-003', stage: 'Small', bond: 0.4, hatchedAt: 1, gender: null, voice: null, ...over,
});
const care = (over: object = {}) => ({
  energy: 0.8, fullness: 0.62, social: 0.55, activity: 'awake', sluggish: false, wantsFood: false, lastFedAt: null, ...over,
});

describe('the Mon card', () => {
  it('reads name, form, stage, Bloodline and meters from get_mon_status', () => {
    const card = monCard({ structuredContent: { mon: mon({ name: 'Biscuit' }), care: care(), mood: 'content', needs: [] } });
    expect(card).toEqual({
      name: 'Biscuit', formName: 'Lil’ Ratti', dexId: 3, stage: 'Small', bloodline: 'Hood Ratti Bloodline',
      care: { energy: 0.8, fullness: 0.62, social: 0.55 }, needs: [], mood: 'content', asleep: false,
    });
  });

  it('uses the form name when the Caller has not named the Mon', () => {
    expect(monCard({ structuredContent: { mon: mon(), care: care({ activity: 'asleep' }), mood: 'asleep', needs: ['energy'] } }))
      .toMatchObject({ name: 'Lil’ Ratti', asleep: true, needs: ['energy'] });
  });

  it('ignores errors and results without a Mon', () => {
    expect(monCard({ isError: true, structuredContent: { mon: mon() } })).toBeNull();
    expect(monCard({ structuredContent: { incubating: false, eggs: [] } })).toBeNull();
    expect(monCard({ content: [] })).toBeNull();
  });

  it('keeps the last meters when a result carries the Mon but no care (check_on_mon)', () => {
    const before = monCard({ structuredContent: { mon: mon(), care: care(), mood: 'content', needs: [] } });
    const after = mergeMonCard(before, { structuredContent: { mon: mon(), mood: 'needs-social', needs: ['social'], suggestedCare: ['play'] } });
    expect(after).toMatchObject({ care: { energy: 0.8, fullness: 0.62, social: 0.55 }, mood: 'needs-social', needs: ['social'] });
    expect(mergeMonCard(before, { isError: true })).toBe(before);
  });

  it('rounds meters to whole percents and clamps them', () => {
    expect(percent(0.805)).toBe(81);
    expect(percent(1.4)).toBe(100);
    expect(percent(-1)).toBe(0);
  });
});

describe('care results as plain sentences', () => {
  const result = (sc: object) => ({ structuredContent: { mon: mon(), care: care(), mood: 'content', ...sc } });
  it.each([
    ['feed_mon', { applied: true, effect: 'eaten', care: care({ fullness: 0.81 }) }, 'Fed. Fullness is up to 81%.'],
    ['feed_mon', { applied: true, effect: 'overfed', care: care({ fullness: 1 }) }, 'Fed, but that was a lot. Fullness is at 100%, so food and play wait a while.'],
    ['rest_mon', { applied: true, effect: 'fell-asleep', care: care({ energy: 0.3 }) }, 'Resting now. Energy is at 30%.'],
    ['wake_mon', { applied: true, effect: 'woke' }, 'Awake. Energy is at 80%.'],
    ['wake_mon', { applied: true, effect: 'woke-early' }, 'Awake early. Energy is at 80%.'],
    ['play_with_mon', { applied: true, effect: 'played', care: care({ social: 0.9 }) }, 'Played. Social is up to 90%.'],
    ['feed_mon', { applied: false, declinedBecause: 'asleep' }, 'Didn’t feed: your Mon is asleep. Nothing changed.'],
    ['play_with_mon', { applied: false, declinedBecause: 'sluggish' }, 'Didn’t play: your Mon ate a lot and needs a break. Nothing changed.'],
    ['rest_mon', { applied: false, declinedBecause: 'already-asleep' }, 'Didn’t rest: your Mon is already asleep. Nothing changed.'],
    ['wake_mon', { applied: false, declinedBecause: 'already-awake' }, 'Didn’t wake: your Mon is already awake. Nothing changed.'],
    ['play_with_mon', { applied: false, declinedBecause: 'too-tired' }, 'Didn’t play: your Mon is too tired. Nothing changed.'],
  ] as const)('%s %j', (name, sc, text) => {
    expect(careSentence(name, result(sc) as never)).toBe(text);
  });

  it('reads a status check as the three meters', () => {
    expect(careSentence('get_mon_status', result({ needs: [] }) as never)).toBe('Checked in. Energy 80%, fullness 62%, social 55%.');
  });

  it('reads a mood-only check in plain words', () => {
    expect(careSentence('check_on_mon', { structuredContent: { mon: mon(), mood: 'needs-fullness', needs: ['fullness'], suggestedCare: ['feed'] } } as never))
      .toBe('Checked in. Your Mon is hungry.');
  });

  it('reads the egg and the hatch', () => {
    expect(careSentence('check_incubation', { structuredContent: { incubating: true, eggs: [{ eggId: 'e', speciesId: 'dex-001', incubationEndsAt: 0, minutesRemaining: 12, readyToHatch: false }] } } as never))
      .toBe('Checked the egg. It hatches in 12 minutes.');
    expect(careSentence('check_incubation', { structuredContent: { incubating: true, eggs: [{ eggId: 'e', speciesId: 'dex-001', incubationEndsAt: 0, minutesRemaining: 0, readyToHatch: true }] } } as never))
      .toBe('Checked the egg. It’s ready to hatch.');
    expect(careSentence('hatch_egg', { structuredContent: { hatched: true, alreadyHatched: false, hatching: true, egg: {}, mon: mon(), care: care(), mood: 'content' } } as never))
      .toBe('Hatched.');
  });

  it('stays honest about failures and unreadable answers', () => {
    expect(careSentence('feed_mon', { isError: true, content: [{ type: 'text', text: 'x' }] } as never)).toBe('Feeding failed. Nothing changed. Try again.');
    expect(careSentence('feed_mon', { structuredContent: { applied: 'true' } } as never)).toBe('Couldn’t read the answer to feeding, so it isn’t counted as done.');
    expect(careSentence('mystery_tool', { structuredContent: { mon: {} } } as never)).toBe('mystery_tool: checked.');
  });
});

describe('the composer', () => {
  it('sends the trimmed question when Enter is pressed and nothing is in flight', () => {
    expect(composerSubmit('  feed my Mon  ', false)).toBe('feed my Mon');
  });
  it('sends nothing for blank input or while a turn is running', () => {
    expect(composerSubmit('   ', false)).toBeNull();
    expect(composerSubmit('hi', true)).toBeNull();
  });
});
