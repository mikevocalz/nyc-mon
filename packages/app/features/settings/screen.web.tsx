'use client';
import { Container } from '@acme/ui';
import { SettingsContent } from './settings-content';

export function SettingsScreen() {
  return (
    <Container width="detail" className="min-h-screen flex-1 bg-surface py-6 pb-48 sm:py-8 sm:pb-48">
      <SettingsContent />
    </Container>
  );
}
