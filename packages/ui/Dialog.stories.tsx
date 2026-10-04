import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dialog, DialogCard } from './Dialog';
import { Button } from './Button';
import { View } from './tw';

const meta = {
  title: 'UI/Dialog',
  component: Dialog,
  args: {
    open: true,
    onClose: () => {},
    title: 'Discard changes?',
    description: 'Your edits have not been saved yet.',
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// RN Modal portals outside the story canvas — the inline surface stories below
// are the reliable visual reference; this one exercises the modal wiring.
export const Open: Story = {};

export const Surface: Story = {
  render: () => (
    <DialogCard
      title="Discard changes?"
      description="Your edits have not been saved yet."
      actions={
        <>
          <Button title="Stay" variant="ghost" onPress={() => {}} />
          <Button title="Leave" variant="danger" onPress={() => {}} />
        </>
      }
    />
  ),
};

export const SurfaceWithoutActions: Story = {
  render: () => (
    <DialogCard
      title="You&apos;re all set"
      description="Your voice part has been updated to Alto."
    />
  ),
};

/** The neon variant: a building facade with a cornice, a sign band and a stoop. */
export const Neon: Story = {
  args: { variant: 'neon', district: 'midtown', size: 'md', footerAlign: 'right', animation: 'scale', glow: true },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'neon'] },
    district: { control: 'inline-radio', options: ['downtown', 'midtown', 'harlem', 'megacity'] },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl', 'full'] },
    footerAlign: { control: 'inline-radio', options: ['left', 'center', 'right', 'between'] },
    animation: { control: 'inline-radio', options: ['scale', 'slide', 'none'] },
  },
  render: (args) => (
    <View className="p-4">
      <DialogCard
        {...args}
        title="Claim this block?"
        description="Harlem 125th becomes yours until someone beats your score."
        onClose={() => {}}
        actions={
          <>
            <Button title="Not now" variant="ghost" onPress={() => {}} />
            <Button title="Claim block" onPress={() => {}} />
          </>
        }
      />
    </View>
  ),
};

/** One facade per district. */
export const NeonDistricts: Story = {
  render: () => (
    <View className="gap-8 p-4 lg:flex-row lg:flex-wrap">
      {(['downtown', 'midtown', 'harlem', 'megacity'] as const).map((district) => (
        <View key={district} className="lg:w-[calc(50%-1rem)]">
          <DialogCard
            variant="neon"
            district={district}
            size="sm"
            title={`Enter ${district === 'megacity' ? 'Mega City' : district[0]!.toUpperCase() + district.slice(1)}`}
            description="Your crew is two blocks away."
            actions={<Button title="Go" onPress={() => {}} />}
          />
        </View>
      ))}
    </View>
  ),
};
