# M17 Dex entry / Mon profile: components

| Element | Component | Source |
|---|---|---|
| Page | `Main` + `ScrollView` (no keyboard on this screen) | kit |
| Back | `IconButton` | `packages/ui/IconButton.tsx` |
| Portrait | renderer view (live pose) or `Image` with `packages/assets/creatures` Baby art | |
| Dex number, form name | `SignagePlate` (`text`, `accessibilityLabel`, `maxSize`) | `packages/ui/SignagePlate.tsx` (D10) |
| Bloodline label | `Text type-label`, string from `bloodlineLabel()` | `@acme/content` |
| Facts | `KeyValueList` | `packages/ui/KeyValueList.tsx` |
| Photo / Cancel | `Button variant="outline"` / `"ghost"` | |
| Saved message | `Toast` via `notify` | `packages/ui/notify` |

## New

### `LifecycleTrack` (NEW, `packages/ui/care/LifecycleTrack.tsx`)

```ts
export interface LifecycleTrackProps {
  /** Ordered slots. Only reached stages carry a label; later stages are unnamed. */
  slots: ReadonlyArray<
    | { state: 'done'; label: string }      // Egg ✓  (label: egg form name, e.g. from the chain root)
    | { state: 'current'; label: string }   // Baby ● (label: Baby form name)
    | { state: 'later' }                    // ○, no text, no stage word
  >;
  /** Group label, e.g. "Life stages". */
  accessibilityLabel: string;
}
```

Built from `walkChain(bloodline.chain)` in `@acme/content`, truncated: entries up to and including `MonInstance.stage` carry their `formName`; the remaining stage count (three for Phase 1: Small, Mid, Max) renders as `later` slots with no text. Branching Max (Decision #12) is one `later` slot, not three.

### `PhotoMode` (NEW, `packages/app/features/mon/photo/`) and `captureTransparentFrame` (NEW, `packages/render`)

Needs a native capability, so specified here and deferred:

```ts
/** Renders the current pose once to an offscreen target with a transparent clear colour. */
captureTransparentFrame(opts: { widthPx: number; heightPx: number }): Promise<{ uri: string /* file://...png */ }>;
```

- Render: one extra frame of the `WebGPURenderer` into an offscreen texture with `alpha: true` clear, then `copyTextureToBuffer` → PNG encode. Whether `react-native-webgpu` exposes readback of an offscreen texture on iOS and Android must be read in `node_modules` before design is final (Law 2). On web: `canvas.toBlob('image/png')` with a transparent clear.
- Save/share: not installed today. Options: `expo-sharing` (share sheet, no Photos permission) or `expo-media-library` (save to Photos; iOS needs `NSPhotoLibraryAddUsageDescription`, add-only). Recommendation: share sheet first (no permission prompt, and the OS sheet already includes "Save Image").
- Strip metadata: the PNG writer writes no tEXt/EXIF chunks.

Token diffs: none.
