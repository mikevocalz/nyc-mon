import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  a2fRequests,
  applyMultipliers,
  createA2fRenderer,
  faceFromStream,
  loadA2fService,
  moodEmotion,
  type A2fCall,
  type AnimationStreamMessage,
} from '../server/a2f.ts';

/** The fixture's wire bytes, decoded the way grpc-js decodes the live stream. */
function fixtureMessages(): AnimationStreamMessage[] {
  const raw = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'a2f-stream.json'), 'utf8')) as { messages: string[] };
  const def = loadA2fService() as unknown as Record<string, { ProcessAudioStream: { responseDeserialize: (b: Buffer) => AnimationStreamMessage } }>;
  const method = def['nvidia_ace.services.a2f_controller.v1.A2FControllerService']!.ProcessAudioStream;
  return raw.messages.map((b64) => method.responseDeserialize(Buffer.from(b64, 'base64')));
}

describe('Audio2Face-3D response parsing', () => {
  it('reads the wire fixture: 30 fps, the rig columns only, multipliers applied', () => {
    const face = faceFromStream(fixtureMessages());
    expect(face).not.toBeNull();
    expect(face!.fps).toBe(30);
    expect(face!.frames).toHaveLength(30);
    // Only the columns the Mon rig reads, camelCase; TongueOut and the eyes are dropped.
    expect(face!.names).toContain('jawOpen');
    expect(face!.names).not.toContain('tongueOut');
    expect(face!.names).not.toContain('eyeBlinkLeft');
    const col = (n: string) => face!.names.indexOf(n);
    const first = face!.frames[0]!;
    expect(first[col('jawOpen')]).toBeCloseTo(0.25, 3);
    // config_mark multipliers: stretch 0.8 x 0.05, smile 0.5 x 0.8.
    expect(first[col('mouthStretchLeft')]).toBeCloseTo(0.04, 3);
    expect(first[col('mouthSmileLeft')]).toBeCloseTo(0.4, 3);
    expect(first[col('browInnerUp')]).toBeCloseTo(0.1, 3);
    expect(face!.frames.every((f) => f.length === face!.names.length)).toBe(true);
  });

  it('throws on an ERROR status and is null without frames', () => {
    expect(() => faceFromStream([{ status: { code: 'ERROR', message: 'bad audio' } }])).toThrow('A2F error: bad audio');
    expect(faceFromStream([{ animation_data_stream_header: { skel_animation_header: { blend_shapes: ['JawOpen'] } } }])).toBeNull();
    expect(faceFromStream([])).toBeNull();
  });

  it('applyMultipliers clamps and maps PascalCase to camelCase', () => {
    expect(applyMultipliers(['JawOpen', 'MouthClose', 'MouthPucker'], [[1.4, 1, 0.9]])).toEqual({ names: ['jawOpen', 'mouthPucker'], frames: [[1, 1]] });
  });
});

describe('Audio2Face-3D request', () => {
  it('sends a 16 kHz PCM header, one-second chunks, the mood as preferred emotion, then end of audio', () => {
    const pcm = new Uint8Array(16_000 * 2 * 2.5);
    const reqs = a2fRequests(pcm, 'needs-social') as Record<string, any>[];
    expect(reqs[0]!.audio_stream_header.audio_header).toEqual({ audio_format: 'AUDIO_FORMAT_PCM', channel_count: 1, samples_per_second: 16_000, bits_per_sample: 16 });
    expect(reqs[0]!.audio_stream_header.emotion_post_processing_params.enable_preferred_emotion).toBe(true);
    expect(reqs[0]!.audio_stream_header.emotion_params.beginning_emotion).toEqual({ sadness: 0.5 });
    expect(reqs.slice(1, -1).map((r) => r.audio_with_emotion.audio_buffer.length)).toEqual([32_000, 32_000, 16_000]);
    expect(reqs[1]!.audio_with_emotion.emotions).toEqual([{ time_code: 0, emotion: { sadness: 0.5 } }]);
    expect(reqs.at(-1)).toEqual({ end_of_audio: {} });
    // The request serialises with the vendored protos (what the live call sends).
    const def = loadA2fService() as unknown as Record<string, { ProcessAudioStream: { requestSerialize: (m: object) => Buffer } }>;
    const ser = def['nvidia_ace.services.a2f_controller.v1.A2FControllerService']!.ProcessAudioStream.requestSerialize;
    for (const r of reqs) expect(ser(r).length).toBeGreaterThan(0);
  });

  it('an asleep or mood-less Mon sends no preferred emotion', () => {
    expect(moodEmotion('asleep')).toEqual({});
    expect(moodEmotion(undefined)).toEqual({});
    expect(moodEmotion('content')).toEqual({ joy: 0.4 });
    const reqs = a2fRequests(new Uint8Array(10), undefined) as Record<string, any>[];
    expect(reqs[0]!.audio_stream_header.emotion_params).toBeUndefined();
    expect(reqs[0]!.audio_stream_header.emotion_post_processing_params.enable_preferred_emotion).toBe(false);
  });
});

describe('createA2fRenderer fails open', () => {
  const pcm = async () => new Uint8Array(64);

  it('returns the face from the same bytes it was given', async () => {
    const call = vi.fn<A2fCall>(async () => fixtureMessages());
    const toPcm = vi.fn(async (_mp3: Uint8Array, _signal: AbortSignal) => new Uint8Array(64));
    const audio = new Uint8Array([1, 2, 3]);
    const face = await createA2fRenderer({ call, toPcm })({ audio, mood: 'content', signal: new AbortController().signal });
    expect(face?.frames).toHaveLength(30);
    expect(toPcm.mock.calls[0]![0]).toBe(audio);
  });

  it('is null (never throws) on a gRPC error, a hung call past the timeout, or a failed conversion', async () => {
    const signal = new AbortController().signal;
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await createA2fRenderer({ call: async () => Promise.reject(new Error('14 UNAVAILABLE')), toPcm: pcm })({ audio: new Uint8Array(1), signal })).toBeNull();
    const started = Date.now();
    expect(await createA2fRenderer({ call: () => new Promise(() => {}), toPcm: pcm, timeoutMs: 50 })({ audio: new Uint8Array(1), signal })).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
    expect(await createA2fRenderer({ call: async () => fixtureMessages(), toPcm: async () => Promise.reject(new Error('ffmpeg exited 1')) })({ audio: new Uint8Array(1), signal })).toBeNull();
    expect(await createA2fRenderer({ call: async () => [{ status: { code: 'ERROR', message: 'x' } }], toPcm: pcm })({ audio: new Uint8Array(1), signal })).toBeNull();
    err.mockRestore();
  });
});
