# 0015 — Alexa+ add-on: who it serves and what the hackathon build ships

- **Status:** Accepted
- **Date:** 2026-10-08
- **Deciders:** Mike (creator); recorded by the lead
- **Sources:** `docs/alexa/HACKATHON.md`, `docs/alexa/PLATFORM-DOCS.md`, ADRs 0005–0009

## Context

The Amazon Build, Ship, Shape hackathon (Alexa+ track) closes Fri 2026-10-23 12:00 PT. Participants get no access to the Alexa+ CLI, Amazon's web simulator, or real devices, so the judged surface is our own web simulator acting as an MCP client. Amazon's Alexa+ policy forbids add-ons that target children or collect their data; NYC-MON has Callers under 13. The presence design (ADR 0007) stores voiceprints, which are biometric data. NYC-MON already runs on Amazon devices; the repo is public under MIT and predates the hackathon (first commit 2026-08-19).

## Decision

1. **Adults only.** The Alexa+ add-on links only to 18+ accounts. Account linking refuses any account whose birth year makes the holder under 18, and no under-18 Caller's data is reachable through the MCP server. A parent can follow their own adult account's Mons; following a child's Mon is out of scope until a guardian-access design exists.
2. **No real voiceprints.** Familiar people and presence run on seeded test data in the hackathon build: fixed fictional people (James is fictional, with a synthetic voice) and injected presence events, available only in dev and simulator modes. Nothing is enrolled or stored. Real voice enrollment needs a COPPA/BIPA decision and its own ADR before any code collects audio.
3. **Simulator model.** The web simulator runs Claude on Amazon Bedrock as the agent that reads the Agent Skill, calls MCP tools, and speaks as the Mon. This is the AWS Builder mini-challenge entry. The MCP server itself stays characterless and model-free (ADR 0009; the platform's 500 ms round-trip limit).
4. **Every listed tool works.** Certification requires every tool in `tools/list` to work, so tools without a backing store or canon action are removed rather than stubbed (`heal_mon` has no canon care action; `get_inventory` has no inventory). Dev-only tools are registered only in dev mode.
5. **Pitch.** The submission presents Alexa+ as NYC-MON's next Amazon surface: the same Mon already runs on Amazon devices, and on Alexa+ it carries over (canon: a device session is a surface, not a new creature).

## Consequences

- Linking needs the account's birth year from the existing Users collection; the 18+ gate is enforced on the server, not in UI.
- The demo script drops "Ratti greets on Echo Show" for a device-style simulator view; no Alexa+ logo appears anywhere.
- The before/after note for Devpost lists what was built after 2026-08-31 from the git log.
