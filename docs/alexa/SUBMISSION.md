# Devpost submission text (draft)

Paste-ready text for the Devpost form, written to the four equally weighted criteria. Placeholders in `[CREATOR: …]` are decisions for Mike. Anything marked **pending live verification** must be confirmed, or cut, before the form closes on Fri 2026-10-23 at 12:00 PT. Sources for each claim are listed under the text and are not pasted into Devpost.

---

## Name

NYC-MON on Alexa+

## Tagline

Check on your Mon, share a meal, put it to bed: a NYC-MON companion that speaks through any MCP client, shown in a smart-display simulator with Claude on Amazon Bedrock.

## Tracks

Alexa+ (self-hosted MCP server, Streamable HTTP, spec 2025-11-25). Mini challenges: AWS Builder and Open Source [CREATOR: enter only once the contribution exists].

## What it does

NYC-MON is a creature game set in New York. Each player, the Caller, raises a Mon from an egg. This entry puts that Mon on Alexa+.

Say "how's my Mon doing?" and [CREATOR: Mon demo name] answers with a chirp and one thing it needs. A card shows its picture, its Bloodline and three care rings: Energy, Fullness, Social. Ask to share a meal, or tap the button on the card, and the same MCP tool runs either way. The rings move. Put it to bed, wake it, play Peek. If the Mon is asleep or still full, it declines, and says why in plain words.

Familiar people get their own rules. In the demo, James is a fictional friend with a synthetic voice who may talk and play with the Mon but may not feed it. When James asks for something only the Caller can do, the Mon turns away with a huff and says so. Verified against Claude Sonnet 4.6 on Bedrock on 2026-10-21, three runs out of three.

Nothing is lost while the Caller is away. There are no streaks and no guilt messages. The add-on links only 18+ accounts.

## How it works

Four parts, all in the public repo.

1. **MCP server** (`packages/mcp-server`). Streamable HTTP on the MCP TypeScript SDK v2. It answers the 2025-11-25 handshake and negotiates down to the 2025-03-26 version Amazon's lifecycle sample sends. Eight care and status tools are always registered. Six familiar-people and presence tools, including `inject_presence_event`, exist only in dev and simulator builds, so a production `tools/list` holds only tools that work. Care calls are idempotent per intent, so a retried "feed" never feeds twice. The server makes no model calls, which keeps it inside Alexa+'s 500 ms round-trip limit. [Pending live verification: latency against the real database.]
2. **MCP Apps views.** The status card and the full-screen room are `ui://` HTML resources, one self-contained file each, rendered by the host in a sandboxed iframe. Every button calls the same tool the model would, and everything on the card is also in the tool data, so a speaker with no screen loses nothing.
3. **Account linking.** An OAuth 2.1 authorization server built on Better Auth's OAuth provider, shaped to Amazon's account-linking rules: client credentials for discovery, authorization code with PKCE S256 for user tools, a refresh token with every access token, `resource` pinned to the MCP URL, no OpenID Connect. Under-18 accounts are refused at sign-in, at consent, and on every token issue. [Pending live verification: end-to-end against a deployed issuer.]
4. **Agent Skill and simulator.** `skills/nyc-mon-companion/SKILL.md` teaches the session: which tool answers which request, how a Baby Mon sounds, how to read a declined meal, how to hedge at 0.75 presence confidence and greet at 0.93. The simulator (`packages/web-sim`) is a smart-display page that acts as a real MCP client. It loads the skill as the system prompt for Claude Sonnet 4.6 on Amazon Bedrock, and no code in it picks tools: the model reads the skill and the tool descriptions and decides. Push-to-talk and read-aloud use the browser's speech APIs.

On a real Echo, Alexa's own model writes the reply from the same tool data. The character then comes through structured fields (mood, decline reasons) and the MCP Apps views. The skill drives the voice fully in our simulator and in any MCP agent that loads it.

## Why it matters

[CREATOR: one or two sentences on the audience, written by you. The draft below only states facts from the repo.]

NYC-MON already runs on the Caller's phone. On Alexa+ the same Mon carries over: a device session is a surface, not a new creature. A Caller can check on their Mon from the kitchen without opening the app. The design keeps state across sessions on the server, so a new browser or device meets the same Mon.

## How we built it

- MCP TypeScript SDK v2 (`@modelcontextprotocol/server`, `client`, `node`) and the MCP Apps SDK (`@modelcontextprotocol/ext-apps`).
- Claude Sonnet 4.6 on Amazon Bedrock (bedrock-runtime, US cross-region inference profile) through the Anthropic Bedrock SDK, with the Agent Skill as a cached prompt prefix. One demo session costs about $0.06. Details in `docs/aws-builder.md`.
- Better Auth with `@better-auth/oauth-provider`, on Payload CMS and Neon Postgres.
- The NYC-MON kit (Storybook-documented components) for the views and the linking pages.
- Tests: 113 MCP server tests and 88 simulator tests pass at `f516bda`. The nine offline stages of `alexa-readiness.yml` passed in CI on `main` at `58956b6` (run 39635606354). A red-team suite covers token forgery (alg=none, HS256 keyed with the public key), audience tricks, oversized bodies, JSON-RPC batches, look-alike origins and sandbox message spoofing.

## Before and after the submission period

The repo existed before 2026-08-31 as a single scaffold commit from 2026-08-19. Built during the period: the MCP server, the MCP Apps views and the Agent Skill (first commit 2026-10-05), the OAuth authorization server and the `/v1` routes it uses, and the web simulator on Claude via Amazon Bedrock. The NYC-MON game itself was also built after the scaffold. The Alexa+ work sits on top of it.

## Challenges

The full log with commits is in `docs/FRICTION-LOG.md`. Three that shaped the build:

- Amazon's overview says Alexa+ supports MCP 2025-11-25, while its lifecycle sample initializes with 2025-03-26 and its Local Inspector with 2025-06-18. The server negotiates down, and contract tests replay all three.
- Amazon wants a bare 401 with no `WWW-Authenticate` header, which departs from the MCP spec's header discovery. Our own live smoke test first checked for the header.
- Under the older protocol version, a JSON-RPC batch of two meals applied both. The server now refuses batches before auth.

## What's next

[CREATOR: pick from open work, for example real voice enrollment after a COPPA/BIPA decision (ADR 0015 §2), or guardian access for a child's Mon.]

## Testing instructions

- Simulator URL: none. The services are not hosted. The rules accept a locally runnable public repo plus the demo video.
- Test account: none needed locally. The dev sign-in bypass in `docs/alexa/SIMULATOR.md` skips linking. Mon status needs the `/v1` API on admin-vite and its database; without them the status tools say "NYC-MON can't reach your Mon right now", while presence and familiar-people beats still work.
- Run locally: `docs/alexa/SIMULATOR.md`, "Run it". With AWS credentials and Bedrock access, the default model is `us.anthropic.claude-sonnet-4-6`. Without AWS, the scripted test model checks wiring only and is labelled as such on screen. It refuses to start in production.

## Video

[CREATOR: who records it, and whether it shows a device frame or the simulator page as it is.]

Constraints from the rules: under 3 minutes, public on YouTube or Vimeo, English, no Alexa+ logo, no third-party trademarks or copyrighted music, and recorded against the real model, never the scripted mock. Link: [pending live verification].

## Open Source mini challenge

[CREATOR: the contribution. Devpost asks for the contribution URL, the project repository URL, a GitHub username, and what it does, how it works and why it matters. ADR 0009 suggests publishing the presence-event schema or the skill. That is a suggestion, not a decision.]

---

## Sources for the claims above

| Claim | Source |
|---|---|
| 2025-11-25 handshake, negotiation to 2025-03-26 and 2025-06-18 | `packages/mcp-server/src/__tests__/http.test.ts` |
| Eight core tools, six dev-only tools (gated on `ctx.familiar`) | `packages/mcp-server/src/mcp/tools.ts`, ADR 0015 §4 |
| Care idempotency per intent | `docs/HANDOFF.md`, 2026-10-09 continuation |
| No model calls in the server, 500 ms limit | ADR 0009, ADR 0015 §3, `PLATFORM-DOCS.md` §2.3 |
| OAuth shape and the three 18+ checks | ADR 0016 |
| Skill content, presence tiers 0.90 / 0.70 | `skills/nyc-mon-companion/SKILL.md` |
| Model id, Bedrock client | `packages/web-sim/server/env.ts`, `model.ts` |
| Test counts | `docs/HANDOFF.md` §2 (103, 61), 5b66a1a (68) |
| Red-team cases | 7e72b98 |
| Batch refusal | 13dd49a |
| Bare 401 in the smoke test | e571e0e |
| Mock refused in production | e3e5036 |
| Before/after dates | `docs/plans/alexa-submission.md` |
