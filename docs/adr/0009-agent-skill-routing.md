# ADR 0009: The Agent Skill carries character and tool routing — no hand-written intent router

- **Status:** Accepted (2026-10-06, scaffold)
- **Date:** 2026-10-06
- **Deciders:** Mike (creator) directed the extension; the `platform` agent implements
- **Spec:** `docs/alexa-plus-brief.md` ("the Agent Skill is the thing that actually carries Ratti's character"; "Hand-write an intent router in the simulator" is a listed **do not**); Agent Skills format https://agentskills.io ; MCP Apps guidance https://apps.extensions.modelcontextprotocol.io/api/#build-with-agent-skills
- **Code:** `skills/nyc-mon-companion/SKILL.md` (the skill); `packages/web-sim` (consumer, TODO)

## Context

The track text says the Alexa+ experience is simulated "via a web app using your preferred agentic tools" — so judges expect a real model behind the conversation pane, not a keyword matcher. The demo's hard beats (presence-tiered greetings, the Callah refusal, Nurse Nay's distinct voice) are all *judgment* calls: when to hedge at 0.7 confidence, whose voice a refusal belongs to, which tool a phrase maps to. Those are exactly the things a deterministic router would have to hand-enumerate — and exactly what a skill + model does naturally.

## Decision

1. **A single Agent Skill teaches the Mon session.** `skills/nyc-mon-companion/SKILL.md` follows the Agent Skills format: front matter (name, description) + instructions covering when to call which tool, the trainer/familiar/unknown permission model, confidence-tiered presence reactions, the Caller/Callah rule (ADR 0008), per-character voice profiles and the banned-word list.
2. **Tool routing is the model's job, informed by the skill.** The simulator loads the skill into the system context of a real model (Claude or Bedrock) connected to the MCP server as a client. There is no intent enum, no regex table, no `if (utterance.includes("hungry")) feed()`. Validation: the full demo script runs with the skill loaded and zero hand-written routing.
3. **The MCP server stays characterless.** Tools return structured data and codes (ADR 0005 §4); the skill says how a Hood Ratti reacts to `PERMISSION_DENIED_NOT_CALLER` versus a `PRESENCE_REQUIRED`. Server-side canned dialogue would split the voice in two and make the skill decorative.
4. **One skill, two brains.** The same SKILL.md drives the web simulator's model now and the real Alexa+ agent later — that's the hackathon's "Agent Skills" deliverable and the portability story for the write-up.
5. **Character voices are data in the skill,** keyed per character (Ratti ≠ Nurse Nay ≠ Malik ≠ Theo) with pronunciation-lexicon hooks — the seam ElevenLabs/Amazon Polly lexicons later consume. Voice profiles describe canon cadence (`V11 ¶60`: preserve individual NYC speech without flattening); they never invent canon lines.

## Consequences

- The skill becomes the highest-leverage artifact: it is graded, demoed and upstream-able (the open-source mini-challenge can publish the presence-event schema / skill).
- Model choice is swappable by config (Bedrock for the AWS Builder mini-challenge, Claude for dev), because the skill is model-agnostic by spec.
- Failure mode shifts from "router misses an utterance" to "model misbehaves" — mitigated by the golden test suite (`alexa-ai test`) asserting *tool calls and structured outcomes*, not exact phrasing.
- Keeping the server characterless means the fragment/full-screen UI also reads structured state — the three.js "Ratti turns toward James" reaction keys off `presentPeople` + tier, not parsed text.
