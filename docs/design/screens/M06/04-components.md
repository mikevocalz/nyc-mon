# M06 Notifications permission: components

| Element | Component / variant | Props | Status |
|---|---|---|---|
| Sheet | expo-router `formSheet` presentation hosting `SheetSurface` | `sheetAllowedDetents`, grabber visible | exists (`BottomSheet.tsx` `SheetSurface`) |
| Notification preview | `NotificationPreview` | `appName`, `title`, `body`, `time` | NEW |
| Title | `Heading` `size="title"` | | exists |
| Turn on | `Button` `variant="primary"` `tone="orange"` `size="lg"` | | exists |
| Not now | `Button` `variant="ghost"` `tone="royal"` `size="lg"` | | exists |
| Denied follow-up | `StatusRow` item + `Link` "Open Settings" | | NEW (see M05) |

## New component: `NotificationPreview`

A static picture of an OS notification banner, drawn with kit text on a white face, `concrete-200` keyline (decorative), 12 pt soft radius (`rounded` prop: this one thing is rounded because the OS banner is). `accessibilityRole="image"`, label reads the notification text. Stories `Default`, `LongBody`, `Dark`.

## Dependencies to verify (Law 2)

`expo-notifications` is not installed (`docs/REPO_MAP.md` §10). The OS prompt and the denied state need it.

## Token diffs

None beyond `docs/DESIGN_SYSTEM.md`.
