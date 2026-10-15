# M16 Social (play): research

Route `/(home)/social` · Shell: H-Lynk · States: intro / playing / result · Spec: brief §4.3 M16 ("Caller presence: a short play interaction (trackpad mini-game, 20–40 s, species-specific), raises the Social meter and bond. No multiplayer yet; seam documented."), §3.2 clip `play`; `V11 ¶51` (one Social meter); OPEN_QUESTIONS Q18, Q26, Q44.

## Jobs

- **Dani:** When my Mon wants company, I want a short game that feels like hanging out, not a test.
- **Jayden:** I want to play without reading rules and without losing.
- **Sol (returning):** I want to reconnect fast; 30 seconds is about right.

## What the sim does (verified 2026-10-08)

- `play` = `{ kind: 'play', quality }`, `quality` in [0, 1] "scales the Social and bond gain".
- Gains: Social `+ playSocialGain × quality` (0.3), bond `+ playBondGain × quality` (0.02), Energy `- playEnergyCost` (0.1).
- Declined: `asleep`; `too-tired` when Energy < `playMinEnergy` (0.1).
- No game definition exists anywhere: no content for a mini-game, per species or otherwise. "Species-specific" has no canon source (Q44 asks about room behaviours, which is the nearest question).

## Risks

- **A test in disguise.** Scores, timers and fail states turn company into performance. For under-13s, a lost round with a Mon who looks disappointed is a sad moment the brief never asked for.
- **Time limits (WCAG 2.2.1).** A 20–40 s round must not require speed to succeed.
- **Invented canon.** A species-specific game invents behaviour per bloodline. The mechanic can be shared; per-bloodline flavour waits for canon.
- **Bond visibility.** Q26 is open; showing a bond gain invents a UI for an undefined stat.

## Usability questions

1. Do players understand the game from the Mon's behaviour within the first round?
2. After the round, do players say the Mon "liked playing" rather than "I scored X"?
3. Can a VoiceOver user finish a round as fast as a sighted player?
