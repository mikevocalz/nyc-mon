// Reads Valdrada's viaduct materials (client/src/city/vk/vkMats.js @ 2724c79, MIT; stations/irt125.js and vk/park.js
// for the sign boards) off the live objects the vd-port runtime builds (valdrada-runtime.mjs), as JSON descriptors for
// packages/app/features/game/world/vd-port/furniture/vk-materials.ts createVkMaterial.
//
// Where each value comes from, and why that source:
//   vkSteel   material.userData.vk: steelMat keeps the very uniform objects it hands onBeforeCompile there (L191), so
//             every value, setRivBand's vkBand included, is read as the shader would see it. Colours are the Vector3s
//             hex3 builds through THREE.Color, i.e. linear. Roughness and metalness are the material's own.
//   vkLit     litMat sets no name; its customProgramCacheKey is 'vkLit' + name (L271). dayK and nightK exist only as
//             literals in the GLSL its onBeforeCompile writes, so that closure is run on a stub shader and the
//             literals are read back out of the `mix(dayK, nightK, kNightW)` it injects.
//   vkTex     the canvas cards, by the names Valdrada gives them (TEX_NAMES), the canvas behind map or alphaMap; the
//             second material named vk-netting (otherMat('netting'), no alphaMap) is a vkOther.
//   vkOther   any other `vk-` MeshStandardMaterial: otherMat's FALL path and the lit-trimmed one-offs (vk/park.js
//             glassW). Plain material properties.
//   trim      applyLightTrim leaves no field; its customProgramCacheKey ends in '|lighttrim<r,g,b>' and '|st34' when the
//             ST34 specular trim is on (world/materials.js L312). Parsed from there; null when the material is untrimmed
//             (the irt125 sign boards).
//   null      for anything else, notably otherMat's library path ('pbr:<set>' materials from city/mat/pbrLib.js, which
//             the runtime loads on a default run): those are not vkMats.js materials.

const TEX_NAMES = new Set(['vk-netting', 'vk-fence', 'vk-spikes', 'vk-st34sign', 'vk-st34name', 'vk-parkName', 'vk-parkTags']);

const lin = (c) => [c.r, c.g, c.b];
const vec = (v) => (v.isColor ? [v.r, v.g, v.b] : v.isVector4 ? [v.x, v.y, v.z, v.w] : v.isVector3 ? [v.x, v.y, v.z] : v);

function trimOf(material) {
  const key = typeof material.customProgramCacheKey === 'function' ? material.customProgramCacheKey() : '';
  const m = /\|lighttrim([-\d.e,]+)(\|st34)?/.exec(key);
  if (!m) return null;
  const s = m[1].split(',').map(Number);
  return { scale: [s[0], s[1], s[2]], st34: !!m[2] };
}

// litMat's dayK / nightK: run its onBeforeCompile (wrapped by applyLightTrim) on a stub shader
function litFactors(material) {
  const sh = {
    uniforms: {},
    vertexShader: '#include <common>\n',
    fragmentShader: '#include <common>\n#include <color_fragment>\n#include <emissivemap_fragment>\n#include <lights_physical_fragment>\n',
  };
  material.onBeforeCompile(sh, null);
  const m = /totalEmissiveRadiance \*= mix\(([-\d.]+), ([-\d.]+), kNightW\)/.exec(sh.fragmentShader);
  if (!m) throw new Error(`describe-vk: no emissive day/night factors in ${material.customProgramCacheKey()}`);
  return { dayK: Number(m[1]), nightK: Number(m[2]) };
}

function base(material, name) {
  return {
    name,
    color: lin(material.color),
    roughness: material.roughness, metalness: material.metalness,
    opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite, alphaTest: material.alphaTest,
    side: material.side,
    emissive: lin(material.emissive), emissiveIntensity: material.emissiveIntensity,
    trim: trimOf(material),
    noShadow: !!material.userData.noShadow,
  };
}

function texRef(material, t) {
  const img = t.image;
  return {
    key: material.name,
    width: img.width, height: img.height,
    colorSpace: t.colorSpace === 'srgb' ? 'srgb' : 'linear',
    repeat: [t.repeat.x, t.repeat.y],
    wrapS: t.wrapS, wrapT: t.wrapT,
    anisotropy: t.anisotropy,
  };
}

/** A JSON-able descriptor of one Valdrada vk material, or null when it is not one. */
export function describeVk(material) {
  if (!material || !material.isMeshStandardMaterial) return null;
  const U = material.userData && material.userData.vk;
  const key = typeof material.customProgramCacheKey === 'function' ? material.customProgramCacheKey() : '';
  if (U && key.startsWith('vkSteel8')) {
    const uniforms = {};
    for (const [k, u] of Object.entries(U)) uniforms[k] = vec(u.value);
    const trim = trimOf(material);
    return {
      family: 'vkSteel', name: material.name, uniforms,
      roughness: material.roughness, metalness: material.metalness,
      // vkMats.js L169 VK_ST34K: ST34 ? '1.6' : '1.0'; ST34 is the flag applyLightTrim keys as '|st34'
      st34K: trim && trim.st34 ? 1.6 : 1.0,
      trim,
      noShadow: !!material.userData.noShadow,
    };
  }
  if (key.startsWith('vkLit')) {
    const name = key.slice(5).split('|')[0];
    return { family: 'vkLit', ...base(material, name), ...litFactors(material) };
  }
  if (typeof material.name !== 'string' || !material.name.startsWith('vk-')) return null;
  if (TEX_NAMES.has(material.name)) {
    const slots = ['map', 'alphaMap', 'emissiveMap'].filter((s) => material[s]);
    const t = material.map || material.alphaMap;
    if (t && t.image) return { family: 'vkTex', ...base(material, material.name), texture: texRef(material, t), slots };
  }
  return { family: 'vkOther', ...base(material, material.name) };
}

/**
 * The canvas behind a vkTex material's map or alphaMap, read from the napi canvas, RGBA8 unpremultiplied, rows
 * bottom-up when the texture flips (CanvasTexture's default flipY), so the lead can upload it with flipY false.
 */
export function vkTexturePixels(material) {
  const d = describeVk(material);
  if (!d || d.family !== 'vkTex') return null;
  const t = material.map || material.alphaMap;
  const img = t.image, w = img.width, h = img.height;
  const src = img.getContext('2d').getImageData(0, 0, w, h).data;
  const rgba = new Uint8Array(w * h * 4);
  const row = w * 4;
  for (let y = 0; y < h; y++) {
    const from = (t.flipY ? h - 1 - y : y) * row;
    rgba.set(src.subarray(from, from + row), y * row);
  }
  return { key: d.texture.key, width: w, height: h, rgba };
}
