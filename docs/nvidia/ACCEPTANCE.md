# NVIDIA acceptance and evidence

## Evidence levels

1. Unit/contract tests: injected transports and stores; never qualifying inference.
2. Disposable Postgres: real SQL persistence, isolation, compare-and-swap, forgetting and cascade; not production Neon proof.
3. Provider-only proof: actual model availability and actual NVIDIA completion through Nebius. Necessary but not complete Personal AI acceptance.
4. Full runtime: independently issued OAuth sessions for one dedicated test Caller, real model-selected MCP feed, verified `lastFedAt` change from the real `/v1` backend, persistent approved memory in a fresh session, actual model use of that memory, and explicit forgetting.
5. Human/browser acceptance: real sign-in journey, phone/desktop sessions, visible error/denial behavior, reachable judge build, measured response times and recorded public video.

`packages/web-sim/scripts/nvidia-live.ts` refuses missing credentials and never imports mockBackend. The provider receipt contains only provider/model, request/response identifiers, timing and token counts. It records source commit, check outcomes and scope. It never records prompts, note contents, personal IDs, access tokens, service keys, or Nebius keys.

A failed/declined feed is not a successful persistence test. A test account must have a real eligible Mon and initially empty memory. The full test explicitly changes that test Mon's care state; it does not fabricate an undo. `NVIDIA_ALLOW_TEST_ACCOUNT_MUTATION=yes` and `--full` are both required. Do not run it on a real player's account. Two independently issued valid tokens for the same Caller are required; this verifies sessions but does not by itself prove the visual OAuth/PKCE flow or a physical second device.

## Commands

```
pnpm --filter @acme/web-sim exec vitest run test/nebius.test.ts test/nvidia-integration.test.ts
pnpm --filter @acme/payload exec vitest run src/admin/console/v1/__tests__/companion-memory.test.ts
NVIDIA_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/nycmon_nvidia_test pnpm --filter @acme/payload exec vitest run src/admin/console/v1/__tests__/companion-memory.pg.test.ts
pnpm --filter @acme/web-sim exec node scripts/nvidia-live.ts
# Only with explicit dedicated-test-account authorization and configured real services:
NVIDIA_ALLOW_TEST_ACCOUNT_MUTATION=yes pnpm --filter @acme/web-sim exec node scripts/nvidia-live.ts --full
```

The database fixture refuses non-loopback hosts and any database name other than `nycmon_nvidia_test`. Never point it at Neon.

## CI and remaining approvals

`nvidia-contracts.yml` runs only offline/disposable checks on PRs, no secrets. It includes typecheck and build; baseline errors are NOT converted into a pass. `nvidia-live.yml` is manual, uses the `nvidia-live` environment and must have required reviewers configured before use. Adding the workflow does not configure that environment, grant model access, apply migrations, deploy services, or execute the live proof.

The first full run needs the existing deployment's OAuth issuer/MCP/backend origins, the shared service key, Nebius key, and two short-lived test user tokens. Keep values in the approved secret store; never paste them into an issue, PR or video.

## Human acceptance still mandatory

- Anonymous, service-only token, wrong audience/client, underage/deletion-pending users are denied.
- First-session save requires visible consent; reload/second browser loads correct owner preferences.
- Other Caller sees none of those preferences; changed revision returns conflict.
- Prompt injection in approvedNote cannot grant care permissions or modify memory.
- A refusal, timeout or unavailable backend is visible; no fabricated success or provider fallback.
- Clear/export controls work; forget drops local conversation history too.
- Hosted endpoint accessible without developer-only SSO; TLS, backend origin and OAuth resource match.
- Latency recorded separately for model calls, tools, full turns and first visible text. No unmeasured performance claims.

These are acceptance criteria, not statements that the deployment has passed.
