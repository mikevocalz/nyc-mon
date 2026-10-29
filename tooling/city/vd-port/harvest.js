// Page side of the vd-port bake: collects what Valdrada's landmarks, area parts and facade kit built for one assembled
// tile, one structure at a time, and packs each the way Valdrada packs its persistent tier.
//
// harvest(), simplifyTo() and pack() are Valdrada's (client/src/lod/bake_landmarks.js @ 2724c79, MIT, Mehmet Kerem
// Turkcan), copied unchanged except where marked `vd-port:`. pack() writes the persistent tier's chunk format: positions
// int16 at 1/8 m about an origin, colour RGBA8 (sRGB albedo, alpha the building's lit share), a window-grid UV.
import * as THREE from 'three';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';

export const LIMIT = 2000;   // bake_landmarks.js LIMIT: the landmark registry's triangle cap per silhouette

const lin2s = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
// vd-port: how a material's emission follows ENV.night, from the shader patch its program key names: totalEmissiveRadiance
// x mix(lo, hi, night). The numbers are Valdrada's: fk/kitMats.js nightEmit (|fknight k: 0, k) and levelBase (|fklv
// dayK,nightK, on the albedo x aFkTr.x), w125cKit.js ledMat33 ('a33led2': 0.5, 0.8), ledMat ('|a33led': 0.55, 1.15) and
// ap34Mats (field 0, 0.7; cream 0, 0.6; back 0, 0.5; tube 0.04, 3.0). No patch: the emission is constant (1, 1).
export function nightMix(mt) {
  const k = typeof mt.customProgramCacheKey === 'function' ? String(mt.customProgramCacheKey.call(mt)) : '';
  let m;
  if ((m = k.match(/\|fklv(a?)([\d.]+),([\d.]+)/))) return { lo: +m[2], hi: +m[3], albedo: true };
  if ((m = k.match(/\|fknight([\d.]+)/))) return { lo: 0, hi: +m[1], albedo: false };
  if (k.includes('a33led2')) return { lo: 0.5, hi: 0.8, albedo: false };
  if (k.includes('|a33led')) return { lo: 0.55, hi: 1.15, albedo: false };
  if (k.includes('|a34field')) return { lo: 0, hi: 0.7, albedo: false };
  if (k.includes('|a34cream')) return { lo: 0, hi: 0.6, albedo: false };
  if (k.includes('|a34back')) return { lo: 0, hi: 0.5, albedo: false };
  if (k.includes('|a34tube')) return { lo: 0.04, hi: 3.0, albedo: false };
  return { lo: 1, hi: 1, albedo: false };
}
// every visible mesh of a group as world triangles with sRGB vertex colours
// vd-port: `finest` walks a THREE.LOD's finest level (the near tier) instead of its coarsest (the shell tier)
// vd-port: `E` collects each vertex's emission (the material's emissive x emissiveIntensity, or for a |fklv material its
// albedo x aFkTr.x; linear over 4, then sRGB) and `N` its night mix (lo, hi, over 4)
export function harvest(root, finest = false) {
  root.updateMatrixWorld(true);
  const P = [], C = [], E = [], N = [];
  const v = new THREE.Vector3(), m4 = new THREE.Matrix4(), im = new THREE.Matrix4();
  // (BR38: a THREE.LOD gives only its coarsest level: the bridge kit builds each bridge as LOD pieces, full and coarse)
  const visit = (o, f) => { f(o); const ch = o.isLOD && o.levels && o.levels.length ? [o.levels[finest ? 0 : o.levels.length - 1].object] : o.children; for (const c of ch) visit(c, f); };
  visit(root, (o) => {
    if (!o.isMesh || !o.visible || !o.geometry || !o.geometry.attributes.position) return;
    const g = o.geometry, pos = g.attributes.position, col = g.attributes.color, idx = g.index;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.every((mt) => !mt || mt.visible === false || (mt.transparent && mt.opacity < 0.3))) return;
    const groups = g.groups && g.groups.length && Array.isArray(o.material) ? g.groups : [{ start: 0, count: idx ? idx.count : pos.count, materialIndex: 0 }];
    const nInst = o.isInstancedMesh ? o.count : 1;
    for (let k = 0; k < nInst; k++) {
      if (o.isInstancedMesh) { o.getMatrixAt(k, im); m4.multiplyMatrices(o.matrixWorld, im); } else m4.copy(o.matrixWorld);
      for (const gr of groups) {
        const mt = mats[gr.materialIndex] || mats[0];
        if (!mt || mt.visible === false) continue;
        const bc = mt.userData && mt.userData.brBase ? mt.userData.brBase : mt.color;   // (BR38: the kit's stone: its builder's colour, not the colour scaled for its maps)
        const base = bc ? [lin2s(bc.r), lin2s(bc.g), lin2s(bc.b)] : [0.7, 0.7, 0.7];
        const ei = mt.emissive ? (mt.emissiveIntensity ?? 1) : 0;
        const nm = nightMix(mt);
        const tr = nm.albedo ? g.attributes.aFkTr : null;
        const emL = mt.emissive && !nm.albedo ? [mt.emissive.r * ei, mt.emissive.g * ei, mt.emissive.b * ei] : [0, 0, 0];
        const end = Math.min(gr.start + gr.count, idx ? idx.count : pos.count);
        for (let q = gr.start; q + 2 < end; q += 3) {
          for (let w = 0; w < 3; w++) {
            const vi = idx ? idx.getX(q + w) : q + w;
            v.fromBufferAttribute(pos, vi).applyMatrix4(m4);
            P.push(v.x, v.y, v.z);
            let r = base[0], gg = base[1], bb = base[2];
            if (col && mt.vertexColors) { r *= lin2s(col.getX(vi)); gg *= lin2s(col.getY(vi)); bb *= lin2s(col.getZ(vi)); }
            C.push(r, gg, bb);
            if (tr) {
              // levelBase: totalEmissiveRadiance += diffuseColor.rgb * vFkTr.x * mix(dayK, nightK, night), on the linear albedo
              const lv = tr.getX(vi), s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
              E.push(lin2s(Math.min(1, s2l(r) * lv / 4)), lin2s(Math.min(1, s2l(gg) * lv / 4)), lin2s(Math.min(1, s2l(bb) * lv / 4)));
            } else E.push(lin2s(Math.min(1, emL[0] / 4)), lin2s(Math.min(1, emL[1] / 4)), lin2s(Math.min(1, emL[2] / 4)));
            N.push(nm.lo / 4, nm.hi / 4);
          }
        }
      }
    }
  });
  return { P, C, E, N };
}
// weld (1 cm), simplify to the limit (exact first, then sloppy clustering for kits of disconnected parts), unweld per face
export function simplifyTo(P, C, limit, target = 0.02, flags = ['Prune']) {
  const map = new Map(), wp = [], wc = [], ind = [];
  for (let i = 0; i < P.length / 3; i++) {
    const key = `${Math.round(P[i * 3] * 100)},${Math.round(P[i * 3 + 1] * 100)},${Math.round(P[i * 3 + 2] * 100)}`;
    let id = map.get(key);
    if (id === undefined) { id = wp.length / 3; map.set(key, id); wp.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); wc.push(C[i * 3], C[i * 3 + 1], C[i * 3 + 2]); }
    ind.push(id);
  }
  // drop degenerate triangles
  const I0 = [];
  for (let t = 0; t < ind.length; t += 3) if (ind[t] !== ind[t + 1] && ind[t + 1] !== ind[t + 2] && ind[t] !== ind[t + 2]) I0.push(ind[t], ind[t + 1], ind[t + 2]);
  const pos = new Float32Array(wp);
  let I = new Uint32Array(I0), err = 0, how = 'none';
  if (I.length / 3 > limit) {
    const [s1, e1] = MeshoptSimplifier.simplify(I, pos, 3, limit * 3, target, flags);
    I = s1; err = e1; how = 'simplify';
    let tries = 0, te = 0.004;
    while (I.length / 3 > limit && tries++ < 12) {
      const [s2, e2] = MeshoptSimplifier.simplifySloppy(new Uint32Array(I0), pos, 3, null, limit * 3, te);
      I = s2; err = e2; how = 'sloppy'; te *= 1.6;
      if (I.length / 3 <= limit) break;
    }
  }
  return { pos, col: wc, I, err, how };
}
// vd-port: `q` is the position scale (Valdrada's 8, i.e. 1/8 m, for the shell; 128 for the near level, whose features
// are centimetres)
export function pack(s, lit, q = 8) {
  // per-face vertices (flat shading by derivatives, uv per face): FW14 window grid on walls, the white texel on roofs
  const { pos, col, I } = s;
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
  for (let k = 0; k < I.length; k++) { const i = I[k]; x0 = Math.min(x0, pos[i * 3]); x1 = Math.max(x1, pos[i * 3]); y0 = Math.min(y0, pos[i * 3 + 1]); y1 = Math.max(y1, pos[i * 3 + 1]); z0 = Math.min(z0, pos[i * 3 + 2]); z1 = Math.max(z1, pos[i * 3 + 2]); }
  const origin = [(x0 + x1) / 2, Math.floor(y0), (z0 + z1) / 2];
  const P = [], Cc = [], U = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
    const ux = pos[b * 3] - ax, uy = pos[b * 3 + 1] - ay, uz = pos[b * 3 + 2] - az;
    const vx = pos[c * 3] - ax, vy = pos[c * 3 + 1] - ay, vz = pos[c * 3 + 2] - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
    const r = (col[a * 3] + col[b * 3] + col[c * 3]) / 3, g = (col[a * 3 + 1] + col[b * 3 + 1] + col[c * 3 + 1]) / 3, bb = (col[a * 3 + 2] + col[b * 3 + 2] + col[c * 3 + 2]) / 3;
    for (const i of [a, b, c]) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      P.push(Math.round((x - origin[0]) * q), Math.round((y - origin[1]) * q), Math.round((z - origin[2]) * q));
      Cc.push(Math.round(r * 255), Math.round(g * 255), Math.round(bb * 255), lit);
      if (Math.abs(ny) > 0.7) U.push(0.06, 0.24);
      else { const tl = Math.hypot(nx, nz) || 1, tx = -nz / tl, tz = nx / tl; U.push((x * tx + z * tz) / 12, y / 15.2); }
    }
  }
  return { origin, P, C: Cc, U, nv: P.length / 3, bbox: [x0, y0, z0, x1, y1, z1] };
}

// ------------------------------------------------------------------ vd-port: the structures of one assembled tile
const b64 = (typed) => { const u8 = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const boxOf = (P) => { const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; for (let i = 0; i < P.length; i += 3) { for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], P[i + k]); b[k + 3] = Math.max(b[k + 3], P[i + k]); } } return b; };

// The near level, indexed: welded by position (1 cm, as simplifyTo) AND colour (the shell's position-only weld bleeds one
// material's colour into its neighbour's, acceptable at 1 km, not at 5 m), degenerate triangles dropped, then
// meshoptimizer's error-bounded simplify only (no triangle target, no sloppy clustering, no pruning) to an absolute error
// of `errM` metres. errM 0 keeps every welded triangle.
export function simplifyNear(P, C, E, N, errM) {
  const map = new Map(), wp = [], wc = [], we = [], wn = [], ind = [];
  for (let i = 0; i < P.length / 3; i++) {
    const r = Math.round(C[i * 3] * 255), g = Math.round(C[i * 3 + 1] * 255), b = Math.round(C[i * 3 + 2] * 255);
    const er = Math.round(E[i * 3] * 255), eg = Math.round(E[i * 3 + 1] * 255), eb = Math.round(E[i * 3 + 2] * 255);
    const lo = Math.round(N[i * 2] * 255), hi = Math.round(N[i * 2 + 1] * 255);
    const key = `${Math.round(P[i * 3] * 100)},${Math.round(P[i * 3 + 1] * 100)},${Math.round(P[i * 3 + 2] * 100)},${r},${g},${b},${er},${eg},${eb},${lo},${hi}`;
    let id = map.get(key);
    if (id === undefined) { id = wp.length / 3; map.set(key, id); wp.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); wc.push(r, g, b); we.push(er, eg, eb); wn.push(lo, hi); }
    ind.push(id);
  }
  const I0 = [];
  for (let t = 0; t < ind.length; t += 3) if (ind[t] !== ind[t + 1] && ind[t + 1] !== ind[t + 2] && ind[t] !== ind[t + 2]) I0.push(ind[t], ind[t + 1], ind[t + 2]);
  const pos = new Float32Array(wp);
  // the box of the exact welded geometry (degenerate triangles out: a stray zero-area face is not part of the building)
  const box0 = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (const v of I0) for (let k = 0; k < 3; k++) { box0[k] = Math.min(box0[k], wp[v * 3 + k]); box0[k + 3] = Math.max(box0[k + 3], wp[v * 3 + k]); }
  let I = new Uint32Array(I0), err = 0, how = 'weld';
  if (errM > 0 && I.length >= 3) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < pos.length; i += 3) { x0 = Math.min(x0, pos[i]); x1 = Math.max(x1, pos[i]); y0 = Math.min(y0, pos[i + 1]); y1 = Math.max(y1, pos[i + 1]); z0 = Math.min(z0, pos[i + 2]); z1 = Math.max(z1, pos[i + 2]); }
    const extent = Math.max(x1 - x0, y1 - y0, z1 - z0, 1e-3);
    // vd-port: positions and colours both steer the simplifier (colour weight 1: a colour edge is kept like a crease)
    const attr = new Float32Array(wc.length * 2); for (let i = 0; i < wc.length / 3; i++) for (let k = 0; k < 3; k++) { attr[i * 6 + k] = wc[i * 3 + k] / 255; attr[i * 6 + 3 + k] = we[i * 3 + k] / 255; }
    const [s1, e1] = MeshoptSimplifier.simplifyWithAttributes(I, pos, 3, attr, 6, [1, 1, 1, 1, 1, 1], null, 0, errM / extent, []);
    I = s1; err = e1 * extent; how = 'simplify-err';
  }
  return { pos, col: new Uint8Array(wc), emi: new Uint8Array(we), nmix: new Uint8Array(wn), I, err, how, box0 };
}

/**
 * One structure's levels: the near level (the finest LOD, welded, simplified to an absolute error of `nearErrM`) and the
 * shell (Valdrada's persistent-tier simplifyTo at its LIMIT). Positions in Valdrada world metres.
 */
export function packStructure(id, kind, root, lit, opts) {
  const errM = (opts.heroes || []).includes(id) ? opts.heroErrM : opts.nearErrM;
  const fine = harvest(root, true);
  const tris0 = fine.P.length / 9;
  if (!tris0) return null;
  const coarse = harvest(root, false);
  const near = simplifyNear(fine.P, fine.C, fine.E, fine.N, errM);
  const box = near.box0;
  const shell = simplifyTo(coarse.P, coarse.C, LIMIT);
  const p = pack(shell, lit, 8);
  return {
    id, kind, lit, tris0, box: box.map((v) => Math.round(v * 1000) / 1000),
    // the near level in Valdrada world metres, welded and indexed: positions float32, sRGB colour bytes, uint32 indices
    near: { tris: near.I.length / 3, nv: near.pos.length / 3, err: near.err, how: near.how,
      pos: opts.data ? b64(near.pos) : null, col: opts.data ? b64(near.col) : null, emi: opts.data ? b64(near.emi) : null, nmix: opts.data ? b64(near.nmix) : null, idx: opts.data ? b64(near.I) : null },
    // the shell: Valdrada's persistent-tier chunk format (pack, 1/8 m)
    shell: { tris: shell.I.length / 3, nv: p.nv, err: shell.err, how: shell.how, origin: p.origin, bbox: p.bbox,
      P: opts.data ? b64(Int16Array.from(p.P)) : null, C: opts.data ? b64(Uint8Array.from(p.C)) : null },
  };
}

/** The structures one assembled tile holds: the landmarks' groups, each area part's pieces and each facade-kit spec. */
export async function tileStructures(key, group, opts) {
  await MeshoptSimplifier.ready;
  const out = [];
  group.updateMatrixWorld(true);
  // vd-port: the pavement a structure stands on, in Valdrada's height datum (assemble.js padYNear: the paved surface
  // nearest the point). Valdrada has terrain and the bundled tile is flat, so the port seats each structure by this.
  const actx0 = globalThis.__vdAreaCtx && globalThis.__vdAreaCtx[key];
  const pave = (x, z, fallback) => { let y = null; try { y = actx0 && actx0.padYNear ? actx0.padYNear(x, z) : null; } catch { y = null; } return Number.isFinite(y) ? y : fallback; };
  // landmarks (ctx.landmarks groups, tagged by the harness)
  const lms = [];
  group.traverse((o) => { if (o.userData && o.userData.__vd && o.userData.__vd.kind === 'landmark') lms.push(o); });
  for (const g of lms) {
    const s = packStructure(`landmark:${g.userData.__vd.key}`, 'landmark', g, 0, opts);
    if (s) { s.landmarkMode = g.userData.__vd.mode; s.landmark = { key: g.userData.__vd.key, cx: g.userData.__vd.cx, cz: g.userData.__vd.cz, groundY: g.userData.__vd.groundY }; s.base = pave(g.userData.__vd.cx, g.userData.__vd.cz, g.userData.__vd.groundY); out.push(s); }
  }
  // the area parts lane A owns, split by their meshes' structure names (the first segment before ':' or '_')
  for (const part of opts.parts) {
    const sub = group.children.find((c) => c.name === `vdpart:${part}`);
    if (!sub) continue;
    const byName = new Map();
    for (const c of sub.children) {
      const nm = (c.name || part).split(/[:_]/).slice(0, 2).join(':') || part;
      if (!byName.has(nm)) byName.set(nm, new THREE.Group());
      byName.get(nm).add(c.clone());
    }
    for (const [nm, g] of byName) {
      g.position.copy(sub.getWorldPosition(new THREE.Vector3()));
      const s = packStructure(`part:${part}:${nm}@${key}`, part, g, 0, opts);
      if (s) { s.base = pave((s.box[0] + s.box[3]) / 2, (s.box[2] + s.box[5]) / 2, s.box[1]); out.push(s); }
    }
  }
  // the facade kit, one spec at a time, through its own buildTile on the tile's build context
  const actx = globalThis.__vdAreaCtx && globalThis.__vdAreaCtx[key];
  const FKS = window.__FK;
  if (actx && FKS && opts.fk) {
    const list = FKS.TILES.get(`${actx.ox},${actx.oz}`) || [];
    const kit = await import('/src/city/fk/facadeKit.js');
    for (const rec of list) {
      const g = new THREE.Group();
      try { kit.buildTile(g, actx, [rec], { colliders: { addBox() {}, addPrism() {} } }); } catch (e) { console.warn('[vd-bake] fk', rec.spec.id, e); continue; }
      const lit = rec.rings[0] && rec.rings[0].b ? Math.round((rec.rings[0].b.lit || 0) * 255) : 0;
      const s = packStructure(`fk:${rec.spec.id}`, 'fk', g, lit, opts);
      if (s) {
        s.fk = { id: rec.spec.id, seg: rec.seg, name: rec.spec.name || null, addr: rec.spec.addr || null, custom: rec.spec.custom || null,
          rings: rec.rings.map((r) => ({ cx: r.cx, cz: r.cz, primary: !!r.primary, ring: r.ring.map(([x, z]) => [Math.round(x * 100) / 100, Math.round(z * 100) / 100]) })), at: rec.spec.at, also: rec.spec.also || [], keepCompiled: !!rec.spec.keepCompiled };
        s.base = pave(rec.rings[0].cx, rec.rings[0].cz, s.box[1]);
        out.push(s);
      }
      g.traverse((q) => { if (q.isMesh && q.geometry) q.geometry.dispose(); });
    }
  }
  return out;
}
