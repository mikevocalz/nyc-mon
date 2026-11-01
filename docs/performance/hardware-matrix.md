# Hardware matrix — where the perf numbers stand (2026-10-18)

All on-device numbers in this repo (`baseline-duo-2026-10-17.md`,
`present-tail-2026-10-18.md`, `vd-lane-2026-10-18.md`, `gpu-budget-*`,
`worklet-ab-*`) come from **one device**: the Surface Duo 1
(2700×1800, ~60 Hz, Snapdragon 855-class, Android 14). That's the lane
constraint (`udont run any sim` — physical hardware only, no emulator).

## Runnable today

| device | state | what it can measure |
| --- | --- | --- |
| Surface Duo 1 (`913949703467`, adb) | connected | release APK via `apps/mobile/android` `:app:assembleMobileRelease`, `EXPO_PUBLIC_GAME_PERF=1` probe (interval/render/present p50+p90, tris, draws, buffer), `dumpsys gfxinfo framestats`, thermal verdicts. This is the full matrix row. |
| Mike's iPhone 17 Pro (`00008150-...`, paired) | **not reachable** (USB/network tunnel disconnected) | once cabled: same probe exists cross-platform — build a release `.app` for device, `GAME_PERF` logs to console, `os_log`/Xcode Instruments for the present side. Needs the phone on USB; nothing else to set up. |

## The matrix gap, honestly

- **No second Android.** Every vsync-lock, AHB-pool and TSL-encode
  conclusion is Duo-1-only. The AHB mailbox path
  (`EXPO_PUBLIC_GAME_SURFACE=ahb`) is explicitly opt-in because it's
  unproven on other vendors — a Mali/Exynos or a Quest device may have a
  different swapchain story entirely.
- **iOS untested.** The worklet-vs-JS and TextureView-vs-AHB findings are
  Android-shaped. iOS uses a Metal swapchain behind the same canvas —
  likely healthy, but unmeasured.
- **60fps verdict is device-bound.** render() ≈ 18 ms at ~422k tris is a
  Duo-1 encode number; a 2023+ flagship probably clears the gate. The
  matrix needs one newer Android before calling 60 unreachable generally.

## To close the gap (Mike)

1. Cable the iPhone → argent `list-devices` picks it up → same flag set
   through an EAS/dev-client or local release build.
2. Any newer Android on USB → same APK installs as-is, no rebuild needed
   for the default-tier row; the flag set is baked per-APK for the
   lean/AHB rows.
