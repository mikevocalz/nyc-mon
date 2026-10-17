# Device checks

## Device record

Measured 2026-10-17 on the bench device (USB adb serial `913949703467`). Commands run against the live device; values are verbatim.

| Fact | Value | How measured |
| --- | --- | --- |
| Model | Microsoft Surface Duo (1st gen), `ro.product.device` = `duo`, hardware `surfaceduo` | `adb shell getprop ro.product.model` → `Surface Duo`; `ro.product.manufacturer` → `Microsoft` |
| Android version | 14 (`ro.build.version.release`), SDK 34 (`ro.build.version.sdk`) | `adb shell getprop` |
| Build | `treble_arm64_bgN-userdebug 14 UP1A.231105.003.A1` — a Project Treble GSI, not stock Duo 12L (vendor fingerprint `surface/duo/duo:12/2022.902.48`) | `adb shell getprop ro.build.display.id` / `ro.build.fingerprint` |
| SoC / GPU | Snapdragon 855 platform (`ro.board.platform` = `msmnile`), Adreno 640 (`GLES: Qualcomm, Adreno (TM) 640, OpenGL ES 3.2 V@0502.0`) | `getprop`; `adb shell dumpsys SurfaceFlinger` GLES block |
| Display | "Built-in Screen" 2700×1800 (unfolded dual-panel), 400 dpi, single mode `2700×1800 @ 60.000004 Hz`; no alternative refresh rates | `adb shell dumpsys display` → `supportedModes`, `renderFrameRate 60.000004` |
| Frame deadline | 16,666,666 ns present deadline, appVsyncOff 1,000,000 ns | `dumpsys display` DisplayDeviceInfo |
| RAM | 5,647,472 kB total (~5.4 GiB usable) | `adb shell cat /proc/meminfo` → `MemTotal` |
| App package | `com.nycmon.app`, versionName 0.1.0, versionCode 1, minSdk 29, targetSdk 34 | `adb shell pm dump com.nycmon.app` |

Two consequences for the performance pass: the Duo has exactly one display mode, so 60 Hz is the only cadence it can present at (the pass's "more than 60 fps" goal needs different hardware), and the userdebug GSI keeps `adb shell perfetto` and `dumpsys` fully available without root.

The device record above and the release-build performance baseline in `docs/performance/baseline-duo-2026-10-17.md` were measured on this physical Surface Duo. Everything below still lists checks that remain unverified on hardware; most predate the baseline and cover screens the baseline did not touch. Do these checks before the matching milestone closes. Every `08-handoff.md` links back here.

Target matrix (BUILD_PROMPT_v3 §0C, §6 step 11): iPhone SE 3, iPhone 16 Pro Max, Pixel 8, plus one Android foldable (Pixel Fold or Galaxy Z Fold) and one Android tablet.

## F1 — Harlem city dataset v3 on the bench Duo (2026-10-17)

Lane `lane-v3e3` @ `23ec560`, release build verified on the physical Surface
Duo above (same method and honesty bar as the M0 baseline). Full report:
`docs/performance/v3-f1-2026-10-17.md`; artifacts:
`/Users/mikevocalz/nyc-mon-artifacts/f1-duo/`.

- [x] **v3 tile runs on hardware:** `harlem-apollo-20261017` confirmed inside the shipped bundle; city renders with no crash over an 84 s scripted walk.
- [x] **Frame timing at the walk window:** p50 36 ms / p90 48 / p95 53 / p99 61, janky 44.3 % (n = 3 457) — p50 identical to the v2 M0 baseline, p90+ ~5 ms better; janky share is window-sensitive, see report.
- [x] **Memory:** PSS 395 MB lobby → 630 MB scene start → 651 MB after walk (v2: 378 → 602 → 649).
- [x] **Load path:** cold start TotalTime median 1 472 ms (3 runs); START → first frame ≤ ~15 s fresh-install, ~6.4–7.0 s warm.
- [ ] **Device parse ms / city build ms, split:** PENDING — only a 1 617 ms combined worst frame is instrumented (needs a finer probe; not added in this lane).
- [ ] **Landmark identification in captured frames (Apollo marquee, E3):** PENDING — frames captured, visual ID belongs to the F3 critique pass.
- [ ] **iPhone SE 3 class run (spec D2):** PENDING — the Duo is the only bench device.

## Rendering

- [ ] **HolographicTerrain, NeonTide, CityHeightfield on native** (react-native-webgpu): render, present, touch lift, AppState pause. The iOS bundle includes `three/webgpu`, but nothing has rendered on a device. Android hasn't been bundled at all.
- [ ] **Frame budget:** 60 fps steady on iPhone SE 3 and Pixel 8, measured on device, not in Chrome.
- [ ] **Skia web workarounds** behave the same after a react-native-skia release with PRs #42/#44 (then delete `skia-vertices.web.ts`, `skia-color-space.web.ts`).

## Kit components

- [ ] **Avatar (corner-cut gradient), native:** Skia path and clipped `useImage` photos. These typecheck only.
- [ ] **Native CardSlider:** SwiftUI on iOS 17+, Material 3 carousels on Android.
- [ ] **Modals on Android:** the back button closes Dialog, Lightbox and BottomSheet. This was checked by reading code only.
- [ ] **Split view on iOS and Android:** iOS still uses `index.ios.tsx`; Android uses the moved `AdaptiveSplitView`.
- [ ] **Adaptive panes + fold module** (`@acme/ui/adaptive-panes`, the reserved-regions Kotlin module): tablet width classes, book and tabletop postures, a hinge that never splits a pane, tri-fold, and the Android nav rail. The Kotlin hasn't been built.

## H-Lynk chrome and Phase 1 screens

- [ ] **H-Lynk Core shell** on SE 3, Pro Max and Pixel 8: the bottom row fits (the SE budget is 139 pt), safe areas, and contrast of the red body under real display gamma.
- [ ] **M01 boot** routes in 240 ms or less from the MMKV snapshot.
- [ ] **VoiceOver and TalkBack** on M01–M07, plus Dynamic Type XXL, including the copy deck's estimated line and character limits (`docs/COPY_DECK.md`).
- [ ] **H-Lynk kit on device** (`packages/ui/hlynk`, verified only in Storybook on web so far):
  - LED rhythms on iOS and Android through Reanimated CSS animations: 4 s breath, `ready` two blinks every 6 s, `needsYou` three blinks every 10 s. Count the flashes on a recording; three a second is the limit (WCAG 2.3.1).
  - Scanner fan: the Skia wedge (`ScannerFan.native.tsx`) sweeps once at boot, stays inside the black head, never over the status bar; absent with Reduce Motion on.
  - Trackpad gestures on the responder system: tap activates, a 24 pt flick steps, a 600 ms hold commits, M13 pan deltas. Haptics: light tap, selection tick, success on commit.
  - VoiceOver: trackpad reads as adjustable; swipe up/down steps; the named commit action ("Choose this egg" on M08) appears in the rotor. TalkBack: the same actions in the actions menu.
  - Keys: Large Content Viewer on long-press at accessibility text sizes (iOS); disabled keys read "Available after start-up".
  - "H-Lynk on" announced once, queued behind current speech, only on the `booting` to `on` transition.
  - A 320 pt wide phone or a zoomed display: the trackpad shrinks, the keys stay 48 pt.
- [ ] **Lock-screen truncation** of the hatch notification (`m23.*`) on iOS and Android.

## Auth

- [ ] **Passkey ceremonies** on iOS and Android (associated domains and asset links).
- [ ] **Sign in with Apple and Google** in the Expo app (`@better-auth/expo` isn't installed yet).
- [ ] **Resend delivery:** the verification, reset and guardian-consent emails.
- [ ] **SMS through AWS SNS** (ADR 0004 §6): needs Mike's AWS account out of the SNS SMS sandbox, a registered toll-free or 10DLC origination number, and `AUTH_SMS_TRANSPORT=sns` with the AWS env names from `.env.example`. Then: phone verification and an SMS two-factor code delivered to a real US number and a real Canadian number; a `+1 876` (Jamaica) number refused before any send.
- [ ] **Headset sign-in** (ADR 0004 §9): a Meta Quest and an Apple Vision Pro each request a device code, the Caller approves it on the phone (M29), and the headset reads the same Mon through `/v1/me/mons`.
- [ ] **Tablet handoff:** the tablet scans the phone's QR (M30) and gets its own session; revoking it leaves the phone signed in. The code-approval fallback works on a tablet with no camera access.
- [ ] **Passkey on the family device** for an under-13 account after guardian consent (DECISIONS #17).

## Admin console

- [ ] **Responsive matrix** at 390, 768, 1280 and 1440 widths, plus foldable postures, on real hardware browsers (Safari iOS, Chrome Android).
