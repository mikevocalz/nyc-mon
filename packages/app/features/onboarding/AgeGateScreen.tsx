'use client';

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { MIN_BIRTH_YEAR } from '@acme/core/schemas';
import { resolveCreateEntry } from '@acme/core/sim';
import { Button, Heading, KeyboardAwareScroll, Text, TextField, YearGrid, type YearGridStep } from '@acme/ui';
import { Form } from '@acme/ui/primitives';
import { View } from '@acme/ui/tw';
import { copy } from './copy';
import { useOnboarding } from './onboarding.store';

/** The current year at bundle load — the grid ceiling and the future-year check. */
const CURRENT_YEAR = new Date().getUTCFullYear();

/** First failing typed-year rule, or the valid year. Mirrors the M04 copy table. */
function typedYearError(raw: string, maxYear: number): { ok: true; year: number } | { ok: false; message: string } {
  if (!/^\d{4}$/.test(raw)) return { ok: false, message: copy('m04.error.incomplete') };
  const year = Number(raw);
  if (year > maxYear) return { ok: false, message: copy('m04.error.future') };
  if (year < MIN_BIRTH_YEAR) return { ok: false, message: copy('m04.error.too_early') };
  return { ok: true, year };
}

/**
 * M04 Birth year gate. Neutral by rule: one question, no default, no hint at
 * a threshold; every answer gets the same screen. Decade → year two-step via
 * {@linkcode YearGrid}, or a typed four-digit field as the alternative.
 * Continue stores the answer (MMKV, parsed on read — it gates every P1
 * route) and hands the result to {@linkcode resolveCreateEntry}: 13+ to M03
 * create, a consent-required year to M05.
 */
export function AgeGateScreen() {
  const router = useRouter();
  const setAgeAnswer = useOnboarding((s) => s.setAgeAnswer);
  const maxYear = CURRENT_YEAR;

  const [step, setStep] = useState<YearGridStep>('decade');
  const [typed, setTyped] = useState(false);
  const [year, setYear] = useState<number | null>(null);
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | undefined>();

  const continueWith = (picked: number) => {
    const nowMs = Date.now();
    setAgeAnswer(picked, nowMs);
    const entry = resolveCreateEntry({ ageAnswer: { birthYear: picked, answeredAtMs: nowMs }, nowMs });
    router.replace(entry.kind === 'guardian-consent' ? '/(auth)/consent' : '/(auth)/sign-in?intent=create');
  };

  return (
    <KeyboardAwareScroll>
      <View className="flex-1 px-4 py-6">
        <Form className="mx-auto w-full max-w-content-form gap-6">
          <View className="gap-2">
            <Heading level={1} size="title" testID="m04-title">{copy('m04.title')}</Heading>
            <Text tone="muted">{copy('m04.why')}</Text>
          </View>

          {typed ? (
            <View className="gap-4">
              <TextField
                surface="daylit"
                label={copy('m04.field.label')}
                hint={copy('m04.field.hint')}
                keyboardType="number-pad"
                maxLength={4}
                textContentType="none"
                value={raw}
                error={error}
                onChangeText={(text) => {
                  const digits = text.replace(/\D/g, '');
                  setRaw(digits);
                  setError(undefined);
                  if (/^\d{4}$/.test(digits)) {
                    const result = typedYearError(digits, maxYear);
                    setYear(result.ok ? result.year : null);
                  } else {
                    setYear(null);
                  }
                }}
              />
              <Button
                variant="ghost"
                tone="royal"
                title={copy('m04.pick_instead')}
                onPress={() => {
                  setTyped(false);
                  setError(undefined);
                }}
              />
            </View>
          ) : (
            <View className="gap-4">
              <YearGrid
                value={year}
                onChange={setYear}
                minYear={MIN_BIRTH_YEAR}
                maxYear={maxYear}
                step={step}
                onStepChange={setStep}
                groupLabel={copy('m04.grid.decades.a11y.label')}
                yearGroupLabel={(decade) => copy('m04.grid.years.a11y.label', { decade })}
              />
              {step === 'year' ? (
                <Button variant="ghost" tone="royal" title={copy('m04.change_decade')} onPress={() => setStep('decade')} />
              ) : null}
              <Button
                variant="ghost"
                tone="royal"
                title={copy('m04.type_instead')}
                onPress={() => {
                  setTyped(true);
                  setYear(null);
                }}
              />
            </View>
          )}

          {year !== null ? (
            <Button
              variant="cta"
              size="lg"
              fullWidth
              title={copy('m04.continue')}
              onPress={() => {
                if (typed) {
                  const result = typedYearError(raw, maxYear);
                  if (!result.ok) {
                    setError(result.message);
                    return;
                  }
                }
                continueWith(year);
              }}
            />
          ) : null}
        </Form>
      </View>
    </KeyboardAwareScroll>
  );
}
