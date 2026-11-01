import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeReport, markdownReport, testEvidence } from './report.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = join(root, '.alexa-readiness');
mkdirSync(output, { recursive: true });
const runDir = mkdtempSync(join(output, 'run-'));
const checkoutSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() !== '';
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TEMP', 'PNPM_HOME', 'XDG_DATA_HOME', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'PLAYWRIGHT_BROWSERS_PATH', 'npm_config_cache']
  .filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
Object.assign(env, { CI: 'true', NO_COLOR: '1', EXPO_NO_TELEMETRY: '1', AWS_EC2_METADATA_DISABLED: 'true' });
const test = (id, pkg, files) => ({ id, cwd: join(root, 'packages', pkg), command: 'pnpm',
  args: ['exec', 'vitest', 'run', ...files, '--reporter=json', `--outputFile=${join(runDir, `${id}.json`)}`], json: true });
const stages = [
  { id: 'evidence-contract', command: process.execPath, args: ['--test', 'tooling/alexa-readiness/report.test.mjs'] },
  test('mcp-contracts', 'mcp-server', ['src/__tests__']),
  test('oauth-provider-contracts', 'payload', ['src/auth/oauth/__tests__/provider.test.ts']),
  test('simulator-contracts', 'web-sim', ['test']),
  test('environment-contract-fixtures', 'payload', ['src/__tests__/readinessEnvironment.test.ts']),
  test('judge-view-browser-contracts', 'mcp-server', ['src/ui/ui.test.ts', 'src/ui/ui.boot.test.ts']),
  { id: 'agent-skill-format', command: 'agentskills', args: ['validate', 'skills/nyc-mon-companion'] },
  { id: 'alexa-types', command: 'pnpm', args: ['--workspace-concurrency=1', '--filter', '@acme/mcp-server', '--filter', '@acme/web-sim', '--filter', '@acme/payload', 'typecheck'] },
  { id: 'simulator-production-build', command: 'pnpm', args: ['--filter', '@acme/web-sim', 'build'],
    artifact: 'packages/web-sim/dist/index.html' },
];
const bootstrap = process.env.READINESS_BOOTSTRAP_STATUS;
const canRun = bootstrap === undefined || bootstrap === 'success';
const checks = stages.map(({ id }) => ({ id, status: 'NOT RUN', reason: canRun
  ? 'No completed evidence yet.' : 'Dependency/browser/validator setup did not complete successfully.' }));
function saveReport() {
  const report = makeReport({ checkoutSha, pullRequestHeadSha: process.env.READINESS_PR_HEAD_SHA || null, dirty, checks });
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(join(output, 'report.md'), markdownReport(report));
  return report;
}
// Preserve incomplete evidence even if a later command or the job is interrupted.
saveReport();
for (const [index, stage] of stages.entries()) {
  if (!canRun) continue;
  // Remove this generated output so a successful no-op cannot reuse stale evidence.
  if (stage.artifact) rmSync(join(root, stage.artifact), { force: true });
  const started = Date.now();
  // Dependencies are installed once by bootstrap; checks must not reinstall or prune them.
  const args = stage.command === 'pnpm' ? ['--config.verify-deps-before-run=false', ...stage.args] : stage.args;
  const result = spawnSync(stage.command, args, {
    cwd: stage.cwd ?? root, env,
    encoding: 'utf8', timeout: 12 * 60_000, maxBuffer: 32 * 1024 * 1024,
  });
  writeFileSync(join(runDir, `${stage.id}.log`), `${result.stdout ?? ''}${result.stderr ?? ''}`);
  let evidence = result.status === 0 && !result.error ? { status: 'PASSED' }
    : { status: 'FAILED', reason: 'Command did not complete successfully; see its per-run log.' };
  if (stage.json) {
    try { evidence = testEvidence(JSON.parse(readFileSync(join(runDir, `${stage.id}.json`), 'utf8')), result.status, Boolean(result.error)); }
    catch { evidence = { status: 'FAILED', reason: 'A fresh machine-readable test report was not produced.' }; }
  }
  if (stage.artifact && !existsSync(join(root, stage.artifact))) {
    evidence = { status: 'FAILED', reason: 'The required build output was not produced.' };
  }
  checks[index] = { id: stage.id, ...evidence, durationMs: Date.now() - started };
  saveReport();
  console.log(`${stage.id}: ${evidence.status}`);
}
const report = saveReport();
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, markdownReport(report), { flag: 'a' });
console.log(`Offline: ${report.offlineStatus}. Live smoke: NOT RUN. Submission readiness is not established.`);
process.exitCode = report.offlineStatus === 'PASSED' ? 0 : 1;
