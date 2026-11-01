// The typing boundary for the ported Slop graphs. @types/three 0.186 types
// each TSL function per node type (float, vec2, vec3, color ...), and a
// node whose type is not known statically (an attribute component, a Fn
// call, a uniform supplied by another lane) has no swizzles and matches no
// overload, although three accepts it at runtime. Slop's graphs mix those
// freely, so they are written against this structural view of THREE.TSL
// instead, and the result is handed back to three as its own Node type in
// one place (`asNode`). Only the names the ported graphs call are listed;
// each is a real three@0.186.1 export (build/three.tsl.js).
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';

type Arg = TslNode | number;

export interface TslNode {
  readonly x: TslNode;
  readonly y: TslNode;
  readonly z: TslNode;
  readonly w: TslNode;
  readonly r: TslNode;
  readonly xy: TslNode;
  readonly xz: TslNode;
  readonly xyz: TslNode;
  readonly rgb: TslNode;
  add(v: Arg): TslNode;
  sub(v: Arg): TslNode;
  mul(v: Arg): TslNode;
  div(v: Arg): TslNode;
  negate(): TslNode;
  normalize(): TslNode;
  dot(v: Arg): TslNode;
  cross(v: Arg): TslNode;
  sign(): TslNode;
  abs(): TslNode;
  max(v: Arg): TslNode;
  clamp(lo: Arg, hi: Arg): TslNode;
  toVar(): TslNode;
  greaterThan(v: Arg): TslNode;
  dFdx(): TslNode;
  dFdy(): TslNode;
  assign(v: Arg): TslNode;
  setInterpolation(sampling: string, mode?: string): TslNode;
}

type Fn1 = (a: Arg) => TslNode;
type Fn2 = (a: Arg, b: Arg) => TslNode;
type Fn3 = (a: Arg, b: Arg, c: Arg) => TslNode;
type FnN = (...a: Arg[]) => TslNode;

export interface LooseTsl {
  Fn(body: (...args: never[]) => unknown): (...args: Arg[]) => TslNode;
  If(cond: TslNode, body: () => void): unknown;
  float: Fn1; vec2: FnN; vec3: FnN; vec4: FnN;
  color(c: unknown): TslNode;
  attribute(name: string, type: string): TslNode;
  varying(node: Arg, name?: string): TslNode;
  texture(tex: unknown, uv: TslNode): TslNode;
  mrt(outputs: Record<string, TslNode>): unknown;
  sin: Fn1; cos: Fn1; abs: Fn1; floor: Fn1; fract: Fn1; sign: Fn1; sqrt: Fn1; normalize: Fn1; length: Fn1; fwidth: Fn1;
  sRGBTransferEOTF: Fn1;
  mod: Fn2; min: FnN; max: FnN; step: Fn2; dot: Fn2; pow: Fn2; reflect: Fn2;
  clamp: Fn3; mix: Fn3; smoothstep: Fn3;
  positionGeometry: TslNode; positionLocal: TslNode; positionWorld: TslNode; positionView: TslNode;
  normalLocal: TslNode; normalView: TslNode; normalGeometry: TslNode; normalWorldGeometry: TslNode;
  modelNormalMatrix: TslNode; cameraPosition: TslNode; cameraProjectionMatrix: TslNode; cameraViewMatrix: TslNode;
  screenSize: TslNode;
  uv(): TslNode;
}

/** THREE.TSL seen through the structural view. */
export function looseTsl(THREE: Pick<Three, 'TSL'>): LooseTsl {
  return THREE.TSL as unknown as LooseTsl;
}

/** Hand a ported graph back to three as a Node. */
export function asNode(node: TslNode | Node): Node {
  return node as unknown as Node;
}

/** Hand a colour graph back to three where it wants a typed colour (MeshStandardNodeMaterial.colorNode). */
export function asColorNode(node: TslNode): Node<'vec3'> {
  return node as unknown as Node<'vec3'>;
}

/** Read a Node supplied by another lane (a uniform, say) as a graph value. */
export function asTsl(node: Node | TslNode): TslNode {
  return node as unknown as TslNode;
}
