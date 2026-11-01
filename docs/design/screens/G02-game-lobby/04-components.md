# G02 Game lobby: components

All parts from `@acme/ui` (R3). NEW items need stories before the Game tab uses them (directive §13: "Every component ships with a co-located Storybook story"). Existing names come from `docs/REPO_MAP.md` §5 and the files read in `packages/ui`.

| Element | Component / variant | Props | Status |
|---|---|---|---|
| Screen frame | `GameLobby` | `resume`, `leaderboard`, `profile` (`LayoutProfile`), `reducedMotion`, `onStart` | NEW |
| Safe areas | `SafeArea` | top + bottom | exists |
| Identity | `BrandWordmark` | `height` numeric only; no tint, crop or filter | exists (no story yet, REPO_MAP §5.4) |
| Leaderboard housing | `LeaderboardPanel` wrapping `SolidPanel tone="ink"` + `CornerCutFrame` | `status`, `rows`, `self`, `district`, `reducedMotion` | NEW (Rive-backed) |
| Rank rows | inside `LeaderboardPanel`; native `VirtualList` when rows exceed 12 (§3 allows native rows coordinated with Rive) | `rows[n].rank/name/score/isSelf` | NEW |
| Stale / offline strip | `SignageBand` | `tone="signage"`, `size="strip"`, `headline`, `action` | exists |
| Leaderboard error / unavailable line | `StatusRow` | `items[{ id, label, tone: 'offline' \| 'neutral', action? }]` | exists |
| Leaderboard loading | `LoadingSkeleton` | `variant="line"` ×3 | exists |
| Leaderboard empty | `EmptyState` | `title`, `description`, no `illustration` until art exists | exists |
| Resume block | `Heading` + `Text` | `Heading level={2} size="title"`, `Text variant="body" tone="muted"` | exists |
| START | `AngledStartButton` | `legend`, `accessibilityLabel`, `state` `'idle' \| 'pressed' \| 'loading' \| 'disabled'`, `reducedMotion`, `onPress` | NEW (Rive-backed) |
| START fallback (web, Rive missing) | `Button` | `variant="cta"`, `corner="bottom-right"`, `size="lg"`, `fullWidth` | exists |
| Recovery choices | `ResponsiveDialog` + two `Button`s | title, body, `variant="cta"` for the safe choice, `variant="outline"` for the other | exists |
| Hinge geometry | `@acme/ui/adaptive-panes/parts` | `useReservedRegions`, `foldLayoutsFromRegions` | exists |

## New components

- `GameLobby`: the composition. Stories `NewGame`, `EligibleSave`, `EligibleSaveNoDistrict`, `ResumeFailedDataset`, `ResumeFailedNewerSave`, `Offline`, per `LayoutProfile` (`PhonePortrait`, `PhoneLandscape`, `FoldOuter`, `FoldBook`, `FoldTabletop`, `Tablet`, `Web`), and `ReducedMotion`.
- `LeaderboardPanel`: Rive artboard `packages/ui/rive/lobby/leaderboard/` (directive §8) with data binding on `leaderboard/status` and `leaderboard/rows[n]/*`. Stories `Loading`, `Ready`, `Empty`, `Stale`, `Error`, `Unavailable`, `SelfInTopThree`, `SelfOutsideList`, `LongName`, `ReducedMotion`.
- `AngledStartButton`: Rive artboard `packages/ui/rive/lobby/start-angled/`. Stories `Idle`, `Pressed`, `Loading`, `Disabled`, `ReducedMotion`, `Daylit`, `Night`, `AtScale` (0.8 to 1.4).

## Token diffs

None. The panel reuses the night facade rows already measured in `docs/design/CONTRAST.md` ("card themed … on night face"); START reuses `cta`, `on-cta`, `cta-pressed`, `structure`. `07-a11y.md` lists the pairs. If the theme owner wants a named `lobby` group the way `hlynk` has one, it is a naming change, not a new colour.

**Decision: STRIKE** a `type-station` "Game" title. The wordmark is the identity line; a second display moment would compete with it (DESIGN_SYSTEM "one line per screen at most").
