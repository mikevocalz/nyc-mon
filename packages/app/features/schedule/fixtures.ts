import { addMinutes, set, startOfDay } from 'date-fns';
import type { Resource, ScheduleDay, ScheduleEvent } from './model.ts';
import { zonedDateKey } from './model.ts';

const ZONE = 'America/New_York';
const START_HOUR = 7;
const END_HOUR = 22;

export const DEMO_RESOURCES: Resource[] = [
  { id: 'mon-squeaklet', name: 'Squeaklet', accent: 'ember' },
  { id: 'mon-kittee-cee', name: 'Kittee Cee', accent: 'gold' },
  { id: 'mon-yotito', name: 'Yotito', accent: 'sky' },
];

type At = (hour: number, minute?: number) => Date;

function buildDailyCareEvents(at: At): ScheduleEvent[] {
  return DEMO_RESOURCES.flatMap((mon) => [
    {
      id: `${mon.id}-breakfast`,
      resourceId: mon.id,
      title: `Feed ${mon.name} · Breakfast`,
      start: at(8),
      end: at(8, 30),
      kind: 'breakfast' as const,
      recurrence: 'daily' as const,
      reminderEnabled: false,
      reminderMinutesBefore: 0,
      syncToPersonalCalendar: false,
    },
    {
      id: `${mon.id}-lunch`,
      resourceId: mon.id,
      title: `Feed ${mon.name} · Lunch`,
      start: at(12, 30),
      end: at(13),
      kind: 'lunch' as const,
      recurrence: 'daily' as const,
      reminderEnabled: false,
      reminderMinutesBefore: 0,
      syncToPersonalCalendar: false,
    },
    {
      id: `${mon.id}-dinner`,
      resourceId: mon.id,
      title: `Feed ${mon.name} · Dinner`,
      start: at(18, 30),
      end: at(19),
      kind: 'dinner' as const,
      recurrence: 'daily' as const,
      reminderEnabled: false,
      reminderMinutesBefore: 0,
      syncToPersonalCalendar: false,
    },
  ]);
}

function remapDailyEvent(event: ScheduleEvent, reference: Date): ScheduleEvent {
  const duration = event.end.getTime() - event.start.getTime();
  const start = set(startOfDay(reference), {
    hours: event.start.getHours(),
    minutes: event.start.getMinutes(),
    seconds: 0,
    milliseconds: 0,
  });
  return { ...event, start, end: new Date(start.getTime() + duration) };
}

/**
 * Temporary fallback until /v1/me/mons and the schedule collection are wired.
 * The UI/domain are already Mon-native; callers can replace DEMO_RESOURCES
 * with the user's Mon instances without changing the calendar components.
 */
export function buildDemoDay(
  reference: Date = new Date(),
  createdEvents: readonly ScheduleEvent[] = [],
  deletedEventIds: readonly string[] = [],
): ScheduleDay {
  const dayStart = set(startOfDay(reference), { hours: START_HOUR });
  const at = (hour: number, minute = 0) =>
    addMinutes(dayStart, (hour - START_HOUR) * 60 + minute);

  const dayKey = zonedDateKey(dayStart, ZONE);
  const createdForDay = createdEvents
    .filter(
      (event) =>
        event.recurrence === 'daily' || zonedDateKey(event.start, ZONE) === dayKey,
    )
    .map((event) => (event.recurrence === 'daily' ? remapDailyEvent(event, reference) : event));

  const deleted = new Set(deletedEventIds);
  return {
    dayStart,
    timeZone: ZONE,
    startHour: START_HOUR,
    endHour: END_HOUR,
    resources: DEMO_RESOURCES,
    events: [...buildDailyCareEvents(at), ...createdForDay].filter(
      (event) => !deleted.has(event.id),
    ),
  };
}

export const DEMO_DAY: ScheduleDay = buildDemoDay();
export const DEMO_EVENTS = DEMO_DAY.events;
export const DEMO_NOW = new Date();
