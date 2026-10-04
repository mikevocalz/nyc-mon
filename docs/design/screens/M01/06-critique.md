# M01 Boot / power-on: critique

Scored against `prompts/BUILD_PROMPT_v3.md` §0C. Stage: direction (no build yet). Reviewer: `design-director`; `verifier` co-signs at implementation.

| §0C row | Score /10 | Evidence | Gap |
|---|---:|---|---|
| Delight and Fun | 7 | A device waking is a small, physical moment players will recognise from consoles and handhelds | Only delightful if it is fast; anything over 600 ms turns it into a splash |
| Visuals and Graphics | 7 | One object, one red light, no logo splash | Body colour open (Q5); without the H-Lynk Bible the shell is a proposal |
| Interaction | 8 | Routes by session with no taps; returning players land on their Mon | Route must resolve from MMKV in 240 ms; unproven |
| Inclusivity | 8 | Reduced-motion sibling authored; no flashing above 3/s; VoiceOver hears one line | Dynamic Type n/a (no text) |

Dieter Rams check: as little design as possible holds (no text, no mark). Honest: the LED reports state and never fakes loading.

## Blockers (must clear before 07-a11y / 08-handoff)

1. `HLynkShell`, `ScannerLed`, `HLynkScreen`, `Trackpad`, `HLynkKey` do not exist; each needs a story (R3).
2. Q5 body colour (`TODO(canon)`); the shell can build on the concrete proposal with the royal swap as one token.
3. Route resolver contract: sim-core/platform must expose a synchronous "where does this session go" read from the MMKV snapshot.

## Non-blocking

- Measure the 600 ms on iPhone SE 3 cold start before signing off (§8).
- Hallway test: do first-run players read the shell lowering away as "the H-Lynk turned off"? (`docs/design/research/HALLWAY_TESTS.md`)
