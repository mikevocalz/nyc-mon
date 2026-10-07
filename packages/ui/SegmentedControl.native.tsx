// Native fork: the NYC-MON segmented control renders in the kit on native
// too. It replaces the @expo/ui SwiftUI / Compose control because a
// segmented picker is a row of plain pressables (radiogroup / radio roles,
// checked state, haptic tick) with no platform behaviour the brand look
// would cost. The web-only keyboard model (roving tabindex, arrow keys) is
// gated inside the shared file; native screen readers get the RN radiogroup
// and radio roles.
export { SegmentedControl } from './SegmentedControl.web';
