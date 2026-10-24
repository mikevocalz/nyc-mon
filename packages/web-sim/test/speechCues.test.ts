import { describe, expect, it } from 'vitest';
import { currentSpeechCue, emitSpeechCue } from '../src/client/speechCues.ts';

const track = { kind: 'amplitude' as const, fps: 60, values: [0.5] };

describe('currentSpeechCue', () => {
  it('re-stamps the playing utterance for a view that mounts mid-sentence', () => {
    emitSpeechCue({ kind: 'start', id: 'u1', elapsedMs: 40, durationMs: 2000, track }, 1000);
    expect(currentSpeechCue(1500)).toEqual({ kind: 'start', id: 'u1', elapsedMs: 540, durationMs: 2000, track });
  });

  it('is null once the audio is past its end or stopped', () => {
    emitSpeechCue({ kind: 'start', id: 'u2', elapsedMs: 0, durationMs: 1000, track }, 0);
    expect(currentSpeechCue(1200)).toBeNull();
    emitSpeechCue({ kind: 'start', id: 'u3', elapsedMs: 0, durationMs: 1000, track }, 0);
    emitSpeechCue({ kind: 'stop', id: 'u3' }, 100);
    expect(currentSpeechCue(200)).toBeNull();
  });

  it('a stop for another utterance leaves the playing one', () => {
    emitSpeechCue({ kind: 'start', id: 'u4', elapsedMs: 0, durationMs: 1000, track }, 0);
    emitSpeechCue({ kind: 'stop', id: 'old' }, 10);
    expect(currentSpeechCue(100)?.id).toBe('u4');
  });
});
