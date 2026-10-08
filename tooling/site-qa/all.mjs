// Runs shots, axe, copy-lint and motion in sequence (Lighthouse stays
// separate: it wants a quiet machine). Every check runs even if an earlier
// one fails; exit 1 if any failed.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { ROOT, table } from './lib.mjs';

const checks = ['shots', 'copy-lint', 'axe', 'motion'];
const rows = [];
for (const name of checks) {
  console.log(`\n=== site-qa:${name} ===`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(ROOT, `${name}.mjs`)], { stdio: 'inherit', env: process.env });
  rows.push({ check: name, result: r.status === 0 ? 'pass' : `FAIL (exit ${r.status ?? r.signal})`, seconds: Math.round((Date.now() - t0) / 1000) });
}
console.log('\n' + table(rows, ['check', 'result', 'seconds']));
process.exit(rows.every((r) => r.result === 'pass') ? 0 : 1);
