import { create } from 'zustand';

interface SignInStore {
  passkeyUnsupported: boolean;
  notStaff: boolean;
  setPasskeyUnsupported: (value: boolean) => void;
  setNotStaff: (value: boolean) => void;
}

export const useSignInStore = create<SignInStore>((set) => ({
  passkeyUnsupported: false,
  notStaff: false,
  setPasskeyUnsupported: (passkeyUnsupported) => set({ passkeyUnsupported }),
  setNotStaff: (notStaff) => set({ notStaff }),
}));
