export interface EventIntegrationContext {
  monName: string;
  timeZone: string;
  existingCalendarEventId?: string;
  existingNotificationId?: string;
}

export interface EventIntegrationResult {
  calendarEventId?: string;
  notificationId?: string;
  calendarStatus: 'synced' | 'skipped' | 'denied' | 'unavailable';
  reminderStatus: 'scheduled' | 'skipped' | 'denied' | 'unavailable';
}
