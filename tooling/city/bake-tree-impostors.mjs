// Whole-canopy impostors from the authored near tree cards. The far LOD
// must show a tree silhouette, not tile a single leaf over a rectangle.
import { writeFileSync } from 'node:fs';
import { VD_TREES, VD_TREE_ATLAS_RGBA, VD_TREE_ATLAS_SIZE } from '../../packages/app/features/game/world/vd-trees.ts';

const SIZE = 256;
const leafAtlas = Uint8Array.from(Buffer.from(VD_TREE_ATLAS_RGBA, 'base64'));
const f32 = (s) => new Float32Array(Uint8Array.from(Buffer.from(s, 'base64')).buffer);
const u16 = (s) => new Uint16Array(Uint8Array.from(Buffer.from(s, 'base64')).buffer);
const pixels = new Uint16Array(SIZE * SIZE * VD_TREES.length * 2);
const stats = [];
const alpha = new Uint8Array(pixels.length / 8);
const PAD = 2;
for (const [species, tree] of VD_TREES.entries()) {
  const p = f32(tree.leaf.position), uv = f32(tree.leaf.uv), shade = f32(tree.leaf.shade), index = u16(tree.leaf.index);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i++) { lo[i % 3] = Math.min(lo[i % 3], p[i]); hi[i % 3] = Math.max(hi[i % 3], p[i]); }
  const hw = Math.max(hi[0] - lo[0], hi[2] - lo[2]) / 2;
  const center = [(lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2];
  for (let view = 0; view < 2; view++) {
    const output = pixels.subarray((species * 2 + view) * SIZE * SIZE, (species * 2 + view + 1) * SIZE * SIZE);
    const depth = new Float32Array(SIZE * SIZE).fill(-Infinity);
    const horizontal = view === 0 ? 0 : 2, along = view === 0 ? 2 : 0;
    const xy = new Float32Array(p.length / 3 * 2);
    for (let v = 0; v < p.length / 3; v++) {
      xy[v * 2] = ((p[v * 3 + horizontal] - center[view]) / (hw * 2) + 0.5) * (SIZE - 1 - PAD * 2) + PAD;
      xy[v * 2 + 1] = (p[v * 3 + 1] - lo[1]) / (hi[1] - lo[1]) * (SIZE - 1 - PAD * 2) + PAD;
    }
    for (let t = 0; t < index.length; t += 3) {
      const a = index[t], b = index[t + 1], c = index[t + 2];
      const ax = xy[a * 2], ay = xy[a * 2 + 1], bx = xy[b * 2], by = xy[b * 2 + 1], cx = xy[c * 2], cy = xy[c * 2 + 1];
      const determinant = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(determinant) < 1e-8) continue;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(SIZE - 1, Math.ceil(Math.max(ax, bx, cx)));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(SIZE - 1, Math.ceil(Math.max(ay, by, cy)));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const wa = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / determinant;
        const wb = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / determinant;
        const wc = 1 - wa - wb;
        if (Math.min(wa, wb, wc) < -1e-6) continue;
        const z = wa * p[a * 3 + along] + wb * p[b * 3 + along] + wc * p[c * 3 + along];
        const pixel = y * SIZE + x;
        if (z <= depth[pixel]) continue;
        const u = wa * uv[a * 2] + wb * uv[b * 2] + wc * uv[c * 2];
        const v = wa * uv[a * 2 + 1] + wb * uv[b * 2 + 1] + wc * uv[c * 2 + 1];
        const tx = Math.max(0, Math.min(VD_TREE_ATLAS_SIZE - 1, Math.round(u * (VD_TREE_ATLAS_SIZE - 1))));
        const ty = Math.max(0, Math.min(VD_TREE_ATLAS_SIZE - 1, Math.round(v * (VD_TREE_ATLAS_SIZE - 1))));
        const texel = ((species * VD_TREE_ATLAS_SIZE + ty) * VD_TREE_ATLAS_SIZE + tx) * 4;
        if (leafAtlas[texel + 3] < 128) continue;
        const light = 0.55 + (wa * shade[a] + wb * shade[b] + wc * shade[c]) * 0.55;
        const r = Math.min(31, Math.round(leafAtlas[texel] * light / 255 * 31));
        const g = Math.min(63, Math.round(leafAtlas[texel + 1] * light / 255 * 63));
        const bColor = Math.min(31, Math.round(leafAtlas[texel + 2] * light / 255 * 31));
        output[pixel] = (r << 11 | g << 5 | bColor) || 1;
        depth[pixel] = z;
      }
    }
    const covered = output.reduce((n, value) => n + (value !== 0 ? 1 : 0), 0);
    for (let i = 0; i < output.length; i++) if (output[i] !== 0) {
      const bit = (species * 2 + view) * SIZE * SIZE + i;
      alpha[bit >>> 3] |= 1 << (bit & 7);
    }
    // RGB extends eight texels into transparent edges. Alpha remains the
    // authored cutout; filtering/mips cannot blend leaf color with black.
    for (let pass = 0; pass < 8; pass++) {
      const previous = output.slice();
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        const i = y * SIZE + x;
        if (previous[i] !== 0) continue;
        let r = 0, g = 0, b = 0, count = 0;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          if (x + dx < 0 || x + dx >= SIZE || y + dy < 0 || y + dy >= SIZE) continue;
          const c = previous[(y + dy) * SIZE + x + dx];
          if (!c) continue;
          r += c >>> 11; g += c >>> 5 & 63; b += c & 31; count++;
        }
        if (count) output[i] = (Math.round(r / count) << 11 | Math.round(g / count) << 5 | Math.round(b / count)) || 1;
      }
    }
    stats.push({ species: tree.id, view, covered, fraction: +(covered / output.length).toFixed(3) });
  }
}
const output = [
  '// Generated by tooling/city/bake-tree-impostors.mjs from the authored near-tree leaf geometry.',
  '// Two orthographic whole-canopy views per species; RGB565 plus a bit alpha mask. RGB edges dilated eight texels; two transparent gutter texels. No repeated leaf tiles.',
  `export const TREE_IMPOSTOR_SIZE = ${SIZE};`,
  `export const TREE_IMPOSTOR_VIEWS = 2;`,
  `export const TREE_IMPOSTOR_STATS = ${JSON.stringify(stats)} as const;`,
  `export const TREE_IMPOSTOR_ALPHA = ${JSON.stringify(Buffer.from(alpha).toString('base64'))};`,
  `export const TREE_IMPOSTOR_RGB565 = ${JSON.stringify(Buffer.from(pixels.buffer).toString('base64'))};`,
  '',
].join('\n');
writeFileSync(new URL('../../packages/app/features/game/world/vd-tree-impostors.ts', import.meta.url), output);
console.log(JSON.stringify({ bytes: output.length, stats }));
