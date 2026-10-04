import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dialog, DialogCard } from './Dialog';
import { Button } from './Button';
import { View } from './tw';
import { Text } from './Text';
import { useInstanceStore, useStore } from './use-instance-store';

const meta = {
  title: 'UI/Dialog',
  component: Dialog,
  parameters: {
    docs: { description: { component: 'Dialog and the neon building-facade modal. NeonBlade: Neon Modal (neon-modal).' } },
  },
  args: {
    open: true,
    onClose: () => {},
    title: 'Discard changes?',
    description: 'Your edits have not been saved yet.',
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Opens on load and closes for real: the close control, the scrim, Escape
 * and the Android back button all call onClose, which flips the story's own
 * `open`. A Dialog is fully controlled, so a story that pins `open: true`
 * with a no-op onClose can never close.
 */
export const Open: Story = {
  render: function Render(args) {
    const store = useInstanceStore(() => ({ open: args.open }));
    const open = useStore(store, (s) => s.open);
    return (
      <View className="items-start p-6">
        <Button title="Open dialog" onPress={() => store.setState({ open: true })} />
        <Dialog
          {...args}
          open={open}
          onClose={() => {
            args.onClose();
            store.setState({ open: false });
          }}
        />
      </View>
    );
  },
};

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
  name: 'Neon (NeonBlade: Neon Modal)',
  args: { variant: 'neon', district: 'midtown', size: 'md', footerAlign: 'right', animation: 'scale', glow: true, dividers: false, borderBeam: true, beamSpeed: 3 },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'neon'] },
    district: { control: 'inline-radio', options: ['downtown', 'midtown', 'harlem', 'megacity'] },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl', 'full'] },
    footerAlign: { control: 'inline-radio', options: ['left', 'center', 'right', 'between'] },
    animation: { control: 'inline-radio', options: ['scale', 'slide', 'none'] },
    dividers: { control: 'boolean' },
    borderBeam: { control: 'boolean' },
    beamSpeed: { control: { type: 'range', min: 1, max: 8, step: 0.5 } },
    beamLength: { control: { type: 'range', min: 1, max: 4, step: 1 } },
    glowIntensity: { control: 'inline-radio', options: ['none', 'low', 'medium', 'high'] },
    bgColor: { control: 'color' },
  },
  render: (args) => (
    <View className="p-4">
      <DialogCard
        {...args}
        title="Claim this block?"
        label="125th St and Lenox"
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

/**
 * `<Dialog variant="neon">`, declarative: the button flips `open`. The modal
 * portals to the page, traps focus, closes on Escape and on the scrim.
 */
export const NeonModalOpen: Story = {
  name: 'Open neon modal (declarative)',
  args: { variant: 'neon', district: 'downtown', backdropBlur: true, backdropOverlay: true, closeOnBackdrop: true, closeOnEscape: true },
  argTypes: {
    district: { control: 'inline-radio', options: ['downtown', 'midtown', 'harlem', 'megacity'] },
  },
  render: function Render(args) {
    const store = useInstanceStore(() => ({ open: false }));
    const open = useStore(store, (s) => s.open);
    const close = () => store.setState({ open: false });
    return (
      <View className="min-h-screen items-start gap-4 bg-ink-950 p-6">
        <Text className="text-silver-300">Opens the same facade as notify.modal, rendered by a Dialog you control.</Text>
        <Button variant="cornerCut" district={args.district} title="Open neon modal" onPress={() => store.setState({ open: true })} />
        <Dialog
          {...args}
          open={open}
          onClose={close}
          variant="neon"
          label="Wall St and Broad"
          title="Join the Downtown crew?"
          description="You will see their claims on your map and share points on every block."
          dividers
          borderBeam
          actions={
            <>
              <Button title="Not now" variant="ghost" onPress={close} />
              <Button title="Join crew" variant="cornerCut" district={args.district} onPress={close} />
            </>
          }
        />
      </View>
    );
  },
};
