import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type { BaseConsoleStore } from './types.ts';

function baseStore(set: StoreApi<BaseConsoleStore>['setState']): BaseConsoleStore {
  return {
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
  };
}

export function createConsoleStore<Extra extends object = Record<never, never>>(
  extend?: (set: StoreApi<BaseConsoleStore & Extra>['setState']) => Extra,
): UseBoundStore<StoreApi<BaseConsoleStore & Extra>> {
  return create<BaseConsoleStore & Extra>((set) => ({
    // The wider setState accepts every base partial; the cast only narrows the
    // declared parameter type, not what the runtime accepts.
    ...baseStore(set as unknown as StoreApi<BaseConsoleStore>['setState']),
    ...(extend ? extend(set) : ({} as Extra)),
  }));
}
