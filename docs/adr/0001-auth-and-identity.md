# ADR 0001: Auth and identity

- **Status:** Accepted (2026-10-04). Implemented on a fork of the plugin until upstream merges Payload 4 support; see "Compatibility gate".
- **Date:** 2026-10-04
- **Deciders:** Mike (creator) decided; the `platform` agent implements
- **Decisions recorded:** `docs/canon/DECISIONS.md` #2 (auth) and #3 (email)
- **Spec:** `prompts/BUILD_PROMPT_v3.md` §1.4 (accounts and the server seam), §1.5 (age and consent), Laws 2, 5 and 6 in `prompts/LAWS.md`
- **Repo evidence:** `docs/REPO_MAP.md` §8

## Context

Phase 1 needs accounts because `monInstanceId` has to be server-authoritative. The Bible: "Cross-device state is authoritative server-side and must not create duplicate individuals" and "A device session is a surface, not a new creature" (`docs/canon/source/NYC_MON_Canon_and_Lore_Bible_v11.docx`, Cross-device companion continuity).

§1.4 asks for email + passkey, Sign in with Apple and Google over the backend the repo already uses, and this contract, versioned and zod-parsed:

```
POST /v1/eggs            → { eggId, monInstanceId (reserved), incubationEndsAt }
POST /v1/eggs/:id/hatch  → idempotent; returns the same MonInstance on retry
GET  /v1/me/mons         → MonInstance[]
PUT  /v1/mons/:id/care   → CareState delta with client seq number; server is tie-breaker
```

The backend is Payload CMS `4.0.0-canary.37` on Postgres, mounted in `apps/web` (Next `16.3.8`, React `19.3.0`). Config: `packages/payload/src/payload.config.ts`, Postgres schema `payload`, REST at `routes.api = '/payload-api'`. One auth collection today, `packages/payload/src/collections/Users.ts`, using Payload's local strategy.

## Decision

Better Auth (https://www.better-auth.com/docs) owns identity, running inside Payload through **`@delmaredigital/payload-better-auth`** (https://github.com/delmaredigital/payload-better-auth, docs https://delmaredigital.github.io/payload-better-auth/). Transactional email goes through **Resend** (https://resend.com/docs). Mike chose both on 2026-10-04.

This replaces the earlier proposal of a separate Better Auth schema bridged to Payload by a hand-written strategy. The plugin gives us that bridge, maintained upstream, and keeps one user table.

### How the plugin fits (read from its source at commit `311ce2e`, version 0.13.1)

- **`payloadAdapter({ payloadClient })`** is a Better Auth database adapter that stores Better Auth's models through the Payload Local API (`src/adapter/index.ts`). Users, sessions, accounts, verification tokens and passkeys become Payload collections in our existing `payload` schema, so Payload migrations own the tables.
- **`betterAuthCollections({ betterAuthOptions, skipCollections: ['user'] })`** generates those collections from Better Auth's schema (`src/adapter/collections.ts`). We keep writing `users` by hand so it can carry `birthYear` and consent state.
- **`createBetterAuthPlugin({ createAuth })`** builds the Better Auth instance from the live `payload` and mounts Better Auth's handler as Payload endpoints (`src/plugin/index.ts`).
- **`betterAuthStrategy()`** is a Payload `AuthStrategy`. Its `authenticate({ payload, headers, canSetHeaders })` calls `auth.api.getSession({ headers })` and returns the matching `users` document, so `req.user` and `payload.auth({ headers })` both see the Better Auth user (`src/plugin/index.ts`, around line 1132). `users` sets `auth: { disableLocalStrategy: true, strategies: [betterAuthStrategy()] }`, so the Payload admin also signs in through Better Auth.
- **Mount path.** The plugin mounts Better Auth at `routes.api` + its auth base path. Ours is `/payload-api`, so Better Auth's `basePath` must be `/payload-api/auth`; the plugin README documents this and logs the expected value at startup if they disagree (https://github.com/delmaredigital/payload-better-auth#3-payload-config).

### Providers

| Provider | Better Auth piece | Notes |
|---|---|---|
| Email + password | `emailAndPassword: { enabled: true }` | Needed for the single-screen M03 design. Reset mail via Resend. |
| Passkey | `@better-auth/passkey` (an optional peer of the plugin) | https://www.better-auth.com/docs/plugins/passkey. `rpID` is the web domain; iOS and Android need associated domains / asset links for it. |
| Sign in with Apple | `socialProviders.apple` | https://www.better-auth.com/docs/authentication/apple. On iOS the native button (https://docs.expo.dev/versions/latest/sdk/apple-authentication/) hands Better Auth an ID token. Apple's issuer is `https://appleid.apple.com`. |
| Google | `socialProviders.google` | https://www.better-auth.com/docs/authentication/google. Per-platform OAuth client ids. |

Mobile uses Better Auth's Expo integration (https://www.better-auth.com/docs/integrations/expo): the server adds the `expo()` plugin and the app scheme to `trustedOrigins`; the client stores the session in `expo-secure-store` and sends it as a cookie header on `/v1` calls. `betterAuthStrategy` reads that header the same way it reads a browser cookie.

Installed and read in `node_modules` (Law 2): `better-auth` 1.7.7, `@better-auth/passkey` 1.7.7, `resend` 6.32.0. `@better-auth/expo` is not installed yet; it lands with the mobile wiring, so the Expo details above are still from its docs.

### `@acme/auth`

`packages/auth` (`@acme/auth`, repo law R2) is the only auth surface the apps import: `signIn(provider)`, `signUp`, `signOut()`, `useSession()`, and a typed `/v1` client whose responses are zod-parsed (Law 5). It wraps the Better Auth React client on web and the Expo client on mobile. Apps never import `better-auth`, the plugin or Payload directly.

## Compatibility gate

**Verdict: `@delmaredigital/payload-better-auth@0.13.1` (npm latest) does not support our Payload.** Checked 2026-10-04.

1. **Peer range.** It declares `payload`, `@payloadcms/next` and `@payloadcms/ui` as `>=3.69.0 <4`. `4.0.0-canary.37` fails that range under semver, with or without `includePrerelease`. The `next` (`>=15.5.16 <17`) and `react` (`>=19.2.1 <20`) peers accept our `16.3.8` and `19.3.0`. `better-auth` must be `>=1.7.0 <2`; npm latest is `1.7.7`.
2. **Type errors against Payload 4.** Cloned at `311ce2e`, installed with `payload`, `@payloadcms/next` and `@payloadcms/ui` overridden to `4.0.0-canary.37`, `next 16.3.8` and `react 19.3.0`, then ran `tsc --noEmit`: 19 errors, all in the admin UI layer plus one helper.
   - `@payloadcms/next/templates` no longer exists in v4 (its exports are `./css ./withPayload ./layouts ./routes ./auth ./utilities ./views`). `DefaultTemplate` moved to `@payloadcms/ui/rsc`. Three management views (`ApiKeysView`, `PasskeysView`, `TwoFactorView`) import it. That is also a **runtime** failure: the plugin injects the API-keys view into the admin config whenever the api-key plugin is enabled.
   - `@payloadcms/ui` v4 renamed `Button` props: `size="small"` is gone (`medium | large`) and `buttonStyle="error"` is now `"destructive"`. `Banner` `type="error"` / `"info"` are now `"danger"` / `"default"`. These hit `PasskeysManagementClient` and `TwoFactorManagementClient`.
   - `src/utils/access.ts:286` indexes `req.user[idField]`; v4's `AuthenticatedUser` has no string index signature.
3. **What passed.** The adapter, the collection generator and `betterAuthStrategy` compile clean against Payload 4, and the plugin's own suite passes on Payload 4: 45 files, 434 tests. Most of those tests mock Payload, so this does not prove the adapter against a live Payload 4 database.

**What's needed, fixed in the library (not patched around in the app):** a Payload 4 line of the plugin. A port that clears both checks exists in the session scratchpad as `payload-better-auth-payload4.patch`: 8 edits across 6 files (the import move, the prop renames, one typed index). After it, `tsc --noEmit` exits 0 and all 434 tests pass on Payload 4. The renamed props do not exist in Payload 3, so upstream cannot ship it under the current `<4` range; it needs a v4 release line with the peer widened to `>=4.0.0-canary <5`. The route is a fork under Mike's GitHub with a PR to `delmaredigital/payload-better-auth`, then a catalog pin to the fork commit (the same pattern as `@reactvision/react-viro` in `pnpm-workspace.yaml`) until upstream publishes. The upstream fix also needs a cleaner type for `access.ts` than the cast in the scratch patch.

**Status of the fix (2026-10-04).** Mike approved the fork. The port is PR https://github.com/delmaredigital/payload-better-auth/pull/43 from https://github.com/mikevocalz/payload-better-auth (branch `payload-4-port`). nyc-mon pins the fork's `payload-4-dist` branch, which is the PR head plus its built `dist/`, because pnpm does not build a git dependency that only declares `prepublishOnly`. The pin lives in the `pnpm-workspace.yaml` catalog, next to the `@reactvision/react-viro` fork pin.

Booting against Postgres found a fourth Payload 4 break the type check and unit tests missed. Payload 4 changed the Local API's `overrideAccess` default from `true` to `false`. `betterAuthStrategy` runs before `req.user` exists, so its `users` lookup was access-checked as anonymous, threw `Forbidden`, and every request came back unauthenticated even with a valid session. The fork passes `overrideAccess: true` on the strategy's seven lookups, and the strategy test mock now rejects calls without it (8 tests fail on the old code). Plugin checks on Payload 4 after the fix: `tsc` exit 0, 45 files and 434 tests pass, build exit 0.

## The §1.4 contract on top

`/v1` lives in Next route handlers under `apps/web/app/v1/**` (https://nextjs.org/docs/app/api-reference/file-conventions/route), outside `/payload-api` so the contract path stays stable. Each handler:

1. calls `payload.auth({ headers: req.headers })`. That runs `betterAuthStrategy`, which returns the Caller's `users` doc or `null` (401). Per the plugin README this read does not refresh the session, so handlers never write a cookie the database didn't issue.
2. checks consent state on the user (see §1.5 below) and returns 403 `CONSENT_REQUIRED` if the account is pending.
3. parses the body with the zod schema from `@acme/core` (Law 5).
4. writes through the Payload Local API inside a transaction (https://payloadcms.com/docs/database/transactions).

| Endpoint | Behaviour |
|---|---|
| `POST /v1/eggs` | Body `{ eggId, monInstanceId, incubationMinutes: 15 \| 30 \| 60 }`, ids generated by the client. Server recomputes `monInstanceId` (below) and rejects a mismatch. In one transaction, insert the `eggs` row (unique on `eggId`), store the reserved `monInstanceId`, set `incubationEndsAt = serverNow + minutes`. A repeat with the same `eggId` from the same Caller returns the stored row unchanged. |
| `POST /v1/eggs/:id/hatch` | In one transaction, lock the egg row. Already hatched: return the existing `MonInstance`. Otherwise require `incubationEndsAt <= serverNow`, insert `mon-instances` with the reserved id (unique on `eggId`), mark the egg hatched, return it. Retries, double notification taps and a second device all land on the "already hatched" branch. |
| `GET /v1/me/mons` | The Caller's `MonInstance[]`. A new device session reads this; it never mints a Mon. |
| `PUT /v1/mons/:id/care` | Body `{ seq, delta, clientTime }`. The server keeps `lastAppliedSeq` per Mon, ignores `seq <= lastAppliedSeq` (returns current state, not an error), applies the rest in order through the sim core, and returns the authoritative `CareState`. |

The unique indexes on `eggs.eggId` and `mon-instances.eggId` are the backstop: if two hatch requests race past the lock, the second insert fails on the constraint and the handler returns the row that won.

### Idempotent hatch and offline play

- The sim runs locally. Writes queue in MMKV with a monotonic `seq` and replay in order on reconnect (§1.4).
- **Egg created offline.** The client generates `eggId` as a UUIDv7 and derives `monInstanceId = UUIDv5(NYC_MON_NAMESPACE, callerId + ":" + eggId)` (RFC 9562, https://www.rfc-editor.org/rfc/rfc9562). `callerId` is the Better Auth user id, which is stable across devices and reinstalls. This is the "server-replayable deterministic function" Law 6 allows.
- **Hatch offline.** The client may play the hatch with the derived id. The queued hatch call settles it server-side and either confirms that Mon or returns the existing one. It never creates a second.
- **Skip, process death, notification tapped twice** read hatch state from the sim and the server, never from animation progress (§3.5).
- Every mutating `/v1` call sends an `Idempotency-Key` header (https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/) so a retried request returns the first response.
- **Signing in on a second device** changes nothing about the Mon: the session is a surface, and `GET /v1/me/mons` is the only way a device learns which Mon it shows.

## Age and consent (§1.5)

COPPA applies to under-13s: FTC guidance https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy and the rule at https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312.

- **Neutral birth-year gate before any account exists.** The year picker has no default and no hint about which answer unlocks what, per the FTC's COPPA FAQ (https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions). A birth year alone can't separate 12 from 13, so `currentYear - birthYear <= 13` takes the consent path.
- **13 and over:** normal sign-up with any provider. `birthYear` is a `users` field and a Better Auth `additionalFields` entry with `input: true`; a `databaseHooks.user.create.before` hook rejects sign-up without it.
- **Under 13:** no Better Auth account is created and no child email, Apple or Google identity is collected. The app collects only the parent's email, which 16 CFR 312.5(c)(1) allows for the purpose of seeking consent, and stores a `guardian-consents` record (`parentEmail`, `birthYear`, `status: pending`, `expiresAt`). Resend sends the consent mail. The child keeps playing locally: the sim needs no server, and queued writes wait. On approval, the account is created in a consented state and the queue replays. If nobody approves before `expiresAt`, the record and the parent email are deleted, as 312.5(c)(1) requires.
- **Consent method** (email-plus or a stronger one under 312.5(b)) is a legal call and goes to counsel before launch. The data model doesn't depend on which one.
- No behavioural ads. Notifications are local only (`expo-notifications`), so Phase 1 collects no push token.

## Email and the verification lockout guard

Resend sends verification, password reset and guardian consent mail from one server module in `packages/payload`. `emailVerification.sendVerificationEmail` and `emailAndPassword.sendResetPassword` both call it.

Better Auth can lock every account out with no error at config time. Read from `better-auth@1.7.2` source (`dist/api/routes/sign-in.mjs`, around line 341) in another project on 2026-09-22; re-read in our installed version before relying on it (Law 2):

- `requireEmailVerification: true` with no `sendVerificationEmail` refuses every unverified sign-in with `EMAIL_NOT_VERIFIED`, forever, and nothing can verify the account.
- `sendOnSignIn` has no default, so it is false unless set. Without it, an account that signed up while mail was broken never gets another link.

Re-read in the installed `better-auth@1.7.7` (`dist/api/routes/sign-in.mjs`, lines 339–351): unchanged. `sendOnSignIn` is typed `@default false` in `@better-auth/core` `dist/types/init-options.d.mts`.

Rules (implemented in `packages/payload/src/auth/options.ts` unless noted):

1. `requireEmailVerification` stays `false` until Resend sends from a verified domain in that environment.
2. When it is turned on, `emailVerification.sendOnSignIn: true` is set explicitly.
3. **Boot fails loud:** the auth config throws at startup if `requireEmailVerification` is true and the Resend key or sender address is missing. A crash on deploy is better than a silent lockout.
4. Clients check `res.error?.code`. `authClient.signIn.email()` resolves with `{ data, error }` and does not throw, so a `try/catch` catches nothing.
5. Every password-reset request passes `redirectTo`, and its origin is in `trustedOrigins`. Without it the emailed link carries an empty `callbackURL` and lands on `INVALID_TOKEN`.
6. `advanced.backgroundTasks.handler` is set (Vercel `waitUntil`), so sending mail doesn't make a real account answer slower than an unknown one.

## What runs today (verified 2026-10-04)

Server: `packages/payload/src/auth/` (`env.ts`, `email.ts`, `age.ts`, `options.ts`), the `users` collection, and the two plugin entries in `payload.config.ts`. Better Auth answers at `/payload-api/auth/*`. Client: `@acme/auth` (`packages/auth`) wraps the Better Auth React client and the passkey client, and returns `{ ok, error }` from every call.

Checked by booting `apps/web` (`next dev`, Next 16.3.8) against a throwaway Postgres 16 cluster with `PAYLOAD_PUSH=true`:

| Request | Result |
|---|---|
| `GET /payload-api/auth/ok` | 200 `{"ok":true}` |
| `POST sign-up/email`, birth year 1999 | 200; user created, `role: user` (the first account became `admin` through `firstUserAdmin`) |
| `GET /payload-api/users/me` with the session cookie | 200; the Payload `users` doc via `betterAuthStrategy`, `consentStatus: not-required` |
| `POST sign-out`, then `users/me` | `user: null` |
| `POST sign-in/email`, wrong password | 401 `INVALID_EMAIL_OR_PASSWORD` |
| `POST sign-in/email`, then `users/me` | 200; same user |
| `POST sign-up/email`, birth year 2014 or 2015 | 403 `GUARDIAN_CONSENT_REQUIRED`; no row written |
| `POST sign-up/email`, birth year 3000 | 400 `INVALID_BIRTH_YEAR` |
| `POST request-password-reset` with no Resend config | 400 `RESET_PASSWORD_DISABLED` (loud, as intended) |
| `GET /admin/login` | 200; the plugin's login view (email and passkey) |

Not verified yet: passkey ceremonies, Apple and Google (no client ids), Resend delivery (no key), the Expo client, and the guardian-consent flow, which is designed above but not built.

## Consequences

- One Postgres schema (`payload`) holds Payload and Better Auth tables, and Payload migrations own both. Adding a Better Auth plugin means regenerating collections and writing a Payload migration.
- The Payload admin signs in through Better Auth. The first user becomes admin through the plugin's `firstUserAdmin` hook; that needs a deliberate seed in each environment.
- We depend on a third-party plugin's Payload 4 support. Payload 4 is a canary, so the fork is ours to keep green until upstream ships a v4 line.
- Account deletion (M20) removes the `users` row and its Better Auth sessions, accounts and passkeys, plus the Caller's Mons after the grace period.
- Sign in with Apple needs the Apple capability in `apps/mobile/app.config.ts`; Google needs per-platform client ids; passkeys need associated domains and asset links. None is configured.
- Phase 2 surfaces (XR, Alexa+) authenticate through the same Better Auth session and read the same `/v1` data, which the Bible's cross-device rule requires.

## Config the user provides (names only)

`DATABASE_URL`, `PAYLOAD_SECRET`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM` (a sender on a Resend-verified domain), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID` (Services ID), `APPLE_CLIENT_SECRET` (signed JWT from the Apple key), `APPLE_APP_BUNDLE_IDENTIFIER`, plus the iOS and Android Google client ids for native sign-in. These live in `.env.local` only; `.env.example` lists the names.
