import type { Meta, StoryObj } from '@storybook/react-vite';
import { RiveLoader } from './RiveLoader';
import { View } from './tw';

// Storybook renders the web fork (the kit's CircularProgress in scanner red);
// the H-Lynk scanner-ring .riv plays on native.
const meta = {
  title: 'Progress/Rive loader',
  component: RiveLoader,
  args: { size: 160, phase: 'loading', scheme: 'dark', label: 'Loading' },
  argTypes: {
    size: { control: { type: 'range', min: 64, max: 320, step: 8 } },
    phase: { control: 'inline-radio', options: ['loading', 'complete', 'error', 'reduced'] },
    progress: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    scheme: { control: 'inline-radio', options: ['dark', 'light'] },
  },
  render: (args) => (
    <View className={`items-start p-4 ${args.scheme === 'light' ? 'bg-concrete-50' : 'bg-ink-950'}`}>
      <RiveLoader {...args} />
    </View>
  ),
} satisfies Meta<typeof RiveLoader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithProgress: Story = { args: { progress: 0.6 } };

export const Daylit: Story = { args: { scheme: 'light' } };

export const Phases: Story = {
  render: () => (
    <View className="flex-row flex-wrap items-center gap-5 bg-ink-950 p-4">
      <RiveLoader size={96} phase="loading" label="Loading" />
      <RiveLoader size={96} phase="reduced" label="Loading, reduced motion" />
      <RiveLoader size={96} phase="error" label="Could not load" />
      <RiveLoader size={96} phase="loading" progress={0.35} label="Loading, 35%" />
    </View>
  ),
};
