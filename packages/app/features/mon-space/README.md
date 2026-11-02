# Mon care surfaces

This package provides the keychain snapshot builder, WidgetKit/App Group bridge,
and opt-in notification planning/reconciliation APIs. The widget can render a
published snapshot and advances its calling indicator on its own timeline.

`publishMonCareSurfaces` accepts a caller-supplied `MonCareViewLike` and real-call
predictions. It is an integration boundary, not a care simulation engine. There
is currently no production care-tick/action caller wired to this function, so
live care snapshots and predicted Mon call notifications are not yet produced
by the running app. A future care-store integration must call it after ticks and
actions, and call `clearMonCareSurfaces` when the active Mon is cleared. This
feature does not add placeholder core APIs or a save-format migration.

The meal-reminder removal and legacy-reminder cleanup, Mon calls preference,
notification permission/deep-link handling, and widget extension configuration
are active independently of that future integration. Enabling the preference
does not itself produce call predictions.

Native verification still requires an iOS simulator/device and provisioned App
Group: confirm snapshot writes, widget reloads, and notification delivery. The
Swift timeline regression test runs only on macOS with the iOS simulator SDK;
Linux test runs report that check as skipped.
