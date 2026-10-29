'use client';

import { cancelAllCareNotifications, syncCareNotifications } from './care-notifications';
import type { PredictedCall, RealCallKind } from './care-notification-plan.ts';
import { buildKeychainSnapshot, type MonCareViewLike } from './keychain-snapshot.ts';
import { clearKeychainSnapshot, writeKeychainSnapshot } from './keychain-widget';

/**
 * One call after every care tick and every care action (contract §4 and §7):
 * refreshes the keychain widget and reschedules the Mon's call notifications.
 * The store (lane c) calls it with the active Mon's
 * `selectMonCareView(state, now, options)` and
 * `predictRealCalls(state, now, CARE_HORIZON_MS, options)`. Cheap when nothing
 * changed: the widget write is skipped by signature and the notification
 * reconcile cancels and schedules only the difference.
 */
export interface MonCareSurfacesInput {
  readonly monInstanceId: string;
  readonly monName: string;
  readonly view: MonCareViewLike;
  readonly predictions: readonly PredictedCall[];
  readonly now: number;
  /** Canon lines by call kind (`monLine`), e.g. `{ hunger: 'Food?' }` for the Squeaklet at Baby. */
  readonly lines?: Partial<Record<RealCallKind, string | undefined>>;
}

export function publishMonCareSurfaces(input: MonCareSurfacesInput): Promise<void> {
  writeKeychainSnapshot(buildKeychainSnapshot(input));
  return syncCareNotifications({
    monInstanceId: input.monInstanceId,
    monName: input.monName,
    now: input.now,
    predictions: input.predictions,
    paused: input.view.paused,
    lines: input.lines,
  });
}

/** No active Mon (before the hatch, after sign-out): the widget shows its empty state and no call stays scheduled. */
export function clearMonCareSurfaces(): Promise<void> {
  clearKeychainSnapshot();
  return cancelAllCareNotifications();
}
