# Run the NVIDIA Personal Companion

The companion adds `/nvidia.html` and a dedicated entry inside the existing web-sim package, reusing Better Auth, the MCP client/agent loop, shared UI, Payload and Neon. The original Bedrock entry is unchanged. This first interface is text-first and does not require proprietary character media, but the complete public-source dependency closure still needs rights review.

## Prerequisites

Use the repository's pinned Node and pnpm versions. From the repository root run `pnpm install --frozen-lockfile` for the full workspace: a narrowly filtered install can omit universal image/native peers and produce misleading shared-UI type errors.

Required real services:
1. Existing admin-vite/Payload authorization and `/v1` backend, with the existing Neon database.
2. Reviewed migration `20261024_164500_companion_memory`, applied by an authorized operator. This PR does not apply it.
3. Existing MCP server using real JWT auth and `/v1`, with fixture/bypass flags unset.
4. Nebius Token Factory account/key and an available reviewed NVIDIA model.
5. An adult Caller and real hatched Mon in that account. No parallel account/save system or age bypass.

Add `${SIM_PUBLIC_ORIGIN}/nvidia.html` alongside existing callbacks in `OAUTH_SIM_REDIRECT_URIS` for `nyc-mon-sim`. Preserve existing callback registrations. Match issuer, audience/resource, client ID, trusted origin and shared service key across the existing services.

## Server environment

Set secret values in the approved environment/secret manager, not source, a PR or chat.

```
NODE_ENV=development
SIM_PORT=5180
SIM_PUBLIC_ORIGIN=http://localhost:5180
SIM_MCP_URL=http://localhost:8788/mcp
AUTH_ISSUER=http://localhost:5174
OAUTH_SIM_CLIENT_ID=nyc-mon-sim
V1_BASE_URL=http://localhost:5174
V1_MCP_SERVICE_KEY=<same existing service key>
NEBIUS_API_KEY=<Nebius Token Factory key>
NEBIUS_BASE_URL=https://api.tokenfactory.us-central1.nebius.com/v1
SIM_NEBIUS_MODEL_ID=nvidia/Nemotron-3_5-Lightning
SIM_MAX_OUTPUT_TOKENS=1024
```

## Run and build

```
pnpm --filter @acme/web-sim exec node server/nvidia-main.mjs
pnpm --filter @acme/web-sim build
```

The `.mjs` launcher explicitly supplies `--experimental-transform-types` because native Node 24 strip-only mode cannot execute TypeScript parameter properties. Do not invoke the typed `.ts` entry directly without that flag. Validate the pinned Node runtime before production use.

Open `/nvidia.html`. Sign in, load memory, enter a harmless preference, explicitly approve saving, and save. Ask a care question and inspect the real MCP outcome. Sign out and use a second browser session to verify the same account/Mon and saved preference. Forget memory and check another fresh session. A refusal or unavailable backend must remain visible, not portrayed as successful care.

Production: build first, set `NODE_ENV=production`, use HTTPS origins and an approved proxy/process supervisor. This is a long-running Node service; a ready general Vercel website does not prove MCP or this companion is deployed. Memory is read afresh for each model call. Buffered model completion is used initially; character rendering and voice are not part of this minimal acceptance path.

## Verification still required

Actual account `/models` availability and inference receipt; authorized migration; visual OAuth flow; database-backed care action; second-session/browser continuity and deletion; hosted judge access; latency; public-source and asset permissions; public YouTube demo. See `ACCEPTANCE.md` and `VALIDATION-2026-10-24.md` for the exact distinction between performed tests and open runtime gates.
