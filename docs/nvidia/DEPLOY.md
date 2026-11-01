# Deployment and runtime readiness

This document is a deployment checklist, not evidence that hosting is complete. No service is created, DNS changed, migration applied, or production secret written by these PRs.

## Preserve the existing backend

Use the current `apps/admin-vite` Payload/Better Auth backend and Neon database. The general NYC-Mon Next/Vercel site is not proof that `/v1`, the OAuth issuer or the long-running MCP/companion processes are hosted.

Prepare an authorized staging database/restore point and review the additive `20261024_164500_companion_memory` migration before applying it. Confirm existing migrations are applied first. The down migration refuses nonempty approved memory; do not bypass that protection. Keep `PAYLOAD_PUSH` off in production.

Register the exact memory route with the existing router. The TanStack generator must include `/v1/me/companion-memory` before building/typechecking admin-vite. Add the existing simulator client's `/nvidia.html` redirect alongside its current callback. Validate issuer/audience/resource/client ID consistency; never relax them to make a demo pass.

## Long-running services

MCP: existing `packages/mcp-server` process, real JWT auth and `/v1` data provider. No `MCP_DEV_MODE` or `OAUTH_DEV_BYPASS`.

NVIDIA companion: `packages/web-sim`, build with the existing Vite command and run `node server/nvidia-main.mjs` under Node 24. The launcher explicitly enables Node's native TypeScript transformation; this is an experimental Node flag and must be tested with the pinned runtime. Use a process supervisor/container and an approved HTTPS reverse proxy, not a short-lived Vercel function assumption.

Keep `NEBIUS_API_KEY` and `V1_MCP_SERVICE_KEY` server-only. Configure secrets in the approved host and protected `nvidia-live` GitHub environment, not in source, logs, videos, PR comments or chat. Configure environment reviewers before dispatching mutation checks.

## Observable release gates

1. `/healthz` responds but does not count as a working agent.
2. `/api/nvidia/config` identifies Nebius/NVIDIA and exposes no credentials.
3. Anonymous model/memory requests fail; service-only or wrong-client/audience tokens fail.
4. Real adult OAuth/PKCE through the published URL completes.
5. Model-selected care action changes the real existing Mon record and is visible after reconnect.
6. Explicitly saved memory survives another browser session; another Caller cannot read it; forgetting removes it.
7. Provider receipt includes exact model and Nebius endpoint; no fake fallback.
8. Judge access works in a clean browser without developer SSO. Measure model, tool, full-turn and first-visible-text latency separately.
9. Public source, YouTube footage, documentation and tested source revision match.

No transport, deployment, token or cookie security requirement should be removed just to obtain a green demo.
