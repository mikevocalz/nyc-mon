'use client';

import { useEffect } from 'react';
// Extensionless so Metro picks the `.native` fork on the phone.
import { cancelLegacyMealReminders } from './event-integrations';

/**
 * Root-layout entry (imported by full file name; the package `exports` map
 * does no extension probing). Cancels the daily meal reminders older builds
 * scheduled, once per launch.
 */
export function useLegacyMealReminderCleanup(): void {
  useEffect(() => {
    void cancelLegacyMealReminders();
  }, []);
}
