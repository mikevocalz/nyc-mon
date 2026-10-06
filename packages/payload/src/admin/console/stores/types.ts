// Thin Zustand slices for each console screen (08-handoff.md §6).
// Fetch state comes from RSC server components; these stores hold only client
// selection, transient revealed values and UI state.

export interface BaseConsoleStore {
  /** The selected record id, if any. */
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;

  /** Currently open destructive/confirm dialog key. */
  dialog: string | null;
  openDialog: (dialog: string) => void;
  closeDialog: () => void;

  /** Map of field keys to revealed values. Cleared on route change. */
  revealed: Record<string, string | undefined>;
  setRevealed: (key: string, value: string) => void;
  clearRevealed: () => void;

  /** Whether the history/inspector pane is open on extra-large screens. */
  inspectorOpen: boolean;
  setInspectorOpen: (open: boolean) => void;
}

export type Appearance = 'system' | 'daylit' | 'night';

export interface ShellStore {
  /** The active navigation section (matches route). */
  activeSection: string;
  setActiveSection: (section: string) => void;

  /** Persisted appearance preference. */
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
}
