// State for the Alexa+ linking pages (LinkPages.tsx), in zustand like the
// console's stores (admin/console/stores). Only event handlers and effects
// write to it, so it is never set during a server render; `reset` runs when a
// page mounts so a later visit starts clean.
import { create } from 'zustand';

type SignInPending = 'amazon' | 'email' | 'passkey' | 'code' | 'sign-up' | 'reset';
/** Which form the sign-in page shows. */
export type SignInMode = 'sign-in' | 'sign-up' | 'forgot';
export type SignInField = 'email' | 'password' | 'birthYear';
type ConsentPending = 'link' | 'cancel';

interface SignInStore {
  mode: SignInMode;
  email: string;
  password: string;
  birthYear: string;
  code: string;
  fieldErrors: Partial<Record<SignInField, string>>;
  /** A confirmation, e.g. that a reset link was sent. */
  notice: string | undefined;
  needsCode: boolean;
  pending: SignInPending | undefined;
  error: string | undefined;
  passkeySupported: boolean;
  setMode: (mode: SignInMode) => void;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setBirthYear: (birthYear: string) => void;
  setFieldErrors: (fieldErrors: Partial<Record<SignInField, string>>) => void;
  setNotice: (notice: string | undefined) => void;
  setCode: (code: string) => void;
  setNeedsCode: (needsCode: boolean) => void;
  setPending: (pending: SignInPending | undefined) => void;
  setError: (error: string | undefined) => void;
  setPasskeySupported: (passkeySupported: boolean) => void;
  reset: () => void;
}

const SIGN_IN_INITIAL = {
  mode: 'sign-in' as SignInMode,
  email: '',
  password: '',
  birthYear: '',
  code: '',
  fieldErrors: {},
  notice: undefined,
  needsCode: false,
  pending: undefined,
  error: undefined,
  passkeySupported: false,
} as const;

export const useLinkSignInStore = create<SignInStore>((set) => ({
  ...SIGN_IN_INITIAL,
  // Switching forms keeps the email, clears the password and every message.
  setMode: (mode) => set({ mode, password: '', fieldErrors: {}, error: undefined, notice: undefined }),
  // Typing in a field clears that field's message.
  setEmail: (email) => set((state) => ({ email, fieldErrors: { ...state.fieldErrors, email: undefined } })),
  setPassword: (password) => set((state) => ({ password, fieldErrors: { ...state.fieldErrors, password: undefined } })),
  setBirthYear: (birthYear) => set((state) => ({ birthYear, fieldErrors: { ...state.fieldErrors, birthYear: undefined } })),
  setFieldErrors: (fieldErrors) => set({ fieldErrors }),
  setNotice: (notice) => set({ notice }),
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
