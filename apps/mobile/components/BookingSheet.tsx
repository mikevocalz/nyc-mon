'use client';

import { BottomSheet } from '@acme/ui';
import { useRouter } from 'expo-router';
import { BookingForm, useScheduleStore } from '@acme/app';

/**
 * Mon-event sheet backed by Expo UI's universal sheet.
 * SwiftUI / Material own the native presentation while the same component
 * keeps a web implementation, eliminating the former Gorhom-only fork.
 *
 * The sheet has two modes on one open flag: `rescheduleEventId` set means the
 * form edits an existing event (writes a `moveEvent` override); null means a
 * new booking. The `key` remounts the form per target so prefilled defaults
 * never leak between modes or between two reschedules.
 */
export function BookingSheet() {
  const router = useRouter();
  const bookingOpen = useScheduleStore((state) => state.bookingOpen);
  const rescheduleEventId = useScheduleStore((state) => state.rescheduleEventId);
  const closeBooking = useScheduleStore((state) => state.closeBooking);

  return (
    <BottomSheet
      open={bookingOpen}
      onClose={closeBooking}
      closeLabel={rescheduleEventId ? 'Close reschedule' : 'Close add Mon event'}
      title={rescheduleEventId ? 'Reschedule Mon event' : 'Add Mon event'}
    >
      <BookingForm
        key={rescheduleEventId ?? 'new'}
        onDone={closeBooking}
        onOpenEditorSettings={() => {
          closeBooking();
          router.push('/editor-settings');
        }}
      />
    </BottomSheet>
  );
}
