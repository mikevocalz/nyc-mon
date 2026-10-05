import type { StaffRole } from '../../../collections/access/roles.ts';
import { createConsoleStore } from './base.ts';

/** Fields of the ops-only "Add staff" form in the Settings view. */
export interface AddStaffForm {
  addEmail: string;
  setAddEmail: (email: string) => void;
  addRole: StaffRole;
  setAddRole: (role: StaffRole) => void;
  resetAddStaff: () => void;
}

export const useSettingsStore = createConsoleStore<AddStaffForm>((set) => ({
  addEmail: '',
  setAddEmail: (addEmail) => set({ addEmail }),
  addRole: 'support',
  setAddRole: (addRole) => set({ addRole }),
  resetAddStaff: () => set({ addEmail: '', addRole: 'support' }),
}));
