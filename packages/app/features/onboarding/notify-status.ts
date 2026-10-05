'use client';

import type { StatusRowItem } from '@acme/ui';
import { copy } from './copy.ts';
import type { NotifyOffState } from './onboarding.store';

/**
 * The follow-up action a notifications-off status carries (M06 05-copy.md
 * "Not now, or denied"): after "Not now" the OS prompt never ran so the row
 * can re-ask via M06; after a denial only Settings can change it.
 */
export type NotifyOffAction = 'ask' | 'settings';

export function notifyOffActionFor(state: NotifyOffState): NotifyOffAction {
  return state === 'denied' ? 'settings' : 'ask';
}

/**
 * The `StatusRow` item M11 (and, until M11 exists, the notifications inbox)
 * shows when notifications are off. Handlers are injected so the item stays
 * renderable where the router or OS Settings do not exist (web); a missing
 * handler renders the line without an action.
 */
export function notifyOffStatusItem(input: {
  state: NotifyOffState;
  /** Reopens the M06 sheet (the "Turn on" action). */
  onAsk?: () => void;
  /** `Linking.openSettings()` (the "Open Settings" action). */
  onOpenSettings?: () => void;
}): StatusRowItem {
  const wants = notifyOffActionFor(input.state);
  const action =
    wants === 'settings' && input.onOpenSettings !== undefined
      ? {
          label: copy('m11.status.notify_off.action.settings'),
          accessibilityHint: copy('m11.status.notify_off.action.settings.a11y.hint'),
          onPress: input.onOpenSettings,
        }
      : wants === 'ask' && input.onAsk !== undefined
        ? { label: copy('m11.status.notify_off.action.ask'), onPress: input.onAsk }
        : undefined;
  return {
    id: 'notify-off',
    label: copy(input.state === 'schedule-failed' ? 'm11.status.schedule_failed' : 'm11.status.notify_off'),
    tone: 'neutral',
    action,
  };
}
