import { describe, expect, it } from 'vitest';
import { createSpeechQueue, type VoicePort } from '../src/client/speechQueue.ts';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/** A voice whose fetches and playback finish only when the test says so. */
function fakePort() {
  const log: string[] = [];
  const fetches = new Map<string, ReturnType<typeof deferred<string>>>();
  const plays = new Map<string, ReturnType<typeof deferred<void>>>();
  const signals: AbortSignal[] = [];
  const port: VoicePort<string> = {
    prepare(text, signal) {
      log.push(`fetch ${text}`);
      signals.push(signal);
      const d = deferred<string>();
      fetches.set(text, d);
      return d.promise;
    },
    play(clip, signal) {
      log.push(`play ${clip}`);
      signals.push(signal);
      const d = deferred<void>();
      plays.set(clip, d);
      return d.promise;
    },
  };
  return { port, log, fetches, plays, signals };
}

describe('speech queue', () => {
  it('starts fetching the first sentence the moment it arrives', async () => {
    const f = fakePort();
    const q = createSpeechQueue({ port: f.port });
    q.push('One.');
    await tick();
    expect(f.log).toEqual(['fetch One.']);
  });

  it('plays strictly in order even when a later clip arrives first', async () => {
    const f = fakePort();
    const q = createSpeechQueue({ port: f.port });
    q.push('One.');
    q.push('Two.');
    q.end();
    await tick();
    f.fetches.get('Two.')!.resolve('Two.');
    await tick();
    expect(f.log).not.toContain('play Two.');
    f.fetches.get('One.')!.resolve('One.');
    await tick();
    expect(f.log.filter((l) => l.startsWith('play'))).toEqual(['play One.']);
  });

  it('never overlaps: the next clip waits for the current one to end', async () => {
    const f = fakePort();
    const started: string[] = [];
    const q = createSpeechQueue({ port: f.port, onSentence: (t) => started.push(t) });
    q.push('One.');
    q.push('Two.');
    q.end();
    f.fetches.get('One.')!.resolve('One.');
    f.fetches.get('Two.')!.resolve('Two.');
    await tick();
    expect(started).toEqual(['One.']);
    f.plays.get('One.')!.resolve();
    await tick();
    expect(started).toEqual(['One.', 'Two.']);
    f.plays.get('Two.')!.resolve();
    await expect(q.done).resolves.toBe('finished');
  });

  it('prefetches the next sentence while one plays, and no further', async () => {
    const f = fakePort();
    const q = createSpeechQueue({ port: f.port, lookahead: 1 });
    q.push('One.');
    q.push('Two.');
    q.push('Three.');
    await tick();
    expect(f.log).toEqual(['fetch One.', 'fetch Two.']);
    f.fetches.get('One.')!.resolve('One.');
    await tick();
    expect(f.log).toEqual(['fetch One.', 'fetch Two.', 'play One.']);
    f.plays.get('One.')!.resolve();
    await tick();
    // One finished: Two is now current, so Three is the one to prefetch.
    expect(f.log).toContain('fetch Three.');
  });

  it('skips a sentence whose clip failed and keeps going', async () => {
    const f = fakePort();
    const q = createSpeechQueue({ port: f.port });
    q.push('One.');
    q.push('Two.');
    q.end();
    f.fetches.get('One.')!.reject(new Error('tts down'));
    f.fetches.get('Two.')!.resolve('Two.');
    await tick();
    expect(f.log).toContain('play Two.');
    f.plays.get('Two.')!.resolve();
    await expect(q.done).resolves.toBe('finished');
  });

  it('finishes only after end() and the last clip', async () => {
    const f = fakePort();
    const q = createSpeechQueue({ port: f.port });
    let settled = false;
    void q.done.then(() => (settled = true));
    q.push('One.');
    f.fetches.get('One.')!.resolve('One.');
    await tick();
    f.plays.get('One.')!.resolve();
    await tick();
    expect(settled).toBe(false); // more text may still stream in
    q.end();
    await tick();
    expect(settled).toBe(true);
  });

  it('an empty reply finishes at once', async () => {
    const q = createSpeechQueue({ port: fakePort().port });
    q.end();
    await expect(q.done).resolves.toBe('finished');
  });

  it('barge-in: cancel aborts every pending fetch and the playing clip, and plays nothing more', async () => {
    const f = fakePort();
    const q = createSpeechQueue({ port: f.port });
    q.push('One.');
    q.push('Two.');
    q.push('Three.');
    f.fetches.get('One.')!.resolve('One.');
    await tick();
    q.cancel();
    expect(f.signals.every((s) => s.aborted)).toBe(true);
    f.fetches.get('Two.')!.resolve('Two.');
    f.plays.get('One.')!.resolve();
    q.push('Four.');
    await tick();
    expect(f.log).toEqual(['fetch One.', 'fetch Two.', 'play One.']);
    await expect(q.done).resolves.toBe('cancelled');
  });
});
