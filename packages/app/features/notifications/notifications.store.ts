import { create } from 'zustand';
import { Bell } from '@acme/ui/icons';

export interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: 'primary' | 'accent' | 'gold';
  read: boolean;
}

/**
 * Canon seed: the only notification NYC-MON sends is local, one per egg
 * (M23 / ADR 0001). Copy mirrors `m23.notification.*` in onboarding/copy.ts.
 */
const SEED: Notification[] = [
  {
    id: 'egg-ready',
    title: 'Your egg is ready to hatch',
    body: "Open NYC-MON whenever you're ready.",
    time: 'now',
    icon: Bell,
    tone: 'accent',
    read: false,
  },
];

// Notification state — zustand always (repo rule).
export const useNotifications = create<{
  items: Notification[];
  markRead: (id: string) => void;
  markAllRead: () => void;
}>((set) => ({
  items: SEED,
  markRead: (id) => set((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
  markAllRead: () => set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) })),
}));
