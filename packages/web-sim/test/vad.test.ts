import { describe, expect, it } from 'vitest';
import { createVad, pcmRms } from '../src/client/vad.ts';

/** Feeds 20 ms frames of one level from `from` for `ms`; returns the events with their times. */
function feed(vad: ReturnType<typeof createVad>, from: number, ms: number, rms: number, playingSince: number | null = null) {
  const events: [string, number][] = [];
  for (let at = from; at < from + ms; at += 20) {
    const e = vad.update({ rms, at, playingSince });
    if (e) events.push([e, at]);
  }
  return events;
}

const QUIET = 0.003;
const TALK = 0.08;

describe('voice activity: energy threshold with attack and hold', () => {
  it('never fires in a quiet room', () => {
    expect(feed(createVad(), 0, 5000, QUIET)).toEqual([]);
  });

  it('fires once speech has stayed above the threshold for the attack window, dated from the first loud frame', () => {
    const vad = createVad({ attackMs: 60 });
    feed(vad, 0, 200, QUIET);
    const events = feed(vad, 200, 400, TALK);
    expect(events).toEqual([['speech-start', 260]]);
    expect(vad.onsetAt).toBe(200);
    expect(vad.speaking).toBe(true);
  });

  it('ignores a click shorter than the attack window', () => {
    const vad = createVad({ attackMs: 60 });
    expect([...feed(vad, 0, 40, TALK), ...feed(vad, 40, 1000, QUIET)]).toEqual([]);
  });

  it('holds through short pauses and dips, and ends after the hold window of quiet', () => {
    const vad = createVad({ threshold: 0.02, attackMs: 60, holdMs: 500, releaseRatio: 0.5 });
    feed(vad, 0, 300, TALK);
    // A dip below the start threshold but above the release level keeps it going.
    expect(feed(vad, 300, 600, 0.015)).toEqual([]);
    // A gap shorter than the hold does not end it.
    expect(feed(vad, 900, 300, QUIET)).toEqual([]);
    feed(vad, 1200, 100, TALK);
    const end = feed(vad, 1300, 1000, QUIET);
    // Last loud frame at 1280, plus the 500 ms hold.
    expect(end).toEqual([['speech-end', 1780]]);
    expect(vad.speaking).toBe(false);
  });
});

describe('voice activity while the Mon is playing (echo guard)', () => {
  it('needs a louder voice while a clip plays', () => {
    const vad = createVad({ threshold: 0.02, playingThreshold: 0.05, attackMs: 60 });
    expect(feed(vad, 1000, 600, 0.03, 0)).toEqual([]);
    expect(feed(vad, 1600, 200, 0.03, null)).toEqual([['speech-start', 1660]]);
  });

  it('ignores everything in the first 250 ms of each clip, then counts the attack from there', () => {
    const vad = createVad({ playingThreshold: 0.05, attackMs: 60, guardMs: 250 });
    const clipAt = 5000;
    const events = feed(vad, clipAt, 600, 0.2, clipAt);
    expect(events).toEqual([['speech-start', clipAt + 260 + 60]]);
    expect(vad.onsetAt).toBe(clipAt + 260);
  });
});

describe('pcmRms', () => {
  it('measures 16-bit PCM on a 0..1 scale', () => {
    expect(pcmRms(new Int16Array(320))).toBe(0);
    const half = new Int16Array(320).fill(16384);
    expect(pcmRms(half)).toBeCloseTo(0.5, 3);
    expect(pcmRms(new Int16Array(0))).toBe(0);
  });
});
