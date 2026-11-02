// N4: the cases of mrdoob/slop-newyork @ be65d0a tests/facade-projection.test.cjs
// (MIT, © 2026 Mr.doob), on the same fixtures and with the same numbers.
// Slop evaluates its production TSL expressions numerically through a
// stand-in for three's node API; this runs the ported functions
// (facade-frame.ts) through the same stand-in, Float32 throughout.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { facadeFrame, facadeProjection, roomRay, type FacadeFrame, type FrameThree } from './facade-frame.ts';

const f = Math.fround;
type V = Node | number[] | number;
const values = (v: V): number[] => (v instanceof Node ? v.values : Array.isArray(v) ? v : [v]);
function binary(a: V, b: V, op: (x: number, y: number) => number): Node {
  const av = values(a); const bv = values(b);
  return new Node(Array.from({ length: Math.max(av.length, bv.length) }, (_, i) => op(av[i % av.length]!, bv[i % bv.length]!)));
}
class Node {
  values: number[];
  interpolation?: { sampling: string; mode: string };
  constructor(v: V) { this.values = values(v).map(f); }
  get x() { return new Node(this.values[0]!); }
  get y() { return new Node(this.values[1]!); }
  get z() { return new Node(this.values[2]!); }
  sub(v: V) { return binary(this, v, (a, b) => a - b); }
  mul(v: V) { return binary(this, v, (a, b) => a * b); }
  negate() { return this.mul(-1); }
  normalize() { const length = Math.hypot(...this.values); return new Node(this.values.map((v) => v / length)); }
  toVar() { return this; }
  setInterpolation(sampling: string, mode: string) { this.interpolation = { sampling, mode }; return this; }
}
const unary = (op: (x: number) => number) => (v: V) => new Node(values(v).map(op));
const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1]; // row-major normal matrices in this harness
function matrix(elements: number[]) {
  return {
    mul(v: V) {
      const a = values(v);
      return new Node([0, 3, 6].map((i) => f(f(f(elements[i]! * a[0]!) + f(elements[i + 1]! * a[1]!)) + f(elements[i + 2]! * a[2]!))));
    },
  };
}
const ops = {
  normalize: (v: Node) => v.normalize(),
  varying: (v: V) => new Node(v),
  abs: unary(Math.abs), sign: unary(Math.sign),
  step: (edge: V, v: V) => binary(edge, v, (a, b) => (b < a ? 0 : 1)),
  max: (a: V, b: V) => binary(a, b, Math.max),
  mix: (a: V, b: V, t: V) => binary(binary(a, t, (v, w) => v * (1 - w)), binary(b, t, (v, w) => v * w), (x, y) => x + y),
  vec3: (...v: V[]) => new Node(v.flatMap(values)),
  dot: (a: V, b: V) => new Node(values(a).reduce((sum, v, i) => sum + v * values(b)[i]!, 0)),
};
const three = (inputs: Record<string, unknown>) => ({
  TSL: { ...ops, ...inputs },
  InterpolationSamplingType: { FLAT: 'flat' },
  InterpolationSamplingMode: { EITHER: 'either' },
}) as unknown as FrameThree;

/** Slop's buildFrame(normalLocal, modelNormalMatrix, normalWorldGeometry, cameraViewMatrix) over the ported functions. */
function buildFrame(normalLocal: Node, modelNormalMatrix: ReturnType<typeof matrix>, normalWorldGeometry: Node, cameraViewMatrix: ReturnType<typeof matrix>) {
  const base = { normalLocal, modelNormalMatrix, normalWorldGeometry, cameraViewMatrix };
  const frame: FacadeFrame = facadeFrame(three(base));
  const n = (v: unknown) => v as unknown as Node;
  return {
    normal: n(frame.normal),
    axis: n(frame.alongZ),
    project(boxLocal: boolean, normalGeometry: Node, positionWorld: Node) {
      const p = facadeProjection(three({ ...base, normalGeometry, positionWorld }), frame, boxLocal);
      return { alongZ: n(p.alongZ), uCoord: n(p.uCoord), isRoof: n(p.isRoof) };
    },
    interior(positionWorld: Node, cameraPosition: Node) {
      const r = roomRay(three({ ...base, positionWorld, cameraPosition }), frame);
      return { dirX: n(r.dirX), dirY: n(r.dirY), dirZ: n(r.dirZ) };
    },
  };
}

const scalar = (v: Node) => v.values[0]!;
const position = new Node([-204.25, 220, 5267.625]);
const eye = new Node([-130, 250, 5180]);
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 2e-6, `${actual} should equal ${expected}`);

// Float32 rotation into and out of view space reproduces the old normalWorldGeometry round trip.
function cameraMatrix(yaw: number) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(-0.38), sx = Math.sin(-0.38);
  const cz = Math.cos(0.03), sz = Math.sin(0.03);
  return [cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx,
    cx * sz, cx * cz, -sx,
    -sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx].map(f);
}
function roundTrip(normal: Node, camera: number[]) {
  const transpose = [camera[0]!, camera[3]!, camera[6]!, camera[1]!, camera[4]!, camera[7]!, camera[2]!, camera[5]!, camera[8]!];
  return matrix(transpose).mul(matrix(camera).mul(normal).normalize()).normalize();
}

for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  test(`45-degree facade (${sx}, ${sz}) keeps its windows and room frame across camera rotations`, () => {
    // Slop's fixture: the exact normal of One WTC's fitted diagonal glass shaft, with its slight outward slope.
    const normal = new Node([sx * 0.7068521976470947, -0.02683299221098423, sz * 0.7068521976470947]);
    const reference = buildFrame(normal, matrix(identity), normal, matrix(identity));
    const room = reference.interior(position, eye);
    const oldAxes = new Set<number>();
    for (let i = 0; i < 720; i++) {
      const camera = cameraMatrix((i * Math.PI) / 360);
      const unstable = roundTrip(normal, camera);
      oldAxes.add(Math.abs(unstable.values[0]!) >= Math.abs(unstable.values[2]!) ? 1 : 0);
      const actual = buildFrame(normal, matrix(identity), unstable, matrix(camera));
      assert.equal(scalar(actual.axis), 1, 'near-equal diagonal components have one deterministic tie-break');
      assert.deepEqual(actual.normal.values, reference.normal.values);
      const projected = actual.project(false, normal, position);
      assert.equal(scalar(projected.uCoord), position.values[2], 'the entire window grid must not switch to world X');
      assert.equal(scalar(projected.isRoof), 0);
      const directions = actual.interior(position, eye);
      for (const key of ['dirX', 'dirY', 'dirZ'] as const) assert.deepEqual(directions[key].values, room[key].values);
    }
    assert.equal(oldAxes.size, 2, 'the fixture must expose the original camera-dependent axis flip');
    assert.equal(reference.axis.interpolation?.sampling, 'flat', 'projection choice is constant across each triangle');
    assert.equal(reference.axis.interpolation?.mode, 'either');
  });
}

test('the room ray matches Slop on its own fixtures, number for number', () => {
  // Printed by Slop's harness over js/tsl-materials.js @ be65d0a for the same normals, position and eye.
  const slop = [
    { sx: -1, sz: -1, dirX: 0.9639052748680115, dirY: -0.25272443890571594, dirZ: 0.07286179065704346 },
    { sx: -1, sz: 1, dirX: 0.0796431452035904, dirY: -0.25272443890571594, dirZ: 0.9706866145133972 },
    { sx: 1, sz: -1, dirX: 0.0796431452035904, dirY: -0.25272443890571594, dirZ: 0.957123875617981 },
    { sx: 1, sz: 1, dirX: 0.9639052748680115, dirY: -0.25272443890571594, dirZ: 0.08642449975013733 },
  ];
  for (const s of slop) {
    const normal = new Node([s.sx * 0.7068521976470947, -0.02683299221098423, s.sz * 0.7068521976470947]);
    const frame = buildFrame(normal, matrix(identity), normal, matrix(identity));
    assert.deepEqual(frame.normal.values, normal.values);
    const room = frame.interior(position, eye);
    assert.equal(scalar(room.dirX), s.dirX);
    assert.equal(scalar(room.dirY), s.dirY);
    assert.equal(scalar(room.dirZ), s.dirZ);
  }
});

test('cardinal facades retain their original world-coordinate mapping', () => {
  for (const [normal, axis] of [[[1, 0, 0], 1], [[-1, 0, 0], 1], [[0, 0, 1], 0], [[0, 0, -1], 0]] as const) {
    const n = new Node([...normal]);
    const frame = buildFrame(n, matrix(identity), n, matrix(identity));
    assert.equal(scalar(frame.axis), axis);
    assert.equal(scalar(frame.project(false, n, position).uCoord), position.values[axis ? 2 : 0]);
  }
});

test('world projection includes object rotation and the inverse scale used for normals', () => {
  // A +Z wall rotated 90 degrees about Y becomes a +X wall.
  const local = new Node([0, 0, 1]);
  const rotation = [0, 0, 1, 0, 1, 0, -1, 0, 0];
  const rotated = buildFrame(local, matrix(rotation), local, matrix(identity));
  assert.equal(scalar(rotated.axis), 1);
  assert.equal(scalar(rotated.project(false, local, position).uCoord), position.values[2]);
  assert.equal(scalar(rotated.project(true, local, position).alongZ), 0, 'wall-local layout still uses its own axes');

  // Scaling a model by (2, 3, 0.5) gives a normal matrix with inverse scales (0.5, 1/3, 2).
  const scale = [0.5, 0, 0, 0, 1 / 3, 0, 0, 0, 2];
  const scaled = buildFrame(new Node([1, 1, 1]), matrix(scale), local, matrix(identity));
  const length = Math.hypot(0.5, 1 / 3, 2);
  [0.5, 1 / 3, 2].forEach((v, i) => close(scaled.normal.values[i]!, v / length));
  assert.equal(scalar(scaled.axis), 0, 'the dominant world normal component must be selected after inverse scaling');
});
