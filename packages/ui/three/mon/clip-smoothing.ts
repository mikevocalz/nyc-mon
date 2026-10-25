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

/** Keys added between each pair of authored keys: 30 fps clips play as 120 fps curves. */
export const RESAMPLE = 4;

/**
 * Catmull-Rom through the keys, sampled `RESAMPLE` times per key interval.
 * three.js interpolates quaternions (and, by default, everything else)
 * linearly, so a 30 fps clip on a 120 Hz display moves at one speed for four
 * frames and then jumps to the next: measured on Lil' Ratti's forearm
 * (velocity 1.0 x10, -3.1 x4, -9.7 x4, -12.6 ...), a visible judder over the
 * whole body. A curve through the same keys keeps every authored pose and
 * makes the speed change smoothly.
 */
function resampleTrack(times: Float32Array, values: Float32Array, stride: number, loop: boolean, quaternion: boolean): { times: Float32Array; values: Float32Array } {
  const n = times.length;
  const m = (n - 1) * RESAMPLE + 1;
  const outT = new Float32Array(m);
  const outV = new Float32Array(m * stride);
  // Quaternions: every key in the hemisphere of the one before it, so the curve never takes the long way round.
  const keys = Float32Array.from(values);
  if (quaternion) {
    for (let k = 1; k < n; k++) {
      let dot = 0;
      for (let q = 0; q < 4; q++) dot += keys[k * 4 + q]! * keys[(k - 1) * 4 + q]!;
      if (dot < 0) for (let q = 0; q < 4; q++) keys[k * 4 + q] = -keys[k * 4 + q]!;
    }
  }
  // A looping clip's last key repeats its first: the neighbours wrap past it.
  const at = (k: number) => (loop ? (((k % (n - 1)) + (n - 1)) % (n - 1)) : Math.min(n - 1, Math.max(0, k)));
  const pick = (k: number, q: number, ref: number) => {
    const v = keys[at(k) * stride + q]!;
    if (!quaternion || !loop || (k >= 0 && k < n)) return v;
    // A wrapped quaternion neighbour joins the hemisphere of the key it sits next to.
    let dot = 0;
    for (let c = 0; c < 4; c++) dot += keys[at(k) * stride + c]! * keys[ref * stride + c]!;
    return dot < 0 ? -v : v;
  };
  for (let k = 0; k < n - 1; k++) {
    for (let s = 0; s < RESAMPLE; s++) {
      const i = k * RESAMPLE + s;
      const u = s / RESAMPLE;
      outT[i] = times[k]! + (times[k + 1]! - times[k]!) * u;
      const u2 = u * u;
      const u3 = u2 * u;
      for (let q = 0; q < stride; q++) {
        const p0 = pick(k - 1, q, k);
        const p1 = keys[k * stride + q]!;
        const p2 = keys[(k + 1) * stride + q]!;
        const p3 = pick(k + 2, q, k + 1);
        outV[i * stride + q] = 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
      }
    }
  }
  outT[m - 1] = times[n - 1]!;
  for (let q = 0; q < stride; q++) outV[(m - 1) * stride + q] = keys[(n - 1) * stride + q]!;
  if (quaternion) {
    for (let i = 0; i < m; i++) {
      const o = i * 4;
      const len = Math.hypot(outV[o]!, outV[o + 1]!, outV[o + 2]!, outV[o + 3]!) || 1;
      for (let q = 0; q < 4; q++) outV[o + q] = outV[o + q]! / len;
    }
  }
  return { times: outT, values: outV };
}

/** Replaces each multi-key track of `clip` with its smooth curve, sampled at four times the key rate. */
export function resampleSmooth(clip: THREE.AnimationClip, loop: boolean): void {
  for (const track of clip.tracks) {
    if (track.times.length < 3) continue;
    const stride = track.getValueSize();
    const quaternion = track instanceof THREE.QuaternionKeyframeTrack;
    if (!quaternion && !(track instanceof THREE.VectorKeyframeTrack) && !(track instanceof THREE.NumberKeyframeTrack)) continue;
    const r = resampleTrack(track.times as Float32Array, track.values as Float32Array, stride, loop, quaternion);
    track.times = r.times;
    track.values = r.values;
  }
}

/** How long before a loop's end its keys are eased toward its first pose. */
export const LOOP_CLOSE_S = 0.4;

const smoothstep = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/**
 * Makes a looping clip meet itself. Lil' Ratti's emote_tired ends 0.058 away
 * from where it starts on both forearms, so every 2.2 s, as the loop
 * restarted, the arms snapped in one frame. Over the last {@link LOOP_CLOSE_S}
 * each track is eased (smoothstep) onto its first key: a rotation by the
 * correction that takes the last key to the first, scaled by the ease; a
 * number or vector by the offset. A clip that already meets is unchanged.
 */
export function closeLoop(clip: THREE.AnimationClip): void {
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const fix = new THREE.Quaternion();
  const part = new THREE.Quaternion();
  const id = new THREE.Quaternion();
  for (const track of clip.tracks) {
    const n = track.times.length;
    if (n < 3) continue;
    const t = track.times;
    const v = track.values;
    const stride = track.getValueSize();
    const end = t[n - 1]!;
    const start = Math.max(t[0]!, end - LOOP_CLOSE_S);
    const last = (n - 1) * stride;
    if (track instanceof THREE.QuaternionKeyframeTrack) {
      qa.fromArray(v, 0);
      qb.fromArray(v, last);
      if (qa.angleTo(qb) < 1e-4) continue;
      fix.copy(qa).multiply(qb.invert()); // fix * last = first
      for (let k = 0; k < n; k++) {
        if (t[k]! <= start) continue;
        const w = smoothstep((t[k]! - start) / (end - start));
        part.copy(id).slerp(fix, w);
        qb.fromArray(v, k * 4);
        qb.premultiply(part).toArray(v, k * 4);
      }
    } else {
      const offset = Array.from({ length: stride }, (_, q) => v[q]! - v[last + q]!);
      if (offset.every((d) => Math.abs(d) < 1e-6)) continue;
      for (let k = 0; k < n; k++) {
        if (t[k]! <= start) continue;
        const w = smoothstep((t[k]! - start) / (end - start));
        for (let q = 0; q < stride; q++) v[k * stride + q] = v[k * stride + q]! + offset[q]! * w;
      }
    }
  }
}
