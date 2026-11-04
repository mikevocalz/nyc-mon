// Move the measured native START BVH construction offline. This consumes the
// exact committed shell bytes and invokes the same builder as runtime geometry.
// No geometry simplification, image rendering, QA run, or replacement proxy.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { prepareTriangleCollisionData } from '../../../packages/app/features/game/triangle-collision.ts';
import { encodeTriangleCollisionData } from '../../../packages/app/features/game/triangle-collision-binary.ts';
import { decodeShellCell } from '../../../packages/app/features/game/world/vd-port/blocks/codec.ts';
import { shellCollisionRegion, shellCollisionDirectory, SHELL_COLLISION_PACK_HEADER_BYTES } from '../../../packages/app/features/game/world/vd-port/blocks/shell-collision-pack.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const blocks = join(root, 'packages/app/features/game/world/vd-port/blocks');
const out = resolve(process.argv[2] ?? join(blocks, 'data-collision'));
const THREE = await import(pathToFileURL(join(root, 'packages/app/node_modules/three/build/three.webgpu.js')).href);
const threePackage = JSON.parse(await readFile(join(root, 'packages/app/node_modules/three/package.json'), 'utf8'));
if (threePackage.version !== '0.187.0') throw new Error('Offline collision must use the pinned runtime Three 0.187.0');
const dataset = JSON.parse(await readFile(join(root, 'packages/app/features/game/data/harlem-apollo.json'), 'utf8'));
const region = shellCollisionRegion(dataset.extentMeters);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const chunks = [], sets = [];
let offset = SHELL_COLLISION_PACK_HEADER_BYTES, triangles = 0, decodedBytes = 0, shellCells = 0, retainedCells = 0;
for (let ring = 0; ring <= 10; ring++) {
  const dir = join(blocks, ring ? `data-ring${ring}` : 'data');
  const source = await import(pathToFileURL(join(dir, 'manifest.ts')).href);
  const info = source[ring ? `VD_BLOCKS_RING${ring}` : 'VD_BLOCKS'];
  const shell = new Uint8Array(await readFile(join(dir, 'shell.bin')));
  const set = { ring, shellSha256: sha256(shell), shellBytes: shell.length, cells: [] };
  for (const cell of info.shell) {
    const bounds = cell.bounds;
    const intersects = bounds[0] <= region[3] && bounds[3] >= region[0] && bounds[1] <= region[4] && bounds[4] >= region[1] && bounds[2] <= region[5] && bounds[5] >= region[2];
    const entry = { source: { ...cell }, triangles: 0, payload: null }; shellCells++;
    if (intersects) {
      const decoded = decodeShellCell(shell, cell, 'cell-local');
      const builder = prepareTriangleCollisionData(THREE, { position: decoded.position, origin: decoded.positionFrame.origin, region });
      let step = builder.next(); while (!step.done) step = builder.next();
      const tree = step.value; entry.triangles = tree.triangles; triangles += tree.triangles;
      if (tree.triangles) {
        const bytes = encodeTriangleCollisionData(tree, cell.triangles), compressed = gzipSync(bytes);
        entry.payload = { offset, fileBytes: compressed.length, bytes: bytes.length, sha256: sha256(bytes) };
        chunks.push(compressed); offset += compressed.length; decodedBytes += bytes.length; retainedCells++;
      }
    }
    set.cells.push(entry);
  }
  sets.push(set);
  console.log(JSON.stringify({ stage: 'authored-ring', ring, cells: set.cells.length, retainedTriangles: set.cells.reduce((n, cell) => n + cell.triangles, 0) }));
}
const inputs = [
  'packages/app/features/game/triangle-collision.ts', 'packages/app/features/game/triangle-collision-binary.ts',
  'packages/app/features/game/world/vd-port/blocks/shell-collision-pack.ts',
  'packages/app/features/game/world/vd-port/blocks/codec.ts', 'packages/app/features/game/world/vd-port/blocks/meshopt.ts',
  'tooling/city/vd-port/build-shell-collision.mjs',
];
const provenance = {
  producer: 'tooling/city/vd-port/build-shell-collision.mjs', three: threePackage.version,
  policy: 'Same triangle acceptance, Float32 positions, original IDs, partitioning and queries; no simplification',
  files: await Promise.all(inputs.map(async path => ({ path, sha256: sha256(await readFile(join(root, path))) }))),
};
const directory = { version: 1, layout: 'exact-shell-bvh-v1', region,
  frame: { cellSize: 128, positionDivisor: 8, space: 'absolute', triangleAreaMin: 1e-8 },
  sets,
};
const directorySha256 = sha256(Buffer.from(shellCollisionDirectory(directory)));
const header = Buffer.alloc(SHELL_COLLISION_PACK_HEADER_BYTES);
header.set([78, 67, 80, 49]); header.writeUInt16LE(1, 4); header.writeUInt16LE(SHELL_COLLISION_PACK_HEADER_BYTES, 6);
header.writeUInt32LE(offset, 8); header.writeUInt32LE(retainedCells, 12); header.writeUInt32LE(sets.length, 16);
header.set(Buffer.from(directorySha256, 'hex'), 32);
const payload = Buffer.concat([header, ...chunks]);
const manifest = { ...directory, directorySha256, file: { sha256: sha256(payload), bytes: payload.length }, provenance };
await mkdir(out, { recursive: true });
await writeFile(join(out, 'shell-collision.bin'), payload);
await writeFile(join(out, 'manifest.ts'), '// Generated by tooling/city/vd-port/build-shell-collision.mjs. Do not edit.\nexport const VD_SHELL_COLLISION = ' + JSON.stringify(manifest) + ' as const;\n');
await writeFile(join(out, 'SOURCE.md'), '# Exact legacy-shell collision data\n\nGenerated from the committed Valdrada block shell packs by `tooling/city/vd-port/build-shell-collision.mjs`. Original geometry provenance/licenses remain in each block manifest. Every ring shell SHA-256, source cell frame/bounds/range and producer source hash is recorded in manifest.ts. The original native triangle acceptance and BVH builder are used without simplification. Each gzip member stores owned Float32 coordinates, source triangle IDs, order, AABBs and tree nodes.\n\nProduction region: `' + JSON.stringify(region) + '`. Runtime preload authenticates the complete compressed bank and original shell bytes; a mismatched frame, source, or coverage region is rejected. Scene disposal releases decoded data.\n\nGeneration is asset production; native startup/performance and query regression verification remain deferred until implementation is complete.\n');
console.log(JSON.stringify({ out, sha256: manifest.file.sha256, shellCells, retainedCells, triangles, decodedBytes, storedBytes: payload.length }));
