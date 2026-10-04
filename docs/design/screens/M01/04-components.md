# M01 Boot / power-on: components

All parts from `@acme/ui` (R3). NEW items are specified in `docs/design/hlynk/DIRECTION.md` and need stories first.

| Element | Component / variant | Props | Status |
|---|---|---|---|
| Frame | `HLynkShell` | `tier="entry"`, `power` `'off' → 'booting' → 'on'`, `scheme` from time-of-day adapter, `reducedMotion` from sim-core adapter | NEW |
| Status lens | `ScannerLed` | `state="boot"` then the destination state | NEW |
| Screen | `HLynkScreen` | `aspect="3:4"`; child is the destination's first frame | NEW |
| Trackpad | `Trackpad` | `disabled` during boot | NEW |
| Keys | `HLynkKey` ×4 | all inert | NEW |
| Safe areas | `SafeArea` | top + bottom | exists (story needed) |
| First-run hand-off | `FadeIn` / `ScaleIn` | needs `reducedMotion` prop | variant needed |
| Offline line (first run) | `Text` `variant="caption"` `tone="muted"` | inside M02, not M01 | exists |

## New variants or components

- `HLynkShell` story `PowerOn` (full and reduced), `FirstRunHandOff`.
- `motion.tsx` presets gain `reducedMotion` (authored sibling per `docs/DESIGN_SYSTEM.md` motion table).

## Token diffs

Uses the `hlynk.*` group and `led-*` tokens proposed in `docs/DESIGN_SYSTEM.md`. No other change.
