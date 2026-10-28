/**
 * Seeds the judge account. Run from apps/admin-vite so Payload loads its env:
 *   NVIDIA_JUDGE_SEED=yes NVIDIA_JUDGE_CALLER_EMAIL=<judge email> \
 *     pnpm --filter admin-vite payload run ../../packages/payload/src/admin/console/v1/judge-seed-cli.ts
 * Refuses unless DATABASE_URL names a nycmon_judge* or nycmon_nvidia_test* database.
 * See docs/nvidia/JUDGE-SEED.md.
 */
import { getPayload } from 'payload';
import { handleHatchEgg } from './game.ts';
import { judgeSeedGuard, seedJudgeMon } from './judge-seed.ts';

const guard = judgeSeedGuard(process.env);
if (!guard.ok) {
  console.error(`[judge-seed] ${guard.reason}`);
  process.exitCode = 2;
} else {
  const { default: config } = await import('../../../payload.config.ts');
  const payload = await getPayload({ config });
  const result = await seedJudgeMon(
    { payload, hatch: handleHatchEgg, serviceKey: process.env.V1_MCP_SERVICE_KEY ?? '' },
    { email: guard.email },
  );
  // Ids only: never the email, tokens or keys.
  console.log(`[judge-seed] database=${guard.database} result=${JSON.stringify(result)}`);
  process.exitCode = result.kind === 'seeded' || result.kind === 'already-seeded' ? 0 : 1;
}
