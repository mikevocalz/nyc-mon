import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar/legacy';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import type { ScheduleEvent } from './model';
import type { EventIntegrationContext, EventIntegrationResult } from './event-integrations.types';

const CHANNEL_ID = 'mon-care';
let channelReady = false;

function isDaily(event: ScheduleEvent) {
  return event.recurrence === 'daily';
}

function calendarTitle(event: ScheduleEvent, monName: string) {
  if (event.kind === 'breakfast' || event.kind === 'lunch' || event.kind === 'dinner') {
    return `NYC-MON · Feed ${monName} · ${event.kind}`;
  }
  if (event.kind === 'play-date') return `NYC-MON · ${monName} play date`;
  if (event.kind === 'battle') return `NYC-MON · ${monName} battle`;
  return `NYC-MON · ${event.title}`;
}

async function writableCalendarId(): Promise<string | undefined> {
  const permission = await Calendar.requestCalendarPermissionsAsync();
  if (!permission.granted) return undefined;

  if (Platform.OS === 'ios') {
    const calendar = await Calendar.getDefaultCalendarAsync();
    return calendar.id;
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const preferred =
    calendars.find((calendar) => calendar.isPrimary && calendar.allowsModifications) ??
    calendars.find((calendar) => calendar.allowsModifications);
  return preferred?.id;
}

async function syncPersonalCalendar(
  event: ScheduleEvent,
  context: EventIntegrationContext,
): Promise<{ id?: string; status: EventIntegrationResult['calendarStatus'] }> {
  if (!event.syncToPersonalCalendar) return { status: 'skipped' };

  const available = await Calendar.isAvailableAsync();
  if (!available) return { status: 'unavailable' };

  const calendarId = await writableCalendarId();
  if (!calendarId) return { status: 'denied' };

  const eventData = {
    title: calendarTitle(event, context.monName),
    startDate: event.start,
    endDate: event.end,
    timeZone: context.timeZone,
    notes: event.notes || 'Scheduled from NYC-MON.',
    alarms: [{ relativeOffset: -(event.reminderMinutesBefore ?? 0) }],
    recurrenceRule: isDaily(event)
      ? { frequency: Calendar.Frequency.DAILY, interval: 1 }
      : null,
  };

  if (context.existingCalendarEventId) {
    await Calendar.updateEventAsync(context.existingCalendarEventId, eventData);
    return { id: context.existingCalendarEventId, status: 'synced' };
  }

  const id = await Calendar.createEventAsync(calendarId, eventData);
  return { id, status: 'synced' };
}

async function ensureNotificationChannel() {
  if (channelReady || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Mon care and battles',
    importance: AndroidImportance.HIGH,
  });
  channelReady = true;
}

function notificationCopy(event: ScheduleEvent, monName: string) {
  switch (event.kind) {
    case 'breakfast':
      return { title: `Breakfast time for ${monName}`, body: 'Your Mon is ready to eat.' };
    case 'lunch':
      return { title: `Lunch time for ${monName}`, body: 'Your Mon is ready to eat.' };
    case 'dinner':
      return { title: `Dinner time for ${monName}`, body: 'Your Mon is ready to eat.' };
    case 'play-date':
      return { title: `${monName}'s play date`, body: 'Time to meet up with the other Mons.' };
    case 'battle':
      return { title: `${monName}'s battle is coming up`, body: 'Get your Mon ready.' };
    default:
      return { title: event.title, body: `Scheduled for ${monName}.` };
  }
}

async function scheduleReminder(
  event: ScheduleEvent,
  context: EventIntegrationContext,
): Promise<{ id?: string; status: EventIntegrationResult['reminderStatus'] }> {
  if (!event.reminderEnabled) return { status: 'skipped' };

  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };
  await ensureNotificationChannel();

  if (context.existingNotificationId) {
    await Notifications.cancelScheduledNotificationAsync(context.existingNotificationId);
  }

  const reminderMinutes = event.reminderMinutesBefore ?? 0;
  const copy = notificationCopy(event, context.monName);

  if (isDaily(event)) {
    const start = new Date(event.start.getTime() - reminderMinutes * 60_000);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        ...copy,
        data: { scheduleEventId: event.id, monId: event.resourceId, kind: event.kind },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: start.getHours(),
        minute: start.getMinutes(),
        channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
      },
    });
    return { id, status: 'scheduled' };
  }

  const triggerDate = new Date(event.start.getTime() - reminderMinutes * 60_000);
  if (triggerDate.getTime() <= Date.now()) return { status: 'skipped' };

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      ...copy,
      data: { scheduleEventId: event.id, monId: event.resourceId, kind: event.kind },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
    },
  });
  return { id, status: 'scheduled' };
}

export async function syncEventIntegrations(
  event: ScheduleEvent,
  context: EventIntegrationContext,
): Promise<EventIntegrationResult> {
  const [calendar, reminder] = await Promise.all([
    syncPersonalCalendar(event, context),
    scheduleReminder(event, context),
  ]);

  return {
    calendarEventId: calendar.id,
    notificationId: reminder.id,
    calendarStatus: calendar.status,
    reminderStatus: reminder.status,
  };
}

export async function removeEventIntegrations(params: {
  calendarEventId?: string;
  notificationId?: string;
}) {
  await Promise.all([
    params.calendarEventId
      ? Calendar.deleteEventAsync(params.calendarEventId).catch(() => undefined)
      : Promise.resolve(),
    params.notificationId
      ? Notifications.cancelScheduledNotificationAsync(params.notificationId).catch(() => undefined)
      : Promise.resolve(),
  ]);
}
