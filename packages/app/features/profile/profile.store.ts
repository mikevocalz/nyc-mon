import { create } from 'zustand';
import { setThemePreference, type ThemePreference } from '@acme/theme/switch';
import { readSave } from '../onboarding/save-store';

// Profile + settings state — zustand always (repo rule).
//
// `name` is the Caller's name from the save (M07), the only identity the
// device holds. The starter's demo person (name, @handle, email, avatar
// photo) was STRUCK 2026-10-17: every player saw "Nina Alvarez". Handle,
// email and a photo return when a backing source exists (the auth session
// for email; nothing yet for handle or photo). Avatar falls back to initials.

interface ProfileState {
  name: string;
  notifications: boolean;
  digest: boolean;
  publicProfile: boolean;
  theme: ThemePreference;
  setName: (name: string) => void;
  setNotifications: (v: boolean) => void;
  setDigest: (v: boolean) => void;
  setPublicProfile: (v: boolean) => void;
  setTheme: (theme: ThemePreference) => void;
}

export const useProfile = create<ProfileState>((set) => ({
  name: readSave()?.caller?.callerName ?? '',
  notifications: true,
  digest: false,
  publicProfile: true,
  theme: 'dark', // NYC Mon is dark-first
  setName: (name) => set({ name }),
  setNotifications: (notifications) => set({ notifications }),
  setDigest: (digest) => set({ digest }),
  setPublicProfile: (publicProfile) => set({ publicProfile }),
  setTheme: (theme) => { setThemePreference(theme); set({ theme }); },
}));

export type { ThemePreference };
