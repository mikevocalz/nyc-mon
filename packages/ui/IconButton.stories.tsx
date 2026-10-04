import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from './IconButton';
import { View } from './tw';
import { Text } from './Text';
import { ChevronLeft, ChevronRight, Settings, X } from './icons';
import { CONTROL_TONES, DISTRICTS, DISTRICT_NAME } from './district';

const meta = {
  title: 'UI/IconButton',
  component: IconButton,
  // No colour class on the icon: it takes the frame's label colour (currentColor).
  args: { icon: <Settings size={20} strokeWidth={2.5} />, 'aria-label': 'Settings' },
  argTypes: {
    variant: { control: 'select', options: [undefined, 'cornerCut', 'primary', 'outline', 'ghost', 'neon'] },
    district: { control: 'inline-radio', options: [undefined, ...DISTRICTS] },
    tone: { control: 'select', options: [undefined, ...CONTROL_TONES] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    corner: { control: 'inline-radio', options: ['top-left', 'top-right', 'bottom-right', 'bottom-left', 'all'] },
  },
} satisfies Meta<typeof IconButton>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Default (no variant), outline, ghost and disabled. */
export const Variants: Story = {
  render: () => (
    <View className="flex-row flex-wrap items-center gap-4 p-4">
      <IconButton icon={<Settings size={20} strokeWidth={2.5} />} aria-label="Default" />
      <IconButton variant="outline" icon={<Settings size={20} strokeWidth={2.5} />} aria-label="Outline" />
      <IconButton variant="ghost" icon={<Settings size={20} strokeWidth={2.5} />} aria-label="Ghost" />
      <IconButton disabled icon={<Settings size={20} strokeWidth={2.5} />} aria-label="Disabled" />
    </View>
  ),
};

/** Ghost sizes: every one is at least a 44 pt (48 dp Android) square. The outline marks the hit area. */
export const GhostSizes: Story = {
  render: () => (
    <View className="flex-row flex-wrap items-center gap-4 bg-bg p-4">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <IconButton key={size} variant="ghost" size={size} aria-label={`Settings, ${size}`} icon={<Settings size={20} strokeWidth={2.5} />} className="outline outline-1 outline-border" />
      ))}
    </View>
  ),
};

/** One default icon button per district, every size, plus a disabled one. */
export const CornerCut: Story = {
  render: () => (
    <View className="gap-5 p-4">
      <View className="flex-row flex-wrap items-center gap-4">
        {DISTRICTS.map((d, i) => (
          <IconButton
            key={d}
            district={d}
            size={(['sm', 'md', 'lg', 'md'] as const)[i]}
            corner={d === 'harlem' ? 'top-left' : 'bottom-right'}
            icon={<Settings size={20} strokeWidth={2.5} />}
            aria-label={`${DISTRICT_NAME[d]} settings`}
          />
        ))}
        <IconButton disabled icon={<Settings size={20} strokeWidth={2.5} />} aria-label="Settings (disabled)" />
      </View>
      <View className="flex-row flex-wrap items-center gap-4">
        {DISTRICTS.map((d) => (
          <IconButton key={d} district={d} variant="outline" icon={<X size={20} strokeWidth={2.5} />} aria-label={`Close ${DISTRICT_NAME[d]}`} />
        ))}
      </View>
    </View>
  ),
};

/** Ghost icons with no colour of their own take the tone's themed page step (`tone-*-text`). */
export const GhostTones: Story = {
  render: () => (
    <View className="flex-row flex-wrap items-center gap-2 bg-bg p-4">
      {CONTROL_TONES.map((t) => (
        <IconButton key={t} tone={t} variant="ghost" aria-label={`Settings, ${t}`} icon={<Settings size={20} strokeWidth={2.5} />} />
      ))}
      <IconButton variant="ghost" disabled aria-label="Settings, disabled" icon={<Settings size={20} strokeWidth={2.5} />} />
    </View>
  ),
};

/** Ghost in a nav bar (DetailNavbar, MiniCalendar): compact, the caller's muted icon stays legible. */
export const GhostNavBar: Story = {
  render: () => (
    <View className="max-w-content-form flex-row items-center gap-2 border-2 border-ink-800 bg-ink-900 p-2">
      <IconButton variant="ghost" size="sm" aria-label="Previous month" icon={<ChevronLeft className="text-text-muted" />} />
      <Text className="flex-1 text-center font-display text-sm text-ink-50">October 2026</Text>
      <IconButton variant="ghost" size="sm" aria-label="Next month" icon={<ChevronRight className="text-text-muted" />} />
    </View>
  ),
};
