// Runs Valdrada's own tile assembly (client/src/world/assemble.js assembleTile) with the context its main.js passes, for
// the tiles over the bundled tile, and exposes what the landmarks, the area parts and the facade kit built.
// Driven by bake.mjs through window.__vd.
import * as THREE from 'three';

const log = (...a) => console.log('[vd-bake]', ...a);
window.__vd = { ready: false, error: null };

try {
  const { assembleTile } = await import('/src/world/assemble.js');
  const { areasReady } = await import('/src/city/areas.js');
  const lm = await import('/src/city/landmarks.js');
  const { LANDMARKS } = await import('/src/shared/landmarkSpec.js');
  await lm.preloadMeshes?.();
  await areasReady;
  const fk = await import('/src/city/fk/facades.js');
  await fk.ready;

  // main.js's streamer ctx, minus the renderer-bound pieces: the bake reads geometry and material descriptions only,
  // so the tile's own facade, ground and far materials are plain stand-ins (assemble.js only hands them to meshes) and
  // the furniture instancer claims nothing (lane C ports furniture from its kits, not from this bake).
  const ctx = {
    facadeMat: new THREE.MeshStandardMaterial({ name: 'vd:tile-facade' }),
    groundMat: new THREE.MeshStandardMaterial({ name: 'vd:tile-ground' }),
    farMat: new THREE.MeshStandardMaterial({ name: 'vd:tile-far' }),
    signalReg: [],
    instancer: { claim: () => -1, setMatrix() {}, release() {}, pools: new Map(), treeSpecies: () => ({ s: 1 }) },
    scene: new THREE.Scene(),
    landmarks: (key, c) => {
      const g = lm.buildLandmark(key, c);
      if (g) g.userData.__vd = { kind: 'landmark', key, mode: (LANDMARKS.find((l) => l.key === key) || {}).mode || 'decorate', cx: c.cx, cz: c.cz, groundY: c.groundY, footprint: c.footprint, height: c.height };
      return g;
    },
  };

  window.__vd.assemble = async (key) => {
    const r = await fetch(`/tiles/t_${key}.bin`);
    if (!r.ok) throw new Error(`tile ${key}: HTTP ${r.status}`);
    const data = await assembleTile(key, await r.arrayBuffer(), ctx);
    // let the facade kit's sliced build and its sign merge settle
    await new Promise((res) => setTimeout(res, 50));
    return data;
  };
  window.__vd.THREE = THREE;
  window.__vd.fk = fk;
  window.__vd.ready = true;
  log('ready');
} catch (e) {
  window.__vd.error = String(e && e.stack || e);
  console.error('[vd-bake] boot failed', e);
}
