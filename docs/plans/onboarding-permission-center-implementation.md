# Final onboarding permissions

This implementation extends the NYC-Mon mobile-screen research from PR #36.

**Default preferences:** only **Notifications** is preselected. Location, Camera, Microphone, Motion & Orientation, and Save to Photos all start off. Switching a row on records an interest in asking for the OS permission; it does not claim OS access has been granted.

Flow: M10 confirms the egg and writes `permissions-pending`; M10's closing case advances to a full-page `/(onboarding)/permissions` route; Continue requests each selected OS permission sequentially, schedules the one egg-ready notification when possible, then replaces with `/(home)`. **Not now** does not invoke any OS permission request. It reads notification status, preserves the existing off/denied state convention, clears the pending marker, and navigates home. A cold restart with a valid new egg and pending marker resumes the optional final screen. Existing players without a pending marker are unaffected.

The requested native adapters are individual: notifications (existing helper), foreground-only location (expo-location), camera (expo-image-picker), microphone (expo-audio), device motion (expo-sensors), and save-only Photos access (expo-image-picker). The system photo picker does not need broad read permissions. Denials and unavailable capabilities never block the player, and blocked requests offer device Settings. Android 13 needs its notification channel before requesting the OS permission; the reused helper now does that.

Scope stays within shared `packages/app/features/onboarding` screen components and thin Expo Router routes; no new backend and no background location or background audio permission.

## Verification needed before release

- Update the pnpm lockfile with the workspace's real pnpm 12 / Expo SDK 58 install. Dependencies in `pnpm-workspace.yaml`, `apps/mobile/package.json`, and `packages/app/package.json` are declared, but lockfile regeneration and installing native modules require a working repository environment.
- Run `pnpm --filter @acme/app test`, `pnpm --filter @acme/app typecheck`, `pnpm --filter mobile typecheck`, `pnpm --filter mobile lint`, and Expo prebuild/config verification.
- Device-test fresh install, existing player, resumed pending egg after termination, iOS notification grant/deny/provisional, Android 13+ permission channel, camera/mic/location/motion/photo permissions individually, permanent denial > Settings, and skip without any OS prompt.
- Verify the full native build on a conventional phone, Android book foldable/tabletop posture and an iPad or dual-screen device (safe areas, keyboard, accessibility text size, VoiceOver/TalkBack).
- Verify egg-ready notification is scheduled only once per egg and tap still deep-links to hatch.
- Review new native permission strings for app-store privacy policies and age/guardian-consent requirements.

**Status:** Code in a draft implementation PR. Test and real-device results are not yet verified.
