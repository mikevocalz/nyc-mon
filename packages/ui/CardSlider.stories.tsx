import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CardSliderImageAspect, CardSliderImageFrame, CardSliderImageItemData } from './cards/card-slider.types';
import { CardSlider, type CardSliderProps } from './cards/CardSlider';
import { CITY_PHOTO_ITEMS, CardSliderImageItem } from './cards/slider-items';
import { DISTRICTS, type District } from './cards/tones';
import { Heading } from './html';
import { Text } from './Text';
import { View } from './tw';

// A reading per photo, in NeonBlade's demo shape (a place, a line, a number).
const READINGS: Record<string, string> = {
  'downtown-one-wtc': 'Crews 4',
  'downtown-nyse': 'Held 2 days',
  'midtown-empire-sunset': 'Sightings 38',
  'midtown-times-square': 'Busy',
  'midtown-chrysler-spire': 'Sightings 51',
  'harlem-apollo': 'Streak 6 days',
  'harlem-brownstone-stoops': 'Claimed',
  'harlem-lenox-rowhouses': 'Crews 3',
  'megacity-brooklyn-bridge-night': 'Wait 3 min',
  'megacity-bridge-deck': 'Rising',
};
const ITEMS: CardSliderImageItemData[] = CITY_PHOTO_ITEMS.map((it) => ({ ...it, meta: READINGS[it.id] }));

/** Every photo, the given district's first, so each demo opens on its own neighbourhood. */
const from = (d: District) => [...ITEMS.filter((it) => it.district === d), ...ITEMS.filter((it) => it.district !== d)];

/**
 * One image slide per photo. The first `eager` slides load at once (they are
 * on screen at first paint); the rest load lazily as they near the viewport.
 */
const slides = (frame: CardSliderImageFrame, aspect: CardSliderImageAspect = 'classic', eager = 1, items = ITEMS) =>
  items.map((it, i) => (
    <CardSliderImageItem key={it.id} {...it} frame={frame} aspect={aspect} priority={i < eager} />
  ));

const meta = {
  title: 'Cards/Card slider',
  component: CardSlider,
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'CardSlider, the port of NeonBlade card-slider (Card Slider). Slides here are CardSliderImageItem: a bundled NYC photo in a notch, corner-cut or beam frame with a solid title band in the district tone. CardSlider itself takes any children.' } },
  },
  args: {
    label: 'City landmarks',
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
      <CardSlider {...args}>{slides('notch', 'classic', 3)}</CardSlider>
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
        <CardSlider label="Landmarks, Downtown first" district="downtown" visibleCount={1} progressStyle="bar" buttonPosition="sides">
          {slides('cornerCut', 'wide', 1, from('downtown'))}
        </CardSlider>
      </Demo>
      <Demo title="One, two, then three across, dots, bottom buttons, frame corners">
        <CardSlider
          label="Landmarks, Midtown first"
          district="midtown"
          visibleCount={{ sm: 1, md: 2, lg: 3 }}
          progressStyle="dots"
          buttonPosition="bottom"
          showCornerAccents
          cornerAccentStyle="frame"
        >
          {slides('notch', 'classic', 3, from('midtown'))}
        </CardSlider>
      </Demo>
      <Demo title="Two across (one on phones), counter, buttons on hover, plus corners">
        <CardSlider
          label="Landmarks, Harlem first"
          district="harlem"
          visibleCount={{ sm: 1, md: 2 }}
          progressStyle="counter"
          buttonVisibility="hover"
          showCornerAccents
          cornerAccentStyle="plus"
          showEdgeFades
          loop
        >
          {slides('notch', 'classic', 2, from('harlem'))}
        </CardSlider>
      </Demo>
      <Demo title="Autoplay with a pause control, scan lines">
        <Text className="text-silver-400">Holds while hovered or focused. Starts paused when reduced motion is on.</Text>
        <CardSlider
          label="Landmarks, Mega City first"
          district="megacity"
          visibleCount={{ sm: 1, md: 2 }}
          autoPlay
          autoPlayInterval={2500}
          loop
          scanLines
          showEdgeFades
        >
          {slides('beam', 'classic', 2, from('megacity'))}
        </CardSlider>
      </Demo>
    </View>
  ),
};

/** The three progress styles, one district each. */
export const ProgressStyles: Story = {
  render: () => (
    <View className="min-h-screen gap-12 bg-ink-950 px-4 py-8 md:px-10">
      <CardSlider label="Landmarks, Downtown first" district="downtown" visibleCount={{ sm: 1, md: 2 }} progressStyle="bar" buttonPosition="bottom">{slides('cornerCut', 'classic', 2, from('downtown'))}</CardSlider>
      <CardSlider label="Landmarks, Harlem first" district="harlem" visibleCount={{ sm: 1, md: 3 }} progressStyle="dots" buttonPosition="bottom" loop>{slides('notch', 'tall', 3, from('harlem'))}</CardSlider>
      <CardSlider label="Landmarks, Mega City first" district="megacity" visibleCount={{ sm: 1, md: 2 }} progressStyle="counter" buttonPosition="bottom">{slides('beam', 'classic', 2, from('megacity'))}</CardSlider>
    </View>
  ),
};
