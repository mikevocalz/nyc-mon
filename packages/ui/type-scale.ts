import { typeRamp, typeScale } from '@acme/theme';
import type { TVConfig } from 'tailwind-variants';

/**
 * tailwind-merge does not know the theme's own font-size steps, so it reads
 * `text-display-md` or `text-type-body` as a text COLOUR and drops it as soon
 * as a tone class (`text-text`, `text-primary`) follows. Text and Heading lost
 * their whole display scale that way. Registering the website display steps
 * (`typeScale`) and the mobile ramp (`typeRamp`, keys already `type-*`) as
 * font sizes keeps the size and the colour side by side.
 */
export const TYPE_SCALE_TV: TVConfig = {
  twMergeConfig: {
    extend: {
      classGroups: { 'font-size': [{ text: [...Object.keys(typeScale), ...Object.keys(typeRamp)] }] },
    },
  },
};
