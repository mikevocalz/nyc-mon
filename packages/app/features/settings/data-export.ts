'use client';

import { useInstanceStore, useStore } from '@acme/ui';
import { announcePolitely } from '../onboarding/announce';
import { auth } from '../onboarding/auth';
import { copy } from '../onboarding/copy';
import { SAVE_KEY } from '../onboarding/onboarding.store';
import { saveStorage } from '../onboarding/storage';
import { buildDataExport, dataExportFileName, rawSaveForExport, type ExportAccount } from './data-export-model.ts';
import { devicePrefs } from './device-prefs.store';
import { shareExport } from './share-export';

interface SessionUser {
  email?: unknown;
  name?: unknown;
  birthYear?: unknown;
  createdAt?: unknown;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : v instanceof Date ? v.toISOString() : null);

/**
 * M19 Download your data: the device save, these settings and, when signed
 * in, the account record and sign-in methods, shared as one JSON file
 * through the OS share sheet. Never throws.
 */
export function useDataExport(user: SessionUser | null) {
  const store = useInstanceStore<{ exporting: boolean; failed: boolean }>(() => ({ exporting: false, failed: false }));
  const state = useStore(store);

  const run = async () => {
    if (store.getState().exporting) return;
    store.setState({ exporting: true, failed: false });
    let account: ExportAccount | null = null;
    let accountUnavailable = false;
    if (user !== null) {
      let methods: string[] = [];
      try {
        const listed = await auth().listAccounts();
        if (listed.ok) methods = listed.data.map((a) => a.providerId);
        else accountUnavailable = true;
      } catch {
        accountUnavailable = true;
      }
      account = {
        email: str(user.email),
        name: str(user.name),
        birthYear: typeof user.birthYear === 'number' ? user.birthYear : null,
        createdAt: str(user.createdAt),
        signInMethods: methods,
      };
    }
    const nowMs = Date.now();
    const data = buildDataExport({
      save: rawSaveForExport(saveStorage.getString(SAVE_KEY)),
      prefs: devicePrefs(),
      account,
      accountUnavailable,
      nowMs,
    });
    const ok = await shareExport(JSON.stringify(data, null, 2), dataExportFileName(nowMs), copy('settings.export.title'));
    store.setState({ exporting: false, failed: !ok });
    announcePolitely(copy(ok ? 'settings.export.done.a11y' : 'settings.export.error'));
  };

  return { ...state, run };
}
