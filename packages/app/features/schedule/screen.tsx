'use client';

import { useCallback } from 'react';
import { Schedule } from './Schedule.tsx';
import { buildDemoDay } from './fixtures.ts';
import { useNow } from './use-now.ts';
import type { Slot } from './slots.ts';
import type { ScheduleEvent } from './model.ts';
import { useScheduleStore } from './store.ts';
import { syncEventIntegrations } from './event-integrations';

export interface ScheduleScreenProps {
  onNewBooking?: () => void;
  fill?: boolean;
}

export function ScheduleScreen({ onNewBooking, fill }: ScheduleScreenProps = {}) {
  const selectEvent = useScheduleStore((state) => state.selectEvent);
  const selectedDate = useScheduleStore((state) => state.selectedDate);
  const createdEvents = useScheduleStore((state) => state.createdEvents);
  const deletedEventIds = useScheduleStore((state) => state.deletedEventIds);
  const calendarEventIds = useScheduleStore((state) => state.calendarEventIds);
  const notificationIds = useScheduleStore((state) => state.notificationIds);
  const setCalendarEventId = useScheduleStore((state) => state.setCalendarEventId);
  const setNotificationId = useScheduleStore((state) => state.setNotificationId);
  const now = useNow();

  const reference = selectedDate ? new Date(selectedDate) : now;
  const day = buildDemoDay(reference, Object.values(createdEvents), deletedEventIds);

  const handleBook = (slot: Slot) => {
    selectEvent(slot.start.toISOString());
    onNewBooking?.();
  };

  const handleEventRescheduled = useCallback(
    (event: ScheduleEvent) => {
      const mon = day.resources.find((resource) => resource.id === event.resourceId);
      if (!mon) return;
      void syncEventIntegrations(event, {
        monName: mon.name,
        timeZone: day.timeZone,
        existingCalendarEventId: calendarEventIds[event.id],
        existingNotificationId: notificationIds[event.id],
      }).then((result) => {
        if (result.calendarEventId) setCalendarEventId(event.id, result.calendarEventId);
        if (result.notificationId) setNotificationId(event.id, result.notificationId);
      });
    },
    [
      day.resources,
      day.timeZone,
      calendarEventIds,
      notificationIds,
      setCalendarEventId,
      setNotificationId,
    ],
  );

  return (
    <Schedule
      day={day}
      now={now}
      onBook={handleBook}
      onNewBooking={onNewBooking ?? (() => selectEvent(null))}
      onEventRescheduled={handleEventRescheduled}
      fill={fill}
    />
  );
}
