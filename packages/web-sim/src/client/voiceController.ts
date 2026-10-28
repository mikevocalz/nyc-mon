import { createVad, type Vad } from './vad.ts';
import type { VoiceEvent, VoicePhase, VoiceState } from './voiceState.ts';

/**
 * Voice conversation on the NVIDIA companion (nvidia.tsx), like an Echo:
 * push-to-talk or an always-listening conversation mode, and barge-in.
 *
 * The mic (echo-cancelled getUserMedia, micPipeline.ts) stays open for a voice
 * session, and every 20 ms frame goes through the VAD (vad.ts). When the
 * Caller starts talking while the Mon thinks or speaks, the controller fades
 * the Mon out, cancels the turn (the page aborts /api/model, which aborts the
 * Nebius request), drops the queued sentences and opens an ear for the new
 * utterance. A tap on Talk does the same; typing or Stop cuts the Mon off
 * without listening.
 *
 * Browser-free: nvidia.tsx passes the mic, the ear (Riva over /api/asr, or the
 * browser's SpeechRecognition), the voice and the turn.
 */
export interface MicSource {
  /** Each frame's RMS (0..1) and performance.now(). */
  onFrame(fn: (rms: number, at: number) => void): () => void;
  close(): void;
}

export interface EarHandlers {
  onInterim(text: string): void;
  onUtterance(text: string, endedAt: number): void;
  onSilent(): void;
  onError(message: string): void;
}

export interface EarHandle {
  close(): void;
  finish(): void;
}

export interface BargeInRecord {
  readonly source: 'voice' | 'tap' | 'type';
  readonly phase: VoicePhase;
  /** When the cut-in was decided (performance.now()). */
  readonly triggerAt: number;
  /** For voice: the first loud frame. */
  readonly onsetAt: number | null;
}

export interface VoiceControllerDeps {
  readonly state: () => VoiceState;
  readonly dispatch: (e: VoiceEvent) => void;
  /** Rejects with a NotAllowedError when the Caller blocks the mic. */
  readonly openMic: () => Promise<MicSource>;
  /** One listening window; null when no speech recognition can run. */
  readonly openEar: (h: EarHandlers, opts: { readonly conversation: boolean }) => EarHandle | null;
  /** Fade the Mon out over `fadeMs` and drop its queued sentences. */
  readonly stopVoice: (fadeMs: number) => void;
  /** Cancel the in-flight model turn (and its tool calls). */
  readonly abortTurn: () => void;
  readonly submit: (text: string, endedAt: number) => void;
  /** When the clip playing now started, or null (speech.ts playbackStartedAt). */
  readonly playingSince: () => number | null;
  readonly vad?: Vad;
  readonly onBargeIn?: (r: BargeInRecord) => void;
  readonly fadeMs?: number;
  readonly now?: () => number;
}

export interface VoiceController {
  /** Talk (push-to-talk). While the Mon thinks or speaks, it cuts in. */
  talk(): Promise<void>;
  /** End the utterance now (Talk released, or Done). */
  finish(): void;
  setConversation(on: boolean): Promise<void>;
  /** Stop the Mon without listening: Stop tapped, or the Caller typed. */
  cutIn(source: 'tap' | 'type'): void;
  /** Re-check the ear and the mic after a state change from outside (reply audio, reply done). */
  sync(): void;
  close(): void;
}

export const BARGE_IN_FADE_MS = 60;

export function createVoiceController(deps: VoiceControllerDeps): VoiceController {
  const vad = deps.vad ?? createVad();
  const now = deps.now ?? (() => performance.now());
  const fadeMs = deps.fadeMs ?? BARGE_IN_FADE_MS;
  let mic: MicSource | null = null;
  let opening: Promise<boolean> | null = null;
  let unsubscribe: (() => void) | null = null;
  let ear: EarHandle | null = null;
  const phase = () => deps.state().phase;
  const busy = () => phase() === 'thinking' || phase() === 'speaking';

  const closeEar = () => {
    const e = ear;
    ear = null;
    e?.close();
  };

  const closeMic = () => {
    unsubscribe?.();
    unsubscribe = null;
    mic?.close();
    mic = null;
    vad.reset();
  };

  const bargeIn = (source: BargeInRecord['source'], triggerAt: number, onsetAt: number | null) => {
    const was = phase();
    deps.stopVoice(fadeMs);
    deps.abortTurn();
    deps.dispatch(source === 'type' ? { type: 'cut' } : { type: 'barge-in' });
    deps.onBargeIn?.({ source, phase: was, triggerAt, onsetAt });
    sync();
  };

  const onFrame = (rms: number, at: number) => {
    const event = vad.update({ rms, at, playingSince: deps.playingSince() });
    if (event === 'speech-start' && busy()) bargeIn('voice', at, vad.onsetAt);
  };

  /** Opens the mic once per voice session; false when it is blocked. */
  const ensureMic = (): Promise<boolean> => {
    if (mic) return Promise.resolve(true);
    opening ??= deps.openMic().then(
      (m) => {
        mic = m;
        unsubscribe = m.onFrame(onFrame);
        deps.dispatch({ type: 'mic-ready' });
        return true;
      },
      () => {
        deps.dispatch({ type: 'mic-denied' });
        return false;
      },
    ).finally(() => {
      opening = null;
    });
    return opening;
  };

  const openEar = () => {
    if (ear) return;
    const mine: { handle: EarHandle | null } = { handle: null };
    const done = () => {
      if (ear === mine.handle) ear = null;
    };
    mine.handle = deps.openEar(
      {
        onInterim: (text) => {
          if (ear === mine.handle) deps.dispatch({ type: 'interim', text });
        },
        onUtterance: (text, endedAt) => {
          if (ear !== mine.handle) return;
          done();
          deps.dispatch({ type: 'utterance' });
          deps.submit(text, endedAt);
          sync();
        },
        onSilent: () => {
          if (ear !== mine.handle) return;
          done();
          deps.dispatch({ type: 'silent' });
          sync();
        },
        onError: () => {
          if (ear !== mine.handle) return;
          done();
          deps.dispatch({ type: 'asr-unavailable' });
          sync();
        },
      },
      { conversation: deps.state().conversation },
    );
    if (mine.handle === null) {
      deps.dispatch({ type: 'asr-unavailable' });
      return;
    }
    ear = mine.handle;
  };

  function sync() {
    const s = deps.state();
    if (s.phase === 'listening' || s.phase === 'interrupted') {
      if (mic) openEar();
    } else {
      closeEar();
    }
    if (s.phase === 'off' && !s.conversation) closeMic();
  }

  return {
    async talk() {
      if (busy()) {
        bargeIn('tap', now(), null);
        return;
      }
      if (!(await ensureMic())) return;
      deps.dispatch({ type: 'talk' });
      sync();
    },
    finish() {
      ear?.finish();
    },
    async setConversation(on) {
      if (!on) {
        deps.dispatch({ type: 'conversation', on: false });
        sync();
        return;
      }
      if (!(await ensureMic())) return;
      deps.dispatch({ type: 'conversation', on: true });
      sync();
    },
    cutIn(source) {
      if (busy()) bargeIn(source, now(), null);
    },
    sync,
    close() {
      closeEar();
      closeMic();
    },
  };
}
