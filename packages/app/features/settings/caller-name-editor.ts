'use client';

import { callerNameErrorCopyId, validateCallerName } from '@acme/core/sim';
import { useInstanceStore, useStore } from '@acme/ui';
import { defaultCallerNameFilter } from '../onboarding/caller-name-filter';
import { copy } from '../onboarding/copy';
import { readSave, renameCaller } from '../onboarding/save-store';
import { useProfile } from '../profile/profile.store';

/**
 * Editing the Caller name the Mon uses for you, shared by the 2D card
 * (CallerNameCard) and the Settings glass. Same rules and errors as M07:
 * validateCallerName with the default filter, one write through
 * renameCaller, then the profile store. `available` is false until a Caller
 * exists on this device.
 */
export function useCallerNameEditor() {
  const name = useProfile((s) => s.name);
  const store = useInstanceStore(() => ({ draft: name, error: undefined as string | undefined, saved: false }));
  const draft = useStore(store, (s) => s.draft);
  const error = useStore(store, (s) => s.error);
  const saved = useStore(store, (s) => s.saved);

  const check = validateCallerName(draft, defaultCallerNameFilter);
  const changed = check.ok && check.name !== name;

  const setDraft = (text: string) => store.setState({ draft: text, error: undefined, saved: false });
  /** Back to the saved name, no error, nothing pending. */
  const reset = () => store.setState({ draft: useProfile.getState().name, error: undefined, saved: false });
  /** Validates and writes the draft. True when the name was saved. */
  const save = (): boolean => {
    const result = validateCallerName(store.getState().draft, defaultCallerNameFilter);
    if (!result.ok) {
      store.setState({ error: copy(callerNameErrorCopyId(result.reason)) });
      return false;
    }
    if (renameCaller(result.name, Date.now()) === undefined) return false;
    useProfile.getState().setName(result.name);
    store.setState({ draft: result.name, error: undefined, saved: true });
    return true;
  };

  return { available: readSave()?.caller != null, name, draft, error, saved, changed, setDraft, reset, save };
}
