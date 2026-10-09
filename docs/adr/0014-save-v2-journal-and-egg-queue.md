# ADR 0014: Save v2, the journal and the egg-create queue

- **Status:** Proposed
- **Date:** 2026-10-08
- **Deciders:** Mike (creator) signs off; the sim-core lane implements (Phase 1 loop)
- **Builds on:** ADR 0002 (sim core, Laws 3, 5, 6), ADR 0010 (one save, one store), DECISIONS D-15, D-16
- **Code:** `packages/core/schemas/{save,journal,play,notification}.ts`, `packages/core/save/migrate.ts`, `packages/core/sim/{journal,queue,care,tuning}.ts`, `packages/app/features/mon/create-mon-store.ts`

## Context

The M08–M18 handoffs need four things the v1 save cannot hold: a journal (M18), an offline queue for `POST /v1/eggs` (M10 B4), feeds with no named food (D-15e), and Mon names capped at the M09 rule (M09 B5). The v1 queue holds only `CareWrite`, and its `seq` is acknowledged by the care endpoint's `ackedSeq`.

## Decision

**Save v2** = v1 + `journal: JournalEntry[]` + `queue.eggCreates: QueuedEggCreate[]`. `CURRENT_SAVE_VERSION` is 2. The v1 → v2 step keeps every v1 field, seeds one `hatched` entry per Mon at `MonInstance.hatchedAt`, sets `eggCreates: []` and rewrites v1 feed writes to the nested shape below. `SaveV1Schema` is frozen with its own feed shape.

**Journal.** Kinds `hatched`, `named`, `fed`, `rested`, `played`, `woke-rested`, each with `first`. Append-only; the entry id is `(monInstanceId, kind, at)`, so a replay appends nothing. No kind for absence, requests, needs-you or declines (D-15a). "Days together" counts local days with an entry at or before `nowMs`, so it only rises.

**Egg creations sit beside the care entries, not inside them.** They are keyed by `eggId` and cleared only by a `CreateEggResponse` for that egg. Sharing the care `seq` would let a care `ackedSeq` drop an egg create the egg endpoint never saw. A response whose `monInstanceId` is not `deriveMonInstanceId(eggId)` throws `HatchIntegrityError` (Law 6).

**Feed carries an optional `food: { foodClassId, nutrition }`.** Absent means "Share a meal" at `CareTuning.sharedMealNutrition`. This changes the `CareWriteSchema` wire shape for `feed`; no client shipped a feed write before this change, and the migration covers any queued v1 feed.

**Nicknames** use `MonNameSchema` (16 UTF-16 units, M07's character rule) in `MonInstance`, `EggRecord` and `CreateEggRequest`. No producer wrote a non-null nickname under v1, so the tighter schema rejects no existing save.

**Interim care tuning (D-15d).** Slower decay, a return floor of 0.2 that decay never crosses, and overfeeding judged on the after-meal value. Every number is `TODO(canon)` against Q19–Q21, Q25.

## Consequences

- The server must accept the nested `feed` shape and, to sync the journal across devices, a journal endpoint (platform lane). Neither exists yet.
- No endpoint accepts a nickname (§1.4). `nameActiveMon` is local-first and queues nothing; a `PATCH /v1/mons/:id` proposal (M09 B3) is open.
- The journal is not compacted. M18 proposes compacting non-first entries older than 90 days per local day, which needs the device time zone; deferred until size matters.
