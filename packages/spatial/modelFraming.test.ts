import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { viroReadableGlb } from './glbDequantize.ts';
import { readModelPoints } from './modelBounds.ts';
import { clampPitch, FILL, MAX_PITCH, previewCamera, turnExtent } from './modelFraming.ts';

const RAD = Math.PI / 180;

/** Largest share of the frame's height and width the points cover, over every yaw and pitch the stage allows. */
function worstFill(points: Float32Array, scale: number, width: number, height: number) {
  const extent = turnExtent(points, scale);
  let vertical = 0;
  let horizontal = 0;
  for (let pitch = -MAX_PITCH; pitch <= MAX_PITCH; pitch += 2.5) {
    const camera = previewCamera(extent, [0, 0, 0], width, height, pitch);
    const visibleHeight = camera.orthographicScale;
    const visibleWidth = visibleHeight * (width / height);
    const p = pitch * RAD;
    for (let yaw = 0; yaw < 360; yaw += 7.5) {
      const ys = Math.sin(yaw * RAD);
      const yc = Math.cos(yaw * RAD);
      for (let i = 0; i < points.length; i += 3) {
        const x = points[i]! * scale;
        const z = points[i + 2]! * scale;
        const dy = points[i + 1]! * scale - extent.middle;
        const tx = x * yc + z * ys;
        const tz = -x * ys + z * yc;
        vertical = Math.max(vertical, Math.abs(dy * Math.cos(p) - tz * Math.sin(p)) / (visibleHeight / 2));
        horizontal = Math.max(horizontal, Math.abs(tx) / (visibleWidth / 2));
      }
    }
  }
  return { vertical, horizontal };
}

/** A box of points from (-w, 0, -d) to (w, h, d). */
function box(w: number, h: number, d: number): Float32Array {
  const out: number[] = [];
  for (const x of [-w, w]) for (const y of [0, h]) for (const z of [-d, d]) out.push(x, y, z);
  return new Float32Array(out);
}

describe('previewCamera', () => {
  it('fills about FILL of the height with a tall model, the same at any size', () => {
    const fillOf = (points: Float32Array, scale: number, tall: number) =>
      (tall * scale) / previewCamera(turnExtent(points, scale), [0, 0, 0], 400, 450, 0).orthographicScale;
    const egg = fillOf(box(0.02, 0.15, 0.02), 1, 0.15);
    // Level, the height is FILL less the room kept for tilting the camera MAX_PITCH degrees.
    assert.ok(egg <= FILL && egg > 0.75, `egg ${egg}`);
    assert.ok(Math.abs(fillOf(box(0.02, 0.15, 0.02), 3, 0.15) - egg) < 1e-6);
    assert.ok(Math.abs(fillOf(box(0.24, 1.8, 0.24), 1, 1.8) - egg) < 1e-6);
  });

  it('frames by width when a turn swings the model wider than it is tall', () => {
    const wide = box(1, 0.5, 0.1);
    const extent = turnExtent(wide, 1);
    const { orthographicScale } = previewCamera(extent, [0, 0, 0], 400, 400, 0);
    // Reach is the corner's distance from the axis, the half-width at its worst yaw.
    assert.ok(Math.abs(orthographicScale - (2 * Math.hypot(1, 0.1)) / FILL) < 1e-6);
  });

  it('never lets any yaw or pitch push a shipped Mon past FILL', () => {
    for (const [name, pose] of [['squeaklet', 'bind'], ['squeaklet', 'viro-still'], ['lil-ratti', 'bind'], ['lil-ratti', 'viro-still'], ['metro-egg', 'bind']] as const) {
      const points = readModelPoints(viroReadableGlb(new Uint8Array(readFileSync(new URL(`../../apps/web/public/mons/${name}.glb`, import.meta.url)))), pose)!;
      for (const [width, height] of [[413, 448], [800, 448], [360, 320]] as const) {
        const { vertical, horizontal } = worstFill(points, 1, width, height);
        assert.ok(vertical <= FILL + 1e-6, `${name} ${width}x${height} vertical ${vertical}`);
        assert.ok(horizontal <= FILL + 1e-6, `${name} ${width}x${height} horizontal ${horizontal}`);
        // And it is framed by one of the two: something touches FILL.
        assert.ok(Math.max(vertical, horizontal) > FILL - 0.01, `${name} ${width}x${height} fills ${Math.max(vertical, horizontal)}`);
      }
    }
  });

  it('orbits the middle of the model and keeps the same frame at every pitch', () => {
    const extent = turnExtent(box(0.1, 0.4, 0.1), 1);
    const level = previewCamera(extent, [1, 2, 3], 400, 400, 0);
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
    assert.ok(level.focalPoint.every((v, i) => near(v, [1, 2.2, 3][i]!)), String(level.focalPoint));
    assert.ok(near(level.position[1], 2.2));
    const tilted = previewCamera(extent, [1, 2, 3], 400, 400, 10);
    assert.ok(tilted.position[1] > 2.21);
    assert.equal(tilted.orthographicScale, level.orthographicScale);
    const beyond = previewCamera(extent, [1, 2, 3], 400, 400, 90);
    assert.deepEqual(beyond.position, previewCamera(extent, [1, 2, 3], 400, 400, MAX_PITCH).position);
  });

  it('points the camera at the model at every pitch', () => {
    const extent = turnExtent(box(0.1, 0.4, 0.1), 1);
    for (const pitch of [-MAX_PITCH, -7, 0, 7, MAX_PITCH]) {
      const camera = previewCamera(extent, [0, 0, 0], 400, 400, pitch);
      // Viro cameras look down -Z; rotating by x degrees about X gives (0, sin x, -cos x).
      const x = camera.rotation[0] * RAD;
      const forward = [0, Math.sin(x), -Math.cos(x)];
      const to = camera.focalPoint.map((v, i) => v - camera.position[i]!);
      const length = Math.hypot(...to);
      to.forEach((v, i) => assert.ok(Math.abs(v / length - forward[i]!) < 1e-9, `pitch ${pitch} axis ${i}`));
    }
  });

  it('clamps pitch and treats junk as level', () => {
    assert.equal(clampPitch(MAX_PITCH + 40), MAX_PITCH);
    assert.equal(clampPitch(-MAX_PITCH - 40), -MAX_PITCH);
    assert.equal(clampPitch(Number.NaN), 0);
  });
});
