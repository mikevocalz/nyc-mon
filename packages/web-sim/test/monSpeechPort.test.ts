import { describe, expect, it, vi } from 'vitest';
import { monSpeechPort } from '../src/client/monSpeechPort.ts';
import type { MonVoice } from '../src/client/monVoice.ts';
import type { MonClip, prepareMonClip } from '../src/client/speech.ts';

const baby: MonVoice = { lineageId: 'dex-001/male/1', stage: 'Baby' };
const small: MonVoice = { lineageId: 'dex-001/male/1', stage: 'Small', mood: 'asleep' };

describe('monSpeechPort', () => {
  it('fetches each sentence in the voice current at that moment, with the sign-in token', async () => {
    let voice = baby;
    const prepare = vi.fn<typeof prepareMonClip>(async (): Promise<MonClip> => ({ kind: 'silent' }));
    const getToken = () => 'tok';
    const port = monSpeechPort({ voice: () => voice, getToken, prepare });
    const signal = new AbortController().signal;
    await port.prepare('One.', signal);
    voice = small; // a tool result mid-reply
    await port.prepare('Two.', signal);
    expect(prepare.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ['One.', baby],
      ['Two.', small],
    ]);
    expect(prepare.mock.calls[0]?.[2]).toEqual({ getToken });
    expect(prepare.mock.calls[0]?.[3]).toBe(signal);
  });

  it('play waits for the clip to finish', async () => {
    let finish!: () => void;
    const play = vi.fn(() => new Promise<void>((r) => (finish = r)));
    const port = monSpeechPort({ voice: () => baby, play });
    let done = false;
    void port.play({ kind: 'silent' }, new AbortController().signal).then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    finish();
    await vi.waitFor(() => expect(done).toBe(true));
  });
});
