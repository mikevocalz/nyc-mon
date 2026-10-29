// Prints the pinned cell set's R2 cost scenarios, computed from the manifest — never by hand.
//
// R2 pricing (us-east, 2026 rates; verify against cloudflare.com/products/r2 before acting on them):
//   storage    $0.015 / GB-month   (free tier 10 GB-month)
//   Class A    $4.50 / million ops (PUT, POST, LIST; free tier 1M/mo)
//   Class B    $0.36 / million ops (GET, HEAD;     free tier 10M/mo)
//   egress     $0
//
//   node tooling/city/r2-cost.mjs
//   node tooling/city/r2-cost.mjs --publishes 4 --players 5000 --cells-per-session 40
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCellsManifest } from './r2-publish.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..');
const MANIFEST_TS = join(ROOT, 'packages/app/features/game/world/cell-source/data/vd-cells-manifest.ts');

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? Number(args[i + 1]) : d; };

const RATE = { storageGbMo: 0.015, classAperM: 4.5, classBperM: 0.36, egressPerGb: 0 };
const FREE = { storageGb: 10, classA: 1e6, classB: 10e6 };
const GB = 1e9;

const manifest = parseCellsManifest(await readFile(MANIFEST_TS, 'utf8'));
const entries = Object.entries(manifest.cells);
const totalBytes = entries.reduce((a, [, c]) => a + c.bytes, 0);
const byTier = {};
for (const [k, c] of entries) {
  const tier = k.split('/')[0];
  byTier[tier] ??= { cells: 0, bytes: 0 };
  byTier[tier].cells++;
  byTier[tier].bytes += c.bytes;
}
const gb = totalBytes / GB;
const bundledBytes = entries.reduce((a, [, c]) => a + (c.bundled ? c.bytes : 0), 0);

console.log(`manifest: ${entries.length} cells, ${(totalBytes / 1e6).toFixed(1)} MB (${gb.toFixed(2)} GB)`);
for (const [t, v] of Object.entries(byTier).sort()) {
  console.log(`  ${t.padEnd(11)} ${String(v.cells).padStart(4)} cells  ${(v.bytes / 1e6).toFixed(1)} MB`);
}
console.log(`  bundled-home ${(bundledBytes / 1e6).toFixed(1)} MB ships in the app and never bills Class B until fetched`);

// Per-publish Class A: one HEAD + at most one PUT per cell, plus manifest.json and the releases/current write.
// Worst case (all changed) uploads every cell; a same-release republish only HEADs.
const publishes = arg('publishes', 4);
const players = arg('players', 5000);
const cellsPerSession = arg('cells-per-session', 40);

const money = (n) => `$${n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`;
const scenario = (name, s) => {
  const aBillable = Math.max(0, s.classA - FREE.classA);
  const bBillable = Math.max(0, s.classB - FREE.classB);
  const gbBillable = Math.max(0, s.gb - FREE.storageGb);
  const cost = gbBillable * RATE.storageGbMo + aBillable * RATE.classAperM / 1e6 + bBillable * RATE.classBperM / 1e6 + (s.egressGb ?? 0) * RATE.egressPerGb;
  console.log(`\n${name}`);
  console.log(`  storage ${s.gb.toFixed(2)} GB-mo (${gbBillable.toFixed(2)} billable)  ${money(gbBillable * RATE.storageGbMo)}`);
  console.log(`  class A ${s.classA.toLocaleString()} ops (${aBillable.toLocaleString()} billable)  ${money(aBillable * RATE.classAperM / 1e6)}`);
  console.log(`  class B ${s.classB.toLocaleString()} ops (${bBillable.toLocaleString()} billable)  ${money(bBillable * RATE.classBperM / 1e6)}`);
  console.log(`  egress  ${(s.egressGb ?? 0).toFixed(1)} GB  ${money((s.egressGb ?? 0) * RATE.egressPerGb)}`);
  console.log(`  total   ${money(cost)}/mo`);
};

scenario('steady state: one release stored, no publishes, no traffic', { gb, classA: 0, classB: 0, egressGb: 0 });
scenario(`publish churn: ${publishes} full publishes/mo, no traffic`, {
  gb: gb * 2, // current + one superseded release retained
  classA: publishes * (entries.length * 2 + 2), // HEAD + PUT per cell, manifest + pointer
  classB: publishes * (entries.length + 1),     // post-publish --verify GETs + manifest HEAD
  egressGb: publishes * gb,
});
scenario(`${players.toLocaleString()} players/mo x ${cellsPerSession} fetched cells`, {
  gb,
  classA: publishes * (entries.length * 2 + 2),
  classB: publishes * (entries.length + 1) + players * cellsPerSession,
  egressGb: players * cellsPerSession * (totalBytes / entries.length) / GB,
});
scenario('100k players/mo x 40 fetched cells (spike)', {
  gb,
  classA: publishes * (entries.length * 2 + 2),
  classB: publishes * (entries.length + 1) + 100_000 * 40,
  egressGb: 100_000 * 40 * (totalBytes / entries.length) / GB,
});
