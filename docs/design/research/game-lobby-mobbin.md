# Game lobby: Mobbin reference audit

Owner: Lane A (Research and Design Director), Master Directive v2 §12. Written 2026-10-15 for G02 (Game Lobby, leaderboard, resume). Companion audit: `arcade-controller-mobbin.md`.

Method: Mobbin MCP searches on iOS, 2026-10-15, for game lobbies, leaderboards (loading, empty, stale, locked), resume and continue flows, and pause overlays. Each screenshot was downloaded at full resolution (`scratchpad/mobbin/*.webp`) and viewed before writing. Nothing is described from metadata. References inform hierarchy and states, never pixels.

The directive's hierarchy (identity → leaderboard → resume status → START) and its honesty rule (no ranking authority exists yet, so no fake records) decide what each reference is allowed to teach. Mobbin's leaderboards are mostly engagement machinery, so the rejections below are as useful as the takes.

## Audit

### 1. Deezer: own rank pinned under the top three

- URL: https://mobbin.com/screens/1ffcf774-12cc-4587-adf0-5b16c8dfc2ce · App: Deezer
- Shows: a purple header with a pink "412 pts" plate and "Your best score is: 412"; a dark panel with a crown row "#19307 Of 34891 players"; three rows with 1, 2, 3 badges on avatars; a white highlighted row for the player ("jdoe.mobbin1 #19307 412 pts"); then "Hide", "Challenge a friend", "Play again".
- Pattern: top three, then the player's own row pinned and highlighted, with a one-line "n of N" statement.
- Strength: the player's standing is readable without scrolling, and the own row is the only light surface on the panel.
- Weakness: three CTAs under the board compete; the own row shows "#19307" twice.
- Application: `LeaderboardPanel` shows at most three rows plus the own-rank row in compact portrait, and the lobby keeps one CTA (START). The own row is the `isSelf` highlight with a `carolina-500` edge on the ink face.

### 2. Duolingo: league with a promotion zone

- URL: https://mobbin.com/screens/3ca570fe-9e97-4e65-85eb-3e544a7eacab · App: Duolingo
- Shows: "Sapphire League, 1 DAY"; a carousel of trophies; rank 8 "Nam Tran 124 XP"; a green "PROMOTION ZONE" divider; ranks 9–13 with avatars and flags; the player at 12 highlighted grey; a "+720 XP" badge.
- Pattern: ranked rows with a divider that explains a cut-off; the own row highlighted in place.
- Strength: the divider sits in the list, not in a legend, so the rule is visible where it bites.
- Weakness: the whole thing is appointment pressure: a timer, a promotion threshold, a "+720" tease. CONTRIBUTING.md Law 9 is not touched, but COPY_DECK's "No pressure" rule and the directive's "no invented tournaments" rule both reject it.
- Application: reject the league, the timer and the zone. Keep one idea: when a rule exists (none does today) it is shown in the list where it applies, as one line.

### 3. Tonal: what the ranking measures, in one sentence

- URL: https://mobbin.com/screens/89c89a39-f3ab-4003-b914-88bd6459be5d · App: Tonal
- Shows: "69,905 of 79,667 participants", the word "LEADERBOARD", a sentence "Ranked by the number of workout days and workout time in the last 30 days.", column heads DAYS / TIME, the own row highlighted green with "69,905" on its avatar, neighbours with the same values ("1" day, "40m").
- Pattern: the ranking's definition is printed above the list; the own rank is both a number and a highlighted row.
- Strength: no mystery metric; the tie rows show the scope honestly.
- Weakness: a near-bottom rank with identical neighbours is a dull list; nothing distinguishes the top.
- Application: when a ranking authority exists, `LeaderboardPanel` prints what it ranks in one `type-caption` line under the header. Until then the panel says that rankings are not live and shows no rows (`05-copy.md`, `g02.board.unavailable`).

### 4. Life Reset: top three marks and a sticky own row

- URL: https://mobbin.com/screens/fe49882c-9606-48d0-b352-ee34d96849fb · App: Life Reset
- Shows: "Season 7, 25d 13h left"; a silver tier band; ranks 1–3 with gold/silver/bronze trophy glyphs instead of numerals; ranks 4–9 numbered; each row has a score "196/200" and a change figure "54 ▼" in red or "1 ▲" in green; the player's row (44) sticks to the bottom in orange.
- Pattern: the top three get a mark, everyone else a numeral; rank change is a small arrow and a number; the own row is sticky.
- Strength: distinct top three without a podium layout; rank-change indicators are small and tabular; the sticky own row keeps standing visible while scrolling.
- Weakness: season countdown and tier badge are the pressure patterns rejected above; the orange own row carries white text (not measured here).
- Application: top-three distinction by a mark in the rank cell (`orange-500` 1st, `silver-300` 2nd, `orange-800` brick 3rd, on the ink face) and rank-change arrows at `type-caption` with tabular figures. The own row sticks in landscape and tablet; in compact portrait it is the fourth row. Orange faces take `on-cta` black text, never white.

### 5. Transit: podium top three, list from four

- URL: https://mobbin.com/screens/d1aa00b6-6263-41d9-9ac3-2c9a1a881f0d · App: Transit
- Shows: a yellow page, "Top Contributors", a NOV 2025 / ALL TIME toggle, a podium of three large avatars with 2nd / 1st / 3rd ribbons and scores, a white list from rank 4 with emoji avatars and bold names, and a footer line "Use GO on your next trip and start climbing the ranks."
- Pattern: podium plus list, scope toggle, a footer that says how to get on the board.
- Strength: the footer turns an empty or low standing into an action; the scope toggle names its two scopes plainly.
- Weakness: the podium takes a third of the screen; on a phone lobby that space belongs to START.
- Application: reject the podium (height); take the footer idea for the empty state once a ranking exists ("How to get ranked" is withheld until rules exist: no invented mechanics).

### 6. Beli: an honest empty leaderboard

- URL: https://mobbin.com/screens/70f325ff-6ec0-472d-b135-6e78bf29e157 · App: Beli
- Shows: "Leaderboard", a four-tab scope bar, a caption "Number of places on your been list", two filter chips, and one row: rank 1, "You", "+100% Match", score 34, with a teal edge. Nothing else.
- Pattern: an empty board shows the player's own row and no placeholders.
- Strength: no fake rows, no blurred rivals; the board says what it measures.
- Weakness: "1" when you are alone can read as a win; the blank page below offers nothing to do.
- Application: the `empty` state shows the own row only if the ranking boundary has validated data for the Caller; otherwise the panel shows the empty copy and no rows. No skeleton rows pretending to be rivals.

### 7. LinkedIn: locked board with blurred rows

- URL: https://mobbin.com/screens/9a775693-d284-4ca6-a590-8fa36db0d8da · App: LinkedIn
- Shows: a yellow page, two blurred rows above and below a highlighted "You 1:33" row with a padlock, "Play tomorrow to unlock your leaderboard.", a "Day 1 of 2" pill, stats, a "1-day win streak" block with a flame and a week strip, streak freezes, and trophy tiers.
- Pattern: a tease: blurred rivals plus a comeback timer.
- Strength: it is honest that no board exists yet.
- Weakness: the blur manufactures rivals who are not shown, the "play tomorrow" line is the appointment pattern COPY_DECK bans, and the streak block is the mechanic D-15a struck from Journal.
- Application: rejected whole. The unavailable state shows no blurred rows and no return timer.

### 8. Quizlet Blocks: a lobby with one job

- URL: https://mobbin.com/screens/a98647f2-211f-40d2-96fa-a6d516a64e9e · App: Quizlet
- Shows: a white page, a small logo and a gear plus close at the top, a centred block glyph, "Play a game of Blocks", a two-line description, a full-width blue "Play", and two smaller pills "Options" and "How to play".
- Pattern: identity, one sentence, one primary action, two quiet secondaries.
- Strength: the hierarchy is the directive's hierarchy minus the leaderboard; nothing competes with Play.
- Weakness: Play sits mid-screen, out of the thumb zone; the empty lower half is wasted.
- Application: START in the bottom 40% (DESIGN_SYSTEM "primary action sits in the bottom 40%"), the identity at the top, and settings reached by one quiet ghost link, never a second filled button.

### 9. The Atlantic: a full-bleed game card

- URL: https://mobbin.com/screens/5c6e604d-2942-4a9f-92e1-e6d74a0f50bc · App: The Atlantic Magazine
- Shows: an orange card with "Start ○" at the top, a black ink illustration, the serif title "Bracket City", and a black "Play" bar; a second blue card below with the same structure.
- Pattern: one card per game, a flat colour field, art, title, one dark Play bar.
- Strength: the colour field is the identity and the button is dark on it, the same relation as `cta` with `on-cta` (black on orange, 8.02).
- Weakness: a scrolling list of games is the "unrelated cards" the directive forbids.
- Application: take the colour relation (orange face, black type) for `AngledStartButton`; reject the card list.

### 10. Mindvalley: continue with progress stated

- URL: https://mobbin.com/screens/6d3b2948-0b5d-4c17-a032-a6385b40323f · App: Mindvalley (flow "Continue programs" https://mobbin.com/flows/ab1f5f1b-e4ba-4a8a-8bc2-f2d5ca019ae2)
- Shows: "Continue programs", one program thumbnail with its title, a thin purple progress bar, "5 / 29 completed", "28m", a round black play button and a list glyph.
- Pattern: resume is a statement of where you are plus one play control.
- Strength: no choice to make; the numbers say what continuing means.
- Weakness: a progress fraction is a course concept; a world has no "5 of 29".
- Application: the resume summary is a place, not a fraction: "Continue your game" with "Last seen in {district}" from the saved district (directive §3), and nothing when the save carries no district.

### 11. Oura: resume and end as two different shapes

- URL: https://mobbin.com/screens/a9a0536b-e933-41d5-9215-05c9ead0b4fb · App: Oura
- Shows: a dark activity screen ("Indoor running", a large dimmed "19:28") with a bottom sheet holding an outlined "▶ Resume" and a filled coral "End activity".
- Pattern: the safe action is outlined, the terminal one is filled and coloured; the timer dims while paused.
- Strength: the pair cannot be confused by shape; the dimmed timer says "paused" without a label.
- Weakness: filled coral for the destructive action makes it the most tappable thing on the screen.
- Application: in G01 the pill's paused state dims the world under a `scrim-scene` and RESUME is the pill's one tap; STOP is a hold, never a filled button next to RESUME. G02's recovery dialogs put the safe choice in `cta` and the destructive one in `outline` tone `apple`.

### 12. Peloton Strength+: pause overlay over a dimmed scene

- URL: https://mobbin.com/screens/c52d049e-9b0d-4bd4-a8f1-bf715f44cfec · App: Peloton Strength+
- Shows: the workout card dimmed, a large white round "Resume" (play glyph) and a smaller dark round "End" (×) side by side with labels under them, the timer and segment bar still visible at the top.
- Pattern: resume is the big bright control, end is small and dark, both labelled.
- Strength: the size difference states the default; the labels under the glyphs keep them from being mystery icons.
- Weakness: two round buttons mid-screen is the generic pause card; nothing of the product's identity survives the overlay.
- Application: G01's paused state keeps the controller in place and changes the pill (PAUSE → RESUME) instead of covering the world with a card; the world dims, the controls stay where the thumbs are.

## Patterns carried into G02

| Pattern | From | Where it lands |
|---|---|---|
| Top three plus pinned own row, "n of N" | Deezer, Life Reset | `LeaderboardPanel` rows, `isSelf` highlight |
| Say what the ranking measures | Tonal | `type-caption` under the header, only when a source exists |
| Empty board shows no placeholders | Beli | `leaderboard/status = empty` |
| No blurred rivals, no comeback timer | LinkedIn (rejected) | `unavailable` state copy |
| One primary action in the bottom 40% | Quizlet | `AngledStartButton` placement |
| Orange field, black type | The Atlantic | `cta` / `on-cta` |
| Resume states a place, not a fraction | Mindvalley | `g02.resume.district` |
| Safe and terminal actions differ in shape | Oura, Peloton | recovery dialogs; G01 pill |

## What no reference answers

- An exact-coordinate world resume with no visible teleport (directive §3 P0). No app on Mobbin shows a world resuming; this is proven by the resume fixtures in §14, compared numerically.
- A leaderboard that is visibly Rive (panel entrance, rank-row motion, top-three distinction). Mobbin screens are static; the Rive lane proves motion with `--screenshot` and `--data-dump` runs.
- A lobby across book and tabletop postures. No reference; `08-handoff.md` follows the foldable skill and `hud-layout.ts`.
