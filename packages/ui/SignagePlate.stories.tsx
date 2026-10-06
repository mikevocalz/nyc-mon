import type { Meta, StoryObj } from '@storybook/react-vite';
import { SignagePlate } from './SignagePlate';
import { Text, View } from './tw';

const meta = {
  title: 'UI/SignagePlate',
  component: SignagePlate,
  args: {
    text: 'Jay St',
    accessibilityLabel: 'Caller name preview: Jay St',
    maxSize: 'station',
  },
} satisfies Meta<typeof SignagePlate>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A short station-style plate. */
export const Short: Story = {};

/** A long name steps down one size so the band stays one line. */
export const Long: Story = {
  args: {
    text: 'Coney Island–Stillwell Av',
    accessibilityLabel: 'Caller name preview: Coney Island–Stillwell Av',
  },
};

/** Empty text renders nothing; the note shows the slot is intentionally blank. */
export const Empty: Story = {
  args: { text: '', accessibilityLabel: 'Caller name preview' },
  render: (args) => (
    <View className="p-4">
      <SignagePlate {...args} />
      <Text className="mt-2 text-type-caption text-text-muted">(empty text renders null)</Text>
    </View>
  ),
};

/** Title ceiling with a long name, stepping down to the body ramp. */
export const LargeText: Story = {
  args: {
    maxSize: 'title',
    text: 'Grand Central–42nd Street',
    accessibilityLabel: 'Caller name preview: Grand Central–42nd Street',
  },
};

/** On a night page the plate draws its 1 pt silver keyline. */
export const NightPage: Story = {
  args: {
    text: 'Jackson Hts–Roosevelt Av',
    accessibilityLabel: 'Caller name preview: Jackson Hts–Roosevelt Av',
  },
  globals: { theme: 'dark' },
};
