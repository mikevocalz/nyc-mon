import * as THREE from 'three';

/**
 * Removes keyframe tremble baked into a clip. Lil' Ratti's emote_tired came
 * with shin and ear rotations that zig-zag (turn back on two keys in a row)
 * on 27% of its 30 fps keys: a 15 Hz shake the whole body shows. Real fast
 * motion does not zig-zag: up_walk's and up_run's legs read 0-6%,
 * quad_sprint's forearms 17%.
 *
 * A rotation track that zig-zags more than {@link JITTER_ZIGZAG} is
 * low-passed with a 5-key binomial kernel (zero at the 15 Hz key rate, so
 * key-to-key tremble cancels), wrapping round for a looping clip so the loop
 * still meets. Every other track is left exactly as authored.
 */
export const JITTER_ZIGZAG = 0.2;
const KERNEL = [1, 4, 6, 4, 1] as const;
const WINDOW = 2;

/** Share of keys where the track turns back on itself at this key and the next (a zig-zag). */
export function zigzagRate(values: ArrayLike<number>, stride: number): number {
  const n = values.length / stride;
  if (n < 4) return 0;
  const turns: boolean[] = [];
  for (let k = 1; k < n - 1; k++) {
    let dot = 0;
    for (let q = 0; q < stride; q++) {
      dot += (values[(k + 1) * stride + q]! - values[k * stride + q]!) * (values[k * stride + q]! - values[(k - 1) * stride + q]!);
    }
    turns.push(dot < 0);
  }
  let zigzags = 0;
  for (let k = 1; k < turns.length; k++) if (turns[k] && turns[k - 1]) zigzags++;
  return zigzags / (turns.length - 1);
}

function smoothQuaternions(values: Float32Array, loop: boolean): Float32Array {
  const n = values.length / 4;
  const out = new Float32Array(values.length);
  const at = (k: number) => (loop ? ((k % n) + n) % n : Math.min(n - 1, Math.max(0, k)));
  for (let k = 0; k < n; k++) {
    const ref = k * 4;
    let x = 0, y = 0, z = 0, w = 0;
    for (let o = -WINDOW; o <= WINDOW; o++) {
      const i = at(k + o) * 4;
      // Same hemisphere as the centre key, or q and -q cancel out.
      const sign = values[i]! * values[ref]! + values[i + 1]! * values[ref + 1]! + values[i + 2]! * values[ref + 2]! + values[i + 3]! * values[ref + 3]! < 0 ? -1 : 1;
      const g = (sign * KERNEL[o + WINDOW]!) / 16;
      x += g * values[i]!;
      y += g * values[i + 1]!;
      z += g * values[i + 2]!;
      w += g * values[i + 3]!;
    }
    const len = Math.hypot(x, y, z, w) || 1;
    out.set([x / len, y / len, z / len, w / len], ref);
  }
  return out;
}

/** Low-passes the trembling rotation tracks of `clip` in place; returns their names. */
export function smoothJitter(clip: THREE.AnimationClip, loop: boolean): string[] {
  const fixed: string[] = [];
  for (const track of clip.tracks) {
    if (!(track instanceof THREE.QuaternionKeyframeTrack) || track.times.length < 8) continue;
    if (zigzagRate(track.values, 4) <= JITTER_ZIGZAG) continue;
    track.values = smoothQuaternions(track.values as Float32Array, loop);
    fixed.push(track.name);
  }
  return fixed;
}
