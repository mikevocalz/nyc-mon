import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './Avatar';
import { Text } from './Text';
import { View } from './tw';
import { DISTRICTS, DISTRICT_NAME } from './district';
import { AVATAR_GRADIENTS } from './avatar-look';

const PHOTO = 'https://i.pravatar.cc/256?img=5';
const SIZES = ['sm', 'md', 'lg', 'xl'] as const;

const meta = {
  title: 'UI/Avatar',
  component: Avatar,
  args: { name: 'Maya Rodriguez' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['cornerCut', 'neon', 'bracket'] },
    gradient: { control: 'inline-radio', options: Object.keys(AVATAR_GRADIENTS) },
    size: { control: 'inline-radio', options: SIZES },
    rounded: { control: 'boolean' },
  },
} satisfies Meta<typeof Avatar>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The default: gradient tile, bottom-right corner cut, night initials. */
export const Default: Story = {
  render: (args) => (
    <View className="gap-6 bg-ink-950 p-6">
      <Avatar {...args} size={args.size ?? 'lg'} />
      <View className="flex-row items-end gap-3">
        {SIZES.map((size) => <Avatar key={size} name="Maya Rodriguez" size={size} />)}
      </View>
    </View>
  ),
};

/** Gradient presets, a custom token pair, and NeonBlade's original cyan to magenta. */
export const Gradients: Story = {
  render: () => (
    <View className="gap-4 bg-ink-950 p-6">
      {(Object.keys(AVATAR_GRADIENTS) as (keyof typeof AVATAR_GRADIENTS)[]).map((g) => (
        <View key={g} className="flex-row items-center gap-4">
          <Avatar name="Kira Nakamura" gradient={g} size="lg" />
          <Text className="text-ink-200">{g}</Text>
        </View>
      ))}
      <View className="flex-row items-center gap-4">
        <Avatar name="Zane Holloway" gradient={['leaf', 'carolina']} size="lg" />
        <Text className="text-ink-200">{"['leaf', 'carolina']"}</Text>
      </View>
    </View>
  ),
};

/** Photos take the same corner cut. */
export const WithImage: Story = {
  render: () => (
    <View className="flex-row items-end gap-3 bg-ink-950 p-6">
      {SIZES.map((size) => <Avatar key={size} name="Maya Rodriguez" imageUri={PHOTO} size={size} />)}
      <Avatar name="Fallback Initials" size="xl" />
    </View>
  ),
};

const USERS = [
  { name: 'Kira Nakamura', email: 'kira@nyc-mon.dev' },
  { name: 'Zane Holloway', email: 'zane@nyc-mon.dev' },
  { name: 'Lyra Chen', email: 'lyra@nyc-mon.dev' },
  { name: 'Axel Reeves', email: 'axel@nyc-mon.dev' },
] as const;

/** NeonBlade's data-table user column: tile, then name over email. */
export const UserList: Story = {
  render: () => (
    <View className="flex-row flex-wrap gap-10 bg-ink-950 p-6">
      {(['skyline', 'neonblade'] as const).map((g) => (
        <View key={g} className="gap-4">
          {USERS.map((u) => (
            <View key={u.name} className="flex-row items-center gap-3">
              <Avatar name={u.name} gradient={g} />
              <View className="gap-0.5">
                <Text className="font-semibold text-ink-50">{u.name}</Text>
                <Text className="text-sm text-ink-300">{u.email}</Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  ),
};

/** The opt-in bracket look: tile colour by district, plus the `md:h-11 md:w-11` override the split layout passes. */
export const Bracket: Story = {
  args: { variant: 'bracket' },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    tone: { control: 'select', options: [undefined, 'orange', 'royal', 'carolina', 'leaf', 'apple', 'brick'] },
  },
  render: (args) => (
    <View className="gap-4 p-4">
      <Avatar {...args} />
      <View className="flex-row flex-wrap items-end gap-3">
        {DISTRICTS.map((d) => <Avatar key={d} variant="bracket" name={DISTRICT_NAME[d]} district={d} size="lg" />)}
        <Avatar variant="bracket" name="Apple Tone" tone="apple" size="lg" />
        <Avatar variant="bracket" name="Photo" imageUri={PHOTO} size="lg" />
      </View>
      <View className="flex-row items-center gap-2">
        <Avatar size="sm" className="md:h-11 md:w-11" name="Row Override" />
        <Text>Row override: sm, md:h-11</Text>
      </View>
    </View>
  ),
};

/** Rounding is opt-in and replaces the corner cut. */
export const Rounded: Story = {
  render: () => (
    <View className="flex-row gap-4 bg-ink-950 p-6">
      <Avatar name="Maya Rodriguez" size="lg" />
      <Avatar name="Maya Rodriguez" size="lg" rounded />
      <Avatar name="Maya Rodriguez" imageUri={PHOTO} size="lg" rounded />
      <Avatar name="Maya Rodriguez" variant="bracket" size="lg" rounded />
    </View>
  ),
};
