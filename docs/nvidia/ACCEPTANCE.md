# NVIDIA acceptance and evidence

## Evidence levels

1. Unit/contracts: injected transports/stores, not qualifying inference.
2. Disposable PostgreSQL: real SQL persistence, isolation, concurrency, forgetting and cascade; not production Neon.
3. Provider-only: actual account catalog and NVIDIA completion through Nebius. Necessary, not full Personal AI acceptance.
4. Full runtime: two independently issued OAuth sessions for one dedicated test Caller, real model-selected MCP feed, persisted `lastFedAt` advancement read from `/v1`, saved memory in a fresh session, actual model use of that memory, and explicit forgetting.
5. Human/browser acceptance: visible OAuth/PKCE journey, actual browser/device sessions, truthful action/denial behavior, reachable judge build, measured latency and public footage.

The live runner has no mock/provider fallback. It stores only model/provider identifiers, response/request IDs, timings, token counts, source commit and pass/fail/not-run checks. No prompts, preference contents, personal IDs, access tokens, service keys or Nebius keys are persisted in evidence.

A declined/no-op feed is not a successful mutation. Full testing requires a dedicated adult test account with a real eligible Mon and initially empty memory. It changes that Mon's care state and does not fabricate an undo. Both `--full` and `NVIDIA_ALLOW_TEST_ACCOUNT_MUTATION=yes` are required. Two distinct valid tokens for the same Caller are required, but tokens alone do not prove a visual login journey or physical device switch.

## Commands

Install the full pinned workspace first. Use the `.mjs` launchers to explicitly enable the required Node 24 TypeScript transform flag.

```
pnpm install --frozen-lockfile
pnpm --filter @acme/web-sim test
pnpm --filter @acme/web-sim typecheck
pnpm --filter @acme/payload typecheck
pnpm --filter @acme/web-sim build
pnpm --filter @acme/payload exec vitest run src/admin/console/v1/__tests__/companion-memory.test.ts
NVIDIA_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/nycmon_nvidia_test pnpm --filter @acme/payload exec vitest run src/admin/console/v1/__tests__/companion-memory.pg.test.ts
node --test tooling/nvidia/preflight.test.mjs
pnpm --filter @acme/web-sim exec node scripts/nvidia-live.mjs
# Only with explicit dedicated-test-account authorization and configured real services:
NVIDIA_ALLOW_TEST_ACCOUNT_MUTATION=yes pnpm --filter @acme/web-sim exec node scripts/nvidia-live.mjs --full
```

The SQL fixture refuses non-loopback hosts or any database name other than `nycmon_nvidia_test`. Never point it at Neon. A skipped SQL test is not a persistence pass.

## CI and approvals

`nvidia-contracts.yml` runs offline/disposable checks without secrets; typecheck failures are not waived. `nvidia-live.yml` runs manually under `nvidia-live`; configure required reviewers before use. Adding a workflow does not provision that environment, grant model access, apply migrations, host endpoints or run real tests.

The full run needs existing OAuth/MCP/backend origins, shared service key, Nebius key, real test Caller/Mon and two short-lived session tokens. Keep values only in approved secret stores. Missing configuration must produce NOT_RUN with a nonzero exit, not success.

## Human acceptance still mandatory

- Anonymous, service-only, wrong audience/client, underage and deletion-pending accounts are denied.
- Save requires explicit consent; refresh/new browser retrieves only the correct owner's preferences.
- Another Caller cannot read memory; revision conflicts do not silently overwrite another session.
- An instruction hidden in an approved note cannot bypass permissions or save new memory.
- Refusals, timeouts and unavailable services remain visible; no fabricated success or model fallback.
- Export/forget work; forget also clears the page's local conversation.
- Hosted judge access works without developer-only SSO; TLS and OAuth origins/resources match.
- Measure model, tool, full-turn and first-visible-text latency separately.

These are acceptance criteria, not claims that production has passed. See the dated validation record for completed local tests.
