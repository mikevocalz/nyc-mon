import type { HLynkTier } from './tier';

/**
 * Which hardware key an {@linkcode HLynkKeyProps} draws: the four keys of the
 * Core's bottom control row (Decision #16). Picks the glyph and the default
 * accessible name.
 */
export type HLynkKeyRole = 'home' | 'menu' | 'back' | 'forward';

/**
 * Props for `HLynkKey`, one black key on the H-Lynk body. Placed by
 * {@linkcode HLynkShell} through its `keys` prop.
 */
export interface HLynkKeyProps {
  /** @default 'core' */
  tier?: HLynkTier;
  role: HLynkKeyRole;
  /**
   * Accessible name, also the long-press name (iOS Large Content Viewer, web
   * tooltip). Defaults to the role's `hlynk.key.*.label` string.
   */
  label?: string;
  /** Called on press. Absent: the key renders disabled, never hidden, so the row keeps its shape. */
  onPress?: () => void;
  /** Force the disabled look and state even with a handler. @default false */
  disabled?: boolean;
  /** Reduced press feedback: the glyph turns white, no depress. */
  reducedMotion: boolean;
  testID?: string;
}
