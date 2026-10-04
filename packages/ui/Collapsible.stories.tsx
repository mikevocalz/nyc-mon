import type { Meta, StoryObj } from '@storybook/react-vite';
import { Collapsible } from './Collapsible';
import { Text } from './Text';
import { View } from './tw';
import { DISTRICTS, DISTRICT_NAME } from './district';

const meta = {
  title: 'UI/Collapsible',
  component: Collapsible,
  args: {
    label: 'Rehearsal notes',
    isOpen: true,
    onOpenChange: () => {},
    children: (
      <Text variant="caption" tone="muted">
        Run the second verse a cappella before the full band comes back in.
      </Text>
    ),
  },
} satisfies Meta<typeof Collapsible>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Open and closed. Controls switch the district (web; native uses the OS disclosure). */
export const States: Story = {
  argTypes: { district: { control: 'inline-radio', options: DISTRICTS } },
  render: (args) => (
    <View className="max-w-content-form gap-3 p-4">
      <Collapsible label="Rehearsal notes" isOpen onOpenChange={() => {}} district={args.district}>
        <Text variant="caption" tone="muted">
          Run the second verse a cappella before the full band comes back in.
        </Text>
      </Collapsible>
      <Collapsible label="Travel details" isOpen={false} onOpenChange={() => {}} district={args.district}>
        <Text variant="caption" tone="muted">
          Coach leaves the church at 6:15 AM.
        </Text>
      </Collapsible>
    </View>
  ),
};

export const Districts: Story = {
  render: () => (
    <View className="max-w-content-form gap-3 p-4">
      {DISTRICTS.map((d) => (
        <Collapsible key={d} label={DISTRICT_NAME[d]} isOpen onOpenChange={() => {}} district={d}>
          <Text variant="caption" tone="muted">Open rows take the district accent bar.</Text>
        </Collapsible>
      ))}
    </View>
  ),
};
