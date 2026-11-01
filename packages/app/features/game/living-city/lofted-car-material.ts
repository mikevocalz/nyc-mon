// Adapted from mrdoob/slop-newyork @ be65d0a, js/actor-models.js createLoftedCarMaterial, createLoftedBusMaterial,
// carPlateTexture, and the roundedRect / smax / polygonDistance helpers (MIT, © 2026 Mr.doob). Slop credits the
// anti-aliased rounded-rectangle SDF to three.js examples/jsm/generators/city/CarGenerator.js (MIT, three.js
// authors).
//
// One MeshStandardNodeMaterial paints a whole lofted body: glass, seals, pillars, lamps, grilles, plates, door seams,
// the taxi livery and roof light, alloys and tyres, all from object-space position, normal and the `partId`
// attribute (lofted-car.ts), so each body is one instanced draw. Per instance it reads:
//
//   paintColor  vec3  body paint, linear RGB (LOFTED_INSTANCE_ATTRIBUTES)
//   carState    vec4  x brake 0/1, y left (+x) indicator lit, z right (-x) indicator lit, w livery (unused here)
//
// The vehicle actor writes both from the packed vehicle snapshot (VSNAP flags), so a brake or a blink is a
// four-float write, never a rebuild. Night-dependent emissives ramp on `glow`, the stand-in for Slop's
// `cityUniforms.uInteriorGlow` (vehicle-physical-constants.ts `slopGlowFromLampLevel`).
//
// Every colour is an @acme/theme `physicalVehicles` token. Tokens are sRGB hex and go through Color.setStyle, which
// converts to linear the way Slop's `color(0x…)` does.
//
// Differences from Slop:
// - The NYPD livery (carState.w = 1) is not painted: nyc-mon has no police kind. The w lane stays in the attribute so
//   the layout matches Slop's.
// - The rear plate atlas is built from world/pixel-font.ts glyphs into a DataTexture (no canvas, no DOM). A caller
//   can pass its own texture instead (`plateTexture`), for example one Skia draws on the shared GPU device.
// - The bus reads `carState` rather than Slop's separate `busState` (same vec4 layout, x/y/z).
// - The fixed-colour player variant (`fixedColorHex`, reverse lights on carState.w) is not ported.

import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { physicalVehicles } from '@acme/theme';
import { ATLAS_HEIGHT, ATLAS_WIDTH, GLYPH_HEIGHT, GLYPH_WIDTH, atlasPixels, glyphUv, layoutText } from '../world/pixel-font.ts';
import { BUS_PARTS, BUS_SPEC, CAR_PARTS, carLayout, taxiSignPlacement, type CarBodySpec, type LoftedVehicleKind } from './lofted-car.ts';
import { BUS_LAMP_LEVEL, CAR_LAMP_LEVEL, NIGHT_HEADLAMP_GLOW } from './vehicle-physical-constants.ts';

type F = Node<'float'>;
type V2n = Node<'vec2'>;
type C3 = Node<'vec3'> | Node<'color'>;
type StdMat = InstanceType<Three['MeshStandardNodeMaterial']>;

/** Per-instance attribute widths the lofted materials read. */
export const LOFTED_INSTANCE_ATTRIBUTES = { paintColor: 3, carState: 4 } as const;

// --- Paint ----------------------------------------------------------------------------------------------------------

/** The paint pool a sim kind draws from (Slop `PALETTES`; the van takes the SUV pool because it wears the SUV body). */
export function paintPoolForKind(kind: LoftedVehicleKind): readonly string[] {
  switch (kind) {
    case 'taxi':
      return physicalVehicles.paint.taxi;
    case 'van':
      return physicalVehicles.paint.suv;
    case 'sedan':
    case 'bus':
      return physicalVehicles.paint.sedan;
  }
}

/** Deterministic paint token per vehicle id, so a car keeps its colour across frames and runtimes. */
export function vehiclePaintToken(kind: LoftedVehicleKind, id: number): string {
  const pool = paintPoolForKind(kind);
  return pool[Math.abs((id * 2654435761) % 997) % pool.length]!;
}

/** carState for one vehicle: brake, left (+x) lit, right (-x) lit, livery. `blinkOn` is the indicator parity. */
export function carStateFromFlags(
  flags: number,
  blinkOn: boolean,
  bits: { readonly braking: number; readonly blinkLeft: number; readonly blinkRight: number },
): [number, number, number, number] {
  return [
    (flags & bits.braking) !== 0 ? 1 : 0,
    blinkOn && (flags & bits.blinkLeft) !== 0 ? 1 : 0,
    blinkOn && (flags & bits.blinkRight) !== 0 ? 1 : 0,
    0,
  ];
}

// --- Plate atlas (replaces Slop's canvas-drawn carPlateTexture) -----------------------------------------------------

/** Slop's four plate strings, one per atlas band; the material picks a band from the paint. */
export const PLATE_LABELS = ['4KM 728', '7TR 319', '2BJ 506', '6XL 842'] as const;
/** Atlas band size in texels: wide enough for a seven-character plate, with the plate's 0.31 x 0.12 m aspect. */
export const PLATE_BAND_WIDTH = 48;
export const PLATE_BAND_HEIGHT = 19;

function hexBytes(hex: string): [number, number, number] {
  const v = Number.parseInt(hex.slice(1, 7), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/**
 * RGBA bytes for the plate atlas: four bands stacked along v, each a yellow field with one label in dark pixel-font
 * capitals. Data row 0 is v = 0 (no flipY), and each label's top glyph row sits at its band's highest v, so text
 * reads upright where the material's plate v grows upward.
 */
export function plateAtlasPixels(): { data: Uint8Array; width: number; height: number } {
  const width = PLATE_BAND_WIDTH;
  const height = PLATE_BAND_HEIGHT * PLATE_LABELS.length;
  const data = new Uint8Array(width * height * 4);
  const field = hexBytes(physicalVehicles.plate.field);
  const ink = hexBytes(physicalVehicles.plate.ink);
  for (let i = 0; i < width * height; i++) data.set([field[0], field[1], field[2], 255], i * 4);
  const glyphs = atlasPixels();
  PLATE_LABELS.forEach((label, band) => {
    const { glyphs: placed, width: textWidth } = layoutText(label);
    const x0 = Math.floor((width - textWidth) / 2);
    const top = band * PLATE_BAND_HEIGHT + Math.floor((PLATE_BAND_HEIGHT + GLYPH_HEIGHT) / 2) - 1;
    for (const g of placed) {
      const { u0, v0 } = glyphUv(g.index);
      const ax = Math.round(u0 * ATLAS_WIDTH);
      const ay = Math.round(v0 * ATLAS_HEIGHT);
      for (let row = 0; row < GLYPH_HEIGHT; row++) {
        for (let col = 0; col < GLYPH_WIDTH; col++) {
          if (glyphs[((ay + row) * ATLAS_WIDTH + ax + col) * 4 + 3] === 0) continue;
          const o = ((top - row) * width + x0 + g.x + col) * 4;
          data.set([ink[0], ink[1], ink[2], 255], o);
        }
      }
    }
  });
  return { data, width, height };
}

/** The plate atlas as an sRGB DataTexture, linear filtered. */
export function createPlateAtlasTexture(THREE: Three): InstanceType<Three['DataTexture']> {
  const { data, width, height } = plateAtlasPixels();
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

// --- SDF helpers ----------------------------------------------------------------------------------------------------

/** Outward half-planes [nx, ny, c] of a counter-clockwise polygon, each edge moved in by its margin (Slop `polygonPlanes`). */
export function polygonPlanes(points: readonly (readonly [number, number])[], margins: readonly number[]): [number, number, number][] {
  const planes: [number, number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i]!;
    const [bx, by] = points[(i + 1) % points.length]!;
    const len = Math.hypot(bx - ax, by - ay);
    const nx = (by - ay) / len;
    const ny = -(bx - ax) / len;
    planes.push([nx, ny, ax * nx + ay * ny - margins[i]!]);
  }
  return planes;
}

function sdfTools(THREE: Three) {
  const T = THREE.TSL;
  const col = (hex: string) => T.color(new THREE.Color().setStyle(hex));
  /** Filter-width anti-aliased rounded rectangle coverage (Slop `roundedRect`). */
  const roundedRect = (point: V2n, halfSize: V2n, radius: number): F => {
    const q = T.abs(point).sub(halfSize).add(radius);
    const dist = T.length(T.max(q, T.vec2(0.0))).add(T.min(T.max(q.x, q.y), 0.0)).sub(radius);
    const edge = T.max(T.fwidth(dist), 0.001);
    return T.smoothstep(edge, edge.negate(), dist) as F;
  };
  /** IQ polynomial smooth maximum (Slop `smax`). */
  const smax = (a: F, b: F, k: number): F => {
    const h = T.max(T.float(k).sub(T.abs(a.sub(b))), 0.0).div(k);
    return T.max(a, b).add(h.mul(h).mul(k * 0.25)) as F;
  };
  /** Signed distance to a convex polygon given as half-planes (Slop `polygonDistance`). */
  const polygonDistance = (px: F, py: F, planes: readonly [number, number, number][], k: number): F => {
    let d: F | null = null;
    for (const [nx, ny, c] of planes) {
      const e = px.mul(nx).add(py.mul(ny)).sub(c) as F;
      d = d === null ? e : smax(d, e, k);
    }
    return d!;
  };
  /** Anti-aliased inside test of a signed distance (Slop `coverage`). */
  const coverage = (d: F): F => {
    const w = T.max(T.fwidth(d), 0.0008);
    return T.smoothstep(w, w.negate(), d) as F;
  };
  return { T, col, roundedRect, smax, polygonDistance, coverage };
}

// --- Car --------------------------------------------------------------------------------------------------------------

export interface LoftedMaterialOptions {
  /** Night ramp, Slop's uInteriorGlow scale (0.24 midday … 1.55 night). Usually a `uniform` the actor updates. */
  readonly glow: F;
  /** Rear plate atlas: four bands along v (plateAtlasPixels layout). Defaults to the pixel-font atlas. */
  readonly plateTexture?: InstanceType<Three['Texture']>;
}

/** The lofted car material for one body spec (Slop `createLoftedCarMaterial`, instanced path). */
export function createLoftedCarMaterial(
  THREE: Three,
  spec: CarBodySpec,
  options: LoftedMaterialOptions,
): { material: StdMat; plateTexture: InstanceType<Three['Texture']>; ownsPlateTexture: boolean } {
  const { T, col, roundedRect, polygonDistance, coverage } = sdfTools(THREE);
  const C = physicalVehicles.car;
  const L = carLayout(spec);
  const cab = spec.cabin;
  const state = T.attribute<'vec4'>('carState', 'vec4');
  const paint = T.attribute<'vec3'>('paintColor', 'vec3');
  const ownsPlateTexture = options.plateTexture === undefined;
  const plateTexture = options.plateTexture ?? createPlateAtlasTexture(THREE);

  const axleZ = spec.wheelZ;
  const wheelR = T.float(spec.wheelRadius);
  const archR = L.archR;

  // Glass outlines from the glasshouse layout: side windows in side view (z, y), windshield and backlight from above
  // (|x|, z). Each edge is pulled in by its pillar / frame width; the seal outline sits a little further out.
  const bc = L.belt.cowl;
  const bd = L.belt.deck;
  const rf = L.rail.front;
  const rm = L.rail.mid;
  const rr = L.rail.rear;
  const sidePoly: [number, number][] = [[cab.cowl, bc.y], [cab.roofFront, rf.y], [L.rail.roofMid, rm.y], [cab.roofRear, rr.y], [cab.deck, bd.y]];
  const sideGlassPlanes = polygonPlanes(sidePoly, [0.05, 0.03, 0.03, 0.065, 0.02]);
  const sideSealPlanes = polygonPlanes(sidePoly, [0.034, 0.016, 0.016, 0.05, 0.004]);
  const frontPoly: [number, number][] = [[-1, cab.cowl], [-1, cab.roofFront], [rf.x, cab.roofFront], [bc.x, cab.cowl]];
  const frontGlassPlanes = polygonPlanes(frontPoly, [0, 0.045, 0.06, 0.05]);
  const frontSealPlanes = polygonPlanes(frontPoly, [0, 0.03, 0.045, 0.035]);
  const rearPoly: [number, number][] = [[-1, cab.roofRear], [-1, cab.deck], [bd.x, cab.deck], [rr.x, cab.roofRear]];
  const rearGlassPlanes = polygonPlanes(rearPoly, [0, 0.045, 0.065, 0.05]);
  const rearSealPlanes = polygonPlanes(rearPoly, [0, 0.03, 0.05, 0.035]);
  const [hlX, hlY, hlW, hlH] = spec.headlight;
  const [tlX, tlY, tlW, tlH] = spec.taillight;
  const [grY, grW, grH] = spec.grille;
  const [inY, inW, inH] = spec.intake;
  const [plateF, plateR] = spec.plates;
  const frontZone = spec.zFront - 0.55;
  const rearZone = spec.zRear + 0.55;
  const sillY = spec.sill[1]![1];
  const rearSill = spec.tail.sill![1];
  const signY = taxiSignPlacement(L).y + 0.105;
  const one = T.float(1.0);

  const p = T.attribute<'vec3'>('position', 'vec3');
  const n = T.attribute<'vec3'>('normal', 'vec3');
  const px = p.x as F;
  const py = p.y as F;
  const pz = p.z as F;
  const nx = n.x as F;
  const ny = n.y as F;
  const nz = n.z as F;
  const partId = T.attribute<'float'>('partId', 'float');
  const isPart = (id: number) => T.step(T.abs(partId.sub(id)), 0.25) as F;
  const isBody = isPart(CAR_PARTS.BODY);
  const isWindow = isPart(CAR_PARTS.WINDOW);
  const isTyre = isPart(CAR_PARTS.TYRE);
  const isAlloy = isPart(CAR_PARTS.ALLOY);
  const isTrim = isPart(CAR_PARTS.TRIM);
  const isMirror = isPart(CAR_PARTS.MIRROR);
  const isSign = isPart(CAR_PARTS.SIGN);
  const ax = T.abs(px) as F;
  const isSide = T.smoothstep(0.45, 0.7, T.abs(nx)) as F;
  const front = T.smoothstep(0.12, 0.38, nz).mul(T.step(frontZone, pz)).mul(isBody) as F;
  const rear = T.smoothstep(0.12, 0.38, nz.negate()).mul(T.step(pz, rearZone)).mul(isBody) as F;
  const under = T.smoothstep(-0.25, -0.55, ny).mul(isBody) as F;
  const belt = T.mix(T.float(bd.y), T.float(bc.y), T.clamp(pz.sub(cab.deck).div(cab.cowl - cab.deck), 0.0, 1.0)) as F;

  // Glasshouse: side windows (minus the B / C pillars), windshield and backlight, their black seals, the chrome sill.
  let sideG = polygonDistance(pz, py, sideGlassPlanes, 0.07);
  for (const zp of cab.pillars) sideG = T.max(sideG, T.float(0.036).sub(T.abs(pz.sub(zp)))) as F;
  const rearGlass = coverage(polygonDistance(ax, pz, rearGlassPlanes, 0.09));
  const backlight = rearGlass.mul(isWindow) as F;
  const glass = T.max(T.max(coverage(sideG), coverage(polygonDistance(ax, pz, frontGlassPlanes, 0.09))), rearGlass).mul(isWindow) as F;
  const seal = T.max(
    coverage(polygonDistance(pz, py, sideSealPlanes, 0.07)),
    T.max(coverage(polygonDistance(ax, pz, frontSealPlanes, 0.09)), coverage(polygonDistance(ax, pz, rearSealPlanes, 0.09))),
  ).mul(isWindow) as F;
  const chromeBelt: F = spec.chrome
    ? (T.smoothstep(0.003, 0.006, py.sub(belt))
        .mul(T.smoothstep(0.016, 0.012, py.sub(belt)))
        .mul(T.smoothstep(0.5, 0.7, T.abs(nx)))
        .mul(T.step(cab.deck + 0.05, pz))
        .mul(T.step(pz, cab.cowl - 0.08))
        .mul(isWindow) as F)
    : T.float(0.0);
  const chmsl = roundedRect(T.vec2(px, pz.sub(cab.roofRear - 0.075)), T.vec2(0.14, 0.012), 0.005).mul(backlight).mul(T.step(nz, -0.1)) as F;
  const rearWiper: F = spec.rearWiper
    ? (roundedRect(T.vec2(px.add(0.15), pz.sub(cab.deck + 0.075)), T.vec2(0.22, 0.006), 0.003).mul(backlight) as F)
    : T.float(0.0);

  // Wheel arches: distance from the nearest axle in side view.
  const wheelVec = T.vec2(T.abs(pz).sub(axleZ), py.sub(wheelR));
  const wheelDist = T.length(wheelVec) as F;

  // Lamps, grilles and plates on the nose and tail, projected along z so the lamps wrap round the corners.
  const hlUV = T.vec2(ax.sub(hlX), py.sub(hlY));
  const headlight = roundedRect(hlUV, T.vec2(hlW, hlH), 0.01).mul(T.smoothstep(0.02, 0.25, nz)).mul(T.step(frontZone, pz)).mul(isBody) as F;
  const turnFront = T.smoothstep(hlX + hlW * 0.65, hlX + hlW * 0.72, ax).mul(headlight) as F;
  const divider = T.smoothstep(T.max(T.fwidth(ax), 0.007), 0.002, T.abs(hlUV.x.add(hlW * 0.1))) as F;
  const headlightLens = roundedRect(hlUV, T.vec2(hlW - 0.012, hlH - 0.012), 0.006).mul(headlight).mul(one.sub(T.max(divider, turnFront))) as F;
  const drlDist = T.abs(hlUV.y.add(hlH * 0.6)) as F;
  const drlEdge = T.max(T.fwidth(drlDist), 0.006);
  const drl = T.smoothstep(drlEdge, 0.0, drlDist).mul(headlight).mul(one.sub(turnFront)) as F;
  const grille = roundedRect(T.vec2(px, py.sub(grY)), T.vec2(grW, grH), 0.015).mul(front) as F;
  const intake = roundedRect(T.vec2(px, py.sub(inY)), T.vec2(inW, inH), 0.04).mul(front) as F;
  const plateFront = roundedRect(T.vec2(px, py.sub(plateF)), T.vec2(0.155, 0.055), 0.008).mul(front) as F;
  const tlUV = T.vec2(ax.sub(tlX), py.sub(tlY));
  const taillight = roundedRect(tlUV, T.vec2(tlW, tlH), 0.022).mul(T.smoothstep(0.02, 0.25, nz.negate())).mul(T.step(pz, rearZone)).mul(isBody) as F;
  // Sedans use horizontal lenses; taller SUV lamps stack their three sections vertically.
  const tailAxis = (tlH > tlW ? tlUV.y.div(tlH) : tlUV.x.div(tlW)) as F;
  const tailDivider = coverage(T.min(T.abs(tailAxis.sub(0.52)), T.abs(tailAxis.add(0.55))).sub(0.025) as F);
  const tailLens = roundedRect(tlUV, T.vec2(tlW - 0.006, tlH - 0.006), 0.017).mul(taillight).mul(one.sub(tailDivider)) as F;
  const turnRearSection = T.smoothstep(0.5, 0.54, tailAxis) as F;
  const reverseRearSection = T.smoothstep(-0.53, -0.57, tailAxis) as F;
  const turnRear = turnRearSection.mul(tailLens) as F;
  const redLens = tailLens.mul(one.sub(T.max(turnRearSection, reverseRearSection))) as F;
  const plateRear = roundedRect(T.vec2(px, py.sub(plateR)), T.vec2(0.155, 0.06), 0.008).mul(rear) as F;
  const platePocket = roundedRect(T.vec2(px, py.sub(plateR + 0.01)), T.vec2(0.235, 0.105), 0.03).mul(rear) as F;
  const trunkHandle = roundedRect(T.vec2(px, py.sub(plateR + 0.125)), T.vec2(0.18, 0.012), 0.008).mul(rear) as F;
  const plateRecess = T.max(
    roundedRect(T.vec2(px, py.sub(plateF)), T.vec2(0.175, 0.072), 0.012).mul(front),
    roundedRect(T.vec2(px, py.sub(plateR)), T.vec2(0.185, 0.082), 0.02).mul(rear),
  ) as F;
  const rearValance = T.smoothstep(rearSill + 0.07, rearSill + 0.015, py).mul(rear) as F;
  const reflector = roundedRect(T.vec2(ax.sub(0.64), py.sub(spec.bumpers[1][0] + 0.065)), T.vec2(0.065, 0.012), 0.006).mul(rear) as F;
  const trunkWidth = T.mix(T.float(tlX - tlW - 0.025), T.float(tlX), T.smoothstep(tlY - tlH, spec.tail.edge![1], py)) as F;
  const trunkEdge = T.max(ax.sub(trunkWidth), T.float(spec.bumperLine[1]).sub(py)) as F;
  const panelSeam = T.max(
    T.smoothstep(0.006, 0.0025, T.abs(py.sub(spec.bumperLine[0]))).mul(T.step(ax, hlX - hlW * 0.6)).mul(front),
    coverage(T.abs(trunkEdge).sub(0.003) as F).mul(rear),
  ) as F;
  const cowlPanel = T.smoothstep(cab.cowl + 0.085, cab.cowl + 0.07, pz)
    .mul(T.smoothstep(cab.cowl - 0.04, cab.cowl - 0.02, pz))
    .mul(T.step(0.6, ny))
    .mul(isBody) as F;
  const signFace = T.smoothstep(0.55, 0.75, T.abs(nz)).mul(isSign) as F;
  const signGlyph = T.step(0.42, T.sin(px.mul(90.0))).mul(T.step(ax, 0.17)).mul(T.smoothstep(0.045, 0.04, T.abs(py.sub(signY)))) as F;
  const mirrorGlass = isMirror.mul(T.step(0.55, nz.negate())) as F;
  const lamp = T.max(headlight, taillight) as F;
  const plates = T.max(plateFront, plateRear) as F;
  const cladding: F =
    spec.cladding > 0
      ? (T.max(T.smoothstep(spec.cladding + 0.01, spec.cladding - 0.01, py), T.smoothstep(archR + 0.075, archR + 0.06, wheelDist))
          .mul(isBody)
          .mul(one.sub(lamp))
          .mul(one.sub(plates)) as F)
      : T.float(0.0);

  // 5-spoke alloys (branchless star SDF) with rim ring and hub, lug ribs on the tyre tread.
  const wDir = wheelVec.div(T.max(wheelDist, 0.0001));
  let spokes: F = T.float(0.0);
  for (let k = 0; k < 5; k++) {
    const ang = (k * Math.PI * 2) / 5;
    const cs = Math.cos(ang);
    const sn = Math.sin(ang);
    const alongSpoke = wDir.x.mul(cs).add(wDir.y.mul(sn));
    const perp = T.abs(wDir.x.mul(sn).sub(wDir.y.mul(cs))).mul(wheelDist);
    spokes = T.max(spokes, T.smoothstep(0.034, 0.018, perp).mul(T.step(0.0, alongSpoke))) as F;
  }
  const rimRing = T.smoothstep(wheelR.mul(0.56), wheelR.mul(0.6), wheelDist) as F;
  const centerHub = T.smoothstep(0.068, 0.042, wheelDist) as F;
  const centerCap = T.smoothstep(0.03, 0.018, wheelDist) as F;
  const valveDot = T.smoothstep(0.028, 0.014, T.length(wheelVec.sub(T.vec2(0.0, wheelR.mul(-0.48))))) as F;
  const alloyMetal = T.clamp(T.max(T.max(spokes, valveDot), T.max(rimRing, centerHub)).sub(centerCap.mul(0.85)), 0.0, 1.0) as F;

  // Black plastic and rubber is matte; lamps, glass and chrome are glossy.
  const matte = T.max(
    T.max(T.max(isTyre, isTrim), T.max(intake, grille)),
    T.max(T.max(rearValance, under), T.max(T.max(cowlPanel, cladding), T.max(rearWiper, seal.mul(one.sub(T.max(glass, chromeBelt)))))),
  ) as F;

  // ---- Colour --------------------------------------------------------------------------------------------------------
  let painted: C3 = paint;
  if (spec.sign) {
    // Taxi door badges and the medallion number. This branch exists only on the taxi spec, which the vehicle kind
    // picks (lofted-car.ts bodySpecForKind); no paint colour is tested.
    const doorMid = (spec.doors[0]! + spec.doors[1]!) / 2;
    const badge = roundedRect(T.vec2(pz.sub(doorMid), py.sub(0.66)), T.vec2(0.21, 0.052), 0.012).mul(isSide).mul(isBody) as F;
    const emblem = T.smoothstep(0.042, 0.036, T.length(T.vec2(T.abs(pz.sub(doorMid)).sub(0.15), py.sub(0.66)))) as F;
    const letters = T.step(0.35, T.sin(pz.mul(95.0)))
      .mul(T.step(T.abs(pz.sub(doorMid)), 0.1))
      .mul(T.smoothstep(0.03, 0.026, T.abs(py.sub(0.66)))) as F;
    const medallion = T.step(0.3, T.sin(pz.mul(150.0)))
      .mul(T.step(T.abs(pz.sub(spec.zRear + 0.6)), 0.075))
      .mul(T.smoothstep(0.016, 0.013, T.abs(py.sub(0.8))))
      .mul(isSide)
      .mul(isBody) as F;
    painted = T.mix(T.mix(painted, col(C.taxiBadge), badge), col(C.taxiGold), T.max(emblem, letters).mul(badge)) as C3;
    painted = T.mix(painted, col(C.taxiBadge), medallion) as C3;
  }

  // Panel shading: soft occlusion low down and under the arch lips, cladding, door shut lines and handles, trunk and
  // hood shut lines, the black cowl panel under the windshield.
  const archLip = T.smoothstep(archR + 0.05, archR - 0.005, wheelDist).mul(T.smoothstep(0.6, 0.9, ax)) as F;
  const ao = T.smoothstep(0.2, 0.62, py).mul(0.22).add(0.78).mul(one.sub(archLip.mul(0.55))) as F;
  const onDoors = isSide.mul(T.smoothstep(sillY + 0.04, sillY + 0.07, py)).mul(T.smoothstep(0.0, -0.015, py.sub(belt))) as F;
  let seams: F = T.float(0.0);
  for (const zd of spec.doors) seams = T.max(seams, T.smoothstep(0.009, 0.003, T.abs(pz.sub(zd)))) as F;
  for (const zh of spec.handles) {
    seams = T.max(seams, roundedRect(T.vec2(pz.sub(zh), py.sub(belt.sub(0.095))), T.vec2(0.06, 0.011), 0.008)) as F;
  }
  let body = T.mix(painted.mul(ao), col(C.cladding), cladding) as C3;
  body = body.mul(one.sub(seams.mul(onDoors).mul(0.55))).mul(one.sub(panelSeam.mul(0.5))) as C3;
  body = T.mix(body, col(C.blackPanel), cowlPanel) as C3;

  // Nose: slatted grilles and divided reflectors inside squared lamp housings, with outer amber indicators.
  const slats = T.step(0.5, T.fract(py.mul(42.0))).mul(0.4).add(0.6);
  body = T.mix(body, col(C.grille).mul(slats), T.max(intake, grille)) as C3;
  const lensShade = T.smoothstep(0.0, hlH, T.abs(hlUV.y)).mul(0.35).add(0.65);
  const lampColor = T.mix(T.mix(col(C.lampHousing), col(C.headLens).mul(lensShade), headlightLens), col(C.drl), drl);
  body = T.mix(body, T.mix(lampColor, col(C.frontAmber), turnFront), headlight) as C3;
  // Tail: thin rubber seals round divided red, amber and clear lenses.
  const tailShade = T.smoothstep(0.0, tlH, T.abs(tlUV.y)).mul(-0.3).add(1.0) as F;
  const tailColor = T.mix(T.mix(col(C.tailRed).mul(tailShade), col(C.tailAmber), turnRearSection), col(C.reverseLens), reverseRearSection);
  body = T.mix(body, col(C.blackPanel), rearValance) as C3;
  body = T.mix(body, col(C.reflector), reflector) as C3;
  body = T.mix(body, col(C.tailHousing), taillight) as C3;
  body = T.mix(body, tailColor, tailLens) as C3;
  // Shaded recess and handle in the painted trunk, above the bumper.
  const pocketShade = T.smoothstep(plateR - 0.09, plateR + 0.115, py).mul(-0.25).add(0.9);
  body = T.mix(body, body.mul(pocketShade), platePocket) as C3;
  body = T.mix(body, col(C.trunkHandle), trunkHandle) as C3;
  body = T.mix(body, col(C.plateRecess), plateRecess) as C3;
  body = T.mix(body, col(physicalVehicles.plate.field), plates) as C3;
  const plateVariant = T.floor(T.fract(paint.x.mul(7).add(paint.y.mul(13)).add(paint.z.mul(17))).mul(4));
  const plateUV = T.vec2(px.div(-0.31).add(0.5), py.sub(plateR).div(0.12).add(0.5));
  const plateColor = T.texture(plateTexture, T.vec2(plateUV.x, plateUV.y.add(plateVariant).div(4))).rgb;
  body = T.mix(body, plateColor, plateRear) as C3;
  body = T.mix(body, col(C.underside), under) as C3;

  // Glasshouse: tinted glass, black seals and pillars, painted roof and A pillars, chrome sill strip, CHMSL.
  const glassCol = T.mix(col(C.glassLow), col(C.glassHigh), T.smoothstep(0.2, 0.9, ny));
  let windowCol = T.mix(T.mix(T.mix(T.mix(paint, col(C.seal), seal), glassCol, glass), col(C.chrome), chromeBelt), col(C.chmsl), chmsl) as C3;
  windowCol = T.mix(windowCol, col(C.blackPanel), rearWiper) as C3;

  // Mirror caps (paint, glass facing back), taxi roof light, trims, alloys and tyres.
  const mirrorCol = T.mix(paint, col(C.mirrorGlass), mirrorGlass);
  const signCol = T.mix(col(C.signBody), T.mix(col(C.signFace), col(C.blackPanel), signGlyph), signFace);
  const alloyCol = T.mix(col(C.alloyDark), col(C.alloy), alloyMetal);
  const treadZone = T.smoothstep(wheelR.mul(0.74), wheelR.mul(0.83), wheelDist);
  const tyreBase = T.smoothstep(wheelR.mul(0.85), wheelR.mul(0.94), wheelDist).mul(0.22).add(0.78);
  const tyreCol = col(C.tyre).mul(tyreBase.add(spokes.mul(treadZone).mul(0.24)));

  let colour = T.mix(body, windowCol, isWindow) as C3;
  colour = T.mix(colour, mirrorCol, isMirror) as C3;
  colour = T.mix(colour, signCol, isSign) as C3;
  colour = T.mix(colour, col(C.trim), isTrim) as C3;
  colour = T.mix(colour, alloyCol, isAlloy) as C3;
  colour = T.mix(colour, tyreCol, isTyre) as C3;

  // ---- Roughness and metalness -----------------------------------------------------------------------------------
  const alloySpokes = T.max(spokes, rimRing).mul(isAlloy) as F;
  const glossy = T.max(T.max(T.max(glass, chromeBelt), mirrorGlass), lamp) as F;
  let rough = T.mix(T.float(0.26), T.float(0.15), glossy) as F;
  rough = T.mix(rough, T.float(0.4), plates) as F;
  rough = T.mix(rough, T.float(0.35), isSign) as F;
  rough = T.mix(rough, T.float(0.82), T.max(matte, isAlloy.sub(alloySpokes))) as F;

  let metal = T.mix(T.float(0.34), T.float(0.14), glass) as F;
  metal = T.mix(metal, T.float(0.6), T.max(lamp, mirrorGlass)) as F;
  metal = T.mix(metal, T.float(0.95), chromeBelt) as F;
  metal = T.mix(metal, T.float(0.86), alloySpokes) as F;
  metal = T.mix(metal, T.float(0.08), plates) as F;
  metal = T.mix(metal, T.float(0.04), T.max(matte, isSign)) as F;

  // ---- Emissive: running, brake and turn lights, CHMSL, taxi roof light --------------------------------------------
  const V = physicalVehicles.lamp;
  const brake = state.x as F;
  const blink = T.max(state.y.mul(T.step(0.0, px)), state.z.mul(T.step(px, 0.0))) as F;
  const nightHeadlamp = T.smoothstep(NIGHT_HEADLAMP_GLOW[0], NIGHT_HEADLAMP_GLOW[1], options.glow) as F;
  const headlamps = col(V.headBeam)
    .mul(headlightLens.mul(CAR_LAMP_LEVEL.headLens).add(drl.mul(CAR_LAMP_LEVEL.drl)))
    .mul(nightHeadlamp)
    .mul(one.sub(turnFront.mul(blink)));
  const tail = col(V.brake).mul(redLens.mul(tailShade).mul(brake.mul(CAR_LAMP_LEVEL.brake).add(nightHeadlamp.mul(CAR_LAMP_LEVEL.nightTail))));
  const stop = col(V.brake).mul(chmsl.mul(brake).mul(CAR_LAMP_LEVEL.chmsl));
  const turn = col(V.turn).mul(T.max(turnFront, turnRear).mul(blink).mul(CAR_LAMP_LEVEL.turn));
  const sign = col(V.taxiSign).mul(signFace.mul(one.sub(signGlyph.mul(0.9))).mul(CAR_LAMP_LEVEL.taxiSign));

  const material = new THREE.MeshStandardNodeMaterial();
  material.name = `living-city:lofted-${spec.name}`;
  material.colorNode = colour;
  material.roughnessNode = rough;
  material.metalnessNode = metal;
  material.emissiveNode = headlamps.add(tail).add(stop).add(turn).add(sign);
  return { material, plateTexture, ownsPlateTexture };
}

// --- Bus ----------------------------------------------------------------------------------------------------------------

/**
 * The MTA bus material (Slop `createLoftedBusMaterial`): wraparound split windshield, sign band, rear window and
 * louvres, the side window band with mullions, the driver's window, glazed curb-side doors, the pearl, blue and cyan
 * livery with a dark skirt, lamps and plates.
 */
export function createLoftedBusMaterial(THREE: Three, options: Pick<LoftedMaterialOptions, 'glow'>): StdMat {
  const { T, col, roundedRect } = sdfTools(THREE);
  const B = physicalVehicles.bus;
  const s = BUS_SPEC;
  const p = T.attribute<'vec3'>('position', 'vec3');
  const n = T.attribute<'vec3'>('normal', 'vec3');
  const px = p.x as F;
  const py = p.y as F;
  const pz = p.z as F;
  const partId = T.attribute<'float'>('partId', 'float');
  const state = T.attribute<'vec4'>('carState', 'vec4');
  const isBody = T.step(T.abs(partId.sub(BUS_PARTS.BODY)), 0.25) as F;
  const isTrim = T.step(T.abs(partId.sub(BUS_PARTS.TRIM)), 0.25) as F;
  const isPod = T.step(T.abs(partId.sub(BUS_PARTS.POD)), 0.25) as F;
  const ax = T.abs(px) as F;
  const one = T.float(1.0);

  const front = T.smoothstep(0.1, 0.35, n.z).mul(T.step(s.zFront - 0.9, pz)).mul(isBody) as F;
  const rear = T.smoothstep(0.1, 0.35, n.z.negate()).mul(T.step(pz, s.zRear + 0.9)).mul(isBody) as F;
  const side = T.smoothstep(0.5, 0.75, T.abs(n.x)).mul(isBody) as F;
  const curb = T.step(px, 0.0) as F;

  const frontGlass = roundedRect(T.vec2(px, py.sub(1.82)), T.vec2(1.2, 0.58), 0.14).mul(T.smoothstep(0.012, 0.024, ax)).mul(front) as F;
  const frontSeal = roundedRect(T.vec2(px, py.sub(1.82)), T.vec2(1.24, 0.62), 0.16).mul(front) as F;
  const signBand = roundedRect(T.vec2(px, py.sub(2.55)), T.vec2(1.02, 0.16), 0.04).mul(front) as F;
  const rearGlass = roundedRect(T.vec2(px, py.sub(2.06)), T.vec2(0.92, 0.36), 0.08).mul(rear) as F;
  const rearSeal = roundedRect(T.vec2(px, py.sub(2.06)), T.vec2(0.96, 0.4), 0.1).mul(rear) as F;
  const louvres = roundedRect(T.vec2(px, py.sub(0.98)), T.vec2(0.78, 0.34), 0.05).mul(rear) as F;
  const slats = T.step(0.5, T.fract(py.mul(16.0))).mul(0.45).add(0.4);

  const [wy0, wy1] = s.window;
  const winMid = (wy0 + wy1) / 2;
  const winHalf = (wy1 - wy0) / 2;
  const sideBand = roundedRect(T.vec2(pz.add(0.5), py.sub(winMid)), T.vec2(4.82, winHalf), 0.08).mul(side) as F;
  const mullion = T.smoothstep(0.03, 0.045, T.abs(T.fract(pz.mul(0.8).add(0.35)).sub(0.5).mul(1.25))) as F;
  const sideSeal = roundedRect(T.vec2(pz.add(0.5), py.sub(winMid)), T.vec2(4.86, winHalf + 0.04), 0.1).mul(side) as F;
  const driverWin = roundedRect(T.vec2(pz.sub(4.86), py.sub(winMid + 0.04)), T.vec2(0.5, winHalf + 0.04), 0.1).mul(side).mul(one.sub(curb)) as F;
  const door = (z0: number, z1: number) => {
    const zc = (z0 + z1) / 2;
    const hw = (z1 - z0) / 2;
    const frame = roundedRect(T.vec2(pz.sub(zc), py.sub(1.44)), T.vec2(hw, 1.0), 0.05);
    const leaves = roundedRect(T.vec2(T.abs(pz.sub(zc)).sub(hw * 0.5), py.sub(1.5)), T.vec2(hw * 0.4, 0.84), 0.035);
    return { frame: frame.mul(side).mul(curb) as F, glass: leaves.mul(side).mul(curb) as F };
  };
  const d0 = door(s.frontDoor[0], s.frontDoor[1]);
  const d1 = door(s.rearDoor[0], s.rearDoor[1]);
  const doorFrame = T.max(d0.frame, d1.frame) as F;
  const glass = T.clamp(T.max(T.max(frontGlass, rearGlass), T.max(T.max(sideBand.mul(mullion), driverWin), T.max(d0.glass, d1.glass))), 0.0, 1.0) as F;
  const seal = T.clamp(T.max(T.max(frontSeal, rearSeal), T.max(T.max(sideSeal, signBand), doorFrame)), 0.0, 1.0) as F;

  // MTA livery.
  const shadeY = T.smoothstep(0.34, 1.2, py).mul(0.2).add(0.8);
  const blueStripe = T.smoothstep(0.9, 0.93, py).mul(T.smoothstep(1.2, 1.17, py));
  const cyanRibbon = T.smoothstep(0.84, 0.86, py).mul(T.smoothstep(0.885, 0.865, py));
  const skirt = T.smoothstep(0.53, 0.5, py);
  const livery = T.mix(T.mix(T.mix(col(B.pearl), col(B.blueBand), blueStripe), col(B.cyanRibbon), cyanRibbon), col(B.skirt), skirt).mul(shadeY);

  // Lamps: twin round headlamps and amber indicators in black pods; red tail columns, amber turn and white reverse
  // lamps at the rear corners; plates.
  const pod = roundedRect(T.vec2(ax.sub(0.86), py.sub(0.8)), T.vec2(0.27, 0.085), 0.06).mul(front) as F;
  const headLamp = T.max(
    T.smoothstep(0.05, 0.04, T.length(T.vec2(ax.sub(0.72), py.sub(0.8)))),
    T.smoothstep(0.05, 0.04, T.length(T.vec2(ax.sub(0.86), py.sub(0.8)))),
  ).mul(pod) as F;
  const turnFront = T.smoothstep(0.045, 0.035, T.length(T.vec2(ax.sub(1.02), py.sub(0.8)))).mul(pod) as F;
  const tailCol = roundedRect(T.vec2(ax.sub(1.04), py.sub(0.92)), T.vec2(0.075, 0.27), 0.05).mul(rear) as F;
  const tailLamp = tailCol.mul(T.smoothstep(0.93, 0.95, py)) as F;
  const turnRear = tailCol.mul(T.smoothstep(0.92, 0.9, py)).mul(T.smoothstep(0.76, 0.78, py)) as F;
  const reverse = tailCol.mul(T.smoothstep(0.75, 0.73, py)) as F;
  const plate = roundedRect(T.vec2(px, py.sub(0.77)), T.vec2(0.16, 0.06), 0.008).mul(T.max(front.mul(T.step(ax, 0.3)), rear)) as F;

  let body = T.mix(livery, col(B.seal), seal) as C3;
  body = T.mix(body, col(B.louvre).mul(slats), louvres) as C3;
  body = T.mix(body, col(B.lampPod), pod) as C3;
  body = T.mix(body, T.mix(col(B.headLens), col(B.amberLens), turnFront), T.max(headLamp, turnFront)) as C3;
  body = T.mix(body, col(B.tailLens), tailLamp) as C3;
  body = T.mix(body, col(B.turnRear), turnRear) as C3;
  body = T.mix(body, col(B.reverseLens), reverse) as C3;
  body = T.mix(body, col(physicalVehicles.plate.field), plate) as C3;
  const glassTint = T.mix(col(B.glassLow), col(B.glassHigh), T.clamp(py.sub(1.3).mul(0.8), 0.0, 1.0));
  body = T.mix(body, glassTint, glass) as C3;

  const colour = T.mix(T.mix(body, col(B.trim), isTrim), col(B.roofPod), isPod);

  const V = physicalVehicles.lamp;
  const material = new THREE.MeshStandardNodeMaterial();
  material.name = 'living-city:lofted-bus';
  material.colorNode = colour;
  material.roughnessNode = T.mix(
    T.mix(T.mix(T.float(0.3), T.float(0.16), T.max(glass, T.max(headLamp, tailCol))), T.float(0.7), T.max(isTrim, seal.mul(one.sub(glass)))),
    T.float(0.45),
    isPod,
  );
  material.metalnessNode = T.mix(T.mix(T.float(0.22), T.float(0.7), glass), T.float(0.05), T.max(isTrim, isPod));

  const brake = state.x as F;
  const blink = T.max(state.y.mul(T.step(0.0, px)), state.z.mul(T.step(px, 0.0))) as F;
  const nightHeadlamp = T.smoothstep(NIGHT_HEADLAMP_GLOW[0], NIGHT_HEADLAMP_GLOW[1], options.glow) as F;
  material.emissiveNode = col(V.busHead)
    .mul(pod.mul(BUS_LAMP_LEVEL.pod).add(headLamp.mul(BUS_LAMP_LEVEL.head)))
    .mul(nightHeadlamp)
    .add(col(V.turn).mul(T.max(turnFront, turnRear).mul(blink).mul(BUS_LAMP_LEVEL.turn)))
    .add(col(V.brake).mul(tailLamp.mul(brake.mul(BUS_LAMP_LEVEL.brake).add(BUS_LAMP_LEVEL.tailBase))));
  return material;
}
