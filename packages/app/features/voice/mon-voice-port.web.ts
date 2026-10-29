import { FALLBACK_MON_LINGO, planMonUtterance, type MonLingo } from '@acme/content/voice';
import { AUTH_BASE_URL } from '../onboarding/auth';
import { subjectRef, type MonVoiceSubject, type SpeakerPort } from './mon-speaker';
import { MonVoiceHttpError, MonVoiceSilent, requestMonVoice } from './mon-voice-request';

/**
 * Web Mon voice adapter: the app on the web plays the same `/v1/mon-voice`
 * clip as native through an HTMLAudioElement. When the server has no clip
 * for a voiced Mon (no ElevenLabs key there, or the Mon's line has no voices
 * yet) or can't be reached, the browser's Web Speech voice reads the plan's
 * `plainSpoken` text at the plan's fallback pitch, as the web simulator does.
 * An Egg has no `mon-instances` row until it hatches, so the server answers
 * its babble with a 404; the Web Speech voice reads the babble at the Egg's
 * pitch instead. A 401, or a 404 for a hatched Mon, stays silent; the
 * caption carries the line.
 *
 * Stage pitch on the clip: HTMLAudio cannot move pitch alone, so the element
 * plays at `playbackRate = pitch` with `preservesPitch` off. The line runs a
 * little faster for a Baby and slower for a Max (at most 30%).
 */

export type WebMonClip =
  | { readonly kind: 'audio'; readonly bytes: ArrayBuffer; readonly pitch: number; readonly caption?: string }
  | { readonly kind: 'speech'; readonly text: string; readonly pitch: number | undefined };

function abortError(): Error {
  const err = new Error('aborted');
  err.name = 'AbortError';
  return err;
}

/** Headers the web app adds to `/v1` calls: none, the browser sends Origin and the cookie itself. */
export const MON_VOICE_HEADERS: Readonly<Record<string, string>> = {};

function speechFallback(text: string, mon: MonVoiceSubject, lingo: MonLingo, now: number): WebMonClip {
  const plan = planMonUtterance(text, subjectRef(mon, now), lingo);
  if (plan.voice.kind === 'silent' || plan.plainSpoken === '' || typeof globalThis.speechSynthesis === 'undefined') throw new MonVoiceSilent('silent');
  const pitch = plan.voice.kind === 'lineage' ? plan.voice.fallbackPitch : plan.voice.pitch;
  return { kind: 'speech', text: plan.plainSpoken, pitch };
}

function playAudio(clip: Extract<WebMonClip, { kind: 'audio' }>, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    // The blob URL lives only while this element plays.
    const url = URL.createObjectURL(new Blob([clip.bytes], { type: 'audio/mpeg' }));
    const audio = new Audio(url);
    (audio as HTMLAudioElement & { preservesPitch: boolean }).preservesPitch = false;
    audio.playbackRate = clip.pitch;
    const done = () => {
      signal.removeEventListener('abort', cut);
      audio.onended = null;
      audio.onerror = null;
      URL.revokeObjectURL(url);
      resolve();
    };
    const cut = () => {
      audio.pause();
      done();
    };
    audio.onended = done;
    audio.onerror = done;
    signal.addEventListener('abort', cut, { once: true });
    // Autoplay refused (no gesture yet): resolve, the caption still shows.
    audio.play().catch(done);
  });
}

/**
 * Held until it ends: Chrome can garbage-collect an utterance only a closure
 * holds, and then `onend` never fires.
 */
let speaking: SpeechSynthesisUtterance | null = null;

/** Longest a Web Speech line may take before it counts as ended (no voices loaded, a paused engine). */
function speechDeadlineMs(text: string): number {
  return 4_000 + text.length * 120;
}

function playSpeech(clip: Extract<WebMonClip, { kind: 'speech' }>, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    const synth = globalThis.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(clip.text);
    utterance.lang = 'en-US';
    if (clip.pitch !== undefined) utterance.pitch = clip.pitch;
    speaking = utterance;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      clearTimeout(watchdog);
      signal.removeEventListener('abort', cut);
      if (speaking === utterance) speaking = null;
      resolve();
    };
    watchdog = setTimeout(() => {
      synth.cancel();
      done();
    }, speechDeadlineMs(clip.text));
    const cut = () => {
      synth.cancel();
      done();
    };
    utterance.onend = done;
    utterance.onerror = done;
    signal.addEventListener('abort', cut, { once: true });
    synth.cancel();
    synth.speak(utterance);
  });
}

/** An Egg the server has no Mon record for yet. */
function eggNotFound(err: unknown, mon: MonVoiceSubject): boolean {
  return mon.stage === 'Egg' && err instanceof MonVoiceHttpError && err.status === 404;
}

/**
 * `lingo` is the served table the speaker planned with; the Web Speech
 * fallback reads the same one, at the voice stage for `now()`.
 */
export function createMonVoicePort(mon: MonVoiceSubject, lingo: MonLingo = FALLBACK_MON_LINGO, now: () => number = Date.now): SpeakerPort<WebMonClip> {
  return {
    captionOf: (clip) => (clip.kind === 'audio' ? clip.caption : undefined),
    async prepare(text, signal) {
      try {
        const clip = await requestMonVoice({ monId: mon.monInstanceId, text, ...(mon.mood === undefined ? {} : { mood: mon.mood }) }, signal, {
          baseUrl: AUTH_BASE_URL,
          headers: MON_VOICE_HEADERS,
          fetch: (url, init) => fetch(url, init),
        });
        if (signal.aborted) throw abortError();
        return { kind: 'audio', bytes: clip.bytes, pitch: clip.pitch, ...(clip.caption === undefined ? {} : { caption: clip.caption }) };
      } catch (err) {
        if (signal.aborted) throw abortError();
        // The server has nothing for a voiced Mon, or is unreachable (fetch threw a TypeError).
        if ((err instanceof MonVoiceSilent && err.reason !== 'silent') || err instanceof TypeError || eggNotFound(err, mon)) {
          return speechFallback(text, mon, lingo, now());
        }
        throw err;
      }
    },
    play(clip, signal) {
      if (signal.aborted) return Promise.resolve();
      return clip.kind === 'audio' ? playAudio(clip, signal) : playSpeech(clip, signal);
    },
  };
}
