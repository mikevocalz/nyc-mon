'use client';

import { useEffect } from 'react';
import type { LinkedAccount } from '@acme/auth';
import { useInstanceStore, useStore } from '@acme/ui';
import { announcePolitely } from '../onboarding/announce';
import { auth } from '../onboarding/auth';
import { copy } from '../onboarding/copy';
import {
  accountErrorId, hasPassword, looksLikeEmail, MIN_PASSWORD_LENGTH, type AccountErrorId,
} from './account-model.ts';

type Form = 'none' | 'email' | 'password';
type Message =
  | { kind: 'error'; id: AccountErrorId | 'settings.account.change_email.invalid' | 'settings.account.password.too_short' }
  | { kind: 'done'; text: string };

interface AccountState {
  accounts: LinkedAccount[] | null;
  loadFailed: boolean;
  form: Form;
  newEmail: string;
  currentPassword: string;
  newPassword: string;
  busy: boolean;
  message: Message | null;
}

const initial = (): AccountState => ({
  accounts: null, loadFailed: false, form: 'none', newEmail: '', currentPassword: '', newPassword: '', busy: false, message: null,
});

/**
 * M20 Account for both Settings surfaces: the signed-in email (from the
 * session), the linked sign-in methods (`listAccounts`), and the change
 * email / change password forms. The password form exists only when the
 * account has a password. Drafts live in the instance store, so a rotation
 * or fold keeps them.
 */
export function useAccount() {
  const session = auth().useSession();
  const user = (session.data?.user ?? null) as { email?: unknown; name?: unknown; birthYear?: unknown; createdAt?: unknown } | null;
  const email = typeof user?.email === 'string' && user.email !== '' ? user.email : null;
  const store = useInstanceStore<AccountState>(initial);
  const s = useStore(store);
  const signedIn = user !== null;

  const load = async () => {
    store.setState({ loadFailed: false });
    try {
      const listed = await auth().listAccounts();
      if (listed.ok) store.setState({ accounts: listed.data });
      else store.setState({ loadFailed: true });
    } catch {
      store.setState({ loadFailed: true });
    }
  };

  useEffect(() => {
    if (signedIn) void load();
    // load is stable in behaviour; re-run only when the session appears or goes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const fail = (message: Message) => {
    store.setState({ busy: false, message });
    if (message.kind === 'error') announcePolitely(copy(message.id));
  };

  const saveEmail = async () => {
    const next = store.getState().newEmail.trim();
    if (!looksLikeEmail(next)) return fail({ kind: 'error', id: 'settings.account.change_email.invalid' });
    store.setState({ busy: true, message: null });
    const result = await auth().changeEmail(next).catch(() => null);
    if (result === null) return fail({ kind: 'error', id: 'settings.account.error.offline' });
    if (!result.ok) return fail({ kind: 'error', id: accountErrorId(result) });
    const text = copy('settings.account.change_email.sent', { email: email ?? next });
    store.setState({ busy: false, form: 'none', newEmail: '', message: { kind: 'done', text } });
    announcePolitely(text);
  };

  const savePassword = async () => {
    const { currentPassword, newPassword } = store.getState();
    if (newPassword.length < MIN_PASSWORD_LENGTH) return fail({ kind: 'error', id: 'settings.account.password.too_short' });
    store.setState({ busy: true, message: null });
    const result = await auth().changePassword(currentPassword, newPassword).catch(() => null);
    if (result === null) return fail({ kind: 'error', id: 'settings.account.error.offline' });
    if (!result.ok) return fail({ kind: 'error', id: accountErrorId(result) });
    const text = copy('settings.account.password.done');
    store.setState({ busy: false, form: 'none', currentPassword: '', newPassword: '', message: { kind: 'done', text } });
    announcePolitely(text);
  };

  return {
    signedIn,
    user,
    email,
    accounts: s.accounts,
    loadFailed: s.loadFailed,
    canChangePassword: s.accounts !== null && hasPassword(s.accounts),
    form: s.form,
    newEmail: s.newEmail,
    currentPassword: s.currentPassword,
    newPassword: s.newPassword,
    busy: s.busy,
    message: s.message,
    reload: () => void load(),
    open: (form: Form) => store.setState({ form, message: null, newEmail: '', currentPassword: '', newPassword: '' }),
    setNewEmail: (v: string) => store.setState({ newEmail: v, message: null }),
    setCurrentPassword: (v: string) => store.setState({ currentPassword: v, message: null }),
    setNewPassword: (v: string) => store.setState({ newPassword: v, message: null }),
    saveEmail: () => void saveEmail(),
    savePassword: () => void savePassword(),
  };
}

export type AccountController = ReturnType<typeof useAccount>;
