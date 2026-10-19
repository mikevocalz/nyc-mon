// Prints what a baked city dataset contains: counts, byte size, parse time and
// the landmark footprint report. Version-agnostic: reads `trees.osm` on v2
// files, `trees.census` on v3.
//
//   node tooling/city/print-counts.mjs            # the bundled dataset
//   node tooling/city/print-counts.mjs file.json  # any baked file
//
// For the v2-vs-v3 comparison required by the bake gate:
//   git show HEAD:packages/app/features/game/data/harlem-apollo.json > /tmp/v2.json
//   node tooling/city/print-counts.mjs /tmp/v2.json
//   node tooling/city/print-counts.mjs
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const FILE = process.argv[2] ?? join(here, '../../packages/app/features/game/data/harlem-apollo.json');
const APP_DIR = join(here, '../../packages/app');

const raw = await readFile(FILE, 'utf8');
const t0 = performance.now();
const d = JSON.parse(raw);
const parseMs = performance.now() - t0;

// Landmark footprint report needs the app's validator; typecheck a shim module
// and transpile its deps on the fly so plain node can run the TS sources.
const dir = await mkdtemp(join(tmpdir(), 'city-counts-'));
await writeFile(
  join(dir, 'shim.mjs'),
  `import { parseCityDataset } from ${JSON.stringify(pathToFileURL(join(APP_DIR, 'features/game/city-dataset.ts')).pathname)};
   const res = parseCityDataset(JSON.parse(await (await import('node:fs/promises')).readFile(process.env.DS_PATH, 'utf8')));
   process.stdout.write('ok');`,
);
await writeFile(join(dir, 'loader.mjs'), `
  import ts from ${JSON.stringify(pathToFileURL(join(APP_DIR, 'node_modules/typescript/lib/typescript.js')).pathname)};
  import { existsSync } from 'node:fs';
  import { readFile } from 'node:fs/promises';
  import { fileURLToPath, pathToFileURL } from 'node:url';
  import { dirname, extname, resolve as resolvePath } from 'node:path';
  export async function resolve(spec, ctx, next) {
    if (/\\.(ts|tsx)$/.test(spec)) return { url: spec.startsWith('file:') ? spec : pathToFileURL(spec).href, shortCircuit: true };
    if (!extname(spec) && !spec.includes('node_modules')) {
      const p = resolvePath(dirname(fileURLToPath(ctx.parentURL)), spec + '.ts');
      if (existsSync(p)) return { url: pathToFileURL(p).href, shortCircuit: true };
    }
    return next(spec);
  }
  export async function load(url, ctx, next) {
    if (url.endsWith('.ts')) {
      const src = await readFile(fileURLToPath(url), 'utf8');
      return { format: 'module', shortCircuit: true, source: ts.transpile(src, {
        compilerOptions: { module: 'esnext', target: 'es2022', verbatimModuleSyntax: true },
        fileName: url }) };
    }
    return next(url, ctx);
  }`);
const { spawnSync } = await import('node:child_process');
const child = spawnSync(process.execPath, ['--experimental-loader', join(dir, 'loader.mjs'), join(dir, 'shim.mjs')], {
  env: { ...process.env, DS_PATH: FILE },
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});
if (child.status !== 0) {
  const err = (child.stderr ?? '').split('\n').find((l) => l.includes('Error')) ?? (child.stderr ?? '').split('\n')[0];
  console.log('(schema validation failed:', err + ')');
}

const count = (flat) => (flat?.length ?? 0) / 2;
const vts = (flat) => (flat?.length ?? 0) / 2;
const censusOrOsm = (t) => count(t?.census ?? t?.osm);
const areaHoles = (a) => (a.i ?? []).reduce((n, h) => n + vts(h), 0);
const bldgHoles = (b) => (b.i ?? []).reduce((n, h) => n + vts(h), 0);

const inside = ([x, z], flat) => {
  let hit = false;
  for (let i = 0, j = flat.length / 2 - 1; i < flat.length / 2; j = i++) {
    const xi = flat[2 * i], zi = flat[2 * i + 1];
    const xj = flat[2 * j], zj = flat[2 * j + 1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
};

const byId = new Map(d.buildings.map((b) => [b.id, b]));
const byClass = {};
for (const b of d.buildings) byClass[b.c] = (byClass[b.c] ?? 0) + 1;
const roadByClass = {};
for (const r of d.roads) roadByClass[r.c] = (roadByClass[r.c] ?? 0) + 1;
const areaByKind = {};
for (const a of d.areas) areaByKind[a.k] = (areaByKind[a.k] ?? 0) + 1;
const srcs = d.sources ?? (d.source ? [d.source] : []);

console.log(`${FILE.split('/').pop()}  v${d.version}  id ${d.id}  ${(raw.length / 1024).toFixed(0)} KB  parse ${parseMs.toFixed(1)} ms${child.status === 0 ? '  schema ok' : ''}`);
console.log(`buildings   ${d.buildings.length}   rings ${d.buildings.reduce((n, b) => n + vts(b.p), 0)} pts, ${d.buildings.reduce((n, b) => n + bldgHoles(b), 0)} hole pts  ${JSON.stringify(byClass)}`);
if (d.buildings[0]?.e !== undefined) {
  console.log(`            e bits: height ${d.buildings.filter((b) => b.e & 1).length} · floors ${d.buildings.filter((b) => b.e & 4).length} · vs present ${d.buildings.filter((b) => b.vs !== undefined).length} · d present ${d.buildings.filter((b) => b.d !== undefined).length}`);
}
console.log(`roads       ${d.roads.length}   ${d.roads.reduce((n, r) => n + vts(r.p), 0)} pts  ${JSON.stringify(roadByClass)}`);
console.log(`areas       ${d.areas.length}   ${d.areas.reduce((n, a) => n + vts(a.p), 0)} pts + ${d.areas.reduce((n, a) => n + areaHoles(a), 0)} hole pts  ${JSON.stringify(areaByKind)}`);
console.log(`trees       ${censusOrOsm(d.trees)} census + ${count(d.trees?.fill)} fill`);
console.log(`landmarks   ${d.landmarks.length}`);
for (const l of d.landmarks) {
  const b = byId.get(l.buildingId);
  const pts = b ? vts(b.p) : 0;
  const insideAt = b ? inside([l.x, l.z], b.p) : false;
  console.log(`  ${l.key}: ${l.name}  at ${l.x},${l.z}  footprint ${b ? pts + ' pts' : 'MISSING'}  label ${insideAt ? 'inside' : 'edge/outside'}`);
}
console.log(`transit     ${count(d.transit?.subway)} subway · ${count(d.transit?.shelters)} shelters`);
if (d.furniture) {
  console.log(`furniture   ${(d.furniture.hydrant?.length ?? 0) / 3} hydrant · ${(d.furniture.linknyc?.length ?? 0) / 3} linknyc · ${(d.furniture.bikeRack?.length ?? 0) / 3} bikeRack`);
}
console.log(`sources     ${srcs.length}`);
for (const s of srcs) console.log(`  ${s.attribution}  <${s.url}>  ${s.retrievedAt ?? ''}`);
