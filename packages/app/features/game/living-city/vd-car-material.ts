// The moving-fleet material for Valdrada's baked bodies (world/vd-car-mesh.ts)
// on the vd lane. Every baked body shares this one MeshStandardNodeMaterial:
// the geometry carries the look (sRGB vertex colour sampled from the CARLA
// detail atlases, `partId` in lofted-car.ts CAR_PARTS numbering), and the
// instance carries the state, in the lofted fleet's layout
// (LOFTED_INSTANCE_ATTRIBUTES):
//
//   paintColor  vec3  body paint, linear RGB; replaces the -1 paint marker
//   carState    vec4  x brake, y left (+x) indicator lit, z right (-x) lit
//   vdXform     vec4  the pose (world/vd-instanced.ts), read by positionNode
//
// Glass is the lofted glass tint under a low roughness, so it reads dark and
// takes the environment. Lamps light by part: FRONT burns the head beam on
// the night ramp, REAR the tail at night and the brake on carState.x, and the
// outboard half of either cluster flashes amber with the indicator on its
// side. A SIGN part (a roof lamp above the cab's roof line) burns the taxi
// sign colour. Colours are @acme/theme tokens.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { physicalVehicles } from '@acme/theme';
import { VD_CAR_PARTS } from '../world/vd-car-mesh.ts';
import { vdXformPositionNode } from '../world/vd-instanced.ts';
import { CAR_LAMP_LEVEL, NIGHT_HEADLAMP_GLOW } from './vehicle-physical-constants.ts';

type F = Node<'float'>;
type StdMat = InstanceType<Three['MeshStandardNodeMaterial']>;

/** |x| (m) past which a lamp cluster counts as its outboard indicator section. */
export const VD_INDICATOR_X = 0.6;

export function createVdCarMaterial(THREE: Three, options: { readonly glow: F }): StdMat {
  const T = THREE.TSL;
  const col = (hex: string) => T.color(new THREE.Color().setStyle(hex));
  const C = physicalVehicles.car;
  const V = physicalVehicles.lamp;
  const vertex = T.attribute<'vec3'>('color', 'vec3');
  const partId = T.attribute<'float'>('partId', 'float');
  const paint = T.attribute<'vec3'>('paintColor', 'vec3');
  const state = T.attribute<'vec4'>('carState', 'vec4');
  const p = T.attribute<'vec3'>('position', 'vec3');
  const n = T.attribute<'vec3'>('normal', 'vec3');
  const px = p.x as F;
  const one = T.float(1);
  const isPart = (id: number) => T.step(T.abs(partId.sub(id)), 0.25) as F;
  const isWindow = isPart(VD_CAR_PARTS.WINDOW);
  const isTyre = isPart(VD_CAR_PARTS.TYRE);
  const isAlloy = isPart(VD_CAR_PARTS.ALLOY);
  const isFront = isPart(VD_CAR_PARTS.FRONT);
  const isRear = isPart(VD_CAR_PARTS.REAR);
  const isSign = isPart(VD_CAR_PARTS.SIGN);
  const isPaint = T.step(vertex.x, -0.5) as F;
  const lamp = T.max(T.max(isFront, isRear), isSign) as F;

  // Vertex colour is display sRGB: back to linear for the lit model. Paint takes the instance colour.
  const baked = T.pow(T.max(vertex, T.vec3(0)), T.vec3(2.2));
  const glass = T.mix(col(C.glassLow), col(C.glassHigh), T.smoothstep(0.2, 0.9, n.y));
  let colour = T.mix(baked, paint, isPaint) as Node<'vec3'>;
  colour = T.mix(colour, glass, isWindow) as Node<'vec3'>;
  const material = new THREE.MeshStandardNodeMaterial();
  material.name = 'living-city:vd-car';
  material.positionNode = vdXformPositionNode(THREE);
  // Double-sided: the clustered `mid` level leaves small gaps in a panel, and through one the far panel's inside
  // reads as body, not as street (world/vd-car-draw.test.ts).
  material.side = THREE.DoubleSide;
  material.colorNode = colour;

  let rough = T.float(0.6) as F;
  rough = T.mix(rough, T.float(0.26), isPaint) as F;
  rough = T.mix(rough, T.float(0.06), isWindow) as F;
  rough = T.mix(rough, T.float(0.85), isTyre) as F;
  rough = T.mix(rough, T.float(0.3), isAlloy) as F;
  rough = T.mix(rough, T.float(0.15), lamp) as F;
  material.roughnessNode = rough;
  let metal = T.float(0.1) as F;
  metal = T.mix(metal, T.float(0.34), isPaint) as F;
  metal = T.mix(metal, T.float(0.5), isWindow) as F;
  metal = T.mix(metal, T.float(0.04), isTyre) as F;
  metal = T.mix(metal, T.float(0.86), isAlloy) as F;
  metal = T.mix(metal, T.float(0.6), lamp) as F;
  material.metalnessNode = metal;

  const night = T.smoothstep(NIGHT_HEADLAMP_GLOW[0], NIGHT_HEADLAMP_GLOW[1], options.glow) as F;
  const brake = state.x as F;
  const blink = T.max(state.y.mul(T.step(0, px)), state.z.mul(T.step(px, 0))) as F;
  const outboard = T.step(VD_INDICATOR_X, T.abs(px)) as F;
  const turn = outboard.mul(blink) as F;
  const head = col(V.headBeam).mul(isFront.mul(night).mul(CAR_LAMP_LEVEL.headLens).mul(one.sub(turn)));
  const tail = col(V.brake).mul(isRear.mul(brake.mul(CAR_LAMP_LEVEL.brake).add(night.mul(CAR_LAMP_LEVEL.nightTail))).mul(one.sub(turn)));
  const amber = col(V.turn).mul(T.max(isFront, isRear).mul(turn).mul(CAR_LAMP_LEVEL.turn));
  const sign = col(V.taxiSign).mul(isSign.mul(CAR_LAMP_LEVEL.taxiSign));
  material.emissiveNode = head.add(tail).add(amber).add(sign);
  return material;
}
