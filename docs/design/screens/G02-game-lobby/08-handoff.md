# G02 Game lobby: handoff

The implementation contract for lane B (Rive: `packages/ui/rive/lobby/*`), lane D (`AdaptiveControlLayout`, profiles), lane E (`WorldResumeService`, `LeaderboardSource`) and the kit build (`packages/ui`). Inputs: `01-research.md` to `07-a11y.md`, `docs/DESIGN_SYSTEM.md`, `docs/design/CONTRAST.md`, `docs/design/DECISIONS.md` (D4, D5, D8), canon Decisions #4, #7, #23, Master Directive v2 §3, §8, §10, §13, §14, `packages/ui/game-controls/contract.ts`. Laws: `CONTRIBUTING.md` (R1 to R5, Laws 1, 2, 4, 5, 6, 9, 10).

## Blockers before implementation

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | `GameLobby`, `LeaderboardPanel`, `AngledStartButton` exist in `packages/ui` with stories (R3) and Rive sources under `packages/ui/rive/lobby/` built by the CLI (§7, §8) | kit + lane B | everything |
| B2 | `WorldResumeService` returns a `ResumeOutcome` (§ Data) and never creates a Caller, Mon, world or save on resume (§3) | lane E | START |
| B3 | `LeaderboardSource` exposes `leaderboard/status` including `unavailable`; `contract.ts` gains the state (§ Data) | lane E + contract owner | panel |
| B4 | Lead decision on web START (§ Route and intent) | lead | web profile |

Not blocking implementation, blocking visual sign-off: the Rive `--screenshot` set for every state at `844x390` and `320x700` (§8) and a `--semantics` dump showing the panel, rows and START.

## Route and intent

Route: the Game tab (`apps/mobile/app/(drawer)/(tabs)/game.tsx`). The lobby mounts first; `GameScreen` mounts only after `onStart` resolves (§3 "the Game tab opens a Rive-powered lobby before the 3D world loads"). Lobby and controller pill are separate (`PillState` in `contract.ts` is G01's).

| Priority | Intent |
|---|---|
| P1 | Decide from local state whether an eligible save exists and show "Continue your game" or "Start a new game" before any network call |
| P2 | On START, resume at the exact saved coordinates, heading and camera with no visible teleport; the first visible gameplay frame is the resumed state |
| P3 | Show NYC Rank honestly: `unavailable` until a server ranking authority exists; never a client-computed score |
| P4 | Keep the lobby's Rive loop stopped once gameplay starts |

Web: `GameScreen.tsx` never mounts on web. **Decision: DEFER** to the lead. Default until ruled: the web lobby renders identity, the panel and START, and START routes to `/mon-space` (canon Decision #23 makes it the web companion). Alternative: START shows "Play on your phone" copy. Not written until ruled.

## Layout

Phone portrait (compact width), 4 pt grid, gutter 16 pt (`layout.gutterPt`):

| Part | Spec |
|---|---|
| Safe areas | `SafeArea` top and bottom; the tab bar sits below the lobby |
| Wordmark | `BrandWordmark` height 28 pt, top-left on the gutter, 24 pt below the safe top |
| Panel | full content width; `SolidPanel tone="ink"` inside `CornerCutFrame corner="bottom-right" cut={16}`; header band 40 pt; rows 56 pt × 3; own row 56 pt; min height = header + 4 rows = 264 pt in every state |
| Resume block | 24 pt below the panel; `Heading level={2}` `type-title`; district line `type-body` muted, 4 pt below; block reserves 2 title lines |
| Strip | `SignageBand size="strip"` 44 pt, 12 pt below the resume block, only when present |
| START | full content width × 64 pt; cuts 24 pt top-left and bottom-right; sits in the bottom 40 %, 16 pt above the safe bottom (`layout.actionInsetPt`) |
| SE 3 check | 375 × 667 pt: safe top 20, wordmark 28, 24 gap, panel 264, 24 gap, resume 60, 24 gap, START 64, 16 inset, tab bar ≈ 83 = 607 pt. Fits with 60 pt spare; the strip (44) still fits |

Per `LayoutProfile` (`contract.ts`; resolved by `ControllerLayoutResolver`, lane D):

| Profile | Layout |
|---|---|
| phone-portrait | as above |
| phone-landscape | two columns on the gutter grid: panel (48 %) left, resume + START (52 %) right; START fully visible with no scroll |
| fold-outer | phone-portrait at outer width; panel keeps 3 rows + self |
| fold-book | leading pane wordmark + panel; trailing pane resume + START; `foldLayoutsFromRegions` decides the split; nothing straddles the hinge |
| fold-tabletop | upper region wordmark + panel; lower region resume + START; START centred in the lower region |
| tablet | content capped at `content-screen` (56 rem), centred; panel grows to as many 56 pt rows as the region allows (max 12 on screen, `VirtualList` beyond); START stays the full content width |
| web | tablet rules; keyboard order per `07-a11y.md` |

Hinge and reserved regions come from `@acme/ui/adaptive-panes/parts` (`useReservedRegions`, `foldLayoutsFromRegions`), the same path `GameScreen.tsx` uses. Every profile revalidates on every metrics change (§10).

## Components

All from `@acme/ui` (R3). No raw `View` styling in the route file.

| Element | Component | Props | testID |
|---|---|---|---|
| Frame | `GameLobby` | `resume`, `leaderboard`, `profile`, `reducedMotion`, `onStart`, `onRecover` | `g02-lobby` |
| Identity | `BrandWordmark` | `height={28}`, `accessibilityLabel` from `g02.identity.a11y` | `g02-wordmark` |
| Panel | `LeaderboardPanel` | `status`, `rows`, `self`, `district?`, `reducedMotion`, `onRetry` | `g02-rank` |
| Panel rows (overflow) | `VirtualList` | items from `rows`, 56 pt | `g02-rank-row-{rank}` |
| Panel status line | `StatusRow` | `items[{ id: 'rank-status', label, tone, action? }]` | `g02-rank-status` |
| Panel stale strip | `SignageBand` | `tone="signage"`, `size="strip"`, `headline` from `g02.rank.stale` | `g02-rank-stale` |
| Panel loading | `LoadingSkeleton` | `variant="line"` ×3 | `g02-rank-loading` |
| Resume title | `Heading` | `level={2}`, `size="title"`, text from `g02.resume.title.*` | `g02-resume-title` |
| District line | `Text` | `variant="body"`, `tone="muted"`, `g02.resume.district` | `g02-resume-district` |
| Failure / offline strip | `SignageBand` | `size="strip"`, `headline` from `g02.resume.fail.*` or `g02.resume.offline`, `action` | `g02-resume-strip` |
| START | `AngledStartButton` | `legend` (`g02.start.legend`), `accessibilityLabel`, `accessibilityHint`, `state`, `reducedMotion`, `onPress` | `g02-start` |
| START fallback | `Button` | `variant="cta"`, `size="lg"`, `fullWidth`, `corner="bottom-right"` | `g02-start-fallback` |
| Recovery dialog | `ResponsiveDialog` + `Button` ×2 | title `g02.recovery.dialog.title`; body = failure string; primary `variant="cta"`, secondary `variant="outline"` | `g02-recovery` |

### Public prop contracts (R5, Margelo `api-design`)

Discriminated unions over boolean flags, so impossible states cannot be represented:

```ts
import type { District } from '@acme/ui/district';
import type { LayoutProfile } from '@acme/ui/game-controls/contract';

/** Milliseconds since the Unix epoch; the save's own clock, never Date.now() at read time. */
export type EpochMs = number;

export type ResumeFailure =
  | { kind: 'dataset-incompatible'; savedDatasetVersion: string; currentDatasetVersion: string }
  | { kind: 'save-unreadable'; reason: string }
  | { kind: 'newer-save-elsewhere'; localRevision: number; remoteRevision: number }
  | { kind: 'offline-no-snapshot' }
  | { kind: 'unknown'; reason: string };

/** What the lobby shows about the save. Produced by WorldResumeService.inspect(). */
export type ResumeSummary =
  | { kind: 'none' }
  | { kind: 'eligible'; district?: District; savedAtMs: EpochMs; revision: number }
  | { kind: 'failed'; reason: ResumeFailure };

export type LeaderboardStatus = 'loading' | 'ready' | 'empty' | 'stale' | 'error' | 'unavailable';

export interface LeaderboardRow {
  readonly rank: number;
  /** The Caller name from M07; never a real name or photo. */
  readonly name: string;
  /** Present only when the ranking authority defines the metric; absent until then. */
  readonly score?: number;
  readonly isSelf: boolean;
  /** Stable id from the ranking authority; never the account id. */
  readonly playerId: string;
}

export type LeaderboardModel =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'empty'; selfEligible: boolean }
  | { status: 'ready'; rows: readonly LeaderboardRow[]; self: LeaderboardRow | null }
  | { status: 'stale'; rows: readonly LeaderboardRow[]; self: LeaderboardRow | null; updatedAtMs: EpochMs }
  | { status: 'error'; reason: string };

export interface GameLobbyProps {
  resume: ResumeSummary;
  leaderboard: LeaderboardModel;
  profile: LayoutProfile;
  reducedMotion: boolean;
  /** Runs resume or new-game; resolves when the first gameplay frame is ready. */
  onStart(): Promise<void>;
  /** Chosen from the recovery dialog. */
  onRecover(choice: 'from-district' | 'new-game' | 'restore-server' | 'use-newer' | 'keep-local' | 'retry'): Promise<void>;
  onRetryLeaderboard(): void;
}

export type AngledStartState = 'idle' | 'pressed' | 'loading' | 'disabled';
```

Rules the types encode: a `ready` leaderboard cannot lack rows; `stale` cannot lack `updatedAtMs`; a `failed` resume cannot lack a reason; `score` is optional so no unit is invented. Every exported type gets JSDoc that links the component consuming it.

**Decision: BUILD** `unavailable` as a `LeaderboardStatus` value. Directive §8 lists `loading | ready | empty | stale | error`; `contract.ts` has no leaderboard enum yet. Proposal to the contract owner: add `LeaderboardStatus` with `unavailable` to `packages/ui/game-controls/contract.ts` (reported, not edited by this lane).

### Rive View Model bindings (§8)

| Path | Type | Source |
|---|---|---|
| `lobby/resume/eligible` | boolean | `resume.kind === 'eligible'` |
| `lobby/resume/district` | string | `DISTRICT_NAME[resume.district]` or "" |
| `leaderboard/status` | enum | `leaderboard.status` (`unavailable` added) |
| `leaderboard/rows[n]/rank`, `/name`, `/score`, `/isSelf` | number, string, number, boolean | rows 0..n; `score` bound as 0 and hidden while absent |
| `a11y/reducedMotion` | boolean | `reducedMotion` |
| `theme/variant` | enum `daylit \| night` | scheme from the clock (D8) |
| `layout/profile` | enum | `profile` |

Data binding only; no imperative state-machine inputs. Every `--data` path must resolve; a `no property` log is a failure (§8).

## Tokens

| Use | Token | Value |
|---|---|---|
| Page | `bg`, `surface` | `concrete-50` daylit, `night` at night |
| Resume text | `text`, `text-muted` | signage black / white; concrete-600 / silver |
| START face, pressed, legend | `cta`, `cta-pressed`, `on-cta` | `orange-500`, `orange-400`, black / night |
| START keyline | `structure` (`royal-500`) at 2 dp; `orange-950` by day as the cut edge | measured rows in `07-a11y.md` |
| START reduced-motion rim | `carolina-500` night / `royal-500` day | 2 dp |
| Panel face | `SolidPanel tone="ink"` | `ink-950` face, `ink-800` plate |
| Panel text | `ink-50` heading, `silver-300` rows, `silver-500` stale | |
| Rank-1 mark | `orange-500` | 3 dp bar, left of the numeral |
| Own-row edge | `carolina-500` | 3 dp left edge |
| Structure keylines | `royal-500` | 1 dp row rules, 2 dp header |
| Focus | `focus` with `ring-offset-bg` | |
| Danger (dialog destructive hint) | `danger` | text only |
| Space | 4 pt grid; gutter 16 / 24; action inset 16 | `layout` in `tokens.ts` |
| Type | `type-title`, `type-body`, `type-body-strong` (tabular), `type-label`, `type-caption`, `type-tag` (legend) | `typeRamp` |
| Motion | `motion-enter`, `motion-tap`, `motion-step` | `motionTokens` with reduced siblings |

No second orange face. No hex anywhere outside `tokens.ts`.

## States

| State | Trigger | Panel | Resume block | START | Copy IDs |
|---|---|---|---|---|---|
| new-game | `resume.kind === 'none'` | per leaderboard | "Start a new game" + caption | `idle`, label `g02.start.a11y.new` | `g02.resume.title.new`, `g02.resume.body.new` |
| eligible | `resume.kind === 'eligible'` | per leaderboard | "Continue your game" (+ district) | `idle`, label `g02.start.a11y.continue*` | `g02.resume.title.continue`, `g02.resume.district` |
| offline, snapshot | eligible + no network | per leaderboard (`unavailable` or `stale`) | eligible + strip | `idle` | `g02.resume.offline` |
| resume-failed | `resume.kind === 'failed'` | unchanged | eligible or new text + strip | label `g02.start.a11y.recover`; press opens the dialog | `g02.resume.fail.*`, `g02.recovery.dialog.title` |
| starting | `onStart` pending | frozen | unchanged | `loading`, busy; `g02.start.loading` spoken once | |
| leaderboard loading / ready / empty / stale / error / unavailable | `leaderboard.status` | per `03-direction.md` | unchanged | unchanged | `g02.rank.*` |

The leaderboard never blocks START (§14 fixture 11). START never blocks the leaderboard.

## Motion and reduced motion

| Moment | Full | Reduced (authored) |
|---|---|---|
| Enter | `motion-enter` ×3, 60 ms stagger; panel header lights left to right 300 ms | 200 ms fade, no rise, no stagger; header drawn lit |
| START trace | one perimeter pass ≤ 1.2 s on enter, then still | absent; steady rim |
| START press | `motion-tap` + Rive compression | colour only |
| START → game | Rive transition held until `onStart` resolves; the revealed frame is the resumed scene | 200 ms cross-fade, same gate |
| Row reorder | `motion-step` | 120 ms cross-fade |
| Status change | 200 ms cross-fade | instant |

After `onStart` resolves, the lobby's Rive instance is paused and unmounted; no loop survives into gameplay (§3). Haptics: `haptics.tap()` on START press (the kit `Button` already does this); none elsewhere.

## Empty, error, offline

- **Empty:** `leaderboard.status === 'empty'` shows `g02.rank.empty` (+ `.self` when `selfEligible`). No ghost rows.
- **Unavailable:** the default until B3 lands; `g02.rank.unavailable` + body. Looks designed: same header, same height.
- **Error:** `g02.rank.error` + "Try again" (`onRetryLeaderboard`). A failed leaderboard never changes `resume`.
- **Stale:** rows kept, dimmed, strip with `g02.rank.stale`.
- **Offline:** resume from the latest committed snapshot (`g02.resume.offline`); leaderboard `unavailable` or `stale`, never `error` for a missing network.
- **Resume failure:** one strip + the dialog on START; the old save is never discarded until the chosen path confirms (`07-a11y.md` finding 6).
- **Slow resume:** START holds `loading` with the Rive transition; no spinner, no second message. If `onStart` rejects, START returns to `idle` and the strip shows `g02.resume.fail.generic`.

## Data

| Need | Source |
|---|---|
| Resume summary | NEW `WorldResumeService.inspect(): ResumeSummary` (lane E, §13), reading the latest committed save through `@acme/core` `loadSave` (Zod, Law 5); synchronous from MMKV for P1, never awaiting the network |
| Resume | NEW `WorldResumeService.resume(): Promise<ResumeOutcome>` where `ResumeOutcome = { kind: 'resumed'; revision: number } \| { kind: 'new-game' } \| { kind: 'failed'; reason: ResumeFailure }`; follows the §3 sequence (validate identity → latest eligible save → version → world and chunks → simulation → position and heading → camera → bindings → geometry ready → drop the transition) |
| Leaderboard | NEW `LeaderboardSource.read(): LeaderboardModel` (lane E); returns `{ status: 'unavailable' }` when no ranking authority is configured; validated with Zod; client never computes a rank |
| District name | `DISTRICT_NAME` from `packages/ui/district/districts.ts` |
| Reduced motion, scheme | sim-core adapter and time-of-day adapter |
| Profile | `ControllerLayoutResolver` (lane D) |

Save fields the lobby depends on (§3): world instance id, district id, canonical position + CRS, heading, camera, dataset version, save revision, timestamp. The lobby reads `district` and `savedAtMs`; everything else belongs to resume.

No analytics event fires on the lobby for under-13 Callers beyond what ADR 0001 already allows.

## Accessibility contract

From `07-a11y.md`: wordmark is the h1; panel is a named region with polite status announcements; rows carry `g02.rank.row.a11y`; START has a sentence-case name and a hint, is `busy` while loading, and focus never starts the game; Rive semantics authored for panel, rows and START with a `--semantics` dump committed; reduced-motion siblings per the table; scheme-aware rim; dialog traps focus and returns it to START.

## Tests to write

| Kind | Test |
|---|---|
| Unit (`@acme/core`, Vitest) | `WorldResumeService.inspect` returns each `ResumeSummary` kind from fixture saves; `resume` never creates a Caller, Mon, world or save (§14 fixtures 1, 2, 3, 8, 9, 10) |
| Unit | lobby state resolver: `(resume, leaderboard) → view model` is exhaustive; a new `LeaderboardStatus` fails typecheck |
| Unit | `LeaderboardSource` rejects client-supplied scores; Zod parse of rows; `unavailable` when unconfigured |
| Unit (`packages/theme`) | no new pair; `contrast.test.ts` already holds every row in `07-a11y.md` |
| Story | `GameLobby`: `NewGame`, `EligibleSave`, `EligibleSaveNoDistrict`, `Offline`, `ResumeFailedDataset`, `ResumeFailedUnreadable`, `ResumeFailedNewerSave`, `Starting`, one per `LayoutProfile`, `ReducedMotion`, `Daylit`, `Night` |
| Story | `LeaderboardPanel`: `Loading`, `Ready`, `Empty`, `Stale`, `Error`, `Unavailable`, `SelfInTopThree`, `SelfOutsideList`, `LongName`, `ReducedMotion` |
| Story | `AngledStartButton`: `Idle`, `Pressed`, `Loading`, `Disabled`, `ReducedMotion`, `AtScale` |
| Rive (CI, `scripts/rive/`) | `--verify`, `--screenshot` per state at 844x390 and 320x700, `--data` for every path above, `--semantics` dump, `--bench=600` (§8) |
| a11y (web) | axe pass on every `GameLobby` story; START `aria-busy` while loading |
| Visual | Storybook captures of `EligibleSave` and `Unavailable`, daylit and night; baseline in `apps/mobile/__captures__` |
| Integration | lobby → START → first gameplay frame equals the saved camera (numeric compare, never screenshot; §14) |

## Device verification

Open; nothing verified on a device. Full list: [`docs/DEVICE_CHECKS.md`](../../../DEVICE_CHECKS.md).

- [ ] iPhone portrait: hierarchy intact, START in the bottom 40 %, SE 3 fits with the strip.
- [ ] iPhone landscape: START visible without scrolling.
- [ ] Foldable book and tabletop: no row or START across the hinge; START in the lower region in tabletop.
- [ ] Tablet and iPad split: panel grows, START stays dominant, nothing stretched.
- [ ] VoiceOver and TalkBack: region, rows, START name and hint, polite status changes, START focus does not start the game.
- [ ] Reduced motion: steady rim, no trace, no stagger.
- [ ] Resume fixtures 2, 3, 6, 7, 11 from §14 pass numerically.
