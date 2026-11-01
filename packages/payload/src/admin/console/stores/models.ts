import { createConsoleStore } from './base.ts';

export type ModelFilter = 'all' | 'missing' | 'in-review' | 'approved';
export type ModelYaw = '0' | '90' | '180' | '270';
/** Where the preview looks from, in degrees: yaw turns the model, pitch tilts the camera. */
export interface ModelTurn { yaw: number; pitch: number }

/** The editable fields of a Mon model, as the console form holds them (numbers as typed text). */
export interface ModelDraft {
  scale: string;
  position: [string, string, string];
  rotation: [string, string, string];
  /** role -> clip name; '' leaves the role without a clip. */
  clips: Record<string, string>;
  author: string;
  license: string;
  sourceUrl: string;
  notes: string;
}

/** A dropped GLB shown in the viewer before it is saved. */
export interface PendingModel {
  url: string;
  name: string;
  file: File;
  release?: () => void;
}

export interface ModelsPage {
  filter: ModelFilter;
  setFilter: (filter: ModelFilter) => void;
  /** Set by dragging the preview or its arrow keys; an angle button sets it back to level. */
  turn: ModelTurn;
  setTurn: (turn: ModelTurn) => void;
  /** An angle button: that yaw, level. */
  setYaw: (yaw: ModelYaw) => void;
  clip: string;
  setClip: (clip: string) => void;
  dragging: boolean;
  setDragging: (dragging: boolean) => void;
  pending: PendingModel | null;
  setPending: (pending: PendingModel | null) => void;
  /** Keyed by speciesId + updatedAt so a saved or switched form loads fresh values. */
  draftKey: string | null;
  draft: ModelDraft | null;
  loadDraft: (key: string, draft: ModelDraft) => void;
  editDraft: (patch: Partial<ModelDraft>) => void;
  busy: 'upload' | 'save' | 'status' | null;
  setBusy: (busy: ModelsPage['busy']) => void;
  /** Upload progress 0..100 while the file is sent; null when the size is unknown or nothing is uploading. */
  progress: number | null;
  setProgress: (progress: number | null) => void;
  error: string | null;
  setError: (error: string | null) => void;
  /** Confirmation after a save; cleared by the next action. */
  notice: string | null;
  setNotice: (notice: string | null) => void;
  viewerError: boolean;
  setViewerError: (viewerError: boolean) => void;
}

export const useModelsStore = createConsoleStore<ModelsPage>((set) => ({
  filter: 'all',
  setFilter: (filter) => set({ filter }),
  turn: { yaw: 0, pitch: 0 },
  setTurn: (turn) => set({ turn }),
  setYaw: (yaw) => set({ turn: { yaw: Number(yaw), pitch: 0 } }),
  clip: '',
  setClip: (clip) => set({ clip }),
  dragging: false,
  setDragging: (dragging) => set({ dragging }),
  pending: null,
  setPending: (pending) => set((state) => {
    state.pending?.release?.();
    return { pending, clip: '', viewerError: false, error: null, notice: null };
  }),
  draftKey: null,
  draft: null,
  loadDraft: (draftKey, draft) => set({ draftKey, draft, clip: '', turn: { yaw: 0, pitch: 0 }, viewerError: false, error: null, notice: null }),
  editDraft: (patch) => set((state) => ({ notice: null, draft: state.draft ? { ...state.draft, ...patch } : state.draft })),
  busy: null,
  setBusy: (busy) => set({ busy }),
  progress: null,
  setProgress: (progress) => set({ progress }),
  error: null,
  setError: (error) => set({ error, notice: null }),
  notice: null,
  setNotice: (notice) => set({ notice, error: null }),
  viewerError: false,
  setViewerError: (viewerError) => set({ viewerError }),
}));
