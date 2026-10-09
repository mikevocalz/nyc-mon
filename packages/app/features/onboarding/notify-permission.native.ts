'use client';

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
// Named import: the `import/namespace` resolver cannot see through the
// `export *` from NotificationChannelManager.types.d.ts in this version.
import { AndroidImportance } from 'expo-notifications';
import type { ReadyNotification } from './notify-permission';
import { readyNotificationId } from './notify-foreground';

export type { ReadyNotification };
export type NotifyPermission = 'undetermined' | 'granted' | 'denied' | 'unsupported';

function toNotifyPermission(status: Notifications.NotificationPermissionsStatus): NotifyPermission {
  if (status.granted || status.status === Notifications.PermissionStatus.GRANTED) return 'granted';
  return status.status === Notifications.PermissionStatus.DENIED ? 'denied' : 'undetermined';
}

/** Current OS permission state; a failed read is treated as still open to ask. */
export async function getNotifyPermission(): Promise<NotifyPermission> {
  try {
    return toNotifyPermission(await Notifications.getPermissionsAsync());
  } catch {
    return 'undetermined';
  }
}

/** The M06 CTA: the real OS prompt. Anything that is not a grant is `denied`. */
export async function requestNotifyPermission(): Promise<NotifyPermission> {
  try {
    const status = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: true },
    });
    return toNotifyPermission(status);
  } catch {
    return 'denied';
  }
}

/** Android needs a channel for any notification; iOS ignores it. */
const ANDROID_CHANNEL_ID = 'egg-ready';

/**
 * Schedules the one M23 notification for an egg, fired at its
 * `incubationEndsAt`. The identifier derives from `eggId`, so a repeat call
 * replaces rather than duplicates ("one notification per egg, ever").
 * `data.url` is the M12 deep link (`/(home)/hatch`) for the receipt handler.
 */
export async function scheduleReadyNotification(input: ReadyNotification): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Egg ready',
        importance: AndroidImportance.DEFAULT,
      });
    }
    await Notifications.scheduleNotificationAsync({
      identifier: readyNotificationId(input.eggId),
      content: {
        title: input.title,
        body: input.body,
        data: { eggId: input.eggId, url: '/(home)/hatch' },
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: input.endsAtMs,
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * M12 housekeeping on the hatched edge: cancels the egg's ready notification
 * if it has not fired and removes it from the tray if it has, so "one
 * notification per egg, ever" holds when the Caller hatched before the banner.
 * Both calls exist in expo-notifications 58.0.11 and resolve when there is
 * nothing to remove; a failure is ignored because the hatch already committed.
 */
export async function clearReadyNotification(eggId: string): Promise<void> {
  const id = readyNotificationId(eggId);
  await Promise.allSettled([
    Notifications.cancelScheduledNotificationAsync(id),
    Notifications.dismissNotificationAsync(id),
  ]);
}
