# M06 Notifications permission: handoff

Implementation contract for `platform` and the kit. Inputs: `01-research.md` to `07-a11y.md`, `docs/design/DECISIONS.md` (P2), §4.1 M06, §4.4 M23, ADR 0001 (local notifications only), Android guidance (https://developer.android.com/develop/ui/views/notifications/notification-permission), `docs/COPY_DECK.md`, `docs/DEVICE_CHECKS.md`.

## Blockers before implementation

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | `expo-notifications` is not installed (`docs/REPO_MAP.md` §10). Install, then read its permission and scheduling types before writing against them (Law 2). `Linking.openSettings()` is verified in the installed `react-native` at the same time | `platform` | OS prompt, scheduling, denied path |
| B2 | `NotificationPreview` (NEW) and `StatusRow` (NEW, contract in `M05/08-handoff.md`) with stories (R3) | kit | the sheet, the follow-up |
| B3 | `SheetSurface` gains `scheme?: 'system' \| 'night'` (default `'night'`, today's behaviour) and `closeLabel: string` (replacing the hardcoded "Close") | kit | daylit sheet, i18n |
| B4 | M10 (incubation choice) has no direction yet. M06 is presented over M10 after the Caller confirms 15/30/60 (P2), so it cannot be integrated until M10's handoff exists. The sheet itself can be built and storied now | `design-director` (M10) | integration |
| B5 | Shared kit daylit fixes (ghost label, `cta` variant) | kit | daylit sheet |

## Route and intent

Route `/(onboarding)/notify`, presented as an expo-router `formSheet` over M10. Shell: none on the sheet (P2). Shown only when the OS permission is still undecided; otherwise skipped silently.

| Priority | Intent |
|---|---|
| P1 | Ask for notification permission in context, about the one notification this egg will send |
| P2 | Make declining as easy as accepting |
| P3 | After a "Not now" or a denial, tell the Caller on M11 how to check on the egg, with a way back |
| P4 | Schedule the M23 notification when granted |

## Layout

Compact: bottom sheet at the medium detent, grabber visible. Inside, 16 pt padding: `NotificationPreview` card, title (two lines), body, Turn on, Not now (equal size, 12 pt apart), 16 pt above the safe bottom inset.

| Class / posture | Layout |
|---|---|
| Medium and up | centred form sheet, max 480 pt |
| XXL text | large detent, content scrolls, buttons pinned |
| Book posture | centred in the pane holding the M10 shell |
| Tabletop | presented in the upper pane; the button pair never straddles the hinge |

## Components

| Element | Component | Props | testID |
|---|---|---|---|
| Sheet | expo-router `formSheet` hosting `SheetSurface` | `scheme="system"` (NEW), `closeLabel` = `m06.grabber.a11y.label` (NEW), `title` = `m06.title`, `sheetAllowedDetents` medium + large | `m06-sheet` |
| Preview | `NotificationPreview` | see contract | `m06-preview` |
| Title | `Heading level={2}` `size="title"` | | `m06-title` |
| Body | `Text` `variant="body"` | by minutes | `m06-body` |
| Turn on | `Button` `variant="cta"` `size="lg"` `fullWidth` | | `m06-allow` |
| Not now | `Button` `variant="ghost"` `size="lg"` `fullWidth` | | `m06-later` |
| M11 follow-up | `StatusRow` item | `id="notify-off"`, `tone="neutral"`, `action` ask or settings | `status-notify-off` |

### `NotificationPreview` contract (R5)

```ts
/**
 * A static picture of an OS notification banner, used to show the Caller the
 * one message they are agreeing to. Not a real notification.
 */
export interface NotificationPreviewProps {
  appName: string;
  title: string;
  body: string;
  /** Relative time as the OS would show it, e.g. "now". */
  timeLabel: string;
  /** Spoken description of the whole card; the card's text is hidden from assistive tech. */
  accessibilityLabel: string;
}
```

White face, `concrete-200` keyline (decorative), 12 pt corner radius via the kit's `rounded` opt-in (this one surface is rounded because the OS banner is). No Caller name is ever passed in (lock-screen privacy, `01-research.md`). Stories: `Default`, `LongBody`, `Dark`, `LargeText`.

## Tokens

| Use | Daylit (`scheme="system"`, light) | Night |
|---|---|---|
| Sheet | `surface-raised` #FFFFFF | `night` |
| Title, body | `text` | #F8F8F8 |
| Preview card | #FFFFFF face, `text` #000000, keyline `concrete-200` | same card |
| Not now | `accent` | `royal-300` (kit) / `carolina-500` (`accent`) |
| Turn on | `cta` / `on-cta` | same tokens |
| Type | `type-title`, `type-body`, `type-label`; preview uses `type-caption` for app name and time, `type-body-strong` for the title | |

Measured pairs: `07-a11y.md`.

## States

| State | Behaviour | Copy IDs |
|---|---|---|
| Pre | sheet open; body by the minutes chosen on M10 | `m06.title`, `m06.body.15` / `.30` / `.60`, `m06.cta.allow`, `m06.cta.later`, `m06.grabber.a11y.label`; preview: `m06.preview.app_name`, `m06.preview.time`, `m23.notification.title`, `m23.notification.body`, `m06.preview.a11y.label` |
| Turn on → granted | OS prompt; on grant, schedule M23, close sheet, announce | `m06.granted.a11y.announce` |
| Turn on → denied | OS prompt; on deny, close sheet; M11 shows the status with the Settings action | `m11.status.notify_off`, `m11.status.notify_off.action.settings`, `.action.settings.a11y.hint` |
| Not now (button, swipe down, Escape, Android back) | close; no OS prompt; M11 shows the status with the ask action (reopens M06) | `m11.status.notify_off`, `m11.status.notify_off.action.ask` |
| Granted, scheduling failed | M11 status | `m11.status.schedule_failed` |
| Already decided | sheet never shows | — |

When the app is open, the H-Lynk LED still reads "Ready to hatch" (`hlynk.led.ready`) regardless of the permission.

## Motion and reduced motion

Platform `formSheet` presentation in both modes; the OS applies its own reduced presentation. No custom animation. Press: `motion-tap` / colour only.

## Empty, error, offline

- No empty state.
- Error: scheduling failure is reported on M11 (`m11.status.schedule_failed`), never as an alert on the sheet.
- Offline: irrelevant. Notifications are local and scheduled on the phone (ADR 0001); nothing goes to a server.

## Data

| Need | Source |
|---|---|
| Minutes chosen | M10 state, typed by `IncubationMinutesSchema` (`15 \| 30 \| 60`) in `@acme/core` |
| Fire time | the `EggRecord`'s `incubationEndsAt` (`@acme/core` `createEggRecord`), not `now + minutes` recomputed in the UI |
| Permission state | `expo-notifications` (after B1) |
| Schedule | one local notification per egg, id derived from `eggId` so a repeat call replaces rather than duplicates (M23 "one per egg, ever"); deep link to `/(home)/hatch` (M12) |
| Notification payload | zod-parsed on receipt (Law 5) |
| Status follow-up | `StatusRow` on M11, driven by the permission state and whether the OS prompt was ever shown |

## Accessibility contract

`07-a11y.md`: modal with inert background; initial focus on the title; preview is one image with `m06.preview.a11y.label`; Escape and Android back act as Not now; focus moves to M11's `h1` after close or after the OS prompt; buttons equal in size.

## Tests to write

| Kind | Test |
|---|---|
| Unit | sheet shows only when permission is undetermined |
| Unit | body copy selected by minutes (exhaustive over `15 \| 30 \| 60`) |
| Unit | granting schedules exactly one notification per `eggId`; calling twice leaves one; fire time equals `incubationEndsAt` |
| Unit | Not now and denied produce the two different M11 actions |
| Unit | no Caller name in any notification field |
| Unit (`packages/ui`) | `SheetSurface scheme="system"` follows the OS; `closeLabel` reaches the accessible name |
| Story | `NotificationPreview/*`; `SheetSurface/SystemScheme`; `StatusRow/NotifyOff` |
| Visual | sheet at 15/30/60, daylit and night, SE medium detent and XXL large detent |

## Device verification

Open; no device yet. Implementation proceeds with these pending. Full list: [`docs/DEVICE_CHECKS.md`](../../../DEVICE_CHECKS.md).

- [ ] Lock-screen truncation of `m23.notification.*` on iOS and Android.
- [ ] Modals on Android: back closes the sheet as Not now.
- [ ] VoiceOver and TalkBack: modal containment, focus after the OS prompt.
- [ ] Android 13+ runtime permission prompt and the repeated-denial block leading to the Settings action.
