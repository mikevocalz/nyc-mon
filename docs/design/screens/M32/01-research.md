# M32 Mon Space: research

Status: §6 pipeline, step 1. Written 2026-10-29 by lane (a). Skills loaded for this screen: no-ai-slop, ux-heuristics-review, expo-app-design, frontend-design, product-decisions.

## Why this screen exists

Canon v12 names the surface: "H-Lynk → Active Mon opens **Mon Space**" (`docs/canon/GAMEPLAY_BIBLE_V12.md:54`), and Decision #23 puts it on web at `/mon-space`. No native route implemented it before this; `/mon/:id` is the M17 Dex. Mike approved the build on 2026-10-29: "good ideas, go (make sure ui/ux skills are used for designing this! i no longer want this experience inside the h-lynk but just in the screen!)" (canon Decisions #33–#37).

## Sources

- `docs/research/virtual-pet-semantics.md`: what the classic toys did (call icon, care mistakes, poop, sickness, discipline and false calls, weight, lights).
- `docs/research/mon-screen-vpet-audit.md`: what NYC-MON has, what canon allows, and the gap table.
- `docs/research/vpet-modern-design-directions.md`: Direction A, Memory LCD, plus B's night state; the A/B/C mapping; the keychain widget.
- `docs/design/hlynk/DIRECTION.md`, `packages/ui/hlynk/led-rhythm.ts`, `packages/theme/tokens.ts` `motion-led-*`.
- The lead's engineering contract (2026-10-29): `MonCareView`, `ClassicCareState`, `MemoryLcdProps`, `playCareCue`, `KeychainSnapshot`.

## Findings that shape the screen

1. **The pet is the status.** Every Mobbin reference in the research shows how the pet is through pose and one line before any number appears (`vpet-modern-design-directions.md` §1). Mon Space leads with the Mon and one status line; hearts come second.
2. **Three meters is canon; the rest are states.** Fullness, Energy and Social stay the only meters (`V11 ¶51`). Poop, a cold, boundaries (discipline), weight and lights are care states with their own glyphs, never extra bars on the main screen.
3. **No death, and no guilt.** Law 8 and Decision #15 stand. Care mistakes count but are never shown (D20e). The worst state the Caller can see is a Mon calling, a mess, a cold and a light left on.
4. **Classic input is three buttons.** A cycles the icon bar, B selects, C cancels. On touch they become on-screen keys; on an iPad keyboard, arrows, Return/Space and Escape.
5. **The LED is the beep.** On the classic toys the call icon and beep were the product's voice. Here the attention LED, a sound cue (`playCareCue('attention')`), a haptic and a VoiceOver announcement carry the call together, and none alone (`vpet-modern-design-directions.md` §3.7).
6. **Day is paper, night is backlit.** Decision #4 makes daylight the default; a reflective LCD needs no glow in daylight, and the backlight plus selective bloom belongs to night.
7. **Under-13 Callers.** Calls must read as a friend asking, never an alarm. Notifications are opt-in (D20b).

## Users and jobs

| Who | Job on this screen |
|---|---|
| The nostalgic adult ("I grew up with a Tamagotchi on my keychain", `PERSONAS.md:129`) | Glance, answer a call, flush, done in under ten seconds |
| A child Caller | Understand what the Mon wants without reading much; never feel blamed |
| A VoiceOver or Switch Control user | Reach every action and hear every state without the LCD |
| A Caller with sound off | Lose nothing; every cue has a visual and spoken twin |
