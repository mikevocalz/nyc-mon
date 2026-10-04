import type { Meta, StoryObj } from '@storybook/react-vite';
import { KeyValueList } from './KeyValueList';
import { CopyButton } from './CopyButton';
import { Timestamp } from './Timestamp';
import { View } from './tw';

const meta = { title: 'UI/KeyValueList' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** One column of pairs. */
export const Default: Story = {
  render: () => (
    <View className="w-96 p-4">
      <KeyValueList
        columns={1}
        items={[
          { key: 'id', label: 'Caller id', value: 'usr_01JX4K2' },
          { key: 'joined', label: 'Joined', value: <Timestamp at={Date.now() - 90 * 24 * 3600_000} format="absolute" /> },
          { key: 'consent', label: 'Consent status', value: 'Pending' },
        ]}
      />
    </View>
  ),
};

/** Pair actions: a copy affordance beside the id. */
export const WithActions: Story = {
  render: () => (
    <View className="w-96 p-4">
      <KeyValueList
        columns={1}
        items={[
          { key: 'id', label: 'Caller id', value: 'usr_01JX4K2', action: <CopyButton value="usr_01JX4K2" label="Copy Caller id" /> },
          { key: 'egg', label: 'Egg id', value: 'egg_99ZZ1', action: <CopyButton value="egg_99ZZ1" label="Copy Egg id" /> },
        ]}
      />
    </View>
  ),
};

/** Two columns above 600 px of pane width. */
export const TwoColumns: Story = {
  render: () => (
    <View className="max-w-3xl p-4">
      <KeyValueList
        columns={2}
        items={[
          { key: 'id', label: 'Caller id', value: 'usr_01JX4K2' },
          { key: 'joined', label: 'Joined', value: '12 Mar 2026' },
          { key: 'consent', label: 'Consent status', value: 'Pending' },
          { key: 'mons', label: 'Mons', value: '3' },
        ]}
      />
    </View>
  ),
};

/** A null value renders the TODO(canon) badge. */
export const TodoCanon: Story = {
  render: () => (
    <View className="w-96 p-4">
      <KeyValueList
        columns={1}
        items={[
          { key: 'bloodline', label: 'Bloodline', value: 'Kingsbridge' },
          { key: 'canon', label: 'Canon arc', value: null },
        ]}
      />
    </View>
  ),
};
