// describePbr(material): what one of Valdrada's PBR library materials (client/src/city/mat/pbrLib.js pbrMaterial) is,
// read off the live material, for vd-port/furniture/pbr-material.ts createPbrMaterial. Lane C of the vd port.
//
// pbrLib keeps no record of its constants beyond `userData.pbr = { name, opts }` (pbrMaterial); the rest live in the
// uniforms its onBeforeCompile installs. As Valdrada's own cell baker does (client/src/cells/bakeLib.js obcUniforms,
// docs/specs/cell-package.md §4 `obcUni`), the material's onBeforeCompile is run once on a stand-in shader and the
// uniforms it installs are read back: pbrLib's own (pbSize, pbRatio, pbUnit, pbRot, ...), and those of the wrappers
// pbrMaterial chains after it (applyCityAO, applyLightTrim, and applySkyMetal for a metal set). The stand-in's patched
// source also gives the switches pbrLib bakes into the program text rather than a uniform (the paint branch, the
// paint-over, street weathering, gum, the city reflection, the vertex attributes), each matched on pbrLib's own code.
//
// The descriptor is plain data (JSON-safe): numbers, arrays, strings. A texture uniform is `{ texture: <set> }` for the
// set's three maps, `{ texture: null }` for any other; a uniform holding page state (the ENV clocks and the time of
// day: pbNight, ltNight, caoNight, the ENV objects) is `{ dynamic: <ENV key> }`, its value left to the port.
import { vd } from './valdrada-runtime.mjs';

const { ENV } = await vd('world/materials.js');
const pbrLib = await vd('city/mat/pbrLib.js');

// three's chunk names every patch in the chain replaces (pbrLib, applyCityAO, applyLightTrim, applySkyMetal)
const STUB = {
  vertexShader: ['common', 'uv_pars_vertex', 'begin_vertex', 'beginnormal_vertex', 'worldpos_vertex', 'project_vertex'].map((c) => `#include <${c}>`).join('\n'),
  fragmentShader: ['common', 'map_fragment', 'color_fragment', 'roughnessmap_fragment', 'metalnessmap_fragment', 'normal_fragment_maps',
    'emissivemap_fragment', 'lights_physical_fragment', 'lights_fragment_begin', 'lights_fragment_end', 'aomap_fragment', 'opaque_fragment']
    .map((c) => `#include <${c}>`).join('\n'),
};
const ENV_KEY = new Map(Object.entries(ENV).map(([k, u]) => [u, k]));

function value(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'boolean') return +v;
  if (v.isTexture) return { texture: null };
  if (v.isColor) return [v.r, v.g, v.b];
  if (v.isVector2 || v.isVector3 || v.isVector4) return v.toArray();
  if (Array.isArray(v) && v.every((x) => typeof x === 'number')) return [...v];
  return undefined;
}

/** The descriptor of a pbrLib surface material, or null for anything else (glass, a plain material). */
export function describePbr(material) {
  const pbr = material && material.userData && material.userData.pbr;
  if (!pbr || typeof material.onBeforeCompile !== 'function') return null;
  const info = pbrLib.pbrInfo(pbr.name);
  if (info.family === 'glass') return null;
  const sh = { uniforms: {}, vertexShader: STUB.vertexShader, fragmentShader: STUB.fragmentShader, defines: {} };
  material.onBeforeCompile.call(material, sh, undefined);
  const fs = sh.fragmentShader, vs = sh.vertexShader;
  const has = (s) => fs.includes(s);
  const out = {
    family: 'pbr',
    name: pbr.name,
    set: info.set,
    surfaceFamily: info.family,
    opts: JSON.parse(JSON.stringify(pbr.opts ?? {})),
    tint: pbr.opts?.tint ?? info.mean,
    dirt: sh.uniforms.pbDirt ? sh.uniforms.pbDirt.value : null,
    seed: sh.uniforms.pbSeed ? sh.uniforms.pbSeed.value : null,
    trim: pbr.opts?.trim ?? null,
    side: material.side,
    roughness: material.roughness,
    metalness: material.metalness,
    envMapIntensity: material.envMapIntensity,
    // the program switches (pbrLib makeSurface's template branches), each matched on its own code
    paint: has('float pm = 1.0 - (1.0 - pbO.a) * pbChips;'),
    over: has('float thr = pbOver.x;'),
    street: !has('if (pbGy0 < -9000.0)'),
    gum: has('vec2 gc = vPbW.xz / 0.23;'),
    city: has('pbCityK(cRw'),
    skyMetal: has('uSmTn'),
    grimeAttr: vs.includes('attribute float aGrime;'),
    weatherAttr: vs.includes('aWeather;'),
    dirtAttr: vs.includes('attribute vec4 aWeather;'),
    attrs: [...new Set([...vs.matchAll(/attribute\s+\w+\s+(\w+)\s*;/g)].map((x) => x[1]))],
  };
  for (const [k, u] of Object.entries(sh.uniforms)) {
    const envKey = ENV_KEY.get(u);
    if (envKey) {
      // ENV's live objects (night, the city AO bake and its rect, st34, cs34 ...): the page's state, not this material's
      out[k] = { dynamic: envKey };
      continue;
    }
    const val = value(u && typeof u === 'object' && 'value' in u ? u.value : u);
    if (val === undefined) continue;
    out[k] = val;
  }
  for (const k of ['pbAlb', 'pbNrm', 'pbOrm']) if (out[k]) out[k] = { texture: info.set };
  return out;
}

