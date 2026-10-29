import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BABY_TALK_MS, type VoiceStageSubject } from '@acme/core';
import {
  AMBIENT_BABBLE_MAX_MS,
  AMBIENT_BABBLE_MIN_MS,
  ambientBabbleActive,
  ambientBabbleDelayMs,
  startAmbientBabble,
} from './ambient-babble.ts';

const T0 = Date.UTC(2026, 9, 29, 12, 0, 0);

/** A hand-driven clock and timer: `advance(ms)` fires every timer due by then, in order. */
function fakeTime(start = T0) {
  let now = start;
  let timers: { at: number; fire: () => void; id: number }[] = [];
  let nextId = 0;
  return {
    now: () => now,
    setTimer: (ms: number, fire: () => void) => {
      const id = nextId++;
      timers.push({ at: now + ms, fire, id });
      return () => {
        timers = timers.filter((t) => t.id !== id);
      };
    },
    pending: () => timers.length,
    nextAt: () => Math.min(...timers.map((t) => t.at)),
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const due = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
        if (due === undefined) break;
        timers = timers.filter((t) => t.id !== due.id);
        now = due.at;
        due.fire();
      }
      now = end;
    },
  };
}

function run(subject: VoiceStageSubject | undefined, opts: { canSpeak?: () => boolean; start?: number } = {}) {
  const time = fakeTime(opts.start);
  const said: string[] = [];
  const stop = startAmbientBabble({
    subject: () => subject,
    now: time.now,
    setTimer: time.setTimer,
    canSpeak: opts.canSpeak ?? (() => true),
    babble: (seed) => said.push(seed),
    seed: 'mon_1',
  });
  return { time, said, stop };
}

const egg: VoiceStageSubject = { stage: 'Egg', hatchedAt: null };
const newBaby: VoiceStageSubject = { stage: 'Baby', hatchedAt: T0 - 60_000 };

describe('ambientBabbleDelayMs', () => {
  it('stays in 45 to 90 s and is the same for the same seed and turn', () => {
    const gaps = Array.from({ length: 200 }, (_, i) => ambientBabbleDelayMs('mon_1', i));
    for (const gap of gaps) {
      assert.ok(gap >= AMBIENT_BABBLE_MIN_MS && gap <= AMBIENT_BABBLE_MAX_MS, String(gap));
    }
    assert.equal(ambientBabbleDelayMs('mon_1', 3), ambientBabbleDelayMs('mon_1', 3));
    assert.ok(new Set(gaps).size > 20, 'the gap is jittered');
  });
});

describe('ambientBabbleActive', () => {
  it('is on for an Egg and a Baby in its first day, off after 24 h and for later stages', () => {
    assert.equal(ambientBabbleActive(egg, T0), true);
    assert.equal(ambientBabbleActive(newBaby, T0), true);
    assert.equal(ambientBabbleActive(newBaby, T0 - 60_000 + BABY_TALK_MS), false);
    assert.equal(ambientBabbleActive({ stage: 'Small', hatchedAt: T0 }, T0), false);
  });
});

describe('startAmbientBabble', () => {
  it('babbles once per jittered gap, never sooner than 45 s', () => {
    const { time, said } = run(egg);
    time.advance(AMBIENT_BABBLE_MIN_MS - 1);
    assert.equal(said.length, 0);
    time.advance(AMBIENT_BABBLE_MAX_MS);
    assert.ok(said.length >= 1 && said.length <= 2, String(said.length));
    assert.equal(said[0], 'mon_1|ambient|0');
  });

  it('first turn lands exactly at the seeded gap', () => {
    const { time, said } = run(egg);
    time.advance(ambientBabbleDelayMs('mon_1', 0) - 1);
    assert.equal(said.length, 0);
    time.advance(1);
    assert.equal(said.length, 1);
  });

  it('skips a turn while it cannot speak (Sound off, a line playing, a voice session), and does not queue it', () => {
    let can = false;
    const { time, said } = run(egg, { canSpeak: () => can });
    time.advance(ambientBabbleDelayMs('mon_1', 0));
    assert.equal(said.length, 0);
    can = true;
    // Nothing fires the moment it may speak again: the skipped turn is gone.
    time.advance(1_000);
    assert.equal(said.length, 0);
    time.advance(ambientBabbleDelayMs('mon_1', 1));
    assert.deepEqual(said, ['mon_1|ambient|1']);
  });

  it('stop() cancels the pending turn (blur, unmount, background)', () => {
    const { time, said, stop } = run(egg);
    stop();
    assert.equal(time.pending(), 0);
    time.advance(10 * AMBIENT_BABBLE_MAX_MS);
    assert.equal(said.length, 0);
  });

  it('never starts for a Mon past its first day, or with no Mon', () => {
    assert.equal(run({ stage: 'Baby', hatchedAt: T0 - BABY_TALK_MS }).time.pending(), 0);
    assert.equal(run({ stage: 'Mid', hatchedAt: T0 }).time.pending(), 0);
    assert.equal(run(undefined).time.pending(), 0);
  });

  it('stops when the Baby passes 24 h, waking at that moment rather than a gap later', () => {
    const endsAt = T0 + 20_000;
    const baby: VoiceStageSubject = { stage: 'Baby', hatchedAt: endsAt - BABY_TALK_MS };
    const { time, said } = run(baby);
    // The first gap (>= 45 s) runs past the end: the scheduler wakes at the end instead.
    assert.equal(time.nextAt(), endsAt);
    time.advance(20_000);
    assert.equal(time.pending(), 0);
    time.advance(10 * AMBIENT_BABBLE_MAX_MS);
    assert.equal(said.length, 0);
  });

  it('a first-day Baby babbles until 24 h, then goes quiet for good', () => {
    const baby: VoiceStageSubject = { stage: 'Baby', hatchedAt: T0 - BABY_TALK_MS + 5 * 60_000 };
    const { time, said } = run(baby);
    time.advance(60 * 60_000);
    const before = said.length;
    assert.ok(before >= 2 && before <= 6, String(before));
    assert.equal(time.pending(), 0);
  });
});
