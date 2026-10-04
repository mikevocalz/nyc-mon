import { typeScale } from '@acme/theme';
import type { TVConfig } from 'tailwind-variants';

/**
 * tailwind-merge does not know the theme's display steps, so it reads
 * `text-display-md` as a text COLOUR and drops it as soon as a tone class
 * (`text-text`, `text-primary`) follows. Text and Heading lost their whole
 * display scale that way. Registering the steps as font sizes keeps the size
 * and the colour side by side.
 */
export const TYPE_SCALE_TV: TVConfig = {
  twMergeConfig: {
    extend: {
      classGroups: { 'font-size': [{ text: Object.keys(typeScale) }] },
    },
  },
};
