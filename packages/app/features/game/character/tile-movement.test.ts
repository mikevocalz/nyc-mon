// Movement on the real bundled tile, from the Surface Duo report "why am I
// stuck on corner!" (2026-10-16). Each case replays a held stick through
// stepGameFrame, the same function the frame loop runs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { INITIAL_CITY_CAMERA } from '../city-camera.ts';
import { parseCityDataset } from '../city-dataset.ts';
import { createStreetAxisIndex, streetAxisLookupFor } from '../street-axes.ts';
import { pairs } from '../world/geometry.ts';
import { createWalkQueries } from '../world/walkability.ts';
import { RELEASED_CONTROLS, spawnCaller, stepGameFrame, type CallerControls, type GameFrame } from './caller-controller.ts';
import { INITIAL_CALLER_STATE } from './caller-store.ts';
import { RUN_SPEED, WALK_SPEED, slideMove } from './locomotion.ts';

const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
const world = createWalkQueries(dataset);
const streets = streetAxisLookupFor(createStreetAxisIndex(dataset.roads));
const stick = (x: number, y: number): CallerControls => ({ ...RELEASED_CONTROLS, stickX: x, stickY: y, engaged: true });

/** Runs `frames` frames at 60 fps; returns the end frame and the longest run of frames the held stick moved nothing. */
function hold(start: GameFrame, controls: CallerControls, frames: number): { frame: GameFrame; longestStall: number } {
  let f = start;
  let stall = 0;
  let longestStall = 0;
  for (let i = 0; i < frames; i++) {
    const before = f.caller;
    f = stepGameFrame(f, controls, 1 / 60, false, world, streets);
    if (Math.hypot(f.caller.x - before.x, f.caller.z - before.z) < 1e-4) longestStall = Math.max(longestStall, ++stall);
    else stall = 0;
  }
  return { frame: f, longestStall };
}

const spawn = (): GameFrame => spawnCaller(INITIAL_CALLER_STATE, INITIAL_CITY_CAMERA, world)!;

test('holding up from the Apollo spawn keeps walking past the end of the straight sidewalk', () => {
  // The spawn view looks due west (yaw π/2); West 125th runs 29° off it. The
  // push used to stop dead at (-86.38, 22.00) after 14.5 s, where the
  // sidewalk edge crosses the straight line.
  const start = spawn();
  assert.deepEqual([start.caller.x, start.caller.z], [-28, 22]);
  const { frame, longestStall } = hold(start, stick(0, 1), 30 * 60);
  assert.ok(longestStall < 30, `stalled ${longestStall} frames, at (${frame.caller.x.toFixed(2)}, ${frame.caller.z.toFixed(2)})`);
  assert.ok(frame.caller.x < -100, `only reached x = ${frame.caller.x.toFixed(2)}`);
});

test('at every building corner near the Apollo, a push with somewhere to go goes there', () => {
  // Every convex or concave footprint vertex within 400 m of the spawn. The
  // Caller stands 0.7 m out along the corner's bisector and pushes for 2 s in
  // 16 directions at walk and at run. A push counts as free when some
  // direction within 75° of it is clear for 0.5 m; a free push must move.
  const [sx, sz] = [INITIAL_CITY_CAMERA.x, INITIAL_CITY_CAMERA.z];
  const stuck: string[] = [];
  let corners = 0;
  for (const b of dataset.buildings) {
    const ring = pairs(b.ring);
    if (ring.length > 1 && ring[0]![0] === ring.at(-1)![0] && ring[0]![1] === ring.at(-1)![1]) ring.pop();
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i]!;
      if (Math.hypot(p[0] - sx, p[1] - sz) > 400) continue;
      const a = ring[(i - 1 + ring.length) % ring.length]!;
      const c = ring[(i + 1) % ring.length]!;
      const l1 = Math.hypot(p[0] - a[0], p[1] - a[1]);
      const l2 = Math.hypot(c[0] - p[0], c[1] - p[1]);
      if (l1 < 0.5 || l2 < 0.5) continue;
      let bx = (a[0] - p[0]) / l1 + (c[0] - p[0]) / l2;
      let bz = (a[1] - p[1]) / l1 + (c[1] - p[1]) / l2;
      const bl = Math.hypot(bx, bz);
      if (bl < 1e-6) continue;
      bx /= bl; bz /= bl;
      const start = [1, -1].map((side) => [p[0] + side * bx * 0.7, p[1] + side * bz * 0.7] as const).find(([x, z]) => world.isWalkable(x, z));
      if (!start) continue;
      corners++;
      for (let k = 0; k < 16; k++) {
        const angle = (k / 16) * Math.PI * 2;
        const ux = Math.sin(angle); const uz = Math.cos(angle);
        let free = false;
        for (let j = 0; j < 72 && !free; j++) {
          const va = (j / 72) * Math.PI * 2;
          const vx = Math.sin(va); const vz = Math.cos(va);
          if (vx * ux + vz * uz < 0.25) continue;
          free = true;
          for (let t = 0.05; t <= 0.5 && free; t += 0.05) free = world.isWalkable(start[0] + vx * t, start[1] + vz * t);
        }
        if (!free) continue;
        for (const speed of [WALK_SPEED, RUN_SPEED]) {
          let x = start[0]; let z = start[1];
          for (let f = 0; f < 120; f++) ({ x, z } = slideMove(x, z, (ux * speed) / 60, (uz * speed) / 60, world.isWalkable));
          if (Math.hypot(x - start[0], z - start[1]) < 0.05) stuck.push(`${b.id} corner (${p[0].toFixed(1)}, ${p[1].toFixed(1)}) push ${(angle * 180 / Math.PI).toFixed(1)}° at ${speed} m/s`);
        }
      }
    }
  }
  assert.ok(corners > 300, `swept ${corners} corners`);
  assert.deepEqual(stuck, []);
});

test('turning the corner onto Frederick Douglass Boulevard under a held stick never stalls', () => {
  // The steering latch (block-settle.ts) keeps the old frame while the corner
  // settle swings the camera. Guard: after the turn, holding the turn, rolling
  // the stick 40° back toward up (inside the 45° relatch) and swapping to up
  // all keep walking.
  let f = hold(spawn(), stick(0, 0.6), 30).frame;
  f = hold(f, RELEASED_CONTROLS, 120).frame; // the view settles onto West 125th
  let n = 0;
  while (f.caller.x > -104 && n++ < 6000) f = stepGameFrame(f, stick(0, 0.6), 1 / 60, false, world, streets);
  for (const side of [1, -1]) {
    const turned = hold(f, stick(side * 0.6, 0), 180);
    assert.ok(turned.longestStall < 30, `turn ${side}: stalled ${turned.longestStall} frames`);
    assert.ok(Math.abs(turned.frame.chase.settle.steerOffset) > 1, 'the corner settle ran under the held stick');
    const roll = side * (50 * Math.PI) / 180;
    for (const controls of [stick(side * 0.6, 0), stick(Math.sin(roll) * 0.6, Math.cos(roll) * 0.6), stick(0, 0.6)]) {
      const { frame, longestStall } = hold(turned.frame, controls, 180);
      const moved = Math.hypot(frame.caller.x - turned.frame.caller.x, frame.caller.z - turned.frame.caller.z);
      assert.ok(longestStall < 30 && moved > 3, `turn ${side}, stick (${controls.stickX.toFixed(2)}, ${controls.stickY.toFixed(2)}): moved ${moved.toFixed(2)} m, stalled ${longestStall} frames`);
    }
  }
});
