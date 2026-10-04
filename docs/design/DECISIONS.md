# Design decisions

Design and product decisions made by `design-director` or handed to it by the lead. Canon decisions live in `docs/canon/DECISIONS.md` and outrank this file. Numbered `D#` here; the lead's product rulings keep their `P#` numbers. Entries are never rewritten; a later entry supersedes an earlier one by number.

## Product rulings from the lead (2026-10-04)

### P1 — The create-account path passes the birth-year gate before sign-in

- **Ruled by:** lead, from research finding 1
- **Reason:** `docs/design/screens/M03/01-research.md` (risk "COPPA ordering (highest)") and `docs/design/screens/M04/01-research.md` (risk "Order"): if the create intent reaches Sign in with Apple or Google before M04, the app collects an under-13's identity before it knows their age, against ADR 0001 ("Under 13: no Better Auth account is created and no child email, Apple or Google identity is collected") and FTC COPPA FAQ H.3 (https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions).
- **Effect:** new players: M01 → M02 → M04 → (under-13: M05) → M03 → M07 → M08. Returning players: M01 → M03 "Sign in" with no age step. M02's last panel offers two actions: "Get started" (→ M04) and a quieter "Sign in" link (→ M03, sign-in intent; final copy is `ux-writer`'s). Applied in `screens/M02`, `M03`, `M04`, `M05` directions.

### P2 — The notification prompt moves to the incubation choice

- **Ruled by:** lead, from research finding 2
- **Reason:** `docs/design/screens/M06/01-research.md` (risk "Timing (highest)"): before the eggs exist, "your egg is ready" refers to nothing; Android's guidance asks for the permission "in the correct context" (https://developer.android.com/develop/ui/views/notifications/notification-permission). `docs/design/research/JOURNEY.md` names the missed return (M11 → M12) as the biggest funnel risk.
- **Effect:** M06 leaves the onboarding sequence. Its pre-permission screen appears right after the Caller confirms 15/30/60 min on M10, then the OS prompt. M06 is designed as a sheet over M10 inside the H-Lynk chrome context, but the sheet itself carries no chrome (it is a system-permission conversation). Applied in `screens/M06`.

### P3 — Welcome panel 2 shows the three eggs

- **Ruled by:** lead, from research finding 5
- **Reason:** `docs/design/screens/M02/01-research.md` (risk "Panel 2 conflicts with Decision #5"): Babies spoil the hatch; Mid forms promise a stage Phase 1 never reaches (Law 7).
- **Effect:** panel 2 shows #001 Metro Egg, #008 Corner Egg, #061 Prism Egg (roster v11.1, `docs/canon/source/NYC_MON_Egg_Baby_All_Forms_Roster_v11_1.md`), still, side by side on the ground line. Applied in `screens/M02`.

### P4 — The Caller-name preview uses the plain UI voice

- **Ruled by:** lead, from research finding 6
- **Reason:** `docs/design/screens/M07/01-research.md` (risk "Nobody to preview with"): no Mon exists until M12, and Phase 1 Babies may not speak (`V11 ¶56`, open Q32).
- **Effect:** the preview shows the name as the H-Lynk would display it, `voice: "ui"`. No character line, no "Callah". Applied in `screens/M07`.

## Design-director decisions

### D1 — H-Lynk chrome on M01 only among M01–M07

- **Date:** 2026-10-04
- **Reason:** the screen map (`prompts/BUILD_PROMPT_v3.md` §4.1) gives M01 the H-Lynk shell and M02–M07 none; §2.4 bars the bezel from auth and settings. M01 research asked to confirm the exception (`screens/M01/01-research.md`, risk "Canon and language").
- **Decision:** confirmed. Detail in `hlynk/DIRECTION.md` § "Where the chrome appears".

### D2 — Rear L/R, edge volume/power and the left action control are not drawn on mobile

- **Date:** 2026-10-04
- **Reason:** they live on the back and edges of the real unit (`V11 ¶63`); a phone's 12 pt rail cannot carry a 44 pt target, and the phone's own buttons sit there.
- **Decision:** STRIKE for Phase 1 mobile; kept for the web `DeviceStage` model. `hlynk/DIRECTION.md` § "Anatomy on a phone".

### D3 — The LED always sits in a dark well

- **Date:** 2026-10-04
- **Reason:** `apple-500` on the daylit Entry body measures 2.83:1, on a royal body 1.33:1 (both fail WCAG 1.4.11's 3:1). In a `concrete-900` well it is 3.97:1, in `night` 4.83:1.
- **Decision:** `led-well` token; the LED states differ by rhythm and carry a text chip, never colour alone. `hlynk/DIRECTION.md` § "The scanner LED is a status light"; `docs/DESIGN_SYSTEM.md` measured pairs.

### D4 — Daylit neutrals are a cool concrete scale; type is pure signage black

- **Date:** 2026-10-04
- **Reason:** Decision #4 and §1.3 ("concrete greys … MTA-signage black for type on neutrals"). A warm cream would read as a generic template; the city's slab is cool grey.
- **Decision:** `concrete-50…900` and `signage-black/white` proposed in `docs/DESIGN_SYSTEM.md`, with measured ratios. Token PR belongs to the theme owner.

### D5 — Orange is a face on daylit, never ink

- **Date:** 2026-10-04
- **Reason:** Decision #7; `orange-500` on `concrete-50` is 2.38:1.
- **Decision:** new `cta` / `on-cta` tokens (orange face, black label, 8.02:1). One orange button per screen at most. `docs/DESIGN_SYSTEM.md`.

### D6 — Entry body colour stays open (concrete proposal), pending Q5

- **Date:** 2026-10-04
- **Reason:** v11 says only "Entry is plastic"; the build prompt contradicts itself (§1.1 Knicks blue, §1.3 concrete grey). `docs/canon/OPEN_QUESTIONS.md` Q5.
- **Decision:** concrete grey until Mike rules; the royal variant is specified so the swap is one token. `TODO(canon)`.

### D7 — "Bloodline" on every surface that names a Dex family

- **Date:** 2026-10-04
- **Reason:** canon Decision #11.
- **Decision:** any M01–M07 surface that names a family (M02 panel 2 captions) reads "Hood Ratti Bloodline", "Bodega Baddiee Cee Bloodline", "Yote Bloodline". Never "line" or "family" in UI.

### D8 — Onboarding pages follow the OS appearance; the shell follows the clock

- **Date:** 2026-10-04
- **Reason:** Decision #4 sets daylit as the default and dark for night and the hatch. Auth forms are not a place for a theatrical night mode; the companion shell is.
- **Decision:** M02–M07 use the semantic theme (daylit unless the OS is in dark mode). The H-Lynk shell uses the time-of-day rig. M01's shell starts in the scheme the clock picks.

## Links

- `docs/design/hlynk/DIRECTION.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/design/screens/M01` … `M07` (`02-references.md`, `03-direction.md`, `04-components.md`, `06-critique.md`)
- Research: `docs/design/research/JOURNEY.md`, `PERSONAS.md`, `HALLWAY_TESTS.md`
