'use client';

import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { APP_ORIGIN } from '@acme/auth';
import { auth, AUTH_BASE_URL } from '../onboarding/auth';
import { saveIO } from '../onboarding/save-store';
import { saveStorage } from '../onboarding/storage';
import { useMonStore } from '../mon/mon.store';
import { monIdentity } from '../companion/mon-identity';
import { useDevicePrefs } from '../settings/device-prefs.store';
import { msToNextMinute } from '../companion/minute-clock-math';
import { createCareSurfaceSync } from './care-surface-sync.ts';
import { careSurfacesFromSave } from './phase1-care-surfaces.ts';
import { clearMonCareSurfaces, publishMonCareSurfaces } from './publish-mon-care';
import { careConsentAllowed, careOwnershipChanges, careSaveIdentity, careSaveOwnedBy, rememberVerifiedCareOwner, verifyCareSaveRoster } from './care-surface-owner.ts';

/** Mount once at the app root, so care surfaces keep working outside H-Lynk. */
export function useCareSurfaces(): void {
  const session = auth().useSession();
  const pending = session.isPending;
  const callerId = session.data?.user.id ?? null;
  useEffect(() => {
    if (pending) return;
    if (callerId === null) {
      void clearMonCareSurfaces();
      return;
    }
    let live = true;
    let verifying = false;
    let lastVerification = { identity: '', at: -Infinity };
    const sync = createCareSurfaceSync({
      read: () => {
        const state = useMonStore.getState();
        // Raw deletion/consent cleanup can remove storage without a Mon-store
        // write. Never republish the store's stale in-memory save.
        const save = saveIO.read();
        if (!careSaveOwnedBy(saveStorage, save, callerId)) {
          const identity = careSaveIdentity(save);
          const now = Date.now();
          if (save && careConsentAllowed(save) && save.mons.length > 0 && !verifying
            && (lastVerification.identity !== identity || now - lastVerification.at >= 60_000)) {
            verifying = true;
            lastVerification = { identity, at: now };
            void verifyCareSaveRoster(save, callerId, {
              baseUrl: AUTH_BASE_URL,
              headers: Platform.OS === 'web' ? undefined : { origin: APP_ORIGIN },
              fetch,
            }).then((verified) => {
              const latest = saveIO.read();
              if (live && verified && latest && careSaveIdentity(latest) === identity) {
                rememberVerifiedCareOwner(saveStorage, latest, callerId);
                sync.refresh();
              }
            }).catch((error: unknown) => console.error('[mon-care] ownership verification failed', error))
              .finally(() => { verifying = false; });
          }
          return null;
        }
        return careSurfacesFromSave(save, state.activeMonInstanceId, Date.now(), (mon) => monIdentity(mon).name);
      },
      publish: publishMonCareSurfaces,
      clear: clearMonCareSurfaces,
      report: (error) => console.error('[mon-care] surface update failed', error),
    });
    const unsubscribeMon = useMonStore.subscribe(sync.refresh);
    const unsubscribeOwnership = careOwnershipChanges.subscribe(sync.refresh);
    const unsubscribePrefs = useDevicePrefs.subscribe((next, previous) => {
      if (next.monCalls !== previous.monCalls) sync.refresh();
    });
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { sync.refresh(); schedule(); }, msToNextMinute(Date.now()));
    };
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') { sync.refresh(); schedule(); }
      else if (next === 'background') clearTimeout(timer);
    });
    sync.refresh();
    schedule();
    return () => {
      live = false;
      clearTimeout(timer);
      subscription.remove();
      unsubscribeMon();
      unsubscribeOwnership();
      unsubscribePrefs();
      sync.stop();
    };
  }, [pending, callerId]);
}
