/**
 * The live mic: echo-cancelled getUserMedia audio, 16 kHz s16, streamed over
 * the `/api/asr` WebSocket to NVIDIA Parakeet (server/asr.ts), with interim
 * and final text coming back.
 *
 * It stays open for the whole voice session, including while the Mon talks:
 * Chrome's echo canceller removes the Mon's own audio (measured in the
 * simulator: the mic read 0.0003 RMS during playback against 0.0007 for the
 * quiet room), so the person can cut in by talking. App.tsx still checks text
 * heard mid-reply against the reply ({@link isEcho}) in case a device has no
 * working canceller.
 */

export interface LiveMicHandlers {
  onInterim(text: string): void;
  onFinal(text: string): void;
  onError(message: string): void;
}

export interface LiveMic {
  close(): void;
}

export const LIVE_MIC_SAMPLE_RATE = 16_000;

export async function openLiveMic(opts: { url: string; token: string | undefined; handlers: LiveMicHandlers }): Promise<LiveMic> {
  const media = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
  const ctx = new AudioContext({ sampleRate: LIVE_MIC_SAMPLE_RATE });
  let closed = false;
  let ws: WebSocket | null = null;
  const close = () => {
    if (closed) return;
    closed = true;
    media.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => {});
    ws?.close();
  };
  try {
    await ctx.audioWorklet.addModule('/pcm-worklet.js');
  } catch (err) {
    close();
    throw err;
  }
  const node = new AudioWorkletNode(ctx, 'pcm16');
  ctx.createMediaStreamSource(media).connect(node);

  const socket = new WebSocket(opts.url);
  ws = socket;
  socket.binaryType = 'arraybuffer';
  let ready = false;
  node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
    if (ready && socket.readyState === WebSocket.OPEN) socket.send(e.data);
  };
  socket.onopen = () => socket.send(JSON.stringify({ type: 'start', token: opts.token ?? '' }));
  socket.onmessage = (e: MessageEvent) => {
    if (typeof e.data !== 'string') return;
    let msg: { type?: string; text?: string; message?: string };
    try {
      msg = JSON.parse(e.data) as typeof msg;
    } catch {
      return;
    }
    if (msg.type === 'ready') ready = true;
    else if (msg.type === 'interim' && msg.text) opts.handlers.onInterim(msg.text);
    else if (msg.type === 'final' && msg.text) opts.handlers.onFinal(msg.text);
    else if (msg.type === 'error') opts.handlers.onError(msg.message ?? 'Speech recognition stopped. Tap Talk to try again.');
  };
  socket.onclose = (e) => {
    if (closed) return;
    close();
    opts.handlers.onError(e.code === 1008 ? 'Your sign-in expired. Sign in again to keep talking.' : 'Speech recognition disconnected. Tap Talk to try again.');
  };
  return { close };
}

/** `ws://` or `wss://` for /api/asr on this page's origin. */
export function liveMicUrl(location: Pick<Location, 'protocol' | 'host'>): string {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/asr`;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Whether text heard while the Mon talks is the Mon's own reply coming back
 * through the speakers: most of its words are in the reply so far.
 */
export function isEcho(heard: string, reply: string): boolean {
  const said = words(heard);
  if (said.length === 0) return true;
  const own = new Set(words(reply));
  return said.filter((w) => own.has(w)).length / said.length >= 0.6;
}

/** Room noise and false starts the recognizer finalises on their own: "Oh.", "Uh", "Hm". */
const FILLERS = new Set(['oh', 'uh', 'um', 'hm', 'hmm', 'ah', 'eh', 'mm', 'he', 'huh', 'er']);

/** A final that is only a filler sound is not a turn. "Bet." and "No." still are. */
export function isFiller(text: string): boolean {
  const said = words(text);
  return said.length === 0 || (said.length === 1 && FILLERS.has(said[0]!));
}
