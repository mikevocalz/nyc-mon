'use client';

import { useEffect } from 'react';
import { AppState, Linking } from 'react-native';
import { useInstanceStore, useStore } from '@acme/ui';
import { announcePolitely } from '../onboarding/announce';
import { copy } from '../onboarding/copy';
import {
  cancelReadyNotifications, getNotifyPermission, requestNotifyPermission,
} from '../onboarding/notify-permission';
import { useOnboarding } from '../onboarding/onboarding.store';
import { notificationsOn, notifyToggleAction, type NotifyPermissionState } from './device-prefs-model.ts';
import { useDevicePrefs } from './device-prefs.store';

/**
 * M19 Egg alerts. The switch reads on when the Caller wants alerts and the
 * OS allows them. Turning it on asks the OS when it never asked, or opens
 * the phone's Settings when the OS said no; turning it off cancels the
 * scheduled alert and stops new ones (scheduleReadyNotification checks the
 * preference). The permission is re-read whenever the app comes back to the
 * foreground, so a change made in the phone's Settings shows at once.
 * `available` is false on web, where the app never notifies.
 */
export function useNotifyToggle() {
  const store = useInstanceStore<{ permission: NotifyPermissionState | null }>(() => ({ permission: null }));
  const permission = useStore(store, (s) => s.permission);
  const wanted = useDevicePrefs((s) => s.notifications);

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
  const on = notificationsOn({ notifications: wanted, haptics: true, sound: true, forceReducedMotion: false }, known);

  const set = async (wantOn: boolean) => {
    const prefs = useDevicePrefs.getState();
    switch (notifyToggleAction(wantOn, known)) {
      case 'disable':
        prefs.set('notifications', false);
        await cancelReadyNotifications();
        break;
      case 'enable':
        prefs.set('notifications', true);
        useOnboarding.getState().setNotifyOff(undefined);
        break;
      case 'request': {
        const next = await requestNotifyPermission();
        store.setState({ permission: next });
        if (next === 'granted') {
          prefs.set('notifications', true);
          useOnboarding.getState().setNotifyOff(undefined);
        } else if (next === 'denied') {
          useOnboarding.getState().setNotifyOff('denied');
        }
        break;
      }
      case 'open-settings':
        prefs.set('notifications', true);
        await Linking.openSettings().catch(() => undefined);
        return;
    }
    announcePolitely(copy('settings.value.a11y', {
      label: copy('settings.notify.label'),
      value: copy(useDevicePrefs.getState().notifications && store.getState().permission === 'granted' ? 'settings.on' : 'settings.off'),
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
