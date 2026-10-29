import type { Meta, StoryObj } from '@storybook/react-vite';
import { HeartRow } from './care/HeartRow';
import { LcdIconButton } from './care/LcdIconButton';
import { LcdPanel } from './care/LcdPanel';
import { lcdColors } from './care/lcd-model';
import { PixelGlyph } from './care/PixelGlyph';
import { PIXEL_GLYPHS, type PixelGlyphName } from './care/pixel-glyphs';
import { SegmentBar } from './care/SegmentBar';
import { CallLamp } from './care/CallLamp';
import { ClassicKey } from './care/ClassicKey';
import { SegmentNumber } from './care/SegmentNumber';
import { Text, View } from './tw';

/**
 * The flat Mon Space LCD (the 2D path beside the WebGPU MemoryLcd): paper by
 * day, backlit at night, inverted for lights out, with its pixel parts: the
 * icon bar buttons, poop piles, hearts, the discipline bar and segment
 * numerals. Fixture copy.
 */
const meta = {
  title: 'Care/LcdPanel',
  component: LcdPanel,
  args: { scheme: 'daylit', inverted: false, children: () => null },
} satisfies Meta<typeof LcdPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

const ICONS: readonly [PixelGlyphName, string][] = [['meal', 'Meal'], ['snack', 'Snack'], ['play', 'Play'], ['lights', 'Lights']];

const Panel = ({ scheme, inverted }: { scheme: 'daylit' | 'night'; inverted: boolean }) => (
  <View style={{ width: 360, height: 360 }}>
    <LcdPanel scheme={scheme} inverted={inverted}>
      {(c) => (
        <View className="flex-1 justify-between p-3">
          <View className="flex-row">
            {ICONS.map(([g, label], i) => (
              <LcdIconButton key={g} glyph={g} label={label} focused={i === 1} colors={c} onPress={() => undefined} />
            ))}
          </View>
          <View className="flex-row items-end justify-center gap-4">
            <PixelGlyph glyph="poop" cell={4} color={c.ink} />
            <PixelGlyph glyph="poop" cell={4} color={c.ink} />
            <PixelGlyph glyph="cold" cell={4} color={c.ink} />
          </View>
          <Text className="text-type-caption" style={{ color: c.ink }}>Fixture LCD</Text>
        </View>
      )}
    </LcdPanel>
  </View>
);

export const Daylit: Story = { render: () => <Panel scheme="daylit" inverted={false} /> };
export const Night: Story = { render: () => <Panel scheme="night" inverted={false} /> };
export const LightsOutDaylit: Story = { render: () => <Panel scheme="daylit" inverted /> };
export const LightsOutNight: Story = { render: () => <Panel scheme="night" inverted /> };

/** The status page parts. */
export const StatusPage: Story = {
  render: () => (
    <View style={{ width: 360, height: 360 }}>
      <LcdPanel scheme="daylit" inverted={false}>
        {(c) => (
          <View className="flex-1 justify-center gap-3 p-5">
            <HeartRow filled={3} label="Hunger" accessibilityLabel="Hunger, 3 of 4 hearts" color={c.ink} labelClassName="text-type-body" cell={4} />
            <HeartRow filled={1} label="Happy" accessibilityLabel="Happy, 1 of 4 hearts" color={c.ink} labelClassName="text-type-body" cell={4} />
            <HeartRow filled={4} label="Energy" accessibilityLabel="Energy, 4 of 4 hearts" color={c.ink} labelClassName="text-type-body" cell={4} />
            <SegmentBar filled={2} label="Boundaries" accessibilityLabel="Boundaries, 2 of 4" color={c.ink} labelClassName="text-type-body" cell={4} />
            <View className="flex-row gap-6">
              <SegmentNumber value={7} color={c.ink} unlit={c.unlit} accessibilityLabel="Weight 7" suffix="wt" />
              <SegmentNumber value={3} color={c.ink} unlit={c.unlit} accessibilityLabel="Age 3 days" suffix="d" />
            </View>
          </View>
        )}
      </LcdPanel>
    </View>
  ),
};

/** Every glyph in the set. */
export const Glyphs: Story = {
  render: () => (
    <View className="flex-row flex-wrap gap-4 bg-concrete-200 p-6">
      {(Object.keys(PIXEL_GLYPHS) as PixelGlyphName[]).map((g) => (
        <View key={g} className="items-center gap-1">
          <PixelGlyph glyph={g} cell={4} color={lcdColors('daylit', false).ink} />
          <Text className="text-type-caption text-text">{g}</Text>
        </View>
      ))}
    </View>
  ),
};

/** The attention lamp: off, calling, and the reduced-motion steady lamp with its dot. */
export const Lamp: Story = {
  render: () => (
    <View className="flex-row gap-6 bg-concrete-200 p-6">
      <CallLamp state="off" accessibilityLabel="Status light off" reducedMotion={false} />
      <CallLamp state="call" accessibilityLabel="Status light on: Squeaklet is calling" reducedMotion={false} />
      <CallLamp state="false-call" accessibilityLabel="Status light on: Squeaklet is calling" reducedMotion />
    </View>
  ),
};

/** The three classic keys under the thumb: A Next, B Select (primary), C Back. */
export const Keys: Story = {
  render: () => (
    <View className="scheme-light flex-row justify-around bg-bg p-6">
      <ClassicKey letter="A" label="Next" onPress={() => undefined} />
      <ClassicKey letter="B" label="Select" primary onPress={() => undefined} />
      <ClassicKey letter="C" label="Back" onPress={() => undefined} />
    </View>
  ),
};
