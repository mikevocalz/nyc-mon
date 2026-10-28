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
// The notification, digest and public-profile flags were STRUCK 2026-10-28:
// in memory only, read by nothing (settings-content.tsx).

interface ProfileState {
  name: string;
  theme: ThemePreference;
  setName: (name: string) => void;
  setTheme: (theme: ThemePreference) => void;
}

export const useProfile = create<ProfileState>((set) => ({
  name: readSave()?.caller?.callerName ?? '',
  theme: 'dark', // NYC Mon is dark-first
  setName: (name) => set({ name }),
  setTheme: (theme) => { setThemePreference(theme); set({ theme }); },
}));

export type { ThemePreference };
