import type { Meta, StoryObj } from '@storybook/react-vite';
import { IncubationRing } from './hatch/IncubationRing';
import type { IncubationRingStop } from './hatch/IncubationRing.types';
import { Text } from './Text';
import { View } from './tw';
import { useInstanceStore, useStore } from './use-instance-store';

/**
 * M10's time choice and M11's countdown in one primitive. Choice: three stops
 * on a 12 pt ring with 8 pt gaps, radios laid over the labels, no default.
 * Countdown: a 4 pt decorative ring that fills from props and a clock and
 * turns orange when full. Copy here is story fixture text.
 */
const meta = { title: 'Hatch/IncubationRing' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const STOPS: IncubationRingStop<15 | 30 | 60>[] = [
  { value: 15, label: '15 min', accessibilityLabel: '15 minutes' },
  { value: 30, label: '30 min', accessibilityLabel: '30 minutes' },
  { value: 60, label: '60 min', accessibilityLabel: '60 minutes' },
];

function Choice({ initial, progress, reducedMotion = false, scheme = 'daylit' }: { initial: 15 | 30 | 60 | null; progress?: number; reducedMotion?: boolean; scheme?: 'daylit' | 'night' }) {
  const store = useInstanceStore(() => ({ value: initial }));
  const value = useStore(store, (s) => s.value);
  return (
    <View className={`items-center gap-3 p-6 ${scheme === 'night' ? 'scheme-dark bg-night' : 'scheme-light bg-bg'}`}>
      <IncubationRing
        stops={STOPS}
        value={value}
        onChange={(v) => store.setState({ value: v })}
        progress={progress}
        sizePt={260}
        scheme={scheme}
        reducedMotion={reducedMotion}
        accessibilityLabel="Incubation time"
        testID="m10-ring"
        stopTestID={(v) => `m10-option-${v}`}
      />
      <Text variant="caption">{value === null ? 'No time chosen' : `Chosen: ${value} min`}</Text>
    </View>
  );
}

/** No default: nothing is chosen on mount. */
export const Unselected: Story = { render: () => <Choice initial={null} /> };
export const Selected: Story = { render: () => <Choice initial={30} /> };
/** The elapsed arc over the chosen stop (M11 reuse of M10's ring). */
export const Progress: Story = { render: () => <Choice initial={30} progress={0.4} /> };
export const NightPage: Story = { render: () => <Choice initial={15} scheme="night" /> };
export const ReducedMotion: Story = { render: () => <Choice initial={60} reducedMotion /> };

const MIN = 60_000;
function Countdown({ elapsed, span, reducedMotion = false }: { elapsed: number; span: number; reducedMotion?: boolean }) {
  // Fixed at first render so the story shows the named moment and then counts on.
  const store = useInstanceStore(() => ({ start: Date.now() - elapsed }));
  const start = useStore(store, (s) => s.start);
  return (
    <View className="flex-row items-center gap-4 bg-signage-black p-6">
      <IncubationRing startedAt={start} endsAt={start + span} reducedMotion={reducedMotion} testID="m11-ring" />
      <IncubationRing startedAt={start} endsAt={start + span} reducedMotion={reducedMotion} sizePt={48} />
    </View>
  );
}

export const Start: Story = { render: () => <Countdown elapsed={0} span={15 * MIN} /> };
export const Half: Story = { render: () => <Countdown elapsed={7.5 * MIN} span={15 * MIN} /> };
export const LastMinute: Story = { render: () => <Countdown elapsed={14 * MIN} span={15 * MIN} /> };
export const Full: Story = { render: () => <Countdown elapsed={16 * MIN} span={15 * MIN} /> };
/** Reduced: one step per minute, never continuous. */
export const Reduced: Story = { render: () => <Countdown elapsed={7.5 * MIN} span={15 * MIN} reducedMotion /> };
