'use client';

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { getNotifyPermission } from '../onboarding/notify-permission';
import { devicePrefs } from '../settings/device-prefs.store';
import {
  isCareNotificationId,
  planCareNotifications,
  reconcileCareSchedule,
  type CarePlanInput,
  type CareNotificationRequest,
} from './care-notification-plan.ts';
import { careCopy } from './care-copy.ts';

/** Android channel for care calls; separate from the egg alert so the Caller can mute one without the other. */
const ANDROID_CHANNEL_ID = 'mon-care-calls';
let channelReady = false;

async function ensureChannel(): Promise<void> {
  if (channelReady || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: careCopy('notify.call.thread'),
    importance: AndroidImportance.DEFAULT,
  });
  channelReady = true;
}

async function schedule(request: CareNotificationRequest): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: request.identifier,
    content: {
      title: request.title,
      body: request.body,
      data: { ...request.data },
      threadIdentifier: request.threadIdentifier,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: request.at,
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
  });
}

/** Serialises syncs: a tick and an action landing together must not interleave their cancel/schedule calls. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Makes the phone's pending care notifications for one Mon match the plan.
 * Call after every care tick and action with `predictRealCalls(...)` and the
 * view's `paused`. Never asks for permission: Mon Space's one-time ask sheet
 * (lane c) and the Settings "Mon calls" row own the prompt. With the switch
 * off or no OS grant, this only cancels. Errors are swallowed: the in-app LED still shows calls.
 */
export function syncCareNotifications(input: Omit<CarePlanInput, 'enabled'>): Promise<void> {
  const run = async () => {
    try {
      // Mon calls are their own opt-in (D20b), separate from the egg alert.
      const enabled = devicePrefs().monCalls && (await getNotifyPermission()) === 'granted';
      const desired = planCareNotifications({ ...input, enabled });
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const change = reconcileCareSchedule(scheduled, desired, input.monInstanceId);
      if (change.cancel.length === 0 && change.schedule.length === 0) return;
      await Promise.allSettled(change.cancel.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
      if (change.schedule.length > 0) await ensureChannel();
      await Promise.allSettled(change.schedule.map(schedule));
    } catch {
      // The in-app attention LED still carries the call.
    }
  };
  const next = queue.then(run, run);
  queue = next;
  return next;
}

/** Settings "Mon calls" off: cancels every pending care call, for every Mon. Egg alerts and schedule reminders stay. */
export function cancelAllCareNotifications(): Promise<void> {
  const run = async () => {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const ids = scheduled.map((r) => r.identifier).filter(isCareNotificationId);
      await Promise.allSettled(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
    } catch {
      // The preference is already off, so the next sync cancels what is left.
    }
  };
  const next = queue.then(run, run);
  queue = next;
  return next;
}
