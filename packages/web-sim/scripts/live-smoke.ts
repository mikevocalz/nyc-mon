/**
 * Live smoke for the Amazon submission (docs/plans/alexa-hackathon-readiness-ci.md,
 * "Live provider smoke tests"). Run by hand or by the protected workflow; never per PR.
 *
 * Fails closed: a missing variable is a FAILED check naming the variable, never a
 * silent switch to the mock. Values are never printed.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { bedrockBackend } from '../server/model.ts';

type Status = 'PASSED' | 'FAILED' | 'NOT RUN';
interface Check { id: string; status: Status; reason?: string; ms?: number }

const REQUIRED = ['LIVE_MCP_URL', 'AUTH_ISSUER', 'LIVE_ACCESS_TOKEN', 'LIVE_MON_ID', 'SIM_BEDROCK_MODEL_ID', 'AWS_REGION'] as const;
const env = process.env;
const missing = REQUIRED.filter((k) => !env[k]);
const checks: Check[] = [];

async function check(id: string, run: () => Promise<void>) {
  if (missing.length) return void checks.push({ id, status: 'NOT RUN', reason: `Missing: ${missing.join(', ')}` });
  const started = performance.now();
  try {
    await run();
    checks.push({ id, status: 'PASSED', ms: Math.round(performance.now() - started) });
  } catch (err) {
    checks.push({ id, status: 'FAILED', reason: err instanceof Error ? err.message : String(err), ms: Math.round(performance.now() - started) });
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function mcp(body: unknown, token?: string) {
  return fetch(env.LIVE_MCP_URL!, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-11-25',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

await check('oauth-metadata', async () => {
  const res = await fetch(new URL('/.well-known/oauth-authorization-server', env.AUTH_ISSUER));
  assert(res.ok, `issuer metadata HTTP ${res.status}`);
  const meta = (await res.json()) as { issuer?: string; authorization_endpoint?: string; token_endpoint?: string };
  assert(meta.authorization_endpoint && meta.token_endpoint, 'issuer metadata lacks authorization/token endpoints');
});

await check('mcp-rejects-anonymous', async () => {
  const res = await mcp({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert(res.status === 401, `expected 401 without a token, got ${res.status}`);
  assert(res.headers.get('www-authenticate')?.includes('resource_metadata'), '401 lacks a resource_metadata challenge');
});

await check('mcp-tools-list', async () => {
  const res = await mcp({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, env.LIVE_ACCESS_TOKEN);
  assert(res.ok, `tools/list HTTP ${res.status}`);
  const json = (await res.json()) as { result?: { tools?: { name: string }[] } };
  assert(json.result?.tools?.some((t) => t.name === 'feed_mon'), 'feed_mon is not listed');
});

await check('care-mutation', async () => {
  const res = await mcp(
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'feed_mon', arguments: { monId: env.LIVE_MON_ID, intentId: randomUUID() } } },
    env.LIVE_ACCESS_TOKEN,
  );
  assert(res.ok, `feed_mon HTTP ${res.status}`);
  const json = (await res.json()) as { result?: { isError?: boolean } };
  // A declined meal (asleep, overfed) is still a real round trip; only a tool error fails.
  assert(json.result && !json.result.isError, 'feed_mon returned an error result');
});

await check('bedrock-turn', async () => {
  const backend = bedrockBackend({ modelId: env.SIM_BEDROCK_MODEL_ID!, region: env.SIM_BEDROCK_REGION ?? env.AWS_REGION!, effort: 'low', maxTokens: 256 });
  let text = '';
  const msg = await backend.stream(
    { system: 'Reply with one short sentence.', messages: [{ role: 'user', content: 'Say hello to the judges.' }], tools: [] },
    (t) => (text += t),
    AbortSignal.timeout(30_000),
  );
  assert(msg.stop_reason !== 'refusal', 'Bedrock refused the smoke prompt');
  assert(text.trim().length > 0, 'Bedrock returned no text');
});

const failed = checks.some((c) => c.status !== 'PASSED');
const report = { date: new Date().toISOString(), sha: env.GITHUB_SHA ?? null, liveStatus: failed ? (missing.length ? 'NOT RUN' : 'FAILED') : 'PASSED', checks };
mkdirSync('.alexa-readiness', { recursive: true });
writeFileSync('.alexa-readiness/live.json', JSON.stringify(report, null, 2) + '\n');
const md = [`## Alexa live smoke: ${report.liveStatus}`, '', '| check | status | ms | reason |', '|---|---|---|---|',
  ...checks.map((c) => `| ${c.id} | ${c.status} | ${c.ms ?? ''} | ${c.reason ?? ''} |`)].join('\n');
console.log(md);
if (env.GITHUB_STEP_SUMMARY) writeFileSync(env.GITHUB_STEP_SUMMARY, md + '\n', { flag: 'a' });
process.exitCode = failed ? 1 : 0;
