'use client';

import { callerNameErrorCopyId, CALLER_NAME_MAX_LENGTH, validateCallerName } from '@acme/core/sim';
import { Button, Card, FadeIn, Text, TextField, useInstanceStore, useStore } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { defaultCallerNameFilter } from '../onboarding/caller-name-filter';
import { copy } from '../onboarding/copy';
import { readSave, renameCaller } from '../onboarding/save-store';
import { useProfile } from '../profile/profile.store';

/**
 * Settings: change the Caller name the Mon uses for you. Same rules and
 * errors as M07 (validateCallerName with the default filter). Shown only
 * once a Caller exists on this device.
 */
export function CallerNameCard({ className }: { className?: string }) {
  const name = useProfile((s) => s.name);
  const store = useInstanceStore(() => ({ draft: name, error: undefined as string | undefined, saved: false }));
  const draft = useStore(store, (s) => s.draft);
  const error = useStore(store, (s) => s.error);
  const saved = useStore(store, (s) => s.saved);
  if (readSave()?.caller == null) return null;

  const check = validateCallerName(draft, defaultCallerNameFilter);
  const changed = check.ok && check.name !== name;

  const save = () => {
    const result = validateCallerName(store.getState().draft, defaultCallerNameFilter);
    if (!result.ok) {
      store.setState({ error: copy(callerNameErrorCopyId(result.reason)) });
      return;
    }
    if (renameCaller(result.name, Date.now()) === undefined) return;
    useProfile.getState().setName(result.name);
    store.setState({ draft: result.name, error: undefined, saved: true });
  };

  return (
    <FadeIn delay={200} className={className}>
      <Card className="gap-3">
        <Text variant="heading">{copy('m07.field.label')}</Text>
        <TextField
          surface="daylit"
          label={copy('m07.field.label')}
          hint={copy('m07.field.hint')}
          error={error}
          value={draft}
          onChangeText={(text) => store.setState({ draft: text, error: undefined, saved: false })}
          maxLength={CALLER_NAME_MAX_LENGTH}
          autoCorrect={false}
          autoCapitalize="words"
          textContentType="nickname"
          clearButton={{ accessibilityLabel: copy('m07.field.clear.a11y.label') }}
        />
        <View className="flex-row items-center gap-3">
          <Button variant="cta" title={copy('m07.continue')} disabled={!changed} onPress={save} />
          {saved ? <Text variant="caption" tone="muted">{copy('settings.caller.saved')}</Text> : null}
        </View>
      </Card>
    </FadeIn>
  );
}
