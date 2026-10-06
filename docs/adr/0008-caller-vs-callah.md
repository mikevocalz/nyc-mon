# ADR 0008: Canonical "Caller" vs spoken "Callah"

- **Status:** Accepted (2026-10-06, scaffold)
- **Date:** 2026-10-06
- **Deciders:** Mike (creator) — the rule is already canon; this ADR binds the extension to it
- **Canon:** `docs/COPY_DECK.md` §Caller-and-Callah; `V11 ¶19`, `¶58`, `¶59`, `¶109`, `¶110`; Law 9 (`CONTRIBUTING.md`); `docs/canon/DECISIONS.md`
- **Spec:** `docs/alexa-plus-brief.md` ("Character voice rules")
- **Code:** enforced in `packages/mcp-server` schemas and the Agent Skill

## Context

Canon splits the word by medium. `Caller` is the role — every `ui` string, API field, state object and lore record. `Callah` is what certain characters *say* — it lives inside `character` strings and the TTS lexicon (`Caller → "Call-uh"`). The canon refusal — "You ain't my Callah. I'm not listening to you." (`V11 ¶59`) — is a spoken line, and belongs to Malik's Ratti; the player's own Mon may refuse in its own voice but the term's *placement* rule is fixed.

The Alexa+ surface is the first place both media collide in one product: structured tool payloads sit directly under spoken dialogue.

## Decision

1. **Every non-dialogue surface says `Caller`.** Tool input/output fields (`callerId`), error codes (`PERMISSION_DENIED_NOT_CALLER`), `ActingVoice.kind: 'trainer'` semantics (the Caller's permission tier), the PRM scopes (`mcp:caller`), collection names, and all simulator UI text. The wire enum keeps the literal `trainer` only because the build prompt's permission contract spells it that way; its documented meaning is "the Caller" and it is never rendered to a user.
2. **`Callah` appears only in character dialogue** — lines the Agent Skill renders in a Mon's or NPC's voice, and the per-character pronunciation lexicon entry `Caller → "Call-uh"`. It never appears in a tool name, schema field, label, button, fragment, error code or notification.
3. **The refusal beat is a Mon's line, not a system message.** `PERMISSION_DENIED_NOT_CALLER` carries structured data (`actingVoice`, `requiredPermissions`); the *words* come from the character layer. The server never returns the string "Callah".
4. **No drift terms.** `trainer`, `owner`, `user`, `master` do not appear in Alexa-facing copy or schemas. Law 9's banned words (`wild`, `family`/`line` for Dex groupings → `Bloodline`, `catch`/`capture`, `dead`/`killed`) apply to the add-on's strings and tool descriptions too.

## Consequences

- Reviewers and certifiers see one vocabulary across code, UX and Devpost assets.
- The skill file (`SKILL.md`) carries the explicit two-layer rule so any agent loading it inherits the split; TTS lexicon entries are the only place `Callah` is *written* mechanically.
- Renaming the wire enum `trainer` → `caller` later is a breaking tool-schema change; the alias is documented in `src/mcp/schemas.ts` so future agents don't re-litigate it.
