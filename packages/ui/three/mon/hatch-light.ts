import * as THREE from 'three';
import { CRACKS, shardStates, type HatchFrame } from './hatch-timeline.ts';

/**
 * The evolution light for HatchSequence3D, drawn in three.js.
 *
 * It is the in-view twin of packages/assets/rive/hatch-evolve: the same glow
 * core, twelve turning rays, a light ring off each crack, two orange orbits
 * and an inward sparkle spiral through the tension, a settling glow behind
 * the Baby, plus the shell shards. An MCP Apps view cannot run the Rive
 * runtime: the spec CSP (`script-src 'self' 'unsafe-inline' blob:`) refuses
 * WebAssembly compilation, so the Rive file serves hosts that can, and this
 * draws the same beats here. Everything reads the HatchFrame; nothing here
 * keeps time of its own beyond the loop phase of the rays and sparkles.
 *
 * Sizes are in egg heights (`unit`), centred on the egg. Paints use
 * premultiplied "over" so the light also reads on a transparent canvas.
 */

const ORANGE = new THREE.Color('#FC7C00');
const GOLD = new THREE.Color('#FEBE80');
const CREAM = new THREE.Color('#FFEDDB');
const SHELL = new THREE.Color('#C8141A');

const PREMULT = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
} as const;

const backVertex = /* glsl */ `
varying vec2 vP;
void main() {
  vP = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const backFragment = /* glsl */ `
uniform float uGlow;
uniform float uSettle;
uniform float uTime;
uniform vec3 uRingAge;
uniform vec3 uOrange;
uniform vec3 uGold;
uniform vec3 uCream;
varying vec2 vP;

float gauss(float r, float s) { return exp(-r * r / (2.0 * s * s)); }
float ring(float r, float age) {
  if (age < 0.0 || age > 0.85) return 0.0;
  float radius = 0.16 + age * 0.75;
  float level = smoothstep(0.0, 0.35, age) * (1.0 - smoothstep(0.35, 0.85, age));
  return level * gauss(r - radius, 0.018);
}

void main() {
  float r = length(vP);
  float a = atan(vP.y, vP.x);
  // Glow core, white at the heart through gold to orange.
  float core = gauss(r, 0.17 + 0.05 * uGlow);
  vec3 coreCol = mix(uOrange, mix(uGold, uCream, smoothstep(0.35, 0.9, core)), smoothstep(0.05, 0.5, core));
  vec3 col = coreCol * core * uGlow * 1.1;
  float alpha = core * uGlow;
  // Twelve rays turning one spacing every two seconds, from 0.15 intensity up.
  float rays = pow(abs(cos(6.0 * (a - uTime * 0.26))), 36.0) * smoothstep(0.08, 0.22, r) * (1.0 - smoothstep(0.35, 0.98, r));
  float rayLevel = clamp((uGlow - 0.15) / 0.85, 0.0, 1.0) * 0.75;
  col += mix(uGold, uOrange, smoothstep(0.2, 0.9, r)) * rays * rayLevel;
  alpha += rays * rayLevel * 0.8;
  // A light ring off each crack.
  float rings = ring(r, uRingAge.x) + ring(r, uRingAge.y) + ring(r, uRingAge.z);
  col += mix(uCream, uGold, 0.4) * rings * 0.9;
  alpha += rings * 0.8;
  // The settling glow behind the Baby, warmer and wider.
  float settle = gauss(r, 0.26) * uSettle;
  col += mix(uOrange, uGold, settle) * settle * 0.85;
  alpha += settle * 0.7;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}`;

const orbitFragment = /* glsl */ `
uniform float uLevel;
uniform float uHead;
uniform vec3 uOrange;
varying vec2 vUv;
void main() {
  float d = fract(uHead - vUv.x);
  float arc = (1.0 - smoothstep(0.0, 0.22, d)) * step(d, 0.22);
  float a = (0.18 + 0.9 * arc) * uLevel;
  gl_FragColor = vec4(uOrange * a, a);
}`;
const orbitVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const sparkVertex = /* glsl */ `
attribute float aAlpha;
attribute float aSize;
uniform float uScale;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const sparkFragment = /* glsl */ `
uniform vec3 uCream;
varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  // A four-point star: two thin crossed bars and a soft heart.
  float star = max(1.0 - smoothstep(0.0, 0.16, abs(p.x)) , 0.0) * (1.0 - smoothstep(0.2, 1.0, abs(p.y)));
  star = max(star, (1.0 - smoothstep(0.0, 0.16, abs(p.y))) * (1.0 - smoothstep(0.2, 1.0, abs(p.x))));
  star = max(star, exp(-dot(p, p) * 9.0));
  float a = star * vAlpha;
  gl_FragColor = vec4(uCream * a, a);
}`;

const SPARKS = 10;
const LOOP = 2;
const MAX_SHARDS = 19;

export interface HatchLight {
  readonly group: THREE.Group;
  /** `pxPerUnit`: pixels per world unit at distance 1 (point sprites). */
  update(f: HatchFrame, t: number, pxPerUnit: number): void;
  dispose(): void;
}

function shardGeometry(seed: number): THREE.BufferGeometry {
  const r = (k: number) => {
    const x = Math.sin((seed + k) * 91.7 + 13.1) * 43758.5453;
    return x - Math.floor(x);
  };
  // An irregular curved quad: a piece of shell, red outside, pale inside.
  const s = new THREE.Shape();
  s.moveTo(-0.5, -0.4 - 0.2 * r(1));
  s.lineTo(0.5 + 0.1 * r(2), -0.3);
  s.lineTo(0.3, 0.45 + 0.15 * r(3));
  s.lineTo(-0.35 - 0.1 * r(4), 0.3);
  s.closePath();
  const g = new THREE.ShapeGeometry(s);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, -0.18 * (pos.getX(i) ** 2 + pos.getY(i) ** 2));
  g.computeVertexNormals();
  return g;
}

export function createHatchLight(unit: number): HatchLight {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(x: T): T => (disposables.push(x), x);

  const backMat = own(
    new THREE.ShaderMaterial({
      ...PREMULT,
      uniforms: {
        uGlow: { value: 0 },
        uSettle: { value: 0 },
        uTime: { value: 0 },
        uRingAge: { value: new THREE.Vector3(-1, -1, -1) },
        uOrange: { value: ORANGE },
        uGold: { value: GOLD },
        uCream: { value: CREAM },
      },
      vertexShader: backVertex,
      fragmentShader: backFragment,
    }),
  );
  const back = new THREE.Mesh(own(new THREE.PlaneGeometry(3.6 * unit, 3.6 * unit)), backMat);
  // Behind the egg, so the shell hides the light's heart and the light rims it.
  back.position.z = -0.75 * unit;
  back.renderOrder = -2;
  group.add(back);

  const orbits = [-0.35, 0.42].map((tilt, i) => {
    const mat = own(new THREE.ShaderMaterial({ ...PREMULT, uniforms: { uLevel: { value: 0 }, uHead: { value: i * 0.5 }, uOrange: { value: ORANGE } }, vertexShader: orbitVertex, fragmentShader: orbitFragment, side: THREE.DoubleSide }));
    const mesh = new THREE.Mesh(own(new THREE.TorusGeometry(0.62 * unit, 0.007 * unit, 6, 160)), mat);
    // Flattened into an orbit seen from just above, tilted like the Rive file's.
    mesh.rotation.set(Math.PI / 2 - 0.28, 0, tilt);
    mesh.renderOrder = 1;
    group.add(mesh);
    return mat;
  });

  const sparkGeo = own(new THREE.BufferGeometry());
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkAlpha = new Float32Array(SPARKS);
  const sparkSize = new Float32Array(SPARKS).map((_, i) => (i % 3 === 0 ? 0.16 : 0.1) * unit);
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute('aAlpha', new THREE.BufferAttribute(sparkAlpha, 1));
  sparkGeo.setAttribute('aSize', new THREE.BufferAttribute(sparkSize, 1));
  const sparkMat = own(new THREE.ShaderMaterial({ ...PREMULT, uniforms: { uScale: { value: 40 }, uCream: { value: CREAM } }, vertexShader: sparkVertex, fragmentShader: sparkFragment }));
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  sparks.renderOrder = 2;
  group.add(sparks);

  const shards = Array.from({ length: MAX_SHARDS }, (_, i) => {
    const m = new THREE.Mesh(own(shardGeometry(i + 1)), own(new THREE.MeshStandardMaterial({ color: SHELL, roughness: 0.35, emissive: ORANGE, emissiveIntensity: 0.25, side: THREE.DoubleSide, transparent: true })));
    m.visible = false;
    group.add(m);
    return m;
  });

  return {
    group,
    update(f, t, pxPerUnit) {
      sparkMat.uniforms.uScale!.value = pxPerUnit;
      const u = backMat.uniforms;
      u.uGlow!.value = f.glow;
      u.uSettle!.value = f.settle;
      u.uTime!.value = t;
      const full = f.clipTime !== null;
      if (full) (u.uRingAge!.value as THREE.Vector3).set(t - CRACKS[0]!, t - CRACKS[1]!, t - CRACKS[2]!);
      else (u.uRingAge!.value as THREE.Vector3).set(-1, -1, -1);
      back.visible = f.glow > 0.001 || f.settle > 0.001 || (full && t > CRACKS[0]! && t < CRACKS[2]! + 1);

      const orbitLevel = Math.max(0, (f.glow - 0.6) / 0.4) * f.charge;
      orbits.forEach((m, i) => {
        m.uniforms.uLevel!.value = orbitLevel;
        m.uniforms.uHead!.value = i * 0.5 + (i ? -1 : 1) * (t / LOOP);
      });

      // Sparkles: spiral in with the charge; after the reveal, drift slowly out.
      for (let s = 0; s < SPARKS; s++) {
        const p = (t / LOOP + s / SPARKS) % 1;
        let r: number;
        let a: number;
        let alpha: number;
        if (f.charge > 0.001) {
          r = (1.3 - 1.1 * p * p) * unit;
          a = (s * Math.PI * 2) / SPARKS + p * Math.PI * 3;
          alpha = Math.sin(p * Math.PI) * f.charge;
        } else {
          r = (0.45 + 0.75 * p) * unit;
          a = (s * Math.PI * 2) / SPARKS + p * 0.6;
          // No drift under reduced motion (the clip does not play there): one soft glow only.
          alpha = f.clipTime === null ? 0 : Math.sin(p * Math.PI) * f.settle * (1 - f.silhouette) * 0.8;
        }
        sparkPos[s * 3] = Math.cos(a) * r;
        sparkPos[s * 3 + 1] = Math.sin(a) * r * 0.85;
        sparkPos[s * 3 + 2] = 0.2 * unit * Math.sin(a * 2);
        sparkAlpha[s] = alpha;
      }
      sparkGeo.attributes.position!.needsUpdate = true;
      sparkGeo.attributes.aAlpha!.needsUpdate = true;
      sparks.visible = sparkAlpha.some((x) => x > 0.001);

      const live = shardStates(t, !full);
      shards.forEach((m, i) => {
        const s = live[i];
        m.visible = Boolean(s);
        if (!s) return;
        m.position.set(s.x * unit, s.y * unit, s.z * unit);
        m.rotation.set(s.spin * 0.7, s.spin, s.spin * 0.3);
        m.scale.setScalar(s.size * unit);
        (m.material as THREE.MeshStandardMaterial).opacity = s.opacity;
      });
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

/**
 * Makes every material under `root` able to turn white: the white silhouette
 * of the evolution reveal. Returns a setter, 0 = own colours, 1 = flat white.
 */
export function whitener(root: THREE.Object3D): (amount: number) => void {
  const uniform = { value: 0 };
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const prev = mat.onBeforeCompile.bind(mat);
      mat.onBeforeCompile = (shader, renderer) => {
        prev(shader, renderer);
        shader.uniforms.uHatchWhite = uniform;
        shader.fragmentShader = `uniform float uHatchWhite;\n${shader.fragmentShader}`.replace(
          '#include <dithering_fragment>',
          '#include <dithering_fragment>\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.98, 0.93) * gl_FragColor.a, uHatchWhite);',
        );
      };
      mat.customProgramCacheKey = () => 'nyc-mon-hatch-white';
      mat.needsUpdate = true;
    }
  });
  return (amount) => {
    uniform.value = amount;
  };
}
