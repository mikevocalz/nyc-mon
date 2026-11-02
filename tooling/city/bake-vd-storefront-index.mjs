// Run after baking plan.bin. This moves exact city-wide triangle counting out
// of the iPad startup path; only requested cell attributes are emitted there.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { bakeStorefrontChunkIndex } from '../../packages/app/features/game/world/vd-port/storefronts/chunk-index.ts';
import { decodeStorefrontPlan } from '../../packages/app/features/game/world/vd-port/storefronts/load.ts';
import { parseCityDataset } from '../../packages/app/features/game/city-dataset.ts';
import { createWalkQueries } from '../../packages/app/features/game/world/walkability.ts';

const root = new URL('../../', import.meta.url);
const base = 'packages/app/features/game/world/vd-port/storefronts/';
const inputs = [
  'tooling/city/bake-vd-storefront-index.mjs',
  `${base}plan.bin`, `${base}load.ts`, `${base}emit.ts`, `${base}chunk-index.ts`,
  // cellNum defines chunk keys; the curb flag parser defines baked ground heights.
  'packages/app/features/game/world/cells/cell-rules.ts',
  'packages/app/features/game/world/sky-rig.ts',
  'packages/app/features/game/data/harlem-apollo.json',
  'packages/app/features/game/city-dataset.ts',
  'packages/app/features/game/world/walkability.ts',
  'packages/app/features/game/world/geometry.ts',
  'packages/app/features/game/world/curb.ts',
];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const planBytes = readFileSync(new URL(`${base}plan.bin`, root));
const plan = decodeStorefrontPlan(planBytes);
if (new Set(plan.fronts.map((front) => front.id)).size !== plan.fronts.length) throw new Error('Storefront front IDs must be unique');
const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('packages/app/features/game/data/harlem-apollo.json', root), 'utf8')));
const ground = createWalkQueries(dataset).groundHeight;
const started = performance.now();
const bytes = bakeStorefrontChunkIndex(plan, planBytes.byteLength, ground);
writeFileSync(new URL(`${base}plan-index.bin`, root), bytes);
writeFileSync(new URL(`${base}plan-index.meta.json`, root), `${JSON.stringify({
  version: 1,
  generator: 'tooling/city/bake-vd-storefront-index.mjs',
  inputs: Object.fromEntries(inputs.map((path) => [path, sha256(readFileSync(new URL(path, root)))])),
  bytes: bytes.byteLength,
  sha256: sha256(bytes),
}, null, 2)}\n`);
console.log(`Storefront index: ${plan.fronts.length} fronts, ${bytes.byteLength} bytes, ${Math.round(performance.now() - started)}ms -> ${fileURLToPath(new URL(`${base}plan-index.bin`, root))}`);
