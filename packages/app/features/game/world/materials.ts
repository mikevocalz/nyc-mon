// TSL node materials for the city. Adapted from vg-demos-all
// src/demos/metro-live/shaders.ts (MIT; notice in geometry.ts and
// docs/implementation/city-world.md). That file writes its shading in
// TypeGPU through @typegpu/three; @acme/app does not depend on either
// package and this lane adds no runtime dependency, so the same ideas are
// written in plain TSL here (Decision: BUILD in TSL, DEFER a TypeGPU port
// until @acme/app declares typegpu).
//
// react-native-webgpu caveats from the metro-live README, all honoured:
// no shadow maps (the contact shadow below fakes them), no output pass
// (city-scene.ts sets linear output and no tone mapping), and no
// `scene.background = Color` (the sky is an unlit dome).
//
// Colours are authored as display values and fed as linear, so the frame
// shows the token colours unchanged under linear output (the same
// "colours used as authored" rule metro-live uses), without turning off
// three's colour management for every other scene in the app.
import type { Three } from '@acme/ui/three';
import { CITY_COLORS, type CityColor } from './palette.ts';

type Mat = InstanceType<Three['Material']>;

export function linearColor(THREE: Three, key: CityColor): InstanceType<Three['Color']> {
  return new THREE.Color().setStyle(CITY_COLORS[key], THREE.LinearSRGBColorSpace);
}

/** Every material the city needs, built once per scene and disposed together. */
export function createCityMaterials(THREE: Three, sunDirection: readonly [number, number, number]) {
  const T = THREE.TSL;
  const c = (key: CityColor) => T.color(linearColor(THREE, key));
  const camDistance = T.cameraPosition.distance(T.positionWorld);
  // Fine patterns alias into moire once a window or a dash is a pixel or two.
  const detail = (near: number, far: number) => T.float(1).sub(T.smoothstep(near, far, camDistance));
  const vertexRgb = T.attribute<'vec3'>('color', 'vec3');

  // Sky dome: horizon to zenith, a warm glow towards the sun, fog colour below the horizon.
  const sky = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
  {
    const dir = T.normalize(T.positionLocal);
    const up = T.smoothstep(0, 0.55, dir.y);
    const sun = T.vec3(sunDirection[0], sunDirection[1], sunDirection[2]).normalize();
    const glow = T.pow(T.max(T.dot(dir, sun), 0), 6).mul(0.45);
    const base = T.mix(c('skyHorizon'), c('skyZenith'), up);
    sky.colorNode = T.mix(base, c('sunGlow'), glow);
  }

  // Facades: floors of windows and a shopfront band, from wall uv (u = metres along, v = metres up).
  const facade = (floor: number, bay: number, glassy: boolean) => {
    const material = new THREE.MeshStandardNodeMaterial({ roughness: glassy ? 0.35 : 0.9, metalness: 0 });
    const u = T.uv().x;
    const v = T.uv().y;
    const fy = T.fract(v.div(floor));
    const fx = T.fract(u.div(bay));
    const upper = T.step(3.6, v);
    const pane = T.step(0.32, fy).mul(T.step(fy, 0.82)).mul(T.step(glassy ? 0.08 : 0.26, fx)).mul(T.step(fx, glassy ? 0.92 : 0.74)).mul(upper);
    const shop = T.step(0.4, v).mul(T.step(v, 3.1)).mul(glassy ? 0.5 : 0.65);
    const window = c('window');
    const patterned = T.mix(T.mix(vertexRgb, window, pane.mul(glassy ? 0.7 : 0.82)), window, shop);
    const average = T.mix(vertexRgb, window, glassy ? 0.35 : 0.18);
    material.colorNode = T.mix(average, patterned, detail(260, 700));
    return material;
  };
  const masonry = facade(3.2, 3.0, false);
  const glass = facade(3.6, 1.6, true);

  const roofs = new THREE.MeshStandardNodeMaterial({ roughness: 1, metalness: 0, vertexColors: true });

  // Unlit, vertex coloured: marquee, sign and rooftop bands stay bright in any light.
  const accents = new THREE.MeshBasicNodeMaterial({ vertexColors: true });

  const flat = (offset: number) => {
    const material = new THREE.MeshStandardNodeMaterial({
      roughness: 1, metalness: 0, vertexColors: true, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -offset, polygonOffsetUnits: -offset * 2,
    });
    return material;
  };
  const ground = new THREE.MeshStandardNodeMaterial({ roughness: 1, metalness: 0, side: THREE.DoubleSide });
  ground.colorNode = c('ground');
  const areas = flat(1);
  const sidewalks = flat(2);

  // Asphalt with a double yellow centre line (vertex r = 1), a zebra crossing
  // (vertex g = 1) and a darker gutter; vertex b carries the width / 100.
  const roads = new THREE.MeshStandardNodeMaterial({
    roughness: 0.95, metalness: 0, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
  });
  {
    const u = T.uv().x;
    const v = T.uv().y;
    const width = vertexRgb.z.mul(100);
    const across = T.abs(u.sub(0.5)).mul(width);
    const centre = vertexRgb.x.mul(T.step(T.abs(across.sub(0.18)), 0.07));
    const gutter = T.smoothstep(width.mul(0.5).sub(0.5), width.mul(0.5), across).mul(0.25);
    const zebra = vertexRgb.y.mul(T.step(T.fract(v.div(1.2)), 0.55));
    const fade = detail(220, 600);
    const asphalt = T.mix(c('asphalt'), c('shadow'), gutter);
    const lined = T.mix(asphalt, c('laneYellow'), centre.mul(fade));
    roads.colorNode = T.mix(lined, c('laneWhite'), zebra.mul(T.mix(T.float(0.35), T.float(1), fade)));
  }

  // Fake soft contact shadow under every building: a strip around the
  // footprint whose uv.y runs 0 at the wall to 1 at the outer edge
  // (metro-live createContactShadowMaterial, as a ring instead of a square).
  const shadows = new THREE.MeshBasicNodeMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
  });
  shadows.colorNode = c('shadow');
  {
    const fall = T.float(1).sub(T.uv().y);
    shadows.opacityNode = fall.mul(fall).mul(0.34);
  }

  const trunks = new THREE.MeshStandardNodeMaterial({ roughness: 1, metalness: 0 });
  trunks.colorNode = c('trunk');

  const all: Mat[] = [sky, masonry, glass, roofs, accents, ground, areas, sidewalks, roads, shadows, trunks];
  return {
    sky, masonry, glass, roofs, accents, ground, areas, sidewalks, roads, shadows, trunks,
    dispose: () => { for (const material of all) material.dispose(); },
  };
}

export type CityMaterials = ReturnType<typeof createCityMaterials>;

/**
 * Leaf crowns (metro-live createLeafMaterial without wind or autumn): cut-out
 * leaf cards around a dark core, lit as one soft ball. Instance colour picks
 * the green. The texture is the alpha of the Quaternius leaf card.
 */
export function createLeafMaterial(THREE: Three, map: InstanceType<Three['Texture']>) {
  const T = THREE.TSL;
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.92, metalness: 0, alphaTest: 0.5 });
  const leaf = T.attribute<'float'>('leaf', 'float');
  const card = T.step(0.5, leaf);
  const alpha = T.texture(map, T.uv()).r;
  // Chase-camera cut-away: leaves inside a 6 m sphere around the camera
  // drop out through the same alpha test, so a close camera (8 m chase,
  // crowns ~3.8 m up) sees the Caller through the tree instead of a wall of
  // leaves. Beyond 9 m the crown is whole.
  const nearCamera = T.smoothstep(6, 9, T.cameraPosition.distance(T.positionWorld));
  material.opacityNode = T.mix(T.float(1), alpha, card).mul(nearCamera);
  const up = T.normalLocal.y;
  const light = T.mix(T.float(0.72), T.float(1.14), T.smoothstep(-0.75, 0.95, up));
  const rim = T.mix(T.float(0.86), T.float(1), T.smoothstep(0.55, 0.95, alpha));
  const shade = T.mix(T.float(0.74), leaf.mul(rim), card).mul(light);
  material.colorNode = T.vec3(shade, shade.mul(1.01), shade.mul(0.97));
  // Leaves never go fully black in shade.
  material.emissiveNode = T.vec3(0.04, 0.06, 0.03).mul(T.float(1).sub(T.smoothstep(-0.2, 0.8, up)));
  return material;
}

/** Far crowns: no cut-outs, the same soft top-lit ball. */
export function createFarCrownMaterial(THREE: Three) {
  const T = THREE.TSL;
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0 });
  const light = T.mix(T.float(0.7), T.float(1.1), T.smoothstep(-0.6, 0.9, T.normalLocal.y));
  material.colorNode = T.vec3(light, light, light);
  return material;
}
