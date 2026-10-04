import type { Meta, StoryObj } from '@storybook/react-vite';
import { CopyButton } from './CopyButton';
import { KeyValueList } from './KeyValueList';
import { Text, View } from './tw';
import { Toaster } from './notify';

const meta = { title: 'UI/CopyButton' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The ghost icon button; success and failure both report through notify. */
export const Default: Story = {
  render: () => (
    <View className="flex-row items-center gap-3 p-4">
      <CopyButton value="usr_01JX4K2" label="Copy Caller id" />
      <Toaster />
    </View>
  ),
};

/** Beside the value inside a KeyValueList pair. */
export const InKeyValueList: Story = {
  render: () => (
    <View className="w-96 p-4">
      <KeyValueList
        columns={1}
        items={[{ key: 'id', label: 'Caller id', value: <Text>usr_01JX4K2</Text>, action: <CopyButton value="usr_01JX4K2" label="Copy Caller id" /> }]}
      />
      <Toaster />
    </View>
  ),
};
