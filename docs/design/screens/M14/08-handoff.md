# M14 Feed: handoff

Inputs: `01`–`07` here; `../M13/04-components.md` (P1–P4); `packages/core/sim/care.ts`; `packages/app/features/mon/create-mon-store.ts`.

## Blockers

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | `content/food` and `FoodDefSchema` (Q22, Q23, Q24). Missing content, not a design gap | Mike (canon) → `canon-keeper` → content | the whole screen |
| B2 | Per-bloodline eat/react/refuse clips | Mike (models) | eating, full, declined performances (placeholder art plays a static pose until then) |
| B3 | P3 `refuse` intent; P2 `selectCareNow` | `sim-core`, `platform` | declined, full |
| B4 | `FoodTile`, `SheetSurface placement="in-screen"` | kit | tray |
| B5 | Overfeed rule review (post-meal value) | `sim-core` | predictability of `full` |

## Route

`/(home)/feed`, a modal route over `/(home)` inside the shell. Entry: `m13-bar-feed`, M13 trackpad tap when Fullness is the ask.

## Data: exact calls

```ts
const mon = useMonStore(selectActiveMon);
const care = useMonStore(selectCareNow(nowMs));                  // P2
const species = allSpecies.find(s => s.speciesId === mon.speciesId); // @acme/content
const foods = foodsFor(species);                                  // NEW content helper (B1)
const isFull = care.fullness >= DEFAULT_CARE_TUNING.overfeedAtOrAbove;

function feed(food: FoodDef) {
  const outcome = useMonStore.getState().applyCare(
    { kind: 'feed', foodClassId: food.foodClassId, nutrition: food.nutrition }, // CareActionSchema 'feed'
    Date.now(),
  ); // returns CareOutcome
  switch (outcome.kind) {
    case 'eaten':    return play({ intent: 'eat', untilMs: now + clipMs('eat') });
    case 'overfed':  return play({ intent: 'eat', untilMs: ... }), then route back with mood 'sluggish';
    case 'declined': return showDeclined(outcome.reason); // 'asleep' | 'sluggish' (feed never returns the others)
    default:         return assertNever(outcome as never); // exhaustive (§0A.2)
  }
}
```

- `applyCare` persists through `SaveIO` and queues the server write (`enqueueCareWrite`); the screen never writes MMKV directly (Law 4).
- Clip length comes from the renderer (`ActionCue.untilMs`, core holds no animation lengths).
- Check `declined` before the clip plays; never animate eating and then refuse.

## States

| State | Entry | UI | Exit |
|---|---|---|---|
| tray | open, awake, not sluggish, Fullness < 0.9 | tiles, focus first tile | select/drop → eating; Close/Back → M13 |
| dragging | pan start on a tile | tile follows pointer; drop ring on the disc; Mon head-tracks (`approachActive: true`) | drop over Mon → eating; elsewhere → tile springs back (reduced: snaps back) |
| eating | `eaten`/`overfed` outcome | tray inert, dimmed to 40%; ring fills after first bite | clip end → tray (eaten) or route to M13 (overfed) |
| full | Fullness ≥ `overfeedAtOrAbove` on open or after a meal | `m14.full.body` above live tiles; Mon turned-away pose | feeding → overfed; Close |
| declined | outcome `declined` or care says asleep/sluggish on open | message + action; tray hidden | action (Rest) or Close |

Opening the screen while asleep or sluggish goes straight to declined (no tray flash). Offline: no change (queued write). Error: `applyCare` throws only with no active Mon; route to M22.

## Layout

In-screen sheet 45% of the H-Lynk screen height (compact), `space.4` padding, tiles 88 pt square + name below, `space.3` gaps, max 4 per row. Fullness ring `sm` stays at top-left of the scene. Medium+/Quest: trailing side pane, `content-form` width (28rem), tiles 3 per row.

## Components and test IDs

| Element | Component | testID |
|---|---|---|
| Shell | `HLynkShell` | `m14-shell`, `m14-trackpad` … |
| Tray | `SheetSurface placement="in-screen"` | `m14-tray` |
| Tile | `FoodTile` | `m14-tile-{foodId}` |
| Drop target | renderer rect overlay | `m14-drop` |
| Full line | `Text` | `m14-full` |
| Declined block | `Text` + `LinkButton` | `m14-declined`, `m14-declined-action` |
| Close | `Button variant="ghost"` | `m14-close` |

## Motion

As `03-direction.md`. Haptics: tile lift light; drop on Mon medium; meal finished success; declined none.

## Acceptance

- Every tile reachable and feedable without dragging.
- `full` text appears before the meal that causes `overfed`, never after only.
- No food string in code that does not come from `content/food`.
