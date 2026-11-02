'use client';

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { APP_ORIGIN } from '@acme/auth';
import { auth, AUTH_BASE_URL } from '../onboarding/auth';
import { saveIO } from '../onboarding/save-store';
import { queuedCount } from './sync-model';
import { createSyncTransport } from './sync-transport';
import { setSyncTransport, syncNow } from './sync.store';

/** The transport for this app: the admin host, the session cookie, and native's `origin: nycmon://`. */
export function createAppSyncTransport() {
  return createSyncTransport({
    baseUrl: AUTH_BASE_URL,
    // Native fetch sets no Origin; the `/v1` routes check it against the app's scheme.
    headers: Platform.OS === 'web' ? undefined : { origin: APP_ORIGIN },
    fetch: (url, init) => fetch(url, init),
    readSave: () => saveIO.read(),
  });
}

/**
 * Keeps the M21 transport in step with the session: set while a Caller is
 * signed in, cleared when the session goes. When the session appears with
 * writes waiting, it sends them. Mount once, at the app root.
 */
export function useSyncSession(): void {
  const session = auth().useSession();
  const pending = session.isPending;
  const signedIn = session.data?.user != null;
  useEffect(() => {
    if (pending) return;
    if (!signedIn) {
      setSyncTransport(null);
      return;
    }
    setSyncTransport(createAppSyncTransport());
    if (queuedCount(saveIO.read()?.queue) > 0) {
      // A rejection here is a HatchIntegrityError (Law 6): report it, never hide it.
      void syncNow().catch((error: unknown) => console.error('[sync] sign-in sync failed', error));
    }
  }, [pending, signedIn]);
}
