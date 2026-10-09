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
    closeLabel: 'Close session details',
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
    <SheetSurface title="Session details" district={args.district} onClose={() => {}} closeLabel="Close session details">
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
          <SheetSurface title={`${DISTRICT_NAME[d]} booking`} district={d} onClose={() => {}} closeLabel="Close booking">
            <Text className="text-base text-text-muted">Pick a time and a room.</Text>
          </SheetSurface>
        </View>
      ))}
    </View>
  ),
};

/**
 * `scheme="system"` follows the page: a white raised face with signage-black
 * text in daylight, night after dark. The default `night` keeps the facade
 * dark whatever the OS says. The close label comes from the caller.
 */
export const SystemScheme: Story = {
  render: () => (
    <View className="h-72 max-w-content-form">
      <SheetSurface scheme="system" title="Session reminders" onClose={() => {}} closeLabel="Close session reminders">
        <Text className="text-base text-text-muted">Get a reminder an hour before the session starts.</Text>
        <Button title="Turn on" variant="primary" fullWidth className="mt-4" onPress={() => {}} />
      </SheetSurface>
    </View>
  ),
};

/**
 * `placement="in-screen"` (M14 tray, M16 card): docked inside the H-Lynk
 * screen, at most 85% of it, no OS scrim, not modal, so the trackpad and keys
 * under it stay live. Shown inside a 3:4 screen-sized box. Story fixture copy.
 */
export const InScreen: Story = {
  render: () => (
    <View className="relative overflow-hidden bg-concrete-100" style={{ width: 351, height: 468 }}>
      <SheetSurface placement="in-screen" title="Share a meal" onClose={() => {}} closeLabel="Close the meal tray" testID="m14-tray">
        <Text className="text-base text-text-muted">The tray sits in the screen; the shell controls stay live.</Text>
      </SheetSurface>
    </View>
  ),
};
