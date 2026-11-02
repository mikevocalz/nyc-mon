'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { Linking, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Container, Heading, SafeArea, Text } from '@acme/ui';
import { ScrollView, View } from '@acme/ui/tw';
import { useReservedRegions } from '@acme/ui/adaptive-panes';
import { selectPendingEgg, useMonStore } from '../mon/mon.store';
import { MON_HOME_PATH } from '../egg/egg-model';
import { announcePolitely } from './announce';
import { copy, type OnboardingCopyId } from './copy';
import { completePermissionReview, useOnboarding } from './onboarding.store';
import { shouldScheduleEggReminder } from './permissions-model';
import { isWholeWindow, permissionViewport } from './permissions-layout';
import { getNotifyPermission, requestNotifyPermission, scheduleReadyNotification, type NotifyPermission } from './notify-permission';

const OPTIONAL_FEATURES: readonly {
  id: string;
  title: OnboardingCopyId;
  body: OnboardingCopyId;
  badge: OnboardingCopyId;
}[] = [
  { id: 'camera', title: 'm24.camera.title', body: 'm24.camera.body', badge: 'm24.camera.badge' },
  { id: 'mic', title: 'm24.mic.title', body: 'm24.mic.body', badge: 'm24.mic.badge' },
  { id: 'location', title: 'm24.location.title', body: 'm24.location.body', badge: 'm24.location.badge' },
];

/**
 * M24 / final first-run screen: contextual device permissions, not a single
 * coercive system-prompt burst. Only the incubating egg's one notification
 * is useful immediately. Camera, microphone, and foreground location are
 * introduced here but requested at their actual feature-entry points.
 *
 * The form is confined to one physical segment on Android book/tabletop/
 * trifold devices and iPhone Duo by the existing reserved-regions bridge.
 * The contents scroll independently on short cover displays or large text.
 */
export function PermissionsReviewScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const regions = useReservedRegions();
  const viewport = permissionViewport(width, height, regions);
  // Window breakpoint classes only when the form owns the whole window; one
  // segment of a split foldable keeps the phone column (see isWholeWindow).
  const tablet = isWholeWindow(viewport, width, height);
  const setNotifyOff = useOnboarding((state) => state.setNotifyOff);
  const local = useMemo(() => createStore<{ status: NotifyPermission | 'loading'; busy: boolean }>(() => ({
    status: 'loading', busy: false,
  })), []);
  const status = useStore(local, (state) => state.status);
  const busy = useStore(local, (state) => state.busy);
  const locked = useRef(false);

  useEffect(() => {
    let mounted = true;
    void getNotifyPermission().then((permission) => {
      if (mounted) local.setState({ status: permission });
    });
    return () => { mounted = false; };
  }, [local]);

  const enableNotifications = async () => {
    if (locked.current) return;
    locked.current = true;
    local.setState({ busy: true });
    try {
      const result = await requestNotifyPermission();
      local.setState({ status: result });
      if (result === 'granted') {
        setNotifyOff(undefined);
        announcePolitely(copy('m24.notifications.on'));
      } else if (result === 'denied') {
        setNotifyOff('denied');
      }
    } finally {
      local.setState({ busy: false });
      locked.current = false;
    }
  };

  const finish = async () => {
    if (locked.current) return;
    locked.current = true;
    local.setState({ busy: true });
    try {
      const permission = await getNotifyPermission();
      const egg = selectPendingEgg(useMonStore.getState())?.egg;
      if (egg && shouldScheduleEggReminder(permission, egg.incubationEndsAt, Date.now())) {
        // The notification ID is egg-derived, so retry/resume cannot duplicate it.
        const scheduled = await scheduleReadyNotification({
          eggId: egg.eggId,
          endsAtMs: egg.incubationEndsAt,
          title: copy('m23.notification.title'),
          body: copy('m23.notification.body'),
        });
        setNotifyOff(scheduled ? undefined : 'schedule-failed');
      } else if (permission === 'granted') {
        setNotifyOff(undefined);
      } else {
        setNotifyOff(permission === 'denied' ? 'denied' : 'not-now');
      }
      completePermissionReview();
      router.replace(MON_HOME_PATH);
    } finally {
      locked.current = false;
      local.setState({ busy: false });
    }
  };

  const notificationBadge: OnboardingCopyId =
    status === 'granted' ? 'm24.notifications.on'
      : status === 'denied' ? 'm24.notifications.denied'
        : status === 'unsupported' ? 'm24.notifications.unsupported'
          : 'm24.notifications.off';

  return (
    <View className="flex-1 bg-bg" testID="m24-permissions-root">
      <View style={{
        position: 'absolute',
        left: viewport.left,
        top: viewport.top,
        width: viewport.width,
        height: viewport.height,
      }}>
        <SafeArea className="flex-1">
          <ScrollView className="flex-1" contentContainerClassName="grow" keyboardShouldPersistTaps="handled">
            {/* Phone: the form column. Tablet portrait: a wider column, top-aligned,
                Continue on the bottom edge. Landscape: what is live now on the
                left, what comes later on the right, the footer under the right pane. */}
            <Container
              width="form"
              className={tablet
                ? 'flex-1 gap-5 px-4 py-6 md:gap-8 md:px-8 md:py-10 md:portrait:max-w-[640px] md:landscape:max-w-[1080px]'
                : 'flex-1 gap-5 px-4 py-6'}
              testID="m24-permissions"
            >
              <View className={tablet ? 'gap-5 md:portrait:gap-8 md:landscape:flex-row md:landscape:items-start md:landscape:gap-12' : 'gap-5'}>
                <View className={tablet ? 'gap-5 md:landscape:flex-1' : 'gap-5'}>
                  <View className="gap-2">
                    <Text variant="caption" className="font-semibold tracking-widest text-primary">
                      {copy('m24.step')}
                    </Text>
                    <Heading level={1} size="display-sm" testID="m24-title">
                      {copy('m24.title')}
                    </Heading>
                    <Text tone="muted">{copy('m24.intro')}</Text>
                  </View>

                  <View className="gap-3" testID="m24-notifications">
                    <View className="border-2 border-border bg-surface-raised p-4">
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1 gap-1">
                          <Text variant="caption" className="font-semibold text-text-muted">01 / LIVE NOW</Text>
                          <Text variant="heading">{copy('m24.notifications.title')}</Text>
                        </View>
                        <Text variant="caption" className="shrink-0 font-semibold text-text-muted">{copy(notificationBadge)}</Text>
                      </View>
                      <Text className="mt-2" tone="muted">{copy('m24.notifications.body')}</Text>
                      <View className="mt-3">
                        {status === 'undetermined' ? (
                          <Button variant="outline" size="lg" fullWidth disabled={busy}
                            title={copy('m24.notifications.allow')} onPress={() => void enableNotifications()} />
                        ) : status === 'denied' ? (
                          <Button variant="outline" size="lg" fullWidth disabled={busy}
                            title={copy('m24.notifications.settings')}
                            onPress={() => void Linking.openSettings().catch(() => undefined)} />
                        ) : null}
                      </View>
                    </View>
                  </View>
                </View>

                <View className={tablet ? 'gap-5 md:landscape:flex-1' : 'gap-5'}>
                  <View className="gap-2">
                    <Heading level={2} size="title">{copy('m24.later.title')}</Heading>
                    <Text tone="muted">{copy('m24.later.body')}</Text>
                  </View>
                  <View className="gap-3">
                    {OPTIONAL_FEATURES.map((feature, index) => (
                      <View key={feature.id} className="border-2 border-border bg-surface-raised p-4" testID={`m24-${feature.id}`}>
                        <View className="flex-row items-start gap-3">
                          <Text variant="caption" className="font-semibold text-text-muted">
                            {`0${index + 2}`}
                          </Text>
                          <View className="flex-1 gap-1">
                            <Text variant="heading">{copy(feature.title)}</Text>
                            <Text tone="muted">{copy(feature.body)}</Text>
                            <Text variant="caption" className="mt-1 font-semibold text-text-muted">
                              {copy(feature.badge)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              <View className={tablet ? 'mt-auto gap-3 pt-3 pb-4 md:landscape:w-[47%] md:landscape:self-end' : 'mt-auto gap-3 pt-3 pb-4'}>
                <Text variant="caption" tone="muted">{copy('m24.privacy')}</Text>
                <Button
                  variant="cta" size="lg" fullWidth disabled={busy || status === 'loading'}
                  title={copy('m24.continue')}
                  onPress={() => void finish()}
                />
                <Text variant="caption" className="text-center text-text-muted">
                  {copy('m24.optional')}
                </Text>
              </View>
            </Container>
          </ScrollView>
        </SafeArea>
      </View>
    </View>
  );
}
