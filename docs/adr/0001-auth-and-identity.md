# ADR 0001: Auth and identity

- **Status:** Proposed
- **Date:** 2026-10-04
- **Deciders:** Mike (creator) signs off; the `platform` agent implements
- **Spec:** `prompts/BUILD_PROMPT_v3.md` §1.4 (accounts and the server seam), §1.5 (age and consent), Law 5 and Law 6 in `prompts/LAWS.md`
- **Repo evidence:** `docs/REPO_MAP.md` §8

## Context

Phase 1 needs accounts because `monInstanceId` has to be server-authoritative. The Bible says so directly: "Cross-device state is authoritative server-side and must not create duplicate individuals" and "A device session is a surface, not a new creature" (`docs/canon/source/NYC_MON_Canon_and_Lore_Bible_v11.docx`, Cross-device companion continuity).

§1.4 asks for email + passkey, Sign in with Apple and Google, over whichever backend the repo already uses, and this server contract, versioned and zod-parsed:

```
POST /v1/eggs            → { eggId, monInstanceId (reserved), incubationEndsAt }
POST /v1/eggs/:id/hatch  → idempotent; returns the same MonInstance on retry
GET  /v1/me/mons         → MonInstance[]
PUT  /v1/mons/:id/care   → CareState delta with client seq number; server is tie-breaker
```

What the repo has (read at commit `42c3273`):

- **Payload CMS 4.0.0-canary.37 on Postgres**, mounted in `apps/web` (Next 16.3.8). Config: `packages/payload/src/payload.config.ts` (Postgres schema `payload`, REST at `/payload-api`). Admin and REST routes: `apps/web/app/(payload)/`.
- One auth collection, `packages/payload/src/collections/Users.ts`, with `auth: true`: Payload's local email + password strategy with JWT/cookie sessions.
- Payload's auth config accepts custom strategies, `strategies?: AuthStrategy[]`, where an `AuthStrategy` is `{ name, authenticate(args) }` and `args` carries the request `headers` and the `payload` instance (`packages/payload/node_modules/payload/dist/auth/types.d.ts`, lines 142–165 and 242). The Local API exposes `payload.auth({ headers })`, which runs those strategies (`dist/index.d.ts`, line 328). Docs: https://payloadcms.com/docs/authentication/custom-strategies
- No Better Auth, Supabase, Firebase, Clerk or Auth.js anywhere. No passkey, Apple or Google support. No auth client in `apps/mobile`. No `/v1` routes. `zod` 4.6.5 is installed only in `apps/web`.

So the backend question is settled by the repo: Payload on Postgres. The open question is how to get passkey, Apple and Google on top of it, because Payload ships only the local strategy and API keys.

## Options

**A. Payload alone, hand-rolled strategies.** Write a WebAuthn ceremony, Apple and Google ID-token verification (JWKS fetch, audience, nonce) and account linking as Payload custom strategies.
Cost: we would own the most security-sensitive code in the product, including Apple's native nonce quirk (the iOS SDK hashes the nonce before it lands in the token).

**B. Better Auth for identity, Payload stays the backend.** Better Auth runs inside `apps/web` against the same Postgres database in its own schema. It provides the passkey plugin, Apple and Google ID-token sign-in from native, and an Expo client that stores the session in `expo-secure-store`. A Payload custom `AuthStrategy` reads the Better Auth session from the request headers and returns the matching Payload `users` document, so every Payload access rule and every `/v1` handler sees one `req.user`.
Docs: https://www.better-auth.com/docs/plugins/passkey · https://www.better-auth.com/docs/integrations/expo · https://www.better-auth.com/docs/authentication/apple · https://www.better-auth.com/docs/authentication/google
Cost: one new dependency family (`better-auth`, `@better-auth/expo`, `@better-auth/passkey`) and a bridge between two user tables.

**C. Move to a hosted auth/backend (Supabase, Firebase, Clerk).** Rejected: it abandons the Payload + Postgres stack the repo standardises on and splits Mon data from the CMS that will hold `content/` publishing later.

## Decision (proposed)

Take **option B**.

1. **Backend:** Payload 4 on the existing Postgres stays the system of record for Callers and Mons. New collections: `callers` (profile, `birthYear`, consent state; linked 1:1 to `users`), `eggs`, `mon-instances`, `care-events`.
2. **Identity:** Better Auth owns sign-in (email + passkey first, Apple, Google). Email + password stays available through Better Auth so the single-screen M03 design works; Payload's own local strategy is kept only for the admin panel.
3. **Bridge:** a custom Payload strategy named `better-auth` calls Better Auth's session lookup with the incoming headers, then finds or creates the `users` row keyed on the Better Auth user id. On mobile the request carries the session the Expo client attaches.
4. **`/v1` routes:** Next.js route handlers in `apps/web/app/v1/**` (https://nextjs.org/docs/app/building-your-application/routing/route-handlers). Each handler calls `payload.auth({ headers })` for the user, parses the body with the zod schema from `packages/core`, and writes through the Payload Local API (https://payloadcms.com/docs/local-api/overview). This keeps the contract at `/v1/...` rather than under `/payload-api`.
5. **`packages/auth`** (`@acme/auth`) is the provider abstraction the app imports: `signIn(provider)`, `signOut()`, `useSession()`, and a typed `/v1` client whose responses are zod-parsed. Apps never import Better Auth or Payload directly.

Before implementation, `platform` installs Better Auth, reads its types and source in `node_modules` (Law 2), and records the versions here. None of it is installed today, so every Better Auth API named above is from its docs and still unverified against installed source.

## Mapping the §1.4 contract

| Endpoint | Behaviour |
|---|---|
| `POST /v1/eggs` | Body: `{ eggId, incubationMinutes: 15 \| 30 \| 60 }`, `eggId` generated by the client. In one transaction: insert the `eggs` row (unique on `eggId`), reserve `monInstanceId`, set `incubationEndsAt = serverNow + minutes`. A repeat with the same `eggId` from the same Caller returns the stored row unchanged. |
| `POST /v1/eggs/:id/hatch` | In one transaction, lock the egg row. If the egg is already hatched, return the existing `MonInstance`. Otherwise check `incubationEndsAt <= serverNow`, insert the `mon-instances` row with the reserved id (unique on `eggId`), mark the egg hatched, return it. Retries, double notification taps and a second device all land on the "already hatched" branch. |
| `GET /v1/me/mons` | The Caller's `MonInstance[]`. A new device session reads this; it never mints a Mon. |
| `PUT /v1/mons/:id/care` | Body: `{ seq, delta, clientTime }`. The server stores `lastAppliedSeq` per Mon, ignores any `seq <= lastAppliedSeq` (returns current state, not an error), applies the rest in order through the sim core, and returns the authoritative `CareState`. When two devices disagree, the server's replay wins. |

Transactions use Payload's database transactions (https://payloadcms.com/docs/database/transactions). The unique indexes on `eggs.eggId` and `mon-instances.eggId` are the backstop: if two hatch requests race past the lock, the second insert fails on the constraint and the handler returns the row that won.

## Offline and idempotent hatch

- The sim runs locally. Writes queue in MMKV with a monotonic `seq` and replay in order on reconnect (§1.4).
- **Egg created offline.** The client generates `eggId` as a UUIDv7 and derives `monInstanceId = UUIDv5(NYC_MON_NAMESPACE, callerId + ":" + eggId)` (RFC 9562, https://www.rfc-editor.org/rfc/rfc9562). This is the "server-replayable deterministic function" Law 6 allows: when the queued `POST /v1/eggs` arrives, the server recomputes the same UUIDv5 and rejects the request if the client's value differs. The id never depends on device or session, so a reinstall or a second device derives the same one for the same egg.
- **Hatch offline.** The client may play the hatch and show the Baby using the derived id. The queued hatch call settles it server-side; because the id was fixed at egg creation, the server either confirms that Mon or returns the one that already exists. It never creates a second.
- **Skip, process death, notification tapped twice.** All read hatch state from the sim and server, not from animation progress, so they cannot change the outcome (§3.5).
- Every mutating `/v1` call also sends an `Idempotency-Key` header (https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/) so a retried request returns the first response.

## Age and consent (§1.5)

`callers.birthYear` is set at sign-up (M04). Under-13 accounts are created in a limited state until a guardian approves through an emailed link (M05); the `/v1` handlers check that state. COPPA guidance: https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy. Notifications stay local (`expo-notifications`, not installed yet), so no push token is collected in Phase 1.

## Consequences

- One Postgres database, two schemas (`payload`, Better Auth's). Account deletion (M20) has to remove both, plus the Caller's Mons after the 7-day grace period.
- If email verification is made mandatory, a working email sender must exist in every environment first; otherwise new accounts cannot sign in.
- Payload 4 is a canary build and React Native is on 0.88.0-rc.3. Any Payload API this ADR names is re-read in `node_modules` at implementation time.
- Sign in with Apple on iOS needs the native button (https://docs.expo.dev/versions/latest/sdk/apple-authentication/) and the Apple capability in `apps/mobile/app.config.ts`; Google needs per-platform OAuth client ids. Neither is configured.
- Phase 2 surfaces (XR, Alexa+) authenticate through the same Better Auth session and read the same `/v1` data, which is what the Bible's cross-device rule requires.

## Open questions for Mike

1. Approve adding Better Auth (option B), or prefer hand-rolled strategies on Payload alone (option A)?
2. Which email provider sends magic links, verification and guardian-consent mail?
