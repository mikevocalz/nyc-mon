import { AudioContext } from 'react-native-audio-api';

/**
 * The Nextel Direct Connect PTT chirp: a fast two-tone blip. Synthesised,
 * no asset — two square blips through a lowpass, the classic "chirp-chirp".
 * The context is created lazily inside the first press so autoplay rules
 * are satisfied.
 */
let context: AudioContext | null = null;

export function playNextelChirp() {
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
  const t = context.currentTime;

  const out = context.createGain();
  out.gain.setValueAtTime(0.5, t);
  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(3200, t);
  lowpass.connect(out);
  out.connect(context.destination);

  // The chirp: ~60ms on 1.45kHz, a short gap, ~55ms up on 1.83kHz.
  for (const [freq, start, length] of [
    [1450, 0, 0.06],
    [1830, 0.075, 0.055],
  ] as const) {
    const osc = context.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, t + start);
    const gate = context.createGain();
    gate.gain.setValueAtTime(0.0001, t + start);
    gate.gain.exponentialRampToValueAtTime(0.35, t + start + 0.006);
    gate.gain.exponentialRampToValueAtTime(0.0001, t + start + length);
    osc.connect(gate);
    gate.connect(lowpass);
    osc.start(t + start);
    osc.stop(t + start + length + 0.01);
  }
}
