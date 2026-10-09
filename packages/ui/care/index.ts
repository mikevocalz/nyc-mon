// Care primitives for M13–M18 (docs/design/screens/M13/04-components.md).
export { CareMeterRing, type CareMeterRingProps } from './CareMeterRing';
export { CareMeterRingGroup, type CareMeterRingGroupProps } from './CareMeterRingGroup';
export { RoundDots, type RoundDotsProps } from './RoundDots';
export { LifecycleTrack, type LifecycleTrackProps } from './LifecycleTrack';
export { lifecycleSlots, lifecycleSlotSpoken, type LifecycleSlot, type LifecycleStateWords } from './lifecycle-model';
export { DaysCalendar, type DaysCalendarProps, type DaysCalendarLabels } from './DaysCalendar';
export {
  monthGrid, dayKind, daysTogetherCount, shiftMonth, canShift, compareMonth, monthOf, isoDate, daysInMonth,
  type YearMonth, type DayKind,
} from './days-model';
export { FoodTile, type FoodTileProps } from './FoodTile';
export { roundDots, type RoundDot } from './round-dots-model';
export {
  countdownProgress, minuteSteppedProgress, stopArcs, arcPath, stepStop, percentOf, careRingName, clamp01,
} from './ring-model';
