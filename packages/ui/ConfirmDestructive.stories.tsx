import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConfirmDestructive } from './ConfirmDestructive';
import { Button } from './Button';
import { View } from './tw';
import { useState } from 'react';

const meta = { title: 'UI/ConfirmDestructive' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const Opener = (props: Omit<React.ComponentProps<typeof ConfirmDestructive>, 'open' | 'onClose'>) => {
  const [open, setOpen] = useState(true);
  return (
    <View className="min-h-96 p-4">
      <Button title="Reopen" variant="outline" onPress={() => setOpen(true)} />
      <ConfirmDestructive {...props} open={open} onClose={() => setOpen(false)} />
    </View>
  );
};

const REASONS = [
  { value: 'guardian-request', label: 'Guardian request' },
  { value: 'account-idle', label: 'Account idle' },
];

/** Schedule caller deletion: reason select plus type-to-confirm. */
export const ScheduleDeletion: Story = {
  render: () => (
    <Opener
      title="Schedule deletion"
      consequences={['The Caller is signed out everywhere.', 'The record is deleted after a 7-day grace period.', 'This is audited under your staff role.']}
      confirmText="JX4K2"
      confirmLabel="Schedule deletion"
      reasonOptions={REASONS}
      onConfirm={async () => {}}
    />
  ),
};

/** Consent deletion: confirm text only, no reason select. */
export const DeleteConsentRecord: Story = {
  render: () => (
    <Opener
      title="Delete consent record"
      consequences={['The consent request can no longer be approved.', 'The guardian is not emailed again.']}
      confirmText="99ZZ1"
      confirmLabel="Delete record"
      onConfirm={async () => {}}
    />
  ),
};

/** The destructive button's pending state while the endpoint answers. */
export const PendingState: Story = {
  render: () => (
    <Opener
      title="Sign out everywhere"
      consequences={['Every session ends, including this device.']}
      confirmText="JX4K2"
      confirmLabel="Sign out everywhere"
      onConfirm={() => new Promise(() => {})}
    />
  ),
};

/** The endpoint's error stays inline and the dialog stays open. */
export const InlineError: Story = {
  render: () => (
    <Opener
      title="Schedule deletion"
      consequences={['The record is deleted after a 7-day grace period.']}
      confirmText="JX4K2"
      confirmLabel="Schedule deletion"
      onConfirm={async () => { throw new Error('Another staff member changed this record. Reload and try again.'); }}
    />
  ),
};
