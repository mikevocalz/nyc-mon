import type { Meta, StoryObj } from '@storybook/react-vite';
import { BottomSheet, SheetSurface } from './BottomSheet';
import { Button } from './Button';
import { Text, View } from './tw';
import { DISTRICTS, DISTRICT_NAME } from './district';
import { useInstanceStore, useStore } from './use-instance-store';

const meta = {
  title: 'UI/BottomSheet',
  component: BottomSheet,
  args: {
    open: true,
    onClose: () => {},
    title: 'Session details',
    children: null,
  },
} satisfies Meta<typeof BottomSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Opens on load and closes for real: the close control, the scrim, Escape,
 * a drag down and the Android back button all call onClose, which flips the
 * story's own `open`. The sheet is fully controlled, so a pinned
 * `open: true` with a no-op onClose would never close.
 */
export const Open: Story = {
  args: {
    children: <Text className="text-base text-text-muted">Everything you need for the session, in one place.</Text>,
  },
  render: function Render(args) {
    const store = useInstanceStore(() => ({ open: args.open }));
    const open = useStore(store, (s) => s.open);
    return (
      <View className="items-start p-6">
        <Button title="Open sheet" onPress={() => store.setState({ open: true })} />
        <BottomSheet
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

/** No props beyond a title: the Midtown facade. Controls switch the district. */
export const Surface: Story = {
  argTypes: { district: { control: 'inline-radio', options: DISTRICTS } },
  render: (args) => (
    <SheetSurface title="Session details" district={args.district} onClose={() => {}}>
      <Text className="text-base text-text-muted">
        Everything you need for the session, in one place.
      </Text>
      <Button title="I&apos;ll be there" fullWidth className="mt-4" onPress={() => {}} />
    </SheetSurface>
  ),
};

export const SurfaceWithoutTitle: Story = {
  render: () => (
    <SheetSurface>
      <Text className="text-base text-text">Share this concert with a friend.</Text>
    </SheetSurface>
  ),
};

/** The surface in each district. */
export const Districts: Story = {
  render: () => (
    <View className="gap-6 md:flex-row md:flex-wrap">
      {DISTRICTS.map((d) => (
        <View key={d} className="h-56 md:w-96">
          <SheetSurface title={`${DISTRICT_NAME[d]} booking`} district={d} onClose={() => {}}>
            <Text className="text-base text-text-muted">Pick a time and a room.</Text>
          </SheetSurface>
        </View>
      ))}
    </View>
  ),
};
