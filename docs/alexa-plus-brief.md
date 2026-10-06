# NYC-Mon × Alexa+ Add-on — Build Brief

## Context
NYC-Mon is a proprietary creature/companion game (Canon & Lore Bible v11). Phase 1 is a Tamagotchi loop: pick a starter (Hood Ratti, Bodega Cee, Yotes) → incubate → hatch → care. Rendering is three.js + WebGPU + TypeGPU. The repo is `nyc-mon` (local), with a Next.js product site, a shared cross-platform UI layer (NeonBlade-derived, Knicks-like palette), logos already in-repo, and a standing rule that all web markup uses the semantic HTML primitives in `/ui/html`.

Goal: ship an **Alexa+ MCP add-on** for the Amazon "Build, Ship, Shape" Developer Hackathon (Alexa+ primary track) that lets a Caller talk to their Mon on Echo Show / Alexa+, with the visual layer served from the existing NYC-Mon web app, and demonstrate the **Familiar Voices / Familiar People** system with James as the canonical familiar person.

---

## Hackathon constraints (treat as hard requirements)
- Devpost: https://amazonappdev2026.devpost.com/ — deadline **23 Oct 2026, 12:00 PDT**. Resources: https://amazonappdev2026.devpost.com/resources · Rules: https://amazonappdev2026.devpost.com/rules · FAQs: https://amazonappdev2026.devpost.com/details/faqs
- **Alexa+ track definition (verbatim intent):** a working MCP integration built on the open standards for **Agent Skills** and **Streamable HTTP transport**, with the Alexa+ experience simulated via a web app using your preferred agentic tools. Two named references:
  - MCP Apps / Build with Agent Skills: https://apps.extensions.modelcontextprotocol.io/api/#build-with-agent-skills
  - Streamable HTTP transport (spec 2025-11-25): https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#streamable-http
- So the deliverable is **three things**, not one: (a) the self-hosted MCP server over Streamable HTTP, (b) an **Agent Skill** (`SKILL.md` + resources) that teaches any agent how to be a Caller's Mon on Alexa+, (c) a **web-app Alexa+ simulator** that is a real MCP client — this is the judged surface, not a nice-to-have.
- MCP spec **2025-11-25 or newer**, **Streamable HTTP** transport, OAuth 2.1 + PKCE (S256) with Protected Resource Metadata (RFC 9728).
- Use the **Amazon Devices Builder Tools** (MCP server + Agent Skills for Amazon device knowledge) inside the coding assistant from day one: https://developer.amazon.com/docs/vega/0.24/mcp-server — and log every friction point in `docs/FRICTION-LOG.md` (the hackathon explicitly solicits product feedback on the tools; up to a 10% judging bonus).
- Request the **$150 AWS credits**: https://forms.gle/GaHFxSbBQNG9Kti6A — needed for the AWS Builder mini-challenge.
- **Mini-challenges stack on the primary submission** (same project, not separate):
  - *AWS Builder* — documented AWS integration: Amazon Bedrock (Ratti's dialogue/personality layer), AgentCore, Strands SDK, or Kiro. Learn: https://builder.aws.com/learn
  - *Open Source* — a real contribution to a public repo during the window (e.g., upstream the pronunciation-lexicon or presence-event schema as a standalone package).
- Official Alexa+ add-on path (Private Preview; use when access lands, don't block on it):
  - Dev stages (Discover → Build → Test → Submit → Maintain): https://developer.amazon.com/docs/alexaplus/add-ons/alexa-plus-add-on-development-stages.html
  - MCP Toolkit: https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-overview.html
  - CLI (`alexa-ai new` introspects our MCP tools and writes the manifest; `alexa-ai test --test-suite`; `alexa-ai deploy`; `alexa-ai submit`): https://developer.amazon.com/docs/alexaplus/add-ons/alexa-ai-cli-reference.html
  - Certification: https://developer.amazon.com/docs/alexaplus/add-ons/certification-guidelines.html
- Design for **both** headless (voice-only) and screen devices (fragments + full-screen). UI must pass the automated Alexa UX guidelines check.
- Pre-submission: HTTPS endpoint reachable by Alexa, all tests pass, valid privacy policy URL, account-linking metadata complete, on-device/simulator testing done.
- Support: live office hours (schedule on the landing page) · forum https://community.amazondeveloper.com/ · sample code https://github.com/amazonappdev

---

## Engineer roster — build to the standard of the people who wrote the specs
Channel these creators/spec authors; cite their primary sources in docs:

- **MCP spec & SDK** — David Soria Parra & Justin Spahr-Summers (Anthropic), https://modelcontextprotocol.io/specification/2025-11-25 ; TypeScript SDK https://github.com/modelcontextprotocol/typescript-sdk
- **MCP Apps / Agent Skills extension** — MCP Apps working group (Anthropic + OpenAI + community), https://apps.extensions.modelcontextprotocol.io/ ; Agent Skills spec https://agentskills.io
- **OAuth 2.1 / PKCE / PRM** — Aaron Parecki (OAuth 2.1 draft co-author) https://oauth.net/2.1/ ; RFC 9728 https://www.rfc-editor.org/rfc/rfc9728 ; RFC 7636 PKCE https://www.rfc-editor.org/rfc/rfc7636
- **Alexa+ Add-ons** — Amazon Alexa+ builder team: MCP Toolkit https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-overview.html ; MCP Design Guide https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-design-guide.html ; Client & App Lifecycle https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-client-lifecycle.html ; Display Modes https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-display-modes.html ; Authentication https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-authentication.html ; Account Linking https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-account-linking.html ; Certification guidelines https://developer.amazon.com/docs/alexaplus/add-ons/certification-guidelines.html
- **Amazon Devices Builder Tools** — Amazon Devices developer team, https://developer.amazon.com/docs/vega/0.24/mcp-server
- **Amazon Bedrock / Strands / AgentCore** — AWS Agentic AI team, https://docs.aws.amazon.com/bedrock/ ; https://strandsagents.com ; https://aws.amazon.com/bedrock/agentcore/
- **Alexa Voice ID (person recognition, direct speaker only)** — https://developer.amazon.com/docs/alexa/custom-skills/recognize-a-speaker-with-voice-profiles.html
- **Next.js / React** — Guillermo Rauch & Tim Neutkens (Vercel) https://nextjs.org/docs ; Dan Abramov / React team https://react.dev
- **Supabase Realtime** — Paul Copplestone & Ant Wilson https://supabase.com/docs/guides/realtime
- **Speaker embeddings / diarization** — Hervé Bredin (pyannote) https://github.com/pyannote/pyannote-audio ; SpeechBrain ECAPA-TDNN https://speechbrain.github.io
- **Expressive TTS & pronunciation control** — ElevenLabs docs https://elevenlabs.io/docs (character voices, pronunciation dictionaries)
- **three.js / WebGPU** — Ricardo Cabello (mrdoob) https://threejs.org/docs ; TypeGPU (Software Mansion) https://docs.swmansion.com/TypeGPU/

---

## Skills & subagents — mandatory, in this order, each with a required output
Run as subagents; no step may be skipped or merged.

### Engineering
1. `engineering:system-design` → `docs/architecture/system-design.md` — service boundaries (MCP server, Familiar Presence Service, web UI host, Supabase), data model (Caller, Mon, FamiliarPerson, PresenceEvent, Permission), sequence diagrams for the James scene and the Callah refusal.
2. `engineering:architecture` → ADRs: ADR-001 Streamable HTTP MCP as the only Alexa+ integration surface; ADR-002 OAuth 2.1 + PKCE + PRM; ADR-003 "no raw Echo mic" — presence comes from NYC-Mon phone/web via Supabase Realtime; ADR-004 canonical `Caller` vs spoken `Callah`; ADR-005 Agent Skill carries character/tool-routing, no hand-written intent router.
3. `mcp-builder` → the server itself (see Deliverables).
4. `engineering:testing-strategy` → MCP Inspector trace export, unit tests per tool (valid + invalid inputs), golden use-case suite for `alexa-ai test`, simulator E2E with the Agent Skill loaded, contract tests for the lifecycle doc.
5. `engineering:code-review` → review pass over server, auth, skill, and UI before any submission; output `docs/review/code-review.md`.
6. `engineering:documentation` → README, `docs/FRICTION-LOG.md`, privacy policy page, `docs/aws-builder.md`, Devpost write-up.
7. `engineering:deploy-checklist` → pre-submission checklist mapped 1:1 to the Amazon pre-submission list above.

### UX / Design (per screen, with Mobbin references per screen)
For each screen — Account Linking, Mon Status fragment, Full-screen Mon View (three.js), Familiar Voices consent/enrollment, Familiar Person detail, Permission denied ("not my Callah") fragment, Headless voice-only flow map — run:
- `design:user-research` → one-page research brief: who talks to a Mon on an Echo Show, in what room, with whom present (James scene).
- Mobbin (`search_screens` / `search_flows`, platform web + iOS) → 3–5 references per screen, saved to `docs/design/mobbin/<screen>.md` with `mobbin_url` links.
- `design:design-system` → audit the NeonBlade-derived tokens against Alexa UX guidelines; document any Alexa-specific tokens (fragment safe areas, 10-ft readability).
- `design:ux-copy` → every voice line and on-screen string, in two layers: canonical (`Caller`) for UI/API/lore and in-character surface (`Callah`) for dialogue, with per-character pronunciation lexicon entries.
- `design:accessibility-review` → WCAG 2.1 AA pass + Alexa accessibility doc https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-accessibility.html
- `design:design-critique` → critique of the fragment + full-screen pair before implementation.
- `design:design-handoff` → spec sheet per screen (layout, tokens, states, headless fallback copy).
- `frontend-design` → final visual pass; semantic HTML from `/ui/html` only.

If any native (iOS/Android) code is added for on-device speaker embedding, implement it using one of the Margelo react-native-skills: https://github.com/margelo/react-native-skills/tree/main/skills

---

## Deliverables

### 1. MCP server (`packages/alexa-mcp`)
Streamable HTTP, MCP 2025-11-25+, TypeScript SDK, OAuth 2.1 + PKCE + PRM, account-linked to the Caller's NYC-Mon account. Tools designed for one-shot extraction, stable IDs, structured errors that let Alexa ask a precise follow-up.

**Core care loop**
- `get_mon_status(monId?)` → stage, hunger, mood, health, last-fed, pending needs
- `feed_mon(monId, itemId)`, `play_with_mon(monId, activity)`, `heal_mon(monId)` (Nurse Nay flow)
- `get_inventory()`, `check_incubation()`

**Familiar People**
- `get_familiar_people()`, `get_present_people()`, `get_person_relationship(personId)`, `get_shared_memories(personId)`, `acknowledge_person(personId)`

**Permissions**
- Every mutating tool resolves the **acting voice identity**: `trainer` (Caller) | `familiar` (with per-person permissions: talk / play / feed / care) | `unknown`. Trainer-only actions requested by a familiar return a structured `PERMISSION_DENIED_NOT_CALLER` error so the personality layer can render the Callah refusal.
- Alexa Voice ID `personId` (when present) maps to a FamiliarPerson only if that person enrolled themselves; never infer identity from background audio.

### 2. Familiar Presence Service
- Enrollment is explicit, per-person, opt-in, on NYC-Mon phone/web where we control the mic. Store the encrypted speaker embedding, not the recordings. Revocable. Visible "Familiar Voices active" state.
- Pipeline: VAD → speaker embedding → match against opted-in embeddings → `PresenceEvent{personId, confidence, ts}` → Supabase Realtime → MCP context.
- Confidence tiers drive dialogue: ≥0.90 "Yo, James!"; 0.70–0.89 "Wait… is that James back there?"; <0.70 silent.

### 3. Web UI (served from the Next.js app)
- Fragment: Mon status card. Full-screen: live three.js/WebGPU Mon view with reaction to presence events (Ratti turns toward "James").
- Headless parity: every fragment has a voice-only equivalent; Alexa tells the user when a screen is required.
- Alexa JS SDK for host communication; semantic HTML primitives from `/ui/html`; NeonBlade tokens; passes the automated UX check.

### 4. Alexa+ web simulator (`packages/web-sim`)
A browser page that is a real MCP client (official SDK, Streamable HTTP) with an Alexa-style conversation pane, Web Speech in/out, and the fragment/full-screen renderer — so the demo works without device access. The conversation brain is a real model (Bedrock or Claude) driven by the Agent Skill below — **not** a deterministic intent router.

### 5. Agent Skill (`skills/nyc-mon-companion/`)
`SKILL.md` + resources so any MCP-capable agent (Alexa+, or Claude/Cursor in the simulator) knows how to run a Mon session: when to call which tool, the trainer/familiar/unknown permission model, confidence-tiered presence reactions, the canonical-`Caller`/spoken-`Callah` rule, and per-character voice profiles. Follow the Agent Skills format at https://agentskills.io and the MCP Apps guidance at https://apps.extensions.modelcontextprotocol.io/api/#build-with-agent-skills. Validate by driving the full demo script through the simulator with the skill loaded and no hand-written intent routing.

### 6. Add-on package
`alexa-ai new` generated manifest + config under `packages/alexa-addon`; golden test suite; `alexa-ai deploy` to dev stage; `alexa-ai submit` checklist.

### 7. AWS Builder integration (mini-challenge)
Ratti's personality layer runs on Amazon Bedrock (Strands SDK agent or direct Converse API) behind the MCP server; document the integration in `docs/aws-builder.md` with the exact models, IAM scope, and cost per session.

### 8. Demo script (≤3 min video)
1. Caller links account; Ratti greets on Echo Show.
2. "Yo Ratti, you hungry?" → `get_mon_status` → feed.
3. James speaks nearby; phone detects James → presence event → Ratti on the Echo turns: "Hold up… is that James? Yo James!"
4. James: "Use Mike's rare item." → `PERMISSION_DENIED_NOT_CALLER` → Ratti: "You ain't my Callah. I'm not listenin' to you."
5. Nurse Nay heal flow with her own voice profile and pronunciation lexicon.
6. Show the Familiar Voices consent screen and revoke path.

### 9. Submission assets
Devpost write-up mapped to judging criteria (Potential Impact first), architecture diagram, friction log, privacy policy URL, AWS Builder + Open Source mini-challenge notes.

---

## Character voice rules (non-negotiable)
- Canonical term stays `Caller` in UI, APIs, state, lore. Spoken rendering `Callah` lives only in dialogue + TTS lexicon (`Caller → "Call-uh"`).
- One voice profile per character (accent, cadence, vocabulary, code-switching, pronunciation rules). Ratti ≠ Nurse Nay ≠ Malik ≠ Theo. Never flatten NYC speech into one stereotype.
- Nurse Nay = Naomi Williams; "Nurse Nay" on cards/signage/UI/headers; "Nay-Nay" only from kids/longtime patients.

## Do not
- Claim or implement Echo background microphone access. Alexa Voice ID identifies the person speaking to Alexa only.
- Store enrollment audio. Enroll anyone on another person's behalf.
- Use non-semantic markup on the web side.
- Hand-write an intent router in the simulator; the Agent Skill + model carry the character.
- Skip any skill/subagent step or drop its output artifact.


One thing worth flagging: the track text says "simulate an Alexa+ experience using your preferred agentic tools via a web app" — so judges expect the simulator to be driven by a real model (Claude, Bedrock, etc.) plus your Agent Skill, not a deterministic intent router. That makes the Agent Skill the thing that actually carries Ratti's character, which is a good place to spend the design budget.