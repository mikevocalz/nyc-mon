# G02 Game lobby: direction

Inputs: `01-research.md`, `02-references.md`, `docs/DESIGN_SYSTEM.md`, `docs/design/DECISIONS.md` (D4, D5, D8), `docs/canon/DECISIONS.md` (#4, #7, #23), Master Directive v2 §3, §4, §8, §10. Route: Game tab. Shell: none. The lobby is a page and follows the scheme (daylit by day, night by the clock, Decision #4).

## The one move

The Game tab opens on a signage board, not a menu. The NYC-Mon wordmark sits at the top like a station name, the NYC Rank panel sits under it as a night-faced board in both schemes, the resume line reads like a departure board entry ("Continue your game · Last seen in Harlem"), and the angled START fills the bottom band as the only orange on the screen. Four things, top to bottom, in the order §3 fixes: identity, leaderboard, resume status, START.

## Layout (phone portrait, 1.0 scale)

```
 ┌──────────────────────────────┐
 │ SafeArea top                 │
 │ NYC-MON            ▣ wordmark│  BrandWordmark, from the repo; type-station is not used here
 │                              │  because the wordmark is the identity line
 │ ┌──────────────────────────┐ │
 │ │ NYC RANK      ▌ status   │ │  SolidPanel tone="ink", corner cut, segmented header
 │ │──────────────────────────│ │
 │ │ 1  ▲ name          score │ │  rank 1 mark orange-500
 │ │ 2    name          score │ │
 │ │ 3    name          score │ │
 │ │──────────────────────────│ │
 │ │ ·· you  name       score │ │  own row: carolina-500 left edge
 │ └──────────────────────────┘ │
 │                              │
 │ Continue your game           │  type-title
 │ Last seen in Harlem          │  type-body, text-muted
 │                              │
 │   ┌────────────────────┐     │
 │  ╱   S T A R T          │    │  AngledStartButton: cta face, cuts top-left and
 │ │                      ╱     │  bottom-right, structure keyline, depth plate
 │ └──────────────────────┘     │  in the bottom 40%, 16 dp above the safe inset
 │ SafeArea bottom / tab bar    │
 └──────────────────────────────┘
```

In `unavailable` and `empty`, the panel keeps its header and height budget (three row lines) and shows one sentence in place of rows (`05-copy.md`). It never collapses, so START does not jump between opens.

## States

| State | What the Caller sees | START does |
|---|---|---|
| new-game (no eligible save) | Resume block reads "Start a new game" with no district line | Runs the established new-game creation flow (§3). Never a second Caller or Mon (Law 6, "a device session is a surface") |
| eligible-save, district known | "Continue your game" + "Last seen in {district}" | Resumes at the saved coordinates, heading and camera; the first visible gameplay frame is already the resumed state (§3) |
| eligible-save, district unknown | "Continue your game" only | Same |
| resume-failed | A `SignageBand size="strip"` under the resume block with the reason, and a `ResponsiveDialog` on START with the recovery choices | Opens the recovery dialog, never a silent new game |
| offline, snapshot valid | Resume block as eligible; strip "You're offline. Your last save is on this H-Lynk." | Resumes from the latest committed snapshot |
| leaderboard loading | Three `LoadingSkeleton variant="line"` rows inside the panel | unchanged |
| leaderboard ready | rows + own row | unchanged |
| leaderboard empty | one sentence, no ghost rows (Beli reference) | unchanged |
| leaderboard stale | rows dimmed to `text-muted`, strip under the header with the age of the data | unchanged |
| leaderboard error | one sentence and a "Try again" text action | unchanged |
| leaderboard unavailable | one sentence; the default until a ranking authority ships | unchanged |

The leaderboard never blocks START (§14 fixture 11). A resume failure never blanks the leaderboard.

## Type

- Identity: `BrandWordmark` at the repo's own proportions; no `type-station` line on this screen because two display moments would compete (DESIGN_SYSTEM: one per screen at most).
- Panel header "NYC Rank": `type-label` on the segmented header band. Rows: `type-body-strong` for the score (tabular figures), `type-body` for the name, `type-caption` for the rank numeral from 4 up; the top three take the numeral at `type-label`.
- Resume: `type-title` for "Continue your game" / "Start a new game", `type-body` `text-muted` for the district line.
- START legend: `type-tag` (14 pt, 600, 0.18 em tracking, uppercase). **Decision: BUILD.** DESIGN_SYSTEM sets sentence case everywhere and bans all-caps eyebrows; `type-tag` exists in `packages/theme/tokens.ts` for "uppercase signage labels". The START legend is a machined legend on a control face, the same class as the H-Lynk's printed key names, not an eyebrow. Its accessible name is sentence case ("Start", "Continue your game"). If `design-director` overrules, the legend becomes `type-label` "Start" and nothing else changes.

## Colour

Page tokens follow the scheme. The one orange is the START face (`cta`, label `on-cta`, D5). The panel is `SolidPanel tone="ink"` so it is night in both schemes; its rank-1 mark is `orange-500` (7.76 on `ink-950`), structure keylines `royal-500` (3.63 ui), own-row edge `carolina-500` (7.89), text `ink-50` and `silver-300` (19.12, 15.36). No glow by day (`glow` is transparent in the light column). At night the panel edge may carry `shadows.card`.

District motif: the panel's header band takes a 2 dp keyline in the district tone of the last verified district (`tone-*` structure steps) when a save exists; otherwise royal. Subtle, never a fill.

## Motion and reduced motion

| Moment | Full | Reduced (authored sibling) |
|---|---|---|
| Lobby enter | `motion-enter` on the panel then the resume block then START, 60 ms apart | `motion-enter` reduced: 200 ms fade, no rise, all at once |
| START perimeter energy trace | one `carolina-500` trace runs the perimeter once on enter, then rests; never loops | absent; a steady 2 dp `carolina-500` rim instead |
| START press | Rive compression, 120 ms, scale 0.97 (`motion-tap`) | colour change to `cta-pressed`, 120 ms |
| START → gameplay transition | Rive loading transition holds until `WorldResumeService` reports ready; the first frame it reveals is the resumed scene | cross-fade 200 ms once ready; same gate |
| Rank row update | `motion-step`: 200 ms slide to the new order | 120 ms cross-fade |
| Leaderboard status change | panel body cross-fades 200 ms | instant |

Nothing cycles. The energy trace runs once per lobby open; a looping trace would be the "constantly cycling scoreboard" §3 forbids and would burn the loop the lobby must not keep alive.

## No-list

- No cards, promo widgets, streak counters, daily chests or "play tomorrow" locks (§3; COPY_DECK Tone).
- No scores, ranks, seasons, leagues, tiers, promotion zones or rank-change arrows until a server ranking boundary defines them (Law 1, §3).
- No avatar photos, real names, boroughs of residence or ages on rows.
- No second orange: the panel's rank-1 mark is the only other orange and it is a 3 dp mark, not a face (D5 "one orange button per screen").
- No "Resume" on the lobby; that word belongs to the pill (G01). The lobby says "Continue your game".
- No "device"; the save lives on the H-Lynk in copy (Law 9).
- No gradient hero, no purple, no indiscriminate glow (§4 reject list).
- No full-speed Rive loop after START is pressed (§3).
