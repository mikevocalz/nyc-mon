'use client';

import { useIsHeadset } from '@acme/ui';
import { textRamp, type TextRamp } from './text-ramp';

/** The M08/M10 type ramp for this device (fixed for the process: the device never changes). */
export function useTextRamp(): TextRamp {
  return textRamp(useIsHeadset());
}
