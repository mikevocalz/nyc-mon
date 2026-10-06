import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checklist, CheckRow } from './Checklist';
import { View } from './tw';

const meta = { title: 'UI/Checklist' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Every check passing. */
export const AllPassing: Story = {
  render: () => (
    <View className="max-w-xl p-4">
      <Checklist>
        <CheckRow label="Shared egg ids" result={{ kind: 'pass', count: 0 }} detail="Every egg id is unique." />
        <CheckRow label="Mon ⇄ egg match" result={{ kind: 'pass', count: 0 }} />
        <CheckRow label="Orphaned Mons" result={{ kind: 'pass', count: 0 }} />
      </Checklist>
    </View>
  ),
};

/** One failing check, linked to the records. */
export const OneFailing: Story = {
  render: () => (
    <View className="max-w-xl p-4">
      <Checklist>
        <CheckRow label="Shared egg ids" result={{ kind: 'pass', count: 0 }} />
        <CheckRow label="Mon ⇄ egg match" result={{ kind: 'fail', count: 3 }} detail="3 eggs point at missing Mons." href="/admin/integrity" />
        <CheckRow label="Stale ready eggs" result={{ kind: 'info', count: 12 }} />
      </Checklist>
    </View>
  ),
};

/** A check the server could not run, with its reason. */
export const Unavailable: Story = {
  render: () => (
    <View className="max-w-xl p-4">
      <Checklist>
        <CheckRow label="Shared egg ids" result={{ kind: 'pending' }} />
        <CheckRow label="Mon ⇄ egg match" result={{ kind: 'unavailable', reason: 'integrity run in progress' }} />
      </Checklist>
    </View>
  ),
};
