// Adapted from mrdoob/slop-newyork @ be65d0a, js/tsl-materials.js facadeCell, createPreWarBuildingMaterial and createCurtainWallMaterial (MIT, © 2026 Mr.doob)
// Slop ports both materials from three's examples/jsm/generators/city/SkyscraperGenerator.js (MIT, three.js authors).
//
// Pre-war masonry (limestone and terra cotta, running-bond brick,
// brownstone) and curtain-wall glass for the physically lit city. Both draw
// the window grid from the facade cell: per wall, a whole number of bays
// between masonry corner piers, Slop's wall kinds (storefront, residential
// entrance, rear, lot line, blank stone), interior-mapped rooms behind the
// upper windows, 2D shop glazing on the ground floor, AC units, ghost signs
// on lot-line walls, canyon AO and the warm canyon bounce.
//
// Two layouts, as in Slop:
// - `wallLocal: true` reads the per-vertex aFacadeWall / aFacadeGrid that
//   city-mesh.ts writes with its `facadeAttributes` option (Slop's
//   `boxLocal`, with the box facts moved from instance to vertex
//   attributes, physical/facade-attributes.ts). One material draws every
//   masonry family: the family index in aFacadeGrid picks trim, glass, lit
//   share and warmth, and the wall stone is the class tone in the vertex
//   colour, so the masonry stays one draw.
// - `wallLocal: false` grids in world x/z like Slop's default, with one
//   family per material, for meshes without those attributes.
//
// Not ported: the crown flood light. Slop's default crownGlowHeight of
// 9999 m leaves it dark on every building that sets none, and only Slop's
// Midtown landmarks set one. The curtain wall's reflected skyline is kept:
// it is procedural, not Manhattan data.
import type { Three } from '@acme/ui/three';
import { physicalCityMaterials } from '@acme/theme';
import { CURTAIN_WALL, MASONRY_FAMILY, PRE_WAR } from '../physical-materials-constants.ts';
import { canyonSkyAO, type OpenSkyInput } from './canyon-ao.ts';
import { MASONRY_FAMILIES, type MasonryFamily } from './class-family.ts';
import { FACADE_GRID_ATTRIBUTE, FACADE_WALL_ATTRIBUTE, WALL_KINDS } from './facade-attributes.ts';
import { facadeFrame, facadeProjection, type FacadeFrame } from './facade-frame.ts';
import { apartmentInterior } from './interior.ts';
import { asColorNode, asNode, asTsl, type TslNode } from './loose-tsl.ts';
import { physicalTsl, type PhysicalMaterialUniforms } from './tsl-common.ts';

type StdMat = InstanceType<Three['MeshStandardNodeMaterial']>;
const PW = physicalCityMaterials.preWar;
const FAM = physicalCityMaterials.masonryFamily;
const CW = physicalCityMaterials.curtainWall;

/** Slop js/buildings.js `facades` seeds per masonry family (rows 0–2). */
const FAMILY_SEED: Readonly<Record<MasonryFamily, number>> = { limestone: 12.4, brick: 27.8, brownstone: 41.2 };
const FAMILY_TRIM: Readonly<Record<MasonryFamily, string>> = { limestone: FAM.limestoneTrim, brick: FAM.brickTrim, brownstone: FAM.brownstoneTrim };
const FAMILY_GLASS: Readonly<Record<MasonryFamily, string>> = { limestone: FAM.limestoneGlass, brick: FAM.brickGlass, brownstone: FAM.brownstoneGlass };

/** What Slop's facadeCell returns, plus the frame it was built on. */
export interface FacadeCell {
  frame: FacadeFrame;
  isRoof: TslNode; uCoord: TslNode; vCoord: TslNode; gridV: TslNode; cellId: TslNode; cellUV: TslNode; fw: TslNode;
  bayWidth: TslNode; isGroundFloor: TslNode; solid: TslNode; floor0: TslNode; back: TslNode; blank: TslNode; door: TslNode;
  tone: TslNode; wallS: TslNode; wallW: TslNode; wallH: TslNode; fromTop: TslNode; boxSeed: TslNode; partial: TslNode; coping: TslNode;
  /** Masonry family index from aFacadeGrid (wall-local), or the fixed one. */
  family: TslNode;
  floorHeight: TslNode;
}

/**
 * Slop facadeCell. World mode takes the window module as arguments; wall
 * mode reads it, the wall and its kind from the vertex attributes.
 */
export function facadeCell(
  THREE: Three,
  opts: { wallLocal: boolean; windowWidth?: number; floorHeight?: number; family?: number },
): FacadeCell {
  const { T } = physicalTsl(THREE);
  const frame = facadeFrame(THREE);
  const { nWall, uCoord: worldU, isRoof } = facadeProjection(THREE, frame, opts.wallLocal);
  let uCoord = worldU;
  let windowWidth = T.float(opts.windowWidth ?? MASONRY_FAMILY.limestone.windowWidth);
  let floorHeight = T.float(opts.floorHeight ?? MASONRY_FAMILY.limestone.floorHeight);
  let bayWidth = windowWidth;
  let gridU = uCoord.div(bayWidth);
  let inPier = T.float(0.0);
  let kind = T.float(WALL_KINDS.shop);
  let tone = T.float(0.5);
  let bayIdx = T.float(0.0);
  let bays = T.float(1.0);
  let wallS = T.float(0.0);
  let wallW = T.float(1.0);
  let wallH = T.float(1.0);
  let fromTop = T.float(0.0);
  let boxSeed = T.float(0.0);
  let family = T.float(opts.family ?? 0);

  if (opts.wallLocal) {
    const wall = T.attribute(FACADE_WALL_ATTRIBUTE, 'vec4'); // along m, wall width m, wall height m, kind
    const grid = T.attribute(FACADE_GRID_ATTRIBUTE, 'vec4'); // floor height m, window width m, seed + tone, family * 4 + pier m
    floorHeight = grid.x;
    windowWidth = grid.y;
    kind = wall.w;
    // The seed's fraction (0.1..0.9) is the tone, as in Slop's createFacadeBoxes.
    tone = T.fract(grid.z).sub(0.1).div(0.8);
    boxSeed = T.floor(grid.z);
    family = T.floor(grid.w.div(4.0));
    const cornerPier = T.mod(grid.w, 4.0);
    // Whole-bay offset per wall so walls do not repeat each other's windows.
    const wallSeed = T.floor(grid.z.add(T.dot(nWall, T.vec3(17.0, 0.0, 37.0))));
    const s = wall.x; // metres from the wall's left end, seen from the street
    const wallWidth = wall.y;
    wallW = wallWidth;
    wallS = s;
    wallH = wall.z;
    // City walls stand on the street plane, so metres below the top follow from the world height.
    fromTop = wall.z.sub(T.positionWorld.y);
    const pier = T.min(cornerPier, wallWidth.mul(0.2));
    const inner = wallWidth.sub(pier.mul(2.0));
    bays = T.max(T.floor(inner.div(windowWidth).add(0.5)), 1.0);
    bayWidth = inner.div(bays);
    bayIdx = T.floor(s.sub(pier).div(bayWidth));
    gridU = s.sub(pier).div(bayWidth).add(wallSeed);
    inPier = T.float(1.0).sub(T.step(pier, s).mul(T.step(s, wallWidth.sub(pier))));
    uCoord = gridU.mul(bayWidth);
  }

  const vCoord = T.positionWorld.y;
  const gridV = vCoord.div(floorHeight);
  const cellId = T.vec2(T.floor(gridU), T.floor(gridV));
  const cellUV = T.vec2(T.fract(gridU), T.fract(gridV));
  const fw = T.vec2(T.fwidth(gridU), T.fwidth(gridV));

  // The ground floor is strictly floor 0, so floor 1 is never sliced in half.
  const floor0 = T.float(1.0).sub(T.step(1.0, gridV));
  const wallMask = T.float(1.0).sub(isRoof);
  const isGroundFloor = floor0.mul(T.float(1.0).sub(T.step(WALL_KINDS.shop + 0.5, kind)));
  const blank = T.step(WALL_KINDS.lotLine - 0.5, kind).mul(wallMask);
  const back = T.step(WALL_KINDS.rear - 0.5, kind).mul(T.float(1.0).sub(T.step(WALL_KINDS.blankStone - 0.5, kind))).mul(wallMask);
  // One entrance per residential front, in a bay picked by the building's tone.
  const isEntry = T.step(WALL_KINDS.entry - 0.5, kind).mul(T.float(1.0).sub(T.step(WALL_KINDS.entry + 0.5, kind)));
  const door = floor0.mul(isEntry).mul(wallMask).mul(T.step(T.abs(bayIdx.sub(T.min(T.floor(tone.mul(bays)), bays.sub(1.0)))), 0.5));
  // A wall that is not a whole number of storeys ends in a solid parapet instead of a sliced row of windows; every wall is capped by a coping.
  let partial = T.float(0.0);
  let coping = T.float(0.0);
  if (opts.wallLocal) {
    const top = vCoord.add(fromTop);
    const floorBase = T.floor(gridV).mul(floorHeight);
    const whole = T.step(top.sub(wallH).sub(0.05), floorBase).mul(T.step(floorBase.add(floorHeight), top.add(0.05)));
    partial = T.float(1.0).sub(whole).mul(wallMask);
    coping = T.float(1.0).sub(T.step(0.32, fromTop)).mul(wallMask);
  }
  const solid = T.max(T.max(inPier.mul(T.float(1.0).sub(isGroundFloor)), blank), partial);
  return {
    frame, isRoof, uCoord, vCoord, gridV, cellId, cellUV, fw, bayWidth, isGroundFloor, solid, floor0, back, blank, door, tone,
    wallS, wallW, wallH, fromTop, boxSeed, partial, coping, family, floorHeight,
  };
}

/** Pick per masonry family (index 0..2) from three values, without branching. */
function byFamily(T: ReturnType<typeof physicalTsl>['T'], family: TslNode, values: readonly [TslNode, TslNode, TslNode]): TslNode {
  return T.mix(T.mix(values[0], values[1], T.step(0.5, family)), values[2], T.step(1.5, family));
}

export interface PreWarOptions {
  /** Per-vertex wall layout from city-mesh.ts (true), or Slop's world grid with one family (false). */
  wallLocal: boolean;
  /** World layout only: the family this material draws. */
  family?: MasonryFamily;
  /** World layout: the wall stone token (required there); the wall-local layout takes the vertex colour (WALL_TONES). */
  stone?: string;
  /** Opens the canyon AO over park and open areas (canyon-ao.ts). */
  openSky?: OpenSkyInput;
}

/** Slop createPreWarBuildingMaterial. */
export function createPreWarMaterial(THREE: Three, uniforms: PhysicalMaterialUniforms, opts: PreWarOptions): StdMat {
  const { T, c, hash2D, noise2D, bumpNormal, lineAA, gridLine, filteredPulse } = physicalTsl(THREE);
  const U = {
    sun: asTsl(uniforms.uSunColor), skyHorizon: asTsl(uniforms.uSkyHorizonColor),
    glow: asTsl(uniforms.uInteriorGlow), bounce: asTsl(uniforms.uCanyonBounce),
  };
  const mat = new THREE.MeshStandardNodeMaterial({ metalness: PRE_WAR.metalness, roughness: PRE_WAR.roughness });
  const fixed = opts.family ?? 'limestone';
  const fixedIndex = MASONRY_FAMILIES.indexOf(fixed);
  const facade = opts.wallLocal
    ? facadeCell(THREE, { wallLocal: true })
    : facadeCell(THREE, { wallLocal: false, windowWidth: MASONRY_FAMILY[fixed].windowWidth, floorHeight: MASONRY_FAMILY[fixed].floorHeight, family: fixedIndex });
  const { frame, isRoof, uCoord, vCoord, gridV, cellId, cellUV, fw, bayWidth, isGroundFloor, solid, back, blank, door, tone } = facade;
  const { wallS, wallW, wallH, fromTop, boxSeed, coping, family, floorHeight } = facade;

  const families = MASONRY_FAMILIES;
  const pick = (f: (m: MasonryFamily) => TslNode) => byFamily(T, family, [f(families[0]), f(families[1]), f(families[2])]);
  if (!opts.wallLocal && !opts.stone) throw new Error('the world-grid pre-war material needs a stone colour');
  const cStone = opts.wallLocal ? T.sRGBTransferEOTF(T.attribute('color', 'vec3')) : c(opts.stone!);
  const cTrim = pick((m) => c(FAMILY_TRIM[m]));
  const cGlass = pick((m) => c(FAMILY_GLASS[m]));
  const uLitProbability = pick((m) => T.float(MASONRY_FAMILY[m].litProbability));
  const uWarmth = pick((m) => T.float(MASONRY_FAMILY[m].warmth));
  const uSeed = pick((m) => T.float(FAMILY_SEED[m]));
  const cSoot = c(PW.soot);
  const cWarmWindow = c(PW.windowWarm);
  const cCoolWindow = c(PW.windowCool);
  const cCanyonBounce = c(PW.canyonBounce);

  const halfWinX = (1.0 - PRE_WAR.windowRatioX) * 0.5;
  const halfWinY = (1.0 - PRE_WAR.windowRatioY) * 0.5;
  const brickH = PRE_WAR.brickHeight;
  const brickL = PRE_WAR.brickLength;
  const belt = PRE_WAR.beltEvery;

  mat.aoNode = asNode(canyonSkyAO(THREE, opts.openSky));

  const open = T.float(1.0).sub(solid).mul(T.float(1.0).sub(door)); // 0 in the corner piers, blank walls and doorways
  const front = T.float(1.0).sub(back).sub(blank).max(0.0); // street fronts
  const effHalfX = T.mix(T.float(halfWinX), T.float(0.11), isGroundFloor);
  const effHalfY = T.mix(T.float(halfWinY), T.float(0.1), isGroundFloor);
  const winUV = T.clamp(
    T.vec2(
      cellUV.x.sub(effHalfX).div(T.max(0.01, T.float(1.0).sub(effHalfX.mul(2.0)))),
      cellUV.y.sub(effHalfY).div(T.max(0.01, T.float(1.0).sub(effHalfY.mul(2.0)))),
    ),
    T.vec2(0.0),
    T.vec2(1.0),
  );
  const aptRoom = apartmentInterior(THREE, frame, {
    u: uCoord, v: vCoord, winUV, cellId, bayWidth, floorHeight, seed: uSeed, warmth: uWarmth,
    litProbability: uLitProbability.mul(PRE_WAR.litShareScale), fw,
  });
  const shopLit = T.step(0.24, hash2D(cellId.add(T.vec2(uSeed, 19.4))));
  const bulbCol = T.mix(cCoolWindow, cWarmWindow, T.step(T.float(1.0).sub(uWarmth), hash2D(cellId.add(T.vec2(uSeed.mul(1.9), 83.1)))));
  // Window AC units on about 12 % of upper-floor windows, none in the floor the band course covers.
  const beltFloor = T.step(belt - 1, T.mod(T.floor(gridV), belt)).mul(front);
  const acRand = hash2D(cellId.add(T.vec2(uSeed.mul(1.3).add(7.1), 91.7)));
  const hasAC = T.step(1 - PRE_WAR.acShare, acRand).mul(T.float(1.0).sub(isGroundFloor)).mul(T.float(1.0).sub(isRoof)).mul(open).mul(T.float(1.0).sub(beltFloor));

  mat.colorNode = asColorNode(T.Fn(() => {
    const oneMinusEffX = T.float(1.0).sub(effHalfX);
    const oneMinusEffY = T.float(1.0).sub(effHalfY);
    const inX = filteredPulse(cellUV.x, effHalfX, oneMinusEffX, fw.x).mul(open);
    const inY = filteredPulse(cellUV.y, effHalfY, oneMinusEffY, fw.y);

    // Cornice belt every 6 floors on street fronts, and the storefront fascia at the top of floor 0.
    const cornicePhase = T.fract(gridV.div(belt));
    const isCornice = T.max(
      filteredPulse(cornicePhase, 0.86, 1.0, fw.y.div(belt)).mul(front),
      isGroundFloor.mul(filteredPulse(cellUV.y, 0.86, 1.0, fw.y)),
    );

    // Double-hung meeting rail upstairs; storefront transom and mullions on the ground floor.
    const sashBarY = lineAA(cellUV.y.sub(0.52), 0.012).mul(T.float(1.0).sub(isGroundFloor));
    const sashBarX = lineAA(cellUV.x.sub(0.5), 0.009).mul(T.float(1.0).sub(isGroundFloor)).mul(0.55);
    const storeTransom = lineAA(cellUV.y.sub(0.7), 0.015).mul(isGroundFloor);
    const storeMullion = lineAA(T.fract(cellUV.x.mul(2.0)).sub(0.5), 0.018).mul(isGroundFloor);
    const sashMask = T.clamp(T.max(T.max(sashBarY, sashBarX), T.max(storeTransom, storeMullion)), 0.0, 1.0);

    // A window AC unit sitting on the sill.
    const acMinX = T.float(0.31);
    const acMaxX = T.float(0.69);
    const acMinY = effHalfY;
    const acMaxY = effHalfY.add(0.22);
    const inACBox = filteredPulse(cellUV.x, acMinX, acMaxX, fw.x).mul(filteredPulse(cellUV.y, acMinY, acMaxY, fw.y)).mul(hasAC);
    const acUV = T.clamp(T.vec2(cellUV.x.sub(acMinX).div(0.38), cellUV.y.sub(acMinY).div(0.22)), T.vec2(0.0), T.vec2(1.0));
    const acGrille = T.smoothstep(0.08, 0.16, acUV.x).mul(T.float(1.0).sub(T.smoothstep(0.84, 0.92, acUV.x)))
      .mul(T.smoothstep(0.14, 0.22, acUV.y)).mul(T.float(1.0).sub(T.smoothstep(0.84, 0.92, acUV.y)));
    const acSlats = T.fract(acUV.y.mul(6.0));
    const acPlastic = T.mix(c(PW.acPlasticA), c(PW.acPlasticB), T.fract(acRand.mul(7.3)));
    const acColor = acPlastic.mul(T.mix(T.float(1.0), T.mix(T.float(0.38), T.float(0.75), acSlats), acGrille));
    const acUnderShadow = filteredPulse(cellUV.x, acMinX.sub(0.02), acMaxX.add(0.02), fw.x)
      .mul(filteredPulse(cellUV.y, effHalfY.sub(0.09), effHalfY, fw.y))
      .mul(hasAC).mul(0.42);

    const isWindowOpening = inX.mul(inY).mul(T.float(1.0).sub(isRoof)).mul(T.float(1.0).sub(isCornice));
    const isWindowGlass = isWindowOpening.mul(T.float(1.0).sub(sashMask)).mul(T.float(1.0).sub(inACBox));

    // Anti-aliased running bond.
    const rowCoord = vCoord.div(brickH);
    const courseRow = T.floor(rowCoord);
    const colCoord = uCoord.div(brickL).add(T.mod(courseRow, 2.0).mul(0.5));
    // Rear, court and lot-line walls are plain common brick (red-brown or buff by building); lot-line walls weather in patches of grey parging.
    const backBrick = T.mix(
      T.mix(c(PW.rearBrickRedA), c(PW.rearBrickRedB), T.fract(tone.mul(7.31))),
      T.mix(c(PW.rearBrickBuffA), c(PW.rearBrickBuffB), T.fract(tone.mul(5.17))),
      T.step(0.58, tone),
    );
    const parged = T.float(0.0).toVar();
    T.If(blank.mul(back).greaterThan(0.5), () => {
      const pargePatch = T.smoothstep(0.6, 0.76, noise2D(T.vec2(uCoord.mul(0.11), vCoord.mul(0.07)).add(tone.mul(37.0))));
      parged.assign(T.max(T.step(0.74, T.fract(tone.mul(3.7))), pargePatch.mul(0.85)));
    });
    const backTint = T.mix(backBrick, c(PW.parging), parged);
    const mortarJoint = T.max(gridLine(colCoord.mul(brickL), brickL, 0.016), gridLine(vCoord, brickH, 0.016))
      .mul(T.float(1.0).sub(isRoof)).mul(T.float(1.0).sub(parged)).mul(T.float(1.0).sub(coping));

    // Per-brick tint and soot streaks fade out once bricks shrink to a pixel, so neither can shimmer.
    const uFw = T.fwidth(uCoord);
    const brickVar = T.float(1.0).sub(T.smoothstep(0.5, 1.0, T.max(uFw.div(brickL), T.fwidth(rowCoord))));
    const brickCell = T.vec2(T.floor(colCoord), courseRow);
    const brickRnd = hash2D(brickCell.add(T.vec2(uSeed, 5.3))).sub(0.5).mul(brickVar);
    const brickWarmShift = hash2D(brickCell.add(T.vec2(17.1, uSeed))).sub(0.5).mul(0.12).mul(brickVar);
    const brickShiftVec = T.vec3(T.float(1.0).add(brickWarmShift), T.float(1.0), T.float(1.0).sub(brickWarmShift));

    const streakNoise = T.mix(T.float(0.5), noise2D(T.vec2(uCoord.mul(1.4), vCoord.mul(0.05))), T.float(1.0).sub(T.smoothstep(0.5, 1.0, uFw.mul(1.4))));
    const sootDirt = T.smoothstep(0.25, 0.78, streakNoise).mul(T.float(1.0).sub(T.smoothstep(0.0, 180.0, vCoord))).mul(0.36);

    const lintelShadow = T.smoothstep(oneMinusEffY.sub(0.14), oneMinusEffY, cellUV.y).mul(0.58);
    const jambShadow = T.float(1.0).sub(T.smoothstep(effHalfX, effHalfX.add(0.08), cellUV.x)).mul(0.42);
    const sillSpan = filteredPulse(cellUV.x, effHalfX.sub(0.045), oneMinusEffX.add(0.045), fw.x).mul(open).mul(T.float(1.0).sub(beltFloor));
    const isSillTop = filteredPulse(cellUV.y, effHalfY.sub(0.032), effHalfY, fw.y).mul(sillSpan);
    const isSillUnderShadow = filteredPulse(cellUV.y, effHalfY.sub(0.075), effHalfY.sub(0.032), fw.y).mul(sillSpan);
    const corniceShadow = T.smoothstep(0.76, 0.86, cornicePhase).mul(0.32).mul(front);

    const canyonBand = T.smoothstep(0.0, 14.0, vCoord).mul(T.float(1.0).sub(T.smoothstep(22.0, 75.0, vCoord)));
    const canyonGlow = cCanyonBounce.mul(canyonBand.mul(U.bounce).mul(0.22));

    // A faded painted advertisement (ghost sign) high on some lot-line walls:
    // a panel with a line of tall block letters over a smaller one, flaking
    // off the brick. Lettering is only worked out inside the panel. The
    // glyphs are abstract strokes, never words.
    const signW = T.min(wallW.sub(3.0), 18.0);
    const signH = T.min(T.min(wallH.mul(0.3), signW.mul(0.42)), 6.5);
    const hasSign = blank.mul(back).mul(T.float(1.0).sub(T.step(0.74, T.fract(tone.mul(3.7)))))
      .mul(T.step(0.8, T.fract(tone.mul(13.7).add(boxSeed.mul(0.618)))))
      .mul(T.step(5.0, signW)).mul(T.step(2.6, signH));
    const su = wallS.sub(wallW.sub(signW).mul(0.5)).div(signW);
    const sv = fromTop.sub(1.2).div(signH);
    const signFw = T.vec2(T.fwidth(su), T.fwidth(sv));
    const signPaint = T.vec4(0.0).toVar();
    T.If(hasSign.mul(T.step(0.0, su)).mul(T.step(su, 1.0)).mul(T.step(0.0, sv)).mul(T.step(sv, 1.0)).greaterThan(0.5), () => {
      const pal = T.fract(tone.mul(29.3));
      const ground = T.mix(T.mix(c(PW.signGroundCream), c(PW.signGroundOxblood), T.step(0.5, pal)), c(PW.signGroundNavy), T.step(0.8, pal));
      const ink = T.mix(T.mix(c(PW.signInkOxblood), c(PW.signInkCream), T.step(0.5, pal)), c(PW.signInkGold), T.step(0.8, pal));
      const border = T.float(1.0).sub(filteredPulse(su, 0.02, 0.98, signFw.x).mul(filteredPulse(sv, 0.045, 0.955, signFw.y)));
      const lettering = (v0: number, v1: number, line: number) => {
        const glyphW = signH.mul((v1 - v0) * 0.64);
        const n = T.floor(signW.mul(0.86).div(glyphW));
        const gx = su.mul(signW).sub(signW.sub(n.mul(glyphW)).mul(0.5)).div(glyphW);
        const fy = sv.sub(v0).div(v1 - v0);
        const wx = signFw.x.mul(signW).div(glyphW);
        const wy = signFw.y.div(v1 - v0);
        const fx = T.fract(gx);
        const h1 = hash2D(T.vec2(T.floor(gx).add(line * 31.0), tone.mul(91.0)));
        const h2 = hash2D(T.vec2(T.floor(gx).add(line * 31.0 + 7.0), tone.mul(53.0)));
        const verticals = T.max(
          T.max(filteredPulse(fx, 0.1, 0.28, wx).mul(T.step(0.22, h1)), filteredPulse(fx, 0.41, 0.59, wx).mul(T.step(h1, 0.22))),
          filteredPulse(fx, 0.72, 0.9, wx).mul(T.step(0.45, h2)),
        );
        const bars = T.max(
          T.max(filteredPulse(fy, 0.0, 0.17, wy).mul(T.step(0.35, T.fract(h1.mul(7.0)))), filteredPulse(fy, 0.42, 0.58, wy).mul(T.step(0.5, T.fract(h2.mul(5.0))))),
          filteredPulse(fy, 0.83, 1.0, wy).mul(T.step(0.4, T.fract(h1.mul(3.0)))),
        ).mul(filteredPulse(fx, 0.1, 0.9, wx));
        const inText = T.step(0.0, gx).mul(T.step(gx, n)).mul(T.step(0.0, fy)).mul(T.step(fy, 1.0)).mul(T.step(0.1, T.fract(h2.mul(11.0))));
        return T.max(verticals, bars).mul(inText);
      };
      const letters = T.max(lettering(0.14, 0.56, 0), lettering(0.66, 0.86, 1));
      const flake = T.smoothstep(0.5, 0.74, noise2D(T.vec2(wallS.mul(0.7), fromTop.mul(1.1)).add(tone.mul(31.0))));
      const cover = T.mix(T.float(0.34), T.float(0.66), T.fract(tone.mul(7.7))).mul(T.float(1.0).sub(flake.mul(0.9)));
      signPaint.assign(T.vec4(T.mix(ground, ink, T.max(letters, border)), cover));
    });

    const wallTint = T.mix(T.mix(cStone, backTint, back), signPaint.xyz, signPaint.w);
    // Trim stone on the band courses, the storefront fascia and the coping.
    const trimMix = T.max(isCornice.mul(0.62).add(isGroundFloor.mul(0.28)), coping.mul(0.8));
    const masonryTint = T.mix(wallTint, cTrim, trimMix).mul(brickRnd.mul(0.14).add(1.0)).mul(brickShiftVec);
    const masonryWithMortar = T.mix(masonryTint, masonryTint.mul(0.62), mortarJoint);
    const masonryWeathered = T.mix(masonryWithMortar, cSoot, sootDirt)
      .mul(T.float(1.0).sub(corniceShadow))
      .mul(T.float(1.0).sub(isSillUnderShadow.mul(0.42)))
      .mul(T.float(1.0).sub(acUnderShadow))
      .add(U.sun.mul(isSillTop.mul(0.24)))
      .add(canyonGlow);

    // Upper floors: interior-mapped rooms behind grimy soda-lime glazing. Ground floor: 2D storefront glass.
    const pooledDirt = T.float(1.0).sub(T.smoothstep(0.0, 0.32, winUV.y)).mul(0.36);
    const upperGrime = T.float(0.52).add(sootDirt.mul(0.35)).add(pooledDirt).clamp(0.0, 0.9);
    const viewDir = T.normalize(T.cameraPosition.sub(T.positionWorld));
    const fresnel = T.pow(T.clamp(T.float(1.0).sub(T.abs(T.dot(viewDir, T.normalWorldGeometry))), 0.0, 1.0), 2.0);
    const recessShade = T.float(1.0).sub(T.max(lintelShadow, jambShadow));

    const upperGlassBase = T.mix(aptRoom.xyz.mul(c(PW.glazeTint)), cGlass, upperGrime);
    const shopShelves = T.float(1.0).sub(T.step(0.76, T.fract(winUV.y.mul(3.0))).mul(0.34));
    const shopInterior = bulbCol.mul(T.smoothstep(0.05, 0.92, winUV.y).mul(0.48).add(0.24)).mul(shopShelves).mul(shopLit);
    const shopGlassBase = T.mix(cGlass, shopInterior, T.float(0.62).mul(T.float(1.0).sub(pooledDirt)));
    const glassBase = T.mix(upperGlassBase, shopGlassBase, isGroundFloor);
    const glassCol = T.mix(glassBase, U.skyHorizon, fresnel.mul(0.52).add(0.08)).mul(recessShade);

    const frameCol = masonryTint.mul(0.46).mul(recessShade);
    const roofNoise = noise2D(T.positionWorld.xz.mul(0.35));
    const roofCol = T.mix(cTrim.mul(0.42), cTrim.mul(0.62), roofNoise);

    const wallOrRoof = T.mix(masonryWeathered, roofCol, isRoof);
    const withFrames = T.mix(wallOrRoof, frameCol, isWindowOpening.mul(sashMask));
    const withGlass = T.mix(withFrames, glassCol, isWindowGlass);
    const withAC = T.mix(withGlass, acColor, inACBox);

    // A residential entrance: painted panel door under a glazed transom in a stone surround (door bay only).
    const finalCol = withAC.toVar();
    T.If(door.greaterThan(0.5), () => {
      const inDoorway = filteredPulse(cellUV.x, 0.27, 0.73, fw.x).mul(filteredPulse(cellUV.y, 0.065, 0.8, fw.y));
      const surround = filteredPulse(cellUV.x, 0.21, 0.79, fw.x).mul(filteredPulse(cellUV.y, 0.0, 0.86, fw.y));
      const transom = filteredPulse(cellUV.y, 0.67, 0.78, fw.y);
      const doorRnd = T.fract(tone.mul(11.3));
      const doorPaint = T.mix(
        T.mix(c(PW.doorBlack), c(PW.doorOxblood), T.step(0.35, doorRnd)),
        T.mix(c(PW.doorGreen), c(PW.doorBrown), T.step(0.8, doorRnd)),
        T.step(0.6, doorRnd),
      );
      const doorPanels = T.max(filteredPulse(cellUV.x, 0.494, 0.506, fw.x), filteredPulse(cellUV.y, 0.39, 0.41, fw.y));
      const doorCol = T.mix(doorPaint.mul(T.float(1.0).sub(doorPanels.mul(0.5))), T.mix(cGlass, U.skyHorizon, 0.18), transom);
      finalCol.assign(T.mix(T.mix(withAC, cTrim.mul(0.85), surround), doorCol, inDoorway));
    });
    return finalCol;
  })());

  mat.roughnessNode = asNode(T.Fn(() => {
    const beltBand = filteredPulse(gridV.div(belt), 0.86, 1.0, fw.y.div(belt)).mul(front);
    const inX = filteredPulse(cellUV.x, halfWinX, 1.0 - halfWinX, fw.x).mul(open).mul(T.float(1.0).sub(beltBand));
    const inY = filteredPulse(cellUV.y, halfWinY, 1.0 - halfWinY, fw.y);
    const isWindow = inX.mul(inY).mul(T.float(1.0).sub(isRoof));
    const winY = T.clamp(cellUV.y.sub(halfWinY).div(Math.max(0.01, 1.0 - 2.0 * halfWinY)), 0.0, 1.0);
    const pooledRough = T.float(1.0).sub(T.smoothstep(0.0, 0.32, winY)).mul(0.38);
    const glassRough = T.float(0.14).add(pooledRough);
    const stoneGrain = noise2D(T.vec2(uCoord.mul(8.0), vCoord.mul(8.0))).mul(0.12);
    return T.mix(T.float(0.78).add(stoneGrain), glassRough, isWindow);
  })());

  // Domed brickwork, stone courses, recessed windows and AC louvers. Edges
  // ramp over at least 2 px and the fine relief fades before it shrinks to
  // pixels: sharper steps turn into derivative sparkles along every joint.
  mat.normalNode = asNode(T.Fn(() => {
    const camDist = T.length(T.positionWorld.sub(T.cameraPosition));
    const detailFade = T.float(1.0).sub(T.smoothstep(PRE_WAR.detailNear, PRE_WAR.detailFar, camDist)).mul(T.float(1.0).sub(isRoof))
      .mul(T.float(1.0).sub(T.smoothstep(0.03, 0.1, T.max(fw.x, fw.y))));
    const ramp = fw.mul(2.0);
    const footprint = T.max(T.fwidth(uCoord), T.fwidth(vCoord));
    const beltBand = filteredPulse(gridV.div(belt), 0.86, 1.0, ramp.y.div(belt)).mul(front);
    const inX = filteredPulse(cellUV.x, effHalfX, T.float(1.0).sub(effHalfX), ramp.x).mul(open).mul(T.float(1.0).sub(beltBand));
    const inY = filteredPulse(cellUV.y, effHalfY, T.float(1.0).sub(effHalfY), ramp.y);
    const isWindow = inX.mul(inY);

    const rowCoord = vCoord.div(brickH);
    const courseRow = T.floor(rowCoord);
    const colCoord = uCoord.div(brickL).add(T.mod(courseRow, 2.0).mul(0.5));
    const distU = T.float(0.5).sub(T.abs(T.fract(colCoord).sub(0.5))).mul(brickL);
    const distV = T.float(0.5).sub(T.abs(T.fract(rowCoord).sub(0.5))).mul(brickH);
    const brickDome = T.smoothstep(0.0, 0.018, distU).mul(T.smoothstep(0.0, 0.018, distV)).mul(0.0045)
      .mul(T.float(1.0).sub(T.smoothstep(0.006, 0.012, footprint)));
    const sillLedge = filteredPulse(cellUV.y, effHalfY.sub(0.032), effHalfY, ramp.y).mul(inX).mul(0.016);
    const corniceLedge = beltBand.mul(0.022);
    const inACBox = filteredPulse(cellUV.x, 0.31, 0.69, ramp.x).mul(filteredPulse(cellUV.y, effHalfY, effHalfY.add(0.22), ramp.y)).mul(hasAC);
    const acLouverHeight = T.fract(cellUV.y.sub(effHalfY).div(0.22).mul(6.0)).mul(0.012)
      .mul(T.float(1.0).sub(T.smoothstep(0.012, 0.025, footprint)));
    const wallHeight = brickDome.mul(T.float(1.0).sub(coping)).add(sillLedge).add(corniceLedge).add(coping.mul(0.024));
    const totalHeight = T.mix(wallHeight, acLouverHeight.mul(inACBox), isWindow);
    return bumpNormal(totalHeight.mul(detailFade));
  })());

  mat.emissiveNode = asNode(T.Fn(() => {
    // The glow stays a hair inside the glazing.
    const glowHalfX = T.mix(T.float(halfWinX + 0.015), T.float(0.12), isGroundFloor);
    const glowHalfY = T.mix(T.float(halfWinY + 0.015), T.float(0.11), isGroundFloor);
    const inX = filteredPulse(cellUV.x, glowHalfX, T.float(1.0).sub(glowHalfX), fw.x).mul(open);
    const inY = filteredPulse(cellUV.y, glowHalfY, T.float(1.0).sub(glowHalfY), fw.y);
    const isCornice = T.max(
      filteredPulse(T.fract(gridV.div(belt)), 0.86, 1.0, fw.y.div(belt)).mul(front),
      isGroundFloor.mul(filteredPulse(cellUV.y, 0.86, 1.0, fw.y)),
    );
    const sashBarY = lineAA(cellUV.y.sub(0.52), 0.014).mul(T.float(1.0).sub(isGroundFloor));
    const sashBarX = lineAA(cellUV.x.sub(0.5), 0.01).mul(T.float(1.0).sub(isGroundFloor)).mul(0.55);
    const storeTransom = lineAA(cellUV.y.sub(0.7), 0.016).mul(isGroundFloor);
    const storeMullion = lineAA(T.fract(cellUV.x.mul(2.0)).sub(0.5), 0.02).mul(isGroundFloor);
    const sashMask = T.clamp(T.max(T.max(sashBarY, sashBarX), T.max(storeTransom, storeMullion)), 0.0, 1.0);
    const inACBox = filteredPulse(cellUV.x, 0.31, 0.69, fw.x).mul(filteredPulse(cellUV.y, glowHalfY, glowHalfY.add(0.22), fw.y)).mul(hasAC);
    const isWindow = inX.mul(inY).mul(T.float(1.0).sub(isRoof)).mul(T.float(1.0).sub(isCornice))
      .mul(T.float(1.0).sub(sashMask)).mul(T.float(1.0).sub(inACBox));

    const shopShelves = T.float(1.0).sub(T.step(0.76, T.fract(winUV.y.mul(3.0))).mul(0.32));
    const vertGrad = T.smoothstep(0.08, 0.92, winUV.y).mul(0.62).add(0.28);
    const shopEmit = bulbCol.mul(shopLit).mul(vertGrad).mul(shopShelves).mul(0.58);

    const viewDir = T.normalize(T.cameraPosition.sub(T.positionWorld));
    const fresnel = T.pow(T.clamp(T.float(1.0).sub(T.abs(T.dot(viewDir, T.normalWorldGeometry))), 0.0, 1.0), 1.8);
    const transmission = T.float(1.0).sub(fresnel.mul(0.82));
    const winEmit = T.mix(aptRoom.xyz.mul(aptRoom.w).mul(0.76), shopEmit, isGroundFloor).mul(transmission).mul(isWindow).mul(U.glow);

    // The lit hallway behind the entrance transom.
    const transomGlow = door.mul(filteredPulse(cellUV.x, 0.27, 0.73, fw.x)).mul(filteredPulse(cellUV.y, 0.67, 0.78, fw.y));
    const doorEmit = cWarmWindow.mul(transomGlow).mul(U.glow).mul(0.32);
    return winEmit.add(doorEmit);
  })());

  mat.name = opts.wallLocal ? 'physical:pre-war' : `physical:pre-war:${fixed}`;
  return mat;
}

export interface CurtainWallOptions {
  wallLocal: boolean;
  /** World layout: the glass tint token (required there); the wall-local layout takes the vertex colour (the glass class tones). */
  glass?: string;
  openSky?: OpenSkyInput;
}

/** Slop createCurtainWallMaterial with js/buildings.js `facades` row 3 parameters. */
export function createCurtainWallMaterial(THREE: Three, uniforms: PhysicalMaterialUniforms, opts: CurtainWallOptions): StdMat {
  const { T, c, hash2D, noise2D, bumpNormal, filteredPulse } = physicalTsl(THREE);
  const U = {
    sun: asTsl(uniforms.uSunColor), sunDir: asTsl(uniforms.uSkySunDir), skyTop: asTsl(uniforms.uSkyTopColor),
    skyHorizon: asTsl(uniforms.uSkyHorizonColor), glow: asTsl(uniforms.uInteriorGlow), bounce: asTsl(uniforms.uCanyonBounce),
  };
  const mat = new THREE.MeshStandardNodeMaterial({ metalness: CURTAIN_WALL.metalness, roughness: CURTAIN_WALL.roughness });
  const mullionThickness = CURTAIN_WALL.mullion;
  const spandrelRatio = CURTAIN_WALL.spandrel;
  if (!opts.wallLocal && !opts.glass) throw new Error('the world-grid curtain wall needs a glass colour');
  const cGlass = opts.wallLocal ? T.sRGBTransferEOTF(T.attribute('color', 'vec3')) : c(opts.glass!);
  const cFrame = c(CW.frame);
  const uSeed = T.float(63.5); // js/buildings.js facades row 3
  const uLitProbability = T.float(CURTAIN_WALL.litProbability);
  const uWarmth = T.float(CURTAIN_WALL.warmth);
  const uReflectivity = T.float(CURTAIN_WALL.reflectivity);
  const cWarmLight = c(CW.warmLight);
  const cCanyonBounce = c(PW.canyonBounce);

  mat.aoNode = asNode(canyonSkyAO(THREE, opts.openSky));

  const facade = opts.wallLocal
    ? facadeCell(THREE, { wallLocal: true })
    : facadeCell(THREE, { wallLocal: false, windowWidth: CURTAIN_WALL.windowWidth, floorHeight: CURTAIN_WALL.floorHeight });
  const { frame, isRoof, uCoord, vCoord, gridV, cellId, cellUV, fw, bayWidth, isGroundFloor, blank, tone, partial, coping, floorHeight } = facade;
  const winUV = T.clamp(
    T.vec2(
      cellUV.x.sub(mullionThickness).div(Math.max(0.01, 1.0 - 2.0 * mullionThickness)),
      cellUV.y.sub(spandrelRatio).div(Math.max(0.01, 1.0 - spandrelRatio - mullionThickness)),
    ),
    T.vec2(0.0),
    T.vec2(1.0),
  );
  const aptRoom = apartmentInterior(THREE, frame, {
    u: uCoord, v: vCoord, winUV, cellId, bayWidth, floorHeight, seed: uSeed, warmth: uWarmth,
    litProbability: uLitProbability.mul(CURTAIN_WALL.litShareScale), fw,
  });
  const shopLit = T.step(0.24, hash2D(cellId.add(T.vec2(uSeed, 19.4))));
  const floorIdx = T.floor(gridV);
  const isMechFloor = T.float(1.0).sub(T.step(1.0, T.mod(floorIdx.add(uSeed), 16.0))).mul(T.step(4.0, floorIdx));

  mat.colorNode = asColorNode(T.Fn(() => {
    // No glass in a storey the wall cuts short, nor behind the coping.
    const isGlassPane = filteredPulse(cellUV.x, mullionThickness * 0.5, 1.0 - mullionThickness * 0.5, fw.x)
      .mul(filteredPulse(cellUV.y, spandrelRatio + 0.015, 1.0 - mullionThickness * 0.5, fw.y))
      .mul(T.float(1.0).sub(isRoof)).mul(T.float(1.0).sub(partial)).mul(T.float(1.0).sub(coping));
    const louverStripes = T.sin(vCoord.mul(22.0)).mul(0.5).add(0.5);

    // Per-pane warble: each pane bows a little, so reflections break up pane by pane.
    const paneRandX = hash2D(cellId.add(T.vec2(uSeed, 3.7))).sub(0.5);
    const paneRandY = hash2D(cellId.add(T.vec2(11.3, uSeed))).sub(0.5);
    const pillowBowX = cellUV.x.sub(0.5).mul(0.11).add(paneRandX.mul(0.09));
    const pillowBowY = cellUV.y.sub(0.55).mul(0.11).add(paneRandY.mul(0.09));
    const sunDir = T.normalize(U.sunDir);
    const viewDir = T.normalize(T.cameraPosition.sub(T.positionWorld));
    const nPane = T.normalize(T.normalWorldGeometry.add(T.vec3(pillowBowX, pillowBowY, pillowBowX.negate())));
    const reflectDir = T.reflect(viewDir.negate(), nPane);
    const fresnel = T.pow(T.clamp(T.float(1.0).sub(T.abs(T.dot(viewDir, nPane))), 0.0, 1.0), 2.1);
    const reflectElev = T.clamp(reflectDir.y.mul(0.65).add(0.38), 0.0, 1.0);

    // A reflected skyline of neighbouring towers, its edge and window grid filtered by their screen footprint.
    const refAzimuth = uCoord.mul(0.045).add(reflectDir.x.mul(3.8)).add(reflectDir.z.mul(3.8));
    const neighborTowerH = hash2D(T.vec2(T.floor(refAzimuth.mul(2.4)), uSeed)).mul(0.46).add(0.16);
    const elevAA = T.fwidth(reflectElev).add(0.004);
    const inReflectedTower = T.smoothstep(neighborTowerH.add(elevAA), neighborTowerH.sub(elevAA), reflectElev);
    const refCols = refAzimuth.mul(15.0);
    const refRows = reflectElev.mul(30.0);
    const refWinGrid = filteredPulse(T.fract(refCols), 0.32, 1.0, T.fwidth(refCols)).mul(filteredPulse(T.fract(refRows), 0.32, 1.0, T.fwidth(refRows)));
    const reflectedBuildingCol = T.mix(c(CW.reflectedTower), c(CW.reflectedWindow), refWinGrid.mul(0.42).mul(U.glow));
    const skyReflect = T.mix(U.skyHorizon, U.skyTop, T.clamp(reflectElev.mul(1.4), 0.0, 1.0));
    const envReflection = T.mix(skyReflect, reflectedBuildingCol, inReflectedTower.mul(0.62));
    const sunSpec = T.pow(T.max(T.dot(reflectDir, sunDir), 0.0), 48.0).mul(1.25);

    const pooledDirt = T.float(1.0).sub(T.smoothstep(spandrelRatio, spandrelRatio + 0.22, cellUV.y)).mul(0.32);
    const grime = T.float(0.56).add(pooledDirt).clamp(0.0, 0.92);
    const shopShelves = T.float(1.0).sub(T.step(0.78, T.fract(winUV.y.mul(3.0))).mul(0.35));
    const shopTransomGlow = T.step(0.76, winUV.y).mul(0.35).add(0.65);
    const shopInterior = cWarmLight.mul(shopShelves).mul(shopTransomGlow).mul(T.mix(T.float(0.28), T.float(0.88), shopLit));
    const shopBase = T.mix(cGlass, shopInterior, T.float(0.56).mul(T.float(1.0).sub(pooledDirt)));
    const upperGlazed = T.mix(aptRoom.xyz.mul(c(PW.glazeTint)), cGlass, grime);
    const glazedBase = T.mix(upperGlazed, shopBase, isGroundFloor);
    const glassColor = T.mix(glazedBase, envReflection, fresnel.mul(uReflectivity).add(0.18)).add(U.sun.mul(sunSpec));

    const spandrelDark = cFrame.mul(0.52);
    const frameBase = T.mix(cFrame, spandrelDark, filteredPulse(cellUV.y, 0.0, spandrelRatio, fw.y));
    const canyonBand = T.smoothstep(0.0, 14.0, vCoord).mul(T.float(1.0).sub(T.smoothstep(22.0, 75.0, vCoord)));
    const canyonGlow = cCanyonBounce.mul(canyonBand.mul(U.bounce).mul(0.16));
    const roofNoise = noise2D(T.positionWorld.xz.mul(0.35));
    const roofColor = T.mix(c(CW.roofA), c(CW.roofB), roofNoise);

    const facadeCol = T.mix(frameBase, glassColor, isGlassPane.mul(T.float(1.0).sub(isMechFloor))).add(canyonGlow);
    const mechCol = T.mix(cFrame.mul(0.36), cFrame.mul(0.76), louverStripes);
    const finalWall = T.mix(facadeCol, mechCol, isMechFloor.mul(T.float(1.0).sub(isRoof)));

    // Windowless lot-line walls: weathered precast panels, one per bay and storey.
    const panelJoint = T.max(filteredPulse(cellUV.x, 0.0, 0.025, fw.x), filteredPulse(cellUV.y, 0.0, 0.03, fw.y));
    const panelStain = noise2D(T.vec2(uCoord.mul(0.9), vCoord.mul(0.04))).mul(T.float(1.0).sub(T.smoothstep(0.4, 1.2, T.fwidth(uCoord))));
    const panelCol = T.mix(c(CW.panelA), c(CW.panelB), tone).mul(panelStain.mul(0.16).add(0.9)).mul(T.float(1.0).sub(panelJoint.mul(0.3)));
    const withBlank = T.mix(finalWall, panelCol.add(canyonGlow), blank);
    // Brushed-aluminium coping capping every wall.
    const withCap = T.mix(withBlank, T.mix(cFrame, c(CW.coping), 0.45), coping);
    return T.mix(withCap, roofColor, isRoof);
  })());

  mat.roughnessNode = asNode(T.Fn(() => {
    const isFrame = T.float(1.0).sub(
      filteredPulse(cellUV.x, mullionThickness, 1.0 - mullionThickness, fw.x).mul(filteredPulse(cellUV.y, spandrelRatio, 1.0, fw.y)),
    );
    const sillDirt = T.float(1.0).sub(T.smoothstep(spandrelRatio, spandrelRatio + 0.18, cellUV.y)).mul(0.18);
    const glassOrFrame = T.mix(T.float(0.05).add(sillDirt), T.float(0.54), T.max(T.max(isFrame, isRoof), partial));
    return T.mix(T.mix(glassOrFrame, T.float(0.36), coping), T.float(0.88), blank);
  })());

  // Glass and metal, except the concrete lot-line walls.
  mat.metalnessNode = asNode(T.mix(T.float(CURTAIN_WALL.metalness), T.float(0.0), blank));

  mat.normalNode = asNode(T.Fn(() => {
    const camDist = T.length(T.positionWorld.sub(T.cameraPosition));
    const detailFade = T.float(1.0).sub(T.smoothstep(CURTAIN_WALL.detailNear, CURTAIN_WALL.detailFar, camDist)).mul(T.float(1.0).sub(isRoof))
      .mul(T.float(1.0).sub(T.smoothstep(0.03, 0.1, T.max(fw.x, fw.y))));
    const ramp = fw.mul(2.0).max(0.02);
    const inPane = filteredPulse(cellUV.x, mullionThickness + 0.01, 0.99 - mullionThickness, ramp.x)
      .mul(filteredPulse(cellUV.y, spandrelRatio + 0.01, 0.99 - mullionThickness, ramp.y))
      .mul(T.float(1.0).sub(partial)).mul(T.float(1.0).sub(coping));
    const mullionRelief = T.float(1.0).sub(inPane).mul(0.014).mul(T.float(1.0).sub(blank)).add(coping.mul(0.01));
    return bumpNormal(mullionRelief.mul(detailFade));
  })());

  mat.emissiveNode = asNode(T.Fn(() => {
    const inPane = filteredPulse(cellUV.x, mullionThickness + 0.015, 1.0 - mullionThickness - 0.015, fw.x)
      .mul(filteredPulse(cellUV.y, spandrelRatio + 0.02, 1.0 - mullionThickness * 0.5, fw.y));
    const paneMask = inPane.mul(T.float(1.0).sub(isRoof)).mul(T.float(1.0).sub(isMechFloor)).mul(T.float(1.0).sub(blank))
      .mul(T.float(1.0).sub(partial)).mul(T.float(1.0).sub(coping));
    const shopShelves = T.float(1.0).sub(T.step(0.78, T.fract(winUV.y.mul(3.0))).mul(0.32));
    const shopEmit = cWarmLight.mul(shopLit).mul(shopShelves).mul(0.62);
    const emitCol = T.mix(aptRoom.xyz.mul(aptRoom.w), shopEmit, isGroundFloor);
    const viewDir = T.normalize(T.cameraPosition.sub(T.positionWorld));
    const fresnel = T.pow(T.clamp(T.float(1.0).sub(T.abs(T.dot(viewDir, T.normalWorldGeometry))), 0.0, 1.0), 2.0);
    const transmission = T.float(1.0).sub(fresnel.mul(0.75));
    return emitCol.mul(transmission).mul(paneMask).mul(U.glow).mul(0.72);
  })());

  mat.name = 'physical:curtain-wall';
  return mat;
}
