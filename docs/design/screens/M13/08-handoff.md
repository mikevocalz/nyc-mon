# M13 Home (Baby): handoff

Implementation contract for `platform`, `render` and the kit. Inputs: `01`–`07` in this folder, `docs/design/hlynk/DIRECTION.md`, `docs/spatial/CONTRACT.md`, `packages/core/sim/care.ts`, `packages/core/sim/scene-input.ts`, `packages/app/features/mon/create-mon-store.ts`.

## Blockers before implementation

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | Phase-1 care numbers (Q19–Q21); see `06-critique.md` blocker 1 | Mike + `sim-core` | ship (not build) |
| B2 | P3: add `attention`, `refuse` to `ANIMATION_INTENTS`, `ActionCue`, `MonModelSlot.clips` | `sim-core` | Mon tap |
| B3 | P1 `CareMeterRing` + `CareMeterRingGroup` with stories | kit | rings |
| B4 | P2 `selectCareNow(nowMs)` | `platform` | every displayed meter, LED, mood |
| B5 | `Button variant="hlynk-care"`, `StatusRow tone="request"`; `scrim-scene` token with measurement | kit, theme | care bar, chip |
| B6 | `DIRECTION.md` LED `off` wording ("nothing to report") | kit | doc only |

## Route and intent

Route `/(home)` when `selectStage` is `Baby` (`Egg` renders M11). Shell: `HLynkShell tier="core"`, `testIDPrefix="m13"`.

| Priority | Intent |
|---|---|
| P1 | Show, in two seconds, whether the Mon is asking for something |
| P2 | Answer the ask with one trackpad tap or one labelled button |
| P3 | Let the Caller just be with the Mon (tap to say hi, pan the room) |
| P4 | Never imply loss or blame |

## Data: exact calls

```ts
const mon = useMonStore(selectActiveMon);                 // MonInstance | undefined
const bloodlineId = useMonStore(selectStarterBloodlineId);
const care = useMonStore(selectCareNow(nowMs));          // NEW (B4): advanceCare(...).state.care
const unmet = care ? listUnmetNeeds(care) : [];           // @acme/core/sim, threshold DEFAULT_CARE_TUNING.needsAttentionBelow
const mood = care ? deriveMonMood(care) : undefined;      // @acme/core/sim (scene-input.ts)
const scene = resolveSceneMode({ platform: 'phone', ... }); // @acme/core/sim
const sceneInput = useMonStore(useMemo(() => selectSceneInput(scene, presence), [scene, presence]));
```

- `nowMs` is read in the screen hook: once a minute, and on `AppState` change to `active`. Never inside `@acme/core` (Law 3).
- `presence: ScenePresence` = `{ nowMs, approachActive, cue }`. Tap the Mon sets `cue = { intent: 'attention', untilMs }` (B2). Resume sets `approachActive` for one clip length.
- Name: `mon.nickname ?? species.formName` (species from `allSpecies` in `@acme/content` by `mon.speciesId`). Bloodline label: `bloodlineLabel()` from `@acme/content`.
- Decision #18: if `save.mons.length > 1` and no active choice was made this session, open the chooser sheet; `setActiveMon(id)`.
- Home never calls `applyCare`. Feed, Rest and Play route to M14–M16, which do.

## Trackpad tap: "answer the ask"

| First match | Tap goes to |
|---|---|
| `care.pendingRequest !== null` or `unmet` includes `fullness` | `/(home)/feed` |
| asleep | `/(home)/rest` (wake state) |
| `unmet` includes `energy` | `/(home)/rest` |
| `unmet` includes `social` | `/(home)/social` |
| none | attention cue (say hi); no route change |

Drag: `onPan(dx, dy)` pans the room camera; clamp to the room bounds the renderer reports.

## States

| State | Condition (care advanced to now) | Shell `status` | Chip | Scene |
|---|---|---|---|---|
| content | awake, `unmet` empty, no pending request, not sluggish | `{ led: 'off' }` | `m13.status.content` | intent `idle`, vignettes on |
| needs-you | `unmet.length > 0` or `pendingRequest` | `{ led: 'needsYou', label }` | `m13.status.food/energy/social/many` | mood `needs-*`, ask vignette |
| asleep | `activity.kind === 'asleep'` | `off`, or `needsYou` if `unmet` non-empty | `m13.status.asleep` | intent `sleep`, room dims via time-of-day rig to night scheme; Rest key reads "Wake" |
| background-resumed | `AppState` → `active` after ≥ 60 s in background | as computed | `m13.resumed.a11y` announced | approach clip once |

Also: **sluggish** (`mood === 'sluggish'`): chip `m13.status.sluggish`, Feed opens M14 in its declined state.

**Loading:** save hydrates synchronously from MMKV (`hydrateMon`), so no spinner. If `mon` is undefined after hydrate, route to M22 save recovery, never a blank Home. **Offline:** nothing changes; the write queue (`enqueueCareWrite`) holds care writes; M21's banner owns the offline message.

## Layout spec

Standard shell as in `03-direction.md`. Inside the screen:

| Region | Spec |
|---|---|
| Top scrim | full width, `space.4` padding, `scrim-scene`; name `type-label` 600, bloodline `type-caption`; rings right-aligned, `md` (56 pt) with 8 pt gaps, captions below |
| Scene | the rest of the 3:4 screen; Mon centred on the ground disc |
| Status row | via shell `statusRow`: chip, then `TrackpadActions` collapsed into the care bar (the bar is the labelled twin of tap) |
| Care bar | inside the screen, 16 pt above its bottom edge, four 48 pt buttons, equal spacing, `space.2` min gap |

Medium/expanded/Quest: see `03-direction.md` breakpoints. Quest 1280×800: shell 440 wide centred; trailing 420 dp pane hosts M14–M16 panels at `content-form` width; leading pane holds name card + link to M17.

## Components and test IDs

| Element | Component | testID |
|---|---|---|
| Shell | `HLynkShell` | `m13-shell`, `m13-led`, `m13-trackpad`, `m13-key-home` … (prefix) |
| Name block | `Text` | `m13-name` |
| Rings | `CareMeterRingGroup` | `m13-ring-energy`, `m13-ring-fullness`, `m13-ring-social` |
| Status chip | `StatusRow` | `m13-status` |
| Mon | renderer canvas + accessible overlay `Pressable` | `m13-mon` |
| Care bar | `Button variant="hlynk-care"` | `m13-bar-feed`, `m13-bar-rest`, `m13-bar-play`, `m13-bar-dex` |
| Active-Mon chooser | `BottomSheet` + `SegmentedControl` | `m13-choose` |

Keys: home disabled; menu opens the companion menu (Dex, Journal, Settings by screen name; Q42); back = router back; forward disabled.

## Motion

| Element | Trigger | Token / clip | Reduced |
|---|---|---|---|
| Rings | value change | `motion-enter` 300 ms | `instant` |
| LED | needs-you | `motion-led-blink-needs-you` | steady + exclamation dot |
| Mon idle | always | vignette scheduler `step()` | static pose, cross-fade per slot |
| Mon attention | tap | clip `attention` (B2) | head-turn pose |
| Resume | `AppState` active | clip `approach` | static greeting pose |
| Scheme | time-of-day change, sleep | `motion-scheme` 500 ms | `instant` |

Thermal (§3.1): drop to 30 fps after 90 s without input; back to 60 on touch.

## Acceptance

- Hallway test question 3: zero "I failed" readings of a return.
- No string in this screen contains a pronoun for the Mon, "device", or a count of hours away.
- LED and chip always agree; `maxFlashesPerSecond` ≤ 3 (existing test).
