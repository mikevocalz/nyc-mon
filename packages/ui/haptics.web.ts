/** Web fork — no haptics on the web platform; calls are free no-ops. */
export const haptics = {
  tap: () => undefined,
  success: () => undefined,
  warning: () => undefined,
  selection: () => undefined,
  warm: () => undefined,
  hatchLatch: () => undefined,
  hatchCrack: () => undefined,
  hatchBloom: () => undefined,
  hatchEmerge: () => undefined,
  firstLook: () => undefined,
};
