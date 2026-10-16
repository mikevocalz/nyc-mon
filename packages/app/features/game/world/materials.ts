// TSL node materials for the city. Adapted from vg-demos-all
// src/demos/metro-live/shaders.ts (MIT; notice in geometry.ts and
// docs/implementation/city-world.md). That file writes its shading in
// TypeGPU through @typegpu/three; the surface patterns here stay plain TSL,
// and the lighting is the cel model from @acme/ui/three/cel (a TypeGPU port
// of the dsts-viewer cel shader, nuffle.me/dsts-viewer), which owns the
// typegpu dependency so @acme/app adds none.
//
// react-native-webgpu caveats from the metro-live README, all honoured:
// no shadow maps (the contact shadow below fakes them, and the cel key's
// self-shadow input stays at 1), no output pass (city-scene.ts sets linear
// output and no tone mapping), and no `scene.background = Color` (the sky
// is an unlit dome).
//
// Colours are authored as display values and fed as linear, so the frame
// shows the token colours unchanged under linear output (the same
// "colours used as authored" rule metro-live uses), without turning off
// three's colour management for every other scene in the app.
import type { Three } from '@acme/ui/three';
import { createCelMaterial, createCelRig, type CelMaterialOptions, type CelRig } from '@acme/ui/three/cel';
import { cityCelRig } from './cel-rig.ts';
import { CITY_COLORS, type CityColor } from './palette.ts';
import { WINDOW_GRID } from './windows.ts';
import type { Node } from 'three/webgpu';

type Mat = InstanceType<Three['Material']>;
type CelSurface = Omit<CelMaterialOptions, 'rig' | 'albedo' | 'rim'>;

/** Instance colour for the tree crowns, read into the albedo (instanceColor would tint after the lighting). */
export const TONE_ATTRIBUTE = 'instanceTone';

/**
 * Light added after the cel colour. NodeMaterial.setupLighting adds
 * `emissiveNode` to the outgoing light of every node material, the unlit
 * basic one included (three r186 NodeMaterial.js), so the glow sits on top
 * of the cel bands instead of being banded by them; fog still applies after.
 * Only MeshStandardNodeMaterial declares the field in the types.
 */
function setEmissive(material: InstanceType<Three['MeshBasicNodeMaterial']>, node: Node): void {
  (material as unknown as { emissiveNode: Node }).emissiveNode = node;
}

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
  const rig = createCelRig(THREE, cityCelRig(sunDirection));
  // Walls, roofs and trunks keep the rim sheen; flat ground seen at a
  // grazing angle would take it across its whole width, so it goes without.
  const cel = (albedo: CelMaterialOptions['albedo'], rim: number, surface: CelSurface = {}) =>
    createCelMaterial(THREE, { rig, albedo, rim, ...surface });

  // Sky dome at dusk: dusty rose at the horizon through royal to brand night overhead,
  // a warm glow around the low sun, fog colour below the horizon.
  const sky = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
  {
    const dir = T.normalize(T.positionLocal);
    const low = T.smoothstep(0, 0.22, dir.y);
    const high = T.smoothstep(0.18, 0.75, dir.y);
    const sun = T.vec3(sunDirection[0], sunDirection[1], sunDirection[2]).normalize();
    const glow = T.pow(T.max(T.dot(dir, sun), 0), 5).mul(0.6);
    const base = T.mix(T.mix(c('skyHorizon'), c('skyMid'), low), c('skyZenith'), high);
    sky.colorNode = T.mix(base, c('sunGlow'), glow);
  }

  // Facades: floors of windows and a shopfront band, from wall uv (u = metres
  // along, v = metres up). Lit windows glow after the cel lighting
  // (emissiveNode adds to the cel output), so the bands stay intact under
  // them. The pattern is windows.ts, the same hash and density per window.
  const facade = (grid: { floor: number; bay: number }, glassy: boolean) => {
    const u = T.uv().x;
    const v = T.uv().y;
    const fy = T.fract(v.div(grid.floor));
    const fx = T.fract(u.div(grid.bay));
    const upper = T.step(3.6, v);
    const pane = T.step(0.32, fy).mul(T.step(fy, 0.82)).mul(T.step(glassy ? 0.08 : 0.26, fx)).mul(T.step(fx, glassy ? 0.92 : 0.74)).mul(upper);
    const shop = T.step(0.4, v).mul(T.step(v, 3.1)).mul(glassy ? 0.5 : 0.65);
    const window = c('window');
    const patterned = T.mix(T.mix(vertexRgb, window, pane.mul(glassy ? 0.7 : 0.82)), window, shop);
    const average = T.mix(vertexRgb, window, glassy ? 0.35 : 0.18);
    const near = detail(260, 700);
    const material = cel(T.mix(average, patterned, near), 1);
    // Per-building seed from the wall colour (each wall varies by a hash of its id).
    const seed = T.fract(vertexRgb.x.mul(13.7).add(vertexRgb.y.mul(7.3))).mul(100);
    const column = T.floor(u.div(grid.bay));
    const row = T.floor(v.div(grid.floor));
    const hash = (a: typeof column, b: typeof column) => T.fract(T.sin(a.mul(12.9898).add(b.mul(78.233)).add(seed.mul(37.719))).mul(43758.5453));
    const density = T.float(0.25).add(T.fract(T.sin(seed.mul(7.31).mul(12.9898).add(3.7 * 78.233).add(1.13 * 37.719)).mul(43758.5453)).mul(0.5));
    const lit = T.step(hash(column, row), density).mul(T.step(1, row));
    const toneHash = hash(column.add(17.1), row.add(3.3));
    const tone = T.mix(T.mix(c('windowWarm'), c('windowAmber'), T.step(0.55, toneHash)), c('windowCool'), T.step(0.85, toneHash));
    const glowNear = tone.mul(pane.mul(lit).mul(glassy ? 0.75 : 0.85));
    // Far off the panes are sub-pixel: glow at the average lit share instead of shimmering.
    const glowFar = tone.mul(density.mul(glassy ? 0.3 : 0.22));
    setEmissive(material, T.mix(glowFar, glowNear, near));
    return material;
  };
  const masonry = facade(WINDOW_GRID.masonry, false);
  const glass = facade(WINDOW_GRID.glass, true);

  const roofs = cel(vertexRgb, 1);

  // Unlit, vertex coloured: marquee, sign and rooftop bands stay bright in any light.
  const accents = new THREE.MeshBasicNodeMaterial({ vertexColors: true });
  // Neon rooflines and storefront bands: unlit brand colour, fogged with distance like everything else.
  const neon = new THREE.MeshBasicNodeMaterial({ vertexColors: true });
  // LED billboards: the vertex gradient behind horizontal scan lines and a dot pitch, both fading out with distance.
  const billboards = new THREE.MeshBasicNodeMaterial();
  {
    const lines = T.step(0.35, T.fract(T.uv().y.mul(5)));
    const dots = T.step(0.25, T.fract(T.uv().x.mul(5)));
    const pattern = T.mix(T.float(0.82), T.float(0.62).add(lines.mul(dots).mul(0.38)), detail(60, 220));
    billboards.colorNode = T.vec4(vertexRgb.mul(pattern), 1);
  }

  const flat = (offset: number) => cel(vertexRgb, 0, {
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -offset, polygonOffsetUnits: -offset * 2,
  });
  const ground = cel(c('ground'), 0, { side: THREE.DoubleSide });
  const areas = flat(1);
  const sidewalks = flat(2);
  // A NeonBlade grid in the sidewalk slabs: thin carolina joints every 1.5 m,
  // drawn from world position so slabs line up across separate ways, gone
  // before the lines would alias.
  {
    const p = T.positionWorld.xz.div(1.5);
    const f = T.abs(T.fract(p).sub(0.5));
    const line = T.smoothstep(0.43, 0.48, T.max(f.x, f.y));
    setEmissive(sidewalks, c('sidewalkGrid').mul(line.mul(0.32).mul(detail(25, 90))));
  }

  // Asphalt with a double yellow centre line (vertex r = 1), a zebra crossing
  // (vertex g = 1) and a darker gutter; vertex b carries the width / 100.
  const roads = (() => {
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
    const painted = T.mix(lined, c('laneWhite'), zebra.mul(T.mix(T.float(0.35), T.float(1), fade)));
    const material = cel(painted, 0, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
    // A royal light line along each kerb (not on crossings), like the edge glow of a NeonBlade panel.
    const kerb = T.float(1).sub(vertexRgb.y).mul(T.step(T.abs(across.sub(width.mul(0.5).sub(0.35))), 0.07));
    setEmissive(material, c('curbGlow').mul(kerb.mul(0.9).mul(detail(60, 260))));
    return material;
  })();

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

  const trunks = cel(c('trunk'), 1);

  // Street furniture (street-furniture.ts, which also owns the lettering
  // material and its atlas). Poles are cel lit; the sign blade takes a little
  // self light, like retroreflective sheeting under headlights; lamp heads are unlit.
  const poles = cel(c('pole'), 1);
  const signBlades = cel(c('signGreen'), 1);
  setEmissive(signBlades, c('signGreen').mul(0.35));
  const lampHeads = new THREE.MeshBasicNodeMaterial();
  lampHeads.colorNode = T.vec4(c('lampHead'), 1);
  // Light pools under the lamps: additive, radial falloff from the disc uv centre.
  const lampPools = new THREE.MeshBasicNodeMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
  });
  {
    const r = T.uv().sub(0.5).length().mul(2);
    const fall = T.float(1).sub(T.smoothstep(0, 1, r));
    // No fog on an additive layer (it would add the haze colour); fade by distance instead.
    lampPools.colorNode = T.vec4(c('lampHalo').mul(fall.mul(fall).mul(0.32).mul(detail(80, 240))), 1);
  }

  const all: Mat[] = [sky, masonry, glass, roofs, accents, neon, billboards, ground, areas, sidewalks, roads, shadows, trunks, poles, signBlades, lampHeads, lampPools];
  return {
    sky, masonry, glass, roofs, accents, neon, billboards, ground, areas, sidewalks, roads, shadows, trunks,
    poles, signBlades, lampHeads, lampPools, rig,
    dispose: () => { for (const material of all) material.dispose(); },
  };
}

export type CityMaterials = ReturnType<typeof createCityMaterials>;

/**
 * Leaf crowns (metro-live createLeafMaterial without wind or autumn): cut-out
 * leaf cards around a dark core, cel lit through the crown's outward
 * normals. The instance tone picks the green. The texture is the alpha of
 * the Quaternius leaf card.
 */
export function createLeafMaterial(THREE: Three, rig: CelRig, map: InstanceType<Three['Texture']>) {
  const T = THREE.TSL;
  const leaf = T.attribute<'float'>('leaf', 'float');
  const tone = T.attribute<'vec3'>(TONE_ATTRIBUTE, 'vec3');
  const card = T.step(0.5, leaf);
  const alpha = T.texture(map, T.uv()).r;
  const rim = T.mix(T.float(0.86), T.float(1), T.smoothstep(0.55, 0.95, alpha));
  const shade = T.mix(T.float(0.74), leaf.mul(rim), card);
  const material = createCelMaterial(THREE, { rig, albedo: tone.mul(T.vec3(shade, shade.mul(1.01), shade.mul(0.97))), alphaTest: 0.5 });
  // Chase-camera cut-away: leaves inside a 6 m sphere around the camera
  // drop out through the same alpha test, so a close camera (8 m chase,
  // crowns ~3.8 m up) sees the Caller through the tree instead of a wall of
  // leaves. Beyond 9 m the crown is whole.
  const nearCamera = T.smoothstep(6, 9, T.cameraPosition.distance(T.positionWorld));
  material.opacityNode = T.mix(T.float(1), alpha, card).mul(nearCamera);
  return material;
}

/** Far crowns: no cut-outs, the same cel-lit ball in the instance tone. */
export function createFarCrownMaterial(THREE: Three, rig: CelRig) {
  return createCelMaterial(THREE, { rig, albedo: THREE.TSL.attribute<'vec3'>(TONE_ATTRIBUTE, 'vec3') });
}
