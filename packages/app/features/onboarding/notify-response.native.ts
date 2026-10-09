'use client';

import { useEffect, useRef } from 'react';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { readyBannerHold } from './notify-foreground';
import { deepLinkStore, readyLinkFromResponse, type ResponseLike } from './notify-route';

/**
 * Routes a tap on the hatch-ready notification to M12 (`/(home)/hatch?eggId=`,
 * M12 handoff B3). Mount once, in the root layout.
 *
 * Cold start: `Notifications.getLastNotificationResponse()`, the synchronous
 * read in expo-notifications 58.0.11, where `getLastNotificationResponseAsync`
 * is deprecated in its favour (build/NotificationsEmitter.d.ts). Warm taps:
 * `addNotificationResponseReceivedListener`. Both feed one store that dedupes
 * by request id and date, so a tap that both paths see routes once, and
 * `clearLastNotificationResponse()` stops a later remount replaying it.
 *
 * Before M01 has resolved its route the link is held. M01 arms it when the
 * boot route is `egg-ready`, `incubating` or `companion`, and the `(home)`
 * layout pushes it on mount, after M01's `router.replace` has committed. A
 * warm tap for the egg M12 already shows pushes nothing.
 *
 * Also installs the one foreground handler (M11 handoff "Effects on entry" 3):
 * while M11 holds its egg in `readyBannerHold`, that egg's ready notification
 * goes to the list without a banner or sound. Installed for the app's life and
 * never reset to `null`, which on Android would hide every foreground
 * notification instead of restoring the default.
 */
export function useReadyNotificationRouting(): void {
  const router = useRouter();
  const pathname = usePathname();
  const { eggId } = useGlobalSearchParams<{ eggId?: string }>();
  // The listener is installed once; it reads where the app is through a ref.
  const current = useRef({ pathname, eggId });
  useEffect(() => {
    current.current = { pathname, eggId };
  }, [pathname, eggId]);
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => readyBannerHold.behaviorFor(notification.request.content.data),
    });
    const handle = (response: ResponseLike) => {
      const result = readyLinkFromResponse(response);
      if (!result.ok) {
        if (result.reason === 'not-hatch-ready' && __DEV__) {
          console.warn(`[notify] ignored a notification tap: ${result.issues ?? 'bad payload'}`);
        }
        return;
      }
      const outcome = deepLinkStore.receive(result.link, current.current);
      if (outcome === 'navigate') {
        router.push({ pathname: result.link.pathname, params: { ...result.link.params } });
      }
      Notifications.clearLastNotificationResponse();
    };
    const last = Notifications.getLastNotificationResponse();
    if (last !== null) handle(last);
    const subscription = Notifications.addNotificationResponseReceivedListener(handle);
    return () => subscription.remove();
    // The router is a stable imperative handle; mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
