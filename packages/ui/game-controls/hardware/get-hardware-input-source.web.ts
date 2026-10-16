// Web fork: one Gamepad API adapter per page, created on first use so the
// module can be imported during SSR (apps/web is Next).
import { createWebGamepadInput } from './gamepad.web';
import type { HardwareInputSource } from './hardware-input-source';

let source: HardwareInputSource | null | undefined;

/** The page's {@linkcode HardwareInputSource}, or `null` outside a browser. */
export function getHardwareInputSource(): HardwareInputSource | null {
  if (source === undefined) {
    source = typeof window === 'undefined' || typeof navigator === 'undefined' ? null : createWebGamepadInput();
  }
  return source;
}
