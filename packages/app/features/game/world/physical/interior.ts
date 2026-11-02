// Adapted from mrdoob/slop-newyork @ be65d0a, js/tsl-materials.js evaluateApartmentInterior (MIT, © 2026 Mr.doob)
// Slop models it on interior() in three's examples/jsm/generators/city/SkyscraperGenerator.js
// (MIT, three.js authors), and the room box follows Joost van Dongen's
// Interior Mapping (2008).
//
// 3D interior mapping behind upper-floor windows. Each room spans a whole
// 2 or 3 window bays (so partition walls land behind piers), one storey
// tall and 1.55 storeys deep, set 0.12 m behind the glass. The ray from the
// camera is intersected with the room box in true metres, so perspective
// holds from every angle. Drapes hang just inside each window and pass only
// a fifth of the room's glow. Once a window is a pixel or two (`fw`, the
// pixel footprint in cells), rooms settle to the mean lit level, drapes to
// their mean coverage and lamps fade, so distant towers do not twinkle.
//
// While EXPO_PUBLIC_WORLD_PHYSICAL is on this replaces the glass.ts room
// layer: the facade materials evaluate it inside their own colour and
// emissive graphs, once per pixel.
import type { Three } from '@acme/ui/three';
import { physicalCityMaterials } from '@acme/theme';
import type { TslNode } from './loose-tsl.ts';
import { INTERIOR } from '../physical-materials-constants.ts';
import { roomRay, type FacadeFrame } from './facade-frame.ts';
import { physicalTsl } from './tsl-common.ts';

const ROOM = physicalCityMaterials.interior;
const DRAPE = physicalCityMaterials.drapes;

export interface ApartmentInteriorInputs {
  /** Metres along the wall and up it. */
  u: TslNode;
  v: TslNode;
  /** 0..1 inside the window opening (y = 0 at the sill). */
  winUV: TslNode;
  /** Bay and floor index of the window cell. */
  cellId: TslNode;
  /** Bay width and floor height, m. */
  bayWidth: TslNode;
  floorHeight: TslNode;
  /** Per-style or per-building seed. */
  seed: TslNode;
  /** Share of warm bulbs, 0..1. */
  warmth: TslNode;
  /** Share of lit rooms, 0..1. */
  litProbability: TslNode;
  /** Pixel footprint in cells (fwidth of the grid coordinates). */
  fw: TslNode;
}

/** Slop evaluateApartmentInterior: `vec4(roomColour, litEmit)`. */
export function apartmentInterior(THREE: Three, frame: FacadeFrame, inputs: ApartmentInteriorInputs): TslNode {
  const { T } = physicalTsl(THREE);
  // One Fn call, as Slop's: every output that reads the room shares a single evaluation.
  return T.Fn(() => roomBody(THREE, frame, inputs))();
}

function roomBody(THREE: Three, frame: FacadeFrame, inputs: ApartmentInteriorInputs): TslNode {
  const { T, c, hash2D } = physicalTsl(THREE);
  const u = T.float(inputs.u).toVar();
  const v = T.float(inputs.v).toVar();
  const wUV = T.vec2(inputs.winUV).toVar();
  const cid = T.vec2(inputs.cellId).toVar();
  const wW = T.float(inputs.bayWidth).toVar();
  const fH = T.float(inputs.floorHeight).toVar();
  const seedNode = inputs.seed;
  const fwNode = inputs.fw;

  // Room module: an integer 2 or 3 bays wide with an integer bay phase per
  // floor, so partition walls always land behind piers, never mid-window.
  const floorIdx = T.floor(v.div(fH)).toVar();
  const fHash1 = T.fract(T.sin(floorIdx.mul(41.3).add(seedNode)).mul(43758.5453));
  const fHash2 = T.fract(T.sin(floorIdx.mul(73.7).add(seedNode.mul(1.7))).mul(43758.5453));
  const roomBays = T.mix(T.float(2.0), T.float(3.0), T.step(0.5, fHash1)).toVar();
  const roomPhase = T.floor(fHash2.mul(roomBays)).toVar();

  const gridU = u.div(wW);
  const roomU = gridU.add(roomPhase).div(roomBays).toVar();
  const roomIdx = T.floor(roomU).toVar();
  const roomId = T.vec2(roomIdx, floorIdx).toVar();

  const roomW = wW.mul(roomBays).toVar();
  const roomH = fH.mul(INTERIOR.roomHeightShare).toVar();
  const setback = T.float(INTERIOR.setbackMeters);
  const depth = roomH.mul(INTERIOR.depthPerHeight).toVar();

  // Entry point in metres from the room centre: sill ~0.75 m above the floor, lintel ~0.58 m below the ceiling.
  const originX = T.fract(roomU).sub(0.5).mul(roomW).toVar();
  const originY = wUV.y.sub(0.46).mul(roomH.mul(0.62)).toVar();

  const { dirX, dirY, dirZ } = roomRay(THREE, frame);

  // Slab test against the far planes of the room box.
  const halfW = roomW.mul(0.5).toVar();
  const halfH = roomH.mul(0.5).toVar();
  const tFarX = halfW.sub(originX.mul(T.sign(dirX))).div(T.max(T.abs(dirX), 0.0001)).toVar();
  const tFarY = halfH.sub(originY.mul(T.sign(dirY))).div(T.max(T.abs(dirY), 0.0001)).toVar();
  const tFarZ = setback.add(depth).div(dirZ).toVar();
  const t = T.min(T.min(tFarX, tFarY), tFarZ).toVar();
  const hit = T.vec3(originX.add(dirX.mul(t)), originY.add(dirY.mul(t)), dirZ.mul(t)).toVar();

  const q = T.clamp(
    T.vec3(hit.x.div(roomW).add(0.5), hit.y.div(roomH).add(0.5), hit.z.sub(setback).div(depth)),
    T.vec3(0.0),
    T.vec3(1.0),
  ).toVar();

  const onBack = T.step(tFarZ, tFarX).mul(T.step(tFarZ, tFarY)).toVar();
  const isYPlane = T.step(tFarY, tFarX).mul(T.step(tFarY, tFarZ)).toVar();
  const onCeil = isYPlane.mul(T.step(0.0, dirY)).toVar();
  const onFloor = isYPlane.mul(T.float(1.0).sub(T.step(0.0, dirY))).toVar();

  // Per-room hashes and bulb temperature.
  const seed1 = hash2D(roomId.add(T.vec2(seedNode, 19.4))).toVar();
  const seed2 = hash2D(roomId.add(T.vec2(seedNode.mul(1.9), 83.1))).toVar();
  const seed3 = hash2D(roomId.add(T.vec2(63.2, seedNode.mul(0.7)))).toVar();
  const lod = T.smoothstep(INTERIOR.lodStart, INTERIOR.lodEnd, T.max(fwNode.x, fwNode.y)).toVar();
  const litRoom = T.step(T.float(1.0).sub(inputs.litProbability), seed3).toVar();
  const lit = T.mix(litRoom, 1.0, lod).toVar();

  const warmLight = T.mix(c(ROOM.bulbWarmA), c(ROOM.bulbWarmB), seed1);
  const coolLight = T.mix(c(ROOM.bulbCoolA), c(ROOM.bulbCoolB), seed2);
  const lightCol = T.mix(coolLight, warmLight, T.step(T.float(1.0).sub(inputs.warmth), seed2)).toVar();

  // Room shell: plaster walls with a skirting board, floorboards and a rug, ceiling lamp, back-wall door and a picture.
  const wallBase = T.mix(T.mix(c(ROOM.plasterA), c(ROOM.plasterB), seed1), c(ROOM.plasterC), seed2.mul(0.6)).toVar();
  const wallCol = T.mix(wallBase, wallBase.mul(0.5), T.smoothstep(0.06, 0.04, q.y)).toVar();

  const seam = T.step(0.92, T.fract(q.x.mul(7.0)));
  const boards = T.mix(c(ROOM.boardsA), c(ROOM.boardsB), seed1).mul(T.float(1.0).sub(seam.mul(0.3)));
  const rug = T.mix(c(ROOM.rugA), c(ROOM.rugB), seed2);
  const inRug = T.step(T.abs(q.x.sub(0.5)), 0.28).mul(T.step(T.abs(q.z.sub(0.58)), 0.25));
  const floorCol = T.mix(boards, rug, inRug.mul(0.88)).toVar();

  const lamp = T.smoothstep(0.18, 0.11, T.length(T.vec2(q.x.sub(0.5), q.z.sub(0.5)))).mul(T.float(1.0).sub(lod));
  const ceilBase = T.mix(wallBase, c(ROOM.ceiling), 0.28);
  const ceilCol = T.mix(ceilBase, lightCol.mul(T.mix(T.float(0.85), T.float(3.8), lit)), lamp).toVar();

  const doorX = T.mix(T.float(0.24), T.float(0.76), seed1);
  const doorCol = T.mix(c(ROOM.doorA), c(ROOM.doorB), T.step(0.5, seed2));
  const inDoor = T.step(T.abs(q.x.sub(doorX)), 0.09).mul(T.step(T.abs(q.y.sub(0.34)), 0.34));
  const picX = T.mix(T.float(0.72), T.float(0.28), T.step(0.5, seed1));
  const inPicFrame = T.step(T.abs(q.x.sub(picX)), 0.085).mul(T.step(T.abs(q.y.sub(0.56)), 0.095));
  const inPicCanvas = T.step(T.abs(q.x.sub(picX)), 0.065).mul(T.step(T.abs(q.y.sub(0.56)), 0.075));
  const picCol = T.mix(c(ROOM.pictureA), c(ROOM.pictureB), T.fract(seed1.add(seed2)));
  const backWithDoor = T.mix(wallCol, doorCol, inDoor);
  const backWithFrame = T.mix(backWithDoor, c(ROOM.pictureFrame), inPicFrame);
  const backCol = T.mix(backWithFrame, picCol, inPicCanvas).toVar();

  const shellCol = T.mix(T.mix(T.mix(wallCol, floorCol, onFloor), ceilCol, onCeil), backCol, onBack).toVar();

  // Soft corner occlusion and depth falloff.
  const edge = (x: TslNode) => T.smoothstep(0.0, 0.16, x).mul(T.smoothstep(0.0, 0.16, T.float(1.0).sub(x)));
  const aoX = edge(q.x).toVar();
  const aoY = edge(q.y).toVar();
  const aoZ = edge(q.z).toVar();
  const edgeAO = T.mix(T.mix(aoY.mul(aoZ), aoX.mul(aoZ), isYPlane), aoX.mul(aoY), onBack);
  const shellAO = T.mix(T.float(0.66), T.float(1.0), edgeAO);
  const falloff = T.mix(T.float(1.0), T.float(0.42), q.z);
  const shadedRoom = shellCol.mul(shellAO).mul(falloff).toVar();

  // Drapes just inside the glass, shifted by parallax onto their plane.
  const cUVx = T.clamp(wUV.x.add(dirX.div(dirZ).mul(0.06)), 0.0, 1.0).toVar();
  const wSeed1 = hash2D(cid.add(T.vec2(seedNode.mul(0.8), 41.2))).toVar();
  const wSeed2 = hash2D(cid.add(T.vec2(17.9, seedNode.mul(1.3)))).toVar();
  const sL = T.smoothstep(0.18, 1.0, wSeed1);
  const sR = T.smoothstep(0.18, 1.0, wSeed2);
  const lw = sL.mul(sL).mul(0.48);
  const rw = sR.mul(sR).mul(0.48);
  // Drape edges widen to the pixel footprint; pleats fade to their mean once they would shrink below a few pixels.
  const cFw = T.fwidth(cUVx).toVar();
  const drapeAA = cFw.add(0.015).toVar();
  const inLeftDrape = T.smoothstep(lw.add(drapeAA), lw.sub(drapeAA), cUVx).mul(T.step(0.03, lw));
  const inRightDrape = T.smoothstep(T.float(1.0).sub(rw).sub(drapeAA), T.float(1.0).sub(rw).add(drapeAA), cUVx).mul(T.step(0.03, rw));
  const inDrape = T.mix(T.clamp(T.max(inLeftDrape, inRightDrape), 0.0, 1.0), INTERIOR.meanDrape, lod).toVar();

  const pick = T.fract(seed1.mul(5.7)).mul(5.0);
  const sw0 = T.mix(c(DRAPE.creamA), c(DRAPE.creamB), seed2);
  const sw1 = T.mix(c(DRAPE.taupeA), c(DRAPE.taupeB), seed2);
  const sw2 = T.mix(c(DRAPE.greyA), c(DRAPE.greyB), seed2);
  const sw3 = T.mix(c(DRAPE.sageA), c(DRAPE.sageB), seed2);
  const sw4 = T.mix(c(DRAPE.terracottaA), c(DRAPE.terracottaB), seed2);
  const fabric = T.mix(
    T.mix(T.mix(T.mix(sw0, sw1, T.step(1.0, pick)), sw2, T.step(2.0, pick)), sw3, T.step(3.0, pick)),
    sw4,
    T.step(4.0, pick),
  );
  const pleatWave = T.sin(cUVx.mul(48.0).add(wSeed1.mul(6.28))).mul(T.float(1.0).sub(T.smoothstep(0.6, 1.6, cFw.mul(48.0))));
  const pleat = pleatWave.mul(0.205).add(0.945);
  const drapeCol = fabric.mul(pleat).mul(0.92).toVar();

  // A drape passes only a little of the room's glow, never out-glowing the interior.
  const bestCol = T.mix(shadedRoom, drapeCol, inDrape);
  const bestEmit = T.mix(T.float(1.0), T.float(INTERIOR.drapeTransmit), inDrape);
  const roomWarmth = T.mix(T.vec3(1.0), lightCol, lit.mul(0.85));
  const finalRoomCol = bestCol.mul(roomWarmth).mul(T.mix(T.float(0.85), T.float(1.35), lit));

  return T.vec4(finalRoomCol, T.mix(litRoom, inputs.litProbability, lod).mul(bestEmit));
}
