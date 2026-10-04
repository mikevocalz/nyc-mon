# M06 Notifications permission: copy

Owner: `ux-writer`. Inputs: `01-research.md`, `03-direction.md`, `04-components.md`, `06-critique.md`; `docs/design/DECISIONS.md` P2; §2.1, §4.1 M06, §4.4 M23 ("one notification per egg, ever"); Android guidance (https://developer.android.com/develop/ui/views/notifications/notification-permission). Voice and glossary: `docs/COPY_DECK.md`.

M06 is a sheet over M10, shown right after the Caller confirms 15, 30 or 60 minutes (P2), and only if the OS permission is still undecided. All strings are `voice: "ui"`. No character speaks; the egg is not a character.

## Rules

- Promise only what ships: one notification per egg (M23). No care reminders, no "updates", no "news".
- No appointment pressure. The egg waits; nothing suffers if the Caller is late (`M7 L388`: "No distress animation implies harm when the owner is away").
- No Caller name in any notification text: it would show on a lock screen a parent or classmate can see (`01-research.md`).
- Parent-readable: nothing a parent would flinch at if it lit up a child's phone.
- Never "device" (Law 9). The app's own name is NYC-MON in the notification; the OS draws it.

## Length budget

The sheet sits on SE at its medium detent. `type-title` about 26 characters a line; `type-body` 37. The lock-screen preview follows iOS banner truncation: title about 40 characters, body about 90 on SE (assumption, check on device).

## The notification (M23), shown in the preview

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m23.notification.title` | Your egg is ready to hatch | ui | 40 | The real M23 notification uses the same strings | Notification on ready: `V11 ¶49` |
| `m23.notification.body` | Open NYC-MON whenever you're ready. | ui | 90 | No "now", no "hurry". Tapping opens M12 | `V11 ¶49` |
| `m06.preview.app_name` | NYC-MON | ui | — | Drawn by `NotificationPreview` | — |
| `m06.preview.time` | now | ui | 6 | Matches the OS banner's own wording | — |
| `m06.preview.a11y.label` | Example notification from NYC-MON: Your egg is ready to hatch. | ui | — | `accessibilityRole="image"` | — |

## Pre (the ask)

| ID | String | Voice | Max | Notes |
|---|---|---|---|---|
| `m06.title` | One notification when your egg is ready | ui | 52 | `Heading`, two lines on SE |
| `m06.body.15` | That's in about 15 minutes. It's the only one we send, and your egg waits for you either way. | ui | 110 | Shown when the Caller picked 15 |
| `m06.body.30` | That's in about 30 minutes. It's the only one we send, and your egg waits for you either way. | ui | 110 | Picked 30 |
| `m06.body.60` | That's in about an hour. It's the only one we send, and your egg waits for you either way. | ui | 110 | Picked 60 |
| `m06.cta.allow` | Turn on notifications | ui | 30 | Orange CTA → OS prompt |
| `m06.cta.later` | Not now | ui | 20 | Ghost, same reach. Closes the sheet; no OS prompt |
| `m06.grabber.a11y.label` | Close | ui | — | Swipe-down behaves like "Not now" |

## Granted

The sheet closes; M11 shows. One polite announcement, no visual copy.

| ID | String | Voice | Max | Notes |
|---|---|---|---|---|
| `m06.granted.a11y.announce` | Notifications on. | ui | — | |

## Not now, or denied

Shown on M11 as one `StatusRow` item. The two cases differ in their action: after "Not now" the OS prompt was never shown, so Settings has nothing to toggle on iOS. After a denial (or Android's repeated-denial block), only Settings can change it.

| ID | String | Voice | Max | Notes |
|---|---|---|---|---|
| `m11.status.notify_off` | Notifications are off. Open the app to check on your egg. | ui | 64 | Both cases |
| `m11.status.notify_off.action.ask` | Turn on | ui | 16 | After "Not now": reopens M06 |
| `m11.status.notify_off.action.settings` | Open Settings | ui | 16 | After a denial: `Linking.openSettings()` (verify, Law 2) |
| `m11.status.notify_off.action.settings.a11y.hint` | Opens NYC-MON in your phone's Settings | ui | — | |
| `m11.status.schedule_failed` | We couldn't set the notification. Open the app to check on your egg. | ui | 72 | Permission granted but scheduling failed. Same action as "Not now" |

When the app is open, the H-Lynk status light still reads "Ready to hatch" (`hlynk.led.ready`, M01 copy).

## Reduced motion

No copy changes. The sheet uses the platform's own presentation.

## Slopmonster gate

`deslop.py` over every String cell: **5/5 CLEAN**. Rival-model cleanse (`tools/cleanse.sh`) not run.
