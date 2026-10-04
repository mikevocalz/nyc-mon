import type { ScheduleEvent } from './model';

import type { EventIntegrationContext, EventIntegrationResult } from './event-integrations.types';
export type { EventIntegrationContext, EventIntegrationResult } from './event-integrations.types';

/**
 * Web/SSR fallback. Native resolves event-integrations.native.ts instead.
 * The in-app calendar still works on web; personal-calendar and local-device
 * reminders are native device capabilities.
 */
export async function syncEventIntegrations(
  _event: ScheduleEvent,
  _context: EventIntegrationContext,
): Promise<EventIntegrationResult> {
  return {
    calendarStatus: 'unavailable',
    reminderStatus: 'unavailable',
  };
}

export async function removeEventIntegrations(_params: {
  calendarEventId?: string;
  notificationId?: string;
}): Promise<void> {}
