// Native fork: the NYC-MON segmented control renders in the kit on native
// too. It replaces the @expo/ui SwiftUI / Compose control because a
// segmented picker is a row of plain pressables (tab role, selected state,
// haptic tick) with no platform behaviour the brand look would cost.
export { SegmentedControl } from './SegmentedControl.web';
