// The one rule both touch controls use when `disabled` flips on mid-gesture
// (finding M4). Pure, so node tests cover it.
//
// RNGH tears the gesture down when `enabled` goes false; whether it still
// fires `onFinalize` for the owning pointer is not documented for 3.2.1. So
// the component neutralises from an effect, and the test for "is there
// anything to neutralise" must be pointer ownership. Reading the published
// direction or `engaged` misses a thumb that went down and stayed inside the
// dead zone: it owns the router's stick with a neutral reading, and without a
// `cancel` every later keyboard or gamepad `begin` is rejected as owned by
// touch.

/** Pointer id that owns a control, `NO_OWNER` when none. */
export const NO_OWNER = -1;

/** True when a control must publish its `cancel`/`up` because `disabled` turned on. */
export function mustReleaseOnDisable(ownerPointerId: number): boolean {
  'worklet';
  return ownerPointerId !== NO_OWNER;
}
