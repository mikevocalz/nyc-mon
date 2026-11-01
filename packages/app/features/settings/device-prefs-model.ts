// M19 device preferences, the pure half: the stored shape, how a raw MMKV
// value reads back, and what the Notifications switch does for each OS
// permission. Pure, so node tests pin it; device-prefs.store.ts binds it to
// storage and the kit.
import type { KeyValueStorage } from '../onboarding/storage.types.ts';

/** MMKV key in the `nyc-mon` store. */
export const DEVICE_PREFS_KEY = 'device-prefs';

export interface DevicePrefs {
  readonly haptics: boolean;
  readonly sound: boolean;
  /** On forces reduced motion; off follows the OS. */
  readonly forceReducedMotion: boolean;
  /** The Caller wants the egg-ready notification. The OS permission is separate. */
  readonly notifications: boolean;
}

export const DEFAULT_DEVICE_PREFS: DevicePrefs = {
  haptics: true,
  sound: true,
  forceReducedMotion: false,
  notifications: true,
};

/** Reads the stored preferences. Missing, unreadable or mistyped fields fall back to the defaults one by one. */
export function readDevicePrefs(storage: KeyValueStorage): DevicePrefs {
  const raw = storage.getString(DEVICE_PREFS_KEY);
  if (raw === undefined) return DEFAULT_DEVICE_PREFS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_DEVICE_PREFS;
  }
  if (typeof parsed !== 'object' || parsed === null) return DEFAULT_DEVICE_PREFS;
  const record = parsed as Record<string, unknown>;
  const pick = (key: keyof DevicePrefs): boolean =>
    typeof record[key] === 'boolean' ? (record[key] as boolean) : DEFAULT_DEVICE_PREFS[key];
  return {
    haptics: pick('haptics'),
    sound: pick('sound'),
    forceReducedMotion: pick('forceReducedMotion'),
    notifications: pick('notifications'),
  };
}

export function writeDevicePrefs(storage: KeyValueStorage, prefs: DevicePrefs): void {
  storage.set(DEVICE_PREFS_KEY, JSON.stringify(prefs));
}

/** The OS permission as notify-permission reports it. */
export type NotifyPermissionState = 'undetermined' | 'granted' | 'denied' | 'unsupported';

/**
 * What turning the Notifications switch does:
 * - `enable`: permission already granted, so only the preference changes.
 * - `request`: never asked; show the OS prompt.
 * - `open-settings`: the OS said no and will not ask again; only its Settings can change it.
 * - `disable`: the preference goes off and the scheduled egg alert is cancelled.
 */
export type NotifyToggleAction = 'enable' | 'request' | 'open-settings' | 'disable';

export function notifyToggleAction(wantOn: boolean, permission: NotifyPermissionState): NotifyToggleAction {
  if (!wantOn) return 'disable';
  if (permission === 'granted') return 'enable';
  if (permission === 'denied') return 'open-settings';
  return 'request';
}

/** The switch reads on only when the Caller wants it AND the OS allows it. */
export function notificationsOn(prefs: DevicePrefs, permission: NotifyPermissionState): boolean {
  return prefs.notifications && permission === 'granted';
}
