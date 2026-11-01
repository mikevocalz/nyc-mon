# G02 Game lobby: research

Route: the Game tab (`apps/mobile/app/(drawer)/(tabs)/game.tsx`, feature `packages/app/features/game/GameScreen.tsx`). Shell: none (the lobby is a page, not H-Lynk chrome). States: new-game / eligible-save / resume-failed / leaderboard loading, ready, empty, stale, error, unavailable. Spec: Master Directive v2 §3, §8, §10, §13; canon Decision #23 (GAME owns exploration). Personas: `docs/design/research/PERSONAS.md`.

## Jobs to be done

- **Marcus (lapsed, 19):** When I open the Game tab after two weeks, I want one button that puts me back exactly where I was, so I never see a catch-up wall or a reset to spawn.
- **Dani (teen, 14):** When I open the Game tab, I want to see that this is NYC-Mon's city and where I stand, so it feels like my game and not a menu.
- **Sol (adult, 33):** When I open the lobby at night, I want it to read as a machined object with one clear action, so it feels like hardware I own.
- **Renée (guardian of Jayden, 11):** When my kid's name shows on a ranking, I want it to be the nickname only, so nothing public identifies him.

## Risks

- **Resume is the real job.** Directive §3 makes exact-coordinate restoration P0: START must land the Caller at the last durably saved coordinates, heading and camera, never spawn, never district centre. The lobby's START is a promise; if `WorldResumeService` (§13) cannot keep it, the lobby must say so before the world loads, not after a visible teleport.
- **No ranking authority exists.** `packages/app/features/game/` holds no ranking code and no server contract defines one. Canon names the concepts (`docs/canon/GAMEPLAY_BIBLE_V12.md` lines 73-76: "Caller reputation/rank", "Borough Rep", "NYC Rank — competitive citywide standing") but no scoring rule, so the leaderboard ships with honest `unavailable` and `empty` states. Any filled row before a server boundary exists is invented canon (Law 1) and a fake record (§3).
- **Pressure patterns.** Promotion zones, countdowns and locked-but-visible rows (Duolingo, LinkedIn references in `02-references.md`) are appointment mechanics. `docs/COPY_DECK.md` Tone bans them and Zagal et al. (https://www.diva-portal.org/smash/get/diva2:1043332/FULLTEXT01.pdf) names the pattern.
- **Minor privacy.** Public rows for under-13 Callers show the Caller name from M07 (a nickname) and nothing else (§3 "minor-safety and privacy rules"). No photo avatar, no borough of residence, no real name.
- **Two STARTs.** Lobby START (enter or resume) and the in-game pill (pause, resume, stop) are separate controls with separate contracts (§3). Copy must never let "Resume" on the pill and "Continue your game" on the lobby read as the same action.
- **Lobby render loop.** The Rive lobby must not keep a full-speed loop alive once gameplay starts (§3). The world canvas is paused, on-demand rendering (`GameScreen.tsx` header); a lobby that keeps ticking behind it would cost the battery the game saved.
- **Reduced motion.** The energy trace on START and the panel entrance need authored siblings (CONTRIBUTING.md standing standards), never a sped-up or stopped copy.
- **Web.** `GameScreen.tsx` says "apps/web never mounts it". The lobby on web therefore cannot lead into gameplay; what START does there is open (see `08-handoff.md` § Route and intent).

## Usability questions

1. On a returning open, does Marcus read "Continue your game" plus "Last seen in Harlem" as "nothing was lost" within 3 seconds?
2. With the leaderboard in `unavailable`, do first-time players read "Rankings aren't live yet" as honest, or as broken?
3. Does the uppercase START legend read as a machined control (intended) or as a shouting button (DESIGN_SYSTEM says no all-caps)?
4. When resume fails (incompatible dataset), do players pick "Start from your last district" over "Start a new game" without reading twice?
5. On a foldable in tabletop posture, do players find START on the lower half without hunting?
