// The facelift's LED streetlights (facelift.ts FACELIFT_STREETLIGHT) on the
// two emissive layers under the lamps: the furniture lamps' pools
// (world/index.ts) and the living city's dusk halos and pools
// (living-city/lamp-viz.ts). With the facelift off both keep sodium. The
// streetlamp PointLights take the same LED colour (night-lights.test.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { physicalFacelift } from '@acme/theme';
import { parseCityDataset } from '../../city-dataset.ts';
import { createLampActor } from '../../living-city/lamp-viz.ts';
import { buildCityWorld } from '../index.ts';
import { linearColor } from '../materials.ts';
import { hexToRgb } from '../palette.ts';
import { syntheticTileV3 } from '../synthetic-tile.ts';
import { createFaceliftLampPools, FACELIFT_STREETLIGHT, srgbToLinear } from './facelift.ts';

type Rgb = readonly [number, number, number];
type Mat = InstanceType<typeof THREE.Material> & { colorNode?: unknown };

/** Every colour constant in a node graph, as rgb triples (THREE.Color and vec3 constants). */
function constColours(node: unknown): Rgb[] {
  const out: Rgb[] = [];
  (node as { traverse(cb: (n: { value?: unknown }) => void): void }).traverse((n) => {
    const v = n.value as { isColor?: boolean; isVector3?: boolean; r: number; g: number; b: number; x: number; y: number; z: number } | undefined;
    if (v?.isColor) out.push([v.r, v.g, v.b]);
    else if (v?.isVector3) out.push([v.x, v.y, v.z]);
  });
  return out;
}
const near = (a: Rgb, b: Rgb) => a.every((v, i) => Math.abs(v - b[i]!) < 1e-6);
const hasColour = (node: unknown, rgb: Rgb) => constColours(node).some((c) => near(c, rgb));

const sodium = (): Rgb => { const c = linearColor(THREE, 'lampHalo'); return [c.r, c.g, c.b]; };
const LED = FACELIFT_STREETLIGHT.linear;

test('the LED colour is the streetLed token in scene-linear, bluer than red where sodium is the reverse', () => {
  assert.equal(FACELIFT_STREETLIGHT.color, physicalFacelift.streetLed);
  assert.deepEqual(LED, hexToRgb(physicalFacelift.streetLed).map(srgbToLinear));
  assert.ok(LED[2] > LED[0], `LED ${LED}`);
  const s = sodium();
  assert.ok(s[0] > s[2], `sodium ${s}`);
});

test('the LED pool material carries the LED colour and not sodium', () => {
  const pools = createFaceliftLampPools(THREE) as Mat;
  assert.ok(hasColour(pools.colorNode, LED));
  assert.ok(!hasColour(pools.colorNode, sodium()));
  assert.equal(pools.blending, THREE.AdditiveBlending);
  pools.dispose();
});

function lampPoolMaterial(options: { physical: boolean; future: boolean }): Mat {
  const world = buildCityWorld(THREE, parseCityDataset(syntheticTileV3()), { ...options, pbr: options.physical });
  let found: Mat | null = null;
  world.group.traverse((o) => { if (o.name === 'city:lamp-pools') found = (o as InstanceType<typeof THREE.Mesh>).material as Mat; });
  assert.ok(found, 'city:lamp-pools');
  world.dispose();
  return found;
}

test('world: physical + future pools the furniture lamps in LED; physical alone and flag off keep sodium', () => {
  const led = lampPoolMaterial({ physical: true, future: true });
  assert.ok(hasColour(led.colorNode, LED), 'physical + future');
  assert.ok(!hasColour(led.colorNode, sodium()));
  for (const options of [{ physical: true, future: false }, { physical: false, future: true }, { physical: false, future: false }]) {
    const pools = lampPoolMaterial(options);
    assert.ok(hasColour(pools.colorNode, sodium()), JSON.stringify(options));
    assert.ok(!hasColour(pools.colorNode, LED), JSON.stringify(options));
  }
});

test('lamp actor: halos and pools take the given colour, and keep the sodium pair without one', () => {
  const materialsOf = (color?: Rgb) => {
    const actor = createLampActor({ read: () => null, placements: [], ...(color ? { color } : {}) })(THREE);
    const mats = new Map<string, Mat>();
    (actor.object as InstanceType<typeof THREE.Group>).traverse((o) => {
      if ((o as InstanceType<typeof THREE.Mesh>).isMesh) mats.set(o.name, (o as InstanceType<typeof THREE.Mesh>).material as Mat);
    });
    return { mats, actor };
  };
  const led = materialsOf(LED);
  for (const name of ['living-city:lamp-glows', 'living-city:lamp-pools']) assert.ok(hasColour(led.mats.get(name)!.colorNode, LED), name);
  led.actor.dispose();
  const warm = materialsOf();
  assert.ok(hasColour(warm.mats.get('living-city:lamp-glows')!.colorNode, [1.0, 0.82, 0.55]));
  assert.ok(hasColour(warm.mats.get('living-city:lamp-pools')!.colorNode, [1.0, 0.85, 0.6]));
  assert.equal(warm.mats.size, 2);
  for (const m of warm.mats.values()) assert.ok(!hasColour(m.colorNode, LED));
  warm.actor.dispose();
});
