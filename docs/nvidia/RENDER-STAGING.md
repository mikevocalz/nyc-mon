# Render staging for NVIDIA/Nebius (Railway fallback)

**Scope:** one authenticated MCP HTTP service and one NVIDIA companion HTTP
service, both built from the existing `mikevocalz/nyc-mon` monorepo. Keep the
current admin-vite/Payload/Better Auth issuer and `/v1` API on their existing
approved host; keep the existing Neon database and Nebius provider. This
configuration does **not** provision another database, user system, proxy
backend, or external event pipeline.

The root `render.yaml` is a proposed staging Blueprint. Merely committing it
does not create or deploy anything. **Do not apply it or enable billing until
the owner confirms the workspace and compute budget.** The two starting
compute plans are `0.5c-512mb` (512 MB each). Review live Render pricing and
build/egress usage; scale only if measured memory/performance requires it.
Autodeploy is deliberately off and preview-environment generation is off.

## Readiness before applying

1. Confirm which Render workspace will own the resources. Select that
   workspace in the Render Dashboard, then connect the same GitHub repository.
2. Confirm the authorized, HTTPS **admin-vite/Payload backend** is reachable
   and still uses the existing Better Auth issuer, existing Neon data and the
   `V1_MCP_SERVICE_KEY`. A Vercel site alone is not proof that
   `/payload-api/auth/jwks`, OAuth and `/v1` are reachable.
3. Confirm the companion-memory migration
   `20261024_164500_companion_memory` is reviewed and safely applied by an
   authorized operator. The Blueprint **never** runs SQL or seeds live Mons.
4. Confirm current NVIDIA stack CI/security checks before any merge or
   deploy. For isolated staging, select the Blueprint's reviewed feature
   branch; after all dependencies merge, use the protected release branch.
5. Confirm the user-approved monthly budget and how long judge access must
   remain available. Applying a Blueprint creates billable services.

## Create the two-service Blueprint

From the Render Dashboard use **New → Blueprint**, connect the intended repo,
select the reviewed branch containing `render.yaml`, and inspect the planned
resources **before Apply**. The two services must be the only new resources:

- `nyc-mon-nvidia-mcp-staging`: long-running Node MCP server, HTTP `/mcp`,
  health endpoint `/healthz`; real JWT verification, no dev fixtures.
- `nyc-mon-nvidia-companion-staging`: long-running Node web-sim NVIDIA
  companion, `/nvidia.html`, `/api/model`, `/api/memory`, `/healthz`.
  The startup command uses `nvidia-main.mjs` for native TS transformation.

Both use the repository's pinned Node 24 and pnpm, build from the **repository
root** so all workspace dependencies are installed, and listen on port 10000.
Render supplies HTTPS at its edge. Do not convert either process into a
one-request Vercel Function or run the dev-bypass modes.

### Exact required environment configuration

During initial Blueprint setup, Render prompts for `sync: false` variables.
Set them in Render's secure environment controls, **not** in the Git repo,
chat, PR descriptions, demo video, or CI logs.

| Variable | MCP | Companion | Rule |
| --- | --- | --- | --- |
| `MCP_RESOURCE_URI` | required | — | Exact actual HTTPS MCP URL including `/mcp`; JWT audience and protected-resource metadata |
| `MCP_ALLOWED_ORIGINS` | required | — | Exact companion browser HTTPS origin; no trailing path |
| `AUTH_ISSUER` | required | required | Existing issuer origin, exactly as tokens' `iss` |
| `AUTH_JWKS_URL` | required | — | Existing issuer's `/payload-api/auth/jwks` endpoint |
| `V1_BASE_URL` | required | required | Existing HTTPS `/v1` API's base origin (no `/v1` suffix) |
| `V1_MCP_SERVICE_KEY` | required | required | Same secret already used by admin-vite; **never regenerate for only one service** |
| `SIM_PUBLIC_ORIGIN` | — | required | Exact HTTPS origin assigned to the companion service |
| `SIM_MCP_URL` | — | required | **Exactly** the same value as `MCP_RESOURCE_URI`, including `/mcp` |
| `NEBIUS_API_KEY` | — | required | Nebius Token Factory secret, server only |

After Render assigns hostnames, verify these exact strings in the Dashboard
and correct any URL that differs from a guessed host. A wrong JWT audience,
issuer, or origin must be fixed through configuration—not an auth bypass.
`MCP_TOKEN_VERIFIER=jwt`, `MCP_DEV_MODE=0`, `OAUTH_DEV_BYPASS=0` and
`NODE_ENV=production` are locked by the Blueprint.

In the **existing** OAuth client's configuration, append
`${SIM_PUBLIC_ORIGIN}/nvidia.html` to `OAUTH_SIM_REDIRECT_URIS` alongside
the current redirect URI values. Never replace the existing callbacks.
Client ID remains `nyc-mon-sim`. No new provider or account system.

## Launch and verification

The Blueprint's `autoDeployTrigger: off` prevents commits from silently
replacing staging. Initial Blueprint Apply can still launch an initial build.
If a required value isn't available, don't treat the initial build or a 200
from `/healthz` as success; set the right value then deploy the reviewed
revision explicitly.

1. Verify both deployments are actually **live** and both `/healthz`
   endpoints return 200. Inspect logs for startup, port and memory failures.
2. Verify `/api/nvidia/config` identifies the approved NVIDIA/Nebius model
   without disclosing credentials.
3. Test clean-browser OAuth/PKCE, real JWT audience and CORS checks, anonymous
   rejection, and access to `/mcp` from the companion's actual origin.
4. On an authorized **adult dedicated test account** with a real hatched
   Mon, trigger model-selected `feed_mon`; require `applied: true` and
   independently read back persisted `lastFedAt`. A declined/blocked action
   does not pass.
5. With explicit Save consent, verify memory is retrieved in a second
   independently authenticated browser session; verify another Caller cannot
   read it. Then Forget and verify deletion persists in a fresh session.
6. Record live Nebius receipt, exact source revision, model and latency
   evidence without user IDs, notes, prompts or keys.
7. Verify judge access from a non-developer device and run the full
   submission preflight. A text-only demo does not prove the iPad 3D renderer.
8. Confirm the judge-access shutdown date and turn off services afterward
   only when it no longer jeopardizes submission access.

Never turn on `MCP_DEV_MODE` or `OAUTH_DEV_BYPASS` for a hosted demo.
See `docs/nvidia/ACCEPTANCE.md`, `docs/nvidia/DEPLOY.md` and
`docs/nvidia/EVIDENCE-2026-10-28.md` for independent release gates.

## Rollback / removal

Because Render is staging-only and no migrations are in this Blueprint, a
failed service deploy can be rolled back without changing Neon state.
**A Render rollback never undoes prior care mutations or SQL migrations.**
Disable traffic, roll back compatible code/config, and retain evidence.
Provisioning and deletion are separate owner-authorized actions.
