// The vd port's far tier: Valdrada's persistent tier over the whole baked city — the L4/L6 CTL1 chunks
// (tools/lod/build_persistent.mjs) and the landmark silhouettes (bake-far.mjs), drawn through lane A's shell
// material (makeBlocksMaterial) so they come out the same pipeline family as the near levels.
//
// Streamed (the world has a preset): every chunk is a lazy CellPackage whose bytes come through the cell source
// (world/cell-source), so only chunks inside the far reach fetch — Valdrada's macro radius, ~13 km — inside their own
// budget (perf/tier-presets.ts vdPort.far). The bundled home subset is already warm (load.ts preloadVdFar); a chunk
// that cannot be produced stays unbuilt, so a missing far chunk shows nothing there and never crashes. Three streamer
// layers: the buildings, the L6 ground strips, the landmarks — one shared material, one shared budget.
//
// Resident (no preset, the world built whole): the eager byte set mounts whole, as the lane did before streaming.
import type { Three } from '@acme/ui/three';
import { EMPTY_PART, type VdPortCtx, type VdPortPart } from '../types.ts';
import { ditherFadeMask } from '../../cells/cell-stream.ts';
import type { CellPackage } from '../../cells/cell-rules.ts';
import { parseCtl1 } from './codec.ts';
import { vdFarBytes } from './load.ts';
import { sourceFarChunk, sourceFarGround, sourceFarLandmark } from './on-demand.ts';
import { makeBlocksMaterial } from '../blocks/shell-material.ts';
import { VD_FW14 } from '../blocks/data/manifest.ts';
import { VD_FAR } from './data/manifest.ts';
import { decodeBase64 } from '../../foliage.ts';

type Mesh = InstanceType<Three['Mesh']>;

export const FAR_NAME = 'city:vd-far';
export const FAR_GROUND_NAME = 'city:vd-far-ground';
export const FAR_LM_NAME = 'city:vd-far-landmark';

/** Valdrada's macro radius: the far tier is wanted while a chunk's box is within this of the camera. */
export const FAR_REACH_M = 13_000;

const farBudgetOf = (ctx: VdPortCtx) => ({
  name: 'far' as const,
  ...(ctx.preset?.vdPort.far ?? { geometryBytes: 64 * (1 << 20), cellDraws: 160, triangles: 1_200_000 }),
});

const fw14Of = (ctx: VdPortCtx) => {
  const { THREE } = ctx;
  const fw14 = new THREE.DataTexture(decodeBase64(VD_FW14.rgba), VD_FW14.width, VD_FW14.height, THREE.RGBAFormat);
  fw14.wrapS = fw14.wrapT = THREE.RepeatWrapping;
  fw14.magFilter = THREE.LinearFilter;
  fw14.minFilter = THREE.LinearMipmapLinearFilter;
  fw14.generateMipmaps = true;
  fw14.anisotropy = 8;
  fw14.name = 'vd:far_windows_fw14';
  fw14.needsUpdate = true;
  return fw14;
};

const templateOf = (ctx: VdPortCtx, mat: Mesh['material'], name: string): Mesh => {
  const { THREE } = ctx;
  // the far layout: quantized int16 positions, RGBA8 colour and emission, the FW14 uv, the ao share — indexed
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Int16Array(9), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(12), 4, true));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2));
  g.setAttribute('ao', new THREE.BufferAttribute(new Uint8Array(3), 1, true));
  g.setAttribute('emissive', new THREE.BufferAttribute(new Uint8Array(12), 4, true));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array([0, 1, 2]), 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
  g.userData = { keepCpuArrays: true };
  const t = new THREE.Mesh(g, mat);
  t.name = name;
  t.matrixAutoUpdate = false;
  t.userData.vdShell = 1;
  ctx.group.add(t);
  return t;
};

function buildStreamed(ctx: VdPortCtx): VdPortPart {
  const fw14 = fw14Of(ctx);
  const mat = makeBlocksMaterial(ctx.THREE, ctx.env, fw14);
  (mat as unknown as { maskNode: unknown }).maskNode = ditherFadeMask(ctx.THREE);
  // the shared zero attribute bytes serve `ao` (0 -> full sky share) and `emissive` (no emission) on every far mesh
  const zeros = new Uint8Array(VD_FAR.maxVertices * 4);
  const spec = { errorM: 8, chunk: 2048, fade: true, pin: false, sharedMaterial: true, reachM: FAR_REACH_M };
  const budget = farBudgetOf(ctx);
  const chunks: CellPackage[] = [];
  const ground: CellPackage[] = [];
  const landmarks: CellPackage[] = [];
  for (const info of VD_FAR.chunks) {
    chunks.push(sourceFarChunk(info, ctx.toScene, zeros));
    if (info.gtris) ground.push(sourceFarGround(info, ctx.toScene, zeros));
  }
  if (VD_FAR.landmarks) for (const L of VD_FAR.landmarks.entries) landmarks.push(sourceFarLandmark(L, ctx.toScene, zeros));
  const t = templateOf(ctx, mat, FAR_NAME);
  const tg = templateOf(ctx, mat, FAR_GROUND_NAME);
  const tl = templateOf(ctx, mat, FAR_LM_NAME);
  ctx.registerChunks(t, spec, chunks, budget);
  ctx.registerChunks(tg, { ...spec, chunk: 8192 }, ground, budget);
  ctx.registerChunks(tl, spec, landmarks, budget);
  const templates = [t, tg, tl];
  return {
    dispose() {
      for (const m of templates) m.geometry.dispose();
      mat.dispose();
      fw14.dispose();
    },
    stats: { meshes: templates.length, triangles: 0, structures: VD_FAR.chunks.length },
  };
}

function buildResident(ctx: VdPortCtx, far: NonNullable<ReturnType<typeof vdFarBytes>>): VdPortPart {
  const { THREE } = ctx;
  const fw14 = fw14Of(ctx);
  const mat = makeBlocksMaterial(THREE, ctx.env, fw14);
  (mat as unknown as { maskNode: unknown }).maskNode = ditherFadeMask(THREE);

  const aff = VD_FAR.affine;
  const meshes: Mesh[] = [];
  let triangles = 0;

  const emissive = new THREE.BufferAttribute(new Uint8Array(VD_FAR.maxVertices * 4), 4, true);
  const aoZeros = new Uint8Array(VD_FAR.maxVertices);
  const groundCol = VD_FAR.groundColor;
  const attach = (
    m: Mesh,
    name: string,
    px: number,
    py: number,
    pz: number,
    sc: number,
  ) => {
    m.name = name;
    m.position.set(px, py, pz);
    m.scale.set(sc * aff.sx, sc, sc * aff.sz);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    m.userData.vdShell = 1;
    ctx.group.add(m);
    ctx.register(m, null);
    meshes.push(m);
    triangles += ((m.geometry.index?.count ?? m.geometry.getAttribute('position').count) / 3) | 0;
  };

  for (const info of VD_FAR.chunks) {
    const buf = far.chunks.get(info.f);
    if (!buf) continue;
    const t = parseCtl1(buf);
    const S = t.S;
    const sc = t.header.scale ?? 0.25;
    const [px, pz] = ctx.toScene(t.header.origin[0]!, t.header.origin[1]!);
    const py = VD_FAR.curb - VD_FAR.padY;
    if (S.idx && S.idx.length && S.pos && S.col && S.uv) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(S.pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(S.col, 4, true));
      g.setAttribute('uv', new THREE.BufferAttribute(S.uv, 2));
      g.setAttribute('ao', new THREE.BufferAttribute(S.ao && S.ao.length * 3 === S.pos.length ? S.ao : aoZeros.subarray(0, S.pos.length / 3), 1, true));
      g.setAttribute('emissive', emissive);
      g.setIndex(new THREE.BufferAttribute(S.idx, 1));
      g.computeBoundingSphere();
      attach(new THREE.Mesh(g, mat), FAR_NAME, px, py, pz, sc);
    }
    if (S.gpos && S.gidx && S.gidx.length) {
      const nv = S.gpos.length / 3;
      const col = new Uint8Array(nv * 4), uv = new Float32Array(nv * 2);
      for (let i = 0; i < nv; i++) {
        col[i * 4] = groundCol[0]!;
        col[i * 4 + 1] = groundCol[1]!;
        col[i * 4 + 2] = groundCol[2]!;
        uv[i * 2] = 0.06;
        uv[i * 2 + 1] = 0.24;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(S.gpos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 4, true));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setAttribute('ao', new THREE.BufferAttribute(aoZeros.subarray(0, nv), 1, true));
      g.setAttribute('emissive', emissive);
      g.setIndex(new THREE.BufferAttribute(S.gidx, 1));
      g.computeBoundingSphere();
      attach(new THREE.Mesh(g, mat), FAR_GROUND_NAME, px, py, pz, sc);
    }
  }

  if (far.landmarks && VD_FAR.landmarks) {
    const t = parseCtl1(far.landmarks);
    const S = t.S;
    const sc = t.header.scale ?? 0.125;
    for (const L of VD_FAR.landmarks.entries) {
      const it = L.l6;
      if (!it || !it.ni) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(S.pos!.subarray(it.v0 * 3, (it.v0 + it.nv) * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(S.col!.subarray(it.v0 * 4, (it.v0 + it.nv) * 4), 4, true));
      g.setAttribute('uv', new THREE.BufferAttribute(S.uv!.subarray(it.v0 * 2, (it.v0 + it.nv) * 2), 2));
      g.setAttribute('ao', new THREE.BufferAttribute(aoZeros.subarray(0, it.nv), 1, true));
      g.setAttribute('emissive', emissive);
      g.setIndex(new THREE.BufferAttribute(S.idx!.subarray(it.i0, it.i0 + it.ni), 1));
      g.computeBoundingSphere();
      const [px, pz] = ctx.toScene(it.origin[0]!, it.origin[2]!);
      attach(new THREE.Mesh(g, mat), FAR_LM_NAME, px, it.origin[1]! + VD_FAR.curb - VD_FAR.padY, pz, sc);
    }
  }

  return {
    dispose() {
      for (const m of meshes) m.geometry.dispose();
      mat.dispose();
      fw14.dispose();
    },
    stats: { meshes: meshes.length, triangles, structures: VD_FAR.chunks.length },
  };
}

export function build(ctx: VdPortCtx): VdPortPart {
  if (!ctx.preset) {
    const far = vdFarBytes();
    if (!far) return EMPTY_PART;
    return buildResident(ctx, far);
  }
  return buildStreamed(ctx);
}
