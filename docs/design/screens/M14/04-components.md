# M14 Feed: components

Shared primitives P1–P4 are in `../M13/04-components.md`.

## Existing kit

| Element | Component |
|---|---|
| Frame | `HLynkShell` (`testIDPrefix="m14"`), `trackpad.onStep` + `onActivate` |
| Tray surface | `SheetSurface` (`packages/ui/BottomSheet.tsx`) rendered inside the shell's `screen`, not `BottomSheet` |
| Ring | `CareMeterRing` (P1), Fullness only |
| Close | `Button variant="ghost"` |
| Messages | `Text type-body`; route link `LinkButton` |

## New

### `FoodTile` (NEW, `packages/ui/care/FoodTile.tsx`)

```ts
export interface FoodTileProps {
  /** From content/food; never a literal in the screen. */
  name: string;
  image: CreatureSource; // same source type as packages/assets/creatures
  /** Spoken extra, e.g. "Favourite". Only when content says so. */
  note?: string;
  focused: boolean;
  disabled?: boolean;
  onSelect: () => void;          // tap / trackpad activate / Enter
  onDragStart?: () => void;
  onDrop?: (overMon: boolean) => void;
  reducedMotion: boolean;
  testID?: string;
}
```

Drag uses `react-native-gesture-handler` Pan with a Reanimated shared value for position (verify both in `node_modules`, Law 2). Drop hit-test against the Mon's screen rect reported by the renderer.

### `FoodDefSchema` (NEW, `@acme/core/schemas`) and `content/food` (NEW content)

Neither exists. Shape proposal, every canon field nullable until Mike answers:

```ts
export const FoodDefSchema = z.object({
  foodId: IdSchema,
  foodClassId: IdSchema,          // resolves MonSpeciesDef.foodClassIds (Q22)
  name: z.string().min(1),        // canon only (Q24)
  nutrition: UnitIntervalSchema,  // tuning, not canon (Q19, Q23)
  stageServing: LifecycleStageSchema.array(), // Baby portions per v7 L505 if adopted (Q23)
  imageId: IdSchema.nullable(),
});
```

The tray filter is `foods.filter(f => species.foodClassIds?.includes(f.foodClassId))`. If `foodClassIds` stays null after Q22 and Mike rules "no restrictions", the filter becomes "all foods", and that ruling is recorded in `DECISIONS.md`.

## Variants

| Component | Variant | Why |
|---|---|---|
| `SheetSurface` | `placement="in-screen"`: sized to the H-Lynk screen, no OS scrim | keeps the shell controls live under the tray |

## Token diffs

None.
