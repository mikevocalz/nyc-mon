import type { Meta, StoryObj } from '@storybook/react-vite';
import { BottomSheet, SheetSurface } from './BottomSheet';
import { Button } from './Button';
import { Text, View } from './tw';
import { DISTRICTS, DISTRICT_NAME } from './district';

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

// RN Modal portals outside the story canvas — the inline surface stories below
// are the reliable visual reference; this one exercises the modal wiring.
export const Open: Story = {
  args: {
    children: <Text className="text-base text-text-muted">Everything you need for the session, in one place.</Text>,
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
