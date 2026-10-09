# NYC-MON Gameplay Bible v12 — Full Build + Web Companion

**Status:** Canon authority for product/gameplay decisions made 2026-10-06. Supersedes conflicting gameplay language in earlier drafts. Lore/roster facts not changed here remain governed by v11 and later creator decisions.

## Product split

NYC-MON ships as one persistent product with different surfaces, not separate saves or separate games.

- **Native mobile/tablet:** full NYC-MON experience.
- **Web:** focused Tamagotchi-style Mon companion only.
- **XR/headsets:** later renderer/presence surface over the same persistent game state.
- **Backend:** one authoritative identity/state model. A Mon keeps the same stable instance ID, Caller bond, memories, personality, voice lineage, care state, progression and evolution across supported surfaces.

Web must never fork Mon state. Feed on web and the Mon is fed on mobile. Talk on web and that memory can matter later in the native game.

## Native navigation canon

Primary tab bar:

1. **HOME** — app entry point. The Caller chooses a path: continue Game, check active Mon, Stories, live/upcoming events, hatch/playdate/tournament reminders.
2. **GAME** — the playable NYC world. Exploration, encounters, quests, transit, Battle Grounds and battles happen here. Battle is a game state, never a separate tab.
3. **H-LYNK** — raised center action/device. Active Mon care plus Scan, Map, MTA, Calendar, Inventory, nearby Callers, Battle Ground context, Signals/EngineX and notifications.
4. **MONS** — species encyclopedia/discovery index. It answers “what is this Mon?” It is not the care screen.
5. **CALLER** — the player. Identity, avatar, LINK//GEAR, reputation, rankings, achievements, friends/rivals and battle history.

The user/player is the **Caller**. “Callah” is character voice/pronunciation, not a separate role.

## Web experience

The authenticated web companion opens directly into **Mon Space** at `/mon-space`, not the NYC world. This is separate from the public marketing site at `/` (W01 in `docs/phase-1-brief.md`), which keeps its hero, lore, and app-download/waitlist navigation.

Primary web loop:
**Hatch → Feed → Talk → Play → Care → Schedule → Bond → Train lightly → Observe evolution clues → Return later.**

Web supports:
- active bonded Mon
- egg/hatch timer and hatch sequence
- Feed / Talk / Play / Rest / Care
- mood, energy, fullness/hunger, social/bond state
- meals and care schedule
- notifications/reminders where browser/platform capability permits
- memories and recent moments
- move/evolution observation where appropriate
- Mon animations and voice
- Mon switching for Callers with multiple Mons
- account/device handoff

Web does **not** implement the full NYC renderer, open-world movement, world spawning, Battle Grounds, full competitive battles, MTA simulation or the full native H-Lynk tool suite.

The web companion should tease native-world consequences (“Ratti remembers Rucker”, scheduled event upcoming, etc.) without pretending the browser is the complete game.

## H-Lynk + Mon Space

On native, H-Lynk is the Caller's in-world device/interface. H-Lynk → Active Mon opens **Mon Space**, the same core relationship experience exposed directly on web.

Mon Space supports Feed, Talk, Play, Rest, Care, Train, Moves, Memories, Schedule and Evolution clues. Care is a core progression system, not a side minigame.

## Lifecycle and evolution

Preserve v11 lifecycle: **Egg → Baby → Small → Mid → Max**. Baby remains Baby until an authored evolution event.

Hatching supports 15m / 30m / 1h timers and a notification that deep-links into the hatch sequence.

Evolution is conditional, not level-only. Level establishes eligibility; authored paths may also depend on bond, care history, move mastery, battle experience, behavior, environment, time/location/story conditions and hidden requirements. Evolution preserves identity and memory.

## Progression

Separate progression axes:
- **Mon Level** — individual combat growth.
- **Move Mastery** — proficiency with learned techniques.
- **Bond / LINK** — relationship between this Caller and this Mon.
- **Evolution Potential** — conditions toward authored forms.
- **Caller reputation/rank** — player standing.
- **Battle Ground Rep** — venue-specific reputation.
- **Borough Rep** — standing in a borough.
- **NYC Rank** — competitive citywide standing.
- **Rivalry** — persistent history between recurring opponents.

Care, wins, close losses, training and meaningful battle events may progress different axes. Do not reward only easy wins.

## Match eligibility

Visible level is not sufficient to decide fairness. Matchmaking computes a server-owned **Battle Rating** from level, evolution stage, base stats, moves, eight-Affinity matchup (legacy ten-type fields excluded until an explicit canon migration map exists), condition and ruleset modifiers.

Canon examples:
- Lv 6 vs Lv 12: normally outside sanctioned eligibility.
- Lv 6 vs Lv 8: may be eligible, including when the Lv 6 Mon has a favorable Affinity/move matchup.

Story/boss rules may explicitly override sanctioned matchmaking.

## Combat law

Default hard rule:
- **Humans battle humans.**
- **Mons battle Mons.**

Normal Mon encounters never make a human physically attack a Mon.

### Caller combat

Human-v-human combat is a separate high-energy real-time fighting system. Callers can deploy cybernetic/power gear such as energy boxing gloves, power gloves and futuristic kick-boxing boots. Effects may be spectacular, but gameplay readability and authored balance win over visual noise.

### Ultimate Battle

Championship/arena **Ultimate Battles** intentionally combine the two disciplines without breaking the default combat law:

1. **Round 1 — Caller Battle:** human vs human.
2. **Round 2 — Mon Battle:** Mon vs Mon.
3. **Round 3 — Ultimate:** humans are the active fighters; a Mon can be called in via a dedicated assist input for a fast, authored sneak/assist attack against the opposing human, then exits. This is a special sanctioned championship ruleset, not normal human-vs-Mon combat.

## Encounter continuity

Before battle, capture an EncounterSnapshot containing world cell, Caller transform, camera, companions, enemy, time/weather, nearby entities, missions, transit state and deterministic encounter seed.

Session states:
**OVERWORLD → ENCOUNTER_PENDING → TRANSITIONING → BATTLE_ACTIVE → BATTLE_RESOLVING → WORLD_RESTORING → POST_BATTLE → OVERWORLD**

Never jump directly from active battle to overworld.

The local encounter freezes/locks as needed, but the living city continues. After battle, restore the Caller to the same world position/facing and reconcile elapsed world/transit state.

## Battle presentation

Preferred order:
1. **Street Battle** — find a valid nearby battle area and route combatants into it.
2. **Expanded Battle Space** — preserve the immediate location's identity while expanding playable space.
3. **Special Arena** — tournaments, bosses and authored story fights.

Entry/transition animation should have the excitement, anticipation and clarity associated with top creature-battle RPGs while remaining visually and mechanically original to NYC-MON/H-Lynk.

## Battle Grounds

NYC itself supplies competitive institutions:
- Rucker Park — legendary competitive court culture.
- Union Square / 14th Street — open challenge/social meetup culture.
- Washington Square Park — strategy-oriented culture.
- Coney Island — flashy seasonal competitions.
- Flushing Meadows–Corona Park — large Queens championships.
- Prospect Park — terrain/nature competitions.
- Borough-specific institutions feed qualifiers and eventually the NYC Championship.

Battle Grounds have local rules, schedules, reputation, divisions, NPC rosters, rewards and optional clearly marked sponsors.

## EngineX underground lore

Expand the Great Miscalculation lore with an underground fighting/technology subculture in abandoned or disused transit spaces. Callers discover illegal fights, hidden labs, old infrastructure and **EngineX humanoid robots** tied to the AI/robotics direction of the future city.

Robots are not Mons. Their existence should deepen the EngineX mystery and human technological arms race rather than replace Mon biology. Underground story content can reveal that EngineX's public story, eradication work, H-Lynk-era technology and later robotics programs are more connected than the city understands.

## Multiplayer authority

Use realtime collaboration/media only for the jobs they are good at:
- **Fishjam:** realtime voice/video/media session where enabled.
- **Yjs:** synchronized presence/UI/collaborative state where useful.
- **Authoritative battle service:** legal actions, HP, cooldowns, hit/outcome validation, rewards and competitive truth.

Never trust a client/Yjs document as authoritative damage/outcome state.

## Battle memories + dialogue

Persist structured BattleMemory: opponent, level, venue, outcome, damage, biggest hit, finishing move, blocks/dodges, critical moments, faint state, Caller commands and relationship changes.

Mon conversation consumes real history. A Mon can remember a close loss, a great combo, a recurring rival or a famous venue and reference it later.

## Replays / Stories

Competitive battles emit a structured event log. A Replay Director selects meaningful beats and reconstructs an approximately 60-second vertical highlight rather than requiring dumb full-session screen recording.

Highlights can include challenge, entrance, major attacks, perfect counters/dodges, comeback, ultimate/finisher, knockout, reaction and progression. Overlay facts must come from authoritative match data.

Stories are gameplay-derived social content: battle highlights, evolution, hatching, rare sightings, events and world activity. They are not a disconnected generic social feed.

## LiveOps + CMS

Payload is the live-ops control room. Authorized staff can create/edit/schedule battle events and cron-driven recurring Battle Ground programming without a client rebuild.

Event content can control venue, schedule/recurrence, division, ruleset, NPC roster, rewards, sponsor/ad campaign, local POI promotions and lifecycle status.

Commercial campaigns remain data-driven and addressable; never bake paid creative into world assets. Bunny hosts heavy media. Neon stores authoritative product/game data and analytics where designed.

## Local business layer

The living city, game city and local network coexist. Real local businesses can appear as clearly marked sponsored POIs/ad campaigns/events without pay-to-win advantage. Community inventory can support nonprofits, youth programs, neighborhood events, cultural institutions and small businesses.

## Full native build order

Build vertically, but target the complete native architecture:
1. shared identity/state + auth + Mon instance model
2. Mon Space/care/hatch/conversation/memory
3. final native shell and five-tab navigation
4. Mons encyclopedia + scan registration
5. NYC world streaming/rendering foundation
6. encounters + navigation/collision
7. Mon battle/progression/evolution
8. Caller combat + LINK//GEAR
9. Battle Grounds + events/live ops
10. multiplayer authority + Fishjam/Yjs integration
11. replay/Stories
12. EngineX underground content + robots
13. Ultimate Battle championship rules
14. XR handoff/rendering surfaces

Web ships only the shared Mon Space slice while consuming the same production state contracts.


## React Native UI + WebGPU/TypeGPU shader law

These are hard architecture rules for every NYC-MON product surface.

### React Native owns application UI

All product screens and reusable UI are authored in **React Native**. Browser delivery uses **React Native Web** from the same feature/component system.

Do not create parallel raw-HTML/CSS implementations of Home, Mon Space, H-Lynk, Mons, Caller, Stories, battle HUDs or other product screens. Platform-specific adapters are allowed only where a platform API requires them; they must not become a second UI architecture.

The web Tamagotchi experience renders the same shared Mon Space feature used by native H-Lynk → Active Mon.

### All shaders use WebGPU through TypeGPU

Every NYC-MON shader/effect path targets **WebGPU + TypeGPU**. Do not create CSS/WebGL/DOM effect duplicates as an alternate visual-effects implementation.

Canonical flow:

`React Native feature → typed NYC Effect component/API → TypeGPU → WebGPU → GPU surface`

Game-renderer flow:

`Three.js scene → @typegpu/three / TypeGPU → WebGPU`

Shader Effects Inc. `shader-effects-inc/shaders` is an approved source of visual references and, where license/provenance permits, compatible shader logic. External shader code must enter NYC-MON through the shared effects layer rather than being pasted/imported ad hoc into gameplay screens.

### Shared effects package

Create/maintain a shared package (target: `packages/effects`) that owns:
- typed effect registry and parameter schemas
- TypeGPU pipelines/bind groups/uniform contracts
- WGSL modules and provenance/license metadata
- React Native effect surfaces/components
- Three.js/@typegpu/three adapters for world rendering
- capability/performance tiers
- deterministic seeds/timing where replay capture requires them
- reduced-motion/accessibility variants
- cleanup/resource lifetime rules and tests

Initial semantic effects should include scanner/sweep, hologram, glitch/corruption, Mon aura/Affinity, hatch, evolution, impact/hit spark, LINK//GEAR energy, battle transition, weather/world atmosphere, Ultimate LINK and Story/replay transitions.

Feature code requests semantic effects such as `ScanEffect`, `EvolutionEffect` or `ImpactEffect`; it should not own loose WGSL strings.

Rive remains appropriate for authored interactive UI/character motion. When a Rive surface and a shader treatment are composed, the shader treatment still follows the WebGPU/TypeGPU effects pipeline rather than introducing a DOM/CSS effects layer.

## Non-negotiable product principle

**Raise one persistent Mon; never maintain a “web Mon” and a “game Mon.”** Care, conversation, battles, memories, evolution and device handoff are chapters in the same creature's life.
