'use client';

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { MIN_BIRTH_YEAR } from '@acme/core/schemas';
import { resolveCreateEntry } from '@acme/core/sim';
import { Button, Heading, KeyboardAwareScroll, Select, Text } from '@acme/ui';
import { Form } from '@acme/ui/primitives';
import { View } from '@acme/ui/tw';
import { copy } from './copy';
import { OnboardingPanes, PANE_HEADING_CLASS } from './OnboardingPanes';
import { useOnboarding } from './onboarding.store';

/** The current year at bundle load: the newest year offered. */
const CURRENT_YEAR = new Date().getUTCFullYear();

/** A blank prompt first (no year preselected), then every year newest first. */
const YEAR_OPTIONS = [
  { value: '', label: copy('m04.select.placeholder') },
  ...Array.from({ length: CURRENT_YEAR - MIN_BIRTH_YEAR + 1 }, (_, i) => {
    const y = String(CURRENT_YEAR - i);
    return { value: y, label: y };
  }),
];

/**
 * M04 Birth year gate. Neutral by rule: one question, no default, no hint at
 * a threshold; every answer gets the same screen. The year comes from the kit
 * Select (the OS picker on native), newest first, with a blank prompt so
 * nothing is preselected. It replaced the decade/year grid and the typed
 * field (Mike, 2026-10-27).
 * Continue stores the answer (MMKV, parsed on read — it gates every P1
 * route) and hands the result to {@linkcode resolveCreateEntry}: 13+ to M03
 * create, a consent-required year to M05.
 */
export function AgeGateScreen() {
  const router = useRouter();
  const setAgeAnswer = useOnboarding((s) => s.setAgeAnswer);
  const [year, setYear] = useState<number | null>(null);

  const continueWith = (picked: number) => {
    const nowMs = Date.now();
    setAgeAnswer(picked, nowMs);
    const entry = resolveCreateEntry({ ageAnswer: { birthYear: picked, answeredAtMs: nowMs }, nowMs });
    router.replace(entry.kind === 'guardian-consent' ? '/(auth)/consent' : '/(auth)/sign-in?intent=create');
  };

  return (
    <KeyboardAwareScroll contentContainerClassName="grow">
      <OnboardingPanes
        intro={
          <View className="gap-2">
            <Heading level={1} size="title" className={PANE_HEADING_CLASS} testID="m04-title">{copy('m04.title')}</Heading>
            <Text tone="muted">{copy('m04.why')}</Text>
          </View>
        }
      >
        <Form className="gap-6 md:flex-1">
          {/* The kit Select: the OS picker on native, the kit dropdown on web.
              The first option is a blank prompt, so no year is preselected. */}
          <Select
            label={copy('m04.field.label')}
            tone="royal"
            value={year === null ? '' : String(year)}
            onValueChange={(next: string) => setYear(next === '' ? null : Number(next))}
            options={YEAR_OPTIONS}
          />

          {/* Tablet: Continue sits on the pane's bottom edge. */}
          {year !== null ? (
            <View className="md:mt-auto">
              <Button
                variant="cta"
                size="lg"
                fullWidth
                title={copy('m04.continue')}
                onPress={() => continueWith(year)}
              />
            </View>
          ) : null}
        </Form>
      </OnboardingPanes>
    </KeyboardAwareScroll>
  );
}
