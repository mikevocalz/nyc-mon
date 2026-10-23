'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  /** Shown in the box when the GLB fails to load; defaults to a short label. */
  readonly fallback?: ReactNode;
}

const NO_CLIPS: readonly string[] = [];

export function MonModel3D({ url, clips = NO_CLIPS, width, height, label, onError, fallback }: MonModel3DProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  // Latest props for the load callback, without re-running the GLB effect.
  const clipsRef = useRef(clips);
  const onErrorRef = useRef(onError);
  const sizeRef = useRef({ width, height });
  // Declared first so it runs before the GLB effect below.
  useEffect(() => {
    clipsRef.current = clips;
    onErrorRef.current = onError;
    sizeRef.current = { width, height };
  });

  const stage = useRef<{ renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera } | null>(null);

  // Renderer, scene and GLB: once per url (the files are 26-34 MB).
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    setState('loading');
    const { width: w, height: h } = sizeRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
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
    const camera = new THREE.PerspectiveCamera(30, w / h, 0.01, 50);
    stage.current = { renderer, camera };

    let mixer: THREE.AnimationMixer | null = null;
    let root: THREE.Object3D | null = null;
    let frame = 0;
    let disposed = false;
    const timer = new THREE.Timer();
    timer.connect(document); // zero delta while the tab is hidden

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
        const clip = clipsRef.current.map((n) => THREE.AnimationClip.findByName(gltf.animations, n)).find(Boolean);
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
        onErrorRef.current?.(error);
      },
    );

    const tick = (now?: number) => {
      frame = requestAnimationFrame(tick);
      timer.update(now);
      const dt = Math.min(timer.getDelta(), 0.05);
      mixer?.update(dt);
      if (root) root.rotation.y += dt * 0.35; // slow turntable
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      stage.current = null;
      cancelAnimationFrame(frame);
      timer.dispose();
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
  }, [url]);

  // Resize in place: no new context, no re-download.
  useEffect(() => {
    const s = stage.current;
    if (!s) return;
    s.renderer.setSize(width, height);
    s.camera.aspect = width / height;
    s.camera.updateProjectionMatrix();
  }, [width, height]);

  const failed = state === 'error';
  return (
    <div
      ref={host}
      role="img"
      aria-label={failed ? `${label}, model unavailable` : label}
      aria-busy={state === 'loading'}
      style={{ width, height, position: 'relative' }}
    >
      {failed ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            border: '2px dashed rgba(150, 150, 160, 0.45)',
            background: 'rgba(150, 150, 160, 0.08)',
            color: 'rgb(150, 150, 160)',
            fontSize: 14,
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          {fallback ?? 'Model unavailable'}
        </div>
      ) : null}
    </div>
  );
}
