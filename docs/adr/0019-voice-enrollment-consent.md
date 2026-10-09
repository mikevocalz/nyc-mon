# ADR 0019: Voice enrollment, minors and biometric consent

- **Status:** Proposed (draft, needs Mike and likely counsel)
- **Date:** 2026-10-08
- **Blocks:** any code that records audio or stores a voice embedding (ADR 0015 §2).

## Context

The Familiar People feature (ADR 0007) recognises people in the room from speaker embeddings. Voice embeddings are biometric identifiers: laws such as Illinois BIPA require written consent, a published retention policy and a destruction schedule. NYC-MON has Callers under 13 (`Users.birthYear`, guardian consent per ADR 0004), and the people near a Caller can be children too, so COPPA applies to any child's voice. Amazon's Alexa+ policy forbids add-ons that collect children's data, which is why the add-on is adults only (ADR 0015).

## Questions to settle

1. Who may enroll: adults only, or teens with guardian consent? Children under 13 never, or only with verified guardian consent?
2. Where enrollment happens: the phone app only, with the embedding computed on device?
3. What is stored: an encrypted embedding only, never audio (ADR 0007 §3). Where is the key, and who can decrypt?
4. Retention and deletion: a fixed expiry, deletion on revoke, and deletion when the Caller's account closes.
5. Consent record: written consent per enrolled person, stored like `GuardianConsents`, with a revoke path the person controls themselves.
6. Does any of this run while an under-13 Caller is signed in, given that the people nearby could be adults who consented?

## Until this is decided

Presence runs on fictional seeded people in dev and simulator mode only. No audio capture, no embeddings, no enrollment UI.
