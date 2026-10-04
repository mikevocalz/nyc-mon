# M01 Boot / power-on: components

All parts from `@acme/ui` (R3). NEW items are specified in `docs/design/hlynk/DIRECTION.md` and need stories first.

| Element | Component / variant | Props | Status |
|---|---|---|---|
| Frame | `HLynkShell` | `tier="core"`, `power` `'off' → 'booting' → 'on'`, `scheme` from time-of-day adapter, `reducedMotion` from sim-core adapter | NEW |
| Scanner head + emitter + fan | `ScannerLed` | `tier="core"`, `state="boot"`, `fan` (ignored under reduced motion), then the destination state | NEW |
| Screen | `HLynkScreen` | `aspect="3:4"`; child is the destination's first frame | NEW |
| Trackpad | `Trackpad` | `tier="core"`, `disabled` during boot (ring at `apple-900`) | NEW |
| Keys | `HLynkKey` `role` home / menu / back / forward | `tier="core"`, all disabled during boot | NEW |
| Safe areas | `SafeArea` | top + bottom | exists (story needed) |
| First-run hand-off | `FadeIn` / `ScaleIn` | needs `reducedMotion` prop | variant needed |
| Offline line (first run) | `Text` `variant="caption"` `tone="muted"` | inside M02, not M01 | exists |

## New variants or components

- `HLynkShell` story `PowerOn` (full and reduced), `FirstRunHandOff`.
- `ScannerLed` story `BootFan`.
- `motion.tsx` presets gain `reducedMotion` (authored sibling per `docs/DESIGN_SYSTEM.md` motion table).

## Token diffs

Uses the `hlynk.core` group and `led` tokens in `docs/DESIGN_SYSTEM.md` (Decision #16: red `apple-600` body, black head and controls, `apple-500` emitter and ring). No other change.
