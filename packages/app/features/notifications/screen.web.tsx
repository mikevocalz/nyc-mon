'use client';
import { Container } from '@acme/ui';
import { NotificationsContent } from './notifications-content';

export function NotificationsScreen() {
  return (
    <Container width="detail" className="min-h-screen flex-1 bg-surface py-6 pb-48 sm:py-8 sm:pb-48">
      <NotificationsContent />
    </Container>
  );
}
