// Lane A's port against Valdrada's own numbers: every structure's built geometry (decoded through the runtime codec, as
// the streamer builds it) against the box of Valdrada's own output for it, the Apollo against w125cKit.js AP33, both
// materials through three's WGSL builder, and the near layer through the cell streamer.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import type { Three } from '@acme/ui/three';
import { WORLD_PRESETS } from '../../../perf/tier-presets.ts';
import { createCellStream } from '../../cells/cell-stream.ts';
import { buildVdPort } from '../index.ts';
import { decodeNearCell, decodeShellCell, type ShellCellInfo } from './codec.ts';
import { NEAR_NAME, SHELL_NAME, vdHiddenBuildings } from './index.ts';
import { setVdBlockBytes } from './load.ts';
import { makeBlocksMaterial } from './shell-material.ts';
import { VD_BLOCKS } from './data/manifest.ts';
import { parseCityDataset } from '../../../city-dataset.ts';

const T = THREE as unknown as Three;
const DATA = new URL('./data/', import.meta.url);
const shellBytes = new Uint8Array(readFileSync(new URL('shell.bin', DATA)));
const nearBytes = new Map(VD_BLOCKS.near.map((c) => [c.key, new Uint8Array(readFileSync(new URL(`near/${c.key}.bin`, DATA)))]));
const A = VD_BLOCKS.affine;
const toScene = (x: number, z: number): [number, number] => [x * A.sx + A.ox, z * A.sz + A.oz];

/** Every vertex the structure's index ranges reach, over all its cells, decoded as the streamer decodes them. */
function structureVertices(id: string): number[][] {
  const out: number[][] = [];
  for (const cell of VD_BLOCKS.near) {
    const ranges = (cell.ranges as readonly (readonly [string, number, number])[]).filter((r) => r[0] === id);
    if (!ranges.length) continue;
    const a = decodeNearCell(nearBytes.get(cell.key)!, cell.cx, cell.cz);
    for (const [, start, count] of ranges) {
      for (let i = start; i < start + count; i++) {
        const v = a.index[i]!;
        out.push([a.position[v * 3]!, a.position[v * 3 + 1]!, a.position[v * 3 + 2]!]);
      }
    }
  }
  return out;
}

test('every structure in bounds matches the box of Valdrada\'s own output within 5 cm', () => {
  assert.equal(VD_BLOCKS.structures.length, 175);
  let worst = 0, worstId = '';
  for (const s of VD_BLOCKS.structures) {
    const vs = structureVertices(s.id);
    assert.ok(vs.length > 0, `${s.id}: no geometry`);
    const got = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const [x, y, z] of vs) { got[0] = Math.min(got[0]!, x!); got[1] = Math.min(got[1]!, y!); got[2] = Math.min(got[2]!, z!); got[3] = Math.max(got[3]!, x!); got[4] = Math.max(got[4]!, y!); got[5] = Math.max(got[5]!, z!); }
    // Valdrada's box (world metres, its height datum) in the scene: x, z through the transform, y over its pavement
    const [x0, z0] = toScene(s.vbox[0], s.vbox[2]), [x1, z1] = toScene(s.vbox[3], s.vbox[5]);
    const dy = VD_BLOCKS.curb - s.base;
    const want = [x0, s.vbox[1] + dy, z0, x1, s.vbox[4] + dy, z1];
    for (let k = 0; k < 6; k++) {
      const d = Math.abs(got[k]! - want[k]!);
      if (d > worst) { worst = d; worstId = `${s.id}[${k}]`; }
    }
  }
  assert.ok(worst <= 0.05, `worst box edge ${worst.toFixed(3)} m at ${worstId}`);
});

test('the Apollo is w125cKit.js buildApollo33: a 5.9 m marquee topped at 5.08 m with no rail, the blade to 20.5 m', () => {
  // w125cData.js APOLLO: the compiled frontage's west and east ends; out over the sidewalk is (-uz, ux) (w125c.js)
  const [wx, wz] = toScene(1769.0, -2981.7), [ex, ez] = toScene(1781.9, -2974.7);
  const L = Math.hypot(ex - wx, ez - wz), ux = (ex - wx) / L, uz = (ez - wz) / L, nx = -uz, nz = ux;
  const ap = VD_BLOCKS.structures.find((s) => s.id === 'fk:w125-253')!;
  const walk = VD_BLOCKS.curb;   // the Apollo's pavement, re-seated on the sidewalk
  const vs = structureVertices(ap.id).map(([x, y, z]) => {
    const dx = x! - wx, dz = z! - wz;
    return { u: dx * ux + dz * uz, w: dx * nx + dz * nz, y: y! - walk };
  });
  // triangles as their (u, w, y) boxes; the marquee's slabs are large quads with vertices only at their ends
  const tris: { u0: number; u1: number; w0: number; w1: number; y0: number; y1: number }[] = [];
  for (let i = 0; i + 2 < vs.length; i += 3) {
    const t = [vs[i]!, vs[i + 1]!, vs[i + 2]!];
    tris.push({ u0: Math.min(...t.map((p) => p.u)), u1: Math.max(...t.map((p) => p.u)), w0: Math.min(...t.map((p) => p.w)), w1: Math.max(...t.map((p) => p.w)), y0: Math.min(...t.map((p) => p.y)), y1: Math.max(...t.map((p) => p.y)) });
  }
  // AP33.mq: u -0.4..7.25, y 3.05..5.05, 5.9 deep with 0.3 m rounded street corners, a 3 cm lid on top
  const mq = tris.filter((t) => t.w1 > 1 && t.y0 > 2.9 && t.y1 < 5.2);
  // the neon outline runs on mqPath(-0.062), 6.2 cm proud of the 5.9 m slabs: that is the marquee's outermost line
  const depth = Math.max(...mq.map((t) => t.w1));
  assert.ok(Math.abs(depth - (5.9 + 0.062)) <= 0.05, `marquee depth ${depth.toFixed(3)} m`);
  const lid = tris.filter((t) => t.w0 < 1 && t.w1 > 5 && t.u0 < 0 && t.u1 > 7 && t.y1 < 5.5);
  assert.ok(lid.length > 0, 'the marquee lid spans the marquee');
  const top = Math.max(...lid.map((t) => t.y1));
  assert.ok(Math.abs(top - (5.05 + 0.03)) <= 0.05, `marquee top ${top.toFixed(3)} m`);
  // Nothing stands on the marquee between its end crests (AP33.crest at u0 + 0.03..0.33 and u1 - 0.33..0.03) below the
  // blade: a rail along its front would be here. The blade's pilaster (u 3.47) carries its stay rod and lower arm.
  const rail = tris.filter((t) => t.w1 > 1.0 && t.w0 < 5.95 && t.u1 > -0.4 + 0.4 && t.u0 < 7.25 - 0.4
    && !(t.u0 > 3.47 - 0.3 && t.u1 < 3.47 + 0.3) && t.y1 > 5.08 + 0.05 && t.y0 < 10.0);
  assert.equal(rail.length, 0, `${rail.length} triangles over the marquee: ${JSON.stringify(rail.slice(0, 2))}`);
  // the end crests are there: 0.86 m tall cream housings with APOLLO in channel letters
  const crests = tris.filter((t) => t.y1 > 5.08 + 0.6 && t.y1 < 6.0 && t.w1 > 1 && (t.u1 < -0.4 + 0.4 || t.u0 > 7.25 - 0.4));
  assert.ok(crests.length > 0, 'the two end crests stand on the marquee');
  // AP33.blade: u 3.47, out 0.95..2.65, y 10.2..20.5 (its white top trim 2 cm over)
  const blade = vs.filter((p) => Math.abs(p.u - 3.47) < 0.3 && p.w > 0.9 && p.w < 2.75);
  const bladeTop = Math.max(...blade.map((p) => p.y));
  assert.ok(Math.abs(bladeTop - 20.52) <= 0.05, `blade top ${bladeTop.toFixed(3)} m`);
  // it replaces the bundled tile's Apollo (osm:way:271798914)
  assert.deepEqual(ap.replaces, ['osm:way:271798914']);
});

test('the shell cells decode to Valdrada\'s persistent-tier triangles, at most 2000 a structure', () => {
  let tris = 0;
  for (const info of VD_BLOCKS.shell as readonly ShellCellInfo[]) {
    const a = decodeShellCell(shellBytes, info);
    assert.equal(a.position.length, info.vertices * 3);
    assert.equal(info.vertices, info.triangles * 3, 'per-face vertices');
    tris += info.triangles;
  }
  assert.equal(tris, VD_BLOCKS.totals.trisShell);
  for (const s of VD_BLOCKS.structures) assert.ok(s.trisShell <= 2000, `${s.id}: ${s.trisShell}`);
});

test('the blocks material (shell and near level) builds to WGSL with no WebGL-only API', async () => {
  const canvas = { width: 300, height: 150, style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null } as unknown as HTMLCanvasElement;
  const renderer = new THREE.WebGPURenderer({ canvas });
  await renderer.init().catch(() => undefined);
  (renderer as unknown as { backend: { capabilities: unknown } }).backend.capabilities = { getUniformBufferLimit: () => 65_536 };
  (renderer as unknown as { hasFeature: () => boolean }).hasFeature = () => false;
  type Builder = { scene: unknown; camera: unknown; material: unknown; context: { material: unknown }; fogNode: unknown; build(): void; fragmentShader?: string };
  const WGSLNodeBuilder = (THREE as unknown as { WGSLNodeBuilder: new (object: unknown, renderer: unknown) => Builder }).WGSLNodeBuilder;
  const env = {
    night: THREE.TSL.uniform(0.5), wet: THREE.TSL.uniform(0), snow: THREE.TSL.uniform(0), sunDir: THREE.TSL.vec3(0, 1, 0),
    sunColor: THREE.TSL.vec3(1, 0.93, 0.82), skyAmbient: THREE.TSL.vec3(0.5, 0.6, 0.75), fogColor: THREE.TSL.vec3(0.78, 0.83, 0.9), reflGain: THREE.TSL.float(1),
  } as never;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  // (a textured material needs a GPU to sample in this builder: the graph is built without the FW14 grid's sample)
  for (const [name, material, attrs] of [
    ['blocks', makeBlocksMaterial(T, env, null), ['position', 'color', 'emissive', 'uv']],
  ] as const) {
    const g = new THREE.BufferGeometry();
    for (const a of attrs) g.setAttribute(a, new THREE.BufferAttribute(new Float32Array(a === 'uv' ? 6 : a === 'position' ? 9 : 12), a === 'uv' ? 2 : a === 'position' ? 3 : 4));
    const mesh = new THREE.Mesh(g, material);
    const b = new WGSLNodeBuilder(mesh, renderer);
    b.scene = scene; b.camera = camera; b.material = material; b.context.material = material; b.fogNode = null;
    b.build();
    const wgsl = b.fragmentShader ?? '';
    assert.ok(wgsl.length > 0 && wgsl.length < 40_000, `${name}: ${wgsl.length} chars`);
    assert.doesNotMatch(wgsl, /gl_FragCoord|texture2D|#include/, `${name} carries GLSL`);
  }
});

test('the port builds: shells resident, the near layer streamed under its own budget, the shell yielding to it', () => {
  setVdBlockBytes({ shell: shellBytes, near: nearBytes, level: 'near' });
  try {
    const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../../../data/harlem-apollo.json', import.meta.url), 'utf8')));
    assert.ok(vdHiddenBuildings()!.has('osm:way:271798914'), 'the Apollo leaves the city mesh');
    const port = buildVdPort(T, dataset, { physical: false, night: 0, groundY: () => 0.14, sunDirection: [0, 1, 0], sunColor: [1, 1, 1], horizon: [0.8, 0.8, 0.9] });
    const world = new THREE.Group();
    world.add(port.group);
    const shells = port.group.children.filter((o) => o.name === SHELL_NAME);
    assert.equal(shells.length, VD_BLOCKS.shell.length);
    assert.equal(port.streamLayers.length, 1);
    const preset = WORLD_PRESETS['ipad-a12x'];
    const stream = createCellStream(T, [], { preset, external: port.streamLayers });
    // At the Apollo's door: K for a 1536 px buffer at 60 deg
    const k = 1536 / (2 * Math.tan(Math.PI / 6));
    const [ax, az] = toScene(1775.45, -2978.2);
    stream.prime({ x: ax, y: 1.7, z: az + 10 }, k, 200);
    const near = port.group.children.filter((o) => o.name === NEAR_NAME && o.userData.cell !== undefined);
    assert.ok(near.length > 0, 'near cells built at the Apollo');
    assert.ok(stream.stats.triangles <= WORLD_PRESETS['ipad-a12x'].vdPort.blocksNear.triangles, `${stream.stats.triangles} near triangles`);
    // the mask starts on the third update (the first two draw every shell through the START compile)
    for (let i = 0; i < 3; i++) port.update(0);
    const hidden = shells.filter((m) => !m.visible).length;
    assert.equal(hidden, near.length, 'each resident near cell hides the shell cell under it');
    // walk away: everything evicts, the decoded arrays go with it, the shells come back
    for (let t = 1; t < 30; t++) stream.update({ x: ax + 2000, y: 1.7, z: az + 2000 }, k, t);
    port.update(30);
    assert.equal(stream.stats.cells, 0);
    assert.ok(shells.every((m) => m.visible));
    stream.dispose();
    port.dispose();
  } finally {
    setVdBlockBytes(null);
  }
});

test('lane B leaves the facade kit\'s fronts to lane A once the packs are in, and keeps every other front', async () => {
  const { VD_STOREFRONT_PLAN } = await import('../storefronts/plan.generated.ts');
  const { vdBlocksOwn } = await import('./index.ts');
  const own = (f: (typeof VD_STOREFRONT_PLAN.fronts)[number]) =>
    vdBlocksOwn(f.src === 0 ? f.id : null, f.p0[0]! + f.u[0]! * f.len / 2 - f.n[0]! * 0.5, f.p0[1]! + f.u[1]! * f.len / 2 - f.n[1]! * 0.5);
  assert.equal(VD_STOREFRONT_PLAN.fronts.filter(own).length, 0, 'without the packs lane B draws everything');
  setVdBlockBytes({ shell: shellBytes, near: nearBytes, level: 'near' });
  try {
    const owned = VD_STOREFRONT_PLAN.fronts.filter(own);
    const specFronts = VD_STOREFRONT_PLAN.fronts.filter((f) => f.src === 0);
    const bakedSpecs = new Set(VD_BLOCKS.structures.filter((s) => s.kind === 'fk').map((s) => s.id.slice(3)));
    const spec = specFronts.filter((f) => bakedSpecs.has(f.id.split('#')[0]!));
    assert.ok(spec.length > 0 && spec.every(own), `${spec.length} kit faces, all lane A's`);
    const kept = VD_STOREFRONT_PLAN.fronts.length - owned.length;
    assert.ok(kept > 0, `${kept} fronts stay with lane B`);
  } finally {
    setVdBlockBytes(null);
  }
});
