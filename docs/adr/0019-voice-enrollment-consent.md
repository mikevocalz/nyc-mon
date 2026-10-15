# ADR 0019: Voice enrollment is out of scope until consent, minors, retention and deletion each have an ADR

- **Status:** Accepted (2026-10-15). Proposed 2026-10-08.
- **Date:** 2026-10-15
- **Deciders:** Mike (creator). The decision rule is recorded in PR #16: record no voice audio or embeddings until consent, minors, retention and deletion are resolved and implemented.
- **Blocks:** any code, on any surface, that records audio, computes or stores a speaker embedding, or shows an enrollment screen (ADR 0015 §2).
- **Sources:** `docs/adr/0004-auth-methods-and-device-handoff.md`, `docs/adr/0007-no-echo-mic-presence.md` §3, `docs/adr/0015-alexa-plus-hackathon-scope.md` §1 and §2, `docs/alexa/PLATFORM-DOCS.md` finding 17, `packages/payload/src/collections/GuardianConsents.ts`
- **Related:** ADR 0018 (presence transport) waits on this ADR's prerequisites.

## Context

The Familiar People feature (ADR 0007) recognises people in the room from speaker embeddings. Voice embeddings are biometric identifiers. Laws such as Illinois BIPA require written consent, a published retention policy and a destruction schedule. NYC-MON has Callers under 13 (`Users.birthYear`, guardian consent recorded in `GuardianConsents` per ADR 0004), and the people near a Caller can be children too, so COPPA reaches any child's voice. Amazon's Alexa+ policy forbids add-ons that collect children's data, which is why the add-on is adults only (ADR 0015 §1).

On `main` nothing records audio or stores an embedding. Presence runs on fixtures (`packages/mcp-server/src/presence/fixtures.ts`), dev and simulator mode only. The demo's James is fictional with a synthetic voice.

## Decision

1. **No voice enrollment in the hackathon build or after it until the prerequisites below are met.** No audio capture, no embedding computed on device or server, no enrollment UI, no `speaker-embeddings` collection.
2. **Each prerequisite gets its own accepted ADR before any enrollment code lands:**
   1. Who may enroll: adults only, or teens with guardian consent. Whether under-13s are ever enrolled, and if so how guardian consent is verified.
   2. Where enrollment happens and where the embedding is computed (the phone app only, on device, is the candidate).
   3. What is stored: an encrypted embedding only, never audio (ADR 0007 §3). Key custody and who can decrypt.
   4. Retention and deletion: a fixed expiry, deletion on revoke, deletion when the Caller's account closes.
   5. The consent record: written consent per enrolled person, stored like `GuardianConsents`, with a revoke path the person controls.
   6. Whether any of this runs while an under-13 Caller is signed in, given that the people nearby could be consenting adults.
3. **Presence stays on fixtures meanwhile** (ADR 0018 §1). Nothing in the Alexa production build lists a presence tool.

## Alternatives considered

1. **Adults-only enrollment now, on the phone, embeddings only.** It would give the judge story a real James. It also puts biometric storage into a public repo before retention, deletion and key custody are written down, and the judge story does not need it (ADR 0015 §2; the demo rehearses with injected events).
2. **Alexa Voice ID instead of our own enrollment.** `docs/alexa/PLATFORM-DOCS.md` finding 14: no Alexa+ MCP page documents a person or Voice ID field, and the brief's Voice ID URL returns 404. There is nothing to build on.

## Consequences

- The Alexa+ submission describes voice enrollment as future work, not as a feature (`docs/alexa/SUBMISSION.md` "What's next"). No demo beat depends on a real voice.
- The `speakerHint` argument stays a simulator-only input (`packages/mcp-server/README.md:46`); a hinted person counts only with a fresh injected presence event.
- Enrollment code waits on six accepted ADRs. Any one of them may decide against enrollment, which ends the feature rather than the chain.
- Whether counsel reviews the BIPA and COPPA questions before those ADRs are written is Mike's call and is not decided here.

## Evidence (2026-10-15, `origin/main`)

- `git grep -i -E 'embedding|enrol'` over `packages/mcp-server` and `docs/alexa`: hits are the ADR 0007 docblock in `presence/service.ts`, the README sentence that no enrollment exists, and PLATFORM-DOCS findings 14 and 17. No collection, route, schema or UI for enrollment exists.
- `docs/alexa/SUBMISSION.md:68` lists "real voice enrollment after a COPPA/BIPA decision (ADR 0015 §2)" as a candidate for future work.
- `docs/HANDOFF.md:145`: "real voiceprints need a COPPA/BIPA decision and their own ADR before any code collects audio".
