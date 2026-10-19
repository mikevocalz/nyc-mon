// Bakes three of Valdrada's street-tree models into
// packages/app/features/game/world/vd-trees.ts for the vd lane, as plain
// arrays: react-native-webgpu has no image decoder and nyc-mon has no GLB
// path, so the geometry and the leaf atlas ship as data (same reason as
// bake-textures.mjs).
//
// Source: Valdrada v0.4.0 Content/models/bxtrees on Hugging Face
// (mehmetkeremturkcan/valdrada, revision v0.4.0): London plane P_m,
// honeylocust H_m, pin oak Q_m. Models CC BY 4.0, M. K. Turkcan; leaf and
// bark textures CC0 1.0 (Valdrada LICENSING.md, bxtrees NOTICE.md). The
// unpack follows client/src/city/bxTrees.js `unpack` (MIT).
//
// Takes each tree's w1 level (Valdrada's 90-150 m mesh: limbs to the
// secondaries and 1,800 leaf cards) and keeps every THIN-th card, scaling
// the kept cards up about their centre by sqrt(THIN) so the crown keeps its
// leaf area, the way Valdrada thins its w0 cards.
//
// Fetch first, then run (needs python3 with Pillow for the WebP atlas):
//   B=https://huggingface.co/datasets/mehmetkeremturkcan/valdrada/resolve/v0.4.0/Content/models/bxtrees
//   for f in P_m.bin H_m.bin Q_m.bin P_leaf_col.webp H_leaf_col.webp Q_leaf_col.webp; do
//     curl -sSL -o tooling/city/.cache/vd-trees/$f $B/$f; done
//   node tooling/city/bake-trees.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, '.cache/vd-trees');
const OUT = join(ROOT, '../../packages/app/features/game/world/vd-trees.ts');
// London plane, honeylocust, pin oak, Callery pear, littleleaf linden, zelkova: 3,100 of Harlem's 4,527 census trees.
const SPECIES = ['P_m', 'H_m', 'Q_m', 'R_m', 'L_m', 'Z_m'];
// ponytail: a quarter of the w1 cards (450 a tree, ~5k triangles with bark); raise THIN's
// divisor once the Duo frame budget for the vd lane is measured.
const THIN = 4;
// The mid level (90 m out): a twelfth of the cards on a plain trunk, so a tree does not swap from a ball to a model.
const THIN_MID = 12;
const ATLAS = 256;
const BARK_TINT = { plane: [0.88, 0.93, 1.06], willow: [0.49, 0.51, 0.56], oak: [1.15, 1.3, 1.6], zelkova: [0.48, 0.59, 0.74], pear: [0.46, 0.52, 0.9], linden: [0.6, 0.56, 0.54] };
// Each scan's linear mean, from bxTrees.js barkMaterial: plane 0.30/0.28/0.25, the others about 0.14.
const BARK_MEAN = { plane: [0.3, 0.28, 0.25], willow: [0.14, 0.13, 0.12], oak: [0.14, 0.12, 0.1], zelkova: [0.14, 0.13, 0.12], pear: [0.14, 0.12, 0.1], linden: [0.14, 0.13, 0.12] };
const TRI8 = [0, 2, 1, 0, 3, 2, 0, 4, 3, 0, 5, 4, 0, 6, 5, 0, 7, 6];

function unpack(buf, base, h, leaf) {
  const nv = h.nv; const [lo, hi] = h.box;
  const q = new Int16Array(buf.buffer, buf.byteOffset + base + h.pos[0], nv * 3);
  const P = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) { const c = i % 3; P[i] = lo[c] + ((q[i] + 32768) / 65535) * (hi[c] - lo[c]); }
  const n8 = new Int8Array(buf.buffer, buf.byteOffset + base + h.nrm[0], nv * 3);
  const N = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) N[i] = n8[i] / 127;
  if (!leaf) {
    const I = new Uint32Array(buf.buffer.slice(buf.byteOffset + base + h.idx[0], buf.byteOffset + base + h.idx[0] + h.ni * 4));
    return { P, N, I };
  }
  const u16 = new Uint16Array(buf.buffer, buf.byteOffset + base + h.uv[0], nv * 2);
  const UV = new Float32Array(nv * 2);
  for (let i = 0; i < nv * 2; i++) UV[i] = u16[i] / 65535;
  const S = new Uint8Array(buf.buffer, buf.byteOffset + base + h.shade[0], nv);
  return { P, N, UV, S, cards: h.cards };
}

function thin(leaf, every = THIN) {
  const keep = [];
  for (let k = 0; k < leaf.cards; k += every) keep.push(k);
  const grow = Math.sqrt(every);
  const P = new Float32Array(keep.length * 8 * 3); const N = new Float32Array(keep.length * 8 * 3);
  const UV = new Float32Array(keep.length * 8 * 2); const S = new Float32Array(keep.length * 8);
  keep.forEach((k, j) => {
    const c = k * 8;
    const cx = leaf.P[c * 3]; const cy = leaf.P[c * 3 + 1]; const cz = leaf.P[c * 3 + 2];
    for (let v = 0; v < 8; v++) {
      const s = c + v; const d = j * 8 + v;
      P[d * 3] = cx + (leaf.P[s * 3] - cx) * grow;
      P[d * 3 + 1] = cy + (leaf.P[s * 3 + 1] - cy) * grow;
      P[d * 3 + 2] = cz + (leaf.P[s * 3 + 2] - cz) * grow;
      N.set(leaf.N.subarray(s * 3, s * 3 + 3), d * 3);
      UV.set(leaf.UV.subarray(s * 2, s * 2 + 2), d * 2);
      S[d] = leaf.S[s] / 255;
    }
  });
  const I = new Uint16Array(keep.length * 18);
  for (let j = 0; j < keep.length; j++) for (let t = 0; t < 18; t++) I[j * 18 + t] = j * 8 + TRI8[t];
  return { P, N, UV, S, I };
}

function atlas(file) {
  // Pillow decodes the WebP to raw RGBA at ATLAS x ATLAS (premultiplied edges are not an issue: alpha is cut at 0.5).
  const out = execFileSync('python3', ['-c', [
    'import sys; from PIL import Image',
    `im = Image.open(sys.argv[1]).convert('RGBA').resize((${ATLAS}, ${ATLAS}), Image.LANCZOS)`,
    'sys.stdout.buffer.write(im.tobytes())',
  ].join('\n'), join(SRC, file)], { maxBuffer: 64 << 20 });
  if (out.length !== ATLAS * ATLAS * 4) throw new Error(`${file}: ${out.length} bytes`);
  return out;
}

const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const trees = [];
const atlases = [];
for (const id of SPECIES) {
  const raw = gunzipSync(readFileSync(join(SRC, `${id}.bin`)));
  const hl = raw.readUInt32LE(0);
  const head = JSON.parse(raw.subarray(4, 4 + hl).toString());
  const base = 4 + hl;
  const bark = unpack(raw, base, head.w1.bark, false);
  if (bark.P.length / 3 > 65535) throw new Error(`${id}: bark exceeds u16 indices`);
  const leafRaw = unpack(raw, base, head.w1.leaf, true);
  const leaf = thin(leafRaw);
  const mid = thin(leafRaw, THIN_MID);
  const tint = BARK_TINT[head.bark]; const mean = BARK_MEAN[head.bark];
  trees.push({
    id, height: head.H, width: head.W,
    barkColor: tint.map((t, i) => Number((t * mean[i]).toFixed(4))),
    bark: { position: b64(bark.P), normal: b64(bark.N), index: b64(Uint16Array.from(bark.I)) },
    leaf: { position: b64(leaf.P), normal: b64(leaf.N), uv: b64(leaf.UV), shade: b64(leaf.S), index: b64(leaf.I) },
    mid: { position: b64(mid.P), normal: b64(mid.N), uv: b64(mid.UV), shade: b64(mid.S), index: b64(mid.I) },
    // Average leaf colour of the atlas (alpha-weighted), display RGB 0..1, for the far crowns.
    leafTone: null,
    triangles: bark.I.length / 3 + leaf.I.length / 3,
  });
  const a = atlas(`${head.F}_leaf_col.webp`);
  atlases.push(a);
  let r = 0, g = 0, bl = 0, w = 0;
  for (let i = 0; i < a.length; i += 4) { const al = a[i + 3] / 255; r += a[i] * al; g += a[i + 1] * al; bl += a[i + 2] * al; w += al; }
  trees[trees.length - 1].leafTone = [r, g, bl].map((c) => Number((c / w / 255).toFixed(3)));
}

const text = [
  '// Generated by tooling/city/bake-trees.mjs. Do not edit.',
  '// Street trees from Valdrada v0.4.0 (github.com/mkturkcan/valdrada; Hugging Face',
  '// mehmetkeremturkcan/valdrada Content/models/bxtrees): London plane, honeylocust,',
  '// pin oak, Callery pear, littleleaf linden, zelkova. Models CC BY 4.0, M. K. Turkcan. Leaf textures CC0 1.0 (ambientCG).',
  `export const VD_TREE_ATLAS_SIZE = ${ATLAS};`,
  '/** Leaf atlases, RGBA, one layer per tree in VD_TREES order. */',
  `export const VD_TREE_ATLAS_RGBA = ${JSON.stringify(Buffer.concat(atlases).toString('base64'))};`,
  '/** Base64 little-endian arrays: Float32 position/normal/uv/shade, Uint16 index. Metres, origin at the root. */',
  `export const VD_TREES = ${JSON.stringify(trees.map(({ triangles, ...t }) => t))} as const;`,
  '',
].join('\n');
writeFileSync(OUT, text);
console.log(`wrote ${OUT} (${(text.length / 1024 / 1024).toFixed(2)} MB);`, trees.map((t) => `${t.id} ${t.triangles} tris`).join(', '));
