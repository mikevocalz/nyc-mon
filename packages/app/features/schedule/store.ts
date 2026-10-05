'use client';

import { create } from 'zustand';
import type { ScheduleEvent } from './model.ts';
import type { EventOverride } from './reschedule.ts';
import { scheduleStorage } from './schedule-storage';

export type ScheduleView = 'day' | 'week';

export const HOUR_HEIGHT_STEPS = [48, 64, 88, 120] as const;
export const DEFAULT_HOUR_HEIGHT = 64;

const STORAGE_KEY = 'mon-calendar-v1';

interface PersistedScheduleState {
  createdEvents: Record<string, ScheduleEvent>;
  deletedEventIds: string[];
  overrides: Record<string, EventOverride>;
  calendarEventIds: Record<string, string>;
  notificationIds: Record<string, string>;
  syncPersonalCalendar: boolean;
  remindersEnabled: boolean;
}

interface StoredScheduleEvent extends Omit<ScheduleEvent, 'start' | 'end'> {
  start: string;
  end: string;
}

interface StoredEventOverride extends Omit<EventOverride, 'start' | 'end'> {
  start: string;
  end: string;
}

interface StoredScheduleState
  extends Omit<PersistedScheduleState, 'createdEvents' | 'overrides'> {
  createdEvents: Record<string, StoredScheduleEvent>;
  overrides: Record<string, StoredEventOverride>;
}

const EMPTY_PERSISTED: PersistedScheduleState = {
  createdEvents: {},
  deletedEventIds: [],
  overrides: {},
  calendarEventIds: {},
  notificationIds: {},
  syncPersonalCalendar: false,
  remindersEnabled: true,
};

function readPersisted(): PersistedScheduleState {
  const raw = scheduleStorage.getString(STORAGE_KEY);
  if (!raw) return EMPTY_PERSISTED;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredScheduleState>;
    const createdEvents = Object.fromEntries(
      Object.entries(parsed.createdEvents ?? {}).map(([id, event]) => [
        id,
        { ...event, start: new Date(event.start), end: new Date(event.end) },
      ]),
    );
    const overrides = Object.fromEntries(
      Object.entries(parsed.overrides ?? {}).map(([id, override]) => [
        id,
        { ...override, start: new Date(override.start), end: new Date(override.end) },
      ]),
    );

    return {
      createdEvents,
      overrides,
      deletedEventIds: parsed.deletedEventIds ?? [],
      calendarEventIds: parsed.calendarEventIds ?? {},
      notificationIds: parsed.notificationIds ?? {},
      syncPersonalCalendar: parsed.syncPersonalCalendar ?? false,
      remindersEnabled: parsed.remindersEnabled ?? true,
    };
  } catch {
    scheduleStorage.remove(STORAGE_KEY);
    return EMPTY_PERSISTED;
  }
}

function writePersisted(state: PersistedScheduleState) {
  const serialized: StoredScheduleState = {
    ...state,
    createdEvents: Object.fromEntries(
      Object.entries(state.createdEvents).map(([id, event]) => [
        id,
        { ...event, start: event.start.toISOString(), end: event.end.toISOString() },
      ]),
    ),
    overrides: Object.fromEntries(
      Object.entries(state.overrides).map(([id, override]) => [
        id,
        { ...override, start: override.start.toISOString(), end: override.end.toISOString() },
      ]),
    ),
  };
  scheduleStorage.set(STORAGE_KEY, JSON.stringify(serialized));
}

interface ScheduleState extends PersistedScheduleState {
  view: ScheduleView;
  resourceFilter: string[];
  selectedEventId: string | null;
  hourHeight: number;
  selectedDate: string | null;
  visibleMonth: string | null;
  bookingOpen: boolean;
  /**
   * Event the booking sheet is rescheduling, when it was opened through
   * `openReschedule` rather than `openBooking`. Transient like `bookingOpen`:
   * it identifies a form session, not schedule data.
   */
  rescheduleEventId: string | null;

  setView: (view: ScheduleView) => void;
  setResourceFilter: (resourceIds: string[]) => void;
  selectEvent: (eventId: string | null) => void;
  setHourHeight: (hourHeight: number) => void;
  selectDate: (isoDate: string) => void;
  moveEvent: (eventId: string, override: EventOverride) => void;
  clearMoves: () => void;
  showMonth: (month: string) => void;
  openBooking: () => void;
  closeBooking: () => void;
  /** Open the booking sheet in reschedule mode for an existing event. */
  openReschedule: (eventId: string) => void;
  createEvent: (event: ScheduleEvent) => void;
  /** Store a copy of `event` under a new id and select it. */
  duplicateEvent: (event: ScheduleEvent) => void;
  deleteEvent: (eventId: string) => void;
  setCalendarEventId: (eventId: string, calendarEventId?: string) => void;
  setNotificationId: (eventId: string, notificationId?: string) => void;
  setSyncPersonalCalendar: (enabled: boolean) => void;
  setRemindersEnabled: (enabled: boolean) => void;
}

const persisted = readPersisted();

function idForEvent() {
  return `mon-event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useScheduleStore = create<ScheduleState>((set) => {
  const setPersisted = (
    updater: (state: ScheduleState) => Partial<PersistedScheduleState>,
  ) =>
    set((state) => {
      const patch = updater(state);
      writePersisted({
        createdEvents: patch.createdEvents ?? state.createdEvents,
        deletedEventIds: patch.deletedEventIds ?? state.deletedEventIds,
        overrides: patch.overrides ?? state.overrides,
        calendarEventIds: patch.calendarEventIds ?? state.calendarEventIds,
        notificationIds: patch.notificationIds ?? state.notificationIds,
        syncPersonalCalendar: patch.syncPersonalCalendar ?? state.syncPersonalCalendar,
        remindersEnabled: patch.remindersEnabled ?? state.remindersEnabled,
      });
      return patch;
    });

  return {
    ...persisted,
    view: 'day',
    resourceFilter: [],
    selectedEventId: null,
    hourHeight: DEFAULT_HOUR_HEIGHT,
    selectedDate: null,
    visibleMonth: null,
    bookingOpen: false,
    rescheduleEventId: null,

    setView: (view) => set({ view }),
    setResourceFilter: (resourceFilter) => set({ resourceFilter }),
    selectEvent: (selectedEventId) => set({ selectedEventId }),
    setHourHeight: (hourHeight) => set({ hourHeight }),
    selectDate: (selectedDate) => set({ selectedDate }),
    moveEvent: (eventId, override) =>
      setPersisted((state) => ({
        overrides: { ...state.overrides, [eventId]: override },
      })),
    clearMoves: () => setPersisted(() => ({ overrides: {} })),
    showMonth: (visibleMonth) => set({ visibleMonth }),
    // Every path into the sheet resolves the mode in the same write, so a
    // closed reschedule can never leak into the next "new booking" open.
    openBooking: () => set({ bookingOpen: true, rescheduleEventId: null }),
    closeBooking: () => set({ bookingOpen: false, rescheduleEventId: null }),
    openReschedule: (eventId) => set({ bookingOpen: true, rescheduleEventId: eventId }),

    createEvent: (event) =>
      setPersisted((state) => ({
        createdEvents: { ...state.createdEvents, [event.id]: event },
        deletedEventIds: state.deletedEventIds.filter((id) => id !== event.id),
      })),
    duplicateEvent: (event) => {
      const copy: ScheduleEvent = {
        ...event,
        id: idForEvent(),
        title: `${event.title} (copy)`,
      };
      setPersisted((state) => ({
        createdEvents: { ...state.createdEvents, [copy.id]: copy },
        deletedEventIds: state.deletedEventIds.filter((id) => id !== copy.id),
      }));
      // The copy, not the original: the action reads as "make me one of
      // these", so the new event is what the inspector should now show.
      set({ selectedEventId: copy.id });
    },
    deleteEvent: (eventId) =>
      setPersisted((state) => {
        const createdEvents = { ...state.createdEvents };
        delete createdEvents[eventId];
        const overrides = { ...state.overrides };
        delete overrides[eventId];
        const calendarEventIds = { ...state.calendarEventIds };
        delete calendarEventIds[eventId];
        const notificationIds = { ...state.notificationIds };
        delete notificationIds[eventId];
        return {
          createdEvents,
          overrides,
          calendarEventIds,
          notificationIds,
          deletedEventIds: state.deletedEventIds.includes(eventId)
            ? state.deletedEventIds
            : [...state.deletedEventIds, eventId],
        };
      }),
    setCalendarEventId: (eventId, calendarEventId) =>
      setPersisted((state) => {
        const calendarEventIds = { ...state.calendarEventIds };
        if (calendarEventId) calendarEventIds[eventId] = calendarEventId;
        else delete calendarEventIds[eventId];
        return { calendarEventIds };
      }),
    setNotificationId: (eventId, notificationId) =>
      setPersisted((state) => {
        const notificationIds = { ...state.notificationIds };
        if (notificationId) notificationIds[eventId] = notificationId;
        else delete notificationIds[eventId];
        return { notificationIds };
      }),
    setSyncPersonalCalendar: (syncPersonalCalendar) =>
      setPersisted(() => ({ syncPersonalCalendar })),
    setRemindersEnabled: (remindersEnabled) =>
      setPersisted(() => ({ remindersEnabled })),
  };
});
