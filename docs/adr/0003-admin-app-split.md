# ADR 0003: The Payload admin and API run in their own Vite app

- **Status:** Accepted (2026-10-04)
- **Date:** 2026-10-04
- **Deciders:** Mike (creator) decided; the `platform` agent implements
- **Supersedes:** the "mounted in `apps/web`" hosting in ADR 0001 (auth design unchanged)
- **Prior art:** MoyoLearn ADR-003 and ADR-004 (https://github.com/mikevocalz/moyolearn/blob/main/docs/site/adr-003-payload-admin-on-tanstack.md, https://github.com/mikevocalz/moyolearn/blob/main/docs/site/adr-004-admin-app-split.md) and its `apps/admin-vite` (https://github.com/mikevocalz/moyolearn/tree/main/apps/admin-vite, last changed at `524d723d`)

## Context

Payload's admin, its REST API and Better Auth (ADR 0001) were mounted inside `apps/web`, the Next 16.3.8 product site. That put the product site on the hook for `DATABASE_URL`, `PAYLOAD_SECRET` and `BETTER_AUTH_SECRET`, made every web deploy a Payload deploy, and tied the admin to `@payloadcms/next`.

MoyoLearn hit the same coupling from the other side. ADR-003 mounted the Payload admin inside its TanStack Start marketing app and measured initial JS on `/` going from 155.8 kB gz to 245.6 kB gz, because `tanstackStart({ rsc: { enabled: true } })` builds one client entry for the whole app and ships `@vitejs/plugin-rsc`'s Flight runtime to every page. ADR-004 moved the admin to `apps/admin-vite`, a separate app and Vercel project, which returned marketing to exactly 155.8 kB gz and took database credentials off the public origin.

NYC-MON's admin is a custom console built from `@acme/ui` (as in MoyoLearn and DVNT), so it also needs a build that can carry a design system without dragging it into the product site.

## Decision

The Payload admin, the Payload REST API and Better Auth run in **`apps/admin-vite`**, a TanStack Start app built with `@payloadcms/tanstack-start` 4.0.0-canary.37, deployed as its own Vercel project. `apps/web` is the product and promo site only.

| Path on the admin host | Served by |
|---|---|
| `/` | 307 to `/admin` |
| `/admin`, `/admin/*` | Payload admin (`payloadAdminIndexRoute`, `payloadAdminSplatRoute`) |
| `/payload-api/*` | Payload REST through `handleEndpoints` |
| `/payload-api/auth/*` | Better Auth, mounted as Payload endpoints by payload-better-auth |
| `/v1/*` | The §1.4 game API (ADR 0001), as TanStack Start server routes in `apps/admin-vite/src/routes/v1/**`. Not built yet. |

`packages/payload/src/payload.config.ts` stays the one config; admin-vite consumes it and never extends it. Collections, migrations and Better Auth options stay in `packages/payload`.

**Hosts.** No production domain is chosen. When one is, the admin-vite project answers on one host (for example `api.` or `admin.` under the product domain) for all five rows above, and `BETTER_AUTH_URL` is that origin. One host keeps the Better Auth cookie, the passkey relying party and the `/v1` session on the same origin. Local dev: `http://localhost:5174`.

**Expo.** The app's auth `baseURL` (the `baseURL` passed to `createAuth` in `@acme/auth`) becomes the admin-vite origin, not the web site. `apps/mobile/.env.example` still names `EXPO_PUBLIC_APP_URL=http://localhost:3000`; the mobile wiring (not built yet) points auth and `/v1` at the admin-vite origin instead.

**apps/web and content.** `apps/web` does not import Payload. A page that needs CMS content reads it over REST from the admin host with `createPayloadClient` in `@acme/payload` (anon-readable collections only). W02 `/mons` reads `@acme/content`, not Payload, so nothing in Phase 1 needs either.

## How the mount works

Ported from MoyoLearn's `apps/admin-vite` and rewired for this repo:

- `vite.config.ts`: `withPayload` guest mode, one copy each of `rsc()`, `tanstackStart()`, `viteReact()`, `nitro({ preset: 'vercel' })`; `prerender: { enabled: false }`; port 5174 `strictPort`.
- `src/routes/_payload/payload-api.$.ts` calls `handleEndpoints` without a `path`, so the prefix comes from `routes.api`. The adapter's `payloadApiHandlers` hard-codes `/api` and returns "Route not found" under `/payload-api` (MoyoLearn found this on canary.33; the canary.37 helper still strips `^\/api`).
- The dev script loads the root `.env` then `.env.local` with `node --env-file-if-exists`, the same job MoyoLearn's `989d8142` does with `set -a; . ../../.env`, without overriding variables set in the shell.
- GraphQL is not served. `apps/web` had `/payload-api/graphql`; the adapter has no GraphQL handler and nothing in NYC-MON calls it.

Changes this repo needed beyond MoyoLearn's:

1. **pnpm is isolated here.** `.npmrc`'s `node-linker=hoisted` is ignored by pnpm 12.8.1 (`node_modules/.modules.yaml` reports `nodeLinker: isolated`); MoyoLearn's install is hoisted. Nitro re-bundles the RSC output and resolves its bare imports from `apps/admin-vite`, so every package Payload's build externalizes and our bundled code imports must be a direct admin-vite dependency: `@payloadcms/db-postgres`, `pg`, `sharp`, `zod`, plus the auth plugin and `better-auth`.
2. **Root `tsconfig.json` extends `expo/tsconfig.base`,** which resolves only under `apps/mobile`. Vite 8's tsconfig discovery walked up to it and failed with "Tsconfig not found". admin-vite turns `resolve.tsconfigPaths` off and points each environment's dependency optimizer at its own `tsconfig.json`.
3. **`next/server` `after()` left the auth options.** Better Auth's background mail now goes through `waitUntil` from `@vercel/functions` 3.9.11, kept external in dev (`devServerExternalPackages`) because its CJS breaks under the RSC plugin's dev rewrite.
4. **The auth plugin imported `next/navigation`** in its login, logout, reset-password, two-factor and BeforeLogin components. Payload 4 exposes a framework-neutral router through `@payloadcms/ui` (`useRouter`, `useSearchParams` over `RouterAdapterContext`), which both adapters fill. The fork now uses it, and `next` and `@payloadcms/next` are optional peers: https://github.com/mikevocalz/payload-better-auth/commit/689a1ee (branch `payload-4-port`, PR https://github.com/delmaredigital/payload-better-auth/pull/43); the catalog pins `payload-4-dist` at `5134d0b`. `tsc` exit 0, 45 files and 434 tests pass.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep the admin in `apps/web` (Next) | Product site keeps the database and auth secrets, every web deploy redeploys the CMS, and a custom `@acme/ui` console would share the product site's build. |
| Admin inside a TanStack Start product site | MoyoLearn measured it: +89.8 kB gz initial JS on every marketing page (155.8 to 245.6), with no per-route opt-out of the RSC runtime. |
| A plain Node or Hono server for REST and auth, admin elsewhere | Two deployments for one config, and Payload's admin needs an RSC-capable host anyway. |

## Measured (2026-10-04)

- `apps/web` production build (Next 16.3.8, Turbopack) after removing Payload: `/` loads 17 scripts, 2975.7 kB raw, **880.7 kB gz**. No file under `.next/static` contains `payloadcms`, `payload-better-auth`, `PayloadAdminShell`, `RootProvider` or `_payload_clientConfigs`. `createFromReadableStream` appears in two chunks; both are Next's own App Router Flight client, which every App Router page ships. The same measurement before the change was not taken, so this ADR records no delta for `apps/web`.
- `apps/admin-vite` production build: 62 client JS files, **656.7 kB gz in total** (most are per-locale chunks loaded on demand); the two largest are the client entry at 265.5 kB gz and the admin index at 182.4 kB gz. Server function in `.vercel/output/functions/__server.func`: 35 MB.

## Verified (2026-10-04)

Booted `pnpm --filter admin-vite dev` against a throwaway Postgres 16 cluster with `PAYLOAD_PUSH=true`:

| Request | Result |
|---|---|
| `GET /payload-api/auth/ok` | 200 `{"ok":true}`, `cache-control: private, no-store, max-age=0` |
| `POST /payload-api/auth/sign-up/email` | 200; first user, `role: admin` |
| `POST /payload-api/auth/sign-in/email` | 200 |
| `GET /payload-api/users/me` with the cookie | 200; `_strategy: better-auth` |
| `GET /admin` in Chrome (Playwright) | redirects to `/admin/login`, the plugin's login view |
| Sign in through that form | lands on `/admin`; dashboard lists Users, Media, Sessions, Accounts, Verifications, Passkeys |
| `/admin/collections/users` | one row |

Typecheck and lint pass for `apps/admin-vite`, `apps/web` and `packages/payload`; `apps/admin-vite` and `apps/web` build.

## Known gaps

- **The plugin's own views are unstyled under Payload 4.** Its components style themselves inline with Payload 3 CSS variables (`--base`, `--theme-text`, `--theme-elevation-150`, `--theme-input-bg`, `--style-radius-s`, `--font-size-*`). Payload 4's stylesheet defines none of them (it uses `--color-*`), so the login form renders as bare inputs. Both adapters load the same `@payloadcms/ui` stylesheet, so this is a Payload 4 port gap in the fork rather than an adapter issue (inferred from the stylesheet; not re-checked under `@payloadcms/next`). The custom console replaces the login view through the plugin's `admin.loginViewComponent` option.
- React logs "This library called use() to suspend in a previous render but did not call use() when it finished" once on the admin in dev. Not traced.
- `apps/web`'s build logs `ReferenceError: requestAnimationFrame is not defined` while prerendering and still exits 0. Not checked against the previous commit.
- No domain, no Vercel project, no `/v1` routes yet.

## Consequences

- The product site deploys without database or auth secrets. The admin-vite Vercel project holds `DATABASE_URL`, `PAYLOAD_SECRET`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and the Resend and OAuth values.
- Passkeys are issued for the admin-vite host (`rpID` is `BETTER_AUTH_URL`'s hostname). Moving auth to another host later invalidates registered passkeys.
- Payload CORS and CSRF accept the admin-vite origin, `NEXT_PUBLIC_SITE_URL` and `BETTER_AUTH_TRUSTED_ORIGINS` (`PAYLOAD_ORIGINS` in `packages/payload/src/auth/options.ts`).
- Two frameworks to keep current: Next for the site, TanStack Start for the admin. TanStack Start, `@vitejs/plugin-rsc` and Nitro are pinned in the catalog; Nitro is a beta.
- The custom console registers in `packages/payload/src/admin/components.ts` (`admin.components`), with component paths relative to `packages/payload/src`, and needs `pnpm --filter admin-vite payload:importmap` after each change.
