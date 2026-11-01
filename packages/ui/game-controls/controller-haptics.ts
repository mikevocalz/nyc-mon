// Haptics for the arcade controls, through the kit's semantic vocabulary in
// ../haptics (never Pulsar directly; haptics.native.ts explains why). The
// profile's HapticStrength picks which semantic call each moment makes.
//
// Decision: BUILD with the vocabulary the kit has today. `tap`, `selection`,
// `success` and `warning` are the only system presets exposed, so `light` and
// `medium`/`strong` differ in which preset they use, not in amplitude. Adding
// `impactMedium`/`impactHeavy` to haptics.native.ts (Pulsar `System.*`) is
// outside lane C1; the report proposes it.
import { haptics } from '../haptics';
import type { HapticStrength } from './contract.ts';

/** The moments a control vibrates for. Each is a no-op at strength `off`. */
export interface ControllerHaptics {
  /** A button cap or the stick thumb goes down. */
  press(): void;
  /** The pill toggles pause/resume. */
  toggle(): void;
  /** The stop hold completed. */
  stopConfirm(): void;
}

const silent: ControllerHaptics = { press: () => undefined, toggle: () => undefined, stopConfirm: () => undefined };

/**
 * Resolves the profile's {@linkcode HapticStrength} to the three controller
 * moments. Cheap and pure apart from the vibration itself; call it in render
 * and keep the result.
 *
 * @see {@linkcode ControllerProfile.haptics}
 */
export function controllerHaptics(strength: HapticStrength): ControllerHaptics {
  switch (strength) {
    case 'off':
      return silent;
    case 'light':
      return { press: haptics.selection, toggle: haptics.selection, stopConfirm: haptics.warning };
    case 'medium':
      return { press: haptics.tap, toggle: haptics.selection, stopConfirm: haptics.warning };
    case 'strong':
      return { press: haptics.tap, toggle: haptics.success, stopConfirm: haptics.warning };
  }
}
