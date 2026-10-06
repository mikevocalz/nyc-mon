# ADR 0004: Auth methods, account merging, staff roles and device handoff

- **Status:** Accepted (2026-10-04). Mike answered the open questions the same day; see "Decisions recorded" below and `docs/canon/DECISIONS.md` #17–#22.
- **Date:** 2026-10-04
- **Deciders:** Mike (creator) decided the method list, AWS SNS for SMS and the COPPA rule for phones on 2026-10-04; the `platform` agent designs and implements
- **Builds on:** `docs/adr/0001-auth-and-identity.md` (Better Auth inside Payload, Resend, the `/v1` contract, age and consent), `docs/adr/0003-admin-app-split.md` (auth lives on the admin-vite host)
- **Closes:** admin blocker X2 / B2 (staff roles) from `docs/design/admin/06-critique.md` and `docs/design/admin/01-research.md`
- **Canon:** "A device session is a surface, not a new creature" (`docs/canon/source/NYC_MON_Canon_and_Lore_Bible_v11.docx`, Cross-device companion continuity); Laws 6 and 8 in `CONTRIBUTING.md`; `docs/canon/DECISIONS.md` #15
- **Implementation:** Phase B on branch `feat/auth-methods`. No code lands with this ADR.

## Context

ADR 0001 shipped email + password, passkey, Apple and Google. Mike asked on 2026-10-04 for:

1. two-factor (TOTP, backup codes, one-time codes by email or SMS),
2. phone-number verification,
3. usernames,
4. account linking and an explicit merge of two accounts,
5. Resend for every Better Auth email,
6. session handoff from a phone to a tablet, a Meta Quest or an Apple Vision Pro,
7. SMS through AWS SNS (`@aws-sdk/client-sns`) behind a small sender interface, with a console sender for development,
8. phone verification and SMS two-factor for Callers 13 and over only. An under-13 account never gives us a phone number (COPPA); it uses TOTP or the email path, and only after guardian consent.

The admin console design also needs staff roles. Today `users.role` is `user` or `admin`, so every staff member is a full admin (`docs/design/admin/06-critique.md` X2).

## Sources read (Law 2)

Installed `better-auth@1.7.7` and `@better-auth/core@1.7.7` under `node_modules/.pnpm/better-auth@1.7.7_*/node_modules/better-auth/dist`, and the pinned fork of `@delmaredigital/payload-better-auth` (`github:mikevocalz/payload-better-auth#5134d0b`). Paths below are relative to `better-auth/dist` unless they say otherwise.

| Piece | Installed source | Docs |
|---|---|---|
| Two-factor | `plugins/two-factor/{index,types.d,otp/index.d,totp/index.d,backup-codes/index.d}.mts` | https://www.better-auth.com/docs/plugins/2fa |
| Phone number | `plugins/phone-number/{types.d,routes,schema,index}.mjs` | https://www.better-auth.com/docs/plugins/phone-number |
| Username | `plugins/username/index.d.mts` | https://www.better-auth.com/docs/plugins/username |
| Passkey | `@better-auth/passkey@1.7.7` (already wired) | https://www.better-auth.com/docs/plugins/passkey |
| Device authorization | `plugins/device-authorization/{index,routes,schema}.mjs` | https://www.better-auth.com/docs/plugins/device-authorization, RFC 8628 https://datatracker.ietf.org/doc/html/rfc8628 |
| One-time token | `plugins/one-time-token/index.mjs` | https://www.better-auth.com/docs/plugins/one-time-token |
| Bearer | `plugins/bearer/index.mjs` | https://www.better-auth.com/docs/plugins/bearer |
| Account linking | `oauth2/link-account.mjs`, `api/routes/account.mjs`; options in `@better-auth/core/dist/types/init-options.d.mts` lines 1068–1150 | https://www.better-auth.com/docs/concepts/users-accounts#account-linking |
| Sessions | `api/routes/session.mjs` (`/list-sessions`, `/revoke-session`, `/revoke-sessions`, `/revoke-other-sessions`) | https://www.better-auth.com/docs/concepts/session-management |
| Rate limits | `@better-auth/core/dist/types/init-options.d.mts` (`rateLimit.storage`), plugin `rateLimit` arrays | https://www.better-auth.com/docs/concepts/rate-limit |
| Expo client | `@better-auth/expo` is **not installed** | https://www.better-auth.com/docs/integrations/expo |
| Staff roles | fork `dist/plugin/index.d.ts` (`login.requiredRole`, `requireAllRoles`, `enableSignUp`, `enableManagementUI`), `dist/utils/access.js` (`normalizeRoles`, `hasAnyRole`), `dist/utils/firstUserAdmin.js` | https://github.com/delmaredigital/payload-better-auth |
| SMS | `@aws-sdk/client-sns` is **not installed** | https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/sns/command/PublishCommand/, https://docs.aws.amazon.com/sns/latest/dg/sms_publish-to-phone.html, https://docs.aws.amazon.com/sns/latest/dg/sns-sms-sandbox.html |
| Email | `resend@6.32.0` | https://resend.com/docs/api-reference/emails/send-email |
| COPPA | 16 CFR 312 | https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312 |

Every plugin Mike named ships in the installed `better-auth@1.7.7`. Device authorization exists as `better-auth/plugins/device-authorization`, so the headset flow is configuration plus screens, not a new protocol.

## Findings that shape the design

These came from reading the source, and several change what the request assumed.

1. **Two-factor only gates three sign-in paths.** The after-hook matches `/sign-in/email`, `/sign-in/username` and `/sign-in/phone-number` (`plugins/two-factor/index.mjs` line 246). Passkey, Apple, Google, one-time-token and device-authorization sign-ins never see a 2FA challenge. Passkey is already a possession-plus-biometric factor, and Apple and Google carry their own MFA. The design accepts this and says so on the 2FA setup screen.
2. **The 2FA one-time code has one sender for both channels.** `otpOptions.sendOTP({ user, otp })` has no channel argument (`two-factor/otp/index.d.mts`). Email versus SMS is our choice inside that callback. Once `sendOTP` is set, every 2FA user is offered `otp` (`index.mjs` lines 318–321).
3. **2FA has its own lockout.** `accountLockout` defaults to 10 failed second-factor checks, then 15 minutes locked (`types.d.mts`). The plugin rate-limits `/two-factor/*` to 3 requests per 10 s (`index.mjs` lines 338–344).
4. **Phone sign-up bypasses our age gate.** `phoneNumber({ signUpOnVerification })` creates a user from a phone number with a temporary email and no birth year (`routes.mjs`, verify handler). Our `user.create.before` hook lets a missing birth year through, because Apple and Google sign-ups lack it. We never enable `signUpOnVerification`.
5. **A one-time token hands over the same session, not a new one.** `/one-time-token/verify` looks up the session the token was minted from and sets that session's cookie (`one-time-token/index.mjs` lines 78–86). Two devices would share one session row: the device list shows one entry, and revoking the tablet signs out the phone. Tokens are stored in plain text by default (`storeToken: "plain"`).
6. **Device authorization creates a real session per device and returns it as a bearer token.** `/device/token` calls `createSession(user.id)` and answers `{ access_token: session.token, token_type: "Bearer" }` (`device-authorization/routes.mjs` around lines 455–472). The headset needs the `bearer` plugin, which turns `Authorization: Bearer` into the session cookie inside Better Auth's hooks (`bearer/index.mjs` lines 23–48). `client_id` is required, and `validateClient` can allowlist it. A code must be claimed by `GET /device?user_code=` before `/device/approve` accepts it (`DEVICE_CODE_NOT_CLAIMED`).
7. **Implicit linking already refuses unverified email on both sides.** `link-account.mjs` line 139 skips implicit linking unless the IdP says the email is verified (or the provider is in `trustedProviders`) **and** the local row has `emailVerified: true` (`requireLocalEmailVerified`, default true). Adding a provider to `trustedProviders` drops the IdP half of that check.
8. **Better Auth has no "merge two users" operation.** `linkSocial` attaches a provider to the signed-in user and fails with `SOCIAL_ACCOUNT_ALREADY_LINKED` or `LINKED_ACCOUNT_ALREADY_EXISTS` when that provider already belongs to another user. Merging two accounts is ours to build.
9. **Rate-limit storage defaults to memory.** On Vercel Functions each instance counts alone, so the limits barely hold. `rateLimit.storage: "database"` needs a `rateLimit` model; whether `betterAuthCollections` generates it from `getAuthTables` (fork `dist/adapter/collections.js` line 645) is checked in Phase B.
10. **The `/v1` care contract assumes one writer per Mon.** ADR 0001 keeps one `lastAppliedSeq` per Mon. A phone and a tablet each count their own `seq`, so the second surface's writes would be dropped as stale. See "The Mon follows the Caller".
11. **The plugin reads roles from `user.role` only.** The pinned fork has no `roleField` (that is upstream PR #44). `normalizeRoles` accepts an array or a single string and refuses comma-splitting (fork `dist/utils/access.js` lines 34–47). `LoginView` defaults `requiredRole` to `'admin'`.
12. **`firstUserAdmin` gives the first account in a database the admin role.** It is a `betterAuthCollections` option that defaults to on (fork `dist/adapter/collections.js` lines 635–638), and it also acts as the plugin's guard that forces client-supplied roles back to the default. In production the first Caller to sign up on mobile would become staff. Turning it off also turns off that guard, which the plugin warns about unless `acknowledgeRoleGuardDisabled: true` is set after `users.access.create` and the `role` field's `access.create` reject non-ops callers (lines 656–657).

## Decision

### 1. Methods and their plugins

All server plugins go into `betterAuthOptions.plugins` in `packages/payload/src/auth/options.ts`, so the Payload collection generator and the runtime see the same schema. Client plugins go into `buildClient` in `packages/auth/src/createAuth.ts`.

| Method | Server plugin (import path) | Client plugin | Configuration |
|---|---|---|---|
| Email + password | core `emailAndPassword` (existing) | core | unchanged; `minPasswordLength: 10`, `revokeSessionsOnPasswordReset: true` |
| Passkey | `@better-auth/passkey` (existing) | `passkeyClient` (existing) | unchanged. A passkey sign-in is not 2FA-gated (finding 1). |
| TOTP + backup codes | `twoFactor` from `better-auth/plugins/two-factor` | `twoFactorClient` from `better-auth/client/plugins` | `issuer: 'NYC-MON'`, `totpOptions: { digits: 6, period: 30 }`, `backupCodeOptions: { amount: 10, length: 10, storeBackupCodes: 'encrypted' }`, `allowPasswordless: false`, `skipVerificationOnEnable: false`, `accountLockout` defaults, `trustDeviceMaxAge: 30 days` |
| 2FA one-time code (email or SMS) | same `twoFactor`, `otpOptions` | same | `digits: 6`, `period: 5` (minutes), `allowedAttempts: 5`, `storeOTP: 'hashed'`. `sendOTP` picks the channel (below). |
| Phone verification | `phoneNumber` from `better-auth/plugins/phone-number` | `phoneNumberClient` | `otpLength: 6`, `expiresIn: 300`, `allowedAttempts: 3`, `phoneNumberValidator` (E.164 and the country allowlist), `requireVerification: false`, **no** `signUpOnVerification`, **no** `sendPasswordResetOTP` |
| Username | `username` from `better-auth/plugins/username` | `usernameClient` | `minUsernameLength: 3`, `maxUsernameLength: 20`, `usernameValidator` (below), `displayUsername: true`, `immutableUsername: false` |
| Account linking | core `account.accountLinking` | core `linkSocial`, `listAccounts`, `unlinkAccount` | below |
| Headset sign-in | `deviceAuthorization` from `better-auth/plugins/device-authorization` + `bearer` from `better-auth/plugins/bearer` | `deviceAuthorizationClient` on the phone (approve) and the headset (request, poll) | below |
| Tablet handoff | `oneTimeToken` from `better-auth/plugins/one-time-token`, wrapped (below) | `oneTimeTokenClient` | `expiresIn: 2` (minutes), `storeToken: 'hashed'`, `disableSetSessionCookie: true` |
| Change email | core `user.changeEmail` | core | `enabled: true`, `sendChangeEmailConfirmation` through Resend, `updateEmailWithoutVerification: false` |
| Mobile | `expo()` from `@better-auth/expo` (to install) | `expoClient` with `expo-secure-store` | the Expo app scheme joins `BETTER_AUTH_TRUSTED_ORIGINS` (ADR 0001) |

Paths disabled with `disabledPaths`: `/sign-in/phone-number`, `/phone-number/request-password-reset`, `/phone-number/reset-password`. A phone number is a verified contact and a 2FA channel, never a password and never a way to recover one. SMS recovery is open to SIM-swap, and phone sign-in would need the age gate on a path that has no birth year.

**`sendOTP` channel rule.** The Caller picks a channel at 2FA setup (M24), stored on `users.twoFactorOtpChannel` (`'email' | 'sms'`, default `'email'`). At send time the server sends by SMS only if that is the stored choice, the phone is verified, and the Caller passes the phone gate (section 4). Otherwise it sends email. If neither sender is configured in the environment, `otpOptions.sendOTP` is left unset and the plugin offers TOTP and backup codes only.

**2FA cannot lock anyone out.** Enabling 2FA always enrols TOTP and issues backup codes first; the one-time code is a second way in, never the only one. This follows the ADR 0001 lockout rule: a factor whose sender can fail is never someone's only factor.

**Username rules.** 3–20 characters, `[a-z0-9_.]`, normalised to lower case. The validator rejects anything that parses as an email address or as a phone number (7 or more digits), and runs the same blocklist as the M07 Caller name. A username is a sign-in handle. It is never shown to a Mon or to another Caller in Phase 1, and it is separate from the Caller name the Mon uses (M07). `/is-username-available` gets its own rate limit (section 6) because it answers whether an account exists.

### 2. Account linking

```ts
account: {
  accountLinking: {
    enabled: true,
    trustedProviders: [],            // never skip the IdP's email_verified check
    requireLocalEmailVerified: true, // default; written out so nobody flips it
    allowDifferentEmails: true,      // explicit linkSocial only; see below
    allowUnlinkingAll: false,
    updateUserInfoOnLink: false,
  },
  encryptOAuthTokens: true,
}
```

- **Implicit linking** (signing in with Google whose email matches an existing account) happens only when Google says the email is verified and the local account's email is verified (finding 7). With `trustedProviders: []` there is no exception. An unverified email is never auto-linked.
- **Explicit linking** (M28, "Add a sign-in method"): the Caller is signed in, the session is fresh (`session.freshAge`, set to 10 minutes), and they complete the provider's own sign-in. `allowDifferentEmails: true` applies only here. It is needed because Sign in with Apple's private relay address never matches the account email. The takeover risk the option warns about (someone holding a stolen session adds their own Google) is narrowed by the fresh-session rule, the 2FA challenge when 2FA is on, and a Resend notice to the account email: "Google sign-in was added to your NYC-MON account".
- **Unlinking** keeps at least one way in (`allowUnlinkingAll: false`) and sends the same kind of notice.

### 3. Merging two accounts

Merging is for a Caller who ends up with two accounts, for example an Apple relay account on the phone and an email account on the web. Better Auth has nothing for this (finding 8), so Phase B adds a small server plugin, `packages/payload/src/auth/plugins/account-merge.ts`, mounted at `/payload-api/auth/merge/*`.

**Rules**

1. Never automatic. A merge starts only from M28 and needs both accounts to prove themselves.
2. **Re-auth on both accounts.** Each side acts from a session younger than 10 minutes; if 2FA is on for that account, the session must have passed it.
3. **A Mon is never duplicated or deleted (Laws 6 and 8).** Every egg and MonInstance of the merged account moves to the surviving account with its `eggId`, `monInstanceId`, care state and history unchanged. Only the owner changes.
4. **Age and consent must agree.** Both accounts have `consentStatus: 'not-required'`. If both have a birth year, the years must match; if one is missing (a social sign-up), the other's year is kept. A mismatch refuses the merge with `MERGE_BIRTH_YEAR_MISMATCH`, because it usually means two people. Accounts created through guardian consent are not merged in Phase 1 (support handles them by hand; see "Needs Mike").
5. One transaction or nothing.

**Flow**

1. `POST /merge/start` from account A (fresh session). The server stores a verification row `merge:<id>` → A's id, valid 10 minutes, and returns an 8-character merge code. A chooses which account survives; the default is the account whose first Mon hatched earlier.
2. The Caller signs in as account B, on any device, fresh, and calls `POST /merge/claim { code }`. The server binds B to the request and returns what will move ("2 sign-in methods, 1 Mon, 0 eggs") so the screen can show it.
3. Back on A, `POST /merge/confirm { code }` with A's session still fresh. In one Payload transaction (`req` passed to every nested operation, payload skill "Transaction Failures in Hooks"):
   - consume the verification row, so a second confirm fails;
   - move B's `account` rows to the survivor. Where both have the same provider: a credential (password) row keeps the survivor's and drops the other; for Apple or Google the merge stops with `MERGE_PROVIDER_CONFLICT` and asks the Caller to unlink one first;
   - move B's passkeys. Keep the survivor's 2FA secret and backup codes and drop B's;
   - set `callerId` to the survivor on every egg and MonInstance B owns, and add B's id to the survivor's `callerAliases` (below);
   - delete all of B's sessions, then B's `users` row;
   - write one `audit-events` row (`action: 'account.merged'`, ids only) and one `account-merges` row (`survivorId`, `mergedId`, `monInstanceIds[]`, `eggIds[]`, `at`).
4. Resend sends a notice to both addresses.

**Why `callerAliases`.** An offline egg's `monInstanceId` is `UUIDv5(NYC_MON_NAMESPACE, callerId + ":" + eggId)` (ADR 0001). An egg queued on B's phone before the merge carries an id derived from B's `callerId`. After the merge that phone gets a 401, the Caller signs in as the survivor, and the queue replays. `POST /v1/eggs` and `/hatch` must accept a derivation from the survivor's id **or any id in `callerAliases`**, and must keep the id the client sent instead of re-deriving it. Without this, the replay is rejected or the server mints a second `monInstanceId` for the same egg: the duplicate Law 6 calls a P0.

**Merging more than one starter.** If both accounts hatched a starter, the survivor owns two Mons after the merge. Nothing is deleted (Law 8). Mike decided both are kept and Home asks which one is active (DECISIONS #18). The choice is stored as `users.activeMonInstanceId`, set only by the Caller.

### 4. COPPA rules per method

ADR 0001's gate applies: `needsGuardianConsent(birthYear, currentYear)` is true for any year that could belong to someone under 13 (`currentYear - birthYear <= 13`). The **phone gate** passes only when all three hold: `consentStatus === 'not-required'`, `birthYear` is set, and `needsGuardianConsent(birthYear, now)` is false. A missing birth year fails the gate. An account created through guardian consent (`consentStatus: 'approved'`) passes only when the birth year is out of the consent range **and** `phoneConsentAt` is set by a second guardian approval (DECISIONS #21).

| Method | 13 and over | Under 13 (after guardian consent only) |
|---|---|---|
| Email + password | yes | no; the account's email is the guardian's verified address, for recovery only, and the account has no password (DECISIONS #17) |
| Passkey | yes | yes; holds no personal data on our side beyond the public key |
| Apple / Google | yes | no; ADR 0001 collects no child Apple or Google identity |
| TOTP + backup codes | yes | yes |
| 2FA code by email | yes | yes, sent to the guardian's address, never a child address |
| 2FA code by SMS | yes, when the phone gate passes | **never** |
| Phone verification | yes, when the phone gate passes | **never**; no field, no endpoint call |
| Username | yes | yes, with the validator above (no email or phone shapes), because a username can become contact info |
| Account linking | yes | no; nothing to link without Apple or Google |
| Merge | yes, rule 4 above | no in Phase 1 |
| Headset / tablet handoff | yes | yes; approving a device adds no personal data |

**Server enforcement, not UI hiding.** A `hooks.before` middleware in `options.ts` refuses `/phone-number/send-otp` and `/phone-number/verify` with 403 `PHONE_NOT_ALLOWED` when the session user fails the phone gate. A `databaseHooks.user.update.before` hook refuses any write that sets `phoneNumber` on such a user, which covers `/update-user` and admin edits. `sendOTP` re-checks the gate before using SMS and falls back to email. Tests cover each refusal (Phase B).

### 5. Resend for every Better Auth email

All mail goes through `createAuthMailer` in `packages/payload/src/auth/email.ts`, extended to send `html` and `text`. Templates live in `packages/payload/src/auth/templates/`, one file per mail, each a pure function returning `{ subject, html, text }`. Copy comes from the `ux-copy` pass and the copy deck, not from this ADR.

| Mail | Trigger (Better Auth option) |
|---|---|
| Confirm your email | `emailVerification.sendVerificationEmail` (existing) |
| Reset your password | `emailAndPassword.sendResetPassword` (existing) |
| Confirm a new email address | `user.changeEmail.sendChangeEmailConfirmation` (new) |
| Your sign-in code (2FA) | `twoFactor.otpOptions.sendOTP`, email channel |
| A sign-in method was added or removed | `databaseHooks.account.create.after` / `delete.after` (link, unlink) |
| A new device was signed in | `databaseHooks.session.create.after` when the path is `/device/token` or the handoff redeem |
| Your accounts were merged | the merge plugin, to both addresses |
| Guardian consent request | the consent flow (ADR 0001) |

Every send runs through `advanced.backgroundTasks.handler` (Vercel `waitUntil`, already wired) so mail timing does not reveal whether an account exists. The ADR 0001 lockout guard stays: `AUTH_REQUIRE_EMAIL_VERIFICATION=true` without `RESEND_API_KEY` and `AUTH_EMAIL_FROM` fails the boot. Security notices (method added, new device, merge) need a sender like every other mail. Without Resend those flows still work, but the notice is skipped and the skip is logged. Production must have Resend before linking, merging or device approval are switched on; the boot check in Phase B enforces that pairing.

### 6. SMS through AWS SNS

`packages/payload/src/auth/sms.ts`:

```ts
/** Sends one SMS. Resolves when the provider accepted it; rejects otherwise. */
export interface SmsSender {
  send(message: { toE164: string; body: string }): Promise<void>;
}
```

- `createSnsSmsSender(env)` uses `SNSClient` + `PublishCommand` from `@aws-sdk/client-sns` with `PhoneNumber`, `Message`, and the message attributes `AWS.SNS.SMS.SMSType = Transactional` and, when set, `AWS.MM.SMS.OriginationNumber` (https://docs.aws.amazon.com/sns/latest/dg/sms_publish-to-phone.html). The dependency is added through the pnpm catalog.
- `createConsoleSmsSender()` prints `[sms] to=+1•••••••1234 code=123456` to the server log. Phase B tests and local runs use it.
- `createSmsSender(env)` returns SNS when `AUTH_SMS_TRANSPORT=sns`, the console sender when `AUTH_SMS_TRANSPORT=console`, and `undefined` when unset. **The boot fails** if `NODE_ENV=production` and the transport is `console`. With `undefined`, the `phoneNumber` plugin is not registered and the SMS channel is not offered, so no endpoint exists that cannot deliver.
- Message body: the code and the app name only. No link, no name, no Mon.

**Toll fraud.** Paid SMS endpoints attract SMS pumping. Besides the rate limits below: `phoneNumberValidator` accepts E.164 numbers in `AUTH_SMS_ALLOWED_COUNTRIES` only (`US,CA`, DECISIONS #19), and the server counts sends per number and per user in the `verification` table, capping at 5 per number per 24 hours and 10 per user per 24 hours.

Env names (values in `.env.local` and the admin-vite Vercel project only): `AUTH_SMS_TRANSPORT` (`sns` | `console`), `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (or the Vercel AWS integration's role instead of keys), `AWS_SNS_ORIGINATION_NUMBER`, `AUTH_SMS_ALLOWED_COUNTRIES`.

### 7. Rate limits

`rateLimit: { enabled: true, storage: 'database' }` so limits hold across Vercel instances (finding 9). If the collection generator does not produce the `rateLimit` model, Phase B adds it as a hand-written collection like `users`. Limits:

| Path | Window | Max | Source |
|---|---|---|---|
| everything else | 10 s | 100 | Better Auth default |
| `/sign-in/*`, `/sign-up/*`, `/change-password`, `/change-email` | 10 s | 3 | Better Auth default for sensitive paths |
| `/sign-in/email`, `/sign-in/username` | 60 s | 5 | `customRules` |
| `/two-factor/*` | 10 s | 3 | plugin; plus `accountLockout` 10 failures → 15 min |
| `/phone-number/*` | 60 s | 10 | plugin; plus the per-number and per-user daily caps above |
| `/is-username-available` | 60 s | 10 | `customRules` |
| `/device/code` | 60 s | 5 | `customRules` |
| `/device` (verify) | 30 min | 5 | plugin (window = `expiresIn`) |
| `/device/token` | — | — | RFC 8628 polling: `interval: 5s`, `slow_down` on faster polls (plugin) |
| `/one-time-token/generate` | 60 s | 5 | `customRules` |
| `/merge/*` | 60 s | 5 | the merge plugin's own `rateLimit` |

### 8. Staff roles (closes X2)

The console's jobs come from `docs/design/admin/01-research.md`: Mike as ops/owner, support, the COPPA consent reviewer, and the content editor. One person may hold several.

**Roles.** `users.role` becomes a multi-value select (Payload `select` with `hasMany: true`; Better Auth `additionalFields.role` type `'string[]'`, default `['user']`, `input: false`). Values: `user` (every Caller), `ops`, `support`, `consent`, `content`. `admin` is retired; a migration rewrites `admin` → `['ops']`. The fork's `normalizeRoles` reads arrays (finding 11), so `hasAnyRole` and `LoginView` work unchanged. If Phase B finds the Payload adapter cannot round-trip a `hasMany` select through Better Auth, the fallback is a single-valued `role` holding the person's one staff role; that limit is recorded and nobody holds two roles until upstream `roleField` (PR #44) reaches the fork.

**Permissions** (least privilege; reveal-and-log per D-A1; search-first per D-A3):

| Capability | ops | support | consent | content |
|---|---|---|---|---|
| Sign in to `/admin` | yes | yes | yes | yes |
| Callers list without a search | yes | no (search by exact email or Caller id) | no | no |
| Caller detail (masked) | yes | yes | only Callers tied to a consent record | no |
| Reveal a masked field (reason required, audited) | yes | yes | guardian email only | no |
| Mons and eggs, read | yes | yes | no | no |
| Revoke a Caller's sessions | yes | yes | no | no |
| Schedule or cancel deletion (7-day grace) | yes | yes | consent-linked records only | no |
| Guardian consents: read, chase, record parent request, delete with proof | yes | no | yes | no |
| Content views and `media` | yes | no | no | yes |
| Integrity check, run | yes | no | no | no |
| Audit log | all rows, export (export is audited) | own rows | own rows | own rows |
| Change any staff role | yes | no | no | no |

**Masking.** For Callers 13–17 and all guardian data, Payload field-level `read` access on `email`, `name` and `birthYear` returns false for every staff role, ops included. The list shows an age band, never the year (01-research, Risk 1). Values reach staff only through `POST /payload-api/console/reveal { targetType, targetId, field, reasonCode }`, which reads with `overrideAccess: true` and writes the `audit-events` row in the same transaction before returning the value. A Caller still reads their own fields (`isAdminOrSelf` self branch).

**Wiring.**

- `createBetterAuthPlugin({ admin: { login: { requiredRole: ['ops', 'support', 'consent', 'content'], requireAllRoles: false, enableSignUp: false, enablePasskey: true, enableForgotPassword: true }, enableManagementUI: false } })`. 2FA and passkey management for staff happens in the console's own Settings screen, not the plugin's views.
- `Users.access.admin: hasAdminRoles({ adminRoles: STAFF_ROLES })`; `role` field `access.update: isAdminField({ adminRoles: ['ops'] })`. Each new collection's access reads the matrix above through one helper module, `packages/payload/src/access/staff.ts`.
- **Staff need a second factor.** Admin access also requires `twoFactorEnabled === true`. Staff sign in with password + TOTP or with a passkey, and must have enrolled TOTP either way.
- **No first-user bootstrap in production.** `betterAuthCollections` gets `firstUserAdmin: { adminRole: 'ops' }` only when `NODE_ENV !== 'production'`. In production it gets `firstUserAdmin: false` with `acknowledgeRoleGuardDisabled: true`, which is honest only because `users.access.create` and the `role` field's `access.create` and `access.update` allow ops alone, and Better Auth's `additionalFields.role` has `input: false` (finding 12). The first ops account is granted by a script, `pnpm --filter @acme/payload staff:grant <email> ops`, run once per environment with database access. Role changes after that go through the console and are audited.

Another agent is adding `guardian-consents`, `eggs`, `mon-instances`, `audit-events` and `integrity-runs` on main. Phase B branches after those land and adds the access functions to them; it does not redefine their fields.

### 9. Cross-device handoff

**A device session is a surface, not a new creature.** Every surface below ends with an ordinary Better Auth session for the same `users` row. No handoff carries Mon state; the new surface reads `GET /v1/me/mons` like any device.

**Phone → headset (Meta Quest, Apple Vision Pro): device authorization, RFC 8628.** Typing an email and password with a headset's virtual keyboard is slow, and passkeys on a headset depend on the headset's browser or app supporting WebAuthn for our relying party (not verified for either device; this design does not depend on it).

1. The headset app calls `POST /device/code { client_id }` with `client_id` `nyc-mon-quest` or `nyc-mon-visionos`. `validateClient` allows those two and `nyc-mon-tablet`. The default `deviceCodeLength: 40`, `userCodeLength: 8` and `expiresIn: 30m` stand; `expiresIn` drops to `10m`.
2. The headset shows the user code and a QR of `verification_uri_complete`, which opens the phone app at M29 (`/(auth)/device?user_code=…`), or the admin-host web page when the app is not installed. `verificationUri` is that page.
3. On the phone, M29 calls `GET /device?user_code=` (claims the code for this session) and shows which kind of device asked and when. RFC 8628 §5.4 warns about remote phishing, so the screen says plainly "Only approve a code shown on your own headset", and Deny is as prominent as Approve.
4. Approve requires a fresh session (10 minutes) that has passed 2FA if 2FA is on.
5. The headset polls `POST /device/token` every 5 s and receives `{ access_token, token_type: 'Bearer' }`. It stores the token in the platform keychain and sends `Authorization: Bearer <token>` on auth and `/v1` calls. The `bearer` plugin converts it to the session cookie. Phase B confirms that `betterAuthStrategy`'s `auth.api.getSession({ headers })` runs the bearer hook, so `/v1` and `payload.auth()` see the Caller.

**Phone → tablet: one-time token, redeemed into a new session.** The tablet has a camera, so the phone shows the QR. Using `/one-time-token/verify` directly would hand the tablet the phone's own session (finding 5), so the token is redeemed by a wrapper endpoint in the same Phase B plugin as the merge flow:

1. Phone (fresh session) calls `GET /one-time-token/generate`. The token is stored hashed and lives 2 minutes. M30 shows it as a QR (`nycmon://handoff#t=<token>`, fragment so it never reaches a server log).
2. The tablet scans and calls `POST /handoff/redeem { token, surface: 'tablet' }`. The server calls `auth.api.verifyOneTimeToken` with `disableSetSessionCookie: true` (single use: the plugin consumes the row), reads the user id from the returned session, creates a **new** session with `internalAdapter.createSession(userId)`, and sets that cookie. The phone's session is never shared.
3. Both devices show up separately in the devices list and can be revoked on their own.

If Mike prefers one mechanism, the tablet can use the device-authorization flow too (tablet shows the code, phone approves). The one-time token is kept because a tablet can scan, which saves typing a code.

**Device list and revocation (M30).** `session.additionalFields.surface` (`'phone' | 'tablet' | 'quest' | 'vision-pro' | 'web' | 'admin'`, `input: false`) is set by `databaseHooks.session.create.before`: from `client_id` on `/device/token`, from the redeem body on `/handoff/redeem`, otherwise from the client's `x-nycmon-surface` header with `'web'` as the fallback. M30 lists `/list-sessions` with surface, user agent, and created and last-active time (no location: we store no geolocation), and calls `/revoke-session` or `/revoke-other-sessions`. Revoking a headset's session invalidates its bearer token, since the token is the session token. Password reset already revokes every session.

**The Mon follows the Caller.** Phase B amends ADR 0001's `/v1` contract in two places and records the change there:

- **Care writes are keyed per surface.** Each install generates a `surfaceId` (UUIDv7, stored in MMKV) and sends it with every `PUT /v1/mons/:id/care`. The server keeps `lastAppliedSeq` per `(monInstanceId, surfaceId)`, applies each surface's deltas in its own order through the sim core, and stays the tie-breaker between surfaces. This replaces the single per-Mon counter (finding 10).
- **Egg ids accept caller aliases** after a merge (section 3).

Nothing else moves between surfaces. A headset that signs in sees the same `monInstanceId` the phone hatched, because `GET /v1/me/mons` is the only way any surface learns which Mon it shows (ADR 0001).

### 10. `@acme/auth` surface (R5, Margelo `api-design`)

Apps keep importing only `@acme/auth`. Every call resolves to `AuthResult` and never throws on an auth failure: Better Auth's client resolves with `{ data, error }`, so a `try/catch` would catch nothing (ADR 0001 rule 4). New members, each a focused file under `packages/auth/src/`, re-exported from `index.ts`:

- `signIn` gains `{ method: 'username', username, password }`. A sign-in that needs a second factor resolves to `{ ok: false, error: { code: 'TWO_FACTOR_REQUIRED', methods: ('totp' | 'otp')[] } }`, and `twoFactor.verify({ method: 'totp' | 'otp' | 'backup-code', code, trustDevice? })` finishes it.
- `twoFactor`: `enable({ password })` → `{ totpURI, backupCodes }`, `verifyTotpSetup`, `disable`, `regenerateBackupCodes`, `sendCode`, `setOtpChannel('email' | 'sms')`.
- `phone`: `sendCode(e164)`, `verify(e164, code)`. Resolves `PHONE_NOT_ALLOWED` for an account that fails the gate.
- `username`: `isAvailable`, `set`.
- `accounts`: `list`, `link(provider)`, `unlink(providerId)`.
- `merge`: `start({ survivor })`, `claim(code)`, `confirm(code)`.
- `devices`: `list`, `revoke(sessionToken)`, `revokeOthers`, `approve(userCode)`, `deny(userCode)`, `createHandoffToken`, `redeemHandoffToken(token)`.
- The headset client gets its own entry, `createHeadsetAuth({ baseURL, clientId })`, with `requestCode()` and `waitForApproval(code, { signal })`, because its lifecycle (code, poll, bearer) differs from the phone's.

Exact signatures are written in Phase B against the installed client types.

## Screens this adds (§6 pipeline)

Each needs the full per-screen pipeline in `docs/phase-1-brief.md` §6 (`01-research.md` through `08-handoff.md`) before any UI code. IDs continue after M23. Routes follow the §4 pattern and are proposals for the design pass.

| # | Screen | Route | Shell | Job | States |
|---|---|---|---|---|---|
| M24 | Two-step sign-in setup | `/(settings)/security/two-factor` | none | Enrol TOTP (QR + manual key), show backup codes once, pick email or SMS for one-time codes (SMS only if the phone gate passes), turn 2FA off | off / enrolling / verify-code / backup-codes / on / sms-not-available |
| M25 | Second-factor challenge | `/(auth)/two-factor` | none | After password or username sign-in: enter a TOTP, send a one-time code, or use a backup code; "trust this device" | totp / code-sent / backup / wrong-code / locked (15 min) |
| M26 | Phone verification | `/(settings)/security/phone` | none | Add and verify a phone for 13+ Callers. Never rendered for an account that fails the gate | enter-number / code-sent / wrong-code / verified / country-not-supported / limit-reached |
| M27 | Username | `/(settings)/account/username` | none | Choose or change a sign-in handle; live availability | empty / checking / taken / invalid / saved |
| M28 | Sign-in methods and merge | `/(settings)/account/sign-in` | none | List linked methods, add or remove Apple/Google/passkey, and the merge flow (start, enter code, review what moves, confirm) | default / linking / unlink-blocked (last method) / merge-start / merge-review / merge-done / merge-refused |
| M29 | Approve a device | `/(auth)/device` | none | Approve or deny a headset or tablet code; names the device kind; deep-link target from the headset QR | enter-code / review / approved / denied / expired / not-your-code |
| M30 | Your devices | `/(settings)/devices` | none | Every signed-in surface, revoke one or all others, show the handoff QR for a tablet | list / handoff-qr / revoking / revoked / only-this-device |
| M31 | Headset sign-in | headset app, first run | H-Lynk (XR) | Shows the user code and QR, waits for approval; Phase 2 XR surface | waiting / approved / expired / denied |

M20 (Account) links to M27 and M28; M19 (Settings) links to M24, M26 and M30. Copy for every screen follows Law 9: "H-Lynk", never "device", in UI copy that refers to the in-fiction unit. A real phone, tablet or headset is not the H-Lynk, so the `ux-copy` pass decides the word for physical hardware on M29–M31 and records it in `docs/COPY_DECK.md`.

The admin console's sign-in and settings screens already exist in `docs/design/admin/`; staff 2FA enrolment belongs in its Settings view.

## Consequences

- New Better Auth tables (`twoFactor`, `deviceCode`, `rateLimit`) and new `users` fields (`twoFactorEnabled`, `phoneNumber`, `phoneNumberVerified`, `username`, `displayUsername`, `twoFactorOtpChannel`, `callerAliases`) plus `session.surface` each need a Payload migration. `users` is hand-written (ADR 0001), so its new fields are added by hand and must match the plugins' schemas exactly.
- `users.role` changes type, from a single select to `hasMany`. Every access check that compares `role === 'admin'` moves to the helpers in `access/staff.ts`.
- One new dependency through the catalog now, `@aws-sdk/client-sns`; `@better-auth/expo` follows with the mobile auth wiring.
- AWS SNS in a new account starts in the SMS sandbox and only sends to verified numbers until AWS moves it out; US delivery also needs a registered toll-free or 10DLC origination number.
- Production cannot turn on linking, merging or device approval until Resend sends from a verified domain, because the security notices depend on it.
- ADR 0001 is amended for per-surface care sequencing and caller aliases; both change `/v1` handler logic that is not built yet, so nothing deployed breaks.

## Decisions recorded (2026-10-04)

Mike answered 1–4; the lead decided 5 and 6. Each is also a numbered entry in `docs/canon/DECISIONS.md`. Where an answer changes a section above, that section is superseded by this list.

1. **Under-13 sign-in after consent (DECISIONS #17).** The child signs in with a username and a passkey on the family device. The account's `email` is the guardian's verified address, used only for recovery and for the email channel of one-time codes. **No placeholder emails, ever.** The guardian-consent flow creates the account with `emailVerified: true` because the guardian proved that address by approving consent. The child account has no password, so `emailAndPassword` sign-in does not apply to it; `/sign-in/username` needs a password and is therefore not the child's path either. The child's way in is the passkey; the username identifies the account on the family device and in support. Recovery runs through the guardian's email.
2. **Merge with two starters (DECISIONS #18, creator decision, closes the `TODO(canon)` in section 3).** Both Mons are kept. Home asks the Caller which one is active. Nothing is lost.
3. **SMS countries (DECISIONS #19).** US and Canada: `AUTH_SMS_ALLOWED_COUNTRIES=US,CA`, both `+1`. The validator accepts `+1` numbers with a valid NANP area code and refuses the `+1` area codes that belong to other countries (the Caribbean and Atlantic NANP members, a common SMS-pumping target), premium `900`, and toll-free codes, which cannot receive SMS. US territories stay in, since they are the US.
4. **Tablet handoff (DECISIONS #20).** Both mechanisms. The QR handoff (section 9) is used when the tablet can scan the phone; device-code approval, the headset flow, is the fallback.
5. **Consented accounts and phones (DECISIONS #21, lead).** An account created through guardian consent unlocks phone verification and SMS codes only when the Caller has turned 13 **and** the guardian approves again. Until both hold, the phone gate fails. The re-approval is recorded on the account as `phoneConsentAt` (date) and is the only path that sets it.
6. **Staff roles fallback (DECISIONS #22, lead).** If multi-value roles do not persist through the auth adapter, each staff member holds one role, and that limit is recorded here and in the collection. See "Verified" for which branch Phase B took.

**AWS.** SNS out of the sandbox, a toll-free or 10DLC origination number and the keys are Mike's to provide. Phase B builds behind the console sender, lists the env names in `.env.example`, and adds a line to `docs/DEVICE_CHECKS.md`.

## Phase B plan

Other agents share the working tree on main, so Phase B commits on main with explicit pathspecs, one commit per method or area, and the lead cuts `feat/auth-methods` from the right base when pushing. Files owned by the collections agent (`guardian-consents`, `eggs`, `mon-instances`, `audit-events`, `integrity-runs`, `collections/access/*`, `collections/audit/*`) are not edited here.

1. Wait for nothing; coordinate through `git log`.
2. Catalog: `@aws-sdk/client-sns`; `pnpm install`. `@better-auth/expo` waits for the mobile auth wiring: nothing in the repo runs a Better Auth client on native yet, and the server `expo()` plugin only matters once one does.
3. Server: plugins and options in `options.ts`; `sms.ts`; mail templates; the merge + handoff plugin; phone-gate hooks; staff roles, `access/staff.ts`, the reveal endpoint, `staff:grant` script; remove `firstUserAdmin`; `.env.example` names.
4. `@acme/auth`: client plugins and the members in section 10.
5. Tests (Vitest): phone gate refusals, `sendOTP` channel choice, SMS sender selection and the production console guard, username validator, merge rules (birth-year mismatch, provider conflict, Mons moved and none deleted, single-use code), handoff creates a distinct session, staff access matrix.
6. Boot `apps/admin-vite` against the scratch Postgres cluster with console senders and exercise each flow over HTTP: sign-up, username sign-in, 2FA enable, challenge and backup code, phone verify (allowed and refused), link listing, merge end to end, device code → approve → bearer `users/me`, handoff redeem, list and revoke sessions, staff login allowed and refused by role.
7. Record results in this ADR's "Verified" section, as ADR 0001 and 0003 do.
