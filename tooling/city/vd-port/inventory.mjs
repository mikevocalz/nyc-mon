// Inventory: assembles every Valdrada tile over the bundled tile with Valdrada's own code and lists what the landmarks,
// the area parts and the facade kit built (meshes, triangles, materials, shader variants), with each structure's anchor
// in scene metres. Writes tooling/city/vd-port/inventory.json. Run before bake.mjs to see what is in bounds.
//
//   node tooling/city/vd-port/inventory.mjs [--deps <dir with three/ and earcut/>] [--valdrada <clone>]
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBake, TILE_KEYS } from './page.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const { page, close } = await openBake(process.argv);
try {
  const out = [];
  for (const key of TILE_KEYS) {
    const t0 = Date.now();
    const inv = await page.evaluate(async (k) => {
      const { THREE } = window.__vd;
      const data = await window.__vd.assemble(k);
      const g = data.group;
      g.updateMatrixWorld(true);
      const items = [];
      const tag = (o) => {
        for (let p = o; p; p = p.parent) {
          if (p.userData && p.userData.__vd) return `landmark:${p.userData.__vd.key}`;
          if (p.name && p.name.startsWith('vdpart:')) return `part:${p.name.slice(7)}`;
        }
        return null;
      };
      const lod = (o) => { for (let p = o; p; p = p.parent) if (p.parent && p.parent.isLOD) return p.parent.levels.findIndex((l) => l.object === p); return -1; };
      g.traverse((o) => {
        if (!o.isMesh) return;
        const t = tag(o);
        if (!t) return;
        const geo = o.geometry, pos = geo.getAttribute('position');
        const tris = (geo.index ? geo.index.count : pos.count) / 3 * (o.isInstancedMesh ? o.count : 1);
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const box = new THREE.Box3().setFromObject(o);
        items.push({
          tag: t, name: o.name, tris, instanced: !!o.isInstancedMesh, lod: lod(o),
          attrs: Object.keys(geo.attributes), indexed: !!geo.index,
          mats: mats.map((m) => ({ type: m.type, name: m.name, key: m.customProgramCacheKey ? m.customProgramCacheKey() : '', obc: !!m.onBeforeCompile && m.onBeforeCompile.toString().length > 30,
            map: !!m.map, normalMap: !!m.normalMap, emissiveMap: !!m.emissiveMap, transparent: m.transparent, vc: m.vertexColors })),
          box: [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].map((v) => Math.round(v * 100) / 100),
        });
      });
      return { key: k, items };
    }, key);
    console.log(`${key}: ${inv.items.length} meshes (${Date.now() - t0} ms)`);
    out.push(inv);
  }
  await writeFile(join(HERE, 'inventory.json'), JSON.stringify(out));
} finally {
  await close();
}
