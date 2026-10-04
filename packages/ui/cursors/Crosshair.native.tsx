import type { CrosshairProps } from './types';

/**
 * No cursor on touch screens, so native renders nothing. ReticleShape in
 * ./shapes draws the same reticle on native (for example on a PICO or Quest
 * controller ray's hit point).
 */
export function Crosshair(_props: CrosshairProps) {
  return null;
}
