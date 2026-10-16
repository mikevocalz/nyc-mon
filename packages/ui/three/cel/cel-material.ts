// Ported from the dsts-viewer cel shader (nuffle.me/dsts-viewer), a recreation of Digimon Story: Time Stranger's body shader.
//
// The bridge: one rig of uniforms per scene, and a MeshBasicNodeMaterial per
// surface whose colour is cel-shading.ts's celBody, run through
// @typegpu/three. The material is unlit as far as three is concerned (the
// rig replaces three's lights, as dsts-viewer's does), so scene fog still
// applies after it, and alphaTest / opacityNode still cut leaves.
//
// The kit's vertex shader only carries world normal, world position and the
// view vector here; three's normalWorld, positionWorld and cameraPosition
// supply them. Its skinning, UV routing and effect varyings have no city use.
import * as t3 from '@typegpu/three';
import { d, std } from 'typegpu';
import type { Node } from 'three/webgpu';
import type { Three } from '../types.ts';
import { celBody, evalSH9 } from './cel-shading.ts';

type Vec3 = readonly [number, number, number];

export interface CelLight {
  /** Towards the light; any length. */
  dir: Vec3;
  /** Linear rgb, intensity folded in. */
  color: Vec3;
}

export interface CelRigValues {
  key: CelLight;
  fill1: CelLight;
  fill2: CelLight;
  /** Nine SH coefficients, linear rgb, in the kit's order. */
  sh: readonly Vec3[];
  /** The kit's uShScale. Default 1. */
  shScale?: number;
  /** The kit's uFill, a flat add. Default black. */
  flat?: Vec3;
  /** The ramp stand-in: shadow/mid edge, mid/lit edge, step half-width, all in ramp u. */
  ramp: readonly [number, number, number];
  /** Shadow, mid and lit levels of the ramp. */
  bands: readonly [number, number, number];
  /** The fills' ramp tint (the kit's cool CLUT, as a colour). */
  cool: Vec3;
  rimColor: Vec3;
  /** innerGrowA's (exponent, scale, mode). */
  rimBase: Vec3;
  /** Key self-shadow, 1 = lit. No shadow maps on react-native-webgpu, so 1. */
  shadow?: number;
}

/** Shared uniforms for every cel material in a scene. `set` updates them all at once. */
export function createCelRig(THREE: Three, values: CelRigValues) {
  const T = THREE.TSL;
  const v4 = () => T.uniform(new THREE.Vector4(), 'vec4');
  const v3 = () => T.uniform(new THREE.Vector3(), 'vec3');
  const nodes = {
    key: v4(), keyColor: v4(), fill1: v4(), fill1Color: v4(), fill2: v4(), fill2Color: v4(),
    ramp: v4(), bands: v4(), cool: v4(), rimColor: v4(), rimBase: v4(), flat: v4(),
    sh: [v3(), v3(), v3(), v3(), v3(), v3(), v3(), v3(), v3()] as const,
  };
  const put = (node: ReturnType<typeof v4>, x: number, y: number, z: number, w = 0) => {
    (node.value as InstanceType<Three['Vector4']>).set(x, y, z, w);
  };
  const set = (v: CelRigValues) => {
    put(nodes.key, ...v.key.dir, v.shadow ?? 1);
    put(nodes.keyColor, ...v.key.color);
    put(nodes.fill1, ...v.fill1.dir);
    put(nodes.fill1Color, ...v.fill1.color);
    put(nodes.fill2, ...v.fill2.dir);
    put(nodes.fill2Color, ...v.fill2.color);
    put(nodes.ramp, ...v.ramp);
    put(nodes.bands, ...v.bands);
    put(nodes.cool, ...v.cool);
    put(nodes.rimColor, ...v.rimColor);
    put(nodes.rimBase, ...v.rimBase);
    put(nodes.flat, ...(v.flat ?? [0, 0, 0]), v.shScale ?? 1);
    nodes.sh.forEach((node, i) => {
      const c = v.sh[i] ?? [0, 0, 0];
      (node.value as InstanceType<Three['Vector3']>).set(c[0], c[1], c[2]);
    });
  };
  set(values);
  return { nodes, set };
}

export type CelRig = ReturnType<typeof createCelRig>;

type NodeMaterialParameters = NonNullable<ConstructorParameters<Three['MeshBasicNodeMaterial']>[0]>;
/** toTSL's result: celBody's colour widened to the vec4 colorNode takes. */
type Vec4Node = Node<'vec4'>;

export interface CelMaterialOptions extends NodeMaterialParameters {
  rig: CelRig;
  /** The surface colour before lighting (the kit's base.rgb), linear. */
  albedo: Node<'vec3'> | Node<'color'>;
  /** The kit's uGlowRimScale for this surface; 0 turns the rim off. Default 1. */
  rim?: number;
}

/**
 * A cel-lit surface. Fog stays on (three applies it after the colour);
 * pass `vertexColors: false`: read the colour attribute into `albedo`
 * instead, so it lands before the lighting as in the kit.
 */
export function createCelMaterial(THREE: Three, { rig, albedo, rim = 1, ...parameters }: CelMaterialOptions) {
  const T = THREE.TSL;
  const material = new THREE.MeshBasicNodeMaterial({ fog: true, ...parameters });
  const n = rig.nodes;
  const albedoIn = t3.fromTSL(albedo, d.vec3f);
  const normalIn = t3.fromTSL(T.normalWorld, d.vec3f);
  const toEyeIn = t3.fromTSL(T.cameraPosition.sub(T.positionWorld), d.vec3f);
  const rimScale = t3.fromTSL(T.uniform(rim, 'float'), d.f32);
  const v3 = (node: (typeof n.sh)[number]) => t3.fromTSL(node, d.vec3f);
  const s0 = v3(n.sh[0]);
  const s1 = v3(n.sh[1]);
  const s2 = v3(n.sh[2]);
  const s3 = v3(n.sh[3]);
  const s4 = v3(n.sh[4]);
  const s5 = v3(n.sh[5]);
  const s6 = v3(n.sh[6]);
  const s7 = v3(n.sh[7]);
  const s8 = v3(n.sh[8]);
  const v4 = (node: (typeof n)['key']) => t3.fromTSL(node, d.vec4f);
  const key = v4(n.key);
  const keyColor = v4(n.keyColor);
  const fill1 = v4(n.fill1);
  const fill1Color = v4(n.fill1Color);
  const fill2 = v4(n.fill2);
  const fill2Color = v4(n.fill2Color);
  const ramp = v4(n.ramp);
  const bands = v4(n.bands);
  const cool = v4(n.cool);
  const rimColor = v4(n.rimColor);
  const rimBase = v4(n.rimBase);
  const flat = v4(n.flat);

  material.colorNode = t3.toTSL(() => {
    'use gpu';
    const normal = std.normalize(normalIn.$);
    const sh = evalSH9(normal, s0.$, s1.$, s2.$, s3.$, s4.$, s5.$, s6.$, s7.$, s8.$);
    const rimIn = d.vec4f(rimColor.$.xyz, rimScale.$);
    // colorNode is the material's diffuse colour, a vec4: alpha stays 1 here and
    // opacityNode / alphaTest still decide coverage (Dawn rejects a vec3).
    return d.vec4f(
      celBody(
        albedoIn.$, normal, toEyeIn.$, sh,
        key.$, keyColor.$, fill1.$, fill1Color.$, fill2.$, fill2Color.$,
        ramp.$, bands.$, cool.$, rimIn, rimBase.$, flat.$,
      ),
      1,
    );
  }) as unknown as Vec4Node;
  return material;
}
