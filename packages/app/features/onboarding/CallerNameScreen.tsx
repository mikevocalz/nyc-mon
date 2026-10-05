'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { CALLER_NAME_MAX_LENGTH, callerNameErrorCopyId, isConsentRequired, validateCallerName } from '@acme/core/sim';
import { MIN_BIRTH_YEAR } from '@acme/core/schemas';
import type { CallerProfile } from '@acme/core/types';
import { Button, Container, Heading, KeyboardAwareScroll, SignagePlate, StatusRow, TextField } from '@acme/ui';
import { Form } from '@acme/ui/primitives';
import { View } from '@acme/ui/tw';
import { announcePolitely } from './announce';
import { defaultCallerNameFilter } from './caller-name-filter';
import { APP_HOME_PATH } from './boot';
import { copy } from './copy';
import { readConsentRequested, useOnboarding } from './onboarding.store';
import { readSave, storeCallerProfile } from './save-store';

/** Pause before a typed-but-invalid name shows its error (M07: not per keystroke). */
const ERROR_DEBOUNCE_MS = 1000;



/**
 * M07 Caller name. The field validates locally through
 * {@linkcode validateCallerName} — the first failing rule wins, the plate
 * shows exactly what was typed, and Continue stays disabled while the name
 * is empty or invalid. Under-13 answers get the nickname hint, and the
 * consent-pending status row. The confirmed name is written into the MMKV
 * save's caller record; for an under-13 it stays on the phone until consent
 * lands (ADR 0001 queued writes).
 */
export function CallerNameScreen() {
  const router = useRouter();
  const ageAnswer = useOnboarding((s) => s.ageAnswer);
  // Stable for the mount: the consent decision shouldn't drift mid-render.
  const [nowMs] = useState(() => Date.now());
  const under13 = ageAnswer !== undefined && isConsentRequired({ birthYear: ageAnswer.birthYear, nowMs });
  const consentStatus = readSave()?.caller?.consentStatus;
  const consentPending = under13 && (consentStatus === 'pending' || readConsentRequested());

  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | undefined>();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounce.current !== null) clearTimeout(debounce.current);
    },
    [],
  );

  const validate = (text: string) => validateCallerName(text, defaultCallerNameFilter);

  const onChangeText = (text: string) => {
    setRaw(text);
    setError(undefined);
    if (debounce.current !== null) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      if (text === '') return;
      const result = validate(text);
      if (!result.ok) setError(copy(callerNameErrorCopyId(result.reason)));
    }, ERROR_DEBOUNCE_MS);
  };

  const hint = consentPending ? copy('m07.field.hint.pending') : under13 ? copy('m07.field.hint.under13') : copy('m07.field.hint');
  const result = validate(raw);
  const canContinue = raw !== '' && result.ok && error === undefined;

  const confirm = () => {
    const check = validate(raw);
    if (!check.ok) {
      setError(copy(callerNameErrorCopyId(check.reason)));
      return;
    }
    const nowMs = Date.now();
    const existing = readSave()?.caller;
    const caller: CallerProfile = {
      callerId: existing?.callerId ?? `caller-${nowMs.toString(36)}`,
      callerName: check.name,
      birthYear: ageAnswer?.birthYear ?? existing?.birthYear ?? MIN_BIRTH_YEAR,
      consentStatus: under13 ? 'pending' : (existing?.consentStatus ?? 'not-required'),
      createdAt: existing?.createdAt ?? nowMs,
    };
    storeCallerProfile(caller, nowMs);
    announcePolitely(copy('m07.confirmed.a11y.announce'));
    // M08 (egg choice) is not built; the caller record is what the boot
    // route reads next, so home is the honest next step.
    router.replace(APP_HOME_PATH);
  };

  return (
    <KeyboardAwareScroll>
      <Container width="full" className="flex-1 px-4 py-6">
        {consentPending ? (
          <StatusRow
            items={[{ id: 'status-consent-pending', label: copy('m05.badge.pending'), tone: 'pending' }]}
          />
        ) : null}
        <Form className="mx-auto w-full max-w-content-form gap-6">
          <Heading level={1} size="title">{copy('m07.title')}</Heading>
          <TextField
            surface="daylit"
            label={copy('m07.field.label')}
            hint={hint}
            error={error}
            value={raw}
            onChangeText={onChangeText}
            maxLength={CALLER_NAME_MAX_LENGTH}
            autoCorrect={false}
            autoCapitalize="words"
            textContentType="nickname"
            clearButton={{ accessibilityLabel: copy('m07.field.clear.a11y.label') }}
          />
          <View className="gap-6">
            <SignagePlate
              text={raw}
              accessibilityLabel={copy('m07.plate.a11y.label', { name: raw })}
            />
            <Button
              variant="cta"
              size="lg"
              fullWidth
              title={copy('m07.continue')}
              disabled={!canContinue}
              onPress={confirm}
            />
          </View>
        </Form>
      </Container>
    </KeyboardAwareScroll>
  );
}
