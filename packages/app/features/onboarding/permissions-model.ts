import type { NotifyPermission } from './notify-permission';

/** Permission prompts are never required for finishing the first-run flow. */
export const LATER_PERMISSIONS = ['camera', 'microphone', 'location'] as const;
export type LaterPermission = typeof LATER_PERMISSIONS[number];

/**
 * NYC-MON only schedules an egg-ready notification when the permission exists
 * and a live egg is still incubating. No missed notification for past eggs.
 */
export function shouldScheduleEggReminder(
  permission: NotifyPermission,
  incubationEndsAt: number | undefined,
  nowMs: number,
): boolean {
  return permission === 'granted' &&
    incubationEndsAt !== undefined &&
    Number.isFinite(incubationEndsAt) &&
    incubationEndsAt > nowMs;
}
