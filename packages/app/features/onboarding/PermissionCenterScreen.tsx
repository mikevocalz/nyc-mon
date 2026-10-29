'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { Linking, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Heading, SafeArea, Switch, Text } from '@acme/ui';
import { ScrollView, View } from '@acme/ui/tw';
import { useReservedRegions } from '@acme/ui/adaptive-panes';
import { isWholeWindow, permissionViewport } from './permissions-layout';
import { selectPendingEgg, useMonStore } from '../mon/mon.store';
import { copy, type OnboardingCopyId } from './copy';
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

const STATUS: Record<PermissionAccess, OnboardingCopyId> = {
  undetermined: 'perm.status.undetermined',
  granted: 'perm.status.granted',
  denied: 'perm.status.denied',
  blocked: 'perm.status.blocked',
  unavailable: 'perm.status.unavailable',
};

/**
 * Final full-page onboarding step. A toggle records interest, NOT a grant.
 * The only default selection is Notifications. Continue invokes one native
 * permission request at a time; Not now invokes none. Either path enters home.
 * Access for unselected capabilities can be requested later at feature entry.
 */
export function PermissionCenterScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const regions = useReservedRegions();
  const viewport = permissionViewport(width, height, regions);
  // Breakpoint classes read the whole window. Inside one segment of a split
  // foldable they would describe the wrong width, so the tablet layout only
  // applies when the form has the whole window to itself.
  const tablet = isWholeWindow(viewport, width, height);
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
    <View className="flex-1 bg-bg">
      <View style={{ position: 'absolute', ...viewport }}>
        <SafeArea className="flex-1">
          <ScrollView
            className="flex-1"
            contentContainerClassName={tablet ? 'grow items-center gap-5 px-4 py-6 md:px-8 md:py-10' : 'items-center gap-5 px-4 py-6'}
          >
            {/* Phone: one column capped at 660. Tablet portrait: a wider column,
                top-aligned, actions on the bottom edge. Landscape: the six
                permissions in two columns, actions in one row below them. */}
            <View
              className={tablet
                ? 'w-full max-w-[660px] gap-5 md:flex-1 md:gap-8 md:portrait:max-w-[760px] md:landscape:max-w-[1080px]'
                : 'w-full max-w-[660px] gap-5'}
              testID="onboarding-permissions"
            >
              <View className="gap-2">
                <Text variant="caption" tone="muted">{copy('perm.step')}</Text>
                {/* Tablet: one rung up, like the other onboarding headings. */}
                <Heading level={1} size="display-sm" className={tablet ? 'md:text-display-lg' : undefined}>{copy('perm.title')}</Heading>
                <Text tone="muted" className={tablet ? 'md:text-lg' : undefined}>{copy('perm.intro')}</Text>
              </View>
              <View
                className={tablet
                  ? 'gap-1 border-y border-concrete-400 md:landscape:flex-row md:landscape:flex-wrap md:landscape:justify-between md:landscape:gap-y-0'
                  : 'gap-1 border-y border-concrete-400'}
              >
                {PERMISSION_IDS.map((id, index) => {
                  const item = PERMISSION_COPY[id];
                  const status = statuses[id];
                  // Two columns: the last row of each column drops its rule so the
                  // list's own bottom border is the only one under it.
                  const lastRow = index >= PERMISSION_IDS.length - 2;
                  return (
                    <View
                      key={id}
                      className={tablet
                        ? `gap-1 border-b border-concrete-400 py-4 md:py-5 md:landscape:w-[47%] ${lastRow ? 'md:landscape:border-b-0' : ''}`
                        : 'gap-1 border-b border-concrete-400 py-4'}
                      testID={'permission-' + id}
                    >
                      <Switch
                        value={selected.includes(id)}
                        onChange={(checked) => choose(id, checked)}
                        label={item.title}
                        disabled={busy}
                      />
                      <Text variant="caption" tone="muted">{item.detail}</Text>
                      {status ? <Text variant="caption" tone="muted">{copy(STATUS[status])}</Text> : null}
                      {status === 'blocked' ? (
                        <View className="self-start">
                          <Button
                            variant="outline"
                            title={copy('perm.open_settings')}
                            disabled={busy}
                            onPress={() => { void Linking.openSettings().catch(() => {}); }}
                          />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
              <View className={tablet ? 'gap-3 md:mt-auto md:landscape:flex-row md:landscape:flex-wrap md:landscape:items-center md:landscape:justify-between' : 'gap-3'}>
                <View className={tablet ? 'md:landscape:w-[47%]' : undefined}>
                  <Button
                    title={selected.length === 0 ? copy('perm.continue') : copy('perm.continue.selected', { n: selected.length })}
                    variant="cta"
                    size="lg"
                    fullWidth
                    loading={busy}
                    testID="permissions-continue"
                    onPress={() => { void continueSetup(); }}
                  />
                </View>
                <View className={tablet ? 'md:landscape:w-[47%]' : undefined}>
                  <Button
                    title={copy('perm.not_now')}
                    variant="ghost"
                    size="lg"
                    fullWidth
                    disabled={busy}
                    testID="permissions-skip"
                    onPress={() => { void notNow(); }}
                  />
                </View>
                <Text variant="caption" tone="muted" className={tablet ? 'md:landscape:w-full' : undefined}>
                  {copy('perm.footnote')}
                </Text>
              </View>
            </View>
          </ScrollView>
        </SafeArea>
      </View>
    </View>
  );
}
