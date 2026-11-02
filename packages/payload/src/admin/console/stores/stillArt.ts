import { createConsoleStore } from './base.ts';

/** A dropped picture shown before it is saved. */
export interface PendingStill {
  url: string;
  name: string;
  file: File;
  release?: () => void;
}

/** The Still art card on the Models page: one form's picture at a time. */
export interface StillArtPage {
  /** The form the fields below belong to; switching forms resets them. */
  formKey: string | null;
  load: (formKey: string, alt: string) => void;
  alt: string;
  setAlt: (alt: string) => void;
  dragging: boolean;
  setDragging: (dragging: boolean) => void;
  pending: PendingStill | null;
  setPending: (pending: PendingStill | null) => void;
  busy: 'upload' | 'save' | 'status' | null;
  setBusy: (busy: StillArtPage['busy']) => void;
  progress: number | null;
  setProgress: (progress: number | null) => void;
  error: string | null;
  setError: (error: string | null) => void;
  notice: string | null;
  setNotice: (notice: string | null) => void;
}

export const useStillArtStore = createConsoleStore<StillArtPage>((set) => ({
  formKey: null,
  load: (formKey, alt) => set((state) => {
    state.pending?.release?.();
    return { formKey, alt, pending: null, error: null, notice: null, progress: null };
  }),
  alt: '',
  setAlt: (alt) => set({ alt, notice: null }),
  dragging: false,
  setDragging: (dragging) => set({ dragging }),
  pending: null,
  setPending: (pending) => set((state) => {
    state.pending?.release?.();
    return { pending, error: null, notice: null };
  }),
  busy: null,
  setBusy: (busy) => set({ busy }),
  progress: null,
  setProgress: (progress) => set({ progress }),
  error: null,
  setError: (error) => set({ error, notice: null }),
  notice: null,
  setNotice: (notice) => set({ notice, error: null }),
}));
