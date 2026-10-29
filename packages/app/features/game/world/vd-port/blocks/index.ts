// Lane A: Valdrada's 125th Street blocks and landmarks on the bundled tile, from Valdrada's own builders.
//
// What is drawn, all of it baked by tooling/city/vd-port/bake.mjs running Valdrada's assembly (client/src/world/assemble.js)
// on the twenty tiles over the bundled tile:
//   * every facade-kit building in bounds (client/src/city/fk: specs fk/specs/{west,bid1..4,east}.js and the custom
//     builders fk/custom/*.js; the Apollo's front is w125cKit.js buildApollo33 through fk/custom/bid2.js), whole: walls,
//     windows, cornices, storefront bays, roll gates, signs, awnings, fire escapes;
//   * the landmarks in bounds (city/landmarks.js BUILDERS: whittierHall, schomburg, abyssinian; Hotel Theresa and the
//     State Office Building are facade-kit specs, acp-2082 and w125-163);
//   * the area parts w125cb (the State Office Building's plaza: w125cbKit.js plazaMeshes) and w125w (the 2023 hoarding;
//     its other structures lie outside the tile or are lane C's viaducts). w125c builds nothing while the kit owns the
//     Apollo; w125e's structures are the Park Avenue viaduct (lane C).
// Two levels, as Valdrada draws them:
//   * the shell, Valdrada's persistent tier (lod/bake_landmarks.js: meshoptimizer to at most 2000 triangles a structure,
//     its colours, the FW14 window grid), resident, drawn with its far material (shell-material.ts);
//   * the near level, the builders' own geometry welded and simplified to 2 cm (5 mm on the heroes), streamed by the cell
//     streamer in 128 m cells under its own budget; where a near cell is in, the shell cell under it hides (Valdrada's
//     near mask, NM24).
// The bundled tile's buildings each structure replaces (VD_BLOCKS.hide) leave the city mesh (world/index.ts).
//
// Not ported (and why): the kit's per-material shaders (photo PBR sets, the window glass mirror, interior rooms, weather
// stains; 116 programs over the tile, past the iPad's pipeline budget) are drawn through the persistent tier's lighting with
// each material's colour and emission instead; the |fkin interior light scaling; the city-scale AO bake (cityAO).
import type { Three } from '@acme/ui/three';
import { EMPTY_PART, type VdPortCtx, type VdPortPart } from '../types.ts';
import { cellNum, CELL } from '../../cells/cell-rules.ts';
import { decodeShellCell, lazyNearPackage, type NearCellInfo, type ShellCellInfo } from './codec.ts';
import { vdBlockBytes } from './load.ts';
import { makeNearMaterial, makeShellMaterial } from './shell-material.ts';
import { VD_BLOCKS, VD_FW14 } from './data/manifest.ts';
import { decodeBase64 } from '../../foliage.ts';

type Mesh = InstanceType<Three['Mesh']>;

/** The near layer's mesh name (the streamer names its cells after the template). */
export const NEAR_NAME = 'city:vd-blocks-near';
export const SHELL_NAME = 'city:vd-blocks-shell';

/**
 * The near layer's stream spec. Valdrada draws its kit's near level within 120 m (fk/facadeKit.js LOD_D). The streamer
 * wants a layer while errorM x K / distance is at least the preset's threshold, so errorM is chosen to reach 120 m on the
 * iPad preset: K = 1536 / (2 tan 30 deg) = 1330 px, threshold 2 px, errorM = 120 x 2 / 1330 = 0.18 (240 m on `high`,
 * threshold 1). It is a reach, not the level's own 2 cm error. Fades in with the dither.
 */
export const NEAR_LAYER = { errorM: 0.18, chunk: CELL, fade: true, pin: false } as const;

/** The near level's own budget per preset (the cells along 125th Street run to 345k triangles and 10.6 MB). */
export const NEAR_BUDGET = { geometryBytes: 64 * 1024 * 1024, cellDraws: 24, triangles: 1_200_000 } as const;

/** The bundled tile's building ids lane A replaces, or null when the packs did not load (the tile keeps its own). */
export function vdHiddenBuildings(): ReadonlySet<string> | null {
  return vdBlockBytes() ? new Set<string>(VD_BLOCKS.hide) : null;
}

const inRing = (ring: readonly (readonly number[])[], x: number, z: number) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!, zi = ring[i]![1]!, xj = ring[j]![0]!, zj = ring[j]![1]!;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};
let ownedSpecs: Set<string> | null = null;

/**
 * Whether lane A draws this front whole, so another lane must not: a facade-kit face (`<spec>#<face>`, a spec lane A
 * baked) or any point inside a footprint lane A replaces. Always false when the packs did not load.
 */
export function vdBlocksOwn(frontId: string | null, x: number, z: number): boolean {
  if (!vdBlockBytes()) return false;
  ownedSpecs ??= new Set(VD_BLOCKS.structures.filter((s) => s.kind === 'fk').map((s) => s.id.slice(3)));
  if (frontId && ownedSpecs.has(frontId.split('#')[0]!)) return true;
  for (const s of VD_BLOCKS.structures) for (const r of s.owned as readonly (readonly (readonly number[])[])[]) if (inRing(r, x, z)) return true;
  return false;
}

export function build(ctx: VdPortCtx): VdPortPart {
  const packs = vdBlockBytes();
  if (!packs) return EMPTY_PART;
  const { THREE } = ctx;
  const fw14 = new THREE.DataTexture(decodeBase64(VD_FW14.rgba), VD_FW14.width, VD_FW14.height, THREE.RGBAFormat);
  fw14.wrapS = fw14.wrapT = THREE.RepeatWrapping;
  fw14.magFilter = THREE.LinearFilter;
  fw14.minFilter = THREE.LinearMipmapLinearFilter;
  fw14.generateMipmaps = true;
  fw14.anisotropy = 8;
  fw14.name = 'vd:far_windows_fw14';
  fw14.needsUpdate = true;
  const shellMat = makeShellMaterial(THREE, ctx.env, fw14);
  const nearMat = makeNearMaterial(THREE, ctx.env);

  // ---- the shell: resident, one mesh per 128 m cell
  const shells = new Map<number, Mesh>();
  let triangles = 0;
  for (const info of VD_BLOCKS.shell as readonly ShellCellInfo[]) {
    const a = decodeShellCell(packs.shell, info);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
    g.setAttribute('color', new THREE.BufferAttribute(a.color, 4, true));
    g.setAttribute('uv', new THREE.BufferAttribute(a.uv, 2));
    const b = info.bounds;
    g.boundingBox = new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5]));
    g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
    const m = new THREE.Mesh(g, shellMat);
    m.name = SHELL_NAME;
    m.matrixAutoUpdate = false;
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.cell = cellNum(info.cx, info.cz);
    ctx.group.add(m);
    ctx.register(m, null);
    shells.set(m.userData.cell as number, m);
    triangles += info.triangles;
  }

  // ---- the near level: a template (one zero-area triangle in the layer's layout) and the lazy cells
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  tg.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(12), 4, true));
  tg.setAttribute('emissive', new THREE.BufferAttribute(new Uint8Array(12), 4, true));
  tg.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2]), 1));
  tg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
  tg.userData = { keepCpuArrays: true };
  const template = new THREE.Mesh(tg, nearMat);
  template.name = NEAR_NAME;
  template.matrixAutoUpdate = false;
  template.castShadow = true;
  template.receiveShadow = true;
  ctx.group.add(template);
  const packages = (VD_BLOCKS.near as readonly NearCellInfo[]).map((info) => {
    const file = packs.near.get(info.key);
    if (!file) throw new Error(`vd-port: near cell ${info.key} is in the manifest but not in the packs`);
    return lazyNearPackage(info, () => file);
  });
  ctx.registerChunks(template, NEAR_LAYER, packages, NEAR_BUDGET);

  // Valdrada's near mask: a shell cell hides while its near cell is fully faded in. Allocation-free per frame.
  const nearIn = new Set<number>();
  return {
    update() {
      nearIn.clear();
      for (const o of ctx.group.children) {
        if (o.name !== NEAR_NAME || o === template) continue;
        const ud = o.userData as { cell?: number; cellFade?: number };
        if (ud.cell !== undefined && (ud.cellFade ?? 1) >= 1) nearIn.add(ud.cell);
      }
      for (const [num, m] of shells) m.visible = !nearIn.has(num);
    },
    dispose() {
      for (const m of shells.values()) m.geometry.dispose();
      tg.dispose();
      shellMat.dispose();
      nearMat.dispose();
      fw14.dispose();
    },
    stats: { meshes: shells.size + 1, triangles, structures: VD_BLOCKS.structures.length },
  };
}

