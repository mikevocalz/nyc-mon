# The NYC-MON smart-display simulator

`packages/web-sim` is the judged surface for the Alexa+ track. It looks like a smart display, talks to the NYC-MON MCP server as a real MCP client, and lets Claude on Amazon Bedrock be the Mon, driven by the Agent Skill in `skills/nyc-mon-companion/SKILL.md`. Why it is built this way: ADR 0017.

## How a turn works

```
 browser (simulator page, :5180)                         simulator server            MCP server (:8788)
 ───────────────────────────────                         ────────────────            ──────────────────
 you hold Talk and speak (or type in the dev panel)
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
   └─ loop until Claude answers in text → caption along the bottom,
         spoken in the Mon's voice: POST /api/tts ──────────▶ ElevenLabs, pitched by
                                                            stage through ffmpeg
```

- The browser runs the MCP client (`@modelcontextprotocol/client`) and the agent loop. AWS credentials, the model id and the system prompt stay on the simulator server.
- No code in the simulator picks tools. Claude reads the skill and the tool descriptions and decides (ADR 0009).
- The display is voice first, as an Alexa+ device is (eb16896): the screen holds the active MCP Apps view edge to edge, with no chat log, text box or title badge. Before any view opens it shows one line inviting the person to tap Talk. The latest reply runs as a caption along the bottom, with stage directions such as *chuckle* left out (2d3f204), and a status badge appears only while the state changes (listening, thinking, connecting, offline). Talk and, during a turn, Stop sit below the display.
- The page is one screen (836a7cc): `h-dvh`, no page scroll, a one-row header, the display filling the rest. The display slot reports its height to the view as `maxHeight` and the view fits it. Tester tools scroll inside their own column.
- A view asks for full screen itself (the card's Journal button opens the room); Escape returns. The view keeps its state, since full screen is the same view grown.
- Saved cards are resolved against the server that is running now (59528bf). The MCP server puts a content hash in each `ui://` URI, so a rebuilt server changes them; the page derives the view URI at render time from the tool the connected server lists, and "Try card again" re-lists the tools first.
- The transcript and the model history survive a reload (browser storage). The Mon's state lives on the MCP server, so a new browser meets the same Mon.
- Push-to-talk uses the browser's Web Speech API: hold Talk, or hold Space or Enter while it has focus. Typing lives in a "Type instead" panel under the dev panel, with the text box, Send, suggestion chips and the conversation log. Outside dev mode that panel, titled "Type to your Mon", shows only when the browser has no speech recognition, so the sim stays usable without a mic. "Read replies aloud" turns speech off.
- Dev mode adds a panel to seed presence events for the fictional people in the MCP server's fixtures, and lists the tools Claude was given. Nobody's voice is recorded.
- Signed out, the display shows Lil' Ratti in 3D (`MonModel3D`, from the sim's own `/mons` route), with one Sign in that hands off to the Alexa linking pages (276c6e8, 31b1c98).

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

Same as above, minus `SIM_MODEL_BACKEND=mock`. The simulator server finds AWS credentials through the standard AWS chain (environment, `~/.aws`, SSO, role). The default model is Claude Sonnet 4.6 through the US cross-region inference profile (`us.anthropic.claude-sonnet-4-6`) on bedrock-runtime. The identity needs `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` on that profile and its foundation models, and the account must have filed Anthropic's first-time use case form (`aws bedrock put-use-case-for-model-access`). To use Claude Opus 5.5 on bedrock-mantle instead, set `SIM_BEDROCK_MODEL_ID=anthropic.claude-opus-5-5`. That path needs `bedrock-mantle:CreateInference` and a nonzero mantle quota, which the creator's account does not have.

```sh
SIM_AUTH_MODE=dev-bypass SIM_DEV_MODE=1 SIM_BEDROCK_REGION=us-east-1 \
  pnpm --filter @acme/web-sim dev
```

### 3. With sign-in

Run admin-vite with the `nyc-mon-sim` client registered (lane B; its redirect URI is `http://localhost:5180/oauth/callback`), run the MCP server without `OAUTH_DEV_BYPASS`, and leave `SIM_AUTH_MODE` unset. "Sign in" sends you to the authorization server with PKCE (S256), `client_id=nyc-mon-sim`, `resource` set to the MCP endpoint, and the server's user scopes. You land on the same linking pages Alexa uses (`/oauth/sign-in`: Continue with Amazon, passkey, email). Only accounts 18 and over can link (ADR 0015). The sim is a public client, so the browser posts the code exchange itself; admin-vite's CORS list includes public clients' redirect origins for that (22b58d5, `docs/alexa/AUTH.md`).

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
| `SIM_BEDROCK_MODEL_ID` | `us.anthropic.claude-sonnet-4-6` | Bedrock model id. A geo-prefixed profile goes to bedrock-runtime, a bare `anthropic.*` id to bedrock-mantle |
| `SIM_BEDROCK_REGION` | `AWS_REGION` | Region of the Bedrock endpoint |
| `SIM_MODEL_EFFORT` | `low` | `low`, `medium` or `high` |
| `SIM_MAX_OUTPUT_TOKENS` | `4096` | Output cap per model turn |
| `SIM_SKILL_PATH` | `skills/nyc-mon-companion/SKILL.md` | Agent Skill used as the system prompt (repo-relative) |
| `SIM_RATE_LIMIT_PER_MIN` | `30` | Model turns per sliding minute per client |
| `SIM_GLOBAL_RATE_LIMIT_PER_MIN` | `120` | Model turns per sliding minute across all clients |
| `ELEVENLABS_API_KEY` | unset | Server-only key for `/api/tts`, the Mon's own voice. Unset, the route answers 204 and the page speaks with Web Speech |
| `FFMPEG_PATH` | `ffmpeg` on `PATH` | The binary `/api/tts` pitches each clip with. With none, clips keep the voice's own pitch and the server logs it once |
| `SIM_TTS_RATE_LIMIT_PER_MIN` | `30` | Speech requests per sliding minute per client (the global ceiling is `SIM_GLOBAL_RATE_LIMIT_PER_MIN`) |
| `SIM_TRUST_PROXY` | `0` | `1` keys the rate limit on the first `X-Forwarded-For` hop (behind your own proxy only) |
| `AUTH_ISSUER` | `http://localhost:5174` | The authorization server (admin-vite). Shared with the MCP server and admin-vite |
| `AUTH_JWKS_URL` | `{AUTH_ISSUER}/payload-api/auth/jwks` | Keys for verifying the bearer token on `/api/model` |
| `OAUTH_SIM_CLIENT_ID` | `nyc-mon-sim` | The client id the page signs in as. Shared with admin-vite, which registers the client from it |
| `NODE_ENV` | — | `development` or `test` is required for `SIM_AUTH_MODE=dev-bypass`; `production` serves the built page |

The production page CSP allows connections to its own origin, the MCP server's origin and `AUTH_ISSUER`'s origin only, and `'wasm-unsafe-eval'` for CanvasKit.

**Mon voice (simulator only).** Each Mon has a gender and one voice lineage for life, both minted at hatch from a salted hash of the egg id (Bible v11 ¶54 and ¶56; 6a88241). The lineage id reads `<egg form speciesId>/<gender>/<slot>`, for example `dex-001/female/2`, and tool results carry it as `mon.voice.lineageId` with the Mon's stage (963adbd). Payload stores both and refuses to change them once set (8e9aa13). The page posts each reply to `/api/tts` with `{ text, lineageId, stage, mood }` (text up to 400 characters); the server picks the ElevenLabs voice from `@acme/content/voices` (Hood Ratti pools filled, other lines TODO(canon), which resolve to no voice and get a 204), calls `eleven_v4_turbo` on `/stream`, and streams `audio/mpeg` back. Pitch per stage is done on the server, since ElevenLabs has no pitch setting: ffmpeg runs `asetrate` by the stage factor (Baby 1.30, Small 1.15, Mid 1.0, Max 0.92; an Egg is silent), resamples to 44.1 kHz, then `atempo` by the inverse, so pitch moves and length stays (63bf7a3). The page plays at rate 1. The mood adds a leading audio tag and a stability (content `[happily]`, asleep `[whispers]`, and so on), and stage directions with a matching tag become that tag. On 204 or an error the page falls back to Web Speech with the same table as `utterance.pitch`. `/api/tts` has the same Origin check, sign-in check and rate limiting as `/api/model`, and never logs the key or the text. A real Echo ignores all of this: Alexa reads replies in its own voice (PLATFORM-DOCS §2.8).

Lip sync for the 3D Mon is in progress; it is not on this branch yet.

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
4. Dev panel, "Speaking as" James, then "Can I feed it?": `feed_mon` goes out with James as the speaker, the server answers `not-permitted`, and the Mon refuses in its own voice.
5. Reload the page: the conversation is still there, and the Mon's state comes back from the server.

Beats 1, 2 and 5 were run locally with the scripted model against the MCP server and a stand-in `/v1`. Beats 3 and 4 depend on Claude following the skill, and their wording varies run to run. On 2026-10-21 they ran against Claude Sonnet 4.6 on Bedrock (`docs/aws-builder.md`, "Measured cost per session"). The Mon greeted James at 0.93 and hedged at 0.75. Beat 4 first failed: nothing told the server or the model that James was speaking, and the agent loop hid the `not-permitted` reason from the model. The dev panel's "Speaking as" control now sends `speakerHint` on care tools and adds a `[Presence: James is speaking.]` line to the model's copy of the turn, and error results carry their structured reason. After that fix, three runs out of three refused in the Mon's voice, for example: "*short huff, your Mon turns back toward you.* Only the Caller can share a meal, James. You're welcome to play Peek instead!" No Alexa logo or Amazon device imagery appears in the UI.
