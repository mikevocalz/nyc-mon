# Alexa+ platform docs: what we read and what it means for NYC-MON

Research date: 2026-10-08. Every URL below was opened on that date unless marked **UNOPENED** or **404**. "Last updated" is the date Amazon prints on the page. Where Amazon pages contradict each other, both are quoted.

## 1. URLs the repo cites

Sources: `docs/alexa-plus-brief.md`, `docs/adr/0005-alexa-mcp-transport.md`, `0006-mcp-oauth-pkce-prm.md`, `0007-no-echo-mic-presence.md`, `0009-agent-skill-routing.md`, `.devin/skills/nyc-mon-alexa/SKILL.md` (no URLs), `packages/mcp-server/src/{main.ts,auth/prm.ts,mcp/tools.ts,mcp/server.ts}`.

| URL | Cited in | Status 2026-10-08 |
|---|---|---|
| https://amazonappdev2026.devpost.com/ | brief | opened |
| https://amazonappdev2026.devpost.com/resources | brief | opened |
| https://amazonappdev2026.devpost.com/rules | brief | UNOPENED |
| https://amazonappdev2026.devpost.com/details/faqs | brief | UNOPENED |
| https://apps.extensions.modelcontextprotocol.io/api/#build-with-agent-skills | brief, ADR 0009 | opened |
| https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#streamable-http | brief, ADR 0005 | opened (.md) |
| https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization | ADR 0006 | opened (.md) |
| https://modelcontextprotocol.io/specification/2025-11-25 | brief | not opened directly; transports + authorization pages read |
| https://developer.amazon.com/docs/vega/0.24/mcp-server | brief | opened (`.html`) |
| https://forms.gle/GaHFxSbBQNG9Kti6A (AWS credits) | brief | UNOPENED. Devpost resources says "October 7th Update: … we are out of credit codes and are no longer accepting credit requests." |
| https://builder.aws.com/learn | brief | UNOPENED |
| https://developer.amazon.com/docs/alexaplus/add-ons/alexa-plus-add-on-development-stages.html | brief | opened |
| https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-overview.html | brief | opened |
| https://developer.amazon.com/docs/alexaplus/add-ons/alexa-ai-cli-reference.html | brief | opened |
| https://developer.amazon.com/docs/alexaplus/add-ons/certification-guidelines.html | brief | opened |
| https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-design-guide.html | brief | opened |
| https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-client-lifecycle.html | brief | opened |
| https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-display-modes.html | brief | opened |
| https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-authentication.html | brief | opened |
| https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-account-linking.html | brief | opened |
| https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-accessibility.html | brief | opened |
| https://community.amazondeveloper.com/ | brief | UNOPENED |
| https://github.com/amazonappdev | brief | UNOPENED |
| https://github.com/modelcontextprotocol/typescript-sdk | brief | UNOPENED (npm registry checked instead, §3.4) |
| https://agentskills.io | brief, ADR 0009 | opened `/specification` |
| https://oauth.net/2.1/ | brief, ADR 0006 | UNOPENED |
| https://www.rfc-editor.org/rfc/rfc9728 | brief, ADR 0006, prm.ts | UNOPENED (requirements taken from the MCP authorization spec and Amazon pages) |
| https://www.rfc-editor.org/rfc/rfc7636 | brief, ADR 0006 | UNOPENED |
| https://developer.amazon.com/docs/alexa/custom-skills/recognize-a-speaker-with-voice-profiles.html | brief, ADR 0007 | **404**. Current page is https://developer.amazon.com/en-US/docs/alexa/custom-skills/add-personalization-to-your-skill.html (seen via search, Jul 14 2026), and it covers classic ASK skills only |
| https://docs.aws.amazon.com/bedrock/, https://strandsagents.com, https://aws.amazon.com/bedrock/agentcore/ | brief | UNOPENED (out of scope) |
| https://supabase.com/docs/guides/realtime | brief, ADR 0007 | UNOPENED (out of scope) |
| https://github.com/mikevocalz/nyc-mon/tree/main/docs/architecture/system-design.md | prm.ts `resource_documentation` | UNOPENED (our own repo) |
| nextjs.org, react.dev, pyannote, speechbrain, elevenlabs, threejs, TypeGPU, Margelo skills | brief | UNOPENED (not platform docs) |

## 2. Amazon Alexa+ sources

### 2.1 Alexa+ MCP Toolkit Overview
URL: https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-overview.html (Last updated Aug 03, 2026)

- "Alexa+ for Builders supports the 2025-11-25 version of the MCP specification."
- Alexa+ is the MCP client. It "routes the request through your add-on to your MCP server using streamable HTTP."
- "Alexa+ also supports the MCP Apps extension … use a webview provided by Alexa+ to deliver rich visuals." Games and immersive learning are named examples.
- US only.
- Tool changes take effect only after `alexa-ai deploy`.

**For us:** Streamable HTTP, a 2025-11-25-compatible handshake server, and MCP Apps for the Mon visuals. That is the integration surface; there is no separate Alexa protocol.

### 2.2 Development stages
URL: https://developer.amazon.com/docs/alexaplus/add-ons/alexa-plus-add-on-development-stages.html (Jul 10, 2026)

- Access needs **Private Preview** approval ("you request access to the Private Preview. After approval, you receive credentials and install the tooling").
- Tool design rules: one-shot extraction, structured errors that let Alexa ask a specific follow-up, stable IDs and option labels.
- Two modalities: headless (voice-only; "Alexa informs the customer at runtime that screen-enabled devices support the request") and screen (fragments and full screen).
- "Alexa provides a JS SDK for host communication and an optional component library with React components." No package name or URL is given on this page. **UNOPENED / not found.**
- Test path: MCP Inspector (valid and invalid inputs, export traces), golden suite via `alexa-ai test --test-suite`, simulator and on-device testing after `alexa-ai deploy`.
- Pre-submission list: endpoint reachable (OAuth-protected or public HTTPS), all tests pass, valid privacy policy URL, metadata for account linking/permissions/payments, "UI passes an automated Alexa UX guidelines check", on-device testing per modality.

### 2.3 MCP QuickStart Guide (the hard requirements page)
URL: https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html (Jul 10, 2026)

Technical:
- "Your MCP server must support Streamable HTTP." Legacy HTTP+SSE must be migrated.
- Visuals: "follow the MCP Apps standard. The MCP Apps SDK (@modelcontextprotocol/ext-apps) provides Agent Skills…"
- Remote URL required; tunnels such as cloudflared are fine for dev.
- **Performance: "Your MCP server must meet a round-trip query response latency of less than 500 ms."**

Authentication checklist (verbatim items):
- "Your MCP server returns 401 Unauthorized (without a WWW-Authenticate header) for unauthenticated requests."
- PRM document at the RFC 9728 well-known URI.
- "Your auth server metadata is available at /.well-known/oauth-authorization-server."
- `code_challenge_methods_supported` must include `S256`.
- Authorization code + PKCE S256; `resource` = MCP server canonical URI in both authorization and token requests; scopes come from PRM `scopes_supported`.
- Bearer token in the `Authorization` header only, never in the query string.
- "Not Supported Yet": Dynamic Client Registration, Client ID Metadata Documents, OpenID Connect, Step-Up Authorization, WWW-Authenticate header in 401 responses.

Manifest `addon-package/addon.json` (`manifestVersion: "1.0"`):
- `name.value` ≤30 chars, optional IPA `spokenForm`; `shortDescription` ≤123; `fullDescription` ≤4000; `examplePhrases` 3–4 items, each ≤200.
- `privacyPolicyUrl` and `termsOfUseUrl` are both required HTTPS URLs.
- Icons (light): all six of 72, 64, 88, 126, 180, 241 px square; dark optional, same sizes. At least one 600x900 carousel image (alt ≤250). Optional 1200x600 banner. HTTPS, PNG/JPG/JPEG/WEBP.
- `integrations[0]`: `{type:"MCP", config.endpoints.default:{type:"HTTPS", uri}}`.
- Onboarding paths: the "Add-on Agent Skill" (Claude Code, Kiro, Cursor, Copilot) runs introspection → `alexa-ai new mcp` → assets/compliance → deploy → submit; or the manual CLI.

### 2.4 Authentication (two-tier)
URL: https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-authentication.html (Jul 10, 2026)

- Tier 1 is `client_credentials` (M2M) for "initialize and tools/list calls", health checks and registration. Tier 2 is `authorization_code` + PKCE for user tools.
- AS metadata must list `client_credentials`, `authorization_code`, `refresh_token` in `grant_types_supported`, and `S256`.
- Scopes: `mcp:service` (client credentials only, no user data), `mcp:tools` and `mcp:resources` (user-level, authorization_code only), plus "Your Defined Scopes".
- Token endpoint MUST: HTTP Basic client auth, validate `resource` against the registered MCP URI, `expires_in` ≤3600 recommended, `token_type: "Bearer"`, no refresh token for client credentials, no credentials in query parameters. Errors follow RFC 6749 §5.2.
- Not supported: DCR, OIDC, step-up, `WWW-Authenticate` in 401s.
- "If authentication attributes change on your server, you must redeploy … Alexa+ will continue using cached values."

### 2.5 Account Linking for MCP Add-ons
URL: https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-account-linking.html (Jul 10, 2026)

- Optional. Enable it only if tools need user identity (we do: per-Caller Mon state, write actions).
- Authorization code grant only, no implicit. **A refresh token must accompany every access token**, or customers re-link at every expiry.
- `alexa-ai deploy` **fails** if AS metadata lacks S256.
- Authorization request params: `client_id, redirect_uri, response_type=code, scope, state, code_challenge, code_challenge_method=S256, resource`. The sample scope string is `openid your-scope`.
- Token request carries `code_verifier` and `resource`. Refresh does **not** carry `resource`.
- **Multiple Alexa redirect URIs (per region).** Register all of them (the CLI prints them) and use the runtime `redirect_uri` value exactly.
- Step 1a, PRM at `https://<mcp-host>/.well-known/oauth-protected-resource`:
  - `resource` "Must exactly match the URL in your add-on manifest — including or excluding any trailing slash". The example value is `https://your-mcp-server.com/mcp`.
  - "Alexa uses only the first entry" of `authorization_servers`.
  - Alexa requests the `scopes_supported` values from the customer.
- Step 1b: return 401 or 403 when a tool is called without a valid token, and Alexa starts linking.
- Static client registration only. Redeploy when AS config changes, because Alexa caches it at deploy time.
- Linking patterns: (1) QR / web OAuth (default; headless devices get an Alexa-app push), (2) app-to-app deep link, (3) Login with Amazon.
- CLI: `alexa-ai configure-account-linking --addon-id <id> --stage development --client-id <id>`. The secret goes through a masked prompt or `ALEXA_CLIENT_SECRET`. Then `alexa-ai deploy`.

### 2.6 Client and App Lifecycle (the wire Alexa actually sends)
URL: https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-client-lifecycle.html (Jul 10, 2026)

- At deploy, Alexa connects, registers all tools and resources, and caches them.
- **The sample `initialize` from "Alexa+ MCP Client" sends `"protocolVersion": "2025-03-26"`** with `capabilities: {roots:{listChanged:true}}`. This conflicts with §2.1 ("supports 2025-11-25"). The server must negotiate down, not reject.
- Sample tool result carries `structuredContent`, a `content` text mirror (stringified JSON), and `_meta.ui: {resourceUri:"ui://hotel-search", invoking:"Searching hotels...", invoked:"Found hotels"}`.
- "The session is based on the customer's previous conversations with Alexa+ rather than an explicit identifier for a session with your MCP App." Do not rely on `Mcp-Session-Id` for conversation state.
- Elicitation is supported through MCP, used after Alexa has tried to fill gaps from context.
- If `resourceUri` is present, Alexa renders our MCP App. If not, it uses the data-only (hydrated) flow.

### 2.7 Display modes, layout and rendering, visual foundations
- https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-display-modes.html (Jul 21, 2026)
- https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-layout-and-rendering.html (Jul 21, 2026)
- https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-visual-foundations.html (Jul 21, 2026)
- https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-components-and-patterns.html (Aug 03, 2026)

Modes:
- **Inline** (default for any UI payload). Fullscreen is "an expansion of the inline fragment … not a separate surface", and games are a listed use. **Hydrated** applies when there is no UI payload: Alexa renders the data natively. **Voice-only** is always on, and tool data "must remain intelligible without any visual support and be free of text formatting artifacts (such as pipes)".
- We declare which modes we support and must provide our own control to enter fullscreen. Never switch modes spontaneously.

Runtime envelope:
- The host delivers `hostContext` over the MCP Apps postMessage channel: `deviceClass, maxWidth, maxHeight, isMobile, platform, displayMode, safeAreaInsets, deviceCapabilities, theme`. `deviceClass` is authoritative. Re-resolve on `host-context-changed`.
- "Sandboxed iframe. Don't rely on window.parent access, cross-origin reads, or persistent localStorage or cookies." The only channel is the bridge (`ui/notifications/*`).
- CSP lives in `_meta.ui.csp` (`connectDomains`, `resourceDomains`). "Alexa blocks anything not declared."
- Packaging: one self-contained HTML bundle, a content-hashed URI (`ui://…/widget-a3f9c12b.html`), gzip, lazy-load heavy libraries.
- Available on all Alexa+ devices by default and evaluated for "equal functionality, quality, and performance across all supported devices".

Visual foundations:
- Author at a 768×480 base canvas and apply one root scale per device class (Echo Show 8/15 render 1280×800, so `zoom: 1.667`).
- Light and dark mode are required. Text readable at about 3 ft; essentials legible at about 10 ft.
- Type tokens run from `textStyleDisplay1` 48px down to `textStyleLabel1` 10px.

Patterns: List, Carousel (3–5 items inline, "Start delivering the first item within 500ms"), Card, Map. "Don't invent alternatives." Interactive canvases manage their own zoom and must be excluded from the global scale.

**For us:** the three.js Mon view must ship as a `ui://` HTML resource (MIME `text/html;profile=mcp-app`, see §3.2) in a sandboxed iframe. A page hosted on the Next.js site does not qualify. The view must run with no cookies or localStorage, with every fetch origin declared in CSP, and must work in both themes. Whether Echo Show webviews expose WebGPU is not stated anywhere we read. Ship a WebGL fallback until a device test proves otherwise.

### 2.8 Tools, schema and data design; conversation surface
- https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-tools-schema-data-design.html (Jul 21, 2026)
- https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-conversation-surface.html (Jul 21, 2026)

- One tool per customer intent, with no overlapping tools. "Declare only what you honor": no ignored parameters, and output stays in sync with the declared schema.
- "Always return something." An empty result produces a generic error.
- Payload hygiene: no third-party tracking parameters or upstream deep links.
- "You can't 'script' what Alexa says." Alexa writes the spoken reply from our data, and the turn-based model can interleave other add-ons mid-flow.

**For us:** Alexa's own LLM voices the reply, so the Agent Skill's character voice does not reach a real Echo. On device, character has to come through data (for example a `moodHint`, structured refusal reasons) and through the MCP App UI. The skill fully drives only our web simulator.

### 2.9 Accessibility
URL: https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-accessibility.html (Jul 21, 2026)

- Every flow completes by voice only and by touch only.
- Works with VoiceView, Screen Magnifier (pinch zoom), Color Correction and Color Inversion.
- Touch targets ≥48×48px.
- Contrast 4.5:1 for text ≤17px; 3:1 for bold or ≥18px; 4.5:1 inside graphics.
- No more than 3 flashes per second. Alt text ≤125 chars.

### 2.10 Testing: MCP Inspector, Local Inspector, web simulator, CX testing
- https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-test-add-ons.html (Jul 10, 2026)
- https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-local-inspector.html (Aug 03, 2026)
- https://developer.amazon.com/docs/alexaplus/add-ons/test-with-web-simulator.html (Jul 16, 2026)
- https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-test-addon-cx.html (Jul 21, 2026)
- https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-evaluate-ux.html (Jul 21, 2026)

MCP Inspector (standard): run `tools/list`, call with valid and invalid inputs, repeat calls to check idempotency, export traces.

Local Inspector (`@alexa-ai/addon-local-inspector`):
- Needs Node 24+ and `@playwright/cli` for visual mode. Install is via the Developer Console "Getting Started guide" (behind login).
- `addon-local-inspector <url> [--server-port 6277] [--client-port 6274] [--verbose]`.
- Remote upstreams must be https; plain http works only on loopback.
- The agent-driven flow initializes with `"protocolVersion":"2025-06-18"`, reads `Mcp-Session-Id`, calls `resources/read` on the `ui://` URI **before** the first `tools/call`, then screenshots Small (≤10") and Large (≥11") surfaces.
- Writes `certification-verdict.json` (`CERTIFIED | CONDITIONAL | NOT_CERTIFIED`, rule IDs like `VR-01`) and `inspection-summary.json` under `/tmp/alexaplus-addon-local-inspector-live/`.
- Visual mode requires tools with `_meta.ui.resourceUri`.

Web simulator ("Alexa+ Simulator" in the developer console):
- Opens only for a **deployed** add-on, so it needs preview access.
- Text input with no wake word. Isolation mode (only our add-on) or Global mode (production routing). Stages: development, certification, certified, live.
- Visual Preview toggles Echo Show small and large. Tabs: Alexa Response Detail, Device Logs, Visual Trace.
- "Physical Device Config" routes the session to a real device. The page labels the integration `alexaplus-sdks/Alexa-simulator`.

CX test matrix:
- Devices: Echo Show (primary), Alexa mobile app (voice and keyboard), alexa.com web (voice and keyboard), Echo Dot.
- Light and dark mode. Check voice/screen agreement and the accessibility settings walk-through.
- Say "report a bug" on device to file an Alexa-side issue.
- Usability study: 8–12 participants with an average satisfaction ≥4.3.

### 2.11 Certification: guidelines, functional, policy, certify/publish
- https://developer.amazon.com/docs/alexaplus/add-ons/certification-guidelines.html (Jul 10, 2026)
- https://developer.amazon.com/docs/alexaplus/add-ons/functional-requirements.html (Jul 21, 2026)
- https://developer.amazon.com/docs/alexaplus/add-ons/policy-requirements.html (Jul 21, 2026)
- https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-certify.html (Jul 10, 2026; "preliminary evaluation criteria")

Functional requirements that hit us:
- **§13 MCP Tool Validation:** "Every tool returned by your server's tools/list endpoint must be invocable — no dead, placeholder, or non-functional entries." Also a valid JSON Schema `inputSchema`, server-side validation, `isError: true` or JSON-RPC errors for failures, stable IDs that chain between tools, synonyms in enums and descriptions.
- **§2 Error handling:** "Surface no API codes, tool names, JSON, or internal IDs in any customer-facing response". Every error needs an actionable next step and a "still working" message when calls are slow.
- **§6 Account linking:** a guest experience for tools that don't need linking; 401 on expired or invalid tokens; graceful denial; no data from a previously linked account after a re-link.
- **§3 and §9 voice-only:** every critical feature works on Echo Dot, with no "check your display". When a feature truly needs a screen, say so plainly.
- **§10 and §11:** voice and screen never disagree; no stale visuals; tapping does the same thing as the voice equivalent; no interactive elements stay live after the session ends.
- **§4:** a useful answer to "What can you do?"; every listed example phrase must work.

Policy requirements that hit us:
- **§4 Child Safety: "Your add-on must not be targeted towards children." "Your add-on must never target children or collect their data."**
- §1: rejected if it "uses a real person's name, likeness, or voice without documented consent such as a signed release".
- §3:
  - A one-time permission prompt before first interaction must disclose the data shared.
  - Rejected if it "collects data about the customer's Alexa environment (e.g., device usage or device preferences)".
  - Sensitive data needs explicit consent and a stated purpose.
  - No schema fields unrelated to the stated purpose.
  - No "unbounded open text fields unrelated to its declared purpose".
- §7: no images of Amazon devices in any asset; the icon carries only the brand name or wordmark.
- §10: rejected if it only relays queries to a third-party LLM without added value.
- §11: linking must use Amazon's QR/push consent infrastructure, never an external-website instruction.
- §12 (UGC/social): controls against prompt injection and roleplay exploits.

Certify and publish:
- Lifecycle Development → In-Review → Certified → Live, plus `alexa-ai withdraw`, `alexa-ai rollback` and `alexa-ai list`.
- "Tool signatures and descriptions are locked after publication."
- Accessibility features (VoiceView, Captions, Screen Magnifier, Color Tools) must work.
- Live add-ons that fall below the bar are suppressed.

### 2.12 Alexa AI CLI reference and environment setup
- https://developer.amazon.com/docs/alexaplus/add-ons/alexa-ai-cli-reference.html (opened; date not captured)
- https://developer.amazon.com/docs/alexaplus/add-ons/set-up-your-development-environment.html (Jul 15, 2026)

Commands:
- `alexa-ai configure`: LWA login, stored at `~/.alexa-ai/credentials`.
- `alexa-ai new mcp --name … --mcp-server-url … [--requires-auth --auth-client-id --auth-scopes]`: client-side only.
- `alexa-ai deploy [--ignore-hash --skip-validation --json]`: zips `addon-package/`, builds, deploys to development. The failure example reads "policy url not present".
- `alexa-ai test [--stage development|live] [--test-suite test-suites/…json]`: runs in the cloud and returns report URLs.
- `alexa-ai submit [--yes]`: one version in certification at a time.

Setup:
- Node 24+ and an AWS IAM user allowed to `sts:AssumeRole` into `arn:aws:iam::372468808636:role/AddOn3PDeveloperToolsRead`.
- npm comes from a private CodeArtifact registry (`--domain alexa-ai --repository npm-packages --namespace @alexa-ai`, token valid 12h), then `npm install -g @alexa-ai/cli`.
- The page says "Log in to the AWS account that you provided to the Alexa Solutions Architect", so CLI access is gated on preview onboarding.

### 2.13 Support
URL: https://developer.amazon.com/docs/alexaplus/add-ons/get-support-from-amazon.html (Sep 02, 2026)

DevAssistant chat on developer pages (choose "Alexa+"), support cases (about 2 business days), and an assigned Alexa+ Solutions Architect.

### 2.14 Voice ID / personalization (classic ASK, not add-ons)
URL: https://developer.amazon.com/en-US/docs/alexa/custom-skills/add-personalization-to-your-skill.html (Jul 14, 2026; read via search result extract)

`context.System.person.personId` and `authenticationConfidenceLevel` appear in **ASK custom-skill request JSON**, under scope `alexa::person_id:read`. **None of the Alexa+ MCP add-on pages we read mention person, speaker, or Voice ID data in MCP requests.** The `initialize` and `tools/call` samples carry no such field.

**For us:** `speakerHint` from Alexa Voice ID has no documented source on Alexa+. Treat it as unavailable on device.

### 2.15 Amazon Devices Builder Tools
URL: https://developer.amazon.com/docs/vega/0.24/mcp-server.html (open beta)

- `npx -y @amazon-devices/amazon-devices-buildertools-mcp@latest init-context [--agent claude-code-cli]`, which needs Node 18+ and Vega SDK 0.22+.
- It covers Vega OS / Fire TV (plus Fire OS IAP and migration). The page does not mention Alexa+.

**For us:** the brief's "use from day one" is a Devpost suggestion. This tool will not help with Alexa+ add-on work, which is itself a friction-log entry.

## 3. Open standards and SDKs

### 3.1 MCP specification versions
- https://modelcontextprotocol.io/specification/versioning (opened 2026-10-08): "The **current** protocol version is **2026-07-28**."
- https://modelcontextprotocol.io/specification/2026-07-28/changelog (opened). 2026-07-28 is a breaking, stateless revision. It removes the `initialize` handshake and `Mcp-Session-Id`, adds mandatory `server/discover`, replaces GET SSE with `subscriptions/listen`, removes SSE resumability, replaces server-initiated elicitation with `input_required` results (MRTR), and adds a required `resultType` on all results.
- Alexa+ documents 2025-11-25 support and sends `initialize` with `2025-03-26`. The Local Inspector sends `2025-06-18`. Both are handshake-era versions.

**For us:** "2025-11-25 or newer" in ADR 0005 has to be read as "2025-11-25 handshake protocol, negotiating down to 2025-03-26". A 2026-07-28-only server would break Alexa. Devpost says "spec 2025-11-25 or later", so 2025-11-25 satisfies both.

### 3.2 MCP 2025-11-25: Streamable HTTP transport
URL: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports (opened as .md)

- Clients POST with `Accept: application/json, text/event-stream`. The server answers `application/json` or opens an SSE stream.
- Optional GET SSE stream. Sessions via `MCP-Session-Id`: 400 for a missing id, 404 for an expired one.
- `MCP-Protocol-Version` header on later requests; an unsupported value gets a 400. If the header is absent, the server assumes `2025-03-26`.
- **"Servers MUST validate the `Origin` header on all incoming connections … If the `Origin` header is present and invalid, servers MUST respond with HTTP 403 Forbidden."**

### 3.3 MCP 2025-11-25: Authorization
URL: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization (opened as .md)

- MCP servers MUST implement RFC 9728 PRM.
- Discovery uses either the `WWW-Authenticate` `resource_metadata` parameter **or** the well-known URI. Clients MUST support both and fall back to the well-known path. Dropping the header for Alexa therefore stays spec-compliant.
- Clients MUST send RFC 8707 `resource` in authorization and token requests.
- Servers MUST validate that tokens were issued for them as audience, MUST answer invalid or expired tokens with 401, and MUST NOT pass tokens through to upstream services.
- Tokens go in the `Authorization` header only.

### 3.4 MCP TypeScript SDK: npm registry state on 2026-10-08
Checked with `npm view` and `npm pack`.

- `@modelcontextprotocol/sdk` 1.32.1 is the legacy monolith with `/server/mcp.js` import paths.
- The v2 split packages are `@modelcontextprotocol/server` 2.3.1, `@modelcontextprotocol/client` 2.3.1, `@modelcontextprotocol/node` 2.1.1, `@modelcontextprotocol/express` 2.0.2 and `@modelcontextprotocol/core` 2.3.1.
- In core 2.3.1, `LATEST_PROTOCOL_VERSION = '2025-11-25'`. The bundle also contains `2025-06-18`, `2025-03-26`, `2024-11-05` and `2024-10-07`, so the SDK negotiates down to Alexa's `2025-03-26`.
- `@modelcontextprotocol/node` exports `NodeStreamableHTTPServerTransport`, `toNodeHandler`, `originValidation`, `localhostOriginValidation` and `hostHeaderValidation`.
- `@modelcontextprotocol/server` exports `McpServer` plus OAuth types (`OAuthProtectedResourceMetadata`, `AuthInfo`, `BearerAuthOptions`).

### 3.5 MCP Apps extension
- https://apps.extensions.modelcontextprotocol.io/api/ (opened)
- https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/main/specification/2026-01-26/apps.mdx (SEP-1865, **Stable 2026-01-26**)

- Package `@modelcontextprotocol/ext-apps` 2.0.3 (npm). It needs `@modelcontextprotocol/{server,client,node}@^2.0.0` and `zod@^4.2.0`.
- Subpaths: `/server` (`registerAppTool`, `registerAppResource`, `getUiCapability`, `EXTENSION_ID`), `/react` (`useApp`, `useHostStyles`), `/app-bridge`.
- Four Agent Skills install in Claude Code via `/plugin marketplace add modelcontextprotocol/ext-apps` then `/plugin install mcp-apps@modelcontextprotocol-ext-apps`: `create-mcp-app`, `migrate-oai-app`, `add-app-to-server`, `convert-web-app`. There is a Three.js example app, and `examples/basic-host` serves as the reference host.

Spec rules:
- UI resource `mimeType` MUST be `text/html;profile=mcp-app`, served under the `ui://` scheme.
- `_meta.ui.csp` holds `connectDomains`, `resourceDomains`, `frameDomains` and `baseUriDomains`; with no CSP the host applies a restrictive default. `prefersBorder` is optional.
- Tools link with `_meta.ui.resourceUri`. The flat `_meta["ui/resourceUri"]` form is deprecated.
- `visibility: ["model","app"]` is the default. App-only tools (`["app"]`) are hidden from the model's tool list.
- Views handshake with `ui/initialize` → `ui/notifications/initialized`, declare `appCapabilities.availableDisplayModes` (`inline | fullscreen | pip`), and get `hostContext`.
- The View receives `ui/notifications/tool-input` then `ui/notifications/tool-result`. It can call tools and send `ui/message`.

**For us:** "React-based MCP Apps with shared tools/state" (canon) maps to `ext-apps/react` Views calling our tools through the bridge. The fullscreen Mon view and status fragment become one View with `availableDisplayModes: ["inline","fullscreen"]`.

### 3.6 Agent Skills format
URL: https://agentskills.io/specification (opened)

- `SKILL.md` has YAML frontmatter: `name` (≤64 chars, lowercase/digits/hyphens, **must match the parent directory name**) and `description` (≤1024).
- Optional `license`, `compatibility`, `metadata` and `allowed-tools`.
- Optional `scripts/`, `references/` and `assets/` directories.

### 3.7 Devpost hackathon pages
- https://amazonappdev2026.devpost.com/ (opened)
- https://amazonappdev2026.devpost.com/resources (opened)

- Deadline Oct 23, 2026 12:00pm PDT.
- Alexa+ track: "Build a self-hosted MCP server (spec 2025-11-25 or later, Streamable HTTP) or an Agent Skill … New to MCP? Build a simulated Alexa+ experience in a web app."
- Repo must "actually call your track's required technology in code".
- Demo video under 3 minutes; product feedback on every tool; optional friction log for up to a 10% bonus.
- Private repos are shared with `testing@devpost.com` plus the listed Amazon GitHub users.
- AWS credit codes ran out on Oct 7.
- The page lists eligibility as "Above legal age of majority".

## 4. Gaps vs repo

Severity: **B** = blocks Alexa+ deploy or certification, **H** = breaks the hackathon demo or judging, **M** = fix before submission, **L** = cleanup.

| # | Sev | Repo says / does | Current docs say | Fix |
|---|---|---|---|---|
| 1 | B | `phase-1-brief.md:185`: "the audience will include minors"; COPPA under-13 path | Policy §4: "must not be targeted towards children … never target children or collect their data" | Product call needed before any `alexa-ai submit`. Either the add-on is 18+ / adult-account-only (Alexa+ account holder, no child profiles), or there is no store submission and the hackathon simulator path only. Record it as an ADR. |
| 2 | B | `auth/oauth.ts` `authenticate()` gates **all** `/mcp` traffic (initialize, tools/list) on a user token | Two tiers. Alexa calls `initialize`/`tools/list` with a `client_credentials` token (`mcp:service`) and expects 401/403 **per user tool** to trigger linking | Accept service tokens for discovery and per-tool user tokens (`mcp:tools` plus our scopes). Return 401 from a `tools/call` that needs a user. Add a guest path for read-only tools (Functional §6). |
| 3 | B | ADR 0006 / `oauth.ts`: Better Auth **OIDC-provider plugin** as AS | Alexa: "Not Supported Yet: … OpenID Connect", "Dynamic Client Registration", "CIMD" | The AS must publish RFC 8414 metadata at `/.well-known/oauth-authorization-server` with `grant_types_supported: [client_credentials, authorization_code, refresh_token]`, `code_challenge_methods_supported: [S256]`, a static client, refresh tokens on every code exchange, and `resource` validation. Do not depend on OIDC discovery or `id_token`. Whether Better Auth's plugins meet all of this was **not verified**. |
| 4 | B | `prm.ts` `buildPrm({resource: env.MCP_RESOURCE_ORIGIN})` gives an origin (`http://localhost:8788`) | `resource` "Must exactly match the URL in your add-on manifest". Amazon's example uses `…/mcp` | Set `resource` to the full endpoint (`https://<host>/mcp`) and use the same string in `addon.json` `integrations[0]…uri`. Keep the PRM at the root `/.well-known/oauth-protected-resource` (Amazon's stated path). Also serve `/.well-known/oauth-protected-resource/mcp` for RFC 9728 path-suffixed clients. |
| 5 | M | `prm.ts`/`oauth.ts`: 401 carries `WWW-Authenticate: Bearer resource_metadata=…` (ADR 0006 §3 calls it the discovery mechanism) | Quickstart: 401 "without a WWW-Authenticate header". Auth page: header "not supported". MCP spec allows well-known-only discovery | Drop the header, or make it configurable and off for the Alexa deployment. The simulator's SDK client falls back to the well-known URI. ADR 0006 §3 needs rewording. |
| 6 | M | `MCP_SCOPES = ['mcp:care','mcp:caller']` | Amazon's model: `mcp:service` (client credentials), `mcp:tools`/`mcp:resources` (user), custom scopes allowed; Alexa asks the customer for every PRM `scopes_supported` value | Add `mcp:service` for Tier 1. Keep the custom scopes, but every scope in PRM is shown to the customer at linking, so name them in plain language. |
| 7 | B | `server.ts` imports `@modelcontextprotocol/sdk/server/mcp.js` through an ambient `src/types/mcp-sdk.d.ts` stub. The package is not installed, `server.connect()` is TODO'd, and a fresh transport is built per request with no `onsessioninitialized` | v2 split packages exist (`@modelcontextprotocol/server` 2.3.1, `/node` 2.1.1). `ext-apps` 2.x requires the `^2.0.0` peers | Install `@modelcontextprotocol/server`, `@modelcontextprotocol/node` and `@modelcontextprotocol/ext-apps` (plus `zod@^4.2`). Delete the `.d.ts`. Use `NodeStreamableHTTPServerTransport` and `connect()`. Use stateless mode, or a session map wired to `onsessioninitialized`; Alexa keys conversation state off its own history, not `Mcp-Session-Id`. |
| 8 | M | ADR 0005: "Spec floor: 2025-11-25 or newer" | MCP current = **2026-07-28** (stateless, no `initialize`). Alexa sends `initialize` with `2025-03-26`; the Local Inspector sends `2025-06-18` | Pin ADR 0005 to the handshake protocol: serve 2025-11-25 and negotiate down to 2025-03-26. Do not adopt 2026-07-28 for the Alexa endpoint. Add a contract test that replays Alexa's exact `initialize` payload. |
| 9 | M | `server.ts` OPTIONS returns `access-control-allow-origin: *`, and there is no Origin check | MCP transport: servers **MUST** validate `Origin`, 403 if invalid | Use `originValidation`/`hostHeaderValidation` from `@modelcontextprotocol/node`. Allowlist the simulator origin; server-to-server Alexa calls may carry no `Origin`. |
| 10 | B | `inject_presence_event` is always registered. The handler refuses outside dev mode (`tools.ts:357`) | Functional §13: every `tools/list` entry must be invocable, no placeholders. Tool signatures lock after publication | Register the dev tool only when `MCP_DEV_MODE=1`, so the Alexa/prod `tools/list` never contains it. |
| 11 | H | Brief §3 and ADR 0009: "Alexa JS SDK for host communication"; visual layer "served from the existing NYC-Mon web app" (Next.js) | Alexa renders **MCP Apps**: a `ui://` resource, MIME `text/html;profile=mcp-app`, one self-contained HTML bundle in a sandboxed iframe, with no cookies or localStorage and CSP-declared domains. `hostContext` arrives over the MCP Apps bridge. No public "Alexa JS SDK" package was found | Build the fragment and full-screen Mon view as one React View on `@modelcontextprotocol/ext-apps/react`, bundled to a single hashed HTML (`ui://nyc-mon/mon-view-<hash>.html`). Register it with `registerAppResource`, link tools with `_meta.ui.resourceUri`, and declare `availableDisplayModes: ["inline","fullscreen"]`. Reuse NeonBlade tokens, but author at 768×480 with a root `zoom` and support light and dark. No tool registers a `ui://` resource yet. |
| 12 | H | Full-screen view is three.js **WebGPU** + TypeGPU | Alexa docs say nothing about WebGPU in the Alexa+ webview. Accessibility asks for ≤3 flashes/s and a working Screen Magnifier | Keep a WebGL2 fallback path in the View and verify WebGPU on an Echo Show before relying on it (open question, not answered by docs). |
| 13 | B | Brief §7: Ratti's personality on **Bedrock behind the MCP server** | Quickstart: "round-trip query response latency of less than 500 ms". Carousel: first item within 500 ms | No LLM calls in the `tools/call` path for the Alexa endpoint. Keep Bedrock in the web simulator's agent loop (where ADR 0009 already puts the model) or in async/background work. ADR 0009 ("server stays characterless") already conflicts with brief §7, so resolve that in ADR 0009's favour. |
| 14 | H | ADR 0007 §2, `schemas.ts` `alexaVoiceId`, SKILL.md: "Pass `speakerHint` (Alexa Voice ID)…" | No Alexa+ MCP page documents a person or Voice ID field. `context.System.person.personId` exists only in classic ASK request JSON. The brief's Voice ID URL returns 404 | Treat Voice ID as unavailable on Alexa+. Acting voice on device resolves from the linked token (Caller) plus our own presence events. Keep `speakerHint` as a simulator-only input, or drop the parameter ("Declare only what you honor"). Update ADR 0007 and the brief's URL. |
| 15 | H | SKILL.md and ADR 0009: the Agent Skill carries Ratti's voice and routing on Alexa+ | Alexa's own LLM routes and phrases replies: "You can't 'script' what Alexa says". The Add-on Agent Skill Amazon mentions is an **onboarding** skill for coding agents, not a runtime persona | Position the skill as (a) the brain of our web simulator (the judged hackathon path) and (b) portable to any MCP agent. On a real Echo, character comes through structured data (`moodHint`, refusal `reason`) and the MCP App visuals. State this in the Devpost write-up so judges don't expect Ratti's dialect from Alexa's TTS. |
| 16 | M | Tools return codes such as `PERMISSION_DENIED_NOT_CALLER` in `structuredContent`; `content` text mirror not always set | Functional §2: no API codes or internal IDs in customer-facing responses; failures use `isError: true`. Lifecycle sample mirrors `structuredContent` as text | Keep machine codes, but add a plain-language `content` text and a `nextStep` field for each error, and set `isError: true` on failures. |
| 17 | M | Familiar Voices: phone/web speaker embeddings, James scene | Policy §1: no real person's name or voice without a signed release. §3: explicit consent for sensitive data; rejected if it "collects data about the customer's Alexa environment" | Embeddings are biometric. Disclose them in the privacy policy and in the one-time permission prompt. Confirm "James" is fictional or under a signed release. Keep presence data scoped to our app's mic, never Echo audio (ADR 0007 already holds this). |
| 18 | M | Brief demo beat: "Caller links account; Ratti greets" with our own Account Linking screen | Alexa owns the linking UI (QR on screen, Alexa-app push on headless). Policy §11 rejects "instructions directing customers to enable via an external website" | Drop the custom Account Linking screen from the Alexa surface. Keep it only in the simulator, labelled as a stand-in for Alexa's QR flow. |
| 19 | M | Brief: "fragments + full-screen", "Mon Status fragment" | Alexa's terms are Inline (default) and Fullscreen, plus Hydrated and Voice-only. Patterns are fixed: List, Carousel, Card, Map | Map the Mon Status fragment to an Inline Card and the Mon View to Fullscreen with our own expand control. Every tool must also make sense data-only (hydrated) and voice-only on an Echo Dot. |
| 20 | H | Brief: `alexa-ai new/test/deploy/submit` as deliverable 6; Amazon "web simulator" for judging | The CLI comes from a private CodeArtifact registry behind an AWS role granted by an Alexa SA (Private Preview). The Alexa+ Simulator opens only for a deployed add-on | Without preview access, deliverable 6 can't be done. Ship `packages/web-sim` (Devpost's "simulated Alexa+ experience" path) and log the access wall in `docs/FRICTION-LOG.md`. Prepare `addon.json` by hand from §2.3 so it is ready the day access lands. |
| 21 | M | — | Manifest needs a privacy URL and a terms URL (both HTTPS), six light icon sizes, a 600x900 carousel image with no Amazon device imagery, a ≤30-char name with IPA `spokenForm`, and 3–4 example phrases that all work | Add a `packages/alexa-addon/addon-package/addon.json` draft and an asset checklist. "NYC-MON" fits the name limit; add a `spokenForm` for "N-Y-C Mon". |
| 22 | L | Brief: use Amazon Devices Builder Tools "from day one" | That tool covers Vega/Fire TV only (`@amazon-devices/amazon-devices-buildertools-mcp`) | Use it only for the friction log. The Alexa+ equivalents are the Add-on Agent Skill and the Local Inspector skill, both behind the console login. |
| 23 | L | Brief: request $150 AWS credits | Devpost resources (Oct 7 update): out of credit codes | Strike the item. |
| 24 | L | Agent Skill at `.devin/skills/nyc-mon-alexa/` while brief §5 says `skills/nyc-mon-companion/` | agentskills.io: `name` must match the parent directory | Pick one path and keep `name` equal to that directory name. |
| 25 | M | `talk_to_mon.utterance` `z.string().max(500)` | Policy §3 rejects "unbounded open text fields unrelated to its declared purpose". Alexa already holds the utterance | Low risk because the field is bounded and on-purpose. On Alexa, Alexa's LLM handles the talking, so consider hiding `talk_to_mon` from the Alexa build or narrowing it to structured intents. |

## 5. Open questions the docs do not answer
- WebGPU availability in the Alexa+ webview on Echo Show 8/15/21.
- The exact Alexa redirect URI list. The CLI prints it after `configure-account-linking`, behind preview access.
- Whether Alexa+ forwards any speaker or person identity to MCP servers.
- The package name of the "Alexa JS SDK" and React component library mentioned on the Development Stages page.
- The final certification rubric ("will be added in a future revision").
- Whether Better Auth's current OAuth-provider plugin can issue `client_credentials` tokens and RFC 8414 metadata without OIDC. Check against Better Auth source before choosing it.
