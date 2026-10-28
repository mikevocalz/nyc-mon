import type { CallToolResult } from '@modelcontextprotocol/client';
import type { Authorize } from './freshToken.ts';
import { spokenText } from '@acme/content/voice';
import type { MonVoice } from './monVoice.ts';
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
  speak(reply: string, authorize?: Authorize): Promise<QueueOutcome>;
  /** Stop speaking now. */
  stop(): void;
  /** Stop and forget the voice (sign-out). */
  reset(): void;
}

export interface CompanionVoiceDeps {
  /** Builds one reply's port; it reads the current voice per sentence. nvidia.tsx passes monSpeechPort. */
  readonly port: (voice: () => MonVoice | undefined, authorize: Authorize | undefined) => VoicePort<unknown>;
  /** speech.ts stopSpeaking: also silences anything the adapter is playing outside the queue. */
  readonly stopAll: () => void;
  /** speech.ts setSessionVoice / clearSessionVoice. */
  readonly setSessionVoice: (voice: MonVoice | undefined) => void;
}

const asItem = (result: CallToolResult): TranscriptItem => ({
  kind: 'tool', id: 'nvidia', name: '', title: '', input: {}, result, resourceUri: null, at: 0,
});

export function createCompanionVoice(deps: CompanionVoiceDeps): CompanionVoice {
  let remembered: RememberedVoice | null = null;
  let queue: SpeechQueue | null = null;
  const current = () => remembered?.voice;

  const stop = () => {
    queue?.cancel();
    queue = null;
    deps.stopAll();
  };

  return {
    learn(result) {
      const next = stickyVoice(remembered, [asItem(result)]);
      if (next === remembered) return;
      remembered = next;
      deps.setSessionVoice(next?.voice);
    },
    speak(reply, authorize) {
      stop();
      const mine = createSpeechQueue({ port: deps.port(current, authorize) });
      queue = mine;
      for (const sentence of splitSentences(reply)) {
        // Quote marks are never spoken; stage directions go on to the voice, which performs them.
        const s = spokenText(sentence);
        if (s) mine.push(s);
      }
      mine.end();
      return mine.done.then((outcome) => {
        if (queue === mine) queue = null;
        return outcome;
      });
    },
    stop,
    reset() {
      stop();
      remembered = null;
      deps.setSessionVoice(undefined);
    },
  };
}
