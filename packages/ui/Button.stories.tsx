import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { View } from './tw';
import { Text } from './Text';
import { CONTROL_TONES, DISTRICTS, DISTRICT_NAME } from './district';

const VARIANTS = ['cornerCut', 'primary', 'accent', 'outline', 'ghost', 'danger', 'neon'] as const;

const meta = {
  title: 'UI/Button',
  component: Button,
  args: { title: 'Claim this block', onPress: () => {} },
  argTypes: {
    variant: { control: 'select', options: [undefined, ...VARIANTS] },
    district: { control: 'inline-radio', options: [undefined, ...DISTRICTS] },
    tone: { control: 'select', options: [undefined, ...CONTROL_TONES] },
    corner: { control: 'inline-radio', options: ['top-left', 'top-right', 'bottom-right', 'bottom-left', 'all'] },
    glow: { control: 'inline-radio', options: [false, 'low', 'medium', 'high'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No props: the solid corner-cut face in Midtown orange. */
export const Primary: Story = {};
/** accent: the district's second tone (royal in Midtown). */
export const Accent: Story = { args: { variant: 'accent', title: 'Get started' } };
/** outline: night face behind a tone border. */
export const Outline: Story = { args: { variant: 'outline', title: 'Cancel' } };
/** ghost: no frame, tone label, soft tone tint on hover. */
export const Ghost: Story = { args: { variant: 'ghost', title: 'Skip for now' } };
/** danger: always apple. */
export const Danger: Story = { args: { variant: 'danger', title: 'Remove' } };
/** Unavailable: no tone, no depth plate, muted label. */
export const Disabled: Story = { args: { disabled: true } };
export const Loading: Story = { args: { loading: true, title: 'Saving' } };
export const Sizes: Story = {
  render: () => (
    <View className="flex-row flex-wrap items-end gap-4 p-4">
      <Button title="Small" size="sm" onPress={() => {}} />
      <Button title="Medium" size="md" onPress={() => {}} />
      <Button title="Large" size="lg" onPress={() => {}} />
    </View>
  ),
};

/**
 * Ghost has no frame, so its hit area is its whole size. Every ghost size is
 * at least 44 pt tall (48 dp on Android): `sm` keeps its tighter padding but
 * not a shorter target.
 */
export const GhostSizes: Story = {
  render: () => (
    <View className="flex-row flex-wrap items-center gap-4 p-4">
      <Button variant="ghost" title="Small" size="sm" onPress={() => {}} className="outline outline-1 outline-border" />
      <Button variant="ghost" title="Medium" size="md" onPress={() => {}} className="outline outline-1 outline-border" />
      <Button variant="ghost" title="Large" size="lg" onPress={() => {}} className="outline outline-1 outline-border" />
    </View>
  ),
};

/** The `cornerCut` alias still renders the default; every control is live. */
export const CornerCut: Story = {
  args: { variant: 'cornerCut', district: 'midtown', corner: 'bottom-right', glow: false },
};

/** One default button per district, plus disabled and loading. */
export const CornerCutDistricts: Story = {
  render: () => (
    <View className="flex-row flex-wrap gap-4 p-4">
      {DISTRICTS.map((d) => (
        <Button key={d} district={d} title={DISTRICT_NAME[d]} glow={d === 'megacity' ? 'medium' : false} onPress={() => {}} />
      ))}
      <Button title="Locked" disabled onPress={() => {}} />
      <Button title="Saving" loading onPress={() => {}} />
    </View>
  ),
};

/** Every legacy variant name in every district, on night and on a light page. */
export const VariantShowcase: Story = {
  render: () => (
    <View className="gap-6 p-4">
      {DISTRICTS.map((d) => (
        <View key={d} className="gap-2">
          <Text className="font-display text-sm text-text-muted">{DISTRICT_NAME[d]}</Text>
          <View className="flex-row flex-wrap items-center gap-3">
            <Button district={d} title="Default" onPress={() => {}} />
            <Button district={d} variant="accent" title="Accent" onPress={() => {}} />
            <Button district={d} variant="outline" title="Outline" onPress={() => {}} />
            <Button district={d} variant="ghost" title="Ghost" onPress={() => {}} />
            <Button district={d} variant="danger" title="Danger" onPress={() => {}} />
            <Button district={d} title="Disabled" disabled onPress={() => {}} />
          </View>
        </View>
      ))}
      <View className="scheme-light gap-3 bg-ink-50 p-4">
        <Text className="font-display text-sm text-ink-950">On a light page</Text>
        <View className="flex-row flex-wrap items-center gap-3">
          <Button title="Default" onPress={() => {}} />
          <Button variant="outline" title="Outline" onPress={() => {}} />
          <Button title="Disabled" disabled onPress={() => {}} />
        </View>
      </View>
    </View>
  ),
};

/**
 * Ghost labels sit straight on the page, so every tone draws its themed
 * `tone-*-text` step: the night step on night, a darker one on daylit. Shown
 * on the page and on the sunken surface (the darker light background).
 */
export const GhostTones: Story = {
  render: () => (
    <View className="gap-4 p-4">
      {(['bg-bg', 'bg-surface-sunken'] as const).map((surface) => (
        <View key={surface} className={`flex-row flex-wrap items-center gap-2 p-2 ${surface}`}>
          {CONTROL_TONES.map((t) => (
            <Button key={t} tone={t} variant="ghost" title={t} onPress={() => {}} />
          ))}
          <Button variant="ghost" title="disabled" disabled onPress={() => {}} />
        </View>
      ))}
    </View>
  ),
};

/** Callers that pass flex classes: Cancel + Create share a row (BookingForm), and a full-width CTA. */
export const InLayout: Story = {
  render: () => (
    <View className="max-w-content-form gap-4 p-4">
      <View className="flex-row gap-3">
        <Button variant="outline" title="Cancel" onPress={() => {}} className="flex-1" />
        <Button title="Create booking" onPress={() => {}} className="flex-[2]" />
      </View>
      <Button title="Book appointment" fullWidth onPress={() => {}} />
      <Button title="Book appointment" className="w-full" onPress={() => {}} />
    </View>
  ),
};

/** Rounding is opt-in: `rounded` swaps the corner cut for rounded-soft corners. */
export const Rounded: Story = {
  args: { title: 'Rounded' },
  render: () => (
    <View className="flex-row flex-wrap gap-4 bg-ink-950 p-6">
      <Button title="Square (default)" />
      <Button title="Rounded" rounded />
      <Button title="Rounded outline" variant="outline" rounded />
    </View>
  ),
};
