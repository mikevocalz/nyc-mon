import { isMealKind, type ScheduleEvent } from './model.ts';

/**
 * Which schedule events may set a local reminder on the phone.
 *
 * Meals never do. The Mon asks for food itself through its attention calls
 * (Mon Space care notifications, real calls only), so a fixed daily
 * "Breakfast time for {monName}" alert would double that and break D-15c
 * ("no care reminders promised"). Play dates and battles keep their one-off
 * reminder. A meal can still mirror into the Caller's personal calendar,
 * which is their own opt-in.
 */
export function allowsLocalReminder(event: Pick<ScheduleEvent, 'kind' | 'recurrence'>): boolean {
  return !isMealKind(event.kind) && event.recurrence !== 'daily';
}

/** The parts of an expo-notifications `NotificationRequest` the cleanup reads. Structural, so tests need no native module. */
export interface ScheduledRequestLike {
  readonly identifier: string;
  readonly content: { readonly data?: unknown };
}

const MEAL_KINDS: ReadonlySet<string> = new Set(['breakfast', 'lunch', 'dinner']);

/**
 * True for a daily meal reminder an older build scheduled
 * (`data: { scheduleEventId, monId, kind }` with a meal kind). The app
 * cancels these on launch so existing installs stop getting them.
 */
export function isLegacyMealReminder(request: ScheduledRequestLike): boolean {
  const data = request.content.data;
  if (typeof data !== 'object' || data === null) return false;
  const { kind, scheduleEventId } = data as { kind?: unknown; scheduleEventId?: unknown };
  return typeof scheduleEventId === 'string' && typeof kind === 'string' && MEAL_KINDS.has(kind);
}

/** Identifiers of the legacy meal reminders among the scheduled requests. */
export function legacyMealReminderIds(requests: readonly ScheduledRequestLike[]): string[] {
  return requests.filter(isLegacyMealReminder).map((request) => request.identifier);
}
