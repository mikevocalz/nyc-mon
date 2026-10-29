import type { MonLingo, MonVoicePort } from '@acme/content/voice';
import { AudioContext, AudioManager, type AudioBuffer, type SessionOptions } from 'react-native-audio-api';
import { APP_ORIGIN } from '@acme/auth';
import { AUTH_BASE_URL } from '../onboarding/auth';
import type { MonVoiceSubject } from './mon-speaker';
import { requestMonVoice } from './mon-voice-request';

/**
 * Native Mon voice adapter on react-native-audio-api (the module the voice
 * note player already uses). The line is planned server-side with
 * `planMonUtterance` from `@acme/content/voice`; this file fetches the clip
 * from `/v1/mon-voice`, decodes it and plays it.
 *
 * Stage pitch: the server returns the clip at the voice's own pitch and names
 * the factor left to apply. A buffer source with `pitchCorrection` and
 * `detune` (cents) shifts pitch through WSOLA without changing length, the
 * same effect the web simulator's ffmpeg filter bakes in.
 *
 * Mute switch: while the Mon speaks, iOS uses the `ambient` session category,
 * which the Ring/Silent switch silences and which mixes with the Caller's own
 * music; when the line ends the library default (`playback`) comes back, so
 * voice notes keep playing with the switch on. Android has no mute switch; the
 * media volume decides.
 *
 * No Web Speech or other TTS on native: when the server sends no clip, the
 * caption carries the line (mon-speaker.ts).
 */

export interface NativeMonClip {
  readonly buffer: AudioBuffer;
  readonly pitch: number;
}

let context: AudioContext | null = null;

const SPEAKING: SessionOptions = { iosCategory: 'ambient', iosMode: 'default', iosOptions: [] };
/** react-native-audio-api's own default (AudioSessionManager.mm), which the voice note player relies on. */
const AFTER: SessionOptions = { iosCategory: 'playback', iosMode: 'default', iosOptions: [] };

function setSession(options: SessionOptions): void {
  try {
    AudioManager.setAudioSessionOptions(options);
  } catch {
    // No session control here: keep whatever is set.
  }
}

function audioContext(): AudioContext {
  context ??= new AudioContext();
  return context;
}

function abortError(): Error {
  const err = new Error('aborted');
  err.name = 'AbortError';
  return err;
}

/** Native fetch sets no Origin; the `/v1` routes check it against the app's scheme. */
export const MON_VOICE_HEADERS: Readonly<Record<string, string>> = { origin: APP_ORIGIN };

/**
 * The server plans the clip with the lingo Payload publishes and names the
 * pitch left to apply, so native needs nothing from `_lingo` itself; the
 * parameter keeps both ports one shape.
 */
export function createMonVoicePort(mon: MonVoiceSubject, _lingo?: MonLingo): MonVoicePort<NativeMonClip> {
  return {
    async prepare(text, signal) {
      const clip = await requestMonVoice({ monId: mon.monInstanceId, text, ...(mon.mood === undefined ? {} : { mood: mon.mood }) }, signal, {
        baseUrl: AUTH_BASE_URL,
        headers: MON_VOICE_HEADERS,
        fetch: (url, init) => fetch(url, init),
      });
      if (signal.aborted) throw abortError();
      const buffer = await audioContext().decodeAudioData(clip.bytes);
      return { buffer, pitch: clip.pitch };
    },
    play(clip, signal) {
      return new Promise<void>((resolve) => {
        if (signal.aborted) {
          resolve();
          return;
        }
        setSession(SPEAKING);
        let settled = false;
        let source: ReturnType<AudioContext['createBufferSource']> | null = null;
        const finish = () => {
          if (settled) return;
          settled = true;
          signal.removeEventListener('abort', cut);
          if (source !== null) source.onended = null;
          setSession(AFTER);
          resolve();
        };
        const cut = () => {
          try {
            source?.stop();
          } catch {
            // Already stopped, or never started.
          }
          finish();
        };
        signal.addEventListener('abort', cut, { once: true });
        const start = async () => {
          const ctx = audioContext();
          if (ctx.state === 'suspended') await ctx.resume();
          if (settled) return;
          const node = ctx.createBufferSource({ pitchCorrection: clip.pitch !== 1 });
          node.buffer = clip.buffer;
          if (clip.pitch !== 1) node.detune.value = 1200 * Math.log2(clip.pitch);
          node.connect(ctx.destination);
          node.onended = finish;
          source = node;
          node.start();
        };
        // A context that won't resume or a source that won't start ends the line; the caption still shows.
        start().catch(finish);
      });
    },
  };
}
