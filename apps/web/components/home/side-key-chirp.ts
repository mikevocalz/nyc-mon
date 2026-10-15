/**
 * The H-Lynk side key's chirp (PS-037): a fast two-tone blip in the manner of
 * a Nextel Direct Connect chirp, synthesised with Web Audio, no asset. Same
 * tones as the Oct 4 version (9b6a262), minus react-native-audio-api: on web
 * that package only wraps the browser's AudioContext, so the browser API is
 * the lighter path.
 *
 * Nothing here runs on load. The context is created on the first press, in
 * the press handler, so autoplay rules pass on every browser (iOS Safari
 * included). Volume follows the system mixer; the stage's Sound switch mutes it.
 */
let context: AudioContext | null = null;

/** Create or resume the audio context. Call from inside a user gesture handler. */
export function primeSideKeyChirp(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return null;
  try {
    context ??= new window.AudioContext();
    if (context.state === 'suspended') void context.resume();
  } catch {
    context = null; // no audio here; the press still works silently
  }
  return context;
}

/** Play the chirp once. A no-op where Web Audio is missing. */
export function playSideKeyChirp(): void {
  const ctx = primeSideKeyChirp();
  if (!ctx) return;
  const t = ctx.currentTime;

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.5, t);
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(3200, t);
  lowpass.connect(out);
  out.connect(ctx.destination);

  // ~60 ms on 1.45 kHz, a short gap, ~55 ms up on 1.83 kHz.
  for (const [freq, start, length] of [
    [1450, 0, 0.06],
    [1830, 0.075, 0.055],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, t + start);
    const gate = ctx.createGain();
    gate.gain.setValueAtTime(0.0001, t + start);
    gate.gain.exponentialRampToValueAtTime(0.35, t + start + 0.006);
    gate.gain.exponentialRampToValueAtTime(0.0001, t + start + length);
    osc.connect(gate);
    gate.connect(lowpass);
    osc.start(t + start);
    osc.stop(t + start + length + 0.01);
  }
}
