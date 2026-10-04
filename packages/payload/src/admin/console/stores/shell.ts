import { create } from 'zustand';
import type { Appearance, ShellStore } from './types.ts';

const STORAGE_KEY = 'nycmon-console-appearance';

function readStoredAppearance(): Appearance {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored === 'daylit' || stored === 'night') return stored;
  } catch {
    // localStorage may throw in private browsing or embedded frames.
  }
  return 'system';
}

function writeStoredAppearance(value: Appearance): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, value);
    }
  } catch {
    // Ignore write failures.
  }
}

export const useShellStore = create<ShellStore>((set) => ({
  activeSection: 'overview',
  setActiveSection: (activeSection) => set({ activeSection }),
  appearance: readStoredAppearance(),
  setAppearance: (appearance) => {
    writeStoredAppearance(appearance);
    set({ appearance });
  },
}));
