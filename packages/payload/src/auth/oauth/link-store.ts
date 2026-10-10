// State for the Alexa+ linking pages (LinkPages.tsx), in zustand like the
// console's stores (admin/console/stores). Only event handlers and effects
// write to it, so it is never set during a server render; `reset` runs when a
// page mounts so a later visit starts clean.
import { create } from 'zustand';

type SignInPending = 'email' | 'passkey' | 'code';
type ConsentPending = 'link' | 'cancel';

interface SignInStore {
  email: string;
  password: string;
  code: string;
  needsCode: boolean;
  pending: SignInPending | undefined;
  error: string | undefined;
  passkeySupported: boolean;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setCode: (code: string) => void;
  setNeedsCode: (needsCode: boolean) => void;
  setPending: (pending: SignInPending | undefined) => void;
  setError: (error: string | undefined) => void;
  setPasskeySupported: (passkeySupported: boolean) => void;
  reset: () => void;
}

const SIGN_IN_INITIAL = {
  email: '',
  password: '',
  code: '',
  needsCode: false,
  pending: undefined,
  error: undefined,
  passkeySupported: false,
} as const;

export const useLinkSignInStore = create<SignInStore>((set) => ({
  ...SIGN_IN_INITIAL,
  setEmail: (email) => set({ email }),
  setPassword: (password) => set({ password }),
  setCode: (code) => set({ code }),
  setNeedsCode: (needsCode) => set({ needsCode }),
  setPending: (pending) => set({ pending }),
  setError: (error) => set({ error }),
  setPasskeySupported: (passkeySupported) => set({ passkeySupported }),
  reset: () => set({ ...SIGN_IN_INITIAL }),
}));

interface ConsentStore {
  pending: ConsentPending | undefined;
  error: string | undefined;
  setPending: (pending: ConsentPending | undefined) => void;
  setError: (error: string | undefined) => void;
  reset: () => void;
}

export const useLinkConsentStore = create<ConsentStore>((set) => ({
  pending: undefined,
  error: undefined,
  setPending: (pending) => set({ pending }),
  setError: (error) => set({ error }),
  reset: () => set({ pending: undefined, error: undefined }),
}));
