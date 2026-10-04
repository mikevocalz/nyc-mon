import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';
import { Card } from './Card';
import { CardSlider, type CardSliderProps } from './cards/CardSlider';
import { DISTRICT_NAME, DISTRICTS, type District } from './cards/tones';
import { Heading } from './html';
import { Text } from './Text';
import { View } from './tw';

// One block per stop, in NeonBlade's demo shape (a status, a name, a reading).
const BLOCKS: { d: District; name: string; reading: string; status: string }[] = [
  { d: 'downtown', name: 'Wall St and Broad', reading: 'Crews 4', status: 'Held' },
  { d: 'midtown', name: 'Bryant Park', reading: 'Sightings 38', status: 'Open' },
  { d: 'harlem', name: '125th and Lenox', reading: 'Streak 6 days', status: 'Claimed' },
  { d: 'megacity', name: 'Level 90 bridge', reading: 'Wait 3 min', status: 'Rising' },
  { d: 'downtown', name: 'Bowling Green', reading: 'Crews 2', status: 'Open' },
  { d: 'midtown', name: 'Grand Central', reading: 'Sightings 51', status: 'Busy' },
];

const slides = (variant: 'notch' | 'cornerCut' | 'beam') =>
  BLOCKS.map((b, i) => (
    <Card key={i} variant={variant} district={b.d} title={b.name} description={`${DISTRICT_NAME[b.d]}, ${b.reading}`}>
      <View className="mt-3 flex-row">
        <Badge label={b.status} />
      </View>
    </Card>
  ));

const meta = {
  title: 'Cards/Card slider',
  component: CardSlider,
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'CardSlider, the port of NeonBlade card-slider (Card Slider).' } },
  },
  args: {
    label: 'Featured blocks',
    visibleCount: { sm: 1, md: 2, xl: 3 },
    gap: 16,
    showButtons: true,
    buttonPosition: 'sides',
    buttonVisibility: 'always',
    showProgress: true,
    progressStyle: 'bar',
    loop: false,
    autoPlay: false,
    autoPlayInterval: 3000,
    enableSwipe: true,
    swipeThreshold: 50,
    showEdgeFades: false,
    showCornerAccents: false,
    cornerAccentStyle: 'frame',
    scanLines: false,
    district: 'midtown',
    children: null,
  },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    tone: { control: 'select', options: [undefined, 'orange', 'royal', 'carolina', 'leaf', 'apple', 'brick'] },
    progressStyle: { control: 'inline-radio', options: ['bar', 'dots', 'counter'] },
    buttonPosition: { control: 'inline-radio', options: ['sides', 'bottom'] },
    buttonVisibility: { control: 'inline-radio', options: ['always', 'hover'] },
    cornerAccentStyle: { control: 'inline-radio', options: ['frame', 'plus'] },
    prevButtonCorner: { control: 'inline-radio', options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] },
    nextButtonCorner: { control: 'inline-radio', options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] },
    gap: { control: { type: 'range', min: 0, max: 48, step: 4 } },
    autoPlayInterval: { control: { type: 'range', min: 1000, max: 8000, step: 500 } },
    edgeFadeColor: { control: 'color' },
    children: { control: false },
  },
} satisfies Meta<typeof CardSlider>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Every prop as a control. One card on phones, two from md, three from xl. */
export const Playground: Story = {
  name: 'Card Slider (NeonBlade: Card Slider)',
  render: (args: CardSliderProps) => (
    <View className="min-h-screen bg-ink-950 px-4 py-8 md:px-10">
      <CardSlider {...args}>{slides('notch')}</CardSlider>
    </View>
  ),
};

function Demo({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <Heading level={2} className="my-0 font-display text-lg text-ink-50">{title}</Heading>
      {children}
    </View>
  );
}

/**
 * NeonBlade's four demos, NYC-MON style: single card with side buttons;
 * responsive 1 to 3 with dots, bottom buttons and frame corners; two up with
 * the counter, hover buttons and plus corners; autoplay with scan lines.
 */
export const NeonBladeDemos: Story = {
  name: 'NeonBlade demos',
  render: () => (
    <View className="min-h-screen gap-12 bg-ink-950 px-4 py-8 md:px-10">
      <Demo title="One card, bar progress, side buttons">
        <CardSlider label="Downtown blocks" district="downtown" visibleCount={1} progressStyle="bar" buttonPosition="sides">
          {slides('cornerCut')}
        </CardSlider>
      </Demo>
      <Demo title="One, two, then three across, dots, bottom buttons, frame corners">
        <CardSlider
          label="Midtown blocks"
          district="midtown"
          visibleCount={{ sm: 1, md: 2, lg: 3 }}
          progressStyle="dots"
          buttonPosition="bottom"
          showCornerAccents
          cornerAccentStyle="frame"
        >
          {slides('notch')}
        </CardSlider>
      </Demo>
      <Demo title="Two across, counter, buttons on hover, plus corners">
        <CardSlider
          label="Harlem blocks"
          district="harlem"
          visibleCount={2}
          progressStyle="counter"
          buttonVisibility="hover"
          showCornerAccents
          cornerAccentStyle="plus"
          showEdgeFades
          loop
        >
          {slides('notch')}
        </CardSlider>
      </Demo>
      <Demo title="Autoplay with a pause control, scan lines">
        <Text className="text-silver-400">Holds while hovered or focused. Starts paused when reduced motion is on.</Text>
        <CardSlider
          label="Mega City blocks"
          district="megacity"
          visibleCount={{ sm: 1, md: 2 }}
          autoPlay
          autoPlayInterval={2500}
          loop
          scanLines
          showEdgeFades
        >
          {slides('beam')}
        </CardSlider>
      </Demo>
    </View>
  ),
};

/** The three progress styles, one district each. */
export const ProgressStyles: Story = {
  render: () => (
    <View className="min-h-screen gap-12 bg-ink-950 px-4 py-8 md:px-10">
      <CardSlider label="Downtown blocks" district="downtown" visibleCount={{ sm: 1, md: 2 }} progressStyle="bar" buttonPosition="bottom">{slides('cornerCut')}</CardSlider>
      <CardSlider label="Harlem blocks" district="harlem" visibleCount={{ sm: 1, md: 3 }} progressStyle="dots" buttonPosition="bottom" loop>{slides('notch')}</CardSlider>
      <CardSlider label="Mega City blocks" district="megacity" visibleCount={{ sm: 1, md: 2 }} progressStyle="counter" buttonPosition="bottom">{slides('beam')}</CardSlider>
    </View>
  ),
};
