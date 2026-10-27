'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { MON_NAME_MAX_LENGTH, monNameErrorCopyId, validateMonName } from '@acme/core/sim';
import {
  Button, ErrorMessage, Heading, KeyboardAwareScroll, SignagePlate, TextField, useInstanceStore,
  useStore, type DeviceKey, type GlassView,
} from '@acme/ui';
import { haptics } from '@acme/ui/haptics';
import { Text, View } from '@acme/ui/tw';
import { selectActiveMon, useMonStore } from '../mon/mon.store';
import { announcePolitely } from '../onboarding/announce';
import { resolveBootPath } from '../onboarding/boot';
import { defaultCallerNameFilter } from '../onboarding/caller-name-filter';
import { markNicknamePromptSeen, needsNicknamePrompt } from '../onboarding/onboarding.store';
import { GlassStage, useGlassOn, useGlassScreen, useMonGlass } from '../companion/glass';
import { useHomeStage } from '../companion/home-stage.store';
import { tickMinuteClock, useMinuteClock } from '../companion/minute-clock';
import { dexNumber, monIdentity } from '../companion/mon-identity';
import { hatchCopy } from './copy';

/** A typed-but-invalid nickname shows its error after this pause, never per keystroke (M07 timing). */
const ERROR_DEBOUNCE_MS = 1000;
/** The Baby tilts its head after this long without a keystroke. */
const TILT_PAUSE_MS = 800;
/** The confirm tilt plays before the step to M13. */
const CONFIRM_TILT_MS = 300;

/** Write time for the one naming write; module scope keeps the clock read out of render (as M16 does). */
const writeTime = (): number => Date.now();

/** Glass targets. */
const YES = 'yes';
const NO = 'no';
const USE = 'use';
const CANCEL = 'cancel';
/** One layout for both steps: the scene reads it once, so the question and the field share the stage. */
const LAYOUT = { model: 'large', rings: false, lineRows: 3, actionRows: 1, perRow: 2 } as const;

interface LocalState {
  /** The question first; the text field only after Yes. */
  step: 'ask' | 'edit';
  raw: string;
  error: string | undefined;
  saving: boolean;
  saveError: boolean;
  /** Taps and typing pauses so far: each one tilts (wobbles) the Baby once. */
  reactionKey: number;
  /** Bumped by the trackpad tap: remounts the field with autoFocus (the kit TextField takes no ref). */
  focusKey: number;
  /** The 3D H-Lynk reported it can't run: the 2D fallback. */
  failed: boolean;
}

/**
 * M09 at `/(home)/name`: the optional nickname, asked once after the hatch.
 * A Mon is always its species (Squeaklet); a nickname is an extra shown next
 * to it, never a replacement. On the 3D H-Lynk the Baby stands on the glass
 * under "Give Squeaklet a nickname?" with Yes and No; No is the default and
 * the trackpad's action, and goes straight to M13. Yes opens a real text
 * field under the device while the glass previews the nickname. Either
 * answer is recorded (`markNicknamePromptSeen`), so boot never asks again.
 * One write when a nickname is chosen: `nameActiveMon`. The 2D shell is only
 * the reduced-motion / no-GPU fallback.
 */
export function NameScreen() {
  const router = useRouter();
  const mon = useMonStore(selectActiveMon);
  const nowMs = useMinuteClock((st) => st.nowMs);
  const local = useInstanceStore<LocalState>(() => ({
    step: 'ask', raw: '', error: undefined, saving: false, saveError: false, reactionKey: 0, focusKey: 0, failed: false,
  }));
  const s = useStore(local);
  const glassOn = useGlassOn(s.failed);
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
  const identityText = id === undefined ? '' : hatchCopy('m09.identity', { dexNumber: id.dexId === null ? '' : dexNumber(id.dexId), formName, bloodline });

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

  /** No (the default): the Mon keeps its species name. Recorded, so boot never asks again. */
  const keepName = () => {
    if (mon === undefined) return;
    markNicknamePromptSeen(mon.monInstanceId);
    haptics.tap();
    announcePolitely(hatchCopy('m09.skipped.a11y.announce', { formName }));
    tickMinuteClock();
    router.replace('/(home)');
  };
  const wantNickname = () => {
    haptics.selection();
    local.setState((st) => ({ step: 'edit', focusKey: st.focusKey + 1 }));
  };
  const cancelEdit = () => {
    clearTimeout(timers.current.error);
    clearTimeout(timers.current.tilt);
    local.setState({ step: 'ask', raw: '', error: undefined, saveError: false });
  };

  const submit = () => {
    const check = validate(local.getState().raw);
    if (!check.ok) {
      local.setState({ error: hatchCopy(monNameErrorCopyId(check.reason)) });
      return;
    }
    local.setState({ saving: true });
    try {
      useMonStore.getState().nameActiveMon(check.name, writeTime());
    } catch {
      local.setState({ saving: false, saveError: true });
      return;
    }
    if (mon !== undefined) markNicknamePromptSeen(mon.monInstanceId);
    haptics.success();
    announcePolitely(hatchCopy('m09.confirmed.a11y.announce', { name: check.name }));
    local.setState((st) => ({ reactionKey: st.reactionKey + 1 }));
    tickMinuteClock();
    clearTimeout(timers.current.leave);
    timers.current.leave = setTimeout(() => router.replace('/(home)'), CONFIRM_TILT_MS);
  };

  // ---- the 3D H-Lynk: the Baby on the glass, the question or the preview drawn there ----
  const dexId = id?.dexId ?? null;
  const { model } = useMonGlass(dexId, undefined);
  const editing = s.step === 'edit';
  const view: GlassView = {
    status: identityText === '' ? null : { text: identityText, tone: 'neutral' },
    title: editing ? hatchCopy('m09.title', { formName }) : hatchCopy('m09.ask.title', { formName }),
    subtitle: editing ? hatchCopy('m09.field.hint') : '',
    rings: [],
    lines: editing
      ? [
        ...(s.raw === '' ? [] : [{ text: s.raw, size: 'plate' as const, tone: 'text' as const }]),
        ...(s.error ? [{ text: s.error, size: 'caption' as const, tone: 'amber' as const }] : []),
        ...(s.saveError ? [{ text: hatchCopy('m09.save_error.title'), size: 'caption' as const, tone: 'red' as const }] : []),
      ]
      : [{ text: hatchCopy('m09.ask.body', { formName }), size: 'body', tone: 'dim' }],
    actions: editing
      ? [
        { target: CANCEL, label: hatchCopy('m09.edit.cancel'), tone: 'secondary' },
        { target: USE, label: s.saveError ? hatchCopy('m09.save_error.retry') : hatchCopy('m09.cta'), tone: 'primary', disabled: !canSubmit },
      ]
      : [
        { target: YES, label: hatchCopy('m09.ask.yes'), tone: 'secondary' },
        // No is the default: the primary button and the trackpad.
        { target: NO, label: hatchCopy('m09.ask.no'), tone: 'primary' },
      ],
  };
  const onAction = (target: string) => {
    if (target === YES) wantNickname();
    else if (target === NO) keepName();
    else if (target === CANCEL) cancelEdit();
    else if (target === USE) submit();
  };
  const glass = useGlassScreen({ layout: LAYOUT, model, view, nudge: s.reactionKey });
  useEffect(() => {
    glass.bind({ onAction, onModel: () => local.setState((st) => ({ reactionKey: st.reactionKey + 1 })) });
  });
  const onKey = (key: DeviceKey) => {
    if (key !== 'activate') return;
    if (!editing) keepName();
    else if (canSubmit) submit();
    else local.setState((st) => ({ focusKey: st.focusKey + 1 }));
  };
  const onFailed = useCallback(() => local.setState({ failed: true }), [local]);

  const field = (
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
  );

  // ---- the 2D fallback (reduced motion, accessibility text sizes, no GPU) ----
  const ask = (
    <View className="gap-3">
      <Heading level={1} className="text-xr-title text-signage-white">{hatchCopy('m09.ask.title', { formName })}</Heading>
      <Text className="text-xr-body text-silver-300">{hatchCopy('m09.ask.body', { formName })}</Text>
      <View className="flex-row gap-target-gap">
        <View testID="m09-ask-yes" className="flex-1">
          <Button variant="outline" size="lg" fullWidth title={hatchCopy('m09.ask.yes')} accessibilityHint={hatchCopy('m09.ask.yes.a11y.hint')} onPress={wantNickname} className="min-h-target" />
        </View>
        <View testID="m09-ask-no" className="flex-1">
          <Button variant="cta" size="lg" fullWidth title={hatchCopy('m09.ask.no')} accessibilityHint={hatchCopy('m09.ask.no.a11y.hint', { formName })} onPress={keepName} className="min-h-target" />
        </View>
      </View>
    </View>
  );
  const form = id === undefined ? null : (
    <View className="gap-3">
      <Text
        testID="m09-identity"
        className="text-xr-caption text-silver-300"
        accessibilityLabel={hatchCopy('m09.identity.a11y', { dexId: id.dexId ?? '', formName, bloodline })}
      >
        {identityText}
      </Text>
      {editing ? (
        <>
          <Heading level={1} className="text-xr-title text-signage-white">{hatchCopy('m09.title', { formName })}</Heading>
          {field}
          <View testID="m09-plate" className="min-h-target">
            {s.raw === '' ? null : (
              <SignagePlate text={s.raw} maxSize="station" accessibilityLabel={hatchCopy('m09.plate.a11y.label', { name: s.raw })} />
            )}
          </View>
          {s.saveError ? (
            <View testID="m09-save-error" className="gap-2">
              <ErrorMessage message={`${hatchCopy('m09.save_error.title')} ${hatchCopy('m09.save_error.body')}`} />
            </View>
          ) : null}
          <View className="flex-row gap-target-gap">
            <View testID="m09-cancel" className="flex-1">
              <Button variant="outline" size="lg" fullWidth title={hatchCopy('m09.edit.cancel')} onPress={cancelEdit} className="min-h-target" />
            </View>
            <View testID="m09-confirm" className="flex-1">
              <Button
                variant="cta"
                size="lg"
                fullWidth
                title={s.saveError ? hatchCopy('m09.save_error.retry') : hatchCopy('m09.cta')}
                disabled={!canSubmit}
                loading={s.saving}
                accessibilityHint={canSubmit ? undefined : hatchCopy('m09.cta.a11y.hint.disabled')}
                onPress={submit}
                className="min-h-target"
              />
            </View>
          </View>
        </>
      ) : ask}
    </View>
  );

  useHomeStage(glassOn ? {} : {
    chrome: {
      status: { led: 'off' },
      scheme: 'night',
      testIDPrefix: 'm09',
      creature: true,
      framing: 'naming',
      reaction: { kind: 'tilt', key: s.reactionKey },
      trackpad: editing
        ? {
            label: hatchCopy('m09.trackpad.label', { formName }),
            hint: hatchCopy('m09.trackpad.hint'),
            onActivate: () => local.setState((st) => ({ focusKey: st.focusKey + 1 })),
            onCommit: submit,
            commitLabel: hatchCopy('m09.trackpad.commit.label'),
          }
        : { label: hatchCopy('m09.ask.no'), hint: hatchCopy('m09.ask.no.a11y.hint', { formName }), onActivate: keepName },
      keys: { back: { disabled: true }, home: { disabled: true }, forward: { disabled: true } },
    },
    screen: (
      <KeyboardAwareScroll>
        <View className="flex-1 justify-end">
          <View testID="m09-scrim" className="bg-night/90 px-4 pb-4 pt-4">{form}</View>
        </View>
      </KeyboardAwareScroll>
    ),
  });

  if (mon === undefined || mon.stage !== 'Baby') {
    const { path } = resolveBootPath(nowMs);
    return <Redirect href={path} />;
  }
  if (!needsNicknamePrompt(mon) && !s.saving && !editing) return <Redirect href="/(home)" />;
  if (!glassOn || id === undefined) return null;

  const label = editing ? hatchCopy('m09.title', { formName }) : hatchCopy('m09.ask.title', { formName });
  return (
    <GlassStage
      screen={glass.screen}
      label={label}
      testIDPrefix="m09"
      onKey={onKey}
      onFailed={onFailed}
      a11y={
        <>
          <Text testID="m09-identity" accessibilityLabel={hatchCopy('m09.identity.a11y', { dexId: id.dexId ?? '', formName, bloodline })}>{identityText}</Text>
          <Text accessibilityRole="header">{label}</Text>
          {editing ? null : <Text>{hatchCopy('m09.ask.body', { formName })}</Text>}
          {editing && s.raw !== '' ? <Text testID="m09-plate">{hatchCopy('m09.plate.a11y.label', { name: s.raw })}</Text> : null}
          {s.saveError ? <Text testID="m09-save-error">{`${hatchCopy('m09.save_error.title')} ${hatchCopy('m09.save_error.body')}`}</Text> : null}
        </>
      }
      controls={editing
        ? [
          { key: 'cancel', label: hatchCopy('m09.edit.cancel'), onPress: cancelEdit, testID: 'm09-cancel-a11y' },
          {
            key: 'use', label: s.saveError ? hatchCopy('m09.save_error.retry') : hatchCopy('m09.cta'), onPress: submit, disabled: !canSubmit,
            hint: canSubmit ? undefined : hatchCopy('m09.cta.a11y.hint.disabled'), testID: 'm09-confirm-a11y',
          },
        ]
        : [
          { key: 'no', label: hatchCopy('m09.ask.no'), hint: hatchCopy('m09.ask.no.a11y.hint', { formName }), onPress: keepName, testID: 'm09-ask-no' },
          { key: 'yes', label: hatchCopy('m09.ask.yes'), hint: hatchCopy('m09.ask.yes.a11y.hint'), onPress: wantNickname, testID: 'm09-ask-yes' },
        ]}
      // Only while editing: the field (it can't be drawn on the glass) with its two actions beside it, under the device.
      below={editing ? (
        <View className="gap-3 bg-ink-950/90 px-4 pb-4 pt-3">
          {field}
          <View className="flex-row gap-target-gap">
            <View className="flex-1">
              <Button variant="outline" size="lg" fullWidth title={hatchCopy('m09.edit.cancel')} onPress={cancelEdit} className="min-h-target" />
            </View>
            <View className="flex-1">
              <Button
                variant="cta"
                size="lg"
                fullWidth
                title={s.saveError ? hatchCopy('m09.save_error.retry') : hatchCopy('m09.cta')}
                disabled={!canSubmit}
                loading={s.saving}
                onPress={submit}
                className="min-h-target"
              />
            </View>
          </View>
        </View>
      ) : undefined}
    />
  );
}
