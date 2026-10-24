# Friction log: Alexa+ add-on path, MCP, Bedrock and the libraries around them

The hackathon rules give up to a 10% bonus for friction log entries, each with "specific task attempted, steps taken, expected vs. actual result, severity rating, workaround used, and actionable suggestion" (`docs/alexa/HACKATHON.md`, submission checklist). Every entry below names the tool and points at a commit, a test or a captured doc. Anything not yet run against real infrastructure says **pending live verification**.

**Started:** 2026-10-06. **Last filled:** 2026-10-23.

## Severity

- **Blocker:** the documented path can't be completed.
- **High:** a wrong reading of the docs ships a bug or fails certification.
- **Medium:** costs a day or more, or needs a workaround in code.
- **Low:** a papercut.

## Log format

Newest first.

```
### YYYY-MM-DD: <short title>
- **Tool:** the named product, page or package
- **Task:** what we tried to do
- **Steps:** what we ran or read
- **Expected / actual:** what the docs led us to expect, and what happened
- **Severity:** Blocker | High | Medium | Low
- **Workaround:** what we did instead
- **Suggestion:** one change Amazon (or the maintainer) could make
- **Evidence:** commit, test or doc
- **Status:** open | worked around | fixed | reported
```

## Amazon Alexa+ and Amazon developer tools

### 2026-10-14: The docs never say whether Alexa+ sends JSON-RPC batches
- **Tool:** Alexa+ MCP Toolkit docs (client lifecycle page) and the MCP spec versions Alexa sends.
- **Task:** decide whether the MCP server must handle JSON-RPC batch requests.
- **Steps:** Alexa's sample `initialize` sends `protocolVersion: "2025-03-26"` (`PLATFORM-DOCS.md` §2.6). That revision still allowed batching. 2025-06-18 removed it, and 2025-11-25 has none. Our red-team suite sent a batch of two `feed_mon` calls.
- **Expected / actual:** expected the platform docs to say which batching behaviour Alexa uses after negotiating 2025-03-26. They don't. Our server applied both meals from the one batch.
- **Severity:** High. Two care mutations in one request applied twice the effect.
- **Workaround:** the server now answers any batch with HTTP 400 and JSON-RPC `-32600` before auth or any tool runs.
- **Suggestion:** state on the client lifecycle page whether the Alexa+ MCP client ever batches, and which spec revision's message rules apply after it negotiates down.
- **Evidence:** 13dd49a (`packages/mcp-server/src/mcp/server.ts`, `http.test.ts`), on `test/alexa-e2e-red-team`.
- **Status:** fixed in our server. Open as a docs gap.

### 2026-10-14: A bare 401 is required, which our own smoke test got wrong
- **Tool:** Alexa+ MCP QuickStart and Authentication pages, MCP 2025-11-25 authorization spec.
- **Task:** write a live smoke check that an anonymous MCP request is refused correctly.
- **Steps:** the first draft of `live-smoke.ts` asserted that the 401 carried a `WWW-Authenticate` header with `resource_metadata`, the discovery path the MCP spec describes.
- **Expected / actual:** the MCP spec lets clients find the protected-resource metadata through the header or the well-known URI. Amazon's QuickStart asks for a 401 "without a WWW-Authenticate header", and its Authentication page lists the header as "not supported". Our server already sent a bare 401 (`http.test.ts`, "returns 401 with no WWW-Authenticate"), so the smoke check was testing the wrong thing.
- **Severity:** Medium. Following the MCP spec's main path would fail Amazon's checklist.
- **Workaround:** the smoke check now expects a bare 401 and then fetches `/.well-known/oauth-protected-resource`.
- **Suggestion:** put one sentence on the QuickStart page saying the 401 rule is a deliberate departure from the MCP spec's header-based discovery, and that Alexa reads only the well-known URI.
- **Evidence:** e571e0e (`packages/web-sim/scripts/live-smoke.ts`), `PLATFORM-DOCS.md` §2.3, §2.4, §3.3, gap 5.
- **Status:** worked around.

### 2026-10-08: Alexa+ says it supports 2025-11-25, then sends 2025-03-26
- **Tool:** Alexa+ MCP Toolkit Overview and Client Lifecycle pages, Alexa+ Local Inspector docs.
- **Task:** pick the MCP protocol version the server must speak.
- **Steps:** read the overview ("supports the 2025-11-25 version"), the lifecycle sample `initialize`, and the Local Inspector flow.
- **Expected / actual:** expected Alexa to initialize with 2025-11-25. The lifecycle sample sends `2025-03-26`, and the Local Inspector sends `2025-06-18`. Meanwhile the current MCP spec is 2026-07-28, which drops `initialize` entirely.
- **Severity:** High. A server that rejects older versions, or one built on 2026-07-28, would break Alexa.
- **Workaround:** serve 2025-11-25 and negotiate down. Contract tests replay all three handshakes.
- **Suggestion:** list on the overview page every protocol version the Alexa+ client and the Local Inspector send, and say whether 2026-07-28 servers are supported.
- **Evidence:** `packages/mcp-server/src/__tests__/http.test.ts` ("negotiates down to Alexa's 2025-03-26 initialize payload", the 2025-06-18 case), 100199e, `PLATFORM-DOCS.md` §2.1, §2.6, §2.10, §3.1, gap 8.
- **Status:** worked around.

### 2026-10-08: The Alexa+ web simulator, Local Inspector and CLI are all closed to participants
- **Tool:** `alexa-ai` CLI, Alexa+ web simulator, `@alexa-ai/addon-local-inspector`.
- **Task:** test the add-on the way Amazon's testing page describes: MCP Inspector, then the Local Inspector, then `alexa-ai test`, then the console simulator.
- **Steps:** read the environment setup page (a private CodeArtifact registry behind an AWS role granted by an Alexa Solutions Architect), the simulator page (opens only for a deployed add-on), and the Local Inspector page (installed from the logged-in Developer Console). A participant reported `npm install -g @alexa-ai/cli` returns 404 (FT/45262).
- **Expected / actual:** the hackathon names Alexa+ as the track, so we expected some test path into Alexa. The FAQ confirms none exists: "there is currently no way for hackathon participants to apply for or gain access."
- **Severity:** Blocker for any Amazon-side test. Not for the submission, which accepts a self-built simulator.
- **Workaround:** built `packages/web-sim`, a real MCP client and MCP Apps host, and wrote `addon.json` requirements from the QuickStart by hand so they are ready if access lands.
- **Suggestion:** publish the Local Inspector and the certification checks (`certification-verdict.json`, rule ids like `VR-01`) on public npm. They need no Alexa account to run against a local server.
- **Evidence:** `HACKATHON.md` (FQ, FT/45262, FT/45255, FT/45256), `PLATFORM-DOCS.md` §2.10, §2.12, gap 20, ADR 0017.
- **Status:** open.

### 2026-10-08: The "Alexa JS SDK" has no package name
- **Tool:** Alexa+ Development Stages page.
- **Task:** find the host SDK and component library the page mentions for screen add-ons.
- **Steps:** read the page ("Alexa provides a JS SDK for host communication and an optional component library with React components"), then searched for a package.
- **Expected / actual:** expected a package name or URL. The page gives neither, and we found none.
- **Severity:** Medium. Our brief planned the visual layer around that SDK.
- **Workaround:** built the views on the open MCP Apps SDK (`@modelcontextprotocol/ext-apps` 2.0.3), which the QuickStart also names.
- **Suggestion:** link the package from the Development Stages page, or say it is the MCP Apps SDK.
- **Evidence:** `PLATFORM-DOCS.md` §2.2, §5, gap 11.
- **Status:** worked around.

### 2026-10-08: No speaker identity reaches an MCP add-on, and the old Voice ID link is dead
- **Tool:** Alexa developer docs (classic ASK personalization page, Alexa+ add-on pages).
- **Task:** recognise which household member is talking, for the "familiar people" feature.
- **Steps:** opened the Voice ID URL our brief cited. Searched every add-on page for a person or speaker field.
- **Expected / actual:** the cited URL `recognize-a-speaker-with-voice-profiles.html` returns 404. `context.System.person.personId` exists only in classic ASK request JSON. No Alexa+ MCP page documents any speaker field.
- **Severity:** High for the feature as designed.
- **Workaround:** presence runs on fixed fictional people and injected events in dev and simulator builds only (ADR 0015 §2). The skill tells the model never to infer the speaker from what they say.
- **Suggestion:** state on the Alexa+ add-on pages whether person or speaker data will ever reach MCP servers, and redirect the old Voice ID URL.
- **Evidence:** `PLATFORM-DOCS.md` §2.14, gap 14, `skills/nyc-mon-companion/SKILL.md`, "Presence: seeded test people only".
- **Status:** open.

### 2026-10-08: The 500 ms budget comes with no guidance for model-backed add-ons
- **Tool:** Alexa+ MCP QuickStart.
- **Task:** decide where the LLM runs for a character that speaks.
- **Steps:** read "must meet a round-trip query response latency of less than 500 ms". Measured `feed_mon` against a stub `/v1`.
- **Expected / actual:** expected guidance on add-ons that call a model, or a note on whether the limit is p50 or p99. Neither exists. On the stub, `feed_mon` measured 308 ms p50 with no model in the path. A care call is a read then a write, so it stays under 500 ms only while each `/v1` call takes under about 245 ms.
- **Severity:** Medium.
- **Workaround:** no model calls inside `tools/call`. The model runs in the simulator's agent loop (ADR 0009, ADR 0015 §3). PR #15 holds a single-round-trip care path if the real database runs over.
- **Suggestion:** say which percentile the 500 ms applies to, and whether streaming or a "still working" message changes it.
- **Evidence:** `docs/HANDOFF.md` §2, "Not verified", `PLATFORM-DOCS.md` §2.3, gap 13. Latency against the real database: **pending live verification**.
- **Status:** worked around.

### 2026-10-08: Amazon Devices Builder Tools don't cover Alexa+
- **Tool:** Amazon Devices Builder Tools (`@amazon-devices/amazon-devices-buildertools-mcp`).
- **Task:** use the tool the hackathon resources page lists for coding assistants.
- **Steps:** read the get-started page and the Vega MCP server page.
- **Expected / actual:** expected Alexa+ add-on knowledge. The page covers Vega OS with "limited support for Fire OS" and never mentions Alexa+. It also needs Vega SDK 0.22+.
- **Severity:** Low. It cost a reading session.
- **Workaround:** worked from the Alexa+ add-on docs directly and captured them in `docs/alexa/PLATFORM-DOCS.md`.
- **Suggestion:** say on the Resources page which tracks the tool covers, or add an Alexa+ add-on context pack to it.
- **Evidence:** `PLATFORM-DOCS.md` §2.15, gap 22, `HACKATHON.md`, Resources table.
- **Status:** open.

### 2026-10-07: AWS credits ran out before the stated deadline
- **Tool:** Devpost resources page, AWS credit form.
- **Task:** request the $150 AWS credit for Bedrock.
- **Steps:** opened the form linked from the brief.
- **Expected / actual:** credit requests were due Oct 21. On Oct 7 the page said "We are out of credit codes and will no longer be accepting credit requests."
- **Severity:** Low for us. Bedrock bills to the creator's account.
- **Workaround:** none needed beyond paying. The simulator caps spend with rate limits (see `docs/aws-builder.md`).
- **Suggestion:** show remaining credit stock on the resources page.
- **Evidence:** `HACKATHON.md`, Deadlines, `PLATFORM-DOCS.md` gap 23.
- **Status:** closed.

### 2026-10-06: `alexa-ai` CLI gated at scaffold time
- **Tool:** Devpost resources and the Alexa+ add-on docs.
- **Task:** use `alexa-ai new` to generate the add-on manifest.
- **Steps:** mapped the build prompt's references against the repo. Scaffolded `@acme/mcp-server`, ADRs 0005–0009 and this log.
- **Expected / actual:** expected the CLI to be installable. It is private-preview gated.
- **Severity:** Medium at the time. Superseded by the 2026-10-08 entry above.
- **Workaround:** kept tool names and schemas stable so `alexa-ai new` can generate the manifest later.
- **Suggestion:** see the 2026-10-08 entry.
- **Evidence:** 6bd5ae1, `docs/adr/0005-alexa-mcp-transport.md`, `packages/mcp-server/`.
- **Status:** superseded.

## Amazon Bedrock

### 2026-10-21: No console page links the Anthropic use-case form
- **Tool:** Amazon Bedrock console and docs, "Request access to models"
- **Task:** file Anthropic's first-time use case form so Claude models answer on a new account.
- **Steps:** opened Claude Sonnet 4.6 in the model catalog and in the playground, opened the Model access page, and read the docs page, which says to open an Anthropic model from the catalog or the Anthropic providers page and complete the form.
- **Expected / actual:** a form or a link to it. The playground showed only `ResourceNotFoundException: Model use case details have not been submitted for this account`. The Model access page says it "has been retired", and the providers URL redirected to the catalog with "The requested model was not found."
- **Severity:** Blocker.
- **Workaround:** `aws bedrock put-use-case-for-model-access` with base64 JSON, then `get-foundation-model-availability` reported `AVAILABLE`.
- **Suggestion:** put the form, or a link to it, in the error the playground shows.
- **Evidence:** `docs/aws-builder.md`, "Account state and decisions, 2026-10-19" and "First real Bedrock turns, 2026-10-21".
- **Status:** worked around.

### 2026-10-19: Claude worked for about an hour, then every Anthropic model returned 404
- **Tool:** Amazon Bedrock, bedrock-runtime
- **Task:** first real model turn for the simulator.
- **Steps:** called `us.anthropic.claude-sonnet-4-6` and `us.anthropic.claude-opus-4-6-v1` on a new account.
- **Expected / actual:** either access or a clear refusal from the start. Two calls succeeded. Later calls returned `404 Model use case details have not been submitted for this account`, which read like a wrong model id.
- **Severity:** High.
- **Workaround:** filed the use-case form (entry above).
- **Suggestion:** return 403 with the form's name, and don't serve a grace window that ends without warning.
- **Evidence:** `docs/aws-builder.md`, blocker 1.
- **Status:** worked around.

### 2026-10-19: Opus 5.5 on bedrock-mantle has an applied quota of 0, and Service Quotas refuses to raise it
- **Tool:** Amazon Bedrock (bedrock-mantle), Service Quotas
- **Task:** run the simulator on `anthropic.claude-opus-5-5` through the Messages-API endpoint.
- **Steps:** called the model, read the quotas, tried a quota increase.
- **Expected / actual:** the AWS default of 20M input and 2M output tokens per minute. The call returned `permission_error: ... is not available for this account`. Both applied quotas were 0, and `RequestServiceQuotaIncrease` rejects any value at or below the default.
- **Severity:** Blocker for Opus 5.5.
- **Workaround:** a bedrock-runtime path for inference-profile ids (48f54a6). The simulator now defaults to Claude Sonnet 4.6 (58fb23d).
- **Suggestion:** say in the error that the account is restricted and that only a Support case lifts it.
- **Evidence:** `docs/aws-builder.md`, blocker 2; `packages/web-sim/server/model.ts` (`usesBedrockRuntime`).
- **Status:** worked around; Opus 5.5 still blocked.

## MCP SDKs and the libraries around them

### 2026-10-23: The JWKS endpoint answered "200 500" with an empty body
- **Tool:** `payload-better-auth` (the Payload adapter for Better Auth), `better-call` 1.4.2 and `@better-auth/core` 1.7.10.
- **Task:** let the MCP server and the simulator verify access tokens against `{issuer}/payload-api/auth/jwks`.
- **Steps:** `curl` on the JWKS URL; read the adapter's `dist/adapter/index.js` and better-call's `isAPIError`.
- **Expected / actual:** expected a JSON key set. Got status 200 with reason "500", an empty body and no log line, and the `jwks` table stayed empty. Two bugs stacked. Better Auth calls adapter methods with the resolved model name, `getModelName('jwks')` = `'jwkss'`; the adapter's double-s guard tested `!model.endsWith('ss')`, which is always false for `'jwkss'`, so every query went to a collection slug `jwkss` and Payload threw "The collection with slug jwkss can't be found". Payload's base error is also named `APIError`, and better-call and core match errors by that name, so better-call rendered it as its own: status from the missing `statusCode` (defaults to 200), status text from the numeric status, body from the missing body. Core's `onError` skipped the log for the same reason.
- **Severity:** Blocker for sign-in: no token could be verified, and the failure looked like success.
- **Workaround:** three pnpm patches (`patchedDependencies`). The adapter tests the schema key from `getDefaultModelName` and rethrows Payload's `APIError` as a plain `Error` naming the method and model. better-call and core also require a numeric `statusCode` before treating an error as their own.
- **Suggestion (payload-better-auth):** test the guard against Better Auth's pluralised names. **(better-call, Better Auth):** match `APIError` by class or brand, not by `name`.
- **Evidence:** 67de5df. After the fix the JWKS returns one EdDSA/Ed25519 key, `payload.jwks` went from 0 rows to 1, and a forced Payload `APIError` answers 500 with both log lines.
- **Status:** worked around (pnpm patches).

### 2026-10-23: The simulator's token exchange was blocked by CORS
- **Tool:** Payload's CORS list and `@better-auth/oauth-provider` public clients.
- **Task:** sign in from the web simulator, a public OAuth client (PKCE, no secret).
- **Steps:** "Sign in" on http://localhost:5180, linking pages, back to `/oauth/callback`, then the browser posts the code to `/payload-api/auth/oauth2/token`.
- **Expected / actual:** expected a token. Payload's CORS list held only the auth origins, so the browser blocked the call and sign-in ended in "Failed to fetch".
- **Severity:** High. Every public-client sign-in failed after a successful login.
- **Workaround:** CORS also lists the redirect origins of public clients. Confidential clients (Alexa) call from a server and stay off the list. CSRF is unchanged.
- **Suggestion (Better Auth):** document that a browser-based public client needs its origin allowed on the token endpoint, or expose the provider's client origins to the host's CORS config.
- **Evidence:** 22b58d5, `docs/alexa/AUTH.md`.
- **Status:** fixed.

### 2026-10-23: The 3D Mon drew grey inside the MCP Apps sandbox
- **Tool:** three.js `GLTFLoader` under the MCP Apps view CSP (SEP-1865).
- **Task:** show the textured Mon GLB in the mon-card view.
- **Steps:** loaded `/mons/<id>.glb` from the declared model origin inside the sandboxed iframe.
- **Expected / actual:** expected the same textured model `/mons` shows. The geometry drew grey. `GLTFLoader` decodes embedded textures with `ImageBitmapLoader`, which `fetch()`es `blob:` URLs, so they fall under `connect-src`, where the host lists only declared origins.
- **Severity:** Medium.
- **Workaround:** decode textures through `TextureLoader` (an `<img>`), which `img-src` allows for `blob:`.
- **Suggestion (MCP Apps):** say in the CSP section whether hosts allow `blob:` in `connect-src`, or let a view declare it. **(three.js):** note in the loader docs that embedded textures are fetched from `blob:` URLs.
- **Evidence:** 44a20ed.
- **Status:** worked around.

### 2026-10-23: Saved cards pointed at `ui://` URIs that a restarted server no longer had
- **Tool:** MCP Apps `ui://` resources and our simulator (`packages/web-sim`).
- **Task:** reopen the last card after a reload.
- **Steps:** restarted the MCP server, reloaded the sim.
- **Expected / actual:** expected the card back. The sim had saved each call's `resourceUri`, which carries a content hash, so a rebuilt server changed it; `resources/read` answered "Resource not found", and "Try card again" fetched the same stale URI.
- **Severity:** Medium. Only a new conversation cleared it.
- **Workaround:** the sim derives the view URI at render time from the tool the connected server lists, and "Try card again" re-lists the tools first (reconnecting if the session is gone).
- **Suggestion (MCP Apps):** say whether a host may cache `resourceUri` across server versions, and how a server should signal that a URI moved.
- **Evidence:** 59528bf, `packages/web-sim/test/viewUri.test.ts` (fails against the old behaviour).
- **Status:** fixed.

### 2026-10-14: An oversized body reset the connection instead of answering 413
- **Tool:** Node.js `http` (our MCP server's body reader).
- **Task:** refuse request bodies over 1 MB with HTTP 413 and a JSON-RPC error.
- **Steps:** the red-team suite posted an oversized body.
- **Expected / actual:** expected a 413. The client saw a connection reset, because the reader called `req.destroy()` before the handler could write the response.
- **Severity:** Medium. A client got no reason for the failure.
- **Workaround:** stop reading and pause the request, answer 413 with `Connection: close`, and destroy the socket after the response finishes.
- **Suggestion:** for anyone writing a Streamable HTTP server by hand: never destroy the request inside the size check. The MCP SDK's transport docs could show a body-limit example.
- **Evidence:** 7e72b98 (`packages/mcp-server/src/mcp/server.ts`, `http.test.ts`).
- **Status:** fixed.

### 2026-10-13: A cancelled turn could still run tools and publish results
- **Tool:** `@modelcontextprotocol/client` 2.3.1 and our agent loop.
- **Task:** cancel a model turn when the user speaks again or leaves.
- **Steps:** traced the agent loop: the model call took the `AbortSignal`, but `callTool` did not, and results from work already started were published after the cancel.
- **Expected / actual:** expected one signal to stop the whole turn. The MCP client needs the signal passed per call (`callTool(params, { signal })`), and the loop has to check it after every await.
- **Severity:** Medium. A cancelled turn could still feed the Mon.
- **Workaround:** `createTurnToolCaller` binds each turn's MCP calls to the turn's signal. `runAgentTurn` calls `signal.throwIfAborted()` before and after each model and tool step. Five cancellation and two adapter regression tests.
- **Suggestion:** the MCP client docs could show cancellation in an agent loop, including what happens to a tool call already in flight.
- **Evidence:** 5b66a1a (`packages/web-sim/src/shared/agentLoop.ts`, `src/client/turnTools.ts`, `test/agentLoop.test.ts`, `test/turnTools.test.ts`).
- **Status:** fixed. Server-side effect of a call cancelled mid-flight: **pending live verification**.

### 2026-10-13: Payload migrations stopped loading under native Node
- **Tool:** Payload CMS migrations (`@payloadcms/db-postgres`) under Node 24's native TypeScript loading.
- **Task:** discover migrations from the repo root and from `apps/admin-vite`, the way the deploy runs them.
- **Steps:** the three migration files imported `MigrateUpArgs` and `MigrateDownArgs` (types) on the same value import as `sql`.
- **Expected / actual:** expected Payload's generated import line to load anywhere Payload runs. Discovery under plain Node failed until the type names moved to their own `import type` line.
- **Severity:** High. The deploy applies `20261008_181202_alexa_oauth`, and linking fails without it (ADR 0016, Consequences).
- **Workaround:** split the type-only names into `import type`. A new test spawns plain Node from both roots and loads every migration without executing SQL. SQL bodies unchanged.
- **Suggestion (Payload):** generate migrations with `import type` for the argument types.
- **Evidence:** 5b66a1a (`packages/payload/src/migrations/*`, `src/__tests__/migration-discovery.test.ts`). Applying the migration to a real database: **pending live verification**.
- **Status:** fixed.

### 2026-10-08: Better Auth's OIDC plugin is gone, and the OAuth provider has sharp defaults
- **Tool:** `better-auth` 1.7.7 and `@better-auth/oauth-provider` 1.7.7.
- **Task:** run an OAuth authorization server that meets Amazon's account-linking rules (no OIDC, no dynamic client registration, `resource` validated, a refresh token with every access token).
- **Steps:** ADR 0006 planned on the OIDC-provider plugin. Inspected the pinned package's `dist/plugins`. Switched to the separate provider package.
- **Expected / actual:** the pinned better-auth ships `jwt` but no `oidc-provider` or `mcp` plugin. In the provider: without `resource` it issues an opaque token with no `aud`, it issues refresh tokens only for `offline_access`, and its admin endpoint always generates its own `client_id`.
- **Severity:** Medium.
- **Workaround:** a guard makes `resource` mandatory and adds `offline_access` to every user authorization. A small plugin upserts the two static clients at boot (ADR 0016, decisions 4 to 6).
- **Suggestion (Better Auth):** an option to require `resource`, and a documented way to register a client with a fixed id.
- **Evidence:** `docs/adr/0016-alexa-oauth-authorization-server.md`, `packages/payload/src/auth/oauth/`. Red-team cases for a code exchange with no `code_verifier` and a refresh token from another client: 7e72b98. Whether Amazon's token request, sent with no `Origin`, passes Better Auth's origin and CSRF checks: **pending live verification**.
- **Status:** worked around.

### 2026-10-08: The MCP TypeScript SDK split into v2 packages
- **Tool:** MCP TypeScript SDK on npm.
- **Task:** wire the server to the SDK's Streamable HTTP transport.
- **Steps:** the scaffold imported `@modelcontextprotocol/sdk/server/mcp.js` through an ambient `.d.ts` stub. The package was never installed and `server.connect()` was a TODO. Checked npm.
- **Expected / actual:** most examples point at `@modelcontextprotocol/sdk` (1.32.1, the legacy monolith). The current packages are split: `server` 2.3.1, `client` 2.3.1, `node` 2.1.1, and `ext-apps` 2.x requires the v2 peers.
- **Severity:** Medium. The scaffold typechecked against nothing.
- **Workaround:** moved to the v2 packages, pinned through the pnpm catalog.
- **Suggestion (MCP SDK):** mark the 1.x package deprecated on npm with a pointer to the split packages.
- **Evidence:** `PLATFORM-DOCS.md` §3.4, gap 7, `pnpm-workspace.yaml` catalog, 100199e.
- **Status:** fixed.

## Our own safeguards

### 2026-10-23: The first hatch of every egg answered 409
- **Tool:** our `/v1` game API and the Payload `MonInstances` validate hook.
- **Task:** hatch an egg through `POST /v1/eggs/:id/hatch`.
- **Steps:** ran the request on a local database.
- **Expected / actual:** expected a Mon. `hatchEgg` built the Mon from `mintMonInstance`, which returns no `eggId`; the hook derives the Mon id from `eggId` and threw `MON_ID_MISMATCH`, so every first hatch answered 409.
- **Severity:** Blocker for new Callers.
- **Workaround:** `hatchEgg` passes `eggId`.
- **Suggestion:** none for Amazon.
- **Evidence:** d95dcf0. The same request now answers 200 and the row carries its egg id.
- **Status:** fixed.

### 2026-10-23: View boot tests passed only with the simulator running
- **Tool:** our MCP server boot suite (`packages/mcp-server/src/ui/ui.boot.test.ts`).
- **Task:** run the view boot tests on CI.
- **Steps:** the views fetch `/mons/*.glb` from the model origin (localhost:5180, the sim host).
- **Expected / actual:** passed on a machine with the sim running; on CI nothing listened there, the GLB fetch logged a console error in 10 boot tests and the egg never rendered.
- **Severity:** Medium.
- **Workaround:** the test browser context fulfils those requests from `apps/web/public/mons`. Checked with `NYC_MON_MODEL_ORIGIN` pointed at an unused port: 47 of 47 pass.
- **Suggestion:** none for Amazon.
- **Evidence:** db1eddd.
- **Status:** fixed.

### 2026-10-23: `CI=true` broke the Amazon sign-up guard test
- **Tool:** our Amazon LWA sign-up guard test (`packages/payload/src/auth/__tests__/amazon.test.ts`) on GitHub Actions.
- **Task:** keep local-only Amazon sign-up off on hosted builds.
- **Steps:** ran the guard's table test locally and on CI.
- **Expected / actual:** the three "developer machine" rows passed locally and failed on GitHub, because CI sets `CI=true` and the guard correctly treats that as a hosted build. The test, not the guard, was wrong.
- **Severity:** Low.
- **Workaround:** the table clears `CI`, `VERCEL` and `VERCEL_ENV` for its rows and restores them after; the Vercel case still checks the hosted path.
- **Suggestion:** none for Amazon.
- **Evidence:** 21045ad.
- **Status:** fixed.

### 2026-10-14: The scripted mock could have answered a judge
- **Tool:** our simulator (`packages/web-sim`). No Amazon simulator is available, so ours is the judged surface.
- **Task:** keep the offline test model out of any public deployment.
- **Steps:** `SIM_MODEL_BACKEND=mock` exists so the MCP path and views run without AWS. Nothing stopped it in production.
- **Expected / actual:** a judge must see the real model. A misconfigured deploy would have shown "Scripted test reply" text instead.
- **Severity:** High for judging.
- **Workaround:** `loadSimEnv` throws when the mock is set with `NODE_ENV=production`, with a test. The live smoke reports NOT RUN on missing variables instead of falling back to the mock (30218e5).
- **Suggestion:** none for Amazon.
- **Evidence:** e3e5036 (`packages/web-sim/server/env.ts`, `test/auth.test.ts`).
- **Status:** fixed.

<!--
Append real friction as it happens: every failed tool call, doc
contradiction, missing capability or confusing UX counts, including
"worked but surprising". Live runs still owed: deployed OAuth,
the migration on a real database, care latency, the demo video.
-->
