/**
 * NYC-MON schedule domain.
 *
 * Calendar columns are Mons. Events belong to a Mon instance and can be care
 * routines, social time, battles, or a custom Caller-authored event.
 */
export const RESOURCE_ACCENTS = ['ember', 'gold', 'forest', 'sky', 'rose'] as const;

export type ResourceAccent = (typeof RESOURCE_ACCENTS)[number];

export interface Resource {
  /** Mon instance id once the real /v1/me/mons query is wired. */
  id: string;
  /** Caller's nickname / display name for the Mon. */
  name: string;
  avatarUrl?: string;
  accent: ResourceAccent;
}

export const MON_SCHEDULE_EVENT_KINDS = [
  'breakfast',
  'lunch',
  'dinner',
  'play-date',
  'battle',
  'care',
  'custom',
] as const;

export type ScheduleEventKind = (typeof MON_SCHEDULE_EVENT_KINDS)[number];
export type ScheduleRecurrence = 'none' | 'daily';

export interface ScheduleEvent {
  id: string;
  /** Mon instance id. */
  resourceId: string;
  title: string;
  start: Date;
  end: Date;
  kind: ScheduleEventKind;
  /** Meals default to daily; social/battle events default to one-off. */
  recurrence?: ScheduleRecurrence;
  /** Local app notification. */
  reminderEnabled?: boolean;
  /** Minutes before start; 0 means at start time. */
  reminderMinutesBefore?: number;
  /** Mirror this event into the device user's personal calendar. */
  syncToPersonalCalendar?: boolean;
  notes?: string;
  /** Other Mons involved in a play date or battle, when known. */
  participantMonIds?: string[];
  /** Free-text opponent label for battles before matchmaking lands. */
  opponentName?: string;
}

export interface ScheduleDay {
  dayStart: Date;
  /** IANA zone the grid is drawn in, e.g. 'America/New_York'. */
  timeZone: string;
  startHour: number;
  endHour: number;
  resources: Resource[];
  events: ScheduleEvent[];
}

export function isMealKind(kind: ScheduleEventKind): boolean {
  return kind === 'breakfast' || kind === 'lunch' || kind === 'dinner';
}

export function scheduleKindLabel(kind: ScheduleEventKind): string {
  switch (kind) {
    case 'play-date':
      return 'Play date';
    case 'battle':
      return 'Battle';
    case 'breakfast':
      return 'Breakfast';
    case 'lunch':
      return 'Lunch';
    case 'dinner':
      return 'Dinner';
    case 'care':
      return 'Care';
    default:
      return 'Custom';
  }
}

export function defaultScheduleEventTitle(kind: ScheduleEventKind, monName: string): string {
  switch (kind) {
    case 'breakfast':
      return `Feed ${monName} · Breakfast`;
    case 'lunch':
      return `Feed ${monName} · Lunch`;
    case 'dinner':
      return `Feed ${monName} · Dinner`;
    case 'play-date':
      return `${monName} play date`;
    case 'battle':
      return `${monName} battle`;
    case 'care':
      return `${monName} care`;
    default:
      return `${monName} event`;
  }
}

export function accentForEvent(
  event: ScheduleEvent,
  resources: readonly Resource[],
): ResourceAccent | undefined {
  return resources.find((resource) => resource.id === event.resourceId)?.accent;
}

const MINUTES_PER_HOUR = 60;

export function zonedMinutesOfDay(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);

  const read = (type: 'hour' | 'minute') => {
    const part = parts.find((candidate) => candidate.type === type);
    return part ? Number.parseInt(part.value, 10) : 0;
  };

  return read('hour') * MINUTES_PER_HOUR + read('minute');
}

/** YYYY-MM-DD as observed in the calendar's zone. */
export function zonedDateKey(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const read = (type: 'year' | 'month' | 'day') =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}

/** Inclusive-start, exclusive-end overlap — touching events do not collide. */
export function eventsOverlap(a: ScheduleEvent, b: ScheduleEvent): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}
