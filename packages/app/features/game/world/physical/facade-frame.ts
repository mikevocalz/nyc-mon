// Adapted from mrdoob/slop-newyork @ be65d0a, js/tsl-materials.js facadeNormalVertex / facadeWorldNormal / facadeAlongZ, facadeCell and evaluateApartmentInterior (MIT, © 2026 Mr.doob)
//
// The camera-independent facade frame. Reading the wall's dominant axis
// from the view-space normal round trip lets a 45-degree wall flip its
// window grid between world x and z as the camera turns. Slop resolves the
// tie once in the vertex shader and passes the choice flat across each
// face; this file keeps that code verbatim so tests/facade-projection's
// fixtures still hold (physical/facade-frame.test.ts runs these functions
// against a numeric stand-in for THREE.TSL, as Slop's test does).
//
// three@0.186.1: InterpolationSamplingType.FLAT and
// InterpolationSamplingMode.EITHER (src/constants.js), VaryingNode
// setInterpolation (src/nodes/core/VaryingNode.js), and the TSL names
// normalize, modelNormalMatrix, normalLocal, varying, step, abs, mix,
// positionWorld, cameraPosition, sign, dot, vec3, max (build/three.tsl.js).
import type { Three } from '@acme/ui/three';
import { looseTsl, type TslNode } from './loose-tsl.ts';

/** Slop facadeWorldNormal / facadeAlongZ: the world wall normal and its flat x-or-z choice (1 = the wall runs along z). */
export interface FacadeFrame {
  normal: TslNode;
  alongZ: TslNode;
}

type Interp = Pick<Three, 'InterpolationSamplingType' | 'InterpolationSamplingMode'>;
/** Just what the frame reads from the three module, so a numeric stand-in can run it (facade-frame.test.ts). */
export type FrameThree = Interp & Pick<Three, 'TSL'>;

export function facadeFrame(THREE: FrameThree): FacadeFrame {
  const T = looseTsl(THREE);
  const facadeNormalVertex = T.normalize(T.modelNormalMatrix.mul(T.normalLocal));
  const normal = T.varying(facadeNormalVertex, 'vFacadeWorldNormal').normalize();
  const alongZ = T.varying(
    T.step(T.abs(facadeNormalVertex.z).sub(0.0001), T.abs(facadeNormalVertex.x)),
    'vFacadeAlongZ',
  ).setInterpolation(THREE.InterpolationSamplingType.FLAT, THREE.InterpolationSamplingMode.EITHER);
  return { normal, alongZ };
}

/**
 * The head of Slop's facadeCell: which wall a fragment is on and the world
 * coordinate its window grid runs along. `wallLocal` is Slop's `boxLocal`:
 * the wall is told apart by its own geometry normal rather than the frame.
 */
export function facadeProjection(THREE: FrameThree, frame: FacadeFrame, wallLocal: boolean, patternWorld?: TslNode): { nWall: TslNode; alongZ: TslNode; uCoord: TslNode; isRoof: TslNode } {
  const T = looseTsl(THREE);
  const nWall = wallLocal ? T.normalGeometry : frame.normal;
  const nW = T.abs(nWall);
  const isRoof = T.step(0.75, nW.y);
  const alongZ = wallLocal ? T.step(nW.z, nW.x) : frame.alongZ;
  const wp = patternWorld ?? T.positionWorld;
  const uCoord = T.mix(wp.x, wp.z, alongZ);
  return { nWall, alongZ, uCoord, isRoof };
}

/**
 * The view ray in the room's (across, up, depth) frame, from Slop's
 * evaluateApartmentInterior. `across` runs along the wall's tangent and
 * turns with walls that follow a non-grid street.
 */
export function roomRay(THREE: FrameThree, frame: FacadeFrame): { dirX: TslNode; dirY: TslNode; dirZ: TslNode } {
  const T = looseTsl(THREE);
  const facadeWorldNormal = frame.normal;
  const facadeAlongZ = frame.alongZ;
  const rayWorld = T.normalize(T.positionWorld.sub(T.cameraPosition)).toVar();
  const tSign = T.mix(T.sign(facadeWorldNormal.z).negate(), T.sign(facadeWorldNormal.x), facadeAlongZ);
  const dirX = T.dot(rayWorld, T.vec3(facadeWorldNormal.z.negate(), 0.0, facadeWorldNormal.x).mul(tSign)).toVar();
  const dirY = rayWorld.y.toVar();
  const dirZ = T.max(T.abs(T.dot(rayWorld, facadeWorldNormal)), 0.05).toVar();
  return { dirX, dirY, dirZ };
}
