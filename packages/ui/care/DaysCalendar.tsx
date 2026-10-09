'use client';
import { haptics } from '../haptics';
import { ChevronLeft, ChevronRight } from '../icons';
import { hiddenA11y } from '../hlynk/a11y';
import { AnimatedView } from '../progress/motion';
import { Pressable, Text, View } from '../tw';
import { canShift, dayKind, monthGrid, type YearMonth } from './days-model';

/** Words the calendar speaks, from the screen's copy. The kit invents none. */
export interface DaysCalendarLabels {
  /** Appended to a day with an entry: "October 5, together". */
  together: string;
  previousMonth: string;
  nextMonth: string;
}

export interface DaysCalendarProps {
  /** Month shown, as { year, month 1–12 } in the device time zone. */
  month: YearMonth;
  /** ISO dates (YYYY-MM-DD) that have at least one journal entry. */
  daysTogether: ReadonlySet<string>;
  today: string;
  selected?: string;
  onSelectDay?: (isoDate: string) => void;
  onMonthChange: (direction: -1 | 1) => void;
  /** Earliest month reachable: the hatch month. */
  minMonth: YearMonth;
  reducedMotion: boolean;
  labels: DaysCalendarLabels;
  /** BCP 47 locale for month and day names. @default the runtime's */
  locale?: string;
  /** 0 Sunday, 1 Monday. @default 0 */
  weekStartsOn?: 0 | 1;
  testID?: string;
}

/** `gridcell` is not in React Native's Role union; react-native-web passes it through to the DOM. */
const GRIDCELL = { role: 'gridcell' } as object;

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

/**
 * The journal's days-together calendar (M18, DECISIONS D-15a). There is
 * deliberately no streak or run prop and no line joining neighbouring days: a
 * day with an entry carries a filled square mark, and every other day, past
 * or future, looks the same. Navigation stops at the hatch month and at
 * today's month. A grid of real buttons (`role="grid"`), each named
 * "October 5, together" or "October 6". The month change slides 24 pt
 * (`motion-step`); reduced motion fades only.
 */
export function DaysCalendar({
  month, daysTogether, today, selected, onSelectDay, onMonthChange, minMonth, reducedMotion, labels,
  locale, weekStartsOn = 0, testID,
}: DaysCalendarProps) {
  const weeks = monthGrid(month, weekStartsOn);
  const title = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(month.year, month.month - 1, 1)));
  const dayName = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', timeZone: 'UTC' });
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
  const prevOk = canShift(month, -1, minMonth, today);
  const nextOk = canShift(month, 1, minMonth, today);
  const nav = (dir: -1 | 1, ok: boolean, label: string) => (
    <Pressable
      role="button"
      accessibilityLabel={label}
      aria-label={label}
      aria-disabled={!ok}
      accessibilityState={{ disabled: !ok }}
      onPress={ok ? () => { haptics.selection(); onMonthChange(dir); } : undefined}
      className={`h-11 w-11 items-center justify-center border-2 ${ok ? 'border-border-strong' : 'border-border'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus`}
    >
      {dir < 0 ? <ChevronLeft size={18} className={ok ? 'text-text' : 'text-text-muted'} /> : <ChevronRight size={18} className={ok ? 'text-text' : 'text-text-muted'} />}
    </Pressable>
  );
  // Seven weekday initials from the first full week.
  const sample = weeks.find((w) => w.every(Boolean)) ?? weeks[1] ?? [];

  return (
    <View testID={testID} className="gap-3">
      <View className="flex-row items-center justify-between gap-2">
        {nav(-1, prevOk, labels.previousMonth)}
        <Text className="text-type-title text-text" role="heading" accessibilityRole="header" aria-live="polite">{title}</Text>
        {nav(1, nextOk, labels.nextMonth)}
      </View>
      <AnimatedView
        key={`${month.year}-${month.month}`}
        role="grid"
        accessibilityRole="grid"
        aria-label={title}
        accessibilityLabel={title}
        className="gap-1"
        style={{
          animationName: { from: { opacity: 0, transform: [{ translateY: reducedMotion ? 0 : 8 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } },
          animationDuration: reducedMotion ? '120ms' : '200ms',
          animationTimingFunction: 'ease-out',
          animationFillMode: 'both',
        } as object}
      >
        <View role="row" className="flex-row" {...(hiddenA11y(true) as object)}>
          {sample.map((iso, i) => (
            <Text key={i} className="flex-1 text-center text-type-caption text-text-muted">{iso ? weekday.format(utc(iso)) : ''}</Text>
          ))}
        </View>
        {weeks.map((week, wi) => (
          <View key={wi} role="row" className="flex-row">
            {week.map((iso, di) => {
              if (!iso) return <View key={di} {...GRIDCELL} className="min-h-11 flex-1" />;
              const together = dayKind(iso, daysTogether) === 'together';
              const name = together ? `${dayName.format(utc(iso))}, ${labels.together}` : dayName.format(utc(iso));
              const isSelected = iso === selected;
              const isToday = iso === today;
              return (
                <View key={di} {...GRIDCELL} className="flex-1">
                  <Pressable
                    role="button"
                    accessibilityLabel={name}
                    aria-label={name}
                    {...({ 'aria-selected': isSelected, 'aria-current': isToday ? 'date' : undefined } as object)}
                    accessibilityState={{ selected: isSelected, disabled: !onSelectDay }}
                    onPress={onSelectDay ? () => onSelectDay(iso) : undefined}
                    className={`min-h-11 items-center justify-center gap-0.5 border-2 ${isSelected ? 'border-border-strong' : 'border-transparent'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus`}
                  >
                    <Text className={`text-type-body tabular-nums text-text ${isToday ? 'underline' : ''}`}>{Number(iso.slice(8))}</Text>
                    <View {...(hiddenA11y(true) as object)} className={together ? 'bg-structure' : 'bg-transparent'} style={{ width: 6, height: 6 }} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </AnimatedView>
    </View>
  );
}
