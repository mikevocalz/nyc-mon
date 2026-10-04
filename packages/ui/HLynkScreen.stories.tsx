import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';
import { HLYNK_COPY } from './hlynk/copy';
import { HLynkScreen } from './hlynk/HLynkScreen';
import { View } from './tw';

/** The 3:4 screen in its black bezel lip. The inside follows the page scheme. */
const meta = { title: 'H-Lynk/HLynkScreen', component: HLynkScreen } satisfies Meta<typeof HLynkScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

/** An egg silhouette standing in for the three.js scene. */
const EggShape = () => (
  <View className="flex-1 items-center justify-center">
    <View className="rounded-full bg-concrete-300" style={{ width: 96, height: 128 }} />
  </View>
);

export const WithEggPlaceholder: Story = {
  render: () => (
    <View className="scheme-light bg-hlynk-core-body p-3" style={{ width: 351 + 24 }}>
      <HLynkScreen><EggShape /></HLynkScreen>
    </View>
  ),
};

export const WithStatusRow: Story = {
  render: () => (
    <View className="scheme-dark bg-hlynk-core-body p-3" style={{ width: 351 + 24 }}>
      <HLynkScreen statusRow={<Badge label={HLYNK_COPY['hlynk.led.incubating']} size="sm" tone="neutral" />}>
        <EggShape />
      </HLynkScreen>
    </View>
  ),
};

/** Full-bleed, for the compact shell. */
export const Fill: Story = {
  render: () => (
    <View className="scheme-light bg-hlynk-core-body" style={{ width: 600, height: 280 }}>
      <HLynkScreen aspect="fill"><EggShape /></HLynkScreen>
    </View>
  ),
};
