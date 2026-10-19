'use client';
// The D-pad is the stick's other mode (Master Directive v2 §2A "selectable
// analog and D-pad modes"): the same gesture and surface, the reading snapped
// to eight unit vectors by toDigitalReading. One artboard variant, one
// wrapper (G01 04-components.md), selected by ControllerProfile.stickMode.
import { AnalogStick, type AnalogStickProps } from './AnalogStick.tsx';

/** Props of {@linkcode DigitalDPad}: {@linkcode AnalogStickProps} with `mode` fixed to `dpad`. */
export type DigitalDPadProps = Omit<AnalogStickProps, 'mode'>;

/**
 * The eight-way digital reading of the stick. Diagonals keep unit length
 * (0.71, 0.71) so integrating the reading moves at one speed in every
 * direction; the dead zone and clamp radius still come from the tuning.
 *
 * @see {@linkcode AnalogStick}
 */
export function DigitalDPad(props: DigitalDPadProps) {
  return <AnalogStick {...props} mode="dpad" />;
}
