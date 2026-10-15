# One round trip per care call

Draft. Only needed if live measurement shows the 500 ms budget is at risk.

## Status, 2026-10-15

No live measurement exists on `main`. The only numbers are the stub run below (150 ms fixed `/v1` latency), repeated in `docs/HANDOFF.md:93` and PR #12. `docs/alexa/SUBMISSION.md:33` still carries "[Pending live verification: latency against the real database.]", and `tooling/alexa-readiness/report.mjs:46` hardcodes `liveSmoke: NOT RUN` with the reason that no live latency measurement was run.

Where the measurement will land:

- `.github/workflows/alexa-live-smoke.yml` (manual `workflow_dispatch`, environment `alexa-live`) runs `node scripts/live-smoke.ts` in `packages/web-sim` and uploads `packages/web-sim/.alexa-readiness/live.json` as the `alexa-live-evidence-<sha>` artifact. It needs `LIVE_MCP_URL`, `AUTH_ISSUER`, `LIVE_ACCESS_TOKEN`, `LIVE_MON_ID`, `SIM_BEDROCK_MODEL_ID` and `AWS_REGION`, which come from the deployment PR #14 (still a draft). Without them every check is `NOT RUN` and the job fails.
- In that file the `care-mutation` check records one `ms` value: the wall clock of a single `feed_mon` tool call from the GitHub runner. It is not p50/p95, and it does not split the `/v1` read from the write. The activation rule's numbers (care read p50/p95, care write p50/p95, full tool p50/p95) need either a repeated-sample loop in `live-smoke.ts` or server-side timings; neither exists yet.
- `.github/workflows/alexa-readiness.yml` (`node tooling/alexa-readiness/run.mjs`) is offline contract evidence and will never hold this number.

PR #14's plan (`docs/plans/alexa-deploy.md` on its branch) says to measure `feed_mon` against the real database and take this plan only if p95 goes over 500 ms. `docs/plans/alexa-e2e-red-team.md` "Performance evidence" says the same. Neither supersedes this plan; both point at it. This plan stays a draft until `live.json` exists for a real deployment.

## Problem

Alexa allows 500 ms per round trip. A care tool call (`runCare`, `packages/mcp-server/src/mcp/tools.ts:187`) makes two sequential `/v1` calls:

1. `resolveMon`: `GET /v1/me/mons` to pick the Mon and read its care state.
2. If the predicted outcome isn't a decline, `PUT /v1/mons/:id/care` (`handleApplyCare`, `packages/payload/src/admin/console/v1/game.ts:390`).

Measured against a stub `/v1` with 150 ms latency, `feed_mon` takes 308 ms p50 and 316 ms p95. Server overhead is 5 ms. The total goes over 500 ms once each `/v1` call takes more than about 245 ms. Not yet measured against the real database. Each `/v1` call has its own 400 ms timeout (`V1_TIMEOUT_MS`, `packages/mcp-server/src/env.ts`), so today two calls can legally take 800 ms.

## Proposed change

- The PUT accepts an optional Mon selector (the Caller's active Mon when no id is given). It applies the action with `applyCareAction` on the server and returns `{ applied, declinedBecause?, mon, care }`.
- A decline writes nothing and returns `applied: false`, so the MCP server no longer needs its own prediction step.
- `runCare` makes one call. Keep the existing idempotency key, so a retry still replays.
- One shared deadline of about 450 ms for the whole tool call instead of 400 ms per request.

## Steps

- [ ] Measure against the real database first (deploy PR #14, run `alexa-live-smoke.yml`, read `live.json`). Stop here if p95 is comfortably under 500 ms and record the numbers in the status section above.
- [ ] `/v1`: Mon selector, server-side decline, and the response shape above, with tests.
- [ ] MCP server: single-call `runCare`, shared deadline, tests for decline, applied, replay and timeout.
- [ ] Re-measure.
