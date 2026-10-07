import localFont from 'next/font/local';

// Brand fonts from packages/assets (§13.2: one font source, two loaders —
// expo-font plugin on native, next/font localFont here).
export const display = localFont({
  src: [{ path: '../../../packages/assets/fonts/ArchivoBlack-Regular.ttf', style: 'normal' }],
  variable: '--font-display',
  // optional, not swap: both files are local and arrive inside the window on a
  // warm connection — swap's late reflow was the W01 hero's only layout shift.
  display: 'optional',
});

export const sans = localFont({
  src: [{ path: '../../../packages/assets/fonts/SpaceGrotesk-Variable.ttf', style: 'normal' }],
  variable: '--font-sans',
  display: 'optional',
});
