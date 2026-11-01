# Mon screen vs. virtual-pet canon: what we have, what canon allows

Lane 2 of 3, research for a "nostalgic but futuristic" take on the Mon screen. Read-only audit of `main` on 2026-10-29. Paths are repo-relative. Line numbers are as of that date.

Sources read directly: `packages/core/sim/*`, `packages/core/schemas/{care,egg,lifecycle,evolution,notification}.ts`, `packages/app/features/companion/{DexProfileScreen,HomeScreen,home-model,care-shared,glass}.tsx?`, `packages/ui/three/hlynk/glass-screen.ts`, `CONTRIBUTING.md`, `docs/canon/*` (the v11 `.docx` converted to text with `textutil`; paragraph numbers below are the `V11 ¶n` numbering the repo already uses where one exists, otherwise a quote), `docs/design/DECISIONS.md` D-15/D-16. Two research agents swept the MCP server, notifications, the H-Lynk 3D device and `docs/design/screens/*`; I spot-checked their key citations (MCP `SKILL.md:223`, schedule reminders, LED tokens, M13/M17 no-lists, Mobbin addendum) and they held. Agent-sourced rows are marked (a).

## 0. The route is not the care screen

`/mon/:id` resolves to the Dex profile, not to the Tamagotchi loop.

- `apps/mobile/app/(home)/mon/[id].tsx:1-4` re-exports `DexProfileScreen`: "M17 Dex entry for one of the Caller's Mons (`id` = monInstanceId)."
- M17 is specced with no H-Lynk chrome: `docs/design/screens/M17/03-direction.md:3` ("Shell: none") and `docs/design/hlynk/DIRECTION.md:34` (M17, M18 chrome "Never").
- The code already departs from that spec: when the 3D H-Lynk is on, `DexProfileScreen.tsx:150-176` renders the Dex inside `GlassStage` (the device), with home/back keys.
- The care loop is M13 Home `/(home)` (`HomeIndexScreen` → `HomeScreen.tsx`), M14 Feed, M15 Rest, M16 Social (Peek), M18 Journal.

So "make the Mon screen feel like a Tamagotchi" is a decision about M13–M16 (and maybe merging M17 into it), and it reopens M17's "Shell: none" ruling. Canon v12 calls the target surface **Mon Space**: "H-Lynk → Active Mon opens **Mon Space**" (`docs/canon/GAMEPLAY_BIBLE_V12.md:54`). No `mon-space` route exists in `apps/mobile/app` or `packages/app` today.

## 1. Inventory: the current Mon experience

### 1.1 Screens

| Screen | Route / file | What it shows now |
|---|---|---|
| M17 Dex (the `/mon/:id` route) | `DexProfileScreen.tsx:105-225` | 2D: portrait, Dex plate, form plate, Bloodline, `LifecycleTrack` (reached forms named, later stages blank, `:37-44`), Name / Hatched / Caller facts. 3D: same facts as glass lines, life track as `Egg › [Baby] › ? › ? › ?` (`:120-123`), one Back action. Writes nothing. No meters, no care. |
| M13 Home | `HomeScreen.tsx` | Three `CareMeterRing`s (`:151-171`), status chip, care bar Feed / Rest-or-Wake / Play / Dex (`:192-205`, glass `:231-236`); the action that answers the Mon's ask is drawn primary (`:217`). Menu: Switch or Dex, Journal, Settings, Close (`:219-226`). Trackpad tap = "answer the ask" (`:143-147`, `home-model.ts:21-28`); trackpad drag pans the room ±0.3 (`home-model.ts:89-97`). |
| M14 Feed | `FeedScreen.tsx` | One action, "Share a meal" (no foods, D-15e). |
| M15 Rest | `RestScreen.tsx` | Manual sleep; hold to wake; early-wake cost stated before waking (`:130`, `:169-170`). Night scheme while asleep (`HomeScreen.tsx:85`). |
| M16 Social | `SocialScreen.tsx` | Peek: Mon hides behind one of three spots; no score (`core/sim/play.ts:3-22`). |
| M18 Journal | `JournalScreen.tsx` | Days together (only rises), care log (`core/sim/journal.ts:86-97`). |
| M10/M11/M12 | `egg/IncubateScreen.tsx`, `hatch/IncubatingScreen.tsx`, `/(home)/hatch` | 15/30/60 min incubation, "Keep it warm" tap (nudge only, no sim effect), atomic hatch. |

### 1.2 Sim core mechanics, with real-time rates

All numbers come from `packages/core/sim/tuning.ts:69-100`, flagged in the file itself as "interim Phase-1 tuning (D-15d)" and `TODO(canon)` against Q19–Q25. Meters are 0..1. Hours are wall-clock; the sim is pure and advanced on read (`care.ts:112-148`), re-read every minute and on foreground (a, `minute-clock.ts:36-63`, `care-shared.ts:21-27`).

| Mechanic | Code | Rate / rule | How it shows |
|---|---|---|---|
| Meters: Energy, Fullness, Social. "No more." | `schemas/care.ts:4-5`, `:24-38` | Three only. No HP, health, sickness or death field (`care.ts:20-23`, "Law 8"). | Three rings on M13. |
| Fullness decay (awake) | `tuning.ts:72` | Linear −0.05/h (5%/h). Hatchling starts at 0.5 (`:100`): food request at 2 h, needs-you at 5 h. From full: request at 12 h, needs-you at 15 h. | Ring; chip "Asking for food". |
| Fullness decay (asleep) | `tuning.ts:76` | −0.025/h. | — |
| Energy decay (awake) | `tuning.ts:71` | Linear −0.0625/h. From full to needs-you (0.25) in 12 h. | Ring; chip "Needs rest". |
| Social decay | `tuning.ts:73`, `:77` | Exponential, half-life 12 h awake, 36 h asleep. Hatchling 0.6 → needs-you in ~15 h; from 1.0 in 24 h. | Ring; chip "Wants to play". |
| Return floor | `tuning.ts:79`, `care.ts:14-25` | Decay never takes a meter below 0.2. A Mon left for a week shows three low meters and a food request, nothing worse. | Low rings. |
| Food request (the only autonomous "call") | `care.ts:44-51`, `:86-96`; `schemas/care.ts:14-18` | Awake and Fullness < 0.4 → `pendingRequest {need:'fullness'}`, event `food-requested`. Cleared by any feed. | Chip "Asking for food"; Feed becomes primary; LED `needsYou`. |
| Needs-you threshold | `tuning.ts:82`, `care.ts:83-85`, `:294-297` | Any meter < 0.25 → `needs-attention` event, `listUnmetNeeds`. | Ring low notch; chip "Needs you: {list}" (`home-model.ts:40-43`); LED. |
| Feed ("Share a meal") | `care.ts:199-222`, `tuning.ts:84-86` | +0.35 Fullness, +0.044 Energy, bond +0.005 (+0.01 more if answering a request). Declines if asleep or sluggish. | M14; Mon eat clip. |
| Overfeed → sluggish | `care.ts:204-207`, `:275-277`; `tuning.ts:83`, `:87-88` | Feeding when Fullness > 0.65 (so the meal would pass 1.0) → sluggish 45 min; Energy drains 2× and feeds are declined meanwhile. Never sick (`schemas/care.ts:35`). | Chip "Full and slow"; M14 warns before ("Another meal now makes {name} slow for a while", `copy.ts:51`). |
| Sleep (manual "lights off") | `care.ts:223-230`, `:120-128` | Rest any time. Energy +0.333/h asleep (empty → full in 3 h). Auto-wakes at full Energy (event `woke`, cause `rested`). | M15 night lighting; status "Asleep". |
| Wake early | `care.ts:231-237`, `tuning.ts:89-90` | Waking with Energy < 0.6 costs 0.05 Social. | Cost line shown before the hold (`RestScreen.tsx:169-170`). |
| Play (Peek) | `care.ts:238-253`, `tuning.ts:93-96`, `play.ts:18-22` | Social +0.3×q, bond +0.02×q, Energy −0.1; needs Energy ≥ 0.1. q = 0.6 + 0.4 × first-try finds / rounds. | M16 Peek; result line never varies. |
| Mood | `scene-input.ts:23-31` | Derived: asleep > sluggish > needs-fullness > needs-energy > needs-social > content. | Status chip + animation intent. |
| Bond | `mons` record; `care.ts:205`, `:243` | Hidden 0..1 counter, grows only. Gates evolution (`evolution.ts:34`). | Not shown anywhere (D-15i; M17 critique X-1 "a bar becomes a grind target"). |
| Idle vignettes | `vignettes.ts:23-24`, `step.ts:23-32` | 15 s slots, 60% fire chance, weighted by bond. | **Inert**: every species ships `idleVignettes: []` (`packages/content/mons/define.ts:48`), and no app code calls `step()`. |
| Egg incubation | `schemas/egg.ts:5-8`, `hatch.ts:35-41` | 15, 30 or 60 min. No effect from length. "Keep it warm" taps change nothing. | M11 timer ring, LED breathes (4 s). |
| Hatch | `hatch.ts:99-150` | Atomic state machine incubating → ready → presenting → hatched; id derived from egg id (`:19-21`). Care starts at hatch completion (D-15f). | M12 sequence; hatch-ready notification. |
| Life stages | `schemas/lifecycle.ts:4`, `evolution.ts:10-36` | Egg → Baby → Small → Mid → Max. `applyEvolution` exists but `PHASE1_FEATURE_FLAGS.evolutionEnabled = false` (`:8`), zero `EvolutionEvent`s ship. Only condition modelled: `minBond` (`schemas/evolution.ts:16-17`). | M17 life track, later slots unnamed. |
| Age | `mintMonInstance` `hatch.ts:59`; `journal.ts:86-97` | `hatchedAt` and "days together" (distinct local days with a journal entry). No age stat, no age-driven change. `schemas/age.ts` is the Caller's birth year, not the Mon's. | M17 "Hatched" date; M18 days count. |
| Weight, hygiene, sickness, discipline, care mistakes, death | — | Not modelled. | — |

### 1.3 Alexa+ / MCP care tools (a)

No classic Alexa skill exists; Alexa+ uses the MCP server, `packages/mcp-server/src/mcp/tools.ts`.

- `feed_mon`, `rest_mon`, `wake_mon`, `play_with_mon` (`tools.ts:501-543`) all route through `runCare` (`:297-345`), which calls the same `applyCareAction` and returns `applied:false, declinedBecause` without writing on a predicted decline. Play defaults to `quality: 0.5` (below Peek's 0.6 floor).
- Reads: `get_mon_status`, `check_on_mon` (adds `suggestedCare`, `:260-268`), `check_incubation`, `hatch_egg`, `talk_to_mon`.
- Linked adults only (`:93-97`). Card buttons call the same tools (`src/ui/actions.ts:19-26`).
- The agent skill forbids proactive calls: "No 'come back soon', no reminders." (`skills/nyc-mon-companion/SKILL.md:223`, verified).

### 1.4 Notifications and attention calls

- **Hatch-ready is the only care-loop push.** `schemas/notification.ts:5-16`, scheduled as a DATE trigger at `incubationEndsAt`, one per egg (a, `onboarding/notify-permission.native.ts:63-89`). Copy: "Your egg is ready to hatch" / "Open NYC-MON whenever you're ready." D-15c: "No care push notifications in Phase 1 … A dark LED means nothing to report." (`docs/design/DECISIONS.md:168`).
- **Contradiction found:** the Schedule feature schedules DAILY local notifications "Breakfast/Lunch/Dinner time for {monName}" / "Your Mon is ready to eat." (`packages/app/features/schedule/event-integrations.native.ts:85-89`, `:124`, verified). That is a care reminder, against D-15c and M06's "No care reminders promised". The only route the agent found for it is web.
- **In-app attention call:** the H-Lynk LED `needsYou` when a food request is open or any meter is under 0.25 (`care-shared.ts:30-35`, verified): three 150 ms blinks every 10 s; reduced motion is a steady exclamation dot (`packages/theme/tokens.ts:672-676`, verified). Always paired with the chip text (COPY_DECK `:67`).
- **Return greeting:** after ≥ 60 s away, polite announcement, `approach` clip, one Mon line (a, `HomeScreen.tsx:114-124`).
- **Sound:** a synthesized two-tone Nextel-style chirp, square waves at 1450 Hz then 1830 Hz (a, `chirp-core.ts:27-57`), played only on the left side key and muted by Settings. Hatch synth with a C6-E6-G6 chime (a, `three/mon/hatch-sound.ts:5-9`). No care beeps, no attention beep.

### 1.5 The H-Lynk device as built (a)

- A red plastic handheld (`device-geometry.ts:37`, `device-scene.ts:965-1086`): black scanner head with lens and two red emitters, a red light fan, stub antenna, 9×2 speaker grille.
- Screen is a 768×1024 canvas (4:5), not 3:4 (`hud.ts:87`).
- Front row: home, menu, `<`, `>` keys plus a square trackpad. Right edge: volume ± and power (decorative). Left edge: one long action key (chirp). No physical back.
- **Glass look:** smooth navy gradient, `hud` tokens (amber, green, cyan, red), body-font text, real 3D GLB on the glass. No LCD, dot-matrix, scanline or pixel code anywhere in `packages/ui/three/hlynk`. A pixel font exists only for city signage (`packages/app/features/game/world/pixel-font.ts`).
- **The 3D glass rings break the M13 spec.** `glass-screen.ts:156` strokes a low ring `hud.red`; `:164` draws `Math.round(value * 100)` inside each ring; `glass.tsx:31` gives each need its own tint (amber, green, cyan). M13 says "No numbers on the rings", "No danger red on meters" (`M13/03-direction.md:68`, `:72`) and "One fill colour for all three rings" (`:54`). The 2D `CareMeterRing` path follows the spec; the 3D path does not.

## 2. Canon and design rules

Authority order in this repo: v11 Bible and dated creator decisions are canon (Law 1, `CONTRIBUTING.md:7`); Gameplay Bible v12 supersedes conflicting gameplay language (`GAMEPLAY_BIBLE_V12.md:3`); v7 numbers quoted in `STARTERS_EXTRACT.md` are labelled by v7 itself as "original proposals" (`STARTERS_EXTRACT.md:504`), so they are input, not canon. Design calls (D-15, D-16, screen no-lists) are product decisions the lead made and can revisit.

### 2.1 Canon requires

- **Three meters.** "Energy, Fullness and one Social HP/social-need meter remain the core care model. Mons can request food." (v11 "Care needs", quoted at `STARTERS_EXTRACT.md:496`.) The UI label for Social vs "Social HP" is open (Q18, `OPEN_QUESTIONS.md:72`).
- **Lifecycle** Egg → Baby → Small → Mid → Max; "A newly hatched Mon stays Baby until an authored evolution event." (v11 "Lifecycle"; `GAMEPLAY_BIBLE_V12.md:60`; Law 7, `CONTRIBUTING.md:13`.)
- **Incubation** 15 / 30 / 60 min and a notification that opens the hatch (v11 "Incubation and notification"; `GAMEPLAY_BIBLE_V12.md:62`).
- **Evolution is conditional:** "Level establishes eligibility; authored paths may also depend on bond, care history, move mastery, battle experience, behavior, environment, time/location/story conditions and hidden requirements. Evolution preserves identity and memory." (`GAMEPLAY_BIBLE_V12.md:64`.) Max branches: a Mid evolves into exactly one of three Max forms (`DECISIONS.md:207`, Decision 12). "Personality/Bond can influence branching evolution." (v11, combat section.)
- **Mon Space verbs:** "Feed, Talk, Play, Rest, Care, Train, Moves, Memories, Schedule and Evolution clues. Care is a core progression system, not a side minigame." (`GAMEPLAY_BIBLE_V12.md:56`.) Web loop: "Hatch → Feed → Talk → Play → Care → Schedule → Bond → Train lightly → Observe evolution clues → Return later." (`:33`.) Web also lists "mood, energy, fullness/hunger, social/bond state", "meals and care schedule", "notifications/reminders where browser/platform capability permits" (`:38-41`).
- **One Mon everywhere:** "Raise one persistent Mon; never maintain a 'web Mon' and a 'game Mon.'" (`GAMEPLAY_BIBLE_V12.md:253`.)
- **Language:** "`H-Lynk`, never 'device' in UI copy"; `Caller`, never owner/player (Law 9, `CONTRIBUTING.md:15`).

### 2.2 Canon forbids

- **Death.** "Standard gameplay does not treat fainting as literal death or convert a defeated Mon back into an egg." (v11 "Standard battle defeat".) "Faint: Standard recoverable 0-HP battle state; not literal death." (v11 glossary.) Law 8: "Faint is never death. No code path converts a Mon to an egg or deletes an instance" (`CONTRIBUTING.md:14`). COPY_DECK bans "dead, died, killed (a Mon)" (`docs/COPY_DECK.md:32`) and "A Mon is never shown deleted, hurt or abandoned" (`:59`).
- **Device-as-owner.** "H-Lynk … is not proof of ownership, personhood or partnership." "H-Lynk containment is not consent. A partnership is social and relational, not a device flag." (v11; Decision 8, `DECISIONS.md:143`: no bond state on the device, "no copy implies the device owns or controls the Mon".)
- **Losing the Mon.** Even when a guardian refuses consent, the Mon "is never deleted on screen and never turned back into an egg" (`DECISIONS.md:240`, Decision 15).

The v11 Bible does not itself mention sickness, poop, discipline, neglect penalties or care mistakes. The bans on those come from v7's proposal text and from the design layer, below.

### 2.3 Proposal-tier and design-tier bans (not v11 canon, but binding until revisited)

- v7, quoted as proposal: "not a checklist that punishes the owner" (`STARTERS_EXTRACT.md:504`); "A low bar never causes permanent death, loss of a paid item or creature deletion." (`:510`); "Below 20 intensifies the **in-app** prompt, not a guilt alarm." (`:530`); "No irreversible neglect state, missed-evolution punishment or paid rescue." (`:536`); Egg: "No distress animation implies harm when the owner is away." (`:200`).
- D-15a: no streaks; missed days look like future days (`docs/design/DECISIONS.md:166`). D-15c: no care pushes (`:168`). D-15d: interim tuning so "needs-you is not the normal state" (`:169`).
- M13 no-list: no "while you were away" tally, no sad face, no "neglected", no numbers on rings, no care push, no level number, no danger red (`M13/03-direction.md:67-72`). M14: overfeed is "Never a sick or hurt pose", "The word 'sick' never appears" (a, `M14/03-direction.md:41`, `M14/05-copy.md:26`). M15: no countdown, no guilt modal (a, `M15/03-direction.md:56-59`). M16: no score, no sad reaction (a). M18: never log needs-attention or absence (a).
- Retro styling: the site research rejected "Wild pixel marquee / pixel field" and "Shader CRT boot screen" as "retro-pixel … styling that fights the daylit signage system" (`docs/design/site/research/MOBBIN_2026-10_ADDENDUM.md:214`, verified). That ruling is scoped to the marketing site, not the H-Lynk glass.
- The brief names the lineage it wants: "Bandai WIZ virtual-pet design tier (Tamagotchi, 1996– ; 'care is the game')" (`docs/phase-1-brief.md:69`), and the nostalgic-adult persona says "I grew up with a Tamagotchi on my keychain. I want the grown version, and I want it to look like my city." (`docs/design/research/PERSONAS.md:129`). The site audit warns it "must never read as … 'a Tamagotchi re-theme'" (a, `PREMIUM_SITE_AUDIT.md:62`).

### 2.4 Open (needs Mike)

| Q | Topic | File:line |
|---|---|---|
| Q18 | Social vs "Social HP" label | `OPEN_QUESTIONS.md:72` |
| Q19 | Care numbers (v7: start 80; −1/−2/−1 per h; sleep +10/h; meal 40/5) | `:74` |
| Q20 | Needs threshold (v7: icon < 40, stronger < 20, clear at 50 hysteresis) | `:76` |
| Q21 | Absence: vacation mode, free sitter after 24 h, floor 35 on return | `:78` |
| Q22–Q24 | Food classes, Baby portions, favorites | `:80-84` |
| Q25 | Sleep: scheduled 8 h window vs manual; early-wake cost | `:86` |
| Q26 | Bond visible or hidden | `:88` |
| Q27 | Does incubation length matter | `:90` |
| Q31, Q32 | Baby refusal cue; species sounds vs baby-talk | `:100-102` |
| Q41 | The tier sheet's HP meter: fourth stat or Social HP | `:141` |
| Q42 | Sheet labels DEX / CREW / CARE / BAG / CITY, "CALL MON" | `:142` |
| Q43 | What triggers each stage change, and what picks the Max branch | `:152` |

### 2.5 The H-Lynk in canon: the device metaphor already has a home

- v11: "H-Lynk ('Hood Link') is an optional communication/care/recovery device." Hardware: "a slim 3:4-screen handheld with a central tactile trackpad/control, two buttons on each side, rear L/R controls, right-side volume/power, left-side action control, a top antenna and a separate red scanner/emitter. The backplate reads H-Lynk. Entry, Mid and Pro tiers differ in materials and sensor/camera sophistication; Entry is plastic and Pro is the most premium."
- Decision 8: the app is framed as an H-Lynk Entry unit that Dr. Santoro hands the Caller (`DECISIONS.md:137-143`). Decision 16: tiers are H-Lynk Core (matte red plastic, 1 lens), H-Lynk (charcoal, 2 lenses), H-Lynk Pro (white/silver, 3 lenses); the app chrome is the Core (`:252-265`). Decision 7: the scanner LED is red (`:135`).
- v12 makes H-LYNK the raised centre tab: "Active Mon care plus Scan, Map, MTA, Calendar, Inventory, nearby Callers, Battle Ground context, Signals/EngineX and notifications." (`GAMEPLAY_BIBLE_V12.md:22`.)
- The creator's sheet shows "Lv. 12", HP/Energy/Fullness/Social meters, "CALL MON", DEX/CREW/CARE/BAG/CITY tabs, which are "concept text, not canon" (`DECISIONS.md:267`).
- Divergences between the built device and canon: the glass is 4:5, canon says 3:4; canon has "two buttons on each side" and rear L/R, the model has one left key, volume ± and power on the right, and four front keys. Neither is flagged in `docs/design/hlynk/DIRECTION.md`.

So canon gives us a handheld, a trackpad, side buttons, a red status light and a chirp-capable speaker. A Tamagotchi-style frame lives inside the H-Lynk without inventing hardware. What canon blocks is the device owning or containing the Mon, so the Mon should read as present with the Caller (the 3D model on the glass, the room) and never "inside" the H-Lynk.

## 3. Gap table: classic virtual-pet semantics vs. NYC-MON

Status key: **Have**, **Partial**, **Missing** (nothing blocks it), **Blocked-design** (a design/proposal-tier rule forbids it; revisitable), **Canon-forbidden** (v11 or a creator decision forbids it).

| Classic semantic | Status | Evidence | Notes for the nostalgic take |
|---|---|---|---|
| Hunger / happy hearts | **Have** (as rings) | Fullness and Social rings, `HomeScreen.tsx:151-171`; `schemas/care.ts:4-5` | Three meters is canon. Hearts as a glyph are free; numbers on rings are Blocked-design (M13 `:68`), and the 3D glass currently draws numbers anyway. |
| Discipline meter / scolding | **Missing**, canon tension | No code. v11: Mons "can think … disagree, refuse, choose relationships"; partnership "not a device flag" | A discipline stat would add a fourth meter (blocked by the three-meter rule) and frame the Caller as controlling the Mon. Bond already plays the "how well you raised it" role. |
| Attention call (beep + icon when it wants something) | **Partial** | LED `needsYou` 3 blinks/10 s (`tokens.ts:672-676`), chip text, food request (`care.ts:44-51`). No sound. No push (D-15c). | An in-app chirp when the H-Lynk is open and the Mon asks is not banned by any rule found; a push is. |
| Care mistakes (ignored calls count against you) | **Blocked-design** | v7 "No irreversible neglect state, missed-evolution punishment" (`STARTERS_EXTRACT.md:536`); M18 never logs needs-attention (a) | v12 allows evolution to read "care history" (`:64`), so positive care history can matter. Counting misses cannot. |
| Poop and cleaning | **Missing**, blocked by three-meter rule | No hit in any doc. `schemas/care.ts:4` "No more." | Would need a creator decision (Law 1). A non-meter tidy-up vignette is a softer route. |
| Sickness and medicine | **Blocked-design** | `schemas/care.ts:20-23` "no HP, health, sickness or death field (Law 8)"; M14 "sick" banned | v11 mentions a "Mon-trauma nurse" and recovery for combat, so recovery exists in the world, but only after battle faint (Phase 2). |
| Lights-off sleep | **Have** | `care.ts:223-237`; M15 night lighting; auto-wake at full Energy (`:120-128`) | Manual sleep only; a scheduled sleep window is open (Q25). |
| Weight | **Missing** | Not modelled; no canon | Overfeed → sluggish (`care.ts:204-207`) is the only "too much food" consequence. Weight would be a new stat (Law 1). |
| Age | **Partial** | `hatchedAt` (`hatch.ts:59`), days together (`journal.ts:86-97`) | No age-in-days display on the device and no age effect. Days together is a candidate "age" readout that only rises. |
| Egg → Baby | **Have** | `hatch.ts`; 15/30/60 min (`schemas/egg.ts:6`) | Canon-required. |
| Baby → Small → Mid → Max | **Partial** (schema only) | `evolution.ts:8` flag off; 0 runnable events (`CONTENT_SYNC_V11_1.md:27`) | Law 7 needs authored `EvolutionEvent`s; triggers are Q43. |
| Evolution branching on care quality | **Partial**, canon-allowed | v12 `:64` (bond, care history); Decision 12 Max branches; `schemas/evolution.ts:16-17` only `minBond` | The strongest canon-backed vpet hook we have. Branch rules are open (Q43). |
| 3-button input (A select / B confirm / C cancel) | **Partial** | `<` `>` keys, trackpad, menu, home (a, `stage-state.ts:46`); no physical back | Prev/next + trackpad maps cleanly onto A/B; canon's side buttons and rear L/R are unmodelled. |
| LCD / pixel look | **Missing** | No LCD or dot-matrix code in `packages/ui/three/hlynk`; site-only rejection at `MOBBIN_2026-10_ADDENDUM.md:214` | Nothing in canon or the H-Lynk spec bans a pixel layer on the glass. DIRECTION.md describes a full-colour screen, so it is a design change, not a canon one. |
| Beeps and jingles | **Partial** | Side-key chirp (`chirp-core.ts:27-57`), hatch chime (`hatch-sound.ts:5-9`) | No care beeps; Settings Sound covers chirps (COPY_DECK `:647`). Baby voice is species sounds only (Q32). |
| Generations / new egg | **Missing**, and the classic version is Canon-forbidden | One egg per Caller (D-16e, `docs/design/DECISIONS.md:186`); Decision 18 allows two Mons only via account merge | Classic generations start with death or departure; canon forbids death and egg reset. A second egg without loss of the first is open. |
| Pause | **Missing** | Return floor 0.2 (`tuning.ts:79`) is the only absence protection; vacation mode and sitter are Q21 | v7 proposes vacation mode + free sitter + floor 35. |
| Death / leaving / "angel" | **Canon-forbidden** | v11 faint ≠ death; Law 8; Decision 15; COPY_DECK `:32`, `:59` | — |

## 4. Ten findings that matter most

1. `/mon/:id` is the M17 Dex, specced with "Shell: none". The care loop is M13–M16 at `/(home)`. Canon v12 calls the target **Mon Space**, which no route implements yet.
2. The sim already has the vpet skeleton: three decaying meters, an autonomous food request, manual lights-off sleep with auto-wake, an overfeed consequence and a hidden bond. Rates are interim (`tuning.ts:69-97`, all `TODO(canon)`).
3. Death is canon-forbidden (v11, Law 8, Decision 15). The worst neglect can do is three meters at 0.2 plus a food request.
4. Sickness, poop, discipline, care mistakes and weight are absent from v11 entirely. Their bans come from v7 proposals, the three-meter rule and design no-lists, so Mike can revisit them, but each needs a dated creator decision under Law 1.
5. Branching evolution on care is canon-allowed (v12 `:64`, Decision 12) and is the best canon hook for "how you raised it". The trigger and branch rules are Q43, and evolution is flagged off with zero events.
6. The H-Lynk is canon hardware, an in-world handheld with trackpad, side buttons and red status light. It is the natural frame for the device metaphor, with one constraint: it never owns, contains or controls the Mon (Decision 8).
7. The built H-Lynk diverges from canon: 4:5 glass vs canon 3:4, and a key layout that does not match "two buttons on each side, rear L/R".
8. No LCD or pixel aesthetic exists anywhere on the device, and no rule bans one there. The only retro-pixel rejection is scoped to the marketing site.
9. The 3D glass rings violate M13: they draw a percent number, turn red when low and use three tints (`glass-screen.ts:156`, `:164`; `glass.tsx:31`). The 2D rings follow the spec.
10. Attention calls are in-app only (LED, chip, return greeting). D-15c strikes care pushes, but `schedule/event-integrations.native.ts:85-89` schedules daily "Breakfast time for {monName}" notifications, which contradicts it. Idle vignettes, the "never a statue" mechanism, ship empty (`content/mons/define.ts:48`) and `step()` is never called by the app.
