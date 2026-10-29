'use client';

import { CALLER_NAME_MAX_LENGTH } from '@acme/core/sim';
import { Button, Card, FadeIn, Text, TextField } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { copy } from '../onboarding/copy';
import { useCallerNameEditor } from './caller-name-editor';

/**
 * Settings: change the Caller name the Mon uses for you. Same rules and
 * errors as M07 (useCallerNameEditor). Shown only once a Caller exists on
 * this device.
 */
export function CallerNameCard({ className }: { className?: string }) {
  const editor = useCallerNameEditor();
  if (!editor.available) return null;

  return (
    <FadeIn delay={200} className={className}>
      <Card className="gap-3">
        <Text variant="heading">{copy('m07.field.label')}</Text>
        <TextField
          surface="daylit"
          label={copy('m07.field.label')}
          hint={copy('m07.field.hint')}
          error={editor.error}
          value={editor.draft}
          onChangeText={editor.setDraft}
          maxLength={CALLER_NAME_MAX_LENGTH}
          autoCorrect={false}
          autoCapitalize="words"
          textContentType="nickname"
          clearButton={{ accessibilityLabel: copy('m07.field.clear.a11y.label') }}
        />
        <View className="flex-row items-center gap-3">
          <Button variant="cta" title={copy('m07.continue')} disabled={!editor.changed} onPress={editor.save} />
          {editor.saved ? <Text variant="caption" tone="muted">{copy('settings.caller.saved')}</Text> : null}
        </View>
      </Card>
    </FadeIn>
  );
}
