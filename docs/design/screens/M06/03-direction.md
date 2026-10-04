# M06 Notifications permission: direction

Inputs: `01-research.md`, `docs/design/DECISIONS.md` (P2), §4.1 M06, M23 ("one notification per egg, ever"), Android guidance (https://developer.android.com/develop/ui/views/notifications/notification-permission). Route `/(onboarding)/notify`, presented as a sheet over M10. Shell: none on the sheet. States: pre / granted / denied.

## Position (P2)

M10 incubation choice confirmed → **M06 sheet** → OS prompt → M11 Incubating. If permission was already decided, the sheet does not show. It is no longer in the M02–M07 onboarding run.

## The one move

The sheet shows the one notification the Caller will ever get for this egg, as it will appear on the lock screen, with the time they just picked: "ready in about 30 minutes". The ask is about that one message.

## Layout

```
 (M10 in its H-Lynk shell, dimmed behind)
 ┌──────────────────────────────┐
 │ ─── grabber                  │
 │ ┌──────────────────────────┐ │
 │ │ NYC-MON          now      │ │  lock-screen preview card, white face
 │ │ Your egg is ready to hatch│ │  copy from ux-writer (M23); no Caller name
 │ └──────────────────────────┘ │
 │ One notification when it's   │  type-title
 │ ready. Nothing else.         │
 │ [■■■■ Turn on ■■■■■■■■■■■■■] │  orange CTA → OS prompt
 │ [   Not now                ] │  ghost, equal reach
 └──────────────────────────────┘
```

The preview never shows the Caller name (lock-screen leakage, `01-research.md`).

## States

| State | Treatment |
|---|---|
| pre | as drawn |
| granted | sheet closes, M11 shows; the `incubating` LED chip carries on |
| denied / Not now | sheet closes; M11 shows a one-line `StatusRow` item: you'll need to open the app to see when it's ready, with an "Open Settings" link (deep link via `Linking.openSettings()`, verify in RN before use, Law 2). The H-Lynk LED still reports `ready` when the app is open |

## Copy constraints for `ux-writer`

Promise only what ships (M23: one per egg). No appointment pressure: nothing implies the egg suffers if they are late (`M7 L388`, research risk). Parent-readable.

## Motion

Sheet: platform form sheet presentation. Reduced motion: the platform's own.

## No-list

- No ask before the egg exists (P2).
- No care reminders promised.
- No guilt, no countdown on the sheet.
- No "device" (Law 9).
