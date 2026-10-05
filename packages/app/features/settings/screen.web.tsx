'use client';
import { Container } from '@acme/ui';
import { SettingsContent } from './settings-content';

export function SettingsScreen() {
  return (
    <Container width="full" className="mx-auto min-h-screen w-full max-w-screen-2xl flex-1 bg-surface py-6 pb-48 sm:py-8 sm:pb-48">
      <Container width="detail">
        <SettingsContent />
      </Container>
    </Container>
  );
}
