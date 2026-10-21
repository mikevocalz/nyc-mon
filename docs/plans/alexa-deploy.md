# Alexa+ deploy and live verification

Draft runbook. Get the three services on HTTPS, apply the OAuth migration, and prove the parts PR #12 could only test against mocks. Judges may look from Oct 26 (rules prevail over the FAQ date) and judging runs to Nov 20; everything stays up until then. Nothing in this file has been deployed or run yet; the status table at the end says what has.

## Current state (first read 2026-10-15, `main` at `311ab58`; lane merged to `main` `670e05f` on 2026-10-18)

The snapshot below is the 2026-10-15 reading and is still accurate where marked. The 2026-10-18 merge brought the lane level with `main`; the only file this lane adds on top is this document. All nine `alexa-readiness.yml` stages were re-run locally against the merge (`f1fe90c`, dirty) and passed — see the status table.

| Service | Package | Where it runs today | Deployed? |
|---|---|---|---|
| Authorization server, admin, `/v1` | `apps/admin-vite` (TanStack Start, Nitro `preset: 'vercel'`, ADR 0003) | `localhost:5174` only | No. `apps/admin-vite/vercel.json` exists, but the Vercel team `mikefacesnys-projects` has 23 projects and none for NYC-MON. |
| MCP server | `packages/mcp-server` (Node, `pnpm start`, one `/mcp` endpoint plus `/healthz`) | `localhost:8788` only | No. No Dockerfile, no host manifest in the repo. |
| Simulator | `packages/web-sim` (Node, two listeners: page + `/api` on `:5180`, sandbox proxy on `:5181`) | localhost only | No. Same as above. |

- **Database.** Neon project `NYC-Mon` (`muddy-mouse-43813670`, `aws-us-east-2`, Postgres 18, one branch `production`) exists since 2026-10-05. It holds only Neon's own `neon_auth.*` tables from the console. There is no `payload` schema: none of the three Payload migrations (`20261004_213700`, `20261007_202116_waitlist`, `20261008_181202_alexa_oauth`) has been applied. The `neon_auth` schema is not the app's auth and nothing in the repo reads it. History retention on the project is 6 hours, so a restore-point branch is the rollback, not point-in-time recovery.
- **Domains.** None chosen (ADR 0003 "no production domain"). No DNS exists for any of the hosts below.
- **GitHub.** The repository's default branch is `claude/jolly-dirac-dtzmjy` (`1f75c66`, 68 commits behind `main`, 0 ahead, last commit 2026-10-14). It carries only `ci.yml` and `pages.yml`. GitHub registers `workflow_dispatch` workflows from the default branch, so `alexa-live-smoke.yml` cannot be dispatched today: `gh run list --workflow alexa-live-smoke.yml` returned HTTP 404 on 2026-10-15, and the public workflows API lists `alexa-readiness.yml`, `ci.yml`, `pages.yml` and the two calendar-lock workflows, nothing else.
- **Offline evidence.** `alexa-readiness.yml` runs on pull requests and writes `.alexa-readiness/report.json` with live smoke recorded as `NOT RUN`. Latest runs: https://github.com/mikevocalz/nyc-mon/actions/runs/38753217250 (success, `feat/mobile-final-permissions-20261015`) and https://github.com/mikevocalz/nyc-mon/actions/runs/38777570759 (failure, `feat/onboarding-permission-center-notifications`, cause not looked at here). Neither ran against `main`.
- **Alexa client.** Amazon does not grant hackathon participants the `alexa-ai` CLI, so there are no Alexa redirect URIs to register (`docs/alexa/HACKATHON.md`). The `alexa` client stays unregistered unless Mike has access; the simulator's `nyc-mon-sim` public client is the linking path judges see.

## Hosting (Mike decides)

Facts that constrain the choice:

- admin-vite is built for Vercel (`nitro({ preset: 'vercel' })`, `vercel.json` with `cd ../.. && pnpm --filter admin-vite... build`). Its Vercel project needs Root Directory `apps/admin-vite`, framework "Other", production branch `main`. The server function measured 35 MB in ADR 0003.
- The MCP server and the simulator are long-running Node processes (`pnpm start`: `src/ui/build.ts` then `src/main.ts` for the MCP server, `server/main.ts` for the simulator) that bind a port and expect a TLS proxy in front (`listenHostFor` binds all interfaces outside the dev bypass). They do not fit Vercel functions without a rewrite, which is out of scope.
- The simulator needs **two origins** (page and sandbox; `loadSimEnv` refuses the same origin) and an AWS identity with `bedrock-mantle:CreateInference`. The AWS SDK's default chain finds an instance or task role, so no AWS keys go into env.
- Running the two Node services on AWS also backs the AWS Builder entry (`docs/aws-builder.md`).

Option A (recommended for speed): **one small EC2 instance** (Node 24.15.0 from `.nvmrc`, pnpm, Caddy for TLS, systemd for the two processes) with an instance role for Bedrock. Caddy issues certificates for `mcp.`, `sim.` and `sandbox.` and proxies to `:8788`, `:5180`, `:5181`. One box, three hostnames, no container build.

Option B: **containers** (App Runner, ECS Fargate, Fly). Needs a Dockerfile per package that does not exist yet, and the simulator's second listener needs a second service or a second exposed port, because one-port-per-service hosts cannot route both origins from one container.

The runbook below is written for Option A. Steps 1 to 4 and 6 to 9 are the same under Option B; only step 5 changes.

Hostnames used below are placeholders: `auth.<domain>` (admin-vite), `mcp.<domain>`, `sim.<domain>`, `sandbox.<domain>`. Pick them once: passkeys are issued for the `BETTER_AUTH_URL` hostname and moving it later invalidates them (ADR 0003).

## Runbook

Every step names its proof. Values are never printed; names only.

### 1. Make the workflows dispatchable

```sh
gh repo edit mikevocalz/nyc-mon --default-branch main
gh workflow list   # must now show "Alexa live smoke"
```

Proof: `gh workflow list` lists `alexa-live-smoke.yml` and `alexa-readiness.yml`.

### 2. Take a database restore point, then migrate

The migration runs from a laptop with `DATABASE_URL` and `PAYLOAD_SECRET` in the root `.env.local` (never committed; `ci.yml` fails on a committed `.env`). Run it **without** `NODE_ENV=production`: `payload.config.ts` throws in production unless Bunny is configured, and the migration does not need Bunny.

The migrations do not create the `payload` schema: `20261004_213700` starts with `CREATE TYPE "payload".*` and fails on an empty database with `schema "payload" does not exist`. Create the schema before migrating (found 2026-10-16).

```sh
# restore point (Neon CLI; or Branches > New branch from production in the console)
neonctl branches create --project-id muddy-mouse-43813670 --parent production --name pre-alexa-oauth

# schema prerequisite: the migrations never create it
psql "$DATABASE_URL" -c 'CREATE SCHEMA IF NOT EXISTS payload'

cd nyc-mon
pnpm install --frozen-lockfile
pnpm --filter admin-vite payload migrate:status   # expect all three listed, none run
pnpm --filter admin-vite payload migrate
pnpm --filter admin-vite payload migrate:status   # expect all three run, one batch
```

Review before applying: `packages/payload/src/migrations/20261008_181202_alexa_oauth.ts` creates `payload.jwks` and seven `payload.oauth_*` tables (plus their `_v` version tables) and the `payload_locked_documents_rels` foreign keys. `down()` drops them with CASCADE after removing those keys. On an empty database all three migrations land in one batch.

Rollback: `pnpm --filter admin-vite payload migrate:down` reverts the last batch (all three on a fresh database, so use it only before any Caller data exists), or restore `production` from the `pre-alexa-oauth` branch in the Neon console. Keep `PAYLOAD_PUSH` unset everywhere in production.

Proof: `migrate:status` output, and `get_database_tables` on the Neon project showing `payload.oauth_clients`.

### 3. Create the admin-vite Vercel project and set its env

Import `mikevocalz/nyc-mon` in the Vercel dashboard (team `mikefacesnys-projects`), Root Directory `apps/admin-vite`, framework "Other", production branch `main`. Then from a checkout:

```sh
cd apps/admin-vite
vercel link --yes --scope mikefacesnys-projects --project <project-name>
```

Production env, by name (`vercel env add NAME production < file`, one file per value, `umask 077`):

| Name | Note |
|---|---|
| `NODE_ENV` | `production` (Vercel sets it at build; set it for runtime too) |
| `DATABASE_URL` | Neon pooled string for `production` |
| `PAYLOAD_SECRET`, `BETTER_AUTH_SECRET` | `openssl rand -base64 32` each |
| `BETTER_AUTH_URL` | `https://auth.<domain>` (issuer defaults to this origin) |
| `AUTH_ISSUER` | `https://auth.<domain>`; same value on the MCP server and the simulator |
| `MCP_RESOURCE_URI` | `https://mcp.<domain>/mcp`; byte-identical on the MCP server and in `SIM_MCP_URL` |
| `OAUTH_SIM_CLIENT_ID` | `nyc-mon-sim` (default) |
| `OAUTH_SIM_REDIRECT_URIS` | `https://sim.<domain>/oauth/callback` |
| `OAUTH_ALEXA_CLIENT_ID`, `OAUTH_ALEXA_CLIENT_SECRET`, `OAUTH_ALEXA_REDIRECT_URIS` | the real values if Mike has the `alexa-ai` CLI output; otherwise a 32+ char secret and a placeholder https redirect URI so the service-token checks in 8b can run, or unset (the boot logs one warning) |
| `V1_MCP_SERVICE_KEY` | 32+ chars; same value on the MCP server |
| `BETTER_AUTH_TRUSTED_ORIGINS` | include `https://sim.<domain>`: the simulator exchanges its PKCE code from the browser, cross-origin |
| `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_PASSWORD`, `BUNNY_CDN_URL` | required: production boot throws without them (`packages/payload/src/payload.config.ts`) |
| `BUNNY_STORAGE_REGION` | optional: picks the storage hostname only; unset is a valid default |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | `false` unless `RESEND_API_KEY` and `AUTH_EMAIL_FROM` are set (lockout guard) |
| `NEXT_PUBLIC_SITE_URL` | the product site origin, for Payload CORS |

Leave `PAYLOAD_PUSH`, `AUTH_SMS_TRANSPORT`, `OAUTH_DEV_BYPASS` and `MCP_DEV_MODE` unset.

```sh
vercel env ls production          # names only
vercel deploy --prod
curl -s -o /dev/null -w '%{http_code}\n' https://auth.<domain>/payload-api/auth/ok   # 200
curl -s https://auth.<domain>/.well-known/oauth-authorization-server | head -c 400
```

Proof: `/payload-api/auth/ok` is 200; the metadata document names `authorization_endpoint` and `token_endpoint`; the deploy's runtime logs show no `[auth]` warning about `OAUTH_SIM_REDIRECT_URIS` (a warning means the simulator client did not register and linking fails).

### 4. DNS

- `auth.<domain>` CNAME to the Vercel project (`vercel domains add` or the dashboard; verify with `vercel domains inspect`).
- `mcp.<domain>`, `sim.<domain>`, `sandbox.<domain>` A records to the instance's Elastic IP.

Proof: `dig +short` for each name.

### 5. Host the MCP server and the simulator (Option A)

On the instance: Node `24.15.0`, pnpm, Caddy, an IAM instance role with `bedrock-mantle:CreateInference` on the model and Bedrock model access enabled for `anthropic.claude-opus-5-5` in `AWS_REGION`.

```sh
git clone https://github.com/mikevocalz/nyc-mon && cd nyc-mon && git checkout <sha>
pnpm install --frozen-lockfile --filter @acme/mcp-server... --filter @acme/web-sim...
pnpm --filter @acme/web-sim build
```

`/etc/nyc-mon/mcp.env` (names):

```
NODE_ENV=production
MCP_PORT=8788
MCP_RESOURCE_URI=https://mcp.<domain>/mcp
MCP_ALLOWED_ORIGINS=https://sim.<domain>
AUTH_ISSUER=https://auth.<domain>
AUTH_JWKS_URL=https://auth.<domain>/payload-api/auth/jwks
MCP_TOKEN_VERIFIER=jwt
V1_BASE_URL=https://auth.<domain>
V1_MCP_SERVICE_KEY=<same as admin-vite>
```

`/etc/nyc-mon/sim.env` (names):

```
NODE_ENV=production
SIM_PORT=5180
SIM_SANDBOX_PORT=5181
SIM_PUBLIC_ORIGIN=https://sim.<domain>
SIM_SANDBOX_ORIGIN=https://sandbox.<domain>
SIM_MCP_URL=https://mcp.<domain>/mcp
SIM_AUTH_MODE=oauth
SIM_MODEL_BACKEND=bedrock
SIM_BEDROCK_MODEL_ID=anthropic.claude-opus-5-5
AWS_REGION=<region>
AUTH_ISSUER=https://auth.<domain>
OAUTH_SIM_CLIENT_ID=nyc-mon-sim
SIM_TRUST_PROXY=1
```

Two systemd units, `WorkingDirectory` at the package, `EnvironmentFile` as above, `ExecStart=pnpm start`, `Restart=always`. `Caddyfile`:

```
mcp.<domain>     { reverse_proxy 127.0.0.1:8788 }
sim.<domain>     { reverse_proxy 127.0.0.1:5180 }
sandbox.<domain> { reverse_proxy 127.0.0.1:5181 }
```

Both servers validate their env at boot and refuse to start with a dev bypass or the mock model under `NODE_ENV=production` (`packages/mcp-server/src/env.ts`, `packages/web-sim/server/env.ts`), so a wrong env is a failed unit, not a silent fallback.

```sh
systemctl status nyc-mon-mcp nyc-mon-sim
curl -s https://mcp.<domain>/healthz
curl -s https://sim.<domain>/api/config     # authMode "oauth", modelBackend "bedrock", nothing else
```

Proof: both units active; `/healthz` 200; `/api/config` shows `authMode: "oauth"` and `modelBackend: "bedrock"` and no secret-looking field.

### 6. Check the production env contract offline, with the real names

`readinessEnvironmentProblems` (`packages/payload/src/__tests__/readinessEnvironment.ts`) checks issuer and resource alignment, HTTPS everywhere, origin scoping and the client registrations, and returns field labels only. Run it once against the merged env of the three hosts (values stay on the laptop; nothing is printed but labels):

```sh
node --env-file=/path/to/merged-prod.env --input-type=module -e '
  const { readinessEnvironmentProblems } = await import("./packages/payload/src/__tests__/readinessEnvironment.ts");
  console.log(readinessEnvironmentProblems(process.env));'   # expect []
```

Expect `OAUTH_ALEXA_CLIENT` in the list if the Alexa client is unset; that is the one accepted gap.

### 7. Create the test Callers and a Mon

Through admin-vite (`docs/alexa/AUTH.md`, ADR 0015 §1):

- An adult Caller: sign up at `https://auth.<domain>/admin`, set `birthYear` so that `currentYear - birthYear > 18` and `consentStatus = not-required` on the Users row. Draw and hatch a Mon: `POST /v1/eggs`, then `POST /v1/eggs/:id/hatch`. Note the Mon id (`LIVE_MON_ID`).
- An under-18 Caller: a `birthYear` that could belong to a 17-year-old.

Proof: `GET /v1/me/mons` as the adult returns one hatched Mon.

### 8. Live checks

**8a. Linking through the simulator.** Open `https://sim.<domain>`, "Sign in", sign in as the adult (email and password, then TOTP if enrolled). The page returns with a token and the Mon greets. Repeat as the under-18 Caller: the authorization server lands on `/oauth/refused` and the simulator shows `access_denied`. Passkey sign-in on the linking page is **not built** (ADR 0016, `docs/alexa/AUTH.md` "Known gaps"), so that check records "not possible" rather than a pass.

**8b. Tokens and scopes, from a terminal.** A service token needs a confidential client. `nyc-mon-sim` is public (giving it a secret would switch it to `client_secret_basic` and break the browser's PKCE exchange), so the service-token checks need the `alexa` client registered. Without the `alexa-ai` CLI, register it with a secret and a placeholder `https://auth.<domain>/oauth/unused` redirect URI; nothing but these checks uses it.

```sh
curl -s -u "alexa:$ALEXA_SECRET" -d 'grant_type=client_credentials&scope=mcp:service&resource=https://mcp.<domain>/mcp' \
  https://auth.<domain>/payload-api/auth/oauth2/token      # access_token, no refresh_token
```

With a user token `$T` copied from the simulator session (sessionStorage) and `$S` the service token:

```sh
M=https://mcp.<domain>/mcp
H='content-type: application/json'; A='accept: application/json, text/event-stream'; V='mcp-protocol-version: 2025-11-25'
curl -s -o /dev/null -w '%{http_code}\n' -H "$H" -H "$A" -H "$V" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' $M            # 401, no WWW-Authenticate
curl -s -o /dev/null -w '%{http_code}\n' -H "$H" -H "$A" -H "$V" -H 'origin: https://evil.example' -d '{}' $M            # 403
curl -s -H "$H" -H "$A" -H "$V" -H "authorization: Bearer $S" -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' $M     # tools, no get_familiar_people
curl -s -o /dev/null -w '%{http_code}\n' -H "$H" -H "$A" -H "$V" -H "authorization: Bearer $S" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_mon_status","arguments":{}}}' $M               # 401
curl -s -H "$H" -H "$A" -H "$V" -H "authorization: Bearer $T" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_mon_status","arguments":{}}}' $M               # the Mon
```

**8c. Feed lands once.** Same `intentId` twice; the server reuses the `Idempotency-Key`, `seq` and time and `/v1` replays:

```sh
I=$(uuidgen)
for n in 1 2; do curl -s -H "$H" -H "$A" -H "$V" -H "authorization: Bearer $T" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":$n,\"method\":\"tools/call\",\"params\":{\"name\":\"feed_mon\",\"arguments\":{\"monId\":\"$LIVE_MON_ID\",\"intentId\":\"$I\"}}}" $M; echo; done
```

Proof: both answers carry the same result; the Mon's hunger meter moved once (`get_mon_status` before and after).

**8d. Refresh rotates and replay is refused.** Use the simulator's refresh token once at `/oauth2/token` (`grant_type=refresh_token`), then send the old one again: the second call is `invalid_grant` and the new access token stops working (family revoked). Proof: the three HTTP responses.

**8e. Revocation.** `POST /payload-api/auth/oauth2/revoke` with `token=<refresh token>&client_id=nyc-mon-sim`; a refresh with that token is then `invalid_grant`. No test covers this endpoint on `main`, so note what the provider actually answers.

**8f. The live smoke workflow.** Create the GitHub environment `alexa-live` with variables `LIVE_MCP_URL`, `AUTH_ISSUER`, `LIVE_MON_ID`, `SIM_BEDROCK_MODEL_ID`, `AWS_REGION`, `AWS_BEDROCK_ROLE_ARN` and the secret `LIVE_ACCESS_TOKEN` (a fresh user token with `mcp:care`, minted right before the run; its lifetime is the provider's access-token TTL, not measured here). The role trusts GitHub's OIDC for this repo and environment.

```sh
gh workflow run alexa-live-smoke.yml
gh run list --workflow alexa-live-smoke.yml --limit 1
gh run download <id> -n alexa-live-evidence-<sha>
```

It proves `oauth-metadata`, `mcp-rejects-anonymous`, `mcp-tools-list`, `care-mutation` and `bedrock-turn` and fails closed on any missing variable (`packages/web-sim/scripts/live-smoke.ts`).

**8g. A real Bedrock turn in the simulator.** Ask "How's my Mon doing?": the agent loop calls `get_mon_status` and the card renders. Then beats 3 and 4 from `docs/alexa/SIMULATOR.md` with the real model (the dev panel needs `MCP_DEV_MODE=1`, which the production MCP server does not set; beats 3 and 4 run against a second, dev-mode MCP process on the box or are recorded as not possible on the production endpoint).

### 9. Latency

Twenty `feed_mon` calls through the MCP server with fresh `intentId`s, and twenty `GET /v1/mons/:id` direct:

```sh
for n in $(seq 20); do curl -s -o /dev/null -w '%{time_total}\n' -H "$H" -H "$A" -H "$V" -H "authorization: Bearer $T" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":$n,\"method\":\"tools/call\",\"params\":{\"name\":\"feed_mon\",\"arguments\":{\"monId\":\"$LIVE_MON_ID\",\"intentId\":\"$(uuidgen)\"}}}" $M; done | sort -n | sed -n '19p'   # p95
```

If p95 is over 500 ms, take the plan in the care single-round-trip draft (PR #15). Measurements decide; do not merge #15 ahead of them.

### 10. Keep it up

Vercel keeps admin-vite up. For the instance: `Restart=always` on both units, a weekly check of `/healthz` and `/api/config`, and nothing else touched until 2026-11-20.

## Acceptance checks and what proves each

From the PR body, mapped to the offline proof that already exists on `main` and the live step that still has to run.

| Check | Offline proof on `main` | Live proof |
|---|---|---|
| adult links successfully | `provider.test.ts` "links an adult: code exchange returns a user JWT and a refresh token" | 8a |
| PKCE S256 verifies | "refuses a wrong code_verifier", "refuses the plain challenge method" | 8a (the simulator sends S256 only) |
| resource/issuer checks hold | "refuses a missing or foreign resource at authorize"; `auth.test.ts` "rejects a token minted for another audience, issuer" | 8b |
| token permits user tools | `http.test.ts` "runs a user tool with a user token" | 8b |
| refresh rotates | "and refresh rotates" | 8d |
| refresh replay is rejected/revoked | "refuses another client's refresh token without revoking the real holder's"; rotation and family revocation are the provider's | 8d |
| under-18 linking is rejected server-side | "18+ gate" (three tests); `http.test.ts` "gives an under-18 token no data and never calls /v1" | 8a |
| service token cannot read user data | `http.test.ts` "lets a client_credentials token discover tools but not read or change Caller data" | 8b |
| logout/revocation behavior is sane | none (revocation endpoint exists; no test) | 8e |
| OAuth/admin, MCP and simulator over HTTPS | `readinessEnvironment.test.ts` (synthetic) | 3, 5 |
| migration reviewed/applied with rollback documented | `migration-discovery.test.ts` | 2 |
| production bypasses disabled | `auth.test.ts` "refuses OAUTH_DEV_BYPASS unless NODE_ENV is development or test"; `web-sim/test/auth.test.ts` "refuses the mock model backend in production" | 5 (`/api/config`), 8b (no dev tools listed) |
| required secrets never emitted to browser/logs | `web-sim/test/auth.test.ts` "tells the browser nothing secret"; `readinessEnvironment.test.ts` "returns field labels rather than credentials" | 5 |
| CORS/origins explicitly scoped | `http.test.ts` "rejects a foreign Origin with 403 before auth", "echoes an allowed Origin, never *"; `modelHandler.test.ts` "refuses other origins" | 8b |
| real database used | none | 2, 7, 8c |
| logs/health enough to diagnose demo failures | none | 5 (`/healthz`, `/api/config`, `/payload-api/auth/ok`, Vercel runtime logs, journald) |
| services remain available through judging | none | 10 |
| a real deployed turn end to end (P0) | `agentLoop.test.ts` with a mocked Bedrock client | 8f `bedrock-turn` plus 8g |
| no production-mode silent mock fallback | `loadSimEnv` throws; `live-smoke.ts` fails closed | 5, 8f |
| real /v1, MCP, Bedrock and full-turn latency | none | 9 |
| independent verification | PR #26's lane | not this PR |

Passkey on the linking page is not built, so "passkey sign-in on the linking page" cannot pass in this deploy and is recorded as such.

## Hackathon checklist (submissions close Fri 2026-10-23, 12:00 pm PT)

What must be true on the 23rd. Citations are in `docs/alexa/HACKATHON.md`.

- **Invocation name: none exists.** Hackathon participants get no `alexa-ai` CLI and no developer-console access, so no add-on or skill is ever registered with Amazon and there is nothing to invoke by name. The demo entry points are the simulator page (`https://sim.<domain>`) and the MCP endpoint (`https://mcp.<domain>/mcp`, Streamable HTTP, spec `2025-11-25`). The Agent Skill artifact in the repo is `skills/nyc-mon-companion/SKILL.md` (`name: nyc-mon-companion`); the simulator loads it as the system prompt.
- **If live hosting is up, these must answer:** `GET https://mcp.<domain>/healthz` → 200; `GET https://sim.<domain>/api/config` → `authMode: "oauth"`, `modelBackend: "bedrock"`; `GET https://auth.<domain>/.well-known/oauth-authorization-server` → metadata; the step-8b `tools/list` exchange on `https://mcp.<domain>/mcp`. Env names that must be set are exactly the step-3 Vercel table plus the step-5 `mcp.env`/`sim.env` blocks — `AUTH_ISSUER`, `MCP_RESOURCE_URI` and `SIM_MCP_URL` byte-identical across hosts, `BETTER_AUTH_TRUSTED_ORIGINS` including the sim origin, the three required `BUNNY_*` vars for the admin-vite production boot.
- **If live hosting is not up, the offline fallback still submits.** The rules do not require hosting: "a locally runnable public repo plus your demo video is enough" (FQ). The fully local, no-credentials demo is the SIMULATOR.md offline recipe — `NODE_ENV=development MCP_ALLOWED_ORIGINS=http://localhost:5180 OAUTH_DEV_BYPASS=1 MCP_DEV_MODE=1 pnpm --filter @acme/mcp-server dev` plus `SIM_AUTH_MODE=dev-bypass SIM_DEV_MODE=1 SIM_MODEL_BACKEND=mock pnpm --filter @acme/web-sim dev`, then open `http://localhost:5180`. Every reply is labelled "Scripted test model"; with AWS credentials on the laptop, dropping `SIM_MODEL_BACKEND=mock` gives a real Bedrock turn locally. The mock can never serve production (`loadSimEnv` throws under `NODE_ENV=production`).
- **Demo video is the hard requirement either way**: under three minutes, shows the MCP server or simulated experience working, public on YouTube or Vimeo, English.
- **Offline evidence on the merged lane:** all nine `alexa-readiness.yml` stages PASSED locally on 2026-10-18 (`f1fe90c`, `.alexa-readiness/report.json`). Live smoke remains `NOT RUN` — it needs the `alexa-live` GitHub environment and its secrets (step 8f).

## Needs Mike

1. **Hosting**: Option A was STRUCK 2026-10-16 because no AWS account existed. One exists since 2026-10-19 (account state in `docs/aws-builder.md`), so Option A is open again. Still blocked on item 2 (domain).
2. **Domain and hostnames** for `auth.`, `mcp.`, `sim.`, `sandbox.`; DNS access. No domain yet as of 2026-10-16 — one must be registered first. Lane DEFERRED 2026-10-16: the deploy is parked and the hackathon demo runs without live services until a domain and hosting exist.
3. **GitHub**: set the default branch to `main` (step 1); create the `alexa-live` environment and its variables and secret (8f); approve the AWS OIDC role for Actions.
4. **Vercel**: create the admin-vite project (step 3) and set the env names listed there. Bunny storage credentials are among them and are required for production boot.
5. **AWS**: account `142366489572` exists since 2026-10-19, with the GitHub OIDC role and the `alexa-live` variables set. No Claude model answers yet: the Anthropic use-case form is unfiled, and Opus 5.5 on mantle has a 0 quota. Since 2026-10-21 the simulator can use a `us.anthropic.claude-*-4-6` id on bedrock-runtime once the form clears. See the decisions table in `docs/aws-builder.md`.
6. **Amazon developer console**: nothing to do; participants get no `alexa-ai` CLI. Decided 2026-10-16 — the `alexa` client gets a placeholder registration (secret + unused https redirect) so the 8b service-token checks can run.
7. **Test Callers**: who owns the adult and under-18 accounts, and the TOTP secret for the adult.
8. The three secrets generated on the laptop (`PAYLOAD_SECRET`, `BETTER_AUTH_SECRET`, `V1_MCP_SERVICE_KEY`) go only into Vercel and `/etc/nyc-mon/*.env`.

## Status (updated 2026-10-16)

Lane state: **parked** — steps 3+ blocked on a domain and a non-AWS hosting decision (see Needs Mike). Steps 1–2 are done and remain valid when the lane resumes.

| Step | Status | Evidence |
|---|---|---|
| 1 default branch and dispatchable workflows | done 2026-10-16 | default branch is `main`; `gh workflow list` shows "Alexa live smoke" |
| 2 restore point and migration | done 2026-10-16 | `pre-alexa-oauth` branch `br-gentle-meadow-b5n3wzys` (no compute); `migrate:status` all three in batch 1; `payload` schema 57 tables incl. `oauth_clients`. Needed `CREATE SCHEMA payload` first — see step 2 |
| 3 admin-vite on Vercel | not yet run | no NYC-MON project in the team |
| 4 DNS | not yet run | no domain chosen |
| 5 MCP server and simulator on HTTPS | not yet run | |
| 6 env contract against real names | not yet run | |
| 7 test Callers and Mon | not yet run | |
| 8a linking, adult and under-18 | not yet run | |
| 8b tokens, scopes, origins | not yet run | |
| 8c feed lands once | not yet run | |
| 8d refresh rotation and replay | not yet run | |
| 8e revocation | not yet run | |
| 8f live smoke workflow | not yet run | cannot be dispatched until step 1 |
| 8g real Bedrock turn, beats 3 and 4 | not yet run | |
| 9 latency p95 | not yet run | |
| 10 availability through 2026-11-20 | not yet run | |
| offline contracts (`alexa-readiness.yml`) | run on PR branches only, never on `main` | run 38753217250 success; run 38777570759 failure, not investigated; re-run locally on the 2026-10-18 merge (`f1fe90c`): all nine stages PASSED |
