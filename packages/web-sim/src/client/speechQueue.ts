import type { MonVoicePort } from '@acme/content/voice';

/**
 * Plays the Mon's reply sentence by sentence as it streams in.
 *
 * Each sentence is fetched (`prepare`) as soon as it is within `lookahead` of
 * the one playing, so sentence n+1's audio is ready by the time n ends. Clips
 * play strictly in order, one at a time. A clip that fails to fetch is skipped.
 * `cancel()` (stop, barge-in) aborts every pending fetch and the playing clip
 * through one AbortSignal, and nothing else plays.
 */

/** The Mon's speak() contract, shared by every surface (`@acme/content/voice`). */
export type VoicePort<C> = MonVoicePort<C>;

export type QueueOutcome = 'finished' | 'cancelled';

export interface SpeechQueue {
  /** Add the next sentence of the reply. Ignored after cancel. */
  push(text: string): void;
  /** No more sentences are coming; `done` resolves once the last one has played. */
  end(): void;
  /** Stop now: abort fetches and playback. */
  cancel(): void;
  readonly done: Promise<QueueOutcome>;
}

export interface SpeechQueueOptions<C> {
  readonly port: VoicePort<C>;
  /** How many sentences past the current one to fetch ahead. */
  readonly lookahead?: number;
  /** A sentence's clip is about to play (the caption follows this). */
  readonly onSentence?: (text: string, index: number) => void;
}

export function createSpeechQueue<C>(opts: SpeechQueueOptions<C>): SpeechQueue {
  const lookahead = opts.lookahead ?? 1;
  const abort = new AbortController();
  const items: { text: string; clip: Promise<C | null> | null }[] = [];
  let cursor = 0;
  let ended = false;
  let wake: (() => void) | null = null;

  const nudge = () => {
    const w = wake;
    wake = null;
    w?.();
  };

  const prefetch = () => {
    for (let k = cursor; k < items.length && k <= cursor + lookahead; k++) {
      const item = items[k]!;
      item.clip ??= opts.port.prepare(item.text, abort.signal).catch(() => null);
    }
  };

  const run = async (): Promise<QueueOutcome> => {
    for (;;) {
      if (abort.signal.aborted) return 'cancelled';
      if (cursor < items.length) {
        prefetch();
        const item = items[cursor]!;
        const clip = await item.clip;
        if (abort.signal.aborted) return 'cancelled';
        if (clip !== null && clip !== undefined) {
          opts.onSentence?.(item.text, cursor);
          try {
            await opts.port.play(clip, abort.signal);
          } catch {
            /* a clip that fails mid-play ends there; the next one still plays */
          }
          if (abort.signal.aborted) return 'cancelled';
        }
        cursor++;
        continue;
      }
      if (ended) return 'finished';
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
  };

  const done = run();

  return {
    push(text) {
      if (abort.signal.aborted || ended || !text.trim()) return;
      items.push({ text, clip: null });
      prefetch();
      nudge();
    },
    end() {
      ended = true;
      nudge();
    },
    cancel() {
      if (abort.signal.aborted) return;
      abort.abort();
      nudge();
    },
    done,
  };
}
