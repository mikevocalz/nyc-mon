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
- **Reason:** the screen map (`docs/phase-1-brief.md` §4.1) gives M01 the H-Lynk shell and M02–M07 none; §2.4 bars the bezel from auth and settings. M01 research asked to confirm the exception (`screens/M01/01-research.md`, risk "Canon and language").
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

### D6 — Entry body colour stays open (concrete proposal), pending Q5 (superseded by D11)

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

### D9 — Birth year is picked decade-then-year, no default

- **Date:** 2026-10-04
- **Reason:** FTC COPPA FAQ D.7 treats a preset value as non-neutral, and a native wheel always opens on a value; `screens/M04/01-research.md` flags wheels as slow with VoiceOver and Switch Control.
- **Decision:** `YearGrid`, two taps, plus a typed alternative. Deviates from §4.1 "one tap"; the lead signs off or overrules. `screens/M04/03-direction.md`.

### D10 — The Caller-name preview is a signage plate

- **Date:** 2026-10-04
- **Reason:** P4 rules out a character voice; the MTA sign band is the clearest New York cue available to a text-only screen.
- **Decision:** new kit component `SignagePlate`, reused at M09. `screens/M07/03-direction.md`.

### D11 — The chrome is the H-Lynk Core: red body, black head and controls (supersedes D6)

- **Date:** 2026-10-04
- **Reason:** canon Decision #16 (commit 9609b0d) closes Q5. The tier sheet makes the Entry tier the **H-Lynk Core** in matte red, with a black scanner head, black controls and a bottom row of home, menu, trackpad, back and forward.
- **Decision:**
  - Body `apple-600` #D50000. It is the darkest kit red where black controls keep a 3:1 edge (3.83:1). On `apple-700`, black keys measure 2.80:1.
  - The LED, emitters and trackpad ring sit on black (4.99:1), never on the body (1.30:1).
  - Only white ink goes on the body (5.48:1).
  - The body stays red in daylit and night.
  - Components take `tier: 'core' | 'standard' | 'pro'`.
  - No EngineX mark (Q40). The sheet's on-screen UI is layout reference only (Q41, Q42).
  - D3's "dark well" holds in a new form: the black scanner head is the well.
- **Docs:** `hlynk/DIRECTION.md`, `docs/DESIGN_SYSTEM.md` (`hlynk.core` group, re-measured pairs, forbidden list), `screens/M01/03-direction.md`, `screens/M01/04-components.md`.

### D12 — W01: the seal keeps the hero's right column; the 3D H-Lynk Core gets its own section below

- **Date:** 2026-10-04
- **Reason:** `docs/phase-1-brief.md` §5 puts a live H-Lynk canvas on the right of the home hero. Mike, the same day: "I love the logo on the right for home but it needs work. Leave the Mega City (district) options." His direction outranks the brief.
- **Decision:**
  - The hero's right column is the NYC-MON seal (`BrandLogo`), unedited. The district selector stays and drives the city behind the hero.
  - `apps/web/components/DeviceStage.tsx` keeps every §5 requirement (`model: 'placeholder' | 'h-lynk-entry'`, `figure aria-label="H-Lynk device"`, static capture for no-script and reduced motion, slow idle yaw, pointer tilt of 8° or less, paused offscreen, mounted after LCP) and sits in its own section directly below the hero, before the starters.
  - The placeholder is the H-Lynk Core (canon #16): `hlynk.core.body` red, black scanner head with red emitters, a red fan of light upward, black antenna stub, dark bezel, black control row with a red-ringed trackpad.
- **Docs:** `screens/W01/03-direction.md`, `screens/W01/08-handoff.md`.

## Links

- `docs/design/hlynk/DIRECTION.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/design/screens/M01` … `M07` (`02-references.md`, `03-direction.md`, `04-components.md`, `06-critique.md`)
- Research: `docs/design/research/JOURNEY.md`, `PERSONAS.md`, `HALLWAY_TESTS.md`

## L1 — M04 takes two taps (decade, then year)

- **Date:** 2026-10-04
- **Decided by:** the lead, on design-director's D9

The brief asks for one tap. A native wheel always opens on a preset year, and FTC COPPA FAQ D.7 counts a preset as a default that can steer the answer (https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions). So M04 is decade-then-year: two taps, and no year is preselected. The age screen stays neutral, which matters more than the tap count.

## L2 — M01 boot route: restore for a signed-in fresh install, and three departures from the M01 handoff

- **Date:** 2026-10-04
- **Decided by:** the lead, on the `sim-core` report for M01 B2
- **Code:** `packages/core/sim/boot.ts`, `sim/onboarding.ts`, `sim/consent.ts`; ADR `docs/adr/0002-sim-core.md`

**Restore.** A player with a local session and no save on the device (a fresh install, a new phone) gets `{ kind: 'restore' }`, not M07. The server owns their Caller and Mons; the Bible's "a device session is a surface, not a new creature" rules out minting a second Caller. The app fetches `GET /v1/me/mons` and the Caller profile, writes the save, and calls `resolveBootRoute` again. `caller-name` (M07) is only for a session whose restored server profile has no Caller name.

What `sim-core` built that differs from `screens/M01/08-handoff.md` § Data:

1. **Signature and union.** `resolveBootRoute(snapshot: BootSnapshot)`, where the snapshot is `{ save, hasSession, ageAnswer, nowMs }`, replaces `(save, nowMs)`: the route also needs the session flag and the stored M04 answer. `readBootSave(raw)` builds `save` from the raw MMKV value (`missing` / `loaded` / `unreadable`). Beyond the handoff's six kinds, the union adds `restore`, `resume-onboarding` with `step: 'create-account' | 'guardian-consent' | 'caller-name' | 'egg-choice'`, and a `reason` on `save-recovered` for M22. `resume-onboarding` covers states the handoff left undefined: a Caller with no egg yet (M08), an age answer stored but no account (M03 create or M05), and a restored profile with no name (M07). The P1 guard runs inside it, so `create-account` is unreachable without a stored age answer, on boot as well as from M02 and M03 (`resolveCreateEntry`).
2. **`isConsentRequired({ birthYear, nowMs })`**, not `(birthYear, currentYear)` as M04 § Data writes it. It takes the UTC year of `nowMs`, the year the server sign-up hook uses, and throws on a non-integer year instead of returning false.
3. **`validateCallerName(raw, filter)`** takes the block list as a required second argument, so no build can call it without the M07 B4 filter wired. Reasons stay `'blank' | 'too-long' | 'characters' | 'blocked'`; `callerNameErrorCopyId(reason)` returns the matching `m07.error.*` id.

## L3 — deleting an account never deletes a Mon

- **Date:** 2026-10-04
- **Decided by:** the lead. The conflict came from the X1 collections (`1a48313`).

ADR 0001 said account deletion removes the Caller's Mons after the grace period. That breaks Law 8 and the "a Mon is not inventory" rule, and it contradicts canon Decision #15. So the rule is now this: after the 7-day grace, the Caller's personal data is deleted, and each Mon and egg passes into Dr. Santoro's care. Its `callerId` moves to a system sanctuary owner, its nickname is cleared, and its `monInstanceId` and history stay. Nothing is deleted. Decision #15 already does the same for a guardian's denial. The in-world presentation is TODO(canon).

## L4 — `monInstanceId` follows core

`monInstanceId = deriveMonInstanceId(eggId)`, as `@acme/core` defines it, and the collections enforce that. `eggId` is globally unique, so the id doesn't need the Caller. That also lets a merged account keep its Mons' ids. ADR 0001's `UUIDv5(callerId:eggId)` is superseded.

## L5 — a guardian's email is never edited

A corrected parent address means a new consent record. The old record stays as it was. Accepted from the X1 collections.
