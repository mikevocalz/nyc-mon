import { brand, palette } from '@acme/theme';
import * as THREE from 'three/webgpu';
import type { Node } from 'three/webgpu';
import {
  abs, atan, color, cos, exp, float, fract, length, materialColor, materialEmissive, mix, pow, smoothstep, step, uniform, uv, vec2, vec3, vec4,
} from 'three/tsl';
import { CRACKS, hatchFrame, shardStates, type HatchFrame } from '../mon/hatch-timeline';
import { MonRig, type MonRigSource } from '../mon/mon-rig';
import type { ThreeContext, ThreeFrame, ThreeScene } from '../types';
import { EggHatchRig, type EggHatchSource } from './egg-hatch-rig';
import { EggHatchAssetError } from './hatch-manifest';
import { sequenceTime, type SequencePhase } from './hatch-sequence-time';

/**
 * The Baby the egg hatches into: its GLB (URL on web, Metro asset id on
 * native), its mood's clips and its mouth's rest pose. Loaded through the
 * shared Mon rig (mon-rig.ts), so the stage the hatch hands over to reuses
 * the same parse.
 */
export type HatchBabySource = MonRigSource;

/** What HatchSequenceStage hands the scene each frame. */
export interface HatchSequenceSceneParams {
  readonly eggId: string;
  readonly egg: EggHatchSource;
  /**
   * The Baby the egg hatches into. null: the host draws the Baby itself (the
   * app's creature layer), so after the white-out the stage holds only the
   * settling glow.
   */
  readonly baby: HatchBabySource | null;
  /** null: before the hatch, the egg idling on its own clip. */
  readonly phase: SequencePhase | null;
  /** The screen's length for `phase`, ms. */
  readonly phaseMs: number;
  /** Date.now() when the screen entered `phase`: the scene plays the phase's window from there. */
  readonly phaseStartedAt: number;
  readonly reducedMotion: boolean;
  readonly onReady: () => void;
  readonly onError: (error: EggHatchAssetError) => void;
}

/** The rig's inside: membrane and goo, kept hidden under reduced motion (nothing breaks open there). */
const INSIDE_NODES = ['Membrane', 'Goo_Puddle', 'Goo_Strand_01', 'Goo_Strand_02', 'Goo_Drip_01', 'Goo_Drip_02', 'Goo_Drip_03'];
/** How strongly each shell material glows when light leaks through the cracks (HatchSequence3D's gains). */
function crackGain(name: string): number {
  if (name.endsWith('_ShellEdge')) return 4;
  if (name.endsWith('_ShellInner')) return 2.5;
  if (/goo|membrane|proxy/i.test(name)) return 0;
  return 0.08;
}

// The evolution light's palette (hatch-light.ts, night), from the theme scale.
const ORANGE = palette.orange[500];
const GOLD = palette.orange[300];
const CREAM = palette.orange[100];
const CRACK = palette.orange[400];
/** The silhouette's white, a touch warm (hatch-light.ts whitener). */
const SILHOUETTE = vec3(1, 0.98, 0.93);
const SPARKS = 10;
const LOOP = 2;
const MAX_SHARDS = 19;
/** The silhouette's egg shape: the Baby squeezed narrow and a little tall. */
const EGG_SHAPE = { x: 0.5, y: 1.12 } as const;
/** How much of the frame a standing Baby fills (framing.ts STAND_FILL). */
const STAND_FILL = 0.9;

function asAssetError(error: unknown): EggHatchAssetError {
  return error instanceof EggHatchAssetError ? error : new EggHatchAssetError('parse', String(error), { cause: error });
}

/** Centres `model` on its own box and returns its size. */
function centre(model: THREE.Object3D): THREE.Vector3 {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  model.position.sub(c);
  return box.getSize(new THREE.Vector3());
}

/** The egg's framing: room round it for the shakes, shards and light, camera slightly above centre (HatchSequence3D). */
function eggFraming(size: THREE.Vector3, camera: THREE.PerspectiveCamera): THREE.Vector3 {
  const radius = Math.hypot(size.x, size.z) / 2;
  const vHalf = (camera.fov * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
  const dist = Math.max(size.y / 2 / Math.tan(vHalf), radius / Math.tan(hHalf)) * 1.08 + radius * 0.5;
  return new THREE.Vector3(0, size.y * 0.08, dist);
}

/** A standing model's framing (framing.ts standFraming). */
function standFraming(size: THREE.Vector3, camera: THREE.PerspectiveCamera): THREE.Vector3 {
  const vHalf = (camera.fov * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
  const dist = Math.max(size.y / 2 / Math.tan(vHalf), size.x / 2 / Math.tan(hHalf)) / STAND_FILL + size.z / 2;
  return new THREE.Vector3(0, 0, dist);
}

/**
 * Gives every mesh under `root` its own materials that can fade, whiten
 * (the evolution silhouette, in TSL) and, on the shell, glow through the
 * cracks. Own copies: the rig's parse is shared with every other stage
 * showing this egg (the M11 glass), which must not turn white.
 */
function dress(root: THREE.Object3D, keepDepth: boolean) {
  const white = uniform(0);
  const mats: { mat: THREE.Material; opacity: number; transparent: boolean; gain: number }[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const own = list.map((m) => {
      const mat = m.clone();
      // GLTFLoader makes classic materials; the renderer converts them to node materials, copying these nodes over.
      const standard = mat as THREE.MeshStandardNodeMaterial & { isMeshStandardMaterial?: boolean };
      if (standard.isMeshStandardMaterial === true) {
        const gain = crackGain(mat.name);
        if (gain > 0) {
          standard.emissive = new THREE.Color(CRACK);
          standard.emissiveIntensity = 0;
        }
        standard.colorNode = standard.map ? mix(materialColor, vec4(SILHOUETTE, 1), white) : mix(materialColor, SILHOUETTE, white);
        standard.emissiveNode = mix(materialEmissive, SILHOUETTE.mul(0.6), white);
        mats.push({ mat, opacity: mat.opacity, transparent: mat.transparent, gain });
      } else {
        mats.push({ mat, opacity: mat.opacity, transparent: mat.transparent, gain: 0 });
      }
      return mat;
    });
    mesh.material = Array.isArray(mesh.material) ? own : own[0]!;
  });
  let lastOpacity = -1;
  return {
    white: (amount: number) => {
      white.value = amount;
    },
    glow: (level: number) => {
      for (const m of mats) if (m.gain > 0) (m.mat as THREE.MeshStandardMaterial).emissiveIntensity = level * m.gain;
    },
    fade: (opacity: number) => {
      if (Math.abs(opacity - lastOpacity) < 1e-3) return;
      lastOpacity = opacity;
      const fading = opacity < 0.999;
      for (const m of mats) {
        if (m.mat.transparent !== (fading || m.transparent)) {
          m.mat.transparent = fading || m.transparent;
          m.mat.needsUpdate = true;
        }
        m.mat.opacity = m.opacity * opacity;
        m.mat.depthWrite = keepDepth || !fading;
      }
      root.visible = opacity > 1e-3;
    },
    dispose: () => {
      for (const m of mats) m.mat.dispose();
    },
  };
}

/** A curved, irregular piece of shell (hatch-light.ts shardGeometry). */
function shardGeometry(seed: number): THREE.BufferGeometry {
  const r = (k: number) => {
    const x = Math.sin((seed + k) * 91.7 + 13.1) * 43758.5453;
    return x - Math.floor(x);
  };
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

/**
 * The evolution light (hatch-light.ts) in TSL for WebGPURenderer: the glow
 * core with twelve turning rays and a light ring off each crack, two orange
 * orbits, the inward sparkle spiral, the settling glow and the shell shards.
 * Everything reads the HatchFrame. Additive on the night stage. Sizes are in
 * egg heights (`unit`), centred on the egg.
 */
function createLight(unit: number) {
  const group = new THREE.Group();
  const own: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => (own.push(x), x);

  const uGlow = uniform(0);
  const uSettle = uniform(0);
  const uTime = uniform(0);
  const uRing = uniform(new THREE.Vector3(-1, -1, -1));
  const orange = color(ORANGE);
  const gold = color(GOLD);
  const cream = color(CREAM);
  const p = uv().mul(2).sub(1);
  const r = length(p);
  type F = Node<'float'>;
  const gauss = (x: F, s: number | F) => {
    const sigma: F = typeof s === 'number' ? float(s) : s;
    return exp(x.mul(x).negate().div(sigma.mul(sigma).mul(2)));
  };
  const ring = (age: F) => {
    const radius = age.mul(0.75).add(0.16);
    const level = smoothstep(0, 0.35, age).mul(float(1).sub(smoothstep(0.35, 0.85, age)));
    return level.mul(gauss(r.sub(radius), 0.018)).mul(step(0, age)).mul(step(age, 0.85));
  };
  const core = gauss(r, uGlow.mul(0.05).add(0.17));
  const coreCol = mix(orange, mix(gold, cream, smoothstep(0.35, 0.9, core)), smoothstep(0.05, 0.5, core));
  const rays = pow(abs(cos(atan(p.y, p.x).sub(uTime.mul(0.26)).mul(6))), 36)
    .mul(smoothstep(0.08, 0.22, r)).mul(float(1).sub(smoothstep(0.35, 0.98, r)));
  const rayLevel = uGlow.sub(0.15).div(0.85).clamp(0, 1).mul(0.75);
  const rings = ring(uRing.x).add(ring(uRing.y)).add(ring(uRing.z));
  const settle = gauss(r, 0.26).mul(uSettle);
  const backMat = keep(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  backMat.colorNode = coreCol.mul(core).mul(uGlow).mul(1.1)
    .add(mix(gold, orange, smoothstep(0.2, 0.9, r)).mul(rays).mul(rayLevel))
    .add(mix(cream, gold, 0.4).mul(rings).mul(0.9))
    .add(mix(orange, gold, settle).mul(settle).mul(0.85));
  const back = new THREE.Mesh(keep(new THREE.PlaneGeometry(3.6 * unit, 3.6 * unit)), backMat);
  // Behind the egg, so the shell hides the light's heart and the light rims it.
  back.position.z = -0.75 * unit;
  back.renderOrder = -2;
  group.add(back);

  const orbits = [-0.35, 0.42].map((tilt, i) => {
    const level = uniform(0);
    const head = uniform(i * 0.5);
    const mat = keep(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    const d = fract(head.sub(uv().x));
    const arc = float(1).sub(smoothstep(0, 0.22, d)).mul(step(d, 0.22));
    mat.colorNode = orange.mul(arc.mul(0.9).add(0.18).mul(level));
    const mesh = new THREE.Mesh(keep(new THREE.TorusGeometry(0.62 * unit, 0.007 * unit, 6, 160)), mat);
    mesh.rotation.set(Math.PI / 2 - 0.28, 0, tilt);
    mesh.renderOrder = 1;
    group.add(mesh);
    return { level, head };
  });

  // Sparkles: four-point stars, one instanced quad each; their brightness rides in the instance colour.
  const sparkMat = keep(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const q = uv().mul(2).sub(1);
  const barX = float(1).sub(smoothstep(0, 0.16, abs(q.x))).mul(float(1).sub(smoothstep(0.2, 1, abs(q.y))));
  const barY = float(1).sub(smoothstep(0, 0.16, abs(q.y))).mul(float(1).sub(smoothstep(0.2, 1, abs(q.x))));
  const heart = exp(q.dot(q).negate().mul(9));
  sparkMat.colorNode = cream.mul(barX.max(barY).max(heart));
  const sparks = new THREE.InstancedMesh(keep(new THREE.PlaneGeometry(1, 1)), sparkMat, SPARKS);
  sparks.frustumCulled = false;
  sparks.renderOrder = 2;
  sparks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SPARKS * 3), 3);
  group.add(sparks);
  const sparkMatrix = new THREE.Matrix4();
  const sparkColor = new THREE.Color();
  const sparkSize = Array.from({ length: SPARKS }, (_, i) => (i % 3 === 0 ? 0.16 : 0.1) * unit);

  const shardMat = keep(new THREE.MeshStandardMaterial({
    color: palette.apple[700], roughness: 0.35, emissive: ORANGE, emissiveIntensity: 0.25, side: THREE.DoubleSide, transparent: true,
  }));
  const shards = Array.from({ length: MAX_SHARDS }, (_, i) => {
    const m = new THREE.Mesh(keep(shardGeometry(i + 1)), keep(shardMat.clone()));
    m.visible = false;
    group.add(m);
    return m;
  });

  return {
    group,
    update(f: HatchFrame, t: number) {
      uGlow.value = f.glow;
      uSettle.value = f.settle;
      uTime.value = t;
      const full = f.clipTime !== null;
      if (full) uRing.value.set(t - CRACKS[0]!, t - CRACKS[1]!, t - CRACKS[2]!);
      else uRing.value.set(-1, -1, -1);
      back.visible = f.glow > 0.001 || f.settle > 0.001 || (full && t > CRACKS[0]! && t < CRACKS[2]! + 1);

      const orbitLevel = Math.max(0, (f.glow - 0.6) / 0.4) * f.charge;
      orbits.forEach((o, i) => {
        o.level.value = orbitLevel;
        o.head.value = i * 0.5 + (i ? -1 : 1) * (t / LOOP);
      });
      group.children.forEach((c) => {
        if (c instanceof THREE.Mesh && c.geometry instanceof THREE.TorusGeometry) c.visible = orbitLevel > 0.001;
      });

      // Sparkles: spiral in with the charge; after the reveal, drift slowly out.
      let anySpark = false;
      for (let s = 0; s < SPARKS; s++) {
        const phase = (t / LOOP + s / SPARKS) % 1;
        let radius: number;
        let angle: number;
        let alpha: number;
        if (f.charge > 0.001) {
          radius = (1.3 - 1.1 * phase * phase) * unit;
          angle = (s * Math.PI * 2) / SPARKS + phase * Math.PI * 3;
          alpha = Math.sin(phase * Math.PI) * f.charge;
        } else {
          radius = (0.45 + 0.75 * phase) * unit;
          angle = (s * Math.PI * 2) / SPARKS + phase * 0.6;
          alpha = f.clipTime === null ? 0 : Math.sin(phase * Math.PI) * f.settle * (1 - f.silhouette) * 0.8;
        }
        if (alpha > 0.001) anySpark = true;
        sparkMatrix.makeScale(sparkSize[s]!, sparkSize[s]!, 1);
        sparkMatrix.setPosition(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.85, 0.2 * unit * Math.sin(angle * 2));
        sparks.setMatrixAt(s, sparkMatrix);
        sparks.setColorAt(s, sparkColor.setScalar(Math.max(0, alpha)));
      }
      sparks.instanceMatrix.needsUpdate = true;
      if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true;
      sparks.visible = anySpark;

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
      for (const d of own) d.dispose();
    },
  };
}

/**
 * The hatch moment on the shared renderer (ThreeCanvas: WebGPU or WebGL2 on
 * web, Dawn through react-native-webgpu on native): the Alexa view's
 * choreography (HatchSequence3D, which is WebGL and DOM only) on the same egg
 * rig the app already loads. The stage dims, the egg shakes three times on
 * its base and cracks, light leaks through the cracks and builds while
 * sparkles spiral in and orbits turn, one white-out throws the shards, and
 * the Baby comes out as a white silhouette that pulses between egg shape and
 * its own before resolving into colour. Everything reads hatch-timeline.ts
 * `hatchFrame`; M12's phases each play their window of it
 * (hatch-sequence-time.ts), so a resumed phase starts at its beginning.
 * Reduced motion follows the timeline's reduced path: no shakes, cracks or
 * white-out, one 0.6 s cross-fade under a soft glow.
 */
export function createHatchSequenceScene({ renderer, invalidate }: ThreeContext, initial: HatchSequenceSceneParams): ThreeScene<HatchSequenceSceneParams> {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(new THREE.Color(palette.white), new THREE.Color(palette.ink[700]), 2.2));
  const key = new THREE.DirectionalLight(new THREE.Color(palette.white), 2.4);
  key.position.set(1.5, 3, 2.5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(new THREE.Color(palette.apple[400]), 0.8);
  rim.position.set(-2, 2, -2);
  scene.add(rim);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  // The white-out rides on the camera, so the camera has to be in the scene.
  scene.add(camera);

  // The stage dims behind the egg as the hatch begins: a night disc, soft at its edge.
  const uDim = uniform(0);
  const dimMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  dimMat.colorNode = color(brand.night);
  const dimR = length(uv().sub(vec2(0.5))).mul(2);
  dimMat.opacityNode = mix(float(0.95), float(0.6), smoothstep(0, 0.7, dimR)).mul(float(1).sub(smoothstep(0.7, 1, dimR))).mul(uDim).mul(0.85);
  const dim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), dimMat);
  dim.renderOrder = -3;
  scene.add(dim);

  // The one white-out, over everything: white at the heart to a warm cream rim.
  const uWhite = uniform(0);
  const whiteMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, depthTest: false });
  const wr = length(uv().sub(vec2(0.5))).mul(2);
  whiteMat.colorNode = mix(color(palette.white), color(CREAM), smoothstep(0.6, 1, wr));
  whiteMat.opacityNode = mix(float(1), float(0.92), smoothstep(0.6, 1, wr)).mul(uWhite);
  const white = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), whiteMat);
  white.renderOrder = 999;
  white.frustumCulled = false;
  camera.add(white);

  let latest = initial;
  let disposed = false;
  let aspect = 1;
  let announced = false;
  let egg: {
    rig: EggHatchRig; pivot: THREE.Group; look: ReturnType<typeof dress>; cam: THREE.Vector3; size: THREE.Vector3;
    inside: THREE.Object3D[];
  } | null = null;
  let mon: {
    root: THREE.Group; rig: MonRig; look: ReturnType<typeof dress>; cam: THREE.Vector3; size: THREE.Vector3; fit: number;
  } | null = null;
  let monState: 'none' | 'loading' | 'ready' | 'failed' = initial.baby === null ? 'none' : 'loading';
  let light: ReturnType<typeof createLight> | null = null;
  const camPos = new THREE.Vector3();

  const place = () => {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    // The white-out covers the frustum just in front of the near plane.
    const distance = camera.near * 2;
    const h = 2 * Math.tan((camera.fov * Math.PI) / 360) * distance * 1.05;
    white.position.set(0, 0, -distance);
    white.scale.set(h * aspect, h, 1);
    if (egg) {
      egg.cam = eggFraming(egg.size, camera);
      if (mon) {
        const own = standFraming(mon.size, camera);
        mon.fit = egg.cam.z / own.z;
        mon.cam = own.multiplyScalar(mon.fit);
      }
    }
  };

  const maybeReady = () => {
    if (announced || !egg || monState === 'loading') return;
    announced = true;
    latest.onReady();
    invalidate();
  };

  EggHatchRig.create(initial.eggId, initial.egg).then(
    (rig) => {
      if (disposed) {
        rig.dispose();
        return;
      }
      rig.setProxyBabyVisible(false);
      rig.hatchAt(0);
      const model = rig.root;
      const size = centre(model);
      // Pivot at the egg's base, so the shakes rock it on the ground.
      const pivot = new THREE.Group();
      pivot.position.y = -size.y / 2;
      model.position.y += size.y / 2;
      pivot.add(model);
      scene.add(pivot);
      const inside = INSIDE_NODES.map((name) => model.getObjectByName(name)).filter((n): n is THREE.Object3D => n !== undefined);
      egg = { rig, pivot, look: dress(model, true), cam: new THREE.Vector3(), size, inside };
      dim.scale.set(size.y * 6, size.y * 6, 1);
      dim.position.z = -size.y * 1.2;
      light = createLight(size.y);
      scene.add(light.group);
      place();
      camera.position.copy(egg.cam);
      camera.lookAt(0, 0, 0);
      maybeReady();
    },
    (error: unknown) => {
      if (!disposed) latest.onError(asAssetError(error));
    },
  );

  if (initial.baby !== null) {
    MonRig.create(initial.baby)
      .then((rig) => {
        if (disposed) {
          rig.dispose();
          return;
        }
        // The hatch scales and drops this holder; the rig's own root keeps the idle engine's heading and step.
        const root = new THREE.Group();
        root.add(rig.root);
        scene.add(root);
        const look = dress(rig.root, false);
        look.fade(0);
        mon = { root, rig, look, cam: new THREE.Vector3(), size: rig.size.clone(), fit: 1 };
        monState = 'ready';
        place();
        maybeReady();
      })
      .catch((error: unknown) => {
        // No Baby to hand over to: the egg side still plays, and the host shows its own Baby.
        console.warn('[hatch] the Baby model did not load; the hatch plays without it.', error);
        monState = 'failed';
        maybeReady();
      });
  }

  return {
    scene,
    camera,
    resize(width, height) {
      aspect = width / Math.max(1, height);
      place();
    },
    update(frame: ThreeFrame, params) {
      latest = params;
      const e = egg;
      if (!e) return;
      const reduced = params.reducedMotion || frame.reducedMotion;
      for (const node of e.inside) node.visible = !reduced;

      if (params.phase === null) {
        // Before the hatch: the egg idles on its own clip (held still under reduced motion), no light.
        if (reduced) e.rig.hatchAt(0);
        else {
          e.rig.idle();
          e.rig.update(frame.delta);
        }
        e.pivot.rotation.z = 0;
        e.look.fade(1);
        e.look.white(0);
        e.look.glow(0);
        mon?.look.fade(0);
        uDim.value = 0;
        uWhite.value = 0;
        light?.update(hatchFrame(0, true), 0);
        if (light) light.group.visible = false;
        camera.position.copy(e.cam);
        camera.lookAt(0, 0, 0);
        return;
      }
      if (light) light.group.visible = true;

      const t = sequenceTime(params.phase, Date.now() - params.phaseStartedAt, params.phaseMs, reduced);
      const f = hatchFrame(t, reduced);
      e.rig.hatchAt(f.clipTime ?? 0);
      e.pivot.rotation.z = f.eggTilt;
      e.look.fade(f.eggOpacity);
      e.look.white(f.silhouette);
      e.look.glow(f.crackLight);
      const m = mon;
      if (m) {
        m.look.fade(f.monOpacity);
        m.look.white(f.silhouette);
        const s = f.monScale * m.fit;
        m.root.scale.set(s * THREE.MathUtils.lerp(1, EGG_SHAPE.x, f.monShape), s * THREE.MathUtils.lerp(1, EGG_SHAPE.y, f.monShape), s);
        m.root.position.y = -f.monDrop * 0.12 * e.size.y;
        if (f.monOpacity > 0) m.rig.update(frame.delta, { reduced, boundX: 0 });
        camPos.lerpVectors(e.cam, m.cam, f.camera);
      } else {
        camPos.copy(e.cam);
      }
      camera.position.copy(camPos);
      camera.lookAt(0, 0, 0);
      rim.intensity = 0.8 + 1.2 * f.glow;
      uDim.value = f.dim;
      uWhite.value = f.white;
      light?.update(f, t);
    },
    dispose() {
      disposed = true;
      egg?.look.dispose();
      egg?.rig.dispose();
      egg = null;
      if (mon) {
        mon.look.dispose();
        mon.rig.dispose();
        mon.root.removeFromParent();
        mon = null;
      }
      light?.dispose();
      dim.geometry.dispose();
      dimMat.dispose();
      white.geometry.dispose();
      whiteMat.dispose();
    },
  };
}
