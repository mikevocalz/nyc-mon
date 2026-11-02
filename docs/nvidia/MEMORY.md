# Caller-controlled durable companion memory

This is an additive feature inside the existing Payload/Neon backend, not a new auth system or database. The SQL table lives in a manually managed `nycmon_companion` namespace in the SAME database. Keeping it outside the generated `payload` namespace prevents subsequent Payload schema generation from owning or deleting it.

Only explicitly approved preferences are persisted: response language/style, interests, and an optional short note. No transcript, hidden inferred profile, credential or voice enrollment is stored. Reads/writes must use `authenticateCaller`; owner IDs never come from the JSON body. Every operation enforces the existing conservative adult/guardian/deletion checks. MCP exposes reading only; the model must not grant consent for a write.

Saving requires `consent: true` from a user-operated control. Forgetting removes the preference contents and retains only a revision tombstone, preventing stale requests from reviving forgotten text. Account deletion cascades through the foreign key to `payload.users`. Compare-and-swap revisions prevent concurrent sessions from silently overwriting one another. Read is also the JSON export operation. Error responses and logs must not reveal stored personal content.

## Remaining wiring / review gates

- [ ] Register migration `20261024_164500_companion_memory` and review on a disposable database.
- [ ] Add exact GET/PUT/DELETE route and authenticated service-route scope; do not broaden all `/v1` access.
- [ ] Wire simulator bearer-token proxy and explicit save/forget controls; never add a model-controlled save tool.
- [ ] Include consented memory as untrusted data, never as system-level instructions.
- [ ] Run real adult-account, second-session, ownership, and deletion acceptance tests.
- [ ] Obtain migration approval before applying to Neon. This PR applies nothing.

The store and handler unit tests use fakes. `companion-memory.pg.test.ts` needs `NVIDIA_TEST_DATABASE_URL` pointing only to a local disposable database named `nycmon_nvidia_test`. A skipped database suite is not a database pass. Public submission export must not include users, credentials, sample personal records, or private assets.
