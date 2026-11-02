import { palette } from '@acme/theme';
import * as THREE from 'three/webgpu';
import type { ThreeContext, ThreeFrame, ThreeScene } from '../types';
import { MonRig, type MonRigSource } from './mon-rig';

/** What MonStage hands the scene each frame. */
export interface MonSceneParams {
  readonly source: MonRigSource;
  readonly reducedMotion: boolean;
  /** Once, after the first frame with the Mon in it. */
  readonly onReady: () => void;
  readonly onError: (error: unknown) => void;
}

/** Share of the frame's height the standing Mon fills (framing.ts STAND_FILL). */
const STAND_FILL = 0.9;

/**
 * The camera for a Mon standing face-on, centred on its box. The same
 * formula hatch-sequence-scene.ts ends on, so a Baby handed over from the
 * hatch stands exactly where it already stood.
 */
export function monStandFraming(size: THREE.Vector3, camera: THREE.PerspectiveCamera): THREE.Vector3 {
  const vHalf = (camera.fov * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
  const dist = Math.max(size.y / 2 / Math.tan(vHalf), size.x / 2 / Math.tan(hHalf)) / STAND_FILL + size.z / 2;
  return new THREE.Vector3(0, 0, dist);
}

/**
 * MonModel3D (the Alexa view's Mon, WebGL and DOM only) on the shared
 * renderer: the Baby standing face-on at 90% of the frame's height under the
 * same three lights, idling on its mood's clips through the idle engine
 * (mon-rig.ts). Runs on native (react-native-webgpu) and on web with no DOM.
 * A new clip list cross-fades in place; the GLB is not reloaded.
 */
export function createMonScene({ renderer, invalidate }: ThreeContext, initial: MonSceneParams): ThreeScene<MonSceneParams> {
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

  let latest = initial;
  let disposed = false;
  let rig: MonRig | null = null;
  let boundX = 0;
  let aspect = 1;
  let announced = false;

  const place = () => {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    if (!rig) return;
    camera.position.copy(monStandFraming(rig.size, camera));
    camera.lookAt(0, 0, 0);
    // Steps stay inside 90% of the frame with the whole body in view (MonModel3D).
    const hHalf = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
    const visibleHalf = camera.position.z * Math.tan(hHalf);
    boundX = Math.max(0, visibleHalf * 0.9 - rig.halfSpan(Math.hypot(rig.size.x, rig.size.z) / 2));
  };

  MonRig.create(initial.source).then(
    (r) => {
      if (disposed) {
        r.dispose();
        return;
      }
      rig = r;
      scene.add(r.root);
      place();
      invalidate();
    },
    (error: unknown) => {
      if (!disposed) latest.onError(error);
    },
  );

  return {
    scene,
    camera,
    resize(width, height) {
      aspect = width / Math.max(1, height);
      place();
    },
    update(frame: ThreeFrame, params) {
      latest = params;
      const r = rig;
      if (!r) return;
      r.setClips(params.source.clips);
      r.update(frame.delta, { reduced: params.reducedMotion || frame.reducedMotion, boundX });
      if (!announced) {
        announced = true;
        // After this frame's render, which runs right after update returns.
        setTimeout(() => {
          if (!disposed) latest.onReady();
        }, 0);
      }
    },
    dispose() {
      disposed = true;
      rig?.dispose();
      rig = null;
    },
  };
}
