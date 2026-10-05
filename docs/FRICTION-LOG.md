# Friction log — Amazon Devices Builder Tools & Alexa+ add-on path

Hackathon requirement (`docs/nyc-mon-alexa-plus-build-prompt.md` §constraints): use the **Amazon Devices Builder Tools** (MCP server + Agent Skills for Amazon device knowledge, https://developer.amazon.com/docs/vega/0.24/mcp-server) inside the coding assistant from day one, and log every friction point. The hackathon explicitly solicits product feedback on the tools — up to a 10% judging bonus — so entries are written to be copy-pasteable into feedback/Devpost.

**Started:** 2026-10-06

## Log format

Each entry, newest first:

```
### YYYY-MM-DD — <short title>
- **Tool surface:** (Amazon Devices Builder Tools MCP / Agent Skill / alexa-ai CLI / MCP Toolkit docs / Vega docs / Devpost resources)
- **What I tried:** one line, the exact task or call
- **Expected:** what the docs/tool led me to expect
- **Actual:** what happened (error text, missing capability, doc gap)
- **Impact:** blocked | workaround | cosmetic — and what the workaround was
- **Artifact:** commit / file / doc URL that records it
- **Status:** open | resolved | reported
```

## Entries

### 2026-10-06 — Log seeded at scaffold time
- **Tool surface:** Devpost resources + Alexa+ add-on docs (developer.amazon.com/docs/alexaplus/add-ons/*)
- **What I tried:** mapped the build prompt's named references against the repo; scaffolded `@acme/mcp-server` + ADRs 0005–0009 + this log.
- **Expected:** Alexa+ private-preview tooling (`alexa-ai` CLI) usable for manifest generation.
- **Actual:** `alexa-ai` CLI is private-preview gated; not yet available to this project. The MCP scaffold therefore targets the open standard surface (Streamable HTTP 2025-11-25 + PRM) with the `alexa-ai` introspection step deferred.
- **Impact:** workaround — tool names/schemas kept stable and introspectable so `alexa-ai new` can generate the manifest when access lands. Not blocking the simulator path (the judged surface).
- **Artifact:** `docs/adr/0005-alexa-mcp-transport.md`, `packages/mcp-server/`
- **Status:** open — request preview access when an application channel exists; also pending $150 AWS credits (forms.gle/GaHFxSbBQNG9Kti6A).

<!--
Append real friction here as it happens: every failed tool call, doc
contradiction, missing capability or confusing UX in the Amazon Devices
Builder Tools counts, including "worked but surprising".
-->
