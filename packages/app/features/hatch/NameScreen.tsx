'use client';

import { useEffect, useRef } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { MON_NAME_MAX_LENGTH, monNameErrorCopyId, validateMonName } from '@acme/core/sim';
import {
  Button, ErrorMessage, Heading, KeyboardAwareScroll, SignagePlate, TextField, useHLynkStageWide, useInstanceStore,
  useStore,
} from '@acme/ui';
import { haptics } from '@acme/ui/haptics';
import { Text, View } from '@acme/ui/tw';
import { selectActiveMon, useMonStore } from '../mon/mon.store';
import { announcePolitely } from '../onboarding/announce';
import { resolveBootPath } from '../onboarding/boot';
import { defaultCallerNameFilter } from '../onboarding/caller-name-filter';
import { useHomeStage } from '../companion/home-stage.store';
import { tickMinuteClock, useMinuteClock } from '../companion/minute-clock';
import { dexNumber, monIdentity } from '../companion/mon-identity';
import { hatchCopy } from './copy';

/** A typed-but-invalid name shows its error after this pause, never per keystroke (M07 timing). */
const ERROR_DEBOUNCE_MS = 1000;
/** The Baby tilts its head after this long without a keystroke. */
const TILT_PAUSE_MS = 800;
/** The confirm tilt plays before the step to M13. */
const CONFIRM_TILT_MS = 300;

interface LocalState {
  raw: string;
  error: string | undefined;
  saving: boolean;
  saveError: boolean;
  reactionKey: number;
  /** Bumped by the trackpad tap: remounts the field with autoFocus (the kit TextField takes no ref). */
  focusKey: number;
}

/**
 * M09 Naming ceremony at `/(home)/name` (D-16f: after the hatch, so the Baby
 * stays mounted from M12). One write: `nameActiveMon` changes the nickname
 * only. No suggested or default name, no pronoun (D-16h). The Baby notices
 * typing with a head tilt on a pause and never reacts to an error.
 */
export function NameScreen() {
  const router = useRouter();
  const wide = useHLynkStageWide();
  const mon = useMonStore(selectActiveMon);
  const nowMs = useMinuteClock((st) => st.nowMs);
  const local = useInstanceStore<LocalState>(() => ({ raw: '', error: undefined, saving: false, saveError: false, reactionKey: 0, focusKey: 0 }));
  const s = useStore(local);
  const timers = useRef<{
    error?: ReturnType<typeof setTimeout>;
    tilt?: ReturnType<typeof setTimeout>;
    leave?: ReturnType<typeof setTimeout>;
  }>({});

  useEffect(
    () => () => {
      clearTimeout(timers.current.error);
      clearTimeout(timers.current.tilt);
      clearTimeout(timers.current.leave);
    },
    [],
  );

  const id = mon === undefined ? undefined : monIdentity(mon);
  const formName = id?.formName ?? id?.bloodlineLabel ?? '';
  const bloodline = id?.bloodlineLabel ?? '';

  const validate = (text: string) => validateMonName(text, defaultCallerNameFilter);
  const result = validate(s.raw);
  const canSubmit = s.raw !== '' && result.ok && s.error === undefined && !s.saving;

  const onChangeText = (text: string) => {
    local.setState({ raw: text, error: undefined, saveError: false });
    clearTimeout(timers.current.error);
    clearTimeout(timers.current.tilt);
    timers.current.error = setTimeout(() => {
      if (text === '') return;
      const check = validate(text);
      if (!check.ok) local.setState({ error: hatchCopy(monNameErrorCopyId(check.reason)) });
    }, ERROR_DEBOUNCE_MS);
    timers.current.tilt = setTimeout(() => {
      if (text !== '' && validate(text).ok) local.setState((st) => ({ reactionKey: st.reactionKey + 1 }));
    }, TILT_PAUSE_MS);
  };

  const submit = () => {
    const check = validate(local.getState().raw);
    if (!check.ok) {
      local.setState({ error: hatchCopy(monNameErrorCopyId(check.reason)) });
      return;
    }
    local.setState({ saving: true });
    try {
      useMonStore.getState().nameActiveMon(check.name, Date.now());
    } catch {
      local.setState({ saving: false, saveError: true });
      return;
    }
    haptics.success();
    announcePolitely(hatchCopy('m09.confirmed.a11y.announce', { name: check.name }));
    local.setState((st) => ({ reactionKey: st.reactionKey + 1 }));
    tickMinuteClock();
    clearTimeout(timers.current.leave);
    timers.current.leave = setTimeout(() => router.replace('/(home)'), CONFIRM_TILT_MS);
  };

  const form = id === undefined ? null : (
    <View className="gap-3">
      <Text
        testID="m09-identity"
        className="text-xr-caption text-silver-300"
        accessibilityLabel={hatchCopy('m09.identity.a11y', { dexId: id.dexId ?? '', formName, bloodline })}
      >
        {hatchCopy('m09.identity', { dexNumber: id.dexId === null ? '' : dexNumber(id.dexId), formName, bloodline })}
      </Text>
      <Heading level={1} className="text-xr-title text-signage-white">{hatchCopy('m09.title', { formName })}</Heading>
      <View testID="m09-field-name">
        <TextField
          key={s.focusKey}
          autoFocus={s.focusKey > 0}
          surface="well"
          label={hatchCopy('m09.field.label')}
          hint={hatchCopy('m09.field.hint')}
          error={s.error}
          value={s.raw}
          onChangeText={onChangeText}
          onSubmitEditing={submit}
          maxLength={MON_NAME_MAX_LENGTH}
          autoCorrect={false}
          autoCapitalize="words"
          textContentType="none"
          clearButton={{ accessibilityLabel: hatchCopy('m09.field.clear.a11y.label') }}
        />
      </View>
      <View testID="m09-plate" className="min-h-target">
        {s.raw === '' ? null : (
          <SignagePlate text={s.raw} maxSize="station" accessibilityLabel={hatchCopy('m09.plate.a11y.label', { name: s.raw })} />
        )}
      </View>
      {s.saveError ? (
        <View testID="m09-save-error" className="gap-2">
          <ErrorMessage message={`${hatchCopy('m09.save_error.title')} ${hatchCopy('m09.save_error.body')}`} />
          <View testID="m09-retry">
            <Button variant="outline" title={hatchCopy('m09.save_error.retry')} onPress={submit} className="min-h-target" />
          </View>
        </View>
      ) : null}
      <View testID="m09-confirm">
        <Button
          variant="cta"
          size="lg"
          fullWidth
          title={hatchCopy('m09.cta')}
          disabled={!canSubmit}
          loading={s.saving}
          accessibilityHint={canSubmit ? undefined : hatchCopy('m09.cta.a11y.hint.disabled')}
          onPress={submit}
          className="min-h-target"
        />
      </View>
    </View>
  );

  useHomeStage({
    chrome: {
      status: { led: 'off' },
      scheme: 'night',
      testIDPrefix: 'm09',
      creature: true,
      framing: 'naming',
      reaction: { kind: 'tilt', key: s.reactionKey },
      trackpad: {
        label: hatchCopy('m09.trackpad.label', { formName }),
        hint: hatchCopy('m09.trackpad.hint'),
        onActivate: () => local.setState((st) => ({ focusKey: st.focusKey + 1 })),
        onCommit: submit,
        commitLabel: hatchCopy('m09.trackpad.commit.label'),
      },
      keys: { back: { disabled: true }, home: { disabled: true }, forward: { disabled: true } },
    },
    screen: wide ? null : (
      <KeyboardAwareScroll>
        <View className="flex-1 justify-end">
          <View testID="m09-scrim" className="bg-night/90 px-4 pb-4 pt-4">{form}</View>
        </View>
      </KeyboardAwareScroll>
    ),
    trailing: wide ? <View className="bg-night px-6 py-6">{form}</View> : undefined,
  });

  if (mon === undefined || mon.stage !== 'Baby') {
    const { path } = resolveBootPath(nowMs);
    return <Redirect href={path} />;
  }
  if (mon.nickname !== null && !s.saving) return <Redirect href="/(home)" />;
  return null;
}
