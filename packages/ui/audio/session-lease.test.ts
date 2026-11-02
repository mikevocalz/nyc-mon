import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSessionLeases, type SessionCategory } from './session-lease.ts';

/** A fake AudioManager plus a manual clock. */
function harness(marginMs = 300, failApply = false) {
  const writes: SessionCategory[] = [];
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const leases = createSessionLeases({
    apply(category) {
      writes.push(category);
      if (failApply) throw new Error('session busy');
    },
    setTimer(fn, ms) {
      const id = nextId++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimer(handle) {
      timers.delete(handle as number);
    },
    marginMs,
  });
  const advance = (ms: number) => {
    const until = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].fn();
    }
    now = until;
  };
  return { leases, writes, advance };
}

describe('session leases', () => {
  it('switches to ambient on the first lease and back to playback after the last release plus margin', () => {
    const h = harness(300);
    const release = h.leases.acquire();
    assert.deepEqual(h.writes, ['ambient']);
    release();
    h.advance(299);
    assert.deepEqual(h.writes, ['ambient']);
    h.advance(1);
    assert.deepEqual(h.writes, ['ambient', 'playback']);
  });

  it('keeps ambient while any of several overlapping holds is live', () => {
    const h = harness(300);
    h.leases.hold(0.5);
    h.leases.hold(1.0);
    h.leases.hold(0.2);
    assert.deepEqual(h.writes, ['ambient']);
    h.advance(1000);
    assert.equal(h.leases.active(), 0);
    assert.deepEqual(h.writes, ['ambient']);
    h.advance(300);
    assert.deepEqual(h.writes, ['ambient', 'playback']);
  });

  it('a cue ending mid voice line does not restore playback under the line', () => {
    const h = harness(300);
    const voice = h.leases.acquire();
    h.leases.hold(0.75); // attention cue during the line
    h.advance(2000); // cue long over, voice still speaking
    assert.deepEqual(h.writes, ['ambient']);
    voice();
    h.advance(300);
    assert.deepEqual(h.writes, ['ambient', 'playback']);
  });

  it('a voice line ending does not cut a cue hold short', () => {
    const h = harness(300);
    const voice = h.leases.acquire();
    h.leases.hold(1.09); // evolve
    h.advance(100);
    voice();
    h.advance(500);
    assert.deepEqual(h.writes, ['ambient']);
    h.advance(990 + 300);
    assert.deepEqual(h.writes, ['ambient', 'playback']);
  });

  it('a lease taken inside the margin cancels the restore without re-writing ambient', () => {
    const h = harness(300);
    h.leases.hold(0.1);
    h.advance(250); // released at 100, restore due at 400
    h.leases.hold(0.1);
    h.advance(1000);
    assert.deepEqual(h.writes, ['ambient', 'playback']);
  });

  it('release is idempotent', () => {
    const h = harness(300);
    const a = h.leases.acquire();
    const b = h.leases.acquire();
    a();
    a();
    h.advance(1000);
    assert.equal(h.leases.active(), 1);
    assert.deepEqual(h.writes, ['ambient']);
    b();
    h.advance(300);
    assert.deepEqual(h.writes, ['ambient', 'playback']);
  });

  it('a failing session write never throws and never skews the count', () => {
    const h = harness(300, true);
    assert.doesNotThrow(() => h.leases.hold(0.2));
    h.advance(1000);
    assert.equal(h.leases.active(), 0);
    assert.deepEqual(h.writes, ['ambient', 'playback']);
  });
});
