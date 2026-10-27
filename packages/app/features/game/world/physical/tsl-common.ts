// Adapted from mrdoob/slop-newyork @ be65d0a, js/tsl-materials.js hash2D, noise2D, bumpNormal, lineAA, gridLine, filteredPulse (MIT, © 2026 Mr.doob)
//
// The TSL helpers every Slop-grade material shares, built once per
// `three/webgpu` module (the renderer loads three on demand, so nothing here
// imports it at module scope). Slop wraps bumpNormal, lineAA and gridLine in
// Fn so the WGSL builder emits one function instead of inlining the
// derivative trees; this keeps that. bumpNormal is Mikkelsen's
// surface-gradient bump (Slop credits three's CityGeneratorUtils.js);
// lineAA and gridLine come from CityGenerator.js and SidewalkGenerator.js
// by way of Slop.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { looseTsl, type LooseTsl, type TslNode } from './loose-tsl.ts';

/**
 * The live values the time-of-day rig drives (Slop js/tsl-materials.js
 * `cityUniforms`, set per preset by js/lighting.js). The light-rig lane owns
 * the uniform objects; the materials only read them, so any object with
 * these fields wires in.
 */
export interface PhysicalMaterialUniforms {
  /** Sun colour, linear RGB. */
  uSunColor: Node;
  /** Sky colour overhead and at the horizon, linear RGB. */
  uSkyTopColor: Node;
  uSkyHorizonColor: Node;
  /** Unit vector toward the sun, world space. */
  uSkySunDir: Node;
  /** Interior and street glow: Slop's presets run 0.1 (midday) to 1.3 (midnight). */
  uInteriorGlow: Node;
  /** Road wetness, 0 = bone dry … 1 = right after a downpour. */
  uRoadWetness: Node;
  /** Strength of the warm bounce light low in the street canyon. */
  uCanyonBounce: Node;
}

type Arg = TslNode | number;

export interface PhysicalTsl {
  T: LooseTsl;
  /** Token colour (`#RRGGBB`, sRGB) as a TSL colour in the linear working space, as Slop's color(0x…) is. */
  c(hex: string): TslNode;
  hash2D(p: TslNode): TslNode;
  noise2D(p: TslNode): TslNode;
  bumpNormal(height: TslNode): TslNode;
  lineAA(coord: TslNode, halfWidth: Arg): TslNode;
  gridLine(coord: TslNode, period: Arg, halfWidth: Arg): TslNode;
  filteredPulse(x: TslNode, a: Arg, b: Arg, w: Arg): TslNode;
}

const cache = new WeakMap<object, PhysicalTsl>();

/** The shared helpers for one `three/webgpu` module instance. */
export function physicalTsl(THREE: Three): PhysicalTsl {
  const hit = cache.get(THREE);
  if (hit) return hit;
  const T = looseTsl(THREE);

  const hash2D = T.Fn(([p]: [TslNode]) => T.fract(T.sin(T.dot(p, T.vec2(127.1, 311.7))).mul(43758.5453)));

  const noise2D = T.Fn(([p]: [TslNode]) => {
    const pv = T.vec2(p).toVar();
    const i = T.floor(pv).toVar();
    const f = T.fract(pv).toVar();
    const u = f.mul(f).mul(T.float(3.0).sub(f.mul(2.0))).toVar();
    const a = hash2D(i);
    const b = hash2D(i.add(T.vec2(1.0, 0.0)));
    const cc = hash2D(i.add(T.vec2(0.0, 1.0)));
    const d = hash2D(i.add(T.vec2(1.0, 1.0)));
    return T.mix(T.mix(a, b, u.x), T.mix(cc, d, u.x), u.y);
  });

  // `height` is evaluated once into a parameter before dFdx/dFdy.
  const bumpNormal = T.Fn(([height]: [TslNode]) => {
    const h = T.float(height).toVar();
    const dpdx = T.positionView.dFdx();
    const dpdy = T.positionView.dFdy();
    const r1 = dpdy.cross(T.normalView);
    const r2 = T.normalView.cross(dpdx);
    const det = dpdx.dot(r1);
    const grad = det.sign().mul(h.dFdx().mul(r1).add(h.dFdy().mul(r2)));
    return det.abs().mul(T.normalView).sub(grad).normalize();
  });

  const lineAA = T.Fn(([coord, halfWidth]: [TslNode, TslNode]) => {
    const c = T.float(coord).toVar();
    const hw = T.float(halfWidth).toVar();
    const aa = T.fwidth(c).max(0.0001).toVar();
    const effHw = T.max(hw, aa.mul(0.5)).toVar();
    const cov = T.smoothstep(effHw.add(aa), effHw.sub(aa), T.abs(c));
    return cov.mul(T.min(T.float(1.0), hw.div(effHw)));
  });

  const gridLine = T.Fn(([coord, period, halfWidth]: [TslNode, TslNode, TslNode]) => {
    const p = T.float(period).toVar();
    const g = T.float(coord).div(p).toVar();
    const d = T.float(0.5).sub(T.abs(T.fract(g).sub(0.5))).toVar();
    const aa = T.fwidth(g).max(0.0001).toVar();
    const hw = T.float(halfWidth).div(p).toVar();
    const effHw = T.max(hw, aa.mul(0.5)).toVar();
    const cov = T.smoothstep(effHw.add(aa), effHw.sub(aa), d);
    return cov.mul(T.min(T.float(1.0), hw.div(effHw)));
  });

  // Box-filtered periodic pulse: the share of a `w`-wide footprint around `x`
  // where fract() lies in [a, b]. It settles to b − a once a period is
  // sub-pixel, so facade grids do not shimmer or moiré at distance.
  const filteredPulse = T.Fn(([x, a, b, w]: [TslNode, TslNode, TslNode, TslNode]) => {
    const p = T.float(x).toVar();
    const lo = T.float(a).toVar();
    const hi = T.float(b).toVar();
    const hw = T.max(T.float(w), 0.0001).mul(0.5).toVar();
    const integral = (t: TslNode) => T.floor(t).mul(hi.sub(lo)).add(T.clamp(T.fract(t), lo, hi).sub(lo));
    return integral(p.add(hw)).sub(integral(p.sub(hw))).div(hw.mul(2.0));
  });

  const tools: PhysicalTsl = {
    T,
    c: (hex) => T.color(new THREE.Color(hex)),
    hash2D: (p) => hash2D(p),
    noise2D: (p) => noise2D(p),
    bumpNormal: (h) => bumpNormal(h),
    lineAA: (coord, halfWidth) => lineAA(coord, halfWidth),
    gridLine: (coord, period, halfWidth) => gridLine(coord, period, halfWidth),
    filteredPulse: (x, a, b, w) => filteredPulse(x, a, b, w),
  };
  cache.set(THREE, tools);
  return tools;
}
