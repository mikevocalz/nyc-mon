// Loads the baked tile through the app's own parseCityDataset (the same Zod
// validation the Game screen runs) and prints feature counts and file size.
// Run: node tooling/city/print-counts.mjs   (Node 24: strips the .ts types)
import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const FILE = join(ROOT, '../../packages/app/features/game/data/harlem-apollo.json');
const { parseCityDataset } = await import('../../packages/app/features/game/city-dataset.ts');

const raw = await readFile(FILE, 'utf8');
const started = performance.now();
const tile = parseCityDataset(JSON.parse(raw));
const parseMs = performance.now() - started;
const count = (list, key) => list.reduce((acc, item) => ({ ...acc, [item[key]]: (acc[item[key]] ?? 0) + 1 }), {});
const { size } = await stat(FILE);

console.log(`${tile.id} v${tile.version} · origin ${tile.origin.join(', ')} · extent ±${tile.extentMeters} m · retrieved ${tile.source.retrievedAt}`);
console.log(`buildings ${tile.buildings.length}`, count(tile.buildings, 'class'),
  `height estimated ${tile.buildings.filter((b) => b.heightEstimated).length}, class estimated ${tile.buildings.filter((b) => b.classEstimated).length}`);
console.log(`roads ${tile.roads.length}`, count(tile.roads, 'class'));
console.log(`areas ${tile.areas.length}`, count(tile.areas, 'kind'));
console.log(`trees osm ${tile.trees.osm.length / 2}, fill ${tile.trees.fill.length / 2}`);
console.log(`landmarks ${tile.landmarks.map((l) => `${l.key} (${l.name}, ${l.buildingId})`).join('; ') || 'none'}`);
console.log(`file ${(size / 1024).toFixed(0)} KB · parse ${parseMs.toFixed(0)} ms on this machine`);
