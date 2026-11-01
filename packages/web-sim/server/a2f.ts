import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import type { MonMood } from '@acme/core';
import { ARKIT_INPUTS, arkitKey, type FaceTrack } from '@acme/ui/three/mon/lipsync';

/**
 * NVIDIA Audio2Face-3D (Audio2Emotion runs inside the same NIM) for the
 * simulator's Mon voice: the face for one clip, computed from the exact
 * pitch-shifted mp3 the browser will play, so face and voice share one clock.
 *
 * Path: gRPC to NVIDIA's hosted function `ai-a2x-service` on NVCF, with the
 * person's NVIDIA_API_KEY as a bearer. This is the path ~/zordon/a2f.py runs
 * (verified live 2026-08-13); the 2024 mark/james/claire function ids in
 * NVIDIA's docs are dead. Protos: the nine nvidia_ace files this call needs,
 * vendored unmodified with their Apache-2.0 headers from
 * github.com/NVIDIA/Audio2Face-3D-Samples (proto/protobuf_files, commit
 * a2d0150) into ./a2f-proto.
 *
 * Simulator only, like the voice itself: on a real Echo, Alexa speaks and no
 * face is computed. Every failure (no key, timeout, gRPC error, no frames) is
 * "no face": the clip still plays and the view falls back to character
 * timing, then loudness. This module never throws to its caller.
 */

export const A2F_URI = 'grpc.nvcf.nvidia.com:443';
/** NVCF function `ai-a2x-service`; zordon verified it has live workers. */
export const A2F_FUNCTION_ID = '462f7853-60e8-474a-9728-7b598e58472c';
/** A2F runs faster than real time; past this a face costs more than it is worth and the clip plays without it. */
export const A2F_TIMEOUT_MS = 4_000;
export const A2F_SAMPLE_RATE = 16_000;

/**
 * config_mark.yml's face parameters (NVIDIA/Audio2Face-3D-Samples), as zordon
 * sends them. The hosted service applies these.
 */
const FACE_PARAMS: Readonly<Record<string, number>> = {
  upperFaceStrength: 1.0,
  upperFaceSmoothing: 0.001,
  lowerFaceStrength: 1.3,
  lowerFaceSmoothing: 0.0023,
  faceMaskLevel: 0.6,
  faceMaskSoftness: 0.0085,
  skinStrength: 1.1,
  eyelidOpenOffset: 0.06,
  lipOpenOffset: -0.03,
  tongueStrength: 1.3,
  tongueHeightOffset: 0.0,
};

/**
 * config_mark.yml's per-blendshape multipliers, copied from zordon's a2f.py.
 * The raw solve overdrives close, stretch and press; the demo tames them per
 * channel. The hosted service IGNORES BlendShapeParameters (zordon verified:
 * face and emotion params apply, multipliers do not), so they are applied
 * here, in {@link applyMultipliers}.
 */
export const BS_MULTIPLIERS: Readonly<Record<string, number>> = {
  EyeBlinkLeft: 1.0, EyeSquintLeft: 1.0, EyeWideLeft: 1.0,
  EyeBlinkRight: 1.0, EyeSquintRight: 1.0, EyeWideRight: 1.0,
  JawForward: 0.7, JawLeft: 0.2, JawRight: 0.2, JawOpen: 1.0,
  MouthClose: 0.2, MouthFunnel: 1.2, MouthPucker: 1.2,
  MouthLeft: 0.2, MouthRight: 0.2,
  MouthSmileLeft: 0.8, MouthSmileRight: 0.8,
  MouthFrownLeft: 0.5, MouthFrownRight: 0.5,
  MouthDimpleLeft: 0.8, MouthDimpleRight: 0.8,
  MouthStretchLeft: 0.05, MouthStretchRight: 0.05,
  MouthRollLower: 0.8, MouthRollUpper: 0.5,
  MouthShrugLower: 0.9, MouthShrugUpper: 0.4,
  MouthPressLeft: 0.8, MouthPressRight: 0.8,
  MouthLowerDownLeft: 0.8, MouthLowerDownRight: 0.8,
  MouthUpperUpLeft: 0.8, MouthUpperUpRight: 0.8,
  BrowDownLeft: 1.0, BrowDownRight: 1.0, BrowInnerUp: 1.0,
  BrowOuterUpLeft: 1.0, BrowOuterUpRight: 1.0,
  CheekPuff: 0.2, CheekSquintLeft: 1.0, CheekSquintRight: 1.0,
  NoseSneerLeft: 0.8, NoseSneerRight: 0.8,
};

/**
 * The Mon's mood as A2F's emotion (names from nvidia_ace.a2f.v1:
 * amazement, anger, cheekiness, disgust, fear, grief, joy, outofbreath,
 * pain, sadness). Specified, so face and voice agree; Audio2Emotion still
 * reads the Mon's own synthetic voice and blends at half strength. It never
 * hears the person: only the Mon's rendered clip is sent.
 */
export function moodEmotion(mood: MonMood | undefined): Readonly<Record<string, number>> {
  switch (mood) {
    case 'content': return { joy: 0.4 };
    case 'needs-social': return { sadness: 0.5 };
    case 'needs-energy': return { sadness: 0.2 };
    case 'sluggish': return { sadness: 0.15 };
    case 'needs-fullness': return { amazement: 0.1 };
    case 'asleep':
    case undefined:
      return {};
  }
}

/**
 * Multiplies each column by its config_mark multiplier, clamps to 0..1, and
 * keeps only the columns the Mon rig reads (ARKIT_INPUTS), in camelCase. A
 * clip's face is then about a fifth of A2F's 52 columns on the wire.
 */
export function applyMultipliers(names: readonly string[], frames: readonly (readonly number[])[]): { names: string[]; frames: number[][] } {
  const wanted = new Set(ARKIT_INPUTS);
  const keep = names.map((n, i) => ({ i, key: arkitKey(n), mult: BS_MULTIPLIERS[n] ?? BS_MULTIPLIERS[n.charAt(0).toUpperCase() + n.slice(1)] ?? 1 }))
    .filter((c) => wanted.has(c.key));
  return {
    names: keep.map((c) => c.key),
    frames: frames.map((f) => keep.map((c) => Math.round(Math.min(1, Math.max(0, (f[c.i] ?? 0) * c.mult)) * 1000) / 1000)),
  };
}

/** One AnimationDataStream message as proto-loader decodes it (keepCase, oneofs). */
export interface AnimationStreamMessage {
  readonly stream_part?: string;
  readonly animation_data_stream_header?: { readonly skel_animation_header?: { readonly blend_shapes?: readonly string[] } | null } | null;
  readonly animation_data?: {
    readonly skel_animation?: { readonly blend_shape_weights?: readonly { readonly time_code?: number; readonly values?: readonly number[] }[] } | null;
  } | null;
  readonly status?: { readonly code?: string | number; readonly message?: string } | null;
}

/**
 * The face from a finished response stream: blendshape names from the
 * header, one frame per keyframe, fps from the keyframes' own time codes.
 * Null when there are no frames; throws on an ERROR status (the caller turns
 * that into "no face").
 */
export function faceFromStream(messages: readonly AnimationStreamMessage[]): FaceTrack | null {
  let names: readonly string[] = [];
  const keys: { t: number; values: readonly number[] }[] = [];
  for (const m of messages) {
    if (m.status && (m.status.code === 'ERROR' || m.status.code === 3)) throw new Error(`A2F error: ${m.status.message ?? 'unknown'}`);
    const header = m.animation_data_stream_header?.skel_animation_header?.blend_shapes;
    if (header && header.length > 0) names = header;
    for (const kf of m.animation_data?.skel_animation?.blend_shape_weights ?? []) {
      keys.push({ t: kf.time_code ?? 0, values: kf.values ?? [] });
    }
  }
  if (names.length === 0 || keys.length === 0) return null;
  keys.sort((a, b) => a.t - b.t);
  const steps = keys.slice(1).map((k, i) => k.t - (keys[i] as { t: number }).t).filter((d) => d > 0).sort((a, b) => a - b);
  const step = steps[Math.floor(steps.length / 2)] ?? 1 / 30;
  const fps = Math.round(1 / step);
  const { names: kept, frames } = applyMultipliers(names, keys.map((k) => k.values));
  return kept.length > 0 ? { fps, names: kept, frames } : null;
}

/** The request side of one A2F call, in proto-loader's object shape. */
export function a2fRequests(pcm: Uint8Array, mood: MonMood | undefined): object[] {
  const emotion = moodEmotion(mood);
  const preferred = Object.keys(emotion).length > 0;
  const header = {
    audio_stream_header: {
      audio_header: { audio_format: 'AUDIO_FORMAT_PCM', channel_count: 1, samples_per_second: A2F_SAMPLE_RATE, bits_per_sample: 16 },
      face_params: { float_params: FACE_PARAMS },
      emotion_post_processing_params: {
        emotion_contrast: 1.0,
        live_blend_coef: 0.7,
        enable_preferred_emotion: preferred,
        preferred_emotion_strength: 0.5,
        emotion_strength: 0.6,
        max_emotions: 3,
      },
      blendshape_params: {},
      ...(preferred ? { emotion_params: { beginning_emotion: emotion } } : {}),
    },
  };
  const chunks: object[] = [header];
  const step = A2F_SAMPLE_RATE * 2; // one second of 16-bit mono
  for (let at = 0; at < pcm.length; at += step) {
    const audio_buffer = Buffer.from(pcm.subarray(at, at + step));
    chunks.push({ audio_with_emotion: at === 0 && preferred ? { audio_buffer, emotions: [{ time_code: 0, emotion }] } : { audio_buffer } });
  }
  chunks.push({ end_of_audio: {} });
  return chunks;
}

/** Sends the requests and gathers every response message. Injectable for tests. */
export type A2fCall = (requests: readonly object[], signal: AbortSignal) => Promise<AnimationStreamMessage[]>;

const PROTO_DIR = join(dirname(fileURLToPath(import.meta.url)), 'a2f-proto');
const PROTO_OPTIONS: protoLoader.Options = { keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true, includeDirs: [PROTO_DIR] };

/** The A2FControllerService definition from the vendored protos. */
export function loadA2fService(): protoLoader.PackageDefinition {
  return protoLoader.loadSync(['nvidia_ace.services.a2f_controller.v1.proto'], PROTO_OPTIONS);
}

/** The NVCF gRPC call: TLS, bearer and function-id metadata, one bidirectional stream. */
export function createNvcfCall(opts: { apiKey: string; functionId?: string; uri?: string }): A2fCall {
  const pkg = grpc.loadPackageDefinition(loadA2fService()) as unknown as {
    nvidia_ace: { services: { a2f_controller: { v1: { A2FControllerService: grpc.ServiceClientConstructor } } } };
  };
  const Client = pkg.nvidia_ace.services.a2f_controller.v1.A2FControllerService;
  const client = new Client(opts.uri ?? A2F_URI, grpc.credentials.createSsl());
  return (requests, signal) =>
    new Promise((resolve, reject) => {
      const metadata = new grpc.Metadata();
      metadata.set('function-id', opts.functionId ?? A2F_FUNCTION_ID);
      metadata.set('authorization', `Bearer ${opts.apiKey}`);
      const call = (client as unknown as { ProcessAudioStream: (m: grpc.Metadata) => grpc.ClientDuplexStream<object, AnimationStreamMessage> })
        .ProcessAudioStream(metadata);
      const out: AnimationStreamMessage[] = [];
      const onAbort = () => call.cancel();
      signal.addEventListener('abort', onAbort, { once: true });
      call.on('data', (m: AnimationStreamMessage) => out.push(m));
      call.on('error', (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      });
      call.on('end', () => {
        signal.removeEventListener('abort', onAbort);
        resolve(out);
      });
      for (const r of requests) call.write(r);
      call.end();
    });
}

/** 16 kHz mono PCM16 from an mp3, through ffmpeg (stdin to stdout). */
export function mp3ToPcm16(binary: string, mp3: Uint8Array, signal: AbortSignal): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ['-hide_banner', '-loglevel', 'error', '-f', 'mp3', '-i', 'pipe:0', '-ar', String(A2F_SAMPLE_RATE), '-ac', '1', '-f', 's16le', 'pipe:1'], {
      stdio: ['pipe', 'pipe', 'ignore'],
      signal,
    });
    const parts: Buffer[] = [];
    child.stdout.on('data', (b: Buffer) => parts.push(b));
    child.on('error', reject);
    child.stdin.on('error', () => {});
    child.on('close', (code) => (code === 0 ? resolve(new Uint8Array(Buffer.concat(parts))) : reject(new Error(`ffmpeg exited ${code}`))));
    child.stdin.end(Buffer.from(mp3));
  });
}

export interface FaceRequest {
  readonly audio: Uint8Array;
  readonly mood?: MonMood;
  readonly signal: AbortSignal;
}

/** The face for one clip, or null. Never throws. */
export type FaceRenderer = (request: FaceRequest) => Promise<FaceTrack | null>;

export interface A2fRendererOptions {
  readonly call: A2fCall;
  /** mp3 to 16 kHz PCM16. */
  readonly toPcm: (mp3: Uint8Array, signal: AbortSignal) => Promise<Uint8Array>;
  readonly timeoutMs?: number;
  /** Reports how long a face took (no text, no key). */
  readonly onTiming?: (ms: number, frames: number) => void;
}

export function createA2fRenderer(opts: A2fRendererOptions): FaceRenderer {
  return async ({ audio, mood, signal }) => {
    const timeout = AbortSignal.timeout(opts.timeoutMs ?? A2F_TIMEOUT_MS);
    const both = AbortSignal.any([timeout, signal]);
    const started = performance.now();
    try {
      const pcm = await opts.toPcm(audio, both);
      // Either the stream answers or the timeout wins; a hung call costs the face, never the clip.
      const messages = await Promise.race([
        opts.call(a2fRequests(pcm, mood), both),
        new Promise<never>((_, reject) => both.addEventListener('abort', () => reject(new Error('A2F timed out')), { once: true })),
      ]);
      const face = faceFromStream(messages);
      opts.onTiming?.(Math.round(performance.now() - started), face?.frames.length ?? 0);
      return face;
    } catch (err) {
      console.error('[web-sim] a2f: no face', err instanceof Error ? err.message.slice(0, 160) : 'unknown');
      return null;
    }
  };
}
