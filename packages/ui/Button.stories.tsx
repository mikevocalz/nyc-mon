import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { View } from './tw';

const meta = {
  title: 'UI/Button',
  component: Button,
  args: { title: 'Get started', onPress: () => {} },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Accent: Story = { args: { variant: 'accent', title: 'Get started' } };
export const Outline: Story = { args: { variant: 'outline' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Danger: Story = { args: { variant: 'danger', title: 'Remove' } };
export const Disabled: Story = { args: { disabled: true } };
export const Loading: Story = { args: { loading: true } };
export const Sizes: Story = {
  render: () => (
    <View className="flex-row items-end gap-3 p-4">
      <Button title="Small" size="sm" onPress={() => {}} />
      <Button title="Medium" size="md" onPress={() => {}} />
      <Button title="Large" size="lg" onPress={() => {}} />
    </View>
  ),
};

const DISTRICT_LIST = ['downtown', 'midtown', 'harlem', 'megacity'] as const;

/** NeonBlade corner-cut button: solid face, depth plate, cut corner. Every control is live. */
export const CornerCut: Story = {
  args: { variant: 'cornerCut', title: 'Claim this block', district: 'midtown', corner: 'bottom-right', glow: false },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICT_LIST },
    tone: { control: 'select', options: [undefined, 'orange', 'royal', 'carolina', 'leaf', 'apple', 'brick'] },
    corner: { control: 'inline-radio', options: ['top-left', 'top-right', 'bottom-right', 'bottom-left', 'all'] },
    glow: { control: 'inline-radio', options: [false, 'low', 'medium', 'high'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
  decorators: [(S) => <View className="bg-ink-950 p-6"><S /></View>],
};

/** One corner-cut button per district, plus disabled and loading. */
export const CornerCutDistricts: Story = {
  render: () => (
    <View className="flex-row flex-wrap gap-4 bg-ink-950 p-6">
      <Button variant="cornerCut" district="downtown" title="Downtown" onPress={() => {}} />
      <Button variant="cornerCut" district="midtown" title="Midtown" onPress={() => {}} />
      <Button variant="cornerCut" district="harlem" title="Harlem" onPress={() => {}} />
      <Button variant="cornerCut" district="megacity" title="Mega City" glow="medium" onPress={() => {}} />
      <Button variant="cornerCut" title="Locked" disabled onPress={() => {}} />
      <Button variant="cornerCut" title="Saving" loading onPress={() => {}} />
    </View>
  ),
};
