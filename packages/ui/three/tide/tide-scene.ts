import * as THREE from 'three/webgpu';
import {
  attribute, clamp, dot, exp, float, max, mix, modelViewMatrix, normalize, pow, uniform, varying, vec3, vec4,
} from 'three/tsl';
import * as t3 from '@typegpu/three';
import { d } from 'typegpu';
import { parseColor, type NeonColorInput } from '../../neon/colors';
import type { ThreeContext, ThreeFrame, ThreeScene } from '../types';
import { tideWave } from './wave';
import {
  directionFromOrigin, ORIGIN_SHIFT, TIDE_FOG_DENSITY, TILT_DEGREES, tideSegments, type TideOptions,
} from './tide-config';

/** toTSL's result, typed as the vec4 the TypeGPU function returns. */
type Vec4Node = ReturnType<typeof vec4>;

/** A colour as NeonBlade's uniforms hold it: the hex read as sRGB, stored linear. */
function setLinear(target: THREE.Color, input: NeonColorInput) {
  const [r, g, b] = parseColor(input);
  target.setRGB(r, g, b, THREE.SRGBColorSpace);
}

/** A colour written straight to the screen: its sRGB components, unconverted. */
function setDisplay(target: THREE.Color, input: NeonColorInput) {
  const [r, g, b] = parseColor(input);
  target.setRGB(r, g, b, THREE.LinearSRGBColorSpace);
}

/**
 * NeonBlade's Neon Tide: a 3D wave surface flowing diagonally from one
 * corner toward the opposite one, shifted toward and tilted up at the origin
 * corner, lit with a diffuse term, a fresnel rim and a specular highlight,
 * fading into the background through FogExp2. The pointer is raycast onto
 * the horizontal plane, moved into the surface's local frame, and raises a
 * bump there.
 *
 * Height and gradient come from `tideWave`, a TypeGPU function bridged into
 * the vertex shader with @typegpu/three; the lighting is TSL. One material
 * compiles to WGSL on WebGPU and GLSL on the WebGL2 backend.
 *
 * Colour handling matches the original: its ShaderMaterial wrote the lit,
 * linear-space colour straight to the canvas with no output encode, which is
 * where its soft, deep look comes from. The renderer here outputs linear too
 * (no output pass), uniforms are converted from sRGB as three does, and the
 * clear and fog colours go out as their sRGB values so the fog fades into
 * exactly the background.
 */
export function createTideScene({ renderer }: ThreeContext, initial: TideOptions): ThreeScene<TideOptions> {
  // Raw output, like a ShaderMaterial without colorspace_fragment on WebGLRenderer.
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  const clear = new THREE.Color();

  const flowU = uniform(new THREE.Vector4(), 'vec4'); // dir x, z, perp x, z
  const waveU = uniform(new THREE.Vector4(), 'vec4'); // amplitude, frequency, time, hover active
  const hoverU = uniform(new THREE.Vector4(), 'vec4'); // x, z, radius, strength
  const lookU = uniform(new THREE.Vector4(), 'vec4'); // glow, gloss, opacity, fog on
  const colorAU = uniform(new THREE.Color());
  const colorBU = uniform(new THREE.Color());
  const glossU = uniform(new THREE.Color());
  const fogColorU = uniform(new THREE.Color());

  const positionAttr = t3.fromTSL(attribute('position', 'vec3'), d.vec3f);
  const flow = t3.fromTSL(flowU, d.vec4f);
  const wave = t3.fromTSL(waveU, d.vec4f);
  const hover = t3.fromTSL(hoverU, d.vec4f);

  // Vertex stage, in TypeGPU: (height, dh/dx, dh/dz, 0).
  const surface = t3.toTSL(() => {
    'use gpu';
    const p = positionAttr.$;
    return tideWave(d.vec2f(p.x, p.z), flow.$, wave.$, hover.$);
  }) as unknown as Vec4Node;

  const position = attribute<'vec3'>('position', 'vec3');
  const displaced = vec3(position.x, surface.x, position.z);
  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, fog: false });
  material.positionNode = displaced;

  const mv = modelViewMatrix.mul(vec4(displaced, 1));
  // As in the original: the normal stays in the surface's local frame, the view vector in view space.
  const vNormal = varying(normalize(vec3(surface.y.negate(), 1, surface.z.negate())), 'vTideNormal');
  const vHeight = varying(clamp(surface.x.div(waveU.x.mul(3.5).add(0.001)).mul(0.5).add(0.5), 0, 1), 'vTideHeight');
  const vView = varying(mv.xyz.negate(), 'vTideView');
  const vFogDepth = varying(mv.z.negate(), 'vTideFogDepth');

  // Fragment stage: NeonBlade's lighting, term for term.
  const N = normalize(vNormal);
  const V = normalize(vView);
  const L = normalize(vec3(0.35, 0.8, 0.45));
  const diff = max(dot(N, L), 0);
  const H = normalize(L.add(V));
  const spec = pow(max(dot(N, H), 0), 48).mul(lookU.y);
  const fresnel = pow(float(1).sub(clamp(dot(N, V), 0, 1)), 2.4).mul(lookU.x);
  const base = mix(colorAU, colorBU, vHeight);
  const shade = diff.mul(0.55).add(0.22);
  const lit = base.mul(shade).add(base.mul(fresnel).mul(0.55)).add(glossU.mul(spec).mul(0.6));
  // FogExp2, as three's fog_fragment computes it.
  const fogFactor = float(1).sub(exp(float(TIDE_FOG_DENSITY * TIDE_FOG_DENSITY).negate().mul(vFogDepth).mul(vFogDepth)));
  const color = mix(lit, fogColorU, fogFactor.mul(lookU.w));
  material.colorNode = vec4(color, lookU.z);

  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  // The vertex shader moves every vertex; the flat plane's bounds would cull the crests.
  mesh.frustumCulled = false;
  scene.add(mesh);

  const raycaster = new THREE.Raycaster();
  const horizontal = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const ndc = new THREE.Vector2();
  const perpAxis = new THREE.Vector3();
  const tilt = THREE.MathUtils.degToRad(TILT_DEGREES);
  let geometryKey = '';
  let aspect = 1;
  let time = 0;

  const rebuild = (o: TideOptions) => {
    const segs = tideSegments(o.gridSegments);
    const key = `${o.planeWidth}:${o.planeDepth}:${segs}`;
    if (key === geometryKey) return;
    geometryKey = key;
    const geometry = new THREE.PlaneGeometry(o.planeWidth, o.planeDepth, segs, segs);
    // Bake the XZ-flat orientation in, so the shader reads x and z as the surface plane.
    geometry.rotateX(-Math.PI / 2);
    mesh.geometry.dispose();
    mesh.geometry = geometry;
  };

  const update = (frame: ThreeFrame, o: TideOptions) => {
    rebuild(o);
    camera.aspect = aspect;
    camera.position.set(0, o.cameraHeight, o.cameraHeight * o.cameraTilt);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    // NeonBlade scales the whole clock by speed; accumulating keeps a speed change from jumping the waves.
    time += frame.delta * o.speed;

    const [dx, dz] = directionFromOrigin(o.origin);
    // Shift the surface toward the origin corner and tilt it so that corner
    // rises toward the camera while the far corner dips away.
    mesh.position.set(-dx * o.planeWidth * ORIGIN_SHIFT, 0, -dz * o.planeDepth * ORIGIN_SHIFT);
    perpAxis.set(-dz, 0, dx);
    mesh.setRotationFromAxisAngle(perpAxis, -tilt);
    mesh.updateMatrixWorld();

    let active = 0;
    if (o.hoverEffect && frame.pointer.inside) {
      ndc.set(frame.pointer.x, frame.pointer.y);
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectPlane(horizontal, hit)) {
        // Into the surface's local frame, where the shader's x and z live.
        mesh.worldToLocal(hit);
        (hoverU.value as THREE.Vector4).setX(hit.x).setY(hit.z);
        active = 1;
      }
    }

    (flowU.value as THREE.Vector4).set(dx, dz, -dz, dx);
    (waveU.value as THREE.Vector4).set(o.amplitude, o.frequency, time, active);
    (hoverU.value as THREE.Vector4).setZ(o.hoverRadius).setW(o.hoverStrength);
    (lookU.value as THREE.Vector4).set(o.glow, o.gloss, o.opacity, o.fog ? 1 : 0);
    setLinear(colorAU.value as THREE.Color, o.colorA);
    setLinear(colorBU.value as THREE.Color, o.colorB);
    setLinear(glossU.value as THREE.Color, o.glossColor);
    setDisplay(fogColorU.value as THREE.Color, o.bgColor);
    setDisplay(clear, o.bgColor);
    renderer.setClearColor(clear, 1);
  };

  rebuild(initial);

  return {
    scene,
    camera,
    update,
    resize: (width, height) => {
      aspect = width / Math.max(1, height);
    },
    dispose: () => {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
