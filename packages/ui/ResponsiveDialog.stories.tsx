import type { Meta, StoryObj } from '@storybook/react-vite';
import { ResponsiveDialog } from './ResponsiveDialog';
import { Button } from './Button';
import { Text, View } from './tw';
import { useState } from 'react';
import { ReservedRegionsOverride } from './reserved-regions-override';

const meta = { title: 'UI/ResponsiveDialog' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const Opener = (props: { tabletop?: boolean }) => {
  const [open, setOpen] = useState(true);
  const inner = (
    <ResponsiveDialog
      open={open}
      onClose={() => setOpen(false)}
      title="Confirm section"
      description="The dialog picks its vessel from the window class."
      actions={<Button title="Done" onPress={() => setOpen(false)} />}
    >
      <Text>Dialog at medium and up, a sheet on compact.</Text>
    </ResponsiveDialog>
  );
  return (
    <View className="min-h-96 p-4">
      <Button title="Open" variant="outline" onPress={() => setOpen(true)} />
      {props.tabletop ? (
        // A horizontal hinge at mid-window (tabletop), as WindowManager would report it.
        <ReservedRegionsOverride
          regions={[{
            kind: 'division', x: 0, y: 420, width: 840, height: 4,
            margins: { top: 0, left: 0, bottom: 0, right: 0 },
            active: true, orientation: 'horizontal', state: 'halfOpened', separating: true,
          }]}
        >
          {inner}
        </ReservedRegionsOverride>
      ) : inner}
    </View>
  );
};

/** Desktop: the kit dialog, centred. */
export const Desktop: Story = { render: () => <Opener /> };

/** Narrow preview viewport: the bottom sheet. */
export const Compact: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => <Opener />,
};

/** Tabletop fold: the dialog pins to the bottom segment instead of the hinge. */
export const TabletopFold: Story = { render: () => <Opener tabletop /> };
