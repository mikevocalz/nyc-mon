'use client';

import { useEffect } from 'react';
import { AppState, Linking } from 'react-native';
import { useInstanceStore, useStore } from '@acme/ui';
import { announcePolitely } from '../onboarding/announce';
import { copy } from '../onboarding/copy';
import { getNotifyPermission, requestNotifyPermission } from '../onboarding/notify-permission';
import { cancelAllCareNotifications } from '../mon-space/care-notifications';
import { notifyToggleAction, type NotifyPermissionState } from './device-prefs-model.ts';
import { useDevicePrefs } from './device-prefs.store';

/**
 * Settings "Mon calls" (D20b): a local alert for each real call, off until
 * the Caller opts in, separate from Egg alerts. It shares the one OS
 * permission with Egg alerts, so the actions are the same: ask when never
 * asked, open the phone's Settings when the OS said no. Turning it on also
 * marks Mon Space's one-time ask as answered. Turning it off cancels every
 * pending call at once; the next care tick schedules them again when it is on.
 */
export function useMonCallsToggle() {
  const store = useInstanceStore<{ permission: NotifyPermissionState | null }>(() => ({ permission: null }));
  const permission = useStore(store, (s) => s.permission);
  const wanted = useDevicePrefs((s) => s.monCalls);

  useEffect(() => {
    let live = true;
    const read = () => void getNotifyPermission().then((p) => {
      if (live) store.setState({ permission: p });
    });
    read();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') read();
    });
    return () => {
      live = false;
      sub.remove();
    };
  }, [store]);

  const known = permission ?? 'undetermined';
  const on = wanted && known === 'granted';

  const turnOn = () => {
    const prefs = useDevicePrefs.getState();
    prefs.set('monCalls', true);
    prefs.set('monCallsAsked', true);
  };

  const set = async (wantOn: boolean) => {
    switch (notifyToggleAction(wantOn, known)) {
      case 'disable':
        useDevicePrefs.getState().set('monCalls', false);
        await cancelAllCareNotifications();
        break;
      case 'enable':
        turnOn();
        break;
      case 'request': {
        const next = await requestNotifyPermission();
        store.setState({ permission: next });
        if (next === 'granted') turnOn();
        break;
      }
      case 'open-settings':
        turnOn();
        await Linking.openSettings().catch(() => undefined);
        return;
    }
    announcePolitely(copy('settings.value.a11y', {
      label: copy('settings.mon_calls.label'),
      value: copy(useDevicePrefs.getState().monCalls && store.getState().permission === 'granted' ? 'settings.on' : 'settings.off'),
    }));
  };

  return {
    available: permission !== 'unsupported',
    on,
    denied: known === 'denied',
    set,
    openSettings: () => void Linking.openSettings().catch(() => undefined),
  };
}
