# Run the NVIDIA Personal Companion

This adds `/nvidia.html` and `server/nvidia-main.ts` **inside the existing web-sim package**, reusing Better Auth, the MCP client, the agent loop, shared UI kit, Payload and Neon. The original Bedrock simulator entry is unchanged. The focused text interface deliberately needs no proprietary character model, music or map asset. It is not yet a claim of a legally complete public export or a live deployment.

## Required real services

1. Existing admin-vite/Payload auth and `/v1`, using the existing Neon database.
2. Reviewed migration `20261024_164500_companion_memory` applied by an authorized operator. This PR does not run it.
3. Existing MCP server with `MCP_DEV_MODE` and `OAUTH_DEV_BYPASS` unset, real `V1_BASE_URL` and service key.
4. A Nebius Token Factory account/key with an available NVIDIA model.
5. An adult Caller and a real hatched Mon in the existing account. Do not fabricate a different save or bypass age checks.

Register `${SIM_PUBLIC_ORIGIN}/nvidia.html` alongside the existing `/oauth/callback` in `OAUTH_SIM_REDIRECT_URIS` for the existing `nyc-mon-sim` client. Do not remove existing redirects. Keep issuer, resource URL and client ID consistent on all three services.

Server environment names (secret values belong in a secret manager, not a committed file):

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

From the repository root after frozen-lockfile installation:

```
pnpm --filter @acme/web-sim exec node server/nvidia-main.ts
```

Open `/nvidia.html`. Sign in, load memory, enter a harmless preference, explicitly approve it, then save. Ask a care question and inspect the real MCP outcome. Sign out, open a second browser session, sign into the same account, load the same revision, and ask a personalized question. Forget memory and verify it disappears in a fresh session. A denied or unavailable tool must be shown as such, never as successful care.

Build: `pnpm --filter @acme/web-sim build`. Production uses `NODE_ENV=production` and HTTPS for every public/auth/backend origin, behind an approved TLS proxy. This is a long-running Node service, not proof that the existing Vercel website hosts MCP or this simulator. The native/Bedrock page is not rewritten. The focused companion currently uses buffered model completion; token streaming, character rendering and voice are outside this initial acceptance path.

## Explicit remaining evidence

- Current account `/models` availability and first real inference receipt.
- Route generation/build validation for admin-vite.
- Real OAuth, migration, database-backed action, second-browser and deletion tests.
- Hosted judge access, latency measurements, public source/asset licensing review and YouTube video.

Do not call offline tests or a successful page build a qualifying live demo.
