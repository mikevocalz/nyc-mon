'use client';

import { useEffect, useState } from 'react';
import { Button, Heading, NotificationPreview, SheetSurface, Text } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { announcePolitely } from './announce';
import { copy, type OnboardingCopyId } from './copy';
import { useOnboarding } from './onboarding.store';
import {
  getNotifyPermission,
  requestNotifyPermission,
  scheduleReadyNotification,
} from './notify-permission';

/**
 * M06 notifications permission: a daylit form sheet over M10 (incubation
 * choice). It shows the Caller the exact one notification they are agreeing
 * to — "Your egg is ready to hatch" — then runs the real OS prompt on Turn
 * on. Every other exit is "Not now": the ghost button, the sheet grabber,
 * Android back, Escape, swipe-down. Dismissal records `not-now`, a real OS
 * denial records `denied`, a grant that fails to schedule records
 * `schedule-failed` — the M11 status row and the inbox read the persisted
 * `notifyOff` state (see `notify-status.ts`).
 *
 * Integration is blocked on M10 (M06 handoff B4); the route renders the
 * sheet standalone until incubation choice hands it `eggId`/`endsAtMs`.
 */

export interface NotifyScreenProps {
  /** Incubation length the Caller confirmed on M10: picks the body line. */
  minutes?: 15 | 30 | 60;
  /** The egg the M23 notification is for; required to schedule on grant. */
  eggId?: string;
  /** `incubationEndsAt` in epoch ms; required to schedule on grant. */
  endsAtMs?: number;
  /** Sheet close — the host navigates back (router.back()). */
  onDone?: () => void;
}

const BODY_ID: Record<15 | 30 | 60, OnboardingCopyId> = {
  15: 'm06.body.15',
  30: 'm06.body.30',
  60: 'm06.body.60',
};

export function NotifyScreen({ minutes = 30, eggId, endsAtMs, onDone }: NotifyScreenProps) {
  const setNotifyOff = useOnboarding((s) => s.setNotifyOff);
  const [busy, setBusy] = useState(false);

  const notNow = () => {
    setNotifyOff('not-now');
    onDone?.();
  };

  const turnOn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await requestNotifyPermission();
      if (result === 'granted') {
        // P4: schedule the one egg-ready notification when we can.
        const scheduled =
          eggId === undefined || endsAtMs === undefined
            ? true
            : await scheduleReadyNotification({
                eggId,
                endsAtMs,
                title: copy('m23.notification.title'),
                body: copy('m23.notification.body'),
              });
        setNotifyOff(scheduled ? undefined : 'schedule-failed');
        announcePolitely(copy('m06.granted.a11y.announce'));
      } else if (result === 'denied') {
        setNotifyOff('denied');
      } else {
        setNotifyOff('not-now');
      }
    } finally {
      setBusy(false);
    }
    onDone?.();
  };

  return (
    <SheetSurface
      title={copy('m06.title')}
      scheme="system"
      onClose={notNow}
      closeLabel={copy('m06.grabber.a11y.label')}
    >
      <View className="gap-4 p-4 pb-2" testID="m06-sheet">
        <View testID="m06-preview">
          <NotificationPreview
            appName={copy('m06.preview.app_name')}
            title={copy('m23.notification.title')}
            body={copy('m23.notification.body')}
            time={copy('m06.preview.time')}
            accessibilityLabel={copy('m06.preview.a11y.label')}
          />
        </View>
        <Heading level={2} size="title" testID="m06-title">
          {copy('m06.title')}
        </Heading>
        <Text variant="body" testID="m06-body">
          {copy(BODY_ID[minutes])}
        </Text>
        <View className="mt-2 gap-3 pb-4">
          <View testID="m06-allow">
            <Button
              variant="cta"
              size="lg"
              fullWidth
              loading={busy}
              title={copy('m06.cta.allow')}
              onPress={turnOn}
            />
          </View>
          <View testID="m06-later">
            <Button
              variant="ghost"
              size="lg"
              fullWidth
              title={copy('m06.cta.later')}
              onPress={notNow}
            />
          </View>
        </View>
      </View>
    </SheetSurface>
  );
}

/**
 * Route-side gate (handoff § Route and intent): the sheet shows only while
 * the OS permission is still undecided; otherwise it closes immediately.
 * Lives in this package so `./notify-permission` keeps its platform fork —
 * a route file importing the helper with an explicit `.ts` extension would
 * bind the web stub on-device.
 */
export function NotifyGate(props: NotifyScreenProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    void getNotifyPermission().then((state) => {
      if (!live) return;
      if (state === 'undetermined') setReady(true);
      else props.onDone?.();
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only check; onDone is a stable router.back
  }, []);

  return ready ? <NotifyScreen {...props} /> : null;
}
