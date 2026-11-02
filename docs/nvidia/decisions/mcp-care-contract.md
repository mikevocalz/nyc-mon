# Decision: MCP care-call contract

Date: 2026-10-28. Recorded on `feat/nvidia-05-submission-package` (#104). Status: accepted for the NVIDIA stack; #15 is parked behind it.

## Decision

The care-call contract that #102 and #103 consume is the single source of truth. It is the contract `main` already ships in `packages/mcp-server`, so this decision changes no code. #15 must keep this result shape if it is ever implemented.

## The contract

`feed_mon`, `rest_mon`, `wake_mon` and `play_with_mon` all run through `runCare` (`packages/mcp-server/src/mcp/tools.ts:278`) and return an MCP `CallToolResult`.

| Case | `isError` | `structuredContent` | Wrote to `/v1`? |
|---|---|---|---|
| Applied | absent | `{ applied: true, effect, mon, care, mood }` | yes |
| Declined by the Mon (asleep, sluggish, too tired, already asleep/awake) | absent | `{ applied: false, declinedBecause, mon, care, mood }` | no |
| Not permitted, not linked, `/v1` unreachable, timeout | `true` | `{ error: { reason, message, nextStep } }` | no, or unknown after a dropped write (re-read before claiming) |

Schema: `CareResultOutput` in `packages/mcp-server/src/mcp/schemas.ts:132`. Helpers: `success` and `failure` in `packages/mcp-server/src/mcp/errors.ts:76-94`.

A decline is a valid answer, so it never sets `isError`. Consumers must read `applied`:

- `packages/web-sim/src/shared/toolOutcome.ts` classifies a result as `applied`, `declined`, `failed`, `returned` or `unverified`. Eight tests in `packages/web-sim/test/toolOutcome.test.ts` cover these.
- `packages/web-sim/scripts/nvidia-live.ts:111` counts a feed only when the outcome is `applied`, and the live proof also requires an independent `/v1` `lastFedAt` advance.
- `packages/mcp-server/src/ui/contract.ts:302` (main) reads `applied === false` and `declinedBecause` for the live-region copy.

Round trips today: `runCare` makes `GET /v1/me/mons` to resolve the Mon and read care, then predicts the outcome locally with `applyCareAction`. A predicted decline returns without a write. Otherwise it makes one `PUT /v1/mons/:id/care` with an idempotency key `mcp:<intentId or fresh UUID>`. Each `/v1` call has its own `V1_TIMEOUT_MS`.

## What #15 proposes

#15 (`draft/mcp-care-single-roundtrip`, head `cb6067e3`) changes one file, `docs/plans/mcp-care-single-roundtrip.md`. It has no code. It proposes moving the decline check into the `/v1` PUT so a care call makes one round trip, with one shared deadline of about 450 ms. Its activation rule says not to implement until live p50/p95 numbers exist for the Alexa budget, and that lane is closed.

The response it proposes, `{ applied, declinedBecause?, mon, care }`, uses the same `applied` and `declinedBecause` semantics but drops `effect` and `mood`. The MCP UI's live-region copy switches on `effect` (`packages/mcp-server/src/ui/contract.ts:312`), so that shape would regress it. The NVIDIA page reads only `isError` and `applied`, and renders the raw structured result for the Caller.

## Why the stack's contract wins

1. It is implemented, tested and already on `main`. #15 is a plan.
2. The NVIDIA live proof depends on `applied`, and the MCP UI depends on `effect`.
3. #15 is gated on Alexa latency evidence. The Amazon entry was not submitted, so that measurement has no owner before the NVIDIA deadline.

## Conditions on #15

#15 stays open and draft. If someone implements it later:

- Keep `applied`, `effect`, `declinedBecause`, `mon`, `care` and `mood` in the MCP result.
- A decline keeps `isError` absent.
- Keep the idempotency key and retry replay.
- Run `packages/web-sim/test/toolOutcome.test.ts` and the MCP care tests unchanged, and show measured before/after latency.

Sources: https://github.com/mikevocalz/nyc-mon/pull/15 , https://github.com/mikevocalz/nyc-mon/pull/102 , https://github.com/mikevocalz/nyc-mon/pull/103 , https://modelcontextprotocol.io/specification/2025-06-18/server/tools (tool results; `isError` reports a tool execution error).
