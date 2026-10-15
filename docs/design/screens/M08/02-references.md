# M08 Meeting: references

Mobbin queries (iOS, 2026-10-08): screens "virtual pet game choose your starter egg from several eggs shown side by side, one egg selected"; screens "creature or pet info card slides up from the bottom over an illustration, showing name, type label and short description"; flows "Finch onboarding choose an egg, hatch the pet, then name your pet"; flows "Tolan finding a Tolan, meeting your alien companion during onboarding".

The brief's Tolan "Finding a Tolan" link (`mobbin.com/flows/3257e852-…`) did not come back from these searches; the Tolan flow below is the one the tool returned. The brief's Replika character-select anti-pattern stands as written in §4.2 and was not re-queried.

| Ref | Take | Reject |
|---|---|---|
| Finch choose your egg — https://mobbin.com/screens/db6655c3-2b11-4042-9e4f-5d5d131da104 | Every egg visible at once, so the choice is a comparison, not a hunt; one short line about what the eggs are | Six colour swatches with no identity; the pet already shown before the egg is picked (spoils the hatch, P3); "Hatch egg" as the commit, which skips incubation |
| Abode choose your egg — https://mobbin.com/screens/a1e8c40d-b207-47ff-af37-594187f52fe0 | One egg centred and large with its name under it, neighbours peeking at the edges: the focused state | "Soon" badges on locked eggs (scarcity cue); the bottom-sheet modal frame |
| Finch Pumpkin info card — https://mobbin.com/screens/9c762cfe-a65e-4ef8-beec-568ce9259d3e | Stage label, name, then a short line, on a card that sits under the creature without hiding it | Pronoun row ("She/Her"; PS-005, Q14); personality copy we have no canon for |
| Tolan "Meeting your Tolan" — https://mobbin.com/flows/f1595b35-4bcf-4abe-aeaf-ed5ff33f399b | The companion is met in a scene with one action at a time; pacing slow enough to look | Voice picker and the notification ask inside the meeting (our ask lives at M10, P2) |
| Finch "Setting up a birb" — https://mobbin.com/flows/ab3823c2-2068-4b25-965a-c4a2f9290102 | Egg → hatch → name order, which matches Decision #5 | Hatching immediately after choosing; we incubate (M10, M11) |

References inform hierarchy and flow, never pixels (§6).
