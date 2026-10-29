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
// Mon Space: four-heart rows, the LCD panel and its pixel parts (docs/research/vpet-modern-design-directions.md, Direction A).
export { HeartRow, type HeartRowProps } from './HeartRow';
export { SegmentBar, type SegmentBarProps } from './SegmentBar';
export { SegmentNumber, type SegmentNumberProps } from './SegmentNumber';
export { PixelGlyph, type PixelGlyphProps } from './PixelGlyph';
export { LcdPanel, type LcdPanelProps } from './LcdPanel';
export { LcdIconButton, type LcdIconButtonProps } from './LcdIconButton';
export { PIXEL_GLYPHS, glyphPath, glyphSize, fourMarks, type PixelBitmap, type PixelGlyphName } from './pixel-glyphs';
export { lcdColors, segmentDigits, segmentMask, type LcdColors, type SegmentMask } from './lcd-model';
