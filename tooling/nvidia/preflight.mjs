import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const endpoints = new Set(['https://api.tokenfactory.us-central1.nebius.com/v1', 'https://api.tokenfactory.nebius.com/v1']);
const requiredChecks = ['account-model-availability', 'real-nebius-nvidia-inference', 'two-real-user-sessions',
  'model-selected-real-care-and-persisted-write', 'independent-session-memory-and-state', 'explicit-forget-verified'];
// Same rule as sameNvidiaModel in packages/web-sim/server/nebius.ts: the returned id may be a cased,
// punctuated or suffixed alias of the requested model, but must stay under nvidia/.
const modelKey = (id) => id.toLowerCase().replace(/[^a-z0-9]/g, '');
export function sameNvidiaModel(requested, returned) {
  const vendor = /^nvidia\//i;
  if (typeof requested !== 'string' || typeof returned !== 'string' || !vendor.test(requested) || !vendor.test(returned)) return false;
  const want = modelKey(requested.replace(vendor, ''));
  return want.length > 0 && modelKey(returned.replace(vendor, '')).startsWith(want);
}
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function publicHttps(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && u.hostname.includes('.') &&
    !u.hostname.endsWith('.local') && !u.hostname.endsWith('.internal') && !/^\d+(?:\.\d+){3}$/.test(u.hostname); } catch { return false; }
}
function publicYoutube(value) {
  try { const u = new URL(value); if (!publicHttps(value)) return false;
    return (['youtube.com', 'www.youtube.com'].includes(u.hostname) && u.pathname === '/watch' && /^[\w-]{11}$/.test(u.searchParams.get('v') ?? '')) ||
      (u.hostname === 'youtu.be' && /^\/[\w-]{11}$/.test(u.pathname));
  } catch { return false; }
}
/** Structural gate only: it does not independently verify footage, grant IP rights, or submit Devpost. */
export function submissionProblems(manifest, proof) {
  const errors = [];
  if (!record(manifest) || manifest.schemaVersion !== 1) return ['Invalid submission manifest'];
  if (!/^[a-f0-9]{40}$/.test(manifest.sourceCommit ?? '')) errors.push('Exact tested source commit missing');
  if (!publicHttps(manifest.publicRepositoryUrl)) errors.push('Public functional repository URL missing');
  if (!publicHttps(manifest.hostedDemoUrl)) errors.push('HTTPS judge demo URL missing');
  if (!publicYoutube(manifest.youtubeUrl)) errors.push('Valid YouTube video URL missing');
  if (typeof manifest.videoDurationSeconds !== 'number' || manifest.videoDurationSeconds <= 0 || manifest.videoDurationSeconds >= 180) errors.push('Video must be shorter than 180 seconds');
  const groups = {
    license: ['scopeApproved', 'thirdPartyNoticesReviewed'],
    source: ['functionalPublicSlice', 'freshCloneReproduced', 'privateAssetsExcluded'],
    acceptance: ['browserAccountLinking', 'ownerIsolation', 'ageAndServiceTokenDenials', 'forgetAndExport', 'judgeAccessWithoutSSO'],
    submission: ['significantUpdateWritten', 'modelAndNebiusExplained', 'toolFeedbackWritten', 'videoIsPublic'],
  };
  for (const [group, flags] of Object.entries(groups)) for (const flag of flags) {
    if (!record(manifest[group]) || manifest[group][flag] !== true) errors.push(`Unverified: ${group}.${flag}`);
  }
  if (!record(manifest.license) || typeof manifest.license.spdx !== 'string' || !manifest.license.spdx.trim()) errors.push('Approved public license missing');
  if (!record(proof) || proof.status !== 'PASSED' || proof.mode !== 'full-runtime') errors.push('Full real-runtime proof has not passed');
  if (!record(proof) || proof.sourceCommit !== manifest.sourceCommit) errors.push('Evidence is not tied to the submitted source commit');
  for (const id of requiredChecks) if (!record(proof) || !Array.isArray(proof.checks) || !proof.checks.some((c) => record(c) && c.id === id && c.status === 'PASSED')) errors.push(`Live check missing: ${id}`);
  if (!record(proof) || !Array.isArray(proof.receipts) || !proof.receipts.length || !proof.receipts.every((r) => record(r) &&
      r.provider === 'nebius-token-factory' && endpoints.has(r.endpoint) && typeof r.requestedModel === 'string' &&
      r.requestedModel.startsWith('nvidia/') && sameNvidiaModel(r.requestedModel, r.returnedModel) && typeof r.responseId === 'string' && r.responseId.length > 0)) errors.push('Qualifying NVIDIA/Nebius receipts missing');
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
    const manifest = JSON.parse(readFileSync(resolve(root, process.argv[2] ?? 'tooling/nvidia/submission-manifest.json'), 'utf8'));
    let proof = null;
    const evidence = typeof manifest.liveEvidencePath === 'string' ? resolve(root, manifest.liveEvidencePath) : '';
    if (evidence.startsWith(root + '/') && !manifest.liveEvidencePath.includes('..')) {
      try { proof = JSON.parse(readFileSync(evidence, 'utf8')); } catch { /* explicitly reported below */ }
    }
    const problems = submissionProblems(manifest, proof);
    console.log(problems.length ? `NOT READY\n${problems.map((p) => `- ${p}`).join('\n')}` : 'Structural gates complete. Manually verify public access and submit Devpost.');
    process.exitCode = problems.length ? 1 : 0;
  } catch { console.error('Submission manifest could not be validated.'); process.exitCode = 1; }
}
