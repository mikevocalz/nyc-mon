// Valdrada's persistent-tier material, ported to TSL: client/src/lod/shellMaterial.js makeShellMaterial over
// client/src/world/materials.js makeFarMaterial @ 2724c79 (MIT). One material, one pipeline, for every packed structure.
//
// Translated term by term (GLSL in Valdrada's onBeforeCompile -> TSL here):
//   * diffuseColor = vertex colour (sRGB bytes) x the FW14 window grid map, then rgb *= rgb ("sRGB bytes -> approx
//     linear", Valdrada's own approximation, kept);
//   * the facet normal from derivatives, flipped to face the camera; lit by the sky ambient (0.8 + 0.3 max(N.y, 0)) times
//     the shell's wall sky-view factor mix(0.5, 1, |N.y|) and the per-vertex sky share (none here: 1), plus the sun
//     (ndl x 1.05, cut under the horizon by smoothstep(-0.06, 0.04, sunDir.y));
//   * TOWERFX: floor lines every 3.8 m (pcov, box filtered), the per-lot spread on a 26 m cell, the sky mirror on vertical
//     faces (skyLook, fresnelR, sunDisc from SKYREFL_GLSL) and the distance silhouette;
//   * night: rgb *= 1 - 0.55 night; the night windows of shellMaterial.js v2 (FW14 bays, octave-blended) at the vertex
//     alpha's lit share, walls only;
//   * weather: wet darkening and snow (vnoise of the world xz).
// Left out, with the reason: the city-scale sky occlusion (cityAO: a compile-time bake of Valdrada's whole city that has
// not been ported) and the near mask (NM24: Valdrada hides a far chunk where a near tile is ready; here the streamer's
// dither fades layers instead). CP32R (Central Park's aerial) is outside the bundled tile.
//
// The facet normal is cross(dFdx(p), dFdy(p)); a degenerate pixel makes that zero and WGSL's normalize of zero is NaN on
// Metal (feat/city-real-125th c769e5e6), so it is normalized through a guarded length, falling back to up.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { shadowSafe } from '../shared/shadow-safe.ts';

type F = Node<'float'>;
type V2 = Node<'vec2'>;
type V3 = Node<'vec3'>;
type BasicMat = InstanceType<Three['MeshBasicNodeMaterial']>;
type TextureT = InstanceType<Three['Texture']>;

/** Valdrada's ENV uniforms the shell reads (client/src/world/materials.js ENV), as TSL uniform nodes. */
export interface ShellEnv {
  night: F;
  wet: F;
  snow: F;
  sunDir: V3;
  sunColor: V3;
  skyAmbient: V3;
  fogColor: V3;
  reflGain: F;
}

/** shellMaterial.js WALL_SKY default (`?lodwallsky=`): a wall sees at most half the sky. */
export const WALL_SKY = 0.5;

/**
 * One material for both of lane A's levels, so they draw through one pipeline and share one shadow program (the
 * all-lanes walk's pipeline budget, world/vd-port/budget.test.ts). A mesh's `userData.vdShell` (1 on the shell, absent on
 * the near level) picks per object, through an object uniform, between:
 *   * the shell: Valdrada's persistent tier, makeFarMaterial plus the lod16 shell patch over the FW14 window grid, with
 *     shellMaterial.js's depth bias (polygonOffset factor 1 units 2) as a nudge of the vertex away from the eye;
 *   * the near level: the same lighting and sky mirror (so the handover does not step), without the far-only terms (the
 *     grid, floor lines, lot spread, distance silhouette and window stipple: the near geometry has its real windows),
 *     plus each vertex's emission x mix(lo, hi, night) (tooling harvest.js nightMix).
 * Both levels carry the same attributes: position, `color` and `emissive` (RGBA8) and `uv` (the shell's FW14 uv, zero on
 * the near level; the near level's emission, zero on the shell), and are indexed.
 */
export function makeBlocksMaterial(THREE: Three, env: ShellEnv, fw14: TextureT | null): BasicMat {
  return shadowSafe(THREE, build(THREE, env, fw14));
}

// fw14 null (the WGSL tests: three's builder samples no texture without a GPU) multiplies by white instead
function build(THREE: Three, env: ShellEnv, fw14: TextureT | null): BasicMat {
  const T = THREE.TSL;
  // The vertex colour is read below as an attribute: with vertexColors set, the node material would multiply it in twice.
  const mat = new THREE.MeshBasicNodeMaterial({ fog: true });
  mat.name = 'vd:blocks';
  const isShell = T.uniform(0).onObjectUpdate(({ object }) => ((object?.userData as { vdShell?: number } | undefined)?.vdShell ? 1 : 0)) as unknown as F;
  // shellMaterial.js polygonOffset (factor 1, units 2) without a pipeline state of its own: the shell's vertices move away
  // from the eye by 0.2 % of their distance, at most 0.3 m, so where a near piece and the shell meet the near piece wins.
  // (In the shadow pass the eye is the sun's: a far shell's shadow moves by the same few centimetres.)
  {
    const p = T.positionLocal;
    const away = p.sub(T.cameraPosition);
    const d = T.length(away);
    mat.positionNode = p.add(away.div(T.max(d, 1e-3)).mul(T.min(d.mul(0.002), 0.3)).mul(isShell)) as never;
  }

  // HASH_GLSL
  const hash12 = (p: V2): F => {
    const p3 = T.fract(T.vec3(p.x, p.y, p.x).mul(0.1031)).toVar();
    p3.addAssign(T.dot(p3, p3.yzx.add(33.33)));
    return T.fract(p3.x.add(p3.y).mul(p3.z)) as unknown as F;
  };
  const vnoise = (p: V2): F => {
    const i = T.floor(p), f0 = T.fract(p);
    const f = f0.mul(f0).mul(T.float(3).sub(f0.mul(2)));
    return T.mix(
      T.mix(hash12(i), hash12(i.add(T.vec2(1, 0))), f.x),
      T.mix(hash12(i.add(T.vec2(0, 1))), hash12(i.add(T.vec2(1, 1))), f.x),
      f.y,
    ) as unknown as F;
  };
  const pcovI = (x: F, lo: number, hi: number): F => T.floor(x).mul(hi - lo).add(T.clamp(T.fract(x).sub(lo), 0, hi - lo)) as unknown as F;
  const pcov = (x: F, lo: number, hi: number, w0: F): F => {
    const w = T.max(w0, 1e-5);
    return T.clamp(pcovI(x.add(w.mul(0.5)) as F, lo, hi).sub(pcovI(x.sub(w.mul(0.5)) as F, lo, hi)).div(w), 0, 1) as unknown as F;
  };
  // SKYREFL_GLSL
  const skyLook = (R: V3, aur: number): V3 => {
    const up = T.clamp(R.y, -1, 1);
    const zen = env.skyAmbient.mul(env.reflGain.mul(1.95));
    const hor = env.fogColor.mul(env.reflGain.mul(2.55));
    const gnd = env.fogColor.mul(T.vec3(0.45, 0.4, 0.34)).mul(env.reflGain);
    const sky = T.mix(hor, zen, T.pow(T.max(up, 0), 0.42));
    const below = T.mix(hor, gnd, T.pow(T.max(up.negate(), 0), 0.55));
    const c = T.select(up.greaterThanEqual(0), sky, below);
    const mu = T.max(T.dot(R, env.sunDir), 0);
    return c.add(env.sunColor.mul(env.reflGain.mul(aur)).mul(T.pow(mu, 7))) as unknown as V3;
  };
  const fresnelR = (cosT: F, f0: F): F => f0.add(T.float(1).sub(f0).mul(T.pow(T.clamp(T.float(1).sub(cosT), 0, 1), 5))) as unknown as F;
  const sunDisc = (R: V3, rough: F, fp: F): F => {
    const e = T.float(2).div(T.max(rough.mul(rough), 1e-4)).div(T.float(1).add(fp.mul(220)));
    return T.min(T.pow(T.max(T.dot(R, env.sunDir), 0), T.clamp(e, 12, 4000)), 6) as unknown as F;
  };
  const safeNormal = (n: V3): V3 => {
    const l2 = T.dot(n, n);
    return T.select(l2.greaterThan(1e-20), n.div(T.sqrt(T.max(l2, 1e-20))), T.vec3(0, 1, 0)) as unknown as V3;
  };

  mat.colorNode = T.Fn(() => {
    const wPos = T.positionWorld;
    const vColor = T.attribute('color', 'vec4') as unknown as Node<'vec4'>;
    const uvN = T.uv();
    const base = vColor.rgb.mul(T.mix(T.vec3(1), fw14 ? T.texture(fw14, uvN).rgb : T.vec3(1), isShell));
    const dc = base.mul(base).toVar();   // sRGB bytes -> approx linear
    let N = safeNormal(T.cross(T.dFdx(wPos), T.dFdy(wPos)) as unknown as V3).toVar() as unknown as V3;
    const V = T.normalize(T.cameraPosition.sub(wPos));
    N = T.select(T.dot(N, V).lessThan(0), N.negate(), N) as unknown as V3;
    const ndl = T.max(T.dot(N, env.sunDir), 0);
    const aoA = T.attribute('ao', 'float') as unknown as F;
    const aoV = T.mix(T.float(1), aoA, T.step(T.float(0.001), aoA));
    const light = env.skyAmbient.mul(T.float(0.8).add(T.max(N.y, 0).mul(0.3))).mul(T.mix(WALL_SKY, 1, T.abs(N.y))).mul(aoV)
      .add(env.sunColor.mul(ndl.mul(1.05)).mul(T.smoothstep(-0.06, 0.04, env.sunDir.y)));
    dc.mulAssign(light);
    // TOWERFX
    const vertF = T.float(1).sub(T.abs(N.y));
    T.If(vertF.greaterThan(0.12), () => {
      {
        // far-only: the floor lines and the per-lot spread
        const fb = wPos.y.div(3.8) as unknown as F;
        const aaFb = T.max(T.fwidth(fb), 1e-4) as unknown as F;
        const bv = T.smoothstep(1.1, 0.28, aaFb).mul(vertF);
        dc.mulAssign(T.mix(1, T.mix(1, T.float(0.8).add(pcov(fb, 0.24, 0.96, aaFb.mul(1.25) as unknown as F).mul(0.3)), bv.mul(0.7)), isShell));
        dc.mulAssign(T.mix(1, T.float(0.85).add(hash12(T.floor(wPos.xz.div(26)).add(3.7) as unknown as V2).mul(0.3)), isShell));
      }
      const Rf = T.reflect(V.negate(), N);
      const glassy = T.smoothstep(0, 0.1, dc.b.sub(dc.r.mul(0.9)));
      const f0F = T.mix(0.05, 0.2, glassy) as unknown as F;
      const frF = fresnelR(T.max(T.dot(V, N), 0) as unknown as F, f0F);
      const fpF = T.length(T.fwidth(wPos)).mul(0.02) as unknown as F;
      dc.mulAssign(T.mix(1, T.mix(0.55, 0.3, glassy), glassy.mul(0.9)));
      dc.addAssign(skyLook(Rf as unknown as V3, 1.6).mul(frF).mul(vertF).mul(T.float(0.55).add(glassy.mul(1.15))));
      dc.addAssign(env.sunColor.mul(sunDisc(Rf as unknown as V3, T.mix(0.16, 0.06, glassy) as unknown as F, fpF))
        .mul(frF).mul(T.float(6).add(glassy.mul(16))).mul(env.reflGain).mul(vertF).mul(T.float(1).sub(env.night)));
    });
    {
      // far-only: the distance silhouette
      const aer = T.smoothstep(1800, 7000, T.distance(wPos, T.cameraPosition)).mul(vertF).mul(isShell);
      dc.mulAssign(T.mix(1, 0.66, aer));
      dc.assign(T.mix(dc, dc.mul(T.vec3(0.82, 0.95, 1.12)), aer.mul(0.6)));
    }
    dc.mulAssign(T.float(1).sub(env.night.mul(0.55)));
    dc.mulAssign(T.float(1).sub(env.wet.mul(0.3).mul(T.float(0.6).add(vnoise(wPos.xz.mul(0.031) as unknown as V2).mul(0.4)))));
    dc.assign(T.mix(dc, T.vec3(0.8, 0.83, 0.88), env.snow.mul(T.float(0.4).add(vnoise(wPos.xz.mul(0.06) as unknown as V2).mul(0.4)))));
    {
      // near: the emission, linear / 4 coded as sRGB bytes, times mix(lo, hi, night) with lo, hi over 4 in the two alphas
      const e = T.attribute('emissive', 'vec4') as unknown as Node<'vec4'>;
      const eLin = T.mix(e.rgb.div(12.92), T.pow(e.rgb.add(0.055).div(1.055), T.vec3(2.4)), T.step(T.vec3(0.04045), e.rgb)).mul(4);
      const k = T.mix(vColor.a.mul(4), e.a.mul(4), env.night);
      dc.addAssign(eLin.mul(k).mul(T.float(1).sub(isShell)));
    }
    {
      // shellMaterial.js v2 night windows on the FW14 bays (4 x 4 per tile)
      const wq = uvN.mul(4) as unknown as V2;
      const lodPx = T.max(T.length(T.fwidth(wq)), 1e-4);
      const lodL = T.max(0, T.log2(lodPx.mul(2)));
      const lodL0 = T.floor(lodL), lodFr = lodL.sub(lodL0);
      const lodP = vColor.a.mul(0.28);
      const sp = T.float(0).toVar();
      for (let k = 0; k < 2; k++) {
        const lodS = T.exp2(lodL0.add(k));
        const q = wq.div(lodS), c = T.floor(q), f = T.fract(q);
        const win = T.step(0.15, f.x).mul(T.step(f.x, 0.85)).mul(T.step(0.2, f.y)).mul(T.step(f.y, 0.85));
        const w = k === 0 ? T.float(1).sub(lodFr) : lodFr;
        sp.addAssign(T.step(hash12(c.add(T.vec2(lodL0.add(k).mul(17), 3)) as unknown as V2), lodP).mul(win).mul(w));
      }
      sp.mulAssign(env.night.mul(T.float(1).sub(T.smoothstep(0.5, 0.8, T.abs(N.y)))).mul(isShell));
      dc.addAssign(T.vec3(1, 0.82, 0.5).mul(sp).mul(1.1));
    }
    return T.vec4(dc, 1);
  })();
  return mat;
}
