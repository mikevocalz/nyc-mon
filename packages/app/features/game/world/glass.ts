// world/glass.ts — lane L3, "glass and rooms". Behind
// EXPO_PUBLIC_WORLD_GLASS (default OFF, the same truthy set as the L1/L2
// flags) the two wall materials become MeshStandardNodeMaterial window
// glass: near-mirror panes with a seeded per-pane tilt, a Schlick Fresnel
// blend of environment reflection against a per-window interior, and the
// interior itself drawn by interior mapping — a van Dongen room box
// intersected per fragment (J. van Dongen, "Interior Mapping", GPU Gems/
// ShaderX technique: cast the view ray into a unit room behind the facade
// plane and shade the surface it lands on). Reimplemented in TSL from the
// technique, not translated from the reference GLSL: the ray, the slab
// intersection and the seed discipline are ours; the room contents (back
// wall, sides, floor, ceiling light panels, furniture silhouettes, a door)
// and the depth falloff follow the paper's structure.
//
// Composition with the lower lanes:
// - The window grid, the building seed and the lit pattern are NOT
//   re-authored here — facadeGraphs (materials.ts) hands them over through
//   FacadeGraphs.window, so rooms land on exactly the panes, shops, cells
//   and lit windows the cel/PBR facades draw. Same cells, same seeds.
// - Flag ON alone ("standalone"): the rest of the city stays on the
//   unflagged cel materials; only the two wall buffers swap to the window
//   material built here.
// - Flags ON together ("combined"): createGlassCityMaterials takes the L2
//   PBR material set and swaps in the same window materials — PBR base
//   (aRoughMetal/aOcclusion attributes, scene lights, scene.environment)
//   plus the window layer. The aRoughMetal/aOcclusion attributes are
//   written unconditionally (geometry.ts), so the standalone build reads
//   them too; only the factory for the rest of the city differs.
// - Env reflection arrives through the standard node path
//   (scene.environment → EnvironmentNode, see pbr-materials.ts): the L1
//   sky rig feeds it when flagged. With no environment the fresnel still
//   dims interiors at grazing angles and the sun still glints.
//
// Tiers (options.tier, default 'full'): 'full' runs the room-box
// intersection per fragment — the phone-tier question is whether every
// wall pixel can afford it, since the graph is branchless. 'flat' keeps a
// seeded flat room tone per window (no ray work) at the same fresnel,
// tilt, roughness and pixel-fade — the cheap path for devices that cannot
// carry the box. Tests compile both.
//
// DEVICE-PENDING, verify on rn-webgpu before unflagging:
// - env reflection pickup: needs scene.environment (L1 flag), itself
//   device-pending on half-float upload + PMREM.
// - T.fwidth in the WGSL fragment backend on react-native-webgpu.
// - shimmer: the pixel-size fade is designed to kill it, but only a device
//   frame can prove the thresholds (GLASS.fade) are right.
// - normalNode tilt on the merged wall buffers and grazing-angle fresnel
//   balance are eyeball items.

import type { Three } from '@acme/ui/three';
import {
  cityShaderTools,
  createCityMaterials,
  facadeGraphs,
  horizontalAxis,
  type CityMaterials,
  type FacadeWindowGraphs,
} from './materials.ts';
import { createPbrCityMaterials } from './pbr-materials.ts';
import { parseSkyRigFlag } from './sky-rig.ts';
import { LIT_SHARE_CAP, LIT_SHARE_DAY, LIT_SHARE_GAIN, litDensity, litShareAt, WINDOW_GRID, windowHash } from './windows.ts';
import { surfaceMid } from './surfaces.ts';
import type { Node } from 'three/webgpu';

type StdMat = InstanceType<Three['MeshStandardNodeMaterial']>;

/** Opt-in L3 flag — default OFF. Same truthy set as the L1/L2 flags. */
export const EXPERIMENTAL_WORLD_GLASS = parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_GLASS);

/**
 * Interior-mapping constants. Seeded shares and ranges have CPU mirrors in
 * the pure helpers below so node tests pin them; the TSL graph uses the
 * same numbers through FacadeWindowGraphs.hash (the windows.ts formula).
 */
export const GLASS = {
  /** Schlick F0 of architectural dielectric glass. */
  f0: 0.04,
  /** How far the fresnel dims the interior — glazing transmits ~(1−F). */
  fresnelStrength: 0.85,
  /** Curtain-wall pane: near-mirror roughness over the curtain metal. */
  curtain: { rough: 0.03, metal: 0.75 },
  /** Ordinary inset pane: seeded roughness range (near mirror). */
  paneRough: [0.04, 0.12] as readonly [number, number],
  /** Per-pane normal tilt, ±radians (~±2.9°) — the wavy-glass look. */
  tiltRad: 0.05,
  /** Room depth behind the facade, metres, seeded per window. */
  roomDepth: [2.4, 4.6] as readonly [number, number],
  /** Storefront display depth — shallower than a room. */
  shopDepth: 1.8,
  /** Venetian blinds: share of windows, drop range (fraction of window). */
  blindsShare: 0.55,
  blindsDrop: [0.25, 0.85] as readonly [number, number],
  blindsSlats: 9,
  /** Sill AC unit: share of windows, width/height as window fractions. */
  acShare: 0.28,
  acSpan: [0.42, 0.62] as readonly [number, number],
  acHeight: 0.38,
  /** Furniture silhouette planes, as room-depth fractions from the glass. */
  furnitureZ: [0.32, 0.68] as readonly [number, number],
  /** Interior dims ~1/(1+k·z) with room depth — the paper's falloff. */
  depthFalloff: 0.55,
  /**
   * Pixel-size fade thresholds, in on-screen cell px: above
   * `detail` the full room shows; through `bands` it blends to the old
   * lit-floor-bands look; below `bands` it is the wall average again —
   * detail dies before it can shimmer.
   */
  fade: {
    detail: [16, 40] as readonly [number, number],
    bands: [5, 16] as readonly [number, number],
  },
  /** Time-of-day default for the lit share (0 = day, 1 = night); the world is authored at dusk. */
  tod: 0.8,
} as const;

/** The interior-detail tier: 'full' maps rooms, 'flat' paints a seeded flat room colour. */
export type GlassTier = 'flat' | 'full';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth01 = (lo: number, hi: number, x: number) => {
  const t = clamp01((x - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
};

/** Schlick approximation: F0 + (1−F0)(1−cosθ)⁵ — the CPU pin for the graph's fresnel. */
export function schlickFresnel(cosTheta: number, f0 = GLASS.f0): number {
  const c = clamp01(cosTheta);
  return f0 + (1 - f0) * (1 - c) ** 5;
}

/**
 * The pixel-size fade's blend weights for an on-screen cell size in px:
 * `detail` ramps the full interior in, `bands` is what is left of window
 * detail at all — zero means the wall average. Mirrors the TSL smoothsteps.
 */
export function glassFadeWeights(px: number): { detail: number; bands: number } {
  return {
    detail: smooth01(GLASS.fade.detail[0], GLASS.fade.detail[1], px),
    bands: smooth01(GLASS.fade.bands[0], GLASS.fade.bands[1], px),
  };
}

/**
 * A building's lit-room share at a time of day: the windows.ts dusk
 * density scaled by `tod` (0 day → a quarter of it, 1 night → all of it,
 * capped under certainty so some rooms always stay dark). GPU mirror uses
 * the same formula on FacadeWindowGraphs.density.
 */
export function litShare(seed: number, tod: number): number {
  return litShareAt(litDensity(seed), tod);
}

/** Whether the room behind (column, row) of this building is lit — windowLit with the tod-scaled share. */
export function roomLit(column: number, row: number, seed: number, tod: number): boolean {
  if (row < 1) return false;
  return windowHash(column, row, seed) < litShare(seed, tod);
}

/** Seeded room depth behind the facade — GLASS.roomDepth range. */
export function roomDepth(column: number, row: number, seed: number): number {
  const [lo, hi] = GLASS.roomDepth;
  return lo + windowHash(column + 0.31, row + 0.77, seed) * (hi - lo);
}

/** Venetian blinds: share gate plus the drop the slats cover. */
export function roomBlinds(column: number, row: number, seed: number): { on: boolean; drop: number } {
  const on = windowHash(column + 4.1, row + 9.3, seed) < GLASS.blindsShare;
  const drop = GLASS.blindsDrop[0] + windowHash(column + 8.3, row + 2.9, seed) * (GLASS.blindsDrop[1] - GLASS.blindsDrop[0]);
  return { on, drop };
}

/** Sill AC unit: share gate plus the span and centre it occupies. */
export function roomAc(column: number, row: number, seed: number): { on: boolean; centre: number; span: number } {
  const on = windowHash(column + 1.9, row + 8.7, seed) < GLASS.acShare;
  const centre = 0.3 + windowHash(column + 6.7, row + 4.9, seed) * 0.4;
  const span = GLASS.acSpan[0] + windowHash(column + 3.1, row + 11.7, seed) * (GLASS.acSpan[1] - GLASS.acSpan[0]);
  return { on, centre, span };
}

/** Ordinary-pane roughness inside GLASS.paneRough, seeded per pane. */
export function paneRoughness(column: number, row: number, seed: number): number {
  const [lo, hi] = GLASS.paneRough;
  return lo + windowHash(column + 2.9, row + 6.1, seed) * (hi - lo);
}

/** Per-pane tilt in radians, ±GLASS.tiltRad. */
export function paneTilt(column: number, row: number, seed: number): [number, number] {
  return [
    (windowHash(column + 11.3, row + 5.9, seed) - 0.5) * 2 * GLASS.tiltRad,
    (windowHash(column + 7.7, row + 13.1, seed) - 0.5) * 2 * GLASS.tiltRad,
  ];
}

interface WindowLayerGraphs {
  /** Window coverage still above the wall-average LOD — every blend uses it. */
  coverage: Node<'float'>;
  /** Window-pixel albedo (dark glass backing under the emissive interior). */
  albedo: Node<'vec3'> | Node<'color'>;
  /** Window-pixel emissive: room radiance at detail LOD, floor bands below. */
  emissive: Node<'vec3'> | Node<'color'>;
  rough: Node<'float'>;
  metal: Node<'float'>;
  /** World-space normal with the seeded per-pane tilt, inside coverage. */
  normal: Node<'vec3'>;
}

/**
 * The window layer over a facade's raw window grid: Schlick fresnel on the
 * tilted pane, pixel-size fade from fwidth, then — tier 'full' — the
 * van Dongen room box, or — tier 'flat' — a seeded flat room tone. All
 * room fields come from win.hash, the windows.ts formula over the same
 * column/row/seed the facade pattern uses.
 */
function windowLayer(
  THREE: Three,
  win: FacadeWindowGraphs,
  opts: { grid: { floor: number; bay: number }; glassy: boolean; tier: GlassTier; tod: number },
): WindowLayerGraphs {
  const { T, c } = cityShaderTools(THREE);
  const { grid, glassy } = opts;
  const [paneLo, paneHi] = glassy ? [0.08, 0.92] : [0.26, 0.74];

  // Open storefronts only behind the display glass; gates stay steel.
  const shop = win.shop.mul(T.float(1).sub(win.gate));
  const coverage = T.max(win.pane, shop) as Node<'float'>;

  // Aperture uv ∈ [0,1]²: the pane rect inside the cell, or the shop band.
  const paneUv = T.vec2(
    win.cell.x.sub(paneLo).div(paneHi - paneLo),
    win.cell.y.sub(0.32).div(0.5),
  );
  const shopUv = T.vec2(win.cell.x, win.v.sub(0.4).div(3.1 - 0.4));
  const winUv = T.vec2(T.mix(paneUv.x, shopUv.x, shop), T.mix(paneUv.y, shopUv.y, shop));

  // Facade frame from the GEOMETRY normal (normalView/normalWorld would
  // recurse through this material's own normalNode). Walls are vertical:
  // x along the wall (u grows along it), y up, z into the building.
  const n = T.normalWorldGeometry;
  const tX = horizontalAxis(T, n);
  const tY = T.cross(n, tX);

  // Seeded per-pane tilt — the ±few-degree wobble real panes have.
  const tilt = T.normalize(
    n.add(tX.mul(win.hash(11.3, 5.9).sub(0.5).mul(2 * GLASS.tiltRad)))
      .add(tY.mul(win.hash(7.7, 13.1).sub(0.5).mul(2 * GLASS.tiltRad))),
  );

  // Schlick fresnel on the tilted normal: F = F0 + (1−F0)(1−n·(−v))⁵.
  const view = T.normalize(T.positionWorld.sub(T.cameraPosition));
  const cosT = T.dot(tilt, view.negate()).clamp(0, 1);
  const fres = T.float(GLASS.f0).add(
    T.float(1 - GLASS.f0).mul(T.pow(T.float(1).sub(cosT), 5)),
  );

  // Pixel-size fade: the cell's on-screen size from the wall uv's
  // derivatives (u/bay and v/floor are continuous, so fwidth is honest).
  const winPx = T.min(
    T.float(1).div(T.fwidth(win.u.div(grid.bay)).max(1e-4)),
    T.float(1).div(T.fwidth(win.v.div(grid.floor)).max(1e-4)),
  );
  const detailW = T.smoothstep(GLASS.fade.detail[0], GLASS.fade.detail[1], winPx);
  const bandsW = T.smoothstep(GLASS.fade.bands[0], GLASS.fade.bands[1], winPx);
  const coverageB = coverage.mul(bandsW);

  // Lit share scaled by time of day; ground floor stays dark, open shops glow.
  const densityEff = T.min(T.float(LIT_SHARE_CAP), win.density.mul(LIT_SHARE_DAY + LIT_SHARE_GAIN * opts.tod));
  const litPane = T.step(win.hash(0, 0), densityEff).mul(T.step(1, win.row));
  const lit = T.mix(litPane, T.float(1), shop);

  // Interior tone: the facade's own warm/amber/cool pick (same thresholds),
  // warm for shops.
  const toneHash = win.hash(17.1, 3.3);
  const tone = T.mix(
    T.mix(c('windowWarm'), c('windowAmber'), T.step(0.55, toneHash)),
    c('windowCool'),
    T.step(0.85, toneHash),
  );
  const toneShop = T.mix(tone, c('windowWarm'), shop);

  // --- Band LOD: the old lit-floor-bands look the fade falls back to. ----
  const bandEmit = T.mix(
    tone.mul(win.pane.mul(litPane).mul(glassy ? 0.75 : 0.85)),
    c('windowWarm').mul(0.45),
    shop,
  );

  // The interior's own backing under its emissive — dark glass either way.
  const albedo = c('window');

  let roomEmit: Node<'vec3'> | Node<'color'>;
  if (opts.tier === 'flat') {
    // Phone tier: a seeded flat room tone, no ray work. Same fresnel so the
    // glass still dims at grazing angles; the fade still applies above.
    const flat = T.mix(c('roomDark'), toneShop.mul(0.95), lit);
    roomEmit = flat.mul(T.float(1).sub(fres.mul(GLASS.fresnelStrength)));
  } else {
    // --- Room box, van Dongen style --------------------------------------
    // Room dims: seeded depth for panes, a shallow display for shops.
    const Rw = T.mix(T.float((paneHi - paneLo) * grid.bay), T.float(grid.bay), shop);
    const Rh = T.mix(T.float(0.5 * grid.floor), T.float(3.1 - 0.4), shop);
    const Rd = T.mix(
      T.mix(GLASS.roomDepth[0], GLASS.roomDepth[1], win.hash(0.31, 0.77)),
      T.float(GLASS.shopDepth),
      shop,
    );
    const entry = T.vec3(winUv.x.mul(Rw), winUv.y.mul(Rh), 0);
    const dRoom = T.vec3(
      T.dot(view, tX),
      T.dot(view, tY),
      T.dot(view, n).negate().max(0.02),
    );

    // Slab distances to the box [0,Rw]×[0,Rh]×[0,Rd]; first surface wins.
    const BIG = T.float(1e5);
    const EPS = T.float(1e-4);
    const slab = (dir: Node<'float'>, hi: Node<'float'>, lo: Node<'float'>) =>
      T.select(
        dir.greaterThan(EPS),
        hi.div(dir),
        T.select(dir.lessThan(EPS.negate()), lo.div(dir.negate()), BIG),
      );
    const tSide = slab(dRoom.x, Rw.sub(entry.x), entry.x);
    const tVert = slab(dRoom.y, Rh.sub(entry.y), entry.y);
    const tBack = Rd.div(dRoom.z);
    const tHit = T.min(tSide, T.min(tVert, tBack));
    const hit = entry.add(dRoom.mul(tHit));

    const wBack = T.smoothstep(tBack.sub(1e-3), tBack, tHit);
    const wVert = T.smoothstep(tVert.sub(1e-3), tVert, tHit);
    const isFloor = T.step(hit.y, Rh.mul(0.5));

    // Surfaces: back wall, dimmer sides, wood floor, panelled ceiling.
    let base = T.mix(c('roomWallSide'), c('roomWall'), wBack);
    base = T.mix(base, T.mix(c('roomCeiling'), c('roomFloor'), isFloor), wVert);

    // A door in the back wall, seeded across it (0.9 m wide, 2.05 m tall).
    const doorCx = win.hash(5.3, 1.7).mul(Rw.sub(1.4)).add(0.7);
    const door = wBack
      .mul(T.step(T.abs(hit.x.sub(doorCx)), 0.45))
      .mul(T.step(hit.y, T.float(2.05)));
    base = T.mix(base, c('roomDoor'), door);

    // Two furniture silhouettes on interior planes (nearer wins): desks and
    // shelves as SDF boxes against the lit room, seeded size and place.
    for (const [zi, sx, sy] of [[0, 9.7, 3.1], [1, 14.3, 7.9]] as const) {
      const zf = Rd.mul(GLASS.furnitureZ[zi]);
      const tf = zf.div(dRoom.z);
      const front = T.step(tf, tHit);
      const p = entry.add(dRoom.mul(tf));
      const cx = win.hash(sx, sy).mul(Rw.mul(0.6)).add(Rw.mul(0.2));
      const fw = Rw.mul(T.mix(0.3, 0.55, win.hash(sy, sx)));
      const fh = Rh.mul(T.mix(0.35, 0.6, win.hash(sx + 1.3, sy + 2.1)));
      const inside = front
        .mul(T.step(T.abs(p.x.sub(cx)), fw.mul(0.5)))
        .mul(T.step(p.y, fh));
      base = T.mix(base, c('roomFurniture'), inside);
    }

    // Ceiling light panels: an emissive grid on the ceiling hit, lit rooms only.
    const ceilW = wVert.mul(T.float(1).sub(isFloor));
    const panel = ceilW
      .mul(T.step(T.abs(T.fract(hit.x.mul(2).div(Rw)).sub(0.5)), 0.22))
      .mul(T.step(T.abs(T.fract(hit.z.mul(3).div(Rd)).sub(0.5)), 0.3));

    // Light falls off with room depth; lit rooms take the window's tone,
    // unlit ones keep a cool dusk spill.
    const falloff = T.float(1).div(T.float(1).add(hit.z.mul(GLASS.depthFalloff)));
    const litWall = base.mul(T.mix(T.vec3(1, 1, 1), toneShop, 0.4)).mul(1.05);
    const darkWall = base.mul(c('roomDark')).mul(0.5);
    let room = T.mix(darkWall, litWall, lit).mul(falloff);
    room = room.add(c('roomPanel').mul(panel.mul(lit).mul(1.6)));

    // Venetian blinds over the top of the window — thin slat gaps let a
    // little room through; AC units occlude their sill span outright.
    const blindsOn = T.step(win.hash(4.1, 9.3), GLASS.blindsShare).mul(T.float(1).sub(shop));
    const drop = T.mix(GLASS.blindsDrop[0], GLASS.blindsDrop[1], win.hash(8.3, 2.9));
    const blindCov = T.step(T.float(1).sub(drop), winUv.y);
    const blindGap = T.smoothstep(0.8, 0.95, T.fract(winUv.y.mul(GLASS.blindsSlats)));
    const blindW = blindsOn.mul(blindCov).mul(T.mix(T.float(1), T.float(0.25), blindGap));
    room = T.mix(room, c('blind').mul(T.mix(0.35, 0.85, lit)), blindW);
    const acOn = T.step(win.hash(1.9, 8.7), GLASS.acShare).mul(T.float(1).sub(shop));
    const acCx = T.mix(0.3, 0.7, win.hash(6.7, 4.9));
    const acSpan = T.mix(GLASS.acSpan[0], GLASS.acSpan[1], win.hash(3.1, 11.7));
    const ac = acOn
      .mul(T.step(T.abs(winUv.x.sub(acCx)), acSpan.mul(0.5)))
      .mul(T.step(winUv.y, T.float(GLASS.acHeight)));
    room = T.mix(room, c('acUnit'), ac);

    // Schlick blend: env reflection takes over at grazing angles (the PBR
    // specular adds it), so the transmitted interior dims by (1−F).
    roomEmit = room.mul(T.float(1).sub(fres.mul(GLASS.fresnelStrength)));
  }

  // Seeded pane roughness: near-mirror on curtain walls, ordinary glass on
  // masonry; curtain metal per the spec, dielectric panes otherwise.
  const rough = glassy
    ? T.float(GLASS.curtain.rough)
    : T.mix(GLASS.paneRough[0], GLASS.paneRough[1], win.hash(2.9, 6.1));

  return {
    coverage: coverageB as Node<'float'>,
    albedo,
    emissive: T.mix(bandEmit, roomEmit, detailW),
    rough: rough as Node<'float'>,
    metal: T.float(glassy ? GLASS.curtain.metal : 0),
    normal: tilt as Node<'vec3'>,
  };
}

export interface WindowMaterialOptions {
  /** The window grid the material draws — WINDOW_GRID.masonry or .glass. */
  grid: { floor: number; bay: number };
  /** Curtain-wall glazing (glass towers) vs inset masonry panes. */
  glassy: boolean;
  /** 'full' maps room boxes, 'flat' paints seeded flat rooms. Default 'full'. */
  tier?: GlassTier;
  /** Time of day 0..1 for the lit share. Default GLASS.tod (dusk). */
  tod?: number;
}

/**
 * A wall material with the L3 window layer: the shared facade graphs on a
 * standard node body, panes and open storefronts replaced by the interior
 * layer (fresnel, tilt, rooms or flat tones, pixel fade). Roughness,
 * metalness and AO keep the L2 contract — aRoughMetal/aOcclusion vertex
 * attributes, gates stay painted steel — so the same material works for
 * the standalone and the combined flag states.
 */
export function createWindowMaterial(THREE: Three, options: WindowMaterialOptions): StdMat {
  const { T } = cityShaderTools(THREE);
  const graphs = facadeGraphs(THREE, options.grid, options.glassy);
  const layer = windowLayer(THREE, graphs.window, {
    grid: options.grid,
    glassy: options.glassy,
    tier: options.tier ?? 'full',
    tod: options.tod ?? GLASS.tod,
  });

  const vertexRm = T.attribute<'vec2'>('aRoughMetal', 'vec2');
  const attrRough = vertexRm.x as Node<'float'>;
  const attrMetal = vertexRm.y as Node<'float'>;
  const PAINTED = surfaceMid('paintedMetal');

  const material = new THREE.MeshStandardNodeMaterial();
  material.colorNode = T.vec4(T.mix(graphs.albedo, layer.albedo, layer.coverage), 1);
  material.emissiveNode = T.mix(graphs.emissive, layer.emissive, layer.coverage);
  material.roughnessNode = T.mix(T.mix(attrRough, layer.rough, layer.coverage), PAINTED[0], graphs.gates);
  material.metalnessNode = T.mix(T.mix(attrMetal, layer.metal, layer.coverage), PAINTED[1], graphs.gates);
  material.aoNode = T.attribute<'float'>('aOcclusion', 'float');
  // The geometry normal keeps the wall shading; panes get the seeded tilt.
  material.normalNode = T.transformNormalToView(
    T.normalize(T.mix(T.normalWorldGeometry, layer.normal, layer.coverage)),
  );
  return material;
}

export interface GlassCityOptions {
  /** Sun direction for the unlit layers the factory passes through. */
  sunDirection: readonly [number, number, number];
  /** Compose over the L2 PBR set (EXPO_PUBLIC_WORLD_PBR). Default off. */
  pbr?: boolean;
  /** Interior tier for both wall materials. Default 'full'. */
  tier?: GlassTier;
  /** Time of day 0..1 for the lit share. Default GLASS.tod (dusk). */
  timeOfDay?: number;
}

/**
 * The L3 material set: the lower lane's materials (L2 PBR when `pbr`, the
 * unflagged cel set otherwise) with the two wall buffers swapped onto the
 * window material. The base factory's own wall materials are built but
 * never rendered — dispose() covers them through the base's dispose list.
 */
export function createGlassCityMaterials(THREE: Three, options: GlassCityOptions): CityMaterials {
  const base = options.pbr
    ? createPbrCityMaterials(THREE, { sunDirection: options.sunDirection })
    : createCityMaterials(THREE, options.sunDirection);
  const tier = options.tier ?? 'full';
  const tod = options.timeOfDay ?? GLASS.tod;
  const masonry = createWindowMaterial(THREE, { grid: WINDOW_GRID.masonry, glassy: false, tier, tod });
  const glass = createWindowMaterial(THREE, { grid: WINDOW_GRID.glass, glassy: true, tier, tod });
  const disposeBase = base.dispose.bind(base);
  return {
    ...base,
    masonry,
    glass,
    dispose: () => {
      disposeBase();
      masonry.dispose();
      glass.dispose();
    },
  };
}
