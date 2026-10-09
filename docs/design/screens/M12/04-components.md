# M12 Hatch: components

| Element | Component / variant | Props | Status |
|---|---|---|---|
| Shell | `HLynkShell` | `scheme="night"`, `status={{ led: 'ready', label }}` until `scanner`, `trackpad.accent='hatch'`, `testIDPrefix="m12"` | exists |
| Case | `CaptureCase` (from M11) | `lid`, `lidProgress`, `seam="lit"` | NEW (M11) |
| Egg in the cradle | `HatchEgg` | see below | **NEW** |
| Burst | `HatchBurst` | see below | **NEW** (TypeGPU later, §3.3; Skia now) |
| Creature layer | `CreatureStage` in `/(home)/_layout.tsx` | see below | **NEW** |
| Name plate | `SignagePlate` (M07 contract) | `text={babyFormName}`, `maxSize='station'` | NEW in M07, reused |
| Skip | `Button` `variant="ghost"` `size="md"` on the night screen | appears at 2000 ms | exists |
| CTA | `TrackpadActions` + trackpad | "Name Squeaklet" / "Go to {nickname}" | exists |
| Announcer | `Announcer` | polite | exists |
| Haptics | `haptics` façade | needs hatch verbs | variant |

## NEW `HatchEgg`

```ts
export interface HatchEggProps {
  /** Egg skin by Egg-form Dex id (dex-001 / dex-008 / dex-061). Q11 open: skin per line assumed. */
  eggSpeciesId: string;
  /** 0–1, UI thread. Crack stages at 0.25 / 0.55 / 0.85. */
  hatchProgress: SharedValue<number>;
  /** 0–1 crack light; orange-500 core, orange-300 falloff. */
  crackGlow: SharedValue<number>;
  reducedMotion: boolean;
  testID?: string;
}
```

2D now needs **cut-out egg art** (transparent background) per line plus three crack overlays. The existing `metro-egg.webp` etc. are scene paintings with the egg on a step and can't sit inside the case. Until cut-outs exist, the fallback is the `hatch-night.webp` plate (an egg in an open case with a glowing crack) for all three lines, which is honest but generic.

## NEW `HatchBurst`

```ts
export interface HatchBurstProps {
  /** 0–1, UI thread; the bloom curve is authored inside, peak at 0.36 of the 500 ms. */
  progress: SharedValue<number>;
  /** Peak opacity cap: 0.6 phone, 0.4 Quest 2D window. */
  peakOpacity: 0.6 | 0.4;
  reducedMotion: boolean; // renders nothing
}
```

Skia radial gradient now. When the TypeGPU pass lands (§3.3: one compute pass, SE 4k / Pro 16k particles) it replaces the internals behind the same props; the light-budget cap stays.

## NEW `CreatureStage` (shared by M11 → M12 → M09 → M13)

Lives in `/(home)/_layout.tsx` under the shell's screen slot, so route changes never unmount the creature.

```ts
export interface CreatureStageProps {
  /** `null` while an egg incubates (M11 draws the case instead). */
  scene: MonSceneInput | null;           // from selectSceneInput(...)
  /** Framing preset; the transition between presets is the continuity move. */
  framing: 'hatch-closeup' | 'home' | 'naming';
  /** Hatch-only performance the scene contract has no intent for (see below). */
  performance?: { kind: 'hatch-emerge' } | { kind: 'first-look'; choice: 'lean-in' | 'hesitate'; resolved: boolean };
  reducedMotion: boolean;
}
```

2D now: draws the Baby plate for the bloodline (`creatureArt('squeaklet' | 'kittee-cee' | 'yotito')`, chosen by `selectStarterBloodlineId`) inside the 3:4 screen. 3D later: the `MonModelSlot` for `(bloodlineId, 'Baby')`.

## Contract gap: no intent or clip slot for the hatch

`AnimationIntent` is `idle | approach | eat | sleep | play | evolve` and `MonModelSlot.clips` has one clip per intent (`docs/spatial/CONTRACT.md`). §3.2 requires `hatch` and `attention` clips, and M12 needs `hesitate`/`lean-in`. Do **not** route the hatch through `evolve` (Law 7; `evolve` is unreachable by design). Proposal for `sim-core`: add `hatch` and `attention` to `ANIMATION_INTENTS` and to `ModelClipMapSchema`, with `hatch` reachable only while a `presenting` hatch exists; first-look variants as named clips under `attention` (`attention_lean_in`, `attention_hesitate`). Until then `CreatureStage.performance` carries it outside the contract.

## Variant: haptics façade

Add semantic verbs over verified `react-native-pulsar` 1.7.0 presets: `hatchLatch` (`latch`), `hatchCrack` (`snap`), `hatchBloom` (`bloom`), `hatchEmerge` (`unfurl`), `firstLook` (`heartbeat`), plus `warm` (`breath`, from M11). Components keep calling the façade, never Pulsar directly.

## Token diffs

None. `orange-300` and `orange-500` exist; `hlynk.core.hatchRim` exists.
