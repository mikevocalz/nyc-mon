'use client';

import { useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  Button,
  Container,
  EmptyState,
  ErrorMessage,
  Heading,
  KeyboardAwareScroll,
  StatusRow,
  Text,
  TextField,
} from '@acme/ui';
import { Form } from '@acme/ui/primitives';
import { View } from '@acme/ui/tw';
import { AUTH_BASE_URL } from './auth';
import { copy } from './copy';
import { useOnboarding, writeConsentRequested } from './onboarding.store';
import { OnboardingPanes, PANE_HEADING_CLASS } from './OnboardingPanes';
import { readSave } from './save-store';

type Mode = 'ask' | 'sent' | 'denied';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * One key per logical send (ADR 0001 §1.4): a retry after a network failure
 * reuses it so the server replays the first response instead of creating a
 * second consent record. Rotates when the email changes or a send completes.
 */
function newIdempotencyKey(): string {
  return `consent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

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
  const idempotency = useRef({ key: newIdempotencyKey(), email: '' });

  const send = async () => {
    if (!EMAIL_PATTERN.test(parentEmail)) {
      setError(copy('m05.error.email.invalid'));
      return;
    }
    setPending(true);
    setError(undefined);
    if (idempotency.current.email !== parentEmail) {
      idempotency.current = { key: newIdempotencyKey(), email: parentEmail };
    }
    try {
      const response = await fetch(`${AUTH_BASE_URL}/v1/guardian-consents`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': idempotency.current.key,
        },
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
    idempotency.current = { key: newIdempotencyKey(), email: '' };
    writeConsentRequested();
    setPending(false);
    setMode('sent');
  };

  if (mode === 'denied') {
    return (
      <Container width="full" className="flex-1 items-center justify-center px-4 py-6">
        <EmptyState
          title={copy('m05.denied.title.no_mon')}
          description={copy('m05.denied.body.no_mon')}
        />
      </Container>
    );
  }

  return (
    <KeyboardAwareScroll contentContainerClassName="grow">
      <OnboardingPanes
        intro={
          mode === 'sent' ? (
            <View className="gap-6">
              <StatusRow
                items={[{ id: 'status-consent-pending', label: copy('m05.badge.pending'), tone: 'pending' }]}
              />
              <Heading level={1} size="title" className={PANE_HEADING_CLASS}>{copy('m05.sent.title')}</Heading>
            </View>
          ) : (
            <View className="gap-2">
              <Heading level={1} size="title" className={PANE_HEADING_CLASS}>{copy('m05.ask.title')}</Heading>
              <Text>{copy('m05.ask.body')}</Text>
            </View>
          )
        }
      >
        <Form className="gap-6 md:flex-1">
          {mode === 'sent' ? (
            <>
              <Text>{copy('m05.sent.body', { email: parentEmail })}</Text>
              {/* Tablet: the action sits on the pane's bottom edge. */}
              <View className="md:mt-auto">
                <Button
                  variant="ghost"
                  size="lg"
                  fullWidth
                  title={copy('m05.sent.change_email')}
                  onPress={() => setMode('ask')}
                />
              </View>
            </>
          ) : (
            <>
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
              {/* Tablet: Send sits on the pane's bottom edge. */}
              <View className="md:mt-auto">
                <Button
                  variant="cta"
                  size="lg"
                  fullWidth
                  title={pending ? copy('m05.send.loading') : copy('m05.send')}
                  disabled={pending || parentEmail === ''}
                  onPress={() => void send()}
                />
              </View>
            </>
          )}
        </Form>
      </OnboardingPanes>
    </KeyboardAwareScroll>
  );
}
