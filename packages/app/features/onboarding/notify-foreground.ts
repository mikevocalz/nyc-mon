import { createStore } from 'zustand/vanilla';
import { parseReadyNotificationData } from '../mon/ready-notification.ts';

/**
 * Foreground presentation of the hatch-ready notification, the pure half
 * (M11 handoff "Effects on entry" 3, M12 "Notification housekeeping"). The
 * native half (`notify-response.native.ts`) installs one
 * `Notifications.setNotificationHandler` that asks {@linkcode foregroundBehavior};
 * M11 marks its egg while it is on screen. No React, no expo-notifications,
 * so it runs under `node --test`.
 */

/** The request identifier `scheduleReadyNotification` sets, and the one M12 cancels and dismisses. */
export function readyNotificationId(eggId: string): string {
  return `egg-ready-${eggId}`;
}

/** expo-notifications 58.0.11 `NotificationBehavior`, minus the deprecated `shouldShowAlert`. */
export interface ForegroundBehavior {
  readonly shouldShowBanner: boolean;
  readonly shouldShowList: boolean;
  readonly shouldPlaySound: boolean;
  readonly shouldSetBadge: boolean;
}

/**
 * What expo-notifications does when no handler is set (NotificationsHandler.d.ts:
 * "shown with a banner, in the notification list, with a sound, and with the
 * badge"). The handler is installed once and never removed, because
 * `setNotificationHandler(null)` is not that default: on Android it hides
 * every foreground notification.
 */
export const SHOW_NOTIFICATION: ForegroundBehavior = {
  shouldShowBanner: true,
  shouldShowList: true,
  shouldPlaySound: true,
  shouldSetBadge: true,
};

/** M11 is already showing the ready state, so the banner would only double it; the list entry stays. */
export const QUIET_READY: ForegroundBehavior = {
  shouldShowBanner: false,
  shouldShowList: true,
  shouldPlaySound: false,
  shouldSetBadge: false,
};

/** Quiet only for a hatch-ready payload naming the egg M11 has on screen; everything else shows as usual. */
export function foregroundBehavior(data: unknown, onScreenEggId: string | null): ForegroundBehavior {
  if (onScreenEggId === null) return SHOW_NOTIFICATION;
  const parsed = parseReadyNotificationData(data);
  return parsed.ok && parsed.data.eggId === onScreenEggId ? QUIET_READY : SHOW_NOTIFICATION;
}

export interface ForegroundState {
  /** The egg M11 is showing, or `null` when M11 is not on screen. */
  readonly onScreenEggId: string | null;
}

/** Which egg's banner is held back. The app binds one ({@linkcode readyBannerHold}); tests make their own. */
export function createReadyBannerHold() {
  const store = createStore<ForegroundState>(() => ({ onScreenEggId: null }));

  /**
   * M11 calls this on mount with its egg and runs the returned release on
   * unmount. Release clears only its own egg, so a late cleanup from an
   * unmounted M11 never lifts the hold a newer M11 set.
   */
  function hold(eggId: string): () => void {
    store.setState({ onScreenEggId: eggId });
    return () => {
      if (store.getState().onScreenEggId === eggId) store.setState({ onScreenEggId: null });
    };
  }

  /** Read by the handler at the moment a notification arrives. */
  function behaviorFor(data: unknown): ForegroundBehavior {
    return foregroundBehavior(data, store.getState().onScreenEggId);
  }

  return { store, hold, behaviorFor };
}

/** The app's one hold, shared by M11 and the root layout's handler. */
export const readyBannerHold = createReadyBannerHold();
