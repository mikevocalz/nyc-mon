'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * One Mon GLB on a small lit stage, drawn with three.js (WebGL). Plays the
 * first clip named in `clips` that the file has, else holds the bind pose.
 * Used by the MCP Apps Mon card; Viro stays in the Payload console.
 */
export interface MonModel3DProps {
  readonly url: string;
  /** Preferred clips, first match wins. */
  readonly clips?: readonly string[];
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly onError?: (error: unknown) => void;
}

export function MonModel3D({ url, clips = [], width, height, label, onError }: MonModel3DProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(1.5, 3, 2.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff5a5a, 0.8);
    rim.position.set(-2, 2, -2);
    scene.add(rim);
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.01, 50);

    let mixer: THREE.AnimationMixer | null = null;
    let root: THREE.Object3D | null = null;
    let frame = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    new GLTFLoader().load(
      url,
      (gltf) => {
        if (disposed) return;
        root = gltf.scene;
        root.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) o.frustumCulled = false;
        });
        scene.add(root);
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        const tall = Math.max(size.y, size.x * 0.8);
        const dist = tall / (2 * Math.tan((camera.fov * Math.PI) / 360)) * 1.15;
        camera.position.set(centre.x + dist * 0.25, centre.y + tall * 0.08, centre.z + dist);
        camera.lookAt(centre);
        const clip = clips.map((n) => THREE.AnimationClip.findByName(gltf.animations, n)).find(Boolean);
        if (clip) {
          mixer = new THREE.AnimationMixer(root);
          mixer.clipAction(clip).play();
        }
        setState('ready');
      },
      undefined,
      (error) => {
        if (disposed) return;
        setState('error');
        onError?.(error);
      },
    );

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      mixer?.update(dt);
      if (root) root.rotation.y += dt * 0.35; // slow turntable
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      mixer?.stopAllAction();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mat) => {
          for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
          mat.dispose();
        });
        (o as THREE.SkinnedMesh).skeleton?.dispose();
      });
      renderer.forceContextLoss();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [url, width, height]);

  return (
    <div ref={host} role="img" aria-label={label} aria-busy={state === 'loading'} style={{ width, height, position: 'relative' }} />
  );
}
