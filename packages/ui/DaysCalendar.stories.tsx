import type { Meta, StoryObj } from '@storybook/react-vite';
import { DaysCalendar } from './care/DaysCalendar';
import { daysTogetherCount, shiftMonth, type YearMonth } from './care/days-model';
import { Text } from './Text';
import { View } from './tw';
import { useInstanceStore, useStore } from './use-instance-store';

/**
 * The journal's days-together calendar (M18, D-15a). Days with an entry carry
 * a mark; a missed day looks exactly like a future day; no streak, no line
 * between days. The count only rises. Navigation stops at the hatch month and
 * at today's month. Fixture data.
 */
const meta = { title: 'Care/DaysCalendar' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const TODAY = '2026-10-08';
const DAYS = new Set(['2026-09-28', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-05', '2026-10-08']);

function Demo({ reducedMotion = false, night = false }: { reducedMotion?: boolean; night?: boolean }) {
  const store = useInstanceStore(() => ({ month: { year: 2026, month: 10 } as YearMonth, selected: undefined as string | undefined }));
  const { month, selected } = useStore(store);
  return (
    <View className={`max-w-[420px] gap-3 p-4 ${night ? 'scheme-dark bg-night' : 'scheme-light bg-bg'}`}>
      <Text>{`${daysTogetherCount(DAYS, TODAY)} days together`}</Text>
      <DaysCalendar
        month={month}
        daysTogether={DAYS}
        today={TODAY}
        selected={selected}
        onSelectDay={(d) => store.setState({ selected: d })}
        onMonthChange={(dir) => store.setState({ month: shiftMonth(month, dir) })}
        minMonth={{ year: 2026, month: 9 }}
        reducedMotion={reducedMotion}
        labels={{ together: 'together', previousMonth: 'Previous month', nextMonth: 'Next month' }}
        locale="en-US"
        testID="m18-calendar"
      />
    </View>
  );
}

export const Default: Story = { render: () => <Demo /> };
export const Night: Story = { render: () => <Demo night /> };
export const ReducedMotion: Story = { render: () => <Demo reducedMotion /> };
