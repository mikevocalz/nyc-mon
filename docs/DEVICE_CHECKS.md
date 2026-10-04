# Device checks

Everything below has passed typecheck, unit tests and web/Storybook screenshots, but has **not been run on a phone, tablet, foldable or simulator**. No device is set up yet. Do these checks before the matching milestone closes. Every `08-handoff.md` links back here.

Target matrix (BUILD_PROMPT_v3 §0C, §6 step 11): iPhone SE 3, iPhone 16 Pro Max, Pixel 8, plus one Android foldable (Pixel Fold or Galaxy Z Fold) and one Android tablet.

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
