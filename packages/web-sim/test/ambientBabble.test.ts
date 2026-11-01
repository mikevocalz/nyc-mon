import { describe, expect, it, vi } from 'vitest';
import { babbleInventory } from '@acme/content/voice';
import { BABY_TALK_MS, isBabble } from '@acme/core';
import { AMBIENT_MAX_MS, AMBIENT_MIN_MS, ambientBabbleLine, ambientDelay, startAmbientBabble, type AmbientBabbleDeps } from '../src/client/ambientBabble.ts';
import type { MonVoice } from '../src/client/monVoice.ts';

const EGG: MonVoice = { lineageId: 'dex-001/female/1', stage: 'Egg', voiceStage: 'baby-talk' };
const SMALL: MonVoice = { lineageId: 'dex-001/female/1', stage: 'Small', voiceStage: 'full' };
const NOW = Date.UTC(2026, 9, 29, 12);

/** A hand-cranked timer: `fire()` runs the one pending callback. */
function clock() {
  let pending: { fn: () => void; ms: number } | null = null;
  return {
    setTimer: (fn: () => void, ms: number) => { pending = { fn, ms }; return 1; },
    clearTimer: vi.fn(() => { pending = null; }),
    pendingMs: () => pending?.ms ?? null,
    fire() {
      const p = pending;
      pending = null;
      p?.fn();
    },
  };
}

function start(over: Partial<AmbientBabbleDeps> = {}) {
  const c = clock();
  const said: string[] = [];
  const stop = startAmbientBabble({
    voice: () => EGG, hatchedAt: () => undefined, quiet: () => false, muted: () => false,
    say: (line) => said.push(line), now: () => NOW, random: () => 0.5, setTimer: c.setTimer, clearTimer: c.clearTimer, ...over,
  });
  return { c, said, stop };
}

describe('ambient babble', () => {
  it('waits 45 to 90 s with jitter between lines', () => {
    expect(ambientDelay(() => 0)).toBe(AMBIENT_MIN_MS);
    expect(ambientDelay(() => 0.999999)).toBeLessThan(AMBIENT_MAX_MS + 1);
    expect(ambientDelay(() => 0.5)).toBe(AMBIENT_MIN_MS + (AMBIENT_MAX_MS - AMBIENT_MIN_MS) / 2);
    const { c } = start();
    expect(c.pendingMs()).toBe(ambientDelay(() => 0.5));
  });

  it('an Egg babbles one scripted line per tick, never a word, and a different line next time', () => {
    const { c, said } = start();
    c.fire();
    c.fire();
    expect(said).toHaveLength(2);
    const inv = babbleInventory({ lineageId: EGG.lineageId }, 'Egg');
    for (const line of said) expect(isBabble(line, inv)).toBe(true);
    expect(said[0]).toBe(ambientBabbleLine(EGG, 0));
    expect(said[1]).toBe(ambientBabbleLine(EGG, 1));
  });

  it('stays quiet while muted, while the Mon or the Caller is talking, and for a Mon that talks', () => {
    for (const over of [{ muted: () => true }, { quiet: () => true }, { voice: () => SMALL }, { voice: () => undefined }] as Partial<AmbientBabbleDeps>[]) {
      const { c, said } = start(over);
      c.fire();
      expect(said).toEqual([]);
      // It keeps checking: the next tick is scheduled.
      expect(c.pendingMs()).not.toBeNull();
    }
  });

  it('a Baby babbles in its first day and stops when the day ends', () => {
    const baby: MonVoice = { lineageId: 'dex-001/female/1', stage: 'Baby', voiceStage: 'baby-talk' };
    let now = NOW;
    const { c, said } = start({ voice: () => baby, hatchedAt: () => NOW - 1000, now: () => now });
    c.fire();
    now = NOW + BABY_TALK_MS;
    c.fire();
    expect(said).toHaveLength(1);
  });

  it('stops on unmount', () => {
    const { c, said, stop } = start();
    stop();
    expect(c.clearTimer).toHaveBeenCalled();
    c.fire();
    expect(said).toEqual([]);
    expect(c.pendingMs()).toBeNull();
  });
});
