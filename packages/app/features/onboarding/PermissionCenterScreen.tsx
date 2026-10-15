'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Heading, SafeArea, Switch, Text } from '@acme/ui';
import { ScrollView, View } from '@acme/ui/tw';
import { selectPendingEgg, useMonStore } from '../mon/mon.store';
import { copy } from './copy';
import { getNotifyPermission, scheduleReadyNotification } from './notify-permission';
import { getDevicePermission, requestDevicePermission } from './permission-center-api';
import {
  DEFAULT_SELECTED_PERMISSIONS,
  PERMISSION_COPY,
  PERMISSION_IDS,
  requestSelectedPermissions,
  type PermissionAccess,
  type PermissionId,
} from './permission-center-model';
import { useOnboarding } from './onboarding.store';

const STATUS: Record<PermissionAccess, string> = {
  undetermined: 'Not requested',
  granted: 'Allowed on this device',
  denied: 'Not allowed',
  blocked: 'Change in device settings',
  unavailable: 'Unavailable on this device',
};

/**
 * Final full-page onboarding step. A toggle records interest, NOT a grant.
 * The only default selection is Notifications. Continue invokes one native
 * permission request at a time; Not now invokes none. Either path enters home.
 * Access for unselected capabilities can be requested later at feature entry.
 */
export function PermissionCenterScreen() {
  const router = useRouter();
  const pending = useMonStore(selectPendingEgg);
  const setNotifyOff = useOnboarding((s) => s.setNotifyOff);
  const setPermissionsPending = useOnboarding((s) => s.setPermissionsPending);
  const local = useMemo(() => createStore<{
    selected: PermissionId[];
    statuses: Partial<Record<PermissionId, PermissionAccess>>;
    busy: boolean;
  }>(() => ({ selected: [...DEFAULT_SELECTED_PERMISSIONS], statuses: {}, busy: false })), []);
  const selected = useStore(local, (state) => state.selected);
  const statuses = useStore(local, (state) => state.statuses);
  const busy = useStore(local, (state) => state.busy);
  const inFlight = useRef(false);

  useEffect(() => {
    let live = true;
    void Promise.all(
      PERMISSION_IDS.map(async (id) => {
        try {
          return [id, await getDevicePermission(id)] as const;
        } catch {
          return [id, 'unavailable'] as const;
        }
      }),
    ).then((items) => {
      if (live) local.setState({ statuses: Object.fromEntries(items) as Record<PermissionId, PermissionAccess> });
    });
    return () => { live = false; };
  }, [local]);

  const finish = () => {
    setPermissionsPending(false);
    // Replace so Android Back cannot re-open onboarding and re-prompt.
    router.replace('/(home)');
  };

  const choose = (id: PermissionId, checked: boolean) => {
    local.setState(({ selected: before }) => ({ selected: checked
      ? before.includes(id) ? before : [...before, id]
      : before.filter((name) => name !== id) }));
  };

  const finishNotifications = async (outcome: PermissionAccess) => {
    if (outcome === 'granted') {
      const egg = pending?.egg;
      const scheduled = egg && egg.incubationEndsAt > Date.now()
        ? await scheduleReadyNotification({
            eggId: egg.eggId,
            endsAtMs: egg.incubationEndsAt,
            title: copy('m23.notification.title'),
            body: copy('m23.notification.body'),
          })
        : true;
      setNotifyOff(scheduled ? undefined : 'schedule-failed');
    } else {
      setNotifyOff(outcome === 'denied' || outcome === 'blocked' ? 'denied' : 'not-now');
    }
  };

  const notNow = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    local.setState({ busy: true });
    try {
      // OS read only: Skip never presents a native permission prompt.
      const notification = await getNotifyPermission();
      setNotifyOff(notification === 'granted' ? undefined : notification === 'denied' ? 'denied' : 'not-now');
    } catch {
      setNotifyOff('not-now');
    } finally {
      finish();
    }
  };

  const continueSetup = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    local.setState({ busy: true });
    try {
      const results = await requestSelectedPermissions(selected, requestDevicePermission, (id, result) => {
        local.setState(({ statuses: before }) => ({ statuses: { ...before, [id]: result } }));
      });
      if (selected.includes('notifications')) {
        await finishNotifications(results.notifications ?? 'unavailable');
      } else {
        const notification = await getNotifyPermission();
        setNotifyOff(notification === 'granted' ? undefined : notification === 'denied' ? 'denied' : 'not-now');
      }
    } catch {
      // Native permission failure cannot lock a Caller out of the game.
      setNotifyOff('not-now');
    } finally {
      finish();
    }
  };

  return (
    <SafeArea className="flex-1 bg-bg">
      <ScrollView className="flex-1" contentContainerClassName="items-center gap-5 px-4 py-6">
        <View className="w-full gap-5" style={{ maxWidth: 660 }} testID="onboarding-permissions">
          <View className="gap-2">
            <Text variant="caption" tone="muted">H-LYNK SETUP / FINAL STEP</Text>
            <Heading level={1} size="display-sm">Ready for NYC?</Heading>
            <Text tone="muted">Choose what to enable. Notifications are selected; everything else is your call.</Text>
          </View>
          <View className="gap-1 border-y border-concrete-400">
            {PERMISSION_IDS.map((id) => {
              const item = PERMISSION_COPY[id];
              const status = statuses[id];
              return (
                <View key={id} className="gap-1 border-b border-concrete-400 py-4" testID={'permission-' + id}>
                  <Switch
                    value={selected.includes(id)}
                    onChange={(checked) => choose(id, checked)}
                    label={item.title}
                    disabled={busy}
                  />
                  <Text variant="caption" tone="muted">{item.detail}</Text>
                  {status ? <Text variant="caption" tone="muted">{STATUS[status]}</Text> : null}
                  {status === 'blocked' ? (
                    <View className="self-start">
                      <Button
                        variant="outline"
                        title="Open device settings"
                        disabled={busy}
                        onPress={() => { void Linking.openSettings().catch(() => {}); }}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
          <View className="gap-3">
            <Button
              title={selected.length === 0 ? 'Continue' : 'Continue with ' + selected.length + ' selected'}
              variant="cta"
              size="lg"
              fullWidth
              loading={busy}
              testID="permissions-continue"
              onPress={() => { void continueSetup(); }}
            />
            <Button
              title="Not now"
              variant="ghost"
              size="lg"
              fullWidth
              disabled={busy}
              testID="permissions-skip"
              onPress={() => { void notNow(); }}
            />
            <Text variant="caption" tone="muted">
              Denying access won’t block your Mon. You can enable permissions later in device settings or when you use a feature.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeArea>
  );
}
