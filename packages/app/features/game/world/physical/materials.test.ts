// The physical lane's materials end to end on the real tile: every graph
// builds to WGSL with its attributes bound (N3-adjacent compile check), the
// draw count is the one the handoff states, colours come only from tokens
// (N2, no hex in the touched files), token colours convert exactly as
// Slop's color(0x…) does, and every module imports and runs in node with no
// document, window or localStorage (N8).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { physicalCityMaterials } from '@acme/theme';
import { parseCityDataset } from '../../city-dataset.ts';
import { buildLaneTopology } from '../../living-city/topology.ts';
import { buildCityMeshes } from '../city-mesh.ts';
import { createPbrCityMaterials } from '../pbr-materials.ts';
import { createStreetClearance } from '../walkability.ts';
import { buildPhysicalCityMaterials } from './index.ts';
import { createCurtainWallMaterial, createPreWarMaterial } from './facade.ts';
import { physicalTsl } from './tsl-common.ts';
import { compileWgsl, stubRenderer, testUniforms } from './physical.test-support.ts';

const realTile = () => parseCityDataset(JSON.parse(readFileSync(new URL('../../data/harlem-apollo.json', import.meta.url), 'utf8')));

test('N8: no DOM global exists while every physical module builds its materials and meshes', async () => {
  const g = globalThis as Record<string, unknown>;
  assert.equal(g.document, undefined);
  assert.equal(g.window, undefined);
  assert.equal(g.localStorage, undefined);
  const dataset = realTile();
  const physical = buildPhysicalCityMaterials(THREE, testUniforms(), dataset, { topology: buildLaneTopology(dataset) });
  const culling = await import('./culling.ts');
  culling.setupSceneCulling(THREE, new THREE.Scene(), []);
  assert.equal(g.document, undefined);
  assert.equal(g.window, undefined);
  assert.equal(g.localStorage, undefined);
  physical.dispose();
  // And no source in the lane names them.
  const dir = new URL('./', import.meta.url);
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.ts') || file.endsWith('.test.ts') || file.endsWith('.test-support.ts')) continue;
    const code = readFileSync(new URL(file, dir), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const name of ['document', 'window', 'localStorage', 'HTMLCanvasElement', 'navigator']) {
      assert.ok(!new RegExp(`\\b${name}\\b`).test(code), `${file} uses ${name}`);
    }
  }
});

test('N2: no hex colour literal in the lane, its constants or the city-mesh changes', () => {
  const hex = /#[0-9a-fA-F]{3,8}\b|\b0x[0-9a-fA-F]{6}\b/;
  const dir = new URL('./', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.test-support.ts')).map((f) => new URL(f, dir));
  files.push(new URL('../physical-materials-constants.ts', import.meta.url), new URL('../city-mesh.ts', import.meta.url));
  for (const file of files) assert.ok(!hex.test(readFileSync(file, 'utf8')), `${file.pathname} holds a hex literal`);
});

test("token colours convert exactly as Slop's color(0x…) does", () => {
  const { c } = physicalTsl(THREE);
  // TSL color() wraps a constant in a VarNode; the Color sits on `.node.value`.
  const value = (n: unknown) => (n as { node: { value: THREE.Color } }).node.value;
  const ours = value(c(physicalCityMaterials.interior.bulbWarmA));
  const slop = value(THREE.TSL.color(0xffb845));
  assert.ok(ours.equals(slop), `${ours.getHexString()} vs ${slop.getHexString()}`);
});

test('every material compiles to WGSL on the real tile; the walls bind the facade attributes; draw calls as stated', async () => {
  const dataset = realTile();
  const renderer = await stubRenderer();
  const physical = buildPhysicalCityMaterials(THREE, testUniforms(), dataset, { topology: buildLaneTopology(dataset) });
  const base = createPbrCityMaterials(THREE, { sunDirection: [0.5, -0.5, 0.7] });
  const materials = { ...base, masonry: physical.masonry, glass: physical.glass, roads: physical.roads, sidewalks: physical.sidewalks };
  const built = buildCityMeshes(THREE, dataset, materials, [0.5, -0.5], createStreetClearance(dataset), undefined, { facadeAttributes: true, fireEscapes: true });
  // 12 city draws unchanged, plus road paint (1) and fire escapes (3).
  assert.equal(built.stats.drawCalls, 12);
  assert.ok(physical.roadPaint);
  assert.equal(physical.fireEscapes.meshes.length, 3);

  const times: Record<string, number> = {};
  for (const name of ['city:walls-masonry', 'city:walls-glass', 'city:roads', 'city:sidewalks']) {
    const mesh = built.meshes.find((m) => m.name === name)!;
    const out = compileWgsl(renderer, mesh, mesh.material as THREE.Material);
    times[name] = out.ms;
    assert.ok(out.fragment.length > 4000, `${name} fragment`);
    if (name.startsWith('city:walls')) {
      assert.match(out.vertex, /aFacadeWall/, `${name} binds aFacadeWall`);
      assert.match(out.vertex, /aFacadeGrid/, `${name} binds aFacadeGrid`);
    }
  }
  const others: [string, THREE.Object3D, THREE.Material][] = [
    ['road paint', physical.roadPaint!, physical.roadPaint!.material as THREE.Material],
    ['contact shadow', new THREE.Mesh(new THREE.PlaneGeometry(), physical.contactShadow), physical.contactShadow],
  ];
  for (const [name, object, material] of others) assert.ok(compileWgsl(renderer, object, material).fragment.length > 0, name);
  for (const [name, ms] of Object.entries(times)) assert.ok(ms < 2000, `${name} built in ${ms.toFixed(0)} ms`);

  // The world-grid variants (one family per material, no vertex attributes) compile too.
  const box = new THREE.Mesh(new THREE.BoxGeometry(20, 30, 20));
  const preWar = createPreWarMaterial(THREE, testUniforms(), { wallLocal: false, family: 'brownstone', stone: physicalCityMaterials.masonryFamily.brownstoneTrim });
  const curtain = createCurtainWallMaterial(THREE, testUniforms(), { wallLocal: false, glass: physicalCityMaterials.masonryFamily.limestoneGlass });
  for (const m of [preWar, curtain]) assert.ok(compileWgsl(renderer, box, m).fragment.length > 4000);
  assert.throws(() => createPreWarMaterial(THREE, testUniforms(), { wallLocal: false }), /stone/);

  built.dispose(); base.dispose(); physical.dispose(); preWar.dispose(); curtain.dispose();
});
