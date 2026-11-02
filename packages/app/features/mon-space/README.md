# Mon care surfaces

This package provides the keychain snapshot builder, WidgetKit/App Group bridge,
and opt-in notification planning/reconciliation APIs. The widget can render a
published snapshot and advances its calling indicator on its own timeline.

The mobile root mounts `useCareSurfaces` while a Caller is signed in. It reads
the existing Mon store after writes/actions, on minute boundaries, on foreground
return and when Mon calls preferences change. `phase1CareSurfaces` advances the
existing Phase 1 simulation without persisting another copy and publishes live
hearts, attention and sleep state. It predicts hunger, energy and social calls
from that simulation's real events over the next 24 hours. Switching Mons,
removing the active Mon or signing out clears the previous widget/schedule.

The current Phase 1 simulation has no cold, poop, bedtime, false-call or pause
model. Those fields remain inactive; this adapter does not introduce new care
rules, placeholder core APIs or a save-format migration. The `/mon-space` widget
and notification URL now opens the existing H-Lynk companion care screen and
selects the named Mon when it is still present in the save.

External surfaces also require verified save ownership and approved/not-required
consent. A fresh empty save is bound when its Caller is created under a resolved
authenticated session. Existing saves require the authenticated `/v1/me/mons`
roster to confirm every local Mon; a different account can never claim a retained
save merely by signing in. The ownership record lives beside the save, survives
same-account sign-out/offline resume, and is cleared on account deletion or denied
consent reset. Server-verified Mon-set changes require verification again.
Unverified/offline legacy saves remain private until that proof succeeds.
Widget links hold their Mon intent during the bounded ownership check, and honor
authentication and consent before opening care.

The meal-reminder removal and legacy-reminder cleanup, Mon calls preference,
notification permission/deep-link handling, and widget extension configuration
remain independent of other care-engine work. Enabling Mon calls immediately
reconciles the real predictions when OS notification permission is granted.

Native verification still requires an iOS simulator/device and provisioned App
Group: confirm snapshot writes, widget reloads, and notification delivery. The
Swift timeline regression test runs only on macOS with the iOS simulator SDK;
Linux test runs report that check as skipped.
