'use client';
import { ScreenPanes } from '../layout/ScreenPanes';
import { NotificationsList, NotificationsSummary } from './notifications-content';

/*
  One tree (ScreenPanes), switched by class only:

  - Phone: the old column, summary then the Today/Earlier list.
  - Tablet portrait (md+): the same column, top-aligned and widened to 560.
  - Landscape (md+): the summary (title, unread count, Mark all read, the
    notifications-off status) on the left, the list on the right.

  The store owns read state, so rotating loses nothing.
*/
export function NotificationsScreen() {
  return <ScreenPanes primary={<NotificationsSummary />} secondary={<NotificationsList />} />;
}
