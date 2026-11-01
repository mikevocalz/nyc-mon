import { pcmRms } from './vad.ts';
import type { MicSource } from './voiceController.ts';
import { LIVE_MIC_SAMPLE_RATE } from './liveMic.ts';

/**
 * One mic for the NVIDIA companion's voice session: getUserMedia with echo
 * cancellation, noise suppression and auto gain, 16 kHz mono s16 in 20 ms
 * frames from the PCM worklet. Every frame feeds the VAD (its RMS) and,
 * while an ear is open, the /api/asr stream (liveMic.ts `source`). The last
 * ~400 ms are kept so the first syllable of a barge-in, spoken before the VAD
 * fired, still reaches the recognizer.
 */
export interface MicPipeline extends MicSource {
  /** Raw 20 ms PCM frames, for /api/asr. */
  onPcm(fn: (chunk: ArrayBuffer) => void): () => void;
  /** Copies of the most recent frames, oldest first. */
  preroll(): ArrayBuffer[];
}

const FRAME = 320; // 20 ms at 16 kHz
const PREROLL_FRAMES = 20;

export async function openMicPipeline(): Promise<MicPipeline> {
  const media = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
  const ctx = new AudioContext({ sampleRate: LIVE_MIC_SAMPLE_RATE });
  const close = () => {
    media.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => {});
  };
  try {
    await ctx.audioWorklet.addModule('/pcm-worklet.js');
  } catch (err) {
    close();
    throw err;
  }
  const node = new AudioWorkletNode(ctx, 'pcm16', { processorOptions: { chunk: FRAME } });
  ctx.createMediaStreamSource(media).connect(node);
  const levels = new Set<(rms: number, at: number) => void>();
  const sinks = new Set<(chunk: ArrayBuffer) => void>();
  const recent: ArrayBuffer[] = [];
  node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
    const at = performance.now();
    const rms = pcmRms(new Int16Array(e.data));
    recent.push(e.data);
    if (recent.length > PREROLL_FRAMES) recent.shift();
    for (const l of levels) l(rms, at);
    for (const s of sinks) s(e.data.slice(0));
  };
  // A suspended context (no gesture yet) would deliver nothing.
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
  return {
    onFrame(fn) {
      levels.add(fn);
      return () => levels.delete(fn);
    },
    onPcm(fn) {
      sinks.add(fn);
      return () => sinks.delete(fn);
    },
    preroll: () => recent.map((b) => b.slice(0)),
    close,
  };
}
