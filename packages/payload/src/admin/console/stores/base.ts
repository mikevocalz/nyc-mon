import { create } from 'zustand';
import type { BaseConsoleStore } from './types.ts';

export function createConsoleStore() {
  return create<BaseConsoleStore>((set) => ({
    selectedId: null,
    setSelectedId: (selectedId) => set({ selectedId }),

    dialog: null,
    openDialog: (dialog) => set({ dialog }),
    closeDialog: () => set({ dialog: null }),

    revealed: {},
    setRevealed: (key, value) => set((state) => ({ revealed: { ...state.revealed, [key]: value } })),
    clearRevealed: () => set({ revealed: {} }),

    inspectorOpen: false,
    setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
  }));
}
