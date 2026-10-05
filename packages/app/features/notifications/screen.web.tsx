'use client';
import { Container } from '@acme/ui';
import { NotificationsContent } from './notifications-content';

export function NotificationsScreen() {
  return (
    <Container width="full" className="mx-auto min-h-screen w-full max-w-screen-2xl flex-1 bg-surface py-6 pb-48 sm:py-8 sm:pb-48">
      <Container width="detail">
        <NotificationsContent />
      </Container>
    </Container>
  );
}
