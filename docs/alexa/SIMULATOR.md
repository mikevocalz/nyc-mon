# The NYC-MON smart-display simulator

`packages/web-sim` is the judged surface for the Alexa+ track. It looks like a smart display, talks to the NYC-MON MCP server as a real MCP client, and lets Claude on Amazon Bedrock be the Mon, driven by the Agent Skill in `skills/nyc-mon-companion/SKILL.md`. Why it is built this way: ADR 0017.

## How a turn works

```
 browser (simulator page, :5180)                         simulator server            MCP server (:8788)
 ───────────────────────────────                         ────────────────            ──────────────────
 you speak or type
   │
   ├─ agent loop ── POST /api/model {messages, tools} ──▶ adds the Agent Skill as
   │                                                       system prompt, model id,
   │  ◀────────────── streamed text + final message ───── limits; calls Claude on
   │                                                       Amazon Bedrock
   │
   ├─ tool_use? ── tools/call (Streamable HTTP) ──────────────────────────────────▶ runs the tool
   │  ◀────────────────────────────── result + _meta.ui.resourceUri ──────────────
   │
   ├─ the view: resources/read ui://… ────────────────────────────────────────────▶
   │     iframe on the sandbox origin (:5181) with the view's CSP as an HTTP header
   │     └─ inner iframe: the MCP Apps view, talking to the page over AppBridge
   │
   └─ loop until Claude answers in text → shown in large type, read aloud
```

- The browser runs the MCP client (`@modelcontextprotocol/client`) and the agent loop. AWS credentials, the model id and the system prompt stay on the simulator server.
- No code in the simulator picks tools. Claude reads the skill and the tool descriptions and decides (ADR 0009).
- MCP Apps views render inline next to the reply. Full screen is the same view grown to fill the screen, so it keeps its state; Escape or "Exit full screen" returns. A view can ask for full screen itself.
- The transcript and the model history survive a reload (browser storage). The Mon's state lives on the MCP server, so a new browser meets the same Mon.
- Push-to-talk uses the browser's Web Speech API: hold the orange mic button, or hold Space or Enter while it has focus. Browsers without speech recognition get a disabled mic with a note, and typing works everywhere. Replies are read aloud with speech synthesis; "Read replies aloud" turns that off.
- Dev mode adds a panel to seed presence events for the fictional people in the MCP server's fixtures, and lists the tools Claude was given. Nobody's voice is recorded.

## Run it

Requirements: Node 24.15 or newer, pnpm 12, and this repo installed (`pnpm install` at the root).

### 1. Local run without sign-in or AWS (scripted test model)

Two terminals from the repo root:

```sh
# MCP server: dev sign-in bypass, simulator tools, allow the simulator's origin
NODE_ENV=development MCP_ALLOWED_ORIGINS=http://localhost:5180 OAUTH_DEV_BYPASS=1 MCP_DEV_MODE=1 \
  pnpm --filter @acme/mcp-server dev

# Simulator: dev bypass, dev panel, scripted model
SIM_AUTH_MODE=dev-bypass SIM_DEV_MODE=1 SIM_MODEL_BACKEND=mock \
  pnpm --filter @acme/web-sim dev
```

Open http://localhost:5180. The caption under the screen says "Scripted test model": every message makes it call the status tool once and report what came back. Use this to check wiring, not to judge the Mon.

Mon status needs the `/v1` game API on admin-vite (`V1_BASE_URL`, default `http://localhost:5174`). Without it, status tools answer "NYC-MON can't reach your Mon right now" and the card shows its empty state. Presence and familiar-people tools work from the MCP server's fixtures either way.

### 2. With Claude on Amazon Bedrock

Same as above, minus `SIM_MODEL_BACKEND=mock`. The simulator server finds AWS credentials through the standard AWS chain (environment, `~/.aws`, SSO, role). The identity needs `bedrock-mantle:CreateInference` on the model, and the account needs Bedrock model access for it.

```sh
SIM_AUTH_MODE=dev-bypass SIM_DEV_MODE=1 SIM_BEDROCK_REGION=us-east-1 \
  pnpm --filter @acme/web-sim dev
```

### 3. With sign-in

Run admin-vite with the `nyc-mon-sim` client registered (lane B; its redirect URI is `http://localhost:5180/oauth/callback`), run the MCP server without `OAUTH_DEV_BYPASS`, and leave `SIM_AUTH_MODE` unset. "Sign in" sends you to the authorization server with PKCE (S256), `client_id=nyc-mon-sim`, `resource` set to the MCP endpoint, and the server's user scopes. Only accounts 18 and over can link (ADR 0015).

### Production build

```sh
pnpm --filter @acme/web-sim build
NODE_ENV=production SIM_PUBLIC_ORIGIN=https://sim.example SIM_SANDBOX_ORIGIN=https://sandbox.sim.example \
  pnpm --filter @acme/web-sim start
```

The sandbox origin must differ from the page origin. `SIM_AUTH_MODE=dev-bypass` refuses to start unless `NODE_ENV` is `development` or `test` (`pnpm dev` sets `development`).

### How `/api/model` is protected

`/api/model` spends Bedrock tokens, so every model turn passes these checks in order:

1. **Origin:** only `SIM_PUBLIC_ORIGIN`.
2. **Sign-in (OAuth mode):** the request carries the person's MCP access token. The server verifies it like the MCP server does: signature against the issuer's JWKS, `iss` = `AUTH_ISSUER`, `aud` = `SIM_MCP_URL`, a live `exp`, a user scope (`mcp:caller` or `mcp:care`) and a `sub`. The token must also be issued to `OAUTH_SIM_CLIENT_ID`. Without a valid token the answer is 401. Dev-bypass has no token and no gate, which is why it is development-only.
3. **Rate limits:** a sliding 60-second window per client (`SIM_RATE_LIMIT_PER_MIN`) and a global ceiling (`SIM_GLOBAL_RATE_LIMIT_PER_MIN`). The per-client key is the socket address; `SIM_TRUST_PROXY=1` switches it to the first `X-Forwarded-For` hop and is only safe behind a proxy you run, which overwrites that header. The limiter keeps at most 10,000 keys and evicts the least recently seen one.
4. **Body:** at most 1 MB, and only the block shapes the agent loop sends. User turns may hold text or `tool_result` blocks (text and base64 PNG/JPEG/GIF/WebP images); any other key or type, such as `cache_control`, documents or URL sources, is a 400. Every `tool_result` must answer a `tool_use` in the assistant turn just before it, and tool ids must look like `toolu_…`. Assistant turns replay the model's own `text`, `thinking`, `redacted_thinking` and `tool_use` blocks, with unknown keys stripped. The system prompt, model id and limits come from the server, never the request.

A public deployment in OAuth mode is gated by sign-in. Never expose a dev-bypass server publicly.

## Environment

Simulator server (`packages/web-sim/server/env.ts`):

| Name | Default | What it does |
|---|---|---|
| `SIM_PORT` | `5180` | Page and `/api` port |
| `SIM_SANDBOX_PORT` | `5181` | Sandbox proxy port |
| `SIM_PUBLIC_ORIGIN` | `http://localhost:5180` | Page origin; `/api/model` accepts only this `Origin` |
| `SIM_SANDBOX_ORIGIN` | `http://localhost:5181` | Sandbox origin; must differ from the page origin |
| `SIM_MCP_URL` | `http://localhost:8788/mcp` | The MCP server's Streamable HTTP endpoint |
| `SIM_AUTH_MODE` | `oauth` | `oauth` or `dev-bypass` |
| `SIM_DEV_MODE` | `0` | `1` shows the dev panel |
| `SIM_MODEL_BACKEND` | `bedrock` | `bedrock` or `mock` |
| `SIM_BEDROCK_MODEL_ID` | `anthropic.claude-opus-5-5` | Model on Claude in Amazon Bedrock |
| `SIM_BEDROCK_REGION` | `AWS_REGION` | Region of the Bedrock endpoint |
| `SIM_MODEL_EFFORT` | `low` | `low`, `medium` or `high` |
| `SIM_MAX_OUTPUT_TOKENS` | `4096` | Output cap per model turn |
| `SIM_SKILL_PATH` | `skills/nyc-mon-companion/SKILL.md` | Agent Skill used as the system prompt (repo-relative) |
| `SIM_RATE_LIMIT_PER_MIN` | `30` | Model turns per sliding minute per client |
| `SIM_GLOBAL_RATE_LIMIT_PER_MIN` | `120` | Model turns per sliding minute across all clients |
| `SIM_TRUST_PROXY` | `0` | `1` keys the rate limit on the first `X-Forwarded-For` hop (behind your own proxy only) |
| `AUTH_ISSUER` | `http://localhost:5174` | The authorization server (admin-vite). Shared with the MCP server and admin-vite |
| `AUTH_JWKS_URL` | `{AUTH_ISSUER}/payload-api/auth/jwks` | Keys for verifying the bearer token on `/api/model` |
| `OAUTH_SIM_CLIENT_ID` | `nyc-mon-sim` | The client id the page signs in as. Shared with admin-vite, which registers the client from it |
| `NODE_ENV` | — | `development` or `test` is required for `SIM_AUTH_MODE=dev-bypass`; `production` serves the built page |

The production page CSP allows connections to its own origin, the MCP server's origin and `AUTH_ISSUER`'s origin only, and `'wasm-unsafe-eval'` for CanvasKit.

MCP server settings the simulator depends on (`packages/mcp-server/src/env.ts`): `MCP_ALLOWED_ORIGINS` must include the simulator origin; `OAUTH_DEV_BYPASS=1` pairs with `SIM_AUTH_MODE=dev-bypass`; `MCP_DEV_MODE=1` registers the presence tools the dev panel uses; `MCP_PORT` and `MCP_RESOURCE_URI` must agree with `SIM_MCP_URL`.

If something else already listens on port 8788 (on the dev machine a local proxy holds `127.0.0.1:8788`), move the MCP server: `MCP_PORT=8789 MCP_RESOURCE_URI=http://localhost:8789/mcp`, and set `SIM_MCP_URL=http://localhost:8789/mcp`.

## Checks

```sh
pnpm --filter @acme/web-sim typecheck
pnpm --filter @acme/web-sim lint
pnpm --filter @acme/web-sim test     # tool conversion, agent loop with a mocked Bedrock client, CSP/sandbox, auth, /api/model
pnpm --filter @acme/web-sim build
```

## Demo beats on this surface

1. "How's my Mon doing?": the Mon answers and the status card appears beside the reply. Tap "Full screen" to show the room.
2. Tap "Share a meal" on the card: the view calls `feed_mon` through the bridge and the meters update.
3. Dev panel, James at 0.93, then "Who's here right now?": the Mon greets James. At 0.75 it hedges.
4. As James, ask to use the Caller's rare item: the Mon refuses in its own voice.
5. Reload the page: the conversation is still there, and the Mon's state comes back from the server.

Beats 1, 2 and 5 were run locally with the scripted model against the MCP server and a stand-in `/v1`. Beats 3 and 4 depend on Claude following the skill; they were not run against Bedrock in this build, and their wording varies run to run. No Alexa logo or Amazon device imagery appears in the UI.
