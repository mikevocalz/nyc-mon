import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CARE_CUES,
  CARE_CUE_MAX_SECONDS,
  CARE_CUE_NOTES,
  CARE_CUE_NOTE_PEAK,
  CARE_CUE_REPEAT_WINDOW_MS,
  CARE_CUE_RESUME_WAIT_MS,
  createCareCuePlayer,
  cueSeconds,
  midiHz,
  scheduleCareCue,
  type CareCue,
} from './care-cues-core.ts';

/** A Web Audio stand-in that records what a cue schedules. */
function fakeContext(now = 1, state?: string) {
  const log: { kind: string; type?: string; freq: number[]; glide: number[]; start?: number; stop?: number; peaks: number[] }[] = [];
  const param = (into: number[], glideInto?: number[]) => ({
    setValueAtTime(v: number) { into.push(v); },
    exponentialRampToValueAtTime(v: number) { (glideInto ?? into).push(v); },
  });
  return {
    log,
    ctx: {
      currentTime: now,
      state,
      destination: { connect() {} },
      createGain() {
        const peaks: number[] = [];
        log.push({ kind: 'gain', freq: [], glide: [], peaks });
        return { gain: param(peaks), connect() {} };
      },
      createBiquadFilter() {
        const entry = { kind: 'filter', freq: [] as number[], glide: [] as number[], peaks: [] as number[] };
        log.push(entry);
        return { type: '', frequency: param(entry.freq), connect() {} };
      },
      createOscillator() {
        const entry: (typeof log)[number] = { kind: 'osc', freq: [], glide: [], peaks: [] };
        log.push(entry);
        return {
          set type(t: string) { entry.type = t; },
          get type() { return entry.type ?? 'sine'; },
          frequency: param(entry.freq, entry.glide),
          connect() {},
          start(when?: number) { entry.start = when; },
          stop(when?: number) { entry.stop = when; },
        };
      },
    },
  };
}

describe('care cue note tables', () => {
  it('covers exactly the seven cues of the contract', () => {
    assert.deepEqual([...CARE_CUES].sort(), ['attention', 'cancel', 'dose', 'evolve', 'flush', 'hatch', 'select']);
    for (const cue of CARE_CUES) assert.ok(CARE_CUE_NOTES[cue].length > 0, cue);
  });

  it('keeps every cue under the length cap', () => {
    for (const cue of CARE_CUES) {
      const s = cueSeconds(cue);
      assert.ok(s > 0 && s <= CARE_CUE_MAX_SECONDS, `${cue} is ${s}s`);
    }
    assert.ok(CARE_CUE_MAX_SECONDS <= 1.5);
  });

  it('uses only square and triangle voices with sane notes and levels', () => {
    for (const cue of CARE_CUES) {
      for (const n of CARE_CUE_NOTES[cue]) {
        assert.ok(n.wave === 'square' || n.wave === 'triangle', `${cue} wave ${n.wave}`);
        assert.ok(n.midi >= 36 && n.midi <= 108, `${cue} midi ${n.midi}`);
        assert.ok(n.start >= 0 && n.length >= 0.02, `${cue} timing`);
        assert.ok(n.level > 0 && n.level <= 1, `${cue} level`);
        if (n.glideTo !== undefined) assert.ok(n.glideTo >= 36 && n.glideTo <= 108);
      }
    }
  });

  it('never stacks voices louder than one full chirp note', () => {
    for (const cue of CARE_CUES) {
      const notes = CARE_CUE_NOTES[cue];
      for (const a of notes) {
        const sounding = notes.filter((b) => b.start <= a.start && b.start + b.length > a.start);
        const sum = sounding.reduce((s, b) => s + b.level, 0);
        assert.ok(sum <= 1 + 1e-9, `${cue} at ${a.start}s sums ${sum}`);
      }
    }
  });

  it('select and cancel are short ticks; cancel falls, select does not', () => {
    assert.ok(cueSeconds('select') <= 0.12);
    assert.ok(cueSeconds('cancel') <= 0.15);
    const cancel = CARE_CUE_NOTES.cancel;
    assert.ok(cancel[cancel.length - 1]!.midi < cancel[0]!.midi);
  });

  it('evolve is a rising arpeggio ending on its highest note', () => {
    const notes = CARE_CUE_NOTES.evolve;
    assert.ok(notes.length >= 8);
    const top = Math.max(...notes.map((n) => n.midi));
    assert.equal(notes[notes.length - 1]!.midi, top);
    assert.ok(notes[notes.length - 1]!.midi > notes[0]!.midi + 12);
  });

  it('attention is a few two-tone beeps, never a loop', () => {
    const notes = CARE_CUE_NOTES.attention;
    const pitches = new Set(notes.map((n) => n.midi));
    assert.equal(pitches.size, 2);
    assert.ok(notes.length >= 4 && notes.length <= 8);
  });

  it('flush glides down', () => {
    assert.ok(CARE_CUE_NOTES.flush.some((n) => n.glideTo !== undefined && n.glideTo < n.midi));
  });

  it('the chirp reports its own length from its tone table', async () => {
    const { chirpSeconds } = await import('../three/hlynk/chirp-core.ts');
    assert.ok(Math.abs(chirpSeconds() - 0.14) < 1e-9);
  });

  it('midiHz maps A4 to 440 and an octave to a doubling', () => {
    assert.equal(midiHz(69), 440);
    assert.ok(Math.abs(midiHz(81) - 880) < 1e-9);
  });
});

describe('scheduleCareCue', () => {
  it('schedules one oscillator per note, from now, through a lowpass, at the chirp level', () => {
    for (const cue of CARE_CUES) {
      const { ctx, log } = fakeContext(2);
      const seconds = scheduleCareCue(ctx, cue);
      assert.equal(seconds, cueSeconds(cue));
      const oscs = log.filter((e) => e.kind === 'osc');
      assert.equal(oscs.length, CARE_CUE_NOTES[cue].length, cue);
      oscs.forEach((o, i) => {
        const n = CARE_CUE_NOTES[cue][i]!;
        assert.equal(o.type, n.wave);
        assert.equal(o.start, 2 + n.start);
        assert.ok(o.stop! > o.start! && o.stop! <= 2 + cueSeconds(cue) + 1e-9);
        assert.ok(Math.abs(o.freq[0]! - midiHz(n.midi)) < 1e-6);
        if (n.glideTo !== undefined) assert.ok(Math.abs(o.glide[0]! - midiHz(n.glideTo)) < 1e-6);
      });
      assert.equal(log.filter((e) => e.kind === 'filter').length, 1);
      const gates = log.filter((e) => e.kind === 'gain').slice(1);
      for (const g of gates) assert.ok(Math.max(...g.peaks) <= CARE_CUE_NOTE_PEAK);
    }
  });
});

describe('createCareCuePlayer', () => {
  it('short-circuits when sound is off: no context, no session change, nothing scheduled', () => {
    let contextAsked = 0;
    let held = 0;
    const play = createCareCuePlayer({
      enabled: () => false,
      context: () => { contextAsked++; return fakeContext().ctx; },
      holdSession: () => { held++; },
    });
    for (const cue of CARE_CUES) play(cue);
    assert.equal(contextAsked, 0);
    assert.equal(held, 0);
  });

  it('plays when sound is on', () => {
    const fake = fakeContext();
    const play = createCareCuePlayer({ enabled: () => true, context: () => fake.ctx });
    play('evolve');
    assert.equal(fake.log.filter((e) => e.kind === 'osc').length, CARE_CUE_NOTES.evolve.length);
  });

  it('reads the switch at call time, not at creation', () => {
    let on = false;
    const fake = fakeContext();
    const play = createCareCuePlayer({ enabled: () => on, context: () => fake.ctx });
    play('select');
    assert.equal(fake.log.length, 0);
    on = true;
    play('select');
    assert.ok(fake.log.length > 0);
  });

  it('is silent, not throwing, when there is no audio context or it throws', () => {
    assert.doesNotThrow(() => createCareCuePlayer({ enabled: () => true, context: () => null })('hatch'));
    assert.doesNotThrow(() =>
      createCareCuePlayer({ enabled: () => true, context: () => { throw new Error('no audio'); } })('hatch'),
    );
  });

  it('takes the session lease before it asks for the context', () => {
    const order: string[] = [];
    const play = createCareCuePlayer({
      enabled: () => true,
      holdSession: () => order.push('session'),
      context: () => { order.push('context'); return fakeContext().ctx; },
    });
    play('hatch');
    assert.deepEqual(order, ['session', 'context']);
  });

  it('holds the session for the cue plus the resume wait', () => {
    const held: number[] = [];
    const play = createCareCuePlayer({ enabled: () => true, holdSession: (s) => held.push(s), context: () => fakeContext().ctx });
    play('attention');
    assert.deepEqual(held, [cueSeconds('attention') + CARE_CUE_RESUME_WAIT_MS / 1000]);
  });

  it('drops a repeat of the attention call inside the window and plays it after', () => {
    let t = 0;
    const fake = fakeContext();
    const oscs = () => fake.log.filter((e) => e.kind === 'osc').length;
    const play = createCareCuePlayer({ enabled: () => true, context: () => fake.ctx, now: () => t });
    play('attention');
    const once = oscs();
    t = 2999;
    play('attention'); // a re-render or remount
    assert.equal(oscs(), once);
    t = 3000;
    play('attention');
    assert.equal(oscs(), once * 2);
    assert.equal(CARE_CUE_REPEAT_WINDOW_MS.attention, 3000);
  });

  it('never drops press ticks, and the window is configurable per cue', () => {
    const fake = fakeContext();
    const oscs = () => fake.log.filter((e) => e.kind === 'osc').length;
    const play = createCareCuePlayer({ enabled: () => true, context: () => fake.ctx, now: () => 0, repeatWindowMs: { attention: 0 } });
    play('select');
    play('select');
    play('dose');
    play('dose');
    play('attention');
    play('attention');
    assert.equal(oscs(), 2 * 1 + 2 * CARE_CUE_NOTES.dose.length + 2 * CARE_CUE_NOTES.attention.length);
  });

  it('resumes a suspended context and schedules from the resumed clock', async () => {
    const fake = fakeContext(5, 'suspended');
    const ctx = Object.assign(fake.ctx, {
      async resume() {
        ctx.state = 'running';
        ctx.currentTime = 9;
      },
    });
    const play = createCareCuePlayer({ enabled: () => true, context: () => ctx, wait: () => new Promise(() => {}) });
    play('select');
    assert.equal(fake.log.length, 0, 'nothing scheduled on the frozen clock');
    await new Promise((r) => setTimeout(r, 0));
    const osc = fake.log.find((e) => e.kind === 'osc');
    assert.equal(osc?.start, 9);
  });

  it('drops the cue when the context will not resume in time, or is closed', async () => {
    const stuck = fakeContext(1, 'suspended');
    const stuckCtx = Object.assign(stuck.ctx, { resume: () => new Promise<void>(() => {}) });
    createCareCuePlayer({ enabled: () => true, context: () => stuckCtx, wait: () => Promise.resolve() })('select');
    const closed = fakeContext(1, 'closed');
    createCareCuePlayer({ enabled: () => true, context: () => closed.ctx })('select');
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(stuck.log.length, 0);
    assert.equal(closed.log.length, 0);
  });

  it('warns in development when scheduling fails, and still does not throw', () => {
    const g = globalThis as { __DEV__?: boolean };
    const before = g.__DEV__;
    const original = console.warn;
    const warnings: unknown[] = [];
    g.__DEV__ = true;
    console.warn = (...args: unknown[]) => { warnings.push(args[0]); };
    try {
      const fake = fakeContext();
      const broken = { ...fake.ctx, createOscillator() { throw new TypeError('api mismatch'); } };
      assert.doesNotThrow(() => createCareCuePlayer({ enabled: () => true, context: () => broken })('hatch'));
      assert.equal(warnings.length, 1);
      // A missing context is environmental: no warning.
      createCareCuePlayer({ enabled: () => true, context: () => { throw new Error('no audio'); } })('hatch');
      assert.equal(warnings.length, 1);
    } finally {
      console.warn = original;
      g.__DEV__ = before;
    }
  });

  it('ignores an unknown cue name from untyped callers', () => {
    const fake = fakeContext();
    const play = createCareCuePlayer({ enabled: () => true, context: () => fake.ctx });
    assert.doesNotThrow(() => play('fanfare' as CareCue));
    assert.equal(fake.log.length, 0);
  });
});

describe('web playCareCue', () => {
  it('is a no-op in a runtime without Web Audio and when sound is off', async () => {
    const { playCareCue } = await import('./care-cues.ts');
    const { setKitPreferences } = await import('../device-preferences.ts');
    assert.doesNotThrow(() => playCareCue('attention'));
    setKitPreferences({ sound: false });
    assert.doesNotThrow(() => playCareCue('attention'));
    setKitPreferences({ sound: true });
  });
});
