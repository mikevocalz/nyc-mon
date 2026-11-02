# Judge seed

A new Caller's egg incubates for 15, 30 or 60 minutes before it can hatch, so a judge signing in to a fresh account would wait at least 15 minutes before the first care action. The judge seed prepares one dedicated judge account ahead of time so it already has a hatched Mon.

Code: `packages/payload/src/admin/console/v1/judge-seed.ts` (logic, tested in `__tests__/judge-seed.test.ts`) and `judge-seed-cli.ts` (entry point).

## What it does

1. Looks up the judge account by email. The account must already exist, created through the real sign-up flow. The seed never creates users.
2. If that account already has a Mon, it changes nothing and reports `already-seeded`. If it has an egg, it refuses (one egg per Caller).
3. Writes one starter egg (the first starter in `@acme/content/eggs`) with the shortest incubation, 15 minutes, already elapsed. This is the only shortcut: time.
4. Hatches that egg through the real `POST /v1/eggs/:id/hatch` handler using the service delegation the MCP server uses. The handler applies its own adult and guardian-consent checks, the egg integrity check and minting. A refused hatch is reported as `failed` with its status.

It never writes care state. The first care write starts from the hatchling state (awake, fullness 0.5), so a first `feed_mon` is eligible under the normal game rules. It never sets acceptance flags, never writes provider receipts and never touches any other account. A seeded Mon does not count as live evidence; the live runner (`scripts/nvidia-live.mjs --full`) still has to show a real model-selected care action and a persisted `/v1` change.

## Guards

The CLI exits 2 without writing anything unless all of these hold:

| Name | Requirement |
|---|---|
| `NVIDIA_JUDGE_SEED` | exactly `yes` |
| `DATABASE_URL` | PostgreSQL URL whose database name starts `nycmon_judge` or `nycmon_nvidia_test` (for example `nycmon_judge`, `nycmon_judge_oct30`). The production database is refused by name |
| `NVIDIA_JUDGE_CALLER_EMAIL` | the judge account's email |
| `V1_MCP_SERVICE_KEY` | at least 32 characters, the same key admin-vite checks |

The judge demo therefore needs its own database (for example a Neon branch named `nycmon_judge`) behind the hosted backend. That hosting choice is still pending approval.

## Run

From the repository root, with the judge database's env loaded the same way admin-vite loads it:

```
NVIDIA_JUDGE_SEED=yes NVIDIA_JUDGE_CALLER_EMAIL=<judge email> \
  pnpm --filter admin-vite payload run ../../packages/payload/src/admin/console/v1/judge-seed-cli.ts
```

Output is one line with the database name and the result (`seeded`, `already-seeded`, `refused` or `failed`) carrying only ids. Exit code 0 means seeded or already seeded.

## Verified so far

- 16 unit tests with an in-memory Payload (guards, the single egg write, the hatch request headers and path, no care/flag/receipt writes, existing Mon, existing egg, missing account, refused hatch).
- The CLI refuses through the real `payload run` command when the flag is missing and when the database is named `neondb`.
- Not yet run against a real judge database: no judge database or judge account exists yet.
