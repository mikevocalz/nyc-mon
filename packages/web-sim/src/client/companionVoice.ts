import type { CallToolResult } from '@modelcontextprotocol/client';
import type { Authorize } from './freshToken.ts';
import { spokenText } from '@acme/content/voice';
import { gatedLine, type MonVoice } from './monVoice.ts';
import type { TranscriptItem } from './session.ts';
import { stickyVoice, type RememberedVoice } from './sessionVoice.ts';
import { splitSentences } from './sentenceStream.ts';
import { createSpeechQueue, type QueueOutcome, type SpeechQueue, type VoicePort } from './speechQueue.ts';

/**
 * The NVIDIA companion's speech (nvidia.tsx): the same pieces App.tsx uses.
 * Tool results teach the sticky voice (sessionVoice.ts); each reply goes
 * sentence by sentence through a speech queue over the shared port
 * (monSpeechPort.ts -> speech.ts -> /api/tts). The voice lives as long as the
 * page and the sign-in: `reset()` on sign-out, so another account never
 * hears this Mon.
 */
export interface CompanionVoice {
  /** A tool result: when it names the Mon's voice, that voice is used from the next sentence on. */
  learn(result: CallToolResult): void;
  /**
   * Speak a reply, cutting off any reply still speaking, with the sign-in it
   * was answered under. Resolves when it has finished or was cut off.
   */
  speak(reply: string, authorize?: Authorize, onSentence?: (sentence: string) => void): Promise<QueueOutcome>;
  /**
   * Stop speaking now and drop the sentences still queued. With `fadeMs` the
   * clip playing fades out over that long (barge-in) instead of a hard cut.
   */
  stop(opts?: StopOptions): void;
  /** Stop and forget the voice (sign-out). */
  reset(): void;
  /**
   * Loads the Mon's voice before the first reply (nvidia.tsx calls
   * get_mon_status on connect): a reply that arrives first waits for it, at
   * most `timeoutMs`, so a turn with no tool call still speaks in the Mon's
   * own voice instead of the browser's.
   */
  prime(load: () => Promise<CallToolResult>, timeoutMs?: number): Promise<void>;
  /** The voice learned so far (undefined before any Mon result). */
  current(): MonVoice | undefined;
  /** The learned Mon's `hatchedAt`, when a result reported it (ambient babble's clock). */
  hatchedAt(): number | undefined;
}

export interface StopOptions {
  readonly fadeMs?: number;
}

export interface CompanionVoiceDeps {
  /** Builds one reply's port; it reads the current voice per sentence. nvidia.tsx passes monSpeechPort. */
  readonly port: (voice: () => MonVoice | undefined, authorize: Authorize | undefined) => VoicePort<unknown>;
  /** speech.ts stopSpeaking: also silences anything the adapter is playing outside the queue. */
  readonly stopAll: (opts?: StopOptions) => void;
  /** speech.ts setSessionVoice / clearSessionVoice. */
  readonly setSessionVoice: (voice: MonVoice | undefined) => void;
}

const asItem = (result: CallToolResult): TranscriptItem => ({
  kind: 'tool', id: 'nvidia', name: '', title: '', input: {}, result, resourceUri: null, at: 0,
});

export function createCompanionVoice(deps: CompanionVoiceDeps): CompanionVoice {
  let remembered: RememberedVoice | null = null;
  let hatched: number | undefined;
  let queue: SpeechQueue | null = null;
  let primed: Promise<void> = Promise.resolve();
  const current = () => remembered?.voice;

  const stop = (opts?: StopOptions) => {
    // The fade goes first: it takes the playing clip out of the queue's hands,
    // so cancelling the queue does not cut it short.
    deps.stopAll(opts);
    queue?.cancel();
    queue = null;
  };

  const learn = (result: CallToolResult) => {
    const mon = (result.structuredContent as { mon?: { hatchedAt?: unknown } } | undefined)?.mon;
    if (!result.isError && mon && typeof mon === 'object') hatched = typeof mon.hatchedAt === 'number' && Number.isFinite(mon.hatchedAt) ? mon.hatchedAt : undefined;
    const next = stickyVoice(remembered, [asItem(result)]);
    if (next === remembered) return;
    remembered = next;
    deps.setSessionVoice(next?.voice);
  };

  return {
    learn,
    current,
    hatchedAt: () => hatched,
    prime(load, timeoutMs = 4000) {
      const loading = load().then(learn, () => {});
      primed = Promise.race([loading, new Promise<void>((r) => setTimeout(r, timeoutMs))]);
      return primed;
    },
    speak(reply, authorize, onSentence) {
      stop();
      const mine = createSpeechQueue({
        port: deps.port(current, authorize),
        ...(onSentence ? { onSentence: (text: string) => onSentence(text) } : {}),
      });
      queue = mine;
      void primed.then(() => {
        if (queue !== mine) return;
        for (const sentence of splitSentences(reply)) {
          // Quote marks are never spoken; stage directions go on to the voice, which performs them.
          // The speech gate runs here too, so the caption (onSentence) shows what the voice says.
          const s = spokenText(sentence);
          const line = s ? gatedLine(s, current()) : '';
          if (line) mine.push(line);
        }
        mine.end();
      });
      return mine.done.then((outcome) => {
        if (queue === mine) queue = null;
        return outcome;
      });
    },
    stop,
    reset() {
      stop();
      remembered = null;
      hatched = undefined;
      deps.setSessionVoice(undefined);
    },
  };
}
