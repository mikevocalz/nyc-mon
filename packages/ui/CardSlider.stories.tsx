import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './Card';
import { CardSlider, type CardSliderProps } from './cards/CardSlider';
import { DISTRICT_NAME, DISTRICTS } from './cards/tones';
import { View } from './tw';

const LINES = [
  'Glass towers, setbacks and a spire.',
  'Deco crowns and rooftop water towers.',
  'Brownstone rows and their stoops.',
  'Megastructures joined by sky bridges.',
];

const slides = (variant: 'notch' | 'cornerCut' | 'beam') =>
  Array.from({ length: 8 }, (_, i) => {
    const d = DISTRICTS[i % 4]!;
    return <Card key={i} variant={variant} district={d} title={`${DISTRICT_NAME[d]} ${Math.floor(i / 4) + 1}`} description={LINES[i % 4]} />;
  });

const meta = {
  title: 'Cards/Card slider',
  component: CardSlider,
  parameters: { layout: 'fullscreen' },
  args: {
    label: 'Featured blocks',
    visibleCount: { sm: 1, md: 2, xl: 3 },
    gap: 16,
    showButtons: true,
    showProgress: true,
    progressStyle: 'bar',
    loop: false,
    district: 'midtown',
    children: null,
  },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    tone: { control: 'select', options: [undefined, 'orange', 'royal', 'carolina', 'leaf', 'apple', 'brick'] },
    progressStyle: { control: 'inline-radio', options: ['bar', 'dots', 'counter'] },
    gap: { control: { type: 'range', min: 0, max: 48, step: 4 } },
    children: { control: false },
  },
} satisfies Meta<typeof CardSlider>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Every prop as a control. One card on phones, two from md, three from xl. */
export const Playground: Story = {
  render: (args: CardSliderProps) => (
    <View className="min-h-screen bg-ink-950 px-4 py-8 md:px-10">
      <CardSlider {...args}>{slides('notch')}</CardSlider>
    </View>
  ),
};

/** The three progress styles, one district each. */
export const ProgressStyles: Story = {
  render: () => (
    <View className="min-h-screen gap-12 bg-ink-950 px-4 py-8 md:px-10">
      <CardSlider label="Downtown blocks" district="downtown" visibleCount={{ sm: 1, md: 2 }} progressStyle="bar">{slides('cornerCut')}</CardSlider>
      <CardSlider label="Harlem blocks" district="harlem" visibleCount={{ sm: 1, md: 3 }} progressStyle="dots" loop>{slides('notch')}</CardSlider>
      <CardSlider label="Mega City blocks" district="megacity" visibleCount={{ sm: 1, md: 2 }} progressStyle="counter">{slides('beam')}</CardSlider>
    </View>
  ),
};
