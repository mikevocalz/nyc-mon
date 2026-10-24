/** Real-provider proof. Missing credentials fail NOT_RUN; no mock, injected transport or fallback. */
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { z } from 'zod';
import { nebiusBackend, NebiusOptionsSchema, type NebiusReceipt } from '../server/nebius.ts';
import { createModelAuth } from '../server/model-auth.ts';
import { createMemoryClient, withPersistentMemory } from '../server/companion-memory-client.ts';
import { runAgentTurn, type ModelClient } from '../src/shared/agentLoop.ts';
import { mcpToolsToClaude } from '../src/shared/toolSpec.ts';
import { V1CallerData } from '../../mcp-server/src/data/v1.ts';
import { loadNvidiaEnv } from '../server/nvidia-env.ts';
import { createSkillLoader, resolveSkillPath } from '../server/skill.ts';

type Status = 'PASSED' | 'FAILED' | 'NOT_RUN';
interface Check { id: string; status: Status; ms?: number; reason?: string }
const checks: Check[] = [];
const receipts: NebiusReceipt[] = [];
const full = process.argv.includes('--full');
const env = process.env;
let sourceCommit: string | null = null;
try { sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* unavailable, not invented */ }
function requireThat(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function check(id: string, run: () => Promise<void>): Promise<boolean> {
  const started = performance.now();
  try { await run(); checks.push({ id, status: 'PASSED', ms: Math.round(performance.now() - started) }); return true; }
  catch { checks.push({ id, status: 'FAILED', ms: Math.round(performance.now() - started), reason: 'Acceptance failed; inspect redacted service-side diagnostics.' }); return false; }
}
function save() {
  const success = checks.length > 0 && checks.every((c) => c.status === 'PASSED');
  const report = { schemaVersion: 1, at: new Date().toISOString(), sourceCommit, mode: full ? 'full-runtime' : 'provider-only',
    status: success ? 'PASSED' : checks.some((c) => c.status === 'FAILED') ? 'FAILED' : 'NOT_RUN',
    qualificationScope: full ? 'Provider + real MCP mutation + persisted state + memory continuity' : 'Provider inference only; NOT complete Personal AI acceptance', checks, receipts };
  mkdirSync('.nvidia-readiness', { recursive: true });
  writeFileSync('.nvidia-readiness/live.json', JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(`NVIDIA ${report.mode}: ${report.status}. ${checks.map((c) => `${c.id}=${c.status}`).join(', ')}`);
  process.exitCode = success ? 0 : report.status === 'NOT_RUN' ? 2 : 1;
}
async function main() {
  const options = NebiusOptionsSchema.safeParse({ apiKey: env.NEBIUS_API_KEY,
    ...(env.NEBIUS_BASE_URL ? { baseUrl: env.NEBIUS_BASE_URL } : {}),
    ...(env.SIM_NEBIUS_MODEL_ID ? { modelId: env.SIM_NEBIUS_MODEL_ID } : {}), maxTokens: 512 });
  if (!options.success) { checks.push({ id: 'configuration', status: 'NOT_RUN', reason: 'Missing/invalid NEBIUS_API_KEY or reviewed model/endpoint.' }); return; }
  const opts = options.data;
  const backend = nebiusBackend(opts, { onReceipt: (receipt) => receipts.push(receipt) });
  if (!await check('account-model-availability', async () => {
    const response = await fetch(`${opts.baseUrl}/models`, { redirect: 'error', signal: AbortSignal.timeout(15000), headers: { authorization: `Bearer ${opts.apiKey}` } });
    requireThat(response.ok, 'model catalog request');
    const models = z.object({ data: z.array(z.object({ id: z.string() })) }).parse(await response.json());
    requireThat(models.data.some((model) => model.id === opts.modelId), 'selected NVIDIA model absent');
  })) return;
  if (!await check('real-nebius-nvidia-inference', async () => {
    const answer = await backend.stream({ system: 'Reply with a brief greeting. Do not call tools.', messages: [{ role: 'user', content: 'Hello.' }], tools: [] }, () => {}, AbortSignal.timeout(65000));
    requireThat(answer.model === opts.modelId && answer.content.some((block) => block.type === 'text' && block.text.trim()), 'no model response');
    requireThat(receipts.length === 1 && receipts[0]?.provider === 'nebius-token-factory', 'missing receipt');
  })) return;
  if (!full) return;
  const required = ['LIVE_ACCESS_TOKEN', 'LIVE_ACCESS_TOKEN_SECOND_SESSION', 'NVIDIA_TEST_CALLER_ID', 'LIVE_MON_ID', 'AUTH_ISSUER', 'SIM_MCP_URL', 'SIM_PUBLIC_ORIGIN', 'V1_BASE_URL', 'V1_MCP_SERVICE_KEY'];
  const missing = required.filter((key) => !env[key]);
  if (missing.length || env.NVIDIA_ALLOW_TEST_ACCOUNT_MUTATION !== 'yes') {
    checks.push({ id: 'full-runtime-configuration', status: 'NOT_RUN', reason: `Requires ${missing.join(', ') || 'test account mutation approval'}. NVIDIA_ALLOW_TEST_ACCOUNT_MUTATION=yes is mandatory.` }); return;
  }
  const config = loadNvidiaEnv({ ...env, NEBIUS_API_KEY: opts.apiKey, NEBIUS_BASE_URL: opts.baseUrl, SIM_NEBIUS_MODEL_ID: opts.modelId });
  const token = env.LIVE_ACCESS_TOKEN;
  const secondToken = env.LIVE_ACCESS_TOKEN_SECOND_SESSION;
  const callerId = env.NVIDIA_TEST_CALLER_ID;
  const monId = env.LIVE_MON_ID;
  requireThat(token && secondToken && callerId && monId, 'missing runtime input');
  if (!await check('two-real-user-sessions', async () => {
    requireThat(token !== secondToken, 'must use two independently issued tokens');
    const verify = createModelAuth({ issuer: config.AUTH_ISSUER.replace(/\/$/, ''), audience: config.SIM_MCP_URL,
      clientId: config.OAUTH_SIM_CLIENT_ID, jwks: `${config.AUTH_ISSUER.replace(/\/$/, '')}/payload-api/auth/jwks` });
    requireThat((await verify(`Bearer ${token}`)).callerId === callerId, 'first account mismatch');
    requireThat((await verify(`Bearer ${secondToken}`)).callerId === callerId, 'second account mismatch');
  })) return;
  const memory = createMemoryClient({ baseUrl: config.V1_BASE_URL, serviceKey: config.V1_MCP_SERVICE_KEY });
  const data = new V1CallerData({ baseUrl: config.V1_BASE_URL, serviceKey: config.V1_MCP_SERVICE_KEY, timeoutMs: 5000 });
  const before = (await data.listMons(callerId)).mons.find((entry) => entry.mon.monInstanceId === monId);
  requireThat(before, 'test Mon must belong to the authenticated account');
  const old = await memory.read(callerId);
  requireThat(old.preferences === null, 'use an empty-memory dedicated test account');
  const marker = `nvidia-proof-${randomUUID()}`;
  let createdRevision: number | null = null;
  const sessions: Client[] = [];
  async function connect(accessToken: string) {
    const client = new Client({ name: 'nyc-mon-nvidia-acceptance', version: '1.0.0' });
    sessions.push(client);
    await client.connect(new StreamableHTTPClientTransport(new URL(config.SIM_MCP_URL), { requestInit: { headers: { authorization: `Bearer ${accessToken}` } } }));
    return client;
  }
  try {
    const saved = await memory.change(callerId, 'PUT', { expectedRevision: old.revision, consent: true, preferences: { interests: [], approvedNote: `My test preference marker is ${marker}.` } });
    createdRevision = saved.revision;
    const first = await connect(token);
    const tools = (await first.listTools()).tools.filter((tool) => ['get_mon_status', 'feed_mon'].includes(tool.name));
    requireThat(tools.some((tool) => tool.name === 'feed_mon'), 'real care tool not available');
    const persistent = withPersistentMemory(backend, memory, () => callerId);
    const loadSystem = createSkillLoader(resolveSkillPath(undefined));
    const agentModel: ModelClient = {
      streamTurn: async (request, onText, signal) => persistent.stream({ ...request, system: await loadSystem() }, onText, signal ?? new AbortController().signal),
    };
    let successfulFeed = false;
    const fed = await check('model-selected-real-care-and-persisted-write', async () => {
      const result = await runAgentTurn({ model: agentModel,
        mcp: { callTool: async (name, args) => {
          requireThat(['get_mon_status', 'feed_mon'].includes(name), 'unapproved test action');
          requireThat(args.monId === monId, 'model must select the designated test Mon');
          const response = await first.callTool({ name, arguments: args });
          if (name === 'feed_mon' && !response.isError) successfulFeed = true;
          return response;
        } }, tools: mcpToolsToClaude(tools).tools, history: [], userText: `Feed my test Mon once, monId ${monId}. Use feed_mon, and honestly report any refusal.`,
        maxSteps: 4, signal: AbortSignal.timeout(180000), onEvent: () => {} });
      requireThat(result.outcome === 'done' && successfulFeed, 'model did not execute a successful feed tool');
      const after = (await data.listMons(callerId)).mons.find((entry) => entry.mon.monInstanceId === monId);
      requireThat(after?.care.lastFedAt !== null && after?.care.lastFedAt !== undefined && after.care.lastFedAt > (before.care.lastFedAt ?? 0), 'declined/no-op is not persisted care');
    });
    if (!fed) return;
    await check('independent-session-memory-and-state', async () => {
      const second = await connect(secondToken);
      const state = await second.callTool({ name: 'get_mon_status', arguments: { monId } });
      requireThat(!state.isError, 'second session cannot retrieve real Mon');
      const resumed = await createMemoryClient({ baseUrl: config.V1_BASE_URL, serviceKey: config.V1_MCP_SERVICE_KEY }).read(callerId);
      requireThat(resumed.revision === createdRevision && resumed.preferences?.approvedNote.includes(marker), 'memory not persistent');
      const answer = await persistent.stream({ system: 'Answer from approved preferences; never invent a marker.', messages: [{ role: 'user', content: 'What is my saved test preference marker?' }], tools: [] }, () => {}, AbortSignal.timeout(65000));
      requireThat(answer.content.some((part) => part.type === 'text' && part.text.includes(marker)), 'fresh model turn did not use saved context');
    });
  } finally {
    for (const session of sessions) await session.close().catch(() => {});
    if (createdRevision !== null) await check('explicit-forget-verified', async () => {
      await memory.change(callerId, 'DELETE', { expectedRevision: createdRevision });
      const cleared = await memory.read(callerId); requireThat(cleared.preferences === null && cleared.consentedAt === null, 'memory not forgotten');
    });
    console.log(`Test marker SHA256: ${createHash('sha256').update(marker).digest('hex')}`);
  }
}
try { await main(); } catch { checks.push({ id: 'runtime-precondition', status: 'FAILED', reason: 'Runtime precondition failed; no secret or account data logged.' }); }
finally { save(); }
