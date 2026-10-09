# One round trip per care call

Draft. Only needed if live measurement shows the 500 ms budget is at risk.

## Problem

Alexa allows 500 ms per round trip. A care tool call (`runCare`, `packages/mcp-server/src/mcp/tools.ts:186`) makes two sequential `/v1` calls:

1. `resolveMon`: `GET /v1/me/mons` to pick the Mon and read its care state.
2. If the predicted outcome isn't a decline, `PUT /v1/mons/:id/care` (`handleApplyCare`, `packages/payload/src/admin/console/v1/game.ts:390`).

Measured against a stub `/v1` with 150 ms latency, `feed_mon` takes 308 ms p50 and 316 ms p95. Server overhead is 5 ms. The total goes over 500 ms once each `/v1` call takes more than about 245 ms. Not yet measured against the real database.

## Proposed change

- The PUT accepts an optional Mon selector (the Caller's active Mon when no id is given). It applies the action with `applyCareAction` on the server and returns `{ applied, declinedBecause?, mon, care }`.
- A decline writes nothing and returns `applied: false`, so the MCP server no longer needs its own prediction step.
- `runCare` makes one call. Keep the existing idempotency key, so a retry still replays.
- One shared deadline of about 450 ms for the whole tool call instead of 400 ms per request.

## Steps

- [ ] Measure against the real database first (deploy draft PR). Stop here if p95 is comfortably under 500 ms.
- [ ] `/v1`: Mon selector, server-side decline, and the response shape above, with tests.
- [ ] MCP server: single-call `runCare`, shared deadline, tests for decline, applied, replay and timeout.
- [ ] Re-measure.
