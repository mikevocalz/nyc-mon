'use client';

import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  Button,
  EmptyState,
  ErrorMessage,
  Heading,
  KeyboardAwareScroll,
  StatusRow,
  Text,
  TextField,
} from '@acme/ui';
import { Form, Main } from '@acme/ui/primitives';
import { View } from '@acme/ui/tw';
import { AUTH_BASE_URL } from './auth';
import { copy } from './copy';
import { useOnboarding, writeConsentRequested } from './onboarding.store';
import { readSave } from './save-store';

type Mode = 'ask' | 'sent' | 'denied';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * M05 guardian consent. The ask form posts the parent email to the consent
 * endpoint hosted by the admin app (`/v1/guardian-consents`, ADR 0003); the
 * play path is never blocked while the request is pending, and the denied
 * state is terminal until a fresh install (consent law). The mail preview
 * stays copy-only for now — the retention window token (`{days}`) is a
 * lead+counsel decision, so the preview omits the deletion-timeline lines.
 */
export function ConsentScreen() {
  const params = useLocalSearchParams<{ state?: string }>();
  const ageAnswer = useOnboarding((s) => s.ageAnswer);

  const denied =
    params.state === 'denied' || readSave()?.caller?.consentStatus === 'denied';
  const [mode, setMode] = useState<Mode>(denied ? 'denied' : 'ask');
  const [parentEmail, setParentEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [preview, setPreview] = useState(false);
  const [pending, setPending] = useState(false);

  const send = async () => {
    if (!EMAIL_PATTERN.test(parentEmail)) {
      setError(copy('m05.error.email.invalid'));
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch(`${AUTH_BASE_URL}/v1/guardian-consents`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ parentEmail, birthYear: ageAnswer?.birthYear }),
      });
      if (!response.ok) {
        setError(copy('m05.error.server'));
        setPending(false);
        return;
      }
    } catch {
      setError(copy('m05.error.offline'));
      setPending(false);
      return;
    }
    writeConsentRequested();
    setPending(false);
    setMode('sent');
  };

  if (mode === 'denied') {
    return (
      <Main className="flex-1 items-center justify-center px-4 py-6">
        <EmptyState
          title={copy('m05.denied.title.no_mon')}
          description={copy('m05.denied.body.no_mon')}
        />
      </Main>
    );
  }

  return (
    <KeyboardAwareScroll>
      <Main className="flex-1 px-4 py-6">
        <Form className="mx-auto w-full max-w-content-form gap-6">
          {mode === 'sent' ? (
            <>
              <StatusRow
                items={[{ id: 'status-consent-pending', label: copy('m05.badge.pending'), tone: 'pending' }]}
              />
              <Heading level={1} size="title">{copy('m05.sent.title')}</Heading>
              <Text>{copy('m05.sent.body', { email: parentEmail })}</Text>
              <Button
                variant="ghost"
                size="lg"
                fullWidth
                title={copy('m05.sent.change_email')}
                onPress={() => setMode('ask')}
              />
            </>
          ) : (
            <>
              <View className="gap-2">
                <Heading level={1} size="title">{copy('m05.ask.title')}</Heading>
                <Text>{copy('m05.ask.body')}</Text>
              </View>
              {error !== undefined ? <ErrorMessage message={error} /> : null}
              <TextField
                surface="daylit"
                label={copy('m05.field.label')}
                hint={copy('m05.field.hint')}
                value={parentEmail}
                onChangeText={setParentEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                onSubmitEditing={() => void send()}
              />
              <Button
                variant="ghost"
                size="sm"
                title={copy('m05.preview.toggle')}
                aria-label={copy('m05.preview.toggle.a11y.hint')}
                onPress={() => setPreview((v) => !v)}
              />
              {preview ? (
                <View className="gap-2">
                  <Text>{copy('mail.consent.subject')}</Text>
                  <Text>{copy('mail.consent.body.intro')}</Text>
                  <Text>{copy('mail.consent.body.what')}</Text>
                  <Text>{copy('mail.consent.body.keep')}</Text>
                  <Text>{copy('mail.consent.body.dont')}</Text>
                  <Text>{copy('mail.consent.body.no')}</Text>
                </View>
              ) : null}
              <Button
                variant="cta"
                size="lg"
                fullWidth
                title={pending ? copy('m05.send.loading') : copy('m05.send')}
                disabled={pending || parentEmail === ''}
                onPress={() => void send()}
              />
            </>
          )}
        </Form>
      </Main>
    </KeyboardAwareScroll>
  );
}
