// The far tier as it streams: the CTL1 chunks decode whole, the packages are lazy over the cell source, and the
// layer keeps the resident mount's contract (position=origin + the quantized scale, cell-local under the render
// root, one shared zero for ao/emissive, matrixAutoUpdate=false through the streamer).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import type { Three } from '@acme/ui/three';
import { parseCityDataset } from '../../../city-dataset.ts';
import { buildVdPort } from '../index.ts';
import { parseCtl1 } from './codec.ts';
import { FAR_GROUND_NAME, FAR_LM_NAME, FAR_NAME, FAR_REACH_M } from './index.ts';
import { setVdFarBytes, vdFarBytes } from './load.ts';
import { loadVdFarFromDisk } from './load-from-disk.test-support.ts';
import { VD_FAR } from './data/manifest.ts';
import { WORLD_PRESETS } from '../../../perf/tier-presets.ts';
import { valdradaToScene } from '../transform.ts';
// @ts-expect-error untyped tooling module
import { toScene } from '../../../../../../../tooling/city/valdrada/decode.mjs';

const T = THREE as unknown as Three;
const HOME = VD_FAR.chunks.filter((c) => (c as { readonly home?: boolean }).home === true);
const DATA = new URL('./data/chunks/', import.meta.url);

const OPTIONS = (preset: (typeof WORLD_PRESETS)[keyof typeof WORLD_PRESETS] | null) => ({
  physical: false, night: 0, groundY: () => 0.14, sunDirection: [0, 1, 0] as const, sunColor: [1, 1, 1] as const, horizon: [0.8, 0.8, 0.9] as const,
  ...(preset ? { preset } : {}),
});
const dataset = () => parseCityDataset(JSON.parse(readFileSync(new URL('../../../data/harlem-apollo.json', import.meta.url), 'utf8')));

test('the bundled home subset is the chunks whose bounds meet the tile square', () => {
  // the tile: extentMeters about the scene origin, back through the same affine
  const aff = VD_FAR.affine;
  const box = { x0: (-850 - aff.ox) / aff.sx, x1: (850 - aff.ox) / aff.sx, z0: (-850 - aff.oz) / aff.sz, z1: (850 - aff.oz) / aff.sz };
  const want = VD_FAR.chunks.filter((c) => c.bounds[2]! >= box.x0 && c.bounds[0]! <= box.x1 && c.bounds[3]! >= box.z0 && c.bounds[1]! <= box.z1);
  assert.deepEqual(want.map((c) => c.f), HOME.map((c) => c.f));
  assert.ok(HOME.length > 0 && HOME.length < VD_FAR.chunks.length, 'a small home subset, not the whole set');
});

test('every bundled chunk file is a CTL1 tile: origin at its cell centre, 1/4 m scale, whole sections', () => {
  assert.ok(HOME.length >= 3, 'home subset present in data/chunks');
  for (const info of HOME) {
    const t = parseCtl1(new Uint8Array(readFileSync(new URL(info.f, DATA))));
    const size = info.lv === 6 ? 8192 : 2048;
    assert.equal(t.header.v, 1, info.f);
    assert.equal(t.header.level, info.lv, info.f);
    assert.equal(t.header.origin[0], info.ci * size + size / 2, info.f);
    assert.equal(t.header.origin[1], info.cj * size + size / 2, info.f);
    assert.equal(t.header.scale, 0.25, info.f);
    const S = t.S;
    const nv = S.pos!.length / 3;
    assert.equal(nv, info.nv, `${info.f} manifest vertex count`);
    assert.equal(S.col!.length, nv * 4, `${info.f} col stride`);
    assert.equal(S.uv!.length, nv * 2, `${info.f} uv stride`);
    assert.equal(S.ao!.length, nv, `${info.f} ao stride`);
    let max = 0;
    for (const i of S.idx!) if (i > max) max = i;
    assert.ok(max < nv, `${info.f} index out of range`);
    assert.equal(S.idx!.length / 3, info.tris, `${info.f} triangle count`);
  }
});

test('streamed: three lazy layers in reach order — bundled chunks ready, fetched chunks not, nothing throws', () => {
  const loaded = loadVdFarFromDisk();
  try {
    const port = buildVdPort(T, dataset(), { ...OPTIONS(WORLD_PRESETS['ipad-a12x']) });
    try {
      const layerOf = (name: string) => port.streamLayers.find((l) => l.template.name === name)!;
      const far = layerOf(FAR_NAME), ground = layerOf(FAR_GROUND_NAME), lm = layerOf(FAR_LM_NAME);
      assert.equal(far.packages.length, VD_FAR.chunks.length, 'one building package per chunk');
      assert.equal(ground.packages.length, VD_FAR.chunks.filter((c) => c.gtris > 0).length, 'ground packages only where the bake has ground');
      assert.equal(lm.packages.length, VD_FAR.landmarks!.entries.length, 'one package per landmark');
      assert.equal(far.spec.reachM, FAR_REACH_M);
      assert.equal(far.spec.sharedMaterial, true);
      assert.equal(far.spec.pin, false);
      assert.equal(far.template.userData.vdShell, 1);
      // the eager set makes its packages ready; a chunk with no bytes anywhere stays unbuilt, never throws
      const eager = loaded ? VD_FAR.chunks.filter((c) => far.packages[VD_FAR.chunks.indexOf(c)]!.ready?.() === true).length : 0;
      assert.ok(eager >= HOME.length, 'the bundled home chunks are ready');
      const missing = far.packages.find((p) => !p.ready?.());
      if (missing) {
        missing.prefetch?.();   // asks the cell source; without a configured base it resolves nothing
        assert.ok(missing.bounds.every(Number.isFinite), 'a not-ready package still reports scene bounds');
      }
      // the ready packages decode: the far attribute layout, and the position=origin + scale contract
      const aff = VD_FAR.affine;
      for (const c of VD_FAR.chunks.slice(0, 40)) {
        const p = far.packages[VD_FAR.chunks.indexOf(c)]!;
        if (!p.ready?.()) continue;
        const attrs = Object.keys(p.attributes).sort();
        assert.deepEqual(attrs, ['ao', 'color', 'emissive', 'position', 'uv'], `${c.f} attributes`);
        assert.equal(p.attributes.position!.array instanceof Int16Array, true, `${c.f} quantized positions kept`);
        const f = p.positionFrame!;
        const [ex, ez] = toScene(c.origin[0]!, c.origin[1]!) as [number, number];
        assert.ok(Math.abs(f.origin[0]! - ex) <= 0.06 && Math.abs(f.origin[2]! - ez) <= 0.06, `${c.f} origin`);
        assert.ok(Math.abs(f.scale![0]! - c.scale * aff.sx) < 1e-9 && Math.abs(f.scale![2]! - c.scale * aff.sz) < 1e-9, `${c.f} scale`);
        assert.equal(f.scale![1], c.scale, `${c.f} y scale`);
        const b = p.bounds;
        assert.ok(b[0]! < b[3]! && b[2]! < b[5]! && b[1]! <= b[4]!, `${c.f} bounds ordered`);
        // the scene-space box covers the chunk's Valdrada square through the affine
        const [x0, z0] = toScene(c.bounds[0]!, c.bounds[1]!) as [number, number];
        assert.ok(Math.abs(b[0]! - x0) <= 0.06 && Math.abs(b[2]! - z0) <= 0.06, `${c.f} bounds origin`);
      }
    } finally {
      port.dispose();
    }
  } finally {
    setVdFarBytes(null);
  }
});

test('resident: no preset mounts the eager set whole — the position=origin + scale contract lands the first vertex', () => {
  const loaded = loadVdFarFromDisk();
  try {
    const port = buildVdPort(T, dataset(), { ...OPTIONS(null) });
    try {
      const aff = VD_FAR.affine;
      const toSceneTs = valdradaToScene(dataset().origin as readonly [number, number]);
      const far = port.group.children.filter((o) => o.name === FAR_NAME);
      const ground = port.group.children.filter((o) => o.name === FAR_GROUND_NAME);
      const lm = port.group.children.filter((o) => o.name === FAR_LM_NAME);
      const mounted = new Set(VD_FAR.chunks.filter((c) => far.some((m) => {
        const [ex, ez] = toSceneTs(c.origin[0]!, c.origin[1]!);
        return Math.abs(m.position.x - ex) <= 0.06 && Math.abs(m.position.z - ez) <= 0.06;
      })).map((c) => c.f));
      assert.equal(far.length, mounted.size, 'one resident mesh per chunk whose bytes are held');
      assert.equal(far.length, VD_FAR.chunks.filter((c) => vdFarBytes()!.chunks.has(c.f)).length);
      assert.equal(ground.length, VD_FAR.chunks.filter((c) => c.gtris > 0 && mounted.has(c.f)).length);
      assert.equal(lm.length, loaded && vdFarBytes()!.landmarks ? VD_FAR.landmarks!.entries.length : 0);
      assert.ok(port.streamLayers.every((l) => l.template.name !== FAR_NAME), 'resident far is never a stream layer');
      for (const c of VD_FAR.chunks) {
        if (!mounted.has(c.f)) continue;
        const [ex, ez] = toSceneTs(c.origin[0]!, c.origin[1]!);
        const m = far.find((x) => Math.abs(x.position.x - ex) <= 0.06 && Math.abs(x.position.z - ez) <= 0.06)!;
        assert.equal(m.matrixAutoUpdate, false);
        assert.equal(m.userData.vdShell, 1);
        assert.ok(Math.abs(m.scale.x - 0.25 * aff.sx) < 1e-9 && Math.abs(m.scale.z - 0.25 * aff.sz) < 1e-9, `${c.f} scale`);
        assert.ok(Math.abs(m.position.y - (VD_FAR.curb - VD_FAR.padY)) < 1e-9, `${c.f} datum`);
      }
    } finally {
      port.dispose();
    }
  } finally {
    setVdFarBytes(null);
  }
});
