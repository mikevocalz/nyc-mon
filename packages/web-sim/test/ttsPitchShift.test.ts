import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { createFfmpegPitchShifter, findFfmpeg } from '../server/tts.ts';

/**
 * Runs the real ffmpeg shifter on a generated tone. Skipped when no ffmpeg
 * binary is on this machine (FFMPEG_PATH or PATH).
 */
const ffmpeg = findFfmpeg();
const RATE = 44_100;
const TONE_HZ = 440;
const TONE_SECONDS = 2;

function run(args: string[], input?: Buffer): Buffer {
  const out = spawnSync(ffmpeg ?? 'ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { input, maxBuffer: 64 * 1024 * 1024 });
  if (out.status !== 0) throw new Error(`ffmpeg failed: ${out.stderr.toString()}`);
  return out.stdout;
}

/** Mono s16le samples of an mp3. */
function decode(mp3: Buffer): Int16Array {
  const pcm = run(['-f', 'mp3', '-i', 'pipe:0', '-f', 's16le', '-ac', '1', '-ar', String(RATE), 'pipe:1'], mp3);
  return new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
}

/** Frequency from upward zero crossings over the middle of the clip (edges carry encoder padding). */
function dominantHz(samples: Int16Array): number {
  const from = Math.floor(samples.length * 0.2);
  const to = Math.floor(samples.length * 0.8);
  let crossings = 0;
  for (let i = from + 1; i < to; i++) if ((samples[i - 1] ?? 0) < 0 && (samples[i] ?? 0) >= 0) crossings++;
  return crossings / ((to - from) / RATE);
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

describe.skipIf(ffmpeg === null)('ffmpeg pitch shift on a tone', () => {
  const tone = () =>
    run(['-f', 'lavfi', '-i', `sine=frequency=${TONE_HZ}:sample_rate=${RATE}:duration=${TONE_SECONDS}`, '-f', 'mp3', '-b:a', '128k', 'pipe:1']);

  it.each([1.3, 1.15, 0.92])('factor %s moves pitch by the factor and keeps duration within 5 percent', async (factor) => {
    const input = tone();
    const before = decode(input);
    const shifter = createFfmpegPitchShifter(ffmpeg ?? 'ffmpeg');
    const output = await collect(shifter(new Response(new Uint8Array(input)).body as ReadableStream<Uint8Array>, factor, new AbortController().signal));
    const after = decode(output);

    const inSeconds = before.length / RATE;
    const outSeconds = after.length / RATE;
    expect(Math.abs(outSeconds - inSeconds) / inSeconds).toBeLessThan(0.05);

    const inHz = dominantHz(before);
    const outHz = dominantHz(after);
    expect(inHz).toBeGreaterThan(TONE_HZ * 0.97);
    expect(inHz).toBeLessThan(TONE_HZ * 1.03);
    expect(outHz / inHz).toBeGreaterThan(factor * 0.97);
    expect(outHz / inHz).toBeLessThan(factor * 1.03);
  });
});
