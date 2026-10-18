// TSL node materials for the city. Adapted from vg-demos-all
// src/demos/metro-live/shaders.ts (MIT; notice in geometry.ts and
// docs/implementation/city-world.md). That file writes its shading in
// TypeGPU through @typegpu/three; the surface patterns here stay plain TSL.
// Two lighting bodies share them: the cel model from @acme/ui/three/cel (a
// TypeGPU port of the dsts-viewer cel shader, nuffle.me/dsts-viewer, which
// owns the typegpu dependency so @acme/app adds none), and the flagged PBR
// path in pbr-materials.ts (lane L2), which puts the same albedo, emissive
// and mask graphs on MeshStandardNodeMaterial. The graph builders below are
// the contract between the two — a pattern change lands in both renders.
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
import { LIT_SHARE_CAP, LIT_SHARE_DAY, LIT_SHARE_GAIN, LIT_SHARE_TOD, WINDOW_GRID } from './windows.ts';
import { ATLAS_HEIGHT, ATLAS_WIDTH, atlasPixels } from './pixel-font.ts';
import type { Node } from 'three/webgpu';

type Mat = InstanceType<Three['Material']>;
type BasicMat = InstanceType<Three['MeshBasicNodeMaterial']>;
type TextureT = InstanceType<Three['Texture']>;
type CelSurface = Omit<CelMaterialOptions, 'rig' | 'albedo' | 'rim'>;

/** Instance colour for the tree crowns, read into the albedo (instanceColor would tint after the lighting). */
export const TONE_ATTRIBUTE = 'instanceTone';

/**
 * Light added after the material's own colour. NodeMaterial.setupLighting
 * adds `emissiveNode` to the outgoing light of every node material, the
 * unlit basic one included (three r186 NodeMaterial.js), so the glow sits
 * on top of the cel bands (and on top of the PBR direct light) instead of
 * being banded by them; fog still applies after. Only the standard/physical
 * node materials declare the field in the types.
 */
function setEmissive(material: BasicMat, node: Node): void {
  (material as unknown as { emissiveNode: Node }).emissiveNode = node;
}

export function linearColor(THREE: Three, key: CityColor): InstanceType<Three['Color']> {
  return new THREE.Color().setStyle(CITY_COLORS[key], THREE.LinearSRGBColorSpace);
}

/**
 * TSL shorthand shared by the cel and the PBR factory: palette colours as
 * nodes, the distance fade fine patterns die by, and the wall/vertex colour
 * attribute the facade seed reads.
 */
export function cityShaderTools(THREE: Three) {
  const T = THREE.TSL;
  const c = (key: CityColor) => T.color(linearColor(THREE, key));
  const camDistance = T.cameraPosition.distance(T.positionWorld);
  // Fine patterns alias into moire once a window or a dash is a pixel or two.
  const detail = (near: number, far: number) => T.float(1).sub(T.smoothstep(near, far, camDistance));
  const vertexRgb = T.attribute<'vec3'>('color', 'vec3');
  return { T, c, detail, vertexRgb };
}

/**
 * Sky dome at dusk: dusty rose at the horizon through royal to brand night
 * overhead, a warm glow around the low sun, fog colour below the horizon.
 * Unlit; the L1 rig's dome replaces it when EXPO_PUBLIC_WORLD_SKY_RIG is on.
 */
export function createSkyMaterial(THREE: Three, sunDirection: readonly [number, number, number]): BasicMat {
  const { T, c } = cityShaderTools(THREE);
  const sky = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
  const dir = T.normalize(T.positionLocal);
  const low = T.smoothstep(0, 0.22, dir.y);
  const high = T.smoothstep(0.18, 0.75, dir.y);
  const sun = T.vec3(sunDirection[0], sunDirection[1], sunDirection[2]).normalize();
  const glow = T.pow(T.max(T.dot(dir, sun), 0), 5).mul(0.6);
  const base = T.mix(T.mix(c('skyHorizon'), c('skyMid'), low), c('skyZenith'), high);
  sky.colorNode = T.mix(base, c('sunGlow'), glow);
  return sky;
}

/**
 * The window grid as the facade pattern computes it, handed to the L3
 * window layer (glass.ts) so room mapping, blinds and AC units stay on the
 * same cells, seeds and lit pattern — one pattern, two lanes. Every node is
 * raw (no distance fade); the layer applies its own pixel-size fade.
 */
export interface FacadeWindowGraphs {
  /** Pane coverage inside upper-floor cells (0/1 bands, unfaded). */
  pane: Node<'float'>;
  /** Storefront band coverage (0/1, unfaded). */
  shop: Node<'float'>;
  /** Roll-down gate coverage inside the shop band (0/1, unfaded). */
  gate: Node<'float'>;
  /** fract() position inside the bay/floor cell (x across the bay, y up the floor). */
  cell: Node<'vec2'>;
  /** Bay and floor indices of the cell. */
  column: Node<'float'>;
  row: Node<'float'>;
  /** Per-building seed 0..100 derived from the wall vertex colour. */
  seed: Node<'float'>;
  /** The building's lit share (windows.ts litDensity, 0.25..0.75). */
  density: Node<'float'>;
  /** The windows.ts shader hash of the cell, offset by (dx, dy) — same formula as the CPU `windowHash`. */
  hash(dx: number, dy: number): Node<'float'>;
  /** Wall uv in metres (x along the wall, y up it). */
  u: Node<'float'>;
  v: Node<'float'>;
}

export interface FacadeGraphs {
  /** Albedo with the distance fade folded in (near pattern → far average). */
  albedo: Node<'vec3'> | Node<'color'>;
  /** Lit windows and shop glow, to be added after the lighting model. */
  emissive: Node<'vec3'> | Node<'color'>;
  /** Window-pane coverage × the near fade — the PBR lane mixes glass-like roughness in here. */
  panes: Node<'float'>;
  /** Storefront-glass coverage × the near fade. */
  shops: Node<'float'>;
  /** Roll-down steel gate coverage × the near fade. */
  gates: Node<'float'>;
  /** Raw window-grid internals for the L3 layer (glass.ts); see FacadeWindowGraphs. */
  window: FacadeWindowGraphs;
}

/**
 * Facades: floors of windows and a shopfront band, from wall uv (u = metres
 * along, v = metres up). Lit windows glow after the lighting model
 * (emissiveNode adds to the lit output), so the bands stay intact under
 * them. The pattern is windows.ts, the same hash and density per window.
 * The coverage masks come back alongside the albedo so the PBR lane can
 * steer roughness/metalness per pixel without re-deriving the pattern.
 */
export function facadeGraphs(THREE: Three, grid: { floor: number; bay: number }, glassy: boolean, tod = LIT_SHARE_TOD): FacadeGraphs {
  const { T, c, detail, vertexRgb } = cityShaderTools(THREE);
  const u = T.uv().x;
  const v = T.uv().y;
  const fy = T.fract(v.div(grid.floor));
  const fx = T.fract(u.div(grid.bay));
  const upper = T.step(3.6, v);
  const [paneLo, paneHi] = glassy ? [0.08, 0.92] : [0.26, 0.74];
  const inX = (lo: number, hi: number) => T.step(lo, fx).mul(T.step(fx, hi));
  const inY = (lo: number, hi: number) => T.step(lo, fy).mul(T.step(fy, hi));
  const pane = inY(0.32, 0.82).mul(inX(paneLo, paneHi)).mul(upper);
  // Relief by shading: a dark frame round each pane, a pale stone lintel over it
  // and a sill under it (masonry); dark mullions and spandrels on glass.
  const surround = inY(0.29, 0.85).mul(inX(paneLo - 0.035, paneHi + 0.035)).mul(upper).sub(pane);
  const lintel = glassy ? T.float(0) : inY(0.86, 0.94).mul(inX(paneLo - 0.06, paneHi + 0.06)).mul(upper);
  const sill = glassy ? T.float(0) : inY(0.25, 0.29).mul(inX(paneLo - 0.04, paneHi + 0.04)).mul(upper);
  const shop = T.step(0.4, v).mul(T.step(v, 3.1));
  // Per-building seed from the wall colour (each wall varies by a hash of its id).
  const seed = T.fract(vertexRgb.x.mul(13.7).add(vertexRgb.y.mul(7.3))).mul(100);
  const column = T.floor(u.div(grid.bay));
  const row = T.floor(v.div(grid.floor));
  const hash = (a: typeof column, b: typeof column) => T.fract(T.sin(a.mul(12.9898).add(b.mul(78.233)).add(seed.mul(37.719))).mul(43758.5453));
  // Roll-down gates on about a fifth of the shop bays: corrugated steel, ribs every 16 cm.
  const gate = shop.mul(T.step(hash(column, T.float(-7)), 0.2));
  const ribs = T.mix(c('gate'), c('gate').mul(0.72), T.step(0.5, T.fract(v.div(0.16))));
  const window = c('window');
  let patterned = T.mix(vertexRgb, vertexRgb.mul(0.55), surround.mul(glassy ? 0.9 : 0.75));
  patterned = T.mix(patterned, c('lintel'), lintel.add(sill).mul(0.7));
  patterned = T.mix(T.mix(patterned, window, pane.mul(glassy ? 0.7 : 0.82)), window, shop.mul(glassy ? 0.5 : 0.65));
  patterned = T.mix(patterned, ribs, gate);
  const average = T.mix(vertexRgb, window, glassy ? 0.35 : 0.18);
  const near = detail(260, 700);
  const density = T.float(0.25).add(T.fract(T.sin(seed.mul(7.31).mul(12.9898).add(3.7 * 78.233).add(1.13 * 37.719)).mul(43758.5453)).mul(0.5));
  // The daypart dims the lit share — windows.ts litShareAt, the same
  // formula the L3 room layer applies: a quarter of dusk density by day,
  // all of it by night. The shop glow stays full — storefront lights are
  // on at noon too — and FacadeWindowGraphs.density stays raw so glass.ts
  // can scale its own tod.
  const share = T.min(T.float(LIT_SHARE_CAP), density.mul(LIT_SHARE_DAY + LIT_SHARE_GAIN * tod));
  const lit = T.step(hash(column, row), share).mul(T.step(1, row));
  const toneHash = hash(column.add(17.1), row.add(3.3));
  const tone = T.mix(T.mix(c('windowWarm'), c('windowAmber'), T.step(0.55, toneHash)), c('windowCool'), T.step(0.85, toneHash));
  // Open shops glow warm behind their glass; gated bays stay dark.
  const shopGlow = c('windowWarm').mul(shop.mul(T.float(1).sub(gate)).mul(glassy ? 0.35 : 0.45));
  const glowNear = tone.mul(pane.mul(lit).mul(glassy ? 0.75 : 0.85)).add(shopGlow);
  // Far off the panes are sub-pixel: glow at the average lit share instead of shimmering.
  const glowFar = tone.mul(share.mul(glassy ? 0.3 : 0.22));
  return {
    albedo: T.mix(average, patterned, near),
    emissive: T.mix(glowFar, glowNear, near),
    panes: pane.mul(near),
    shops: shop.mul(near),
    gates: gate.mul(near),
    window: {
      pane, shop, gate,
      cell: T.vec2(fx, fy),
      column, row, seed, density,
      hash: (dx, dy) => hash(column.add(dx), row.add(dy)),
      u, v,
    },
  };
}

export interface RoadsGraphs {
  /** Albedo: asphalt, gutter, centre line and zebra with their distance fades. */
  albedo: Node<'vec3'> | Node<'color'>;
  /** The royal kerb light line, already distance-faded. */
  emissive: Node<'vec3'> | Node<'color'>;
  /** Lane-paint coverage (centre + zebra) × the marking fade — lane paint is a flatter surface than tar. */
  paint: Node<'float'>;
}

/**
 * Asphalt with a double yellow centre line (vertex r = 1), a zebra crossing
 * (vertex g = 1) and a darker gutter; vertex b carries the width / 100.
 */
export function roadsGraphs(THREE: Three): RoadsGraphs {
  const { T, c, detail, vertexRgb } = cityShaderTools(THREE);
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
  // A royal light line along each kerb (not on crossings), like the edge glow of a NeonBlade panel.
  const kerb = T.float(1).sub(vertexRgb.y).mul(T.step(T.abs(across.sub(width.mul(0.5).sub(0.35))), 0.07));
  return {
    albedo: painted,
    emissive: c('curbGlow').mul(kerb.mul(0.9).mul(detail(60, 260))),
    paint: centre.add(zebra).mul(fade),
  };
}

/**
 * A NeonBlade grid in the sidewalk slabs: thin carolina joints every 1.5 m,
 * drawn from world position so slabs line up across separate ways, gone
 * before the lines would alias. Emissive on both lanes.
 */
export function sidewalkGlow(THREE: Three): Node<'vec3'> | Node<'color'> {
  const { T, c, detail } = cityShaderTools(THREE);
  const p = T.positionWorld.xz.div(1.5);
  const f = T.abs(T.fract(p).sub(0.5));
  const line = T.smoothstep(0.43, 0.48, T.max(f.x, f.y));
  return c('sidewalkGrid').mul(line.mul(0.32).mul(detail(25, 90)));
}

export interface LeafGraphs {
  albedo: Node<'vec3'> | Node<'color'>;
  opacity: Node<'float'>;
}

/**
 * Leaf crown shading, split from the material so the cel and PBR bodies
 * share it: cut-out leaf cards around a dark core, shaded through the
 * crown's outward normals, instance tone for the green, chase-camera
 * cut-away inside a 6 m sphere around the camera.
 */
export function leafGraphs(THREE: Three, map: TextureT): LeafGraphs {
  const T = THREE.TSL;
  const leaf = T.attribute<'float'>('leaf', 'float');
  const tone = T.attribute<'vec3'>(TONE_ATTRIBUTE, 'vec3');
  const card = T.step(0.5, leaf);
  const alpha = T.texture(map, T.uv()).r;
  const rim = T.mix(T.float(0.86), T.float(1), T.smoothstep(0.55, 0.95, alpha));
  const shade = T.mix(T.float(0.74), leaf.mul(rim), card);
  const nearCamera = T.smoothstep(6, 9, T.cameraPosition.distance(T.positionWorld));
  return {
    albedo: tone.mul(T.vec3(shade, shade.mul(1.01), shade.mul(0.97))),
    opacity: T.mix(T.float(1), alpha, card).mul(nearCamera),
  };
}

/**
 * Materials that stay unlit under both lanes: the sky dome, landmark
 * accents, the near-future neon layer, billboards, the contact-shadow ring,
 * lamp heads and pools, and the pixel-font lettering (plus its atlas, which
 * the caller disposes). Extracted so pbr-materials.ts does not re-author
 * them.
 */
export function createUnlitLayers(THREE: Three, sunDirection: readonly [number, number, number]) {
  const { T, c, detail, vertexRgb } = cityShaderTools(THREE);
  const sky = createSkyMaterial(THREE, sunDirection);

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

  // Lamp heads are unlit; light pools under the lamps are additive, radial
  // falloff from the disc uv centre, distance-faded instead of fogged.
  const lampHeads = new THREE.MeshBasicNodeMaterial();
  lampHeads.colorNode = T.vec4(c('lampHead'), 1);
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

  // Pixel-font lettering (pixel-font.ts atlas, built in memory: no canvas on native). Ink is the vertex colour.
  const atlas = new THREE.DataTexture(atlasPixels(), ATLAS_WIDTH, ATLAS_HEIGHT, THREE.RGBAFormat);
  atlas.magFilter = THREE.NearestFilter;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.generateMipmaps = true;
  atlas.needsUpdate = true;
  const lettering = new THREE.MeshBasicNodeMaterial({ alphaTest: 0.5 });
  // A touch under 1 so white ink does not clip under linear output.
  lettering.colorNode = T.vec4(vertexRgb.mul(0.92), 1);
  lettering.opacityNode = T.texture(atlas, T.uv()).a;

  return { sky, accents, neon, billboards, shadows, lampHeads, lampPools, lettering, atlas };
}

/** Every lit and unlit material the city needs, built once per scene and disposed together. */
export interface CityMaterials {
  sky: Mat;
  masonry: Mat;
  glass: Mat;
  roofs: Mat;
  accents: Mat;
  neon: Mat;
  billboards: Mat;
  ground: Mat;
  areas: Mat;
  sidewalks: Mat;
  roads: Mat;
  shadows: Mat;
  trunks: Mat;
  poles: Mat;
  signBlades: Mat;
  lampHeads: Mat;
  lampPools: Mat;
  lettering: Mat;
  cars: Mat;
  /** Crown material over the leaf texture, made per call: foliage.ts owns and disposes it. */
  leaf(map: TextureT): Mat;
  /** Far-crown material, same ownership. */
  farCrown(): Mat;
  dispose(): void;
}

/**
 * The cel lane: every city material on the dsts-viewer cel model.
 * Walls, roofs and trunks keep the rim sheen; flat ground seen at a grazing
 * angle would take it across its whole width, so it goes without.
 */
export interface CityMaterialOptions {
  /**
   * Daypart lit share 0 = day … 1 = night (windows.ts `litShareAt`): the
   * lit-window share of the facade emissive. The world resolves it once at
   * mount from the sky pick (index.ts); default LIT_SHARE_TOD (dusk). The
   * storefront glow stays lit at every tod — shop lights are on at noon.
   */
  timeOfDay?: number;
}

export function createCityMaterials(
  THREE: Three,
  sunDirection: readonly [number, number, number],
  options: CityMaterialOptions = {},
): CityMaterials & { rig: CelRig; albedoGraphs: Map<Mat, CelMaterialOptions['albedo']> } {
  const { T, c, vertexRgb } = cityShaderTools(THREE);
  const rig = createCelRig(THREE, cityCelRig(sunDirection));
  // Each cel material's TSL albedo, kept so node tests can compile the graph
  // (the TypeGPU cel body itself only resolves under the Metro/Vite transform).
  const albedoGraphs = new Map<Mat, CelMaterialOptions['albedo']>();
  const cel = (albedo: CelMaterialOptions['albedo'], rim: number, surface: CelSurface = {}) => {
    const material = createCelMaterial(THREE, { rig, albedo, rim, ...surface });
    albedoGraphs.set(material, albedo);
    return material;
  };
  const unlit = createUnlitLayers(THREE, sunDirection);

  const facade = (grid: { floor: number; bay: number }, glassy: boolean) => {
    const graphs = facadeGraphs(THREE, grid, glassy, options.timeOfDay ?? LIT_SHARE_TOD);
    const material = cel(graphs.albedo, 1);
    setEmissive(material, graphs.emissive);
    return material;
  };
  const masonry = facade(WINDOW_GRID.masonry, false);
  const glass = facade(WINDOW_GRID.glass, true);

  const roofs = cel(vertexRgb, 1);

  const flat = (offset: number) => cel(vertexRgb, 0, {
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -offset, polygonOffsetUnits: -offset * 2,
  });
  const ground = cel(c('ground'), 0, { side: THREE.DoubleSide });
  const areas = flat(1);
  const sidewalks = flat(2);
  setEmissive(sidewalks, sidewalkGlow(THREE));

  const roads = (() => {
    const graphs = roadsGraphs(THREE);
    const material = cel(graphs.albedo, 0, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
    setEmissive(material, graphs.emissive);
    return material;
  })();

  const trunks = cel(c('trunk'), 1);

  // Street furniture (street-furniture.ts, which also owns the lettering
  // material and its atlas). Poles are cel lit; the sign blade takes a little
  // self light, like retroreflective sheeting under headlights.
  const poles = cel(c('pole'), 1);
  const signBlades = cel(c('signGreen'), 1);
  setEmissive(signBlades, c('signGreen').mul(0.35));

  // Parked cars: cel lit; vertices coloured below zero are body paint and take the instance's tone.
  const carTone = T.attribute<'vec3'>(TONE_ATTRIBUTE, 'vec3');
  const cars = cel(T.mix(vertexRgb, carTone, T.step(vertexRgb.x, -0.5)), 1);

  const all: Mat[] = [
    unlit.lettering, cars, unlit.sky, masonry, glass, roofs, unlit.accents, unlit.neon, unlit.billboards,
    ground, areas, sidewalks, roads, unlit.shadows, trunks, poles, signBlades, unlit.lampHeads, unlit.lampPools,
  ];
  return {
    sky: unlit.sky, masonry, glass, roofs, accents: unlit.accents, neon: unlit.neon, billboards: unlit.billboards,
    ground, areas, sidewalks, roads, shadows: unlit.shadows, trunks,
    poles, signBlades, lampHeads: unlit.lampHeads, lampPools: unlit.lampPools, lettering: unlit.lettering, cars,
    leaf: (map) => createLeafMaterial(THREE, rig, map),
    farCrown: () => createFarCrownMaterial(THREE, rig),
    rig, albedoGraphs,
    dispose: () => { for (const material of all) material.dispose(); unlit.atlas.dispose(); },
  };
}

/**
 * Leaf crowns (metro-live createLeafMaterial without wind or autumn): the
 * leafGraphs shading on the cel body, alpha-tested at 0.5. The texture is
 * the alpha of the Quaternius leaf card.
 */
export function createLeafMaterial(THREE: Three, rig: CelRig, map: TextureT) {
  const graphs = leafGraphs(THREE, map);
  const material = createCelMaterial(THREE, { rig, albedo: graphs.albedo, alphaTest: 0.5 });
  material.opacityNode = graphs.opacity;
  return material;
}

/** Far crowns: no cut-outs, the same cel-lit ball in the instance tone. */
export function createFarCrownMaterial(THREE: Three, rig: CelRig) {
  return createCelMaterial(THREE, { rig, albedo: THREE.TSL.attribute<'vec3'>(TONE_ATTRIBUTE, 'vec3') });
}
