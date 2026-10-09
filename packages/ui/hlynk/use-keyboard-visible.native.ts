'use client';
import { useKeyboardState } from 'react-native-keyboard-controller';

/**
 * PLATFORM FORK (native): whether the software keyboard is up, from
 * react-native-keyboard-controller 1.22 `useKeyboardState` (the kit's keyboard
 * library, see keyboard-aware.native.tsx). The selector keeps re-renders to
 * show and hide only.
 */
export function useKeyboardVisible(): boolean {
  return useKeyboardState((s) => s.isVisible);
}
