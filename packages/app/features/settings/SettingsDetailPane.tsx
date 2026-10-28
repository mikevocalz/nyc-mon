'use client';

import type { ReactNode } from 'react';
import { Button, SegmentedControl } from '@acme/ui';
import { Text, View } from '@acme/ui/tw';
import { CompanionPane } from '../companion/CompanionPane';
import { companionCopy } from '../companion/copy';
import { timeOfDayStore, useTimeOfDay } from '../game/world/time-of-day.store.ts';
import { hatchCopy } from '../hatch/copy';
import { copy } from '../onboarding/copy';
import { useProfile } from '../profile/profile.store';
import type { CreditLine, SettingsRow } from './settings-glass-model';
import { THEME_OPTIONS } from './theme-options.ts';
import { TIME_OF_DAY_COPY, TIME_OF_DAY_OPTIONS } from './time-of-day-options.ts';

export interface SettingsDetailPaneProps {
  /** The highlighted row on the glass (the Master list). */
  readonly row: SettingsRow | undefined;
  readonly mode: 'list' | 'name' | 'signOut' | 'credits';
  /** Every credit line; the pane lists them all, the glass pages them. */
  readonly credits: readonly CreditLine[];
  /** The name field and its two buttons, while renaming. On tablets they sit here instead of over the device. */
  readonly nameForm: ReactNode;
  readonly signingOut: boolean;
  readonly signOutFailed: boolean;
  /** Runs the row's action, as the glass's select button does. */
  readonly onSelect: () => void;
  readonly onSignOut: () => void;
  readonly onCancel: () => void;
}

/**
 * Settings' Detail pane (foldable skill §5, Master/Detail): the glass lists
 * the settings, this pane shows the highlighted one. Theme and Time of day
 * change right here; the others explain themselves and offer their one
 * action. Sign out keeps its question: Cancel stays the default.
 */
export function SettingsDetailPane(props: SettingsDetailPaneProps) {
  const { row, mode } = props;
  const title = mode === 'credits'
    ? copy('settings.credits.label')
    : mode === 'signOut'
      ? copy('settings.sign_out.confirm.title')
      : (row?.label ?? copy('settings.credits.label'));
  return (
    <CompanionPane title={title} testID="settings-pane" loading={row === undefined && mode === 'list'}>
      <Detail {...props} />
    </CompanionPane>
  );
}

function Detail({ row, mode, credits, nameForm, signingOut, signOutFailed, onSelect, onSignOut, onCancel }: SettingsDetailPaneProps) {
  const theme = useProfile((st) => st.theme);
  const timeOfDay = useTimeOfDay((st) => st.preset);
  if (mode === 'name') return <View testID="settings-pane-name">{nameForm}</View>;
  if (mode === 'credits') {
    return (
      <View testID="settings-pane-credits" className="gap-1">
        {credits.map((line, i) => (
          <Text
            key={`${i}-${line.text}`}
            role={line.kind === 'group' ? 'heading' : undefined}
            className={line.kind === 'group' ? 'pt-3 text-xr-label text-text' : line.kind === 'credit' ? 'text-xr-body text-text' : 'text-xr-caption text-text-muted'}
          >
            {line.text}
          </Text>
        ))}
        <View className="pt-3">
          <Button variant="outline" size="lg" fullWidth title={companionCopy('m17.back.a11y')} onPress={onCancel} className="min-h-target" />
        </View>
      </View>
    );
  }
  if (mode === 'signOut') {
    return (
      <View testID="settings-pane-signout" className="gap-3">
        <Text className="text-xr-body text-text">{copy('settings.sign_out.caption')}</Text>
        {signOutFailed ? <Text accessibilityLiveRegion="polite" className="text-xr-body text-danger">{copy('settings.sign_out.error')}</Text> : null}
        <Button variant="cta" size="lg" fullWidth title={hatchCopy('m09.edit.cancel')} disabled={signingOut} onPress={onCancel} className="min-h-target" />
        <Button variant="outline" size="lg" fullWidth title={copy('settings.sign_out.label')} disabled={signingOut} onPress={onSignOut} className="min-h-target" />
      </View>
    );
  }
  if (row === undefined) return null;
  return (
    <View testID={`settings-pane-${row.id}`} className="gap-3">
      {row.id === 'theme' ? (
        <SegmentedControl aria-label={row.label} options={[...THEME_OPTIONS]} value={theme} onChange={(v) => useProfile.getState().setTheme(v)} className="self-start" />
      ) : row.id === 'timeOfDay' ? (
        <>
          <SegmentedControl aria-label={row.label} options={TIME_OF_DAY_OPTIONS} value={timeOfDay} onChange={(v) => timeOfDayStore.getState().setPreset(v)} className="self-start" />
          <Text className="text-xr-body text-text-muted">{TIME_OF_DAY_COPY.hint}</Text>
        </>
      ) : (
        <>
          {row.value !== undefined ? <Text selectable className="text-xr-body text-text">{row.value}</Text> : null}
          {row.hint !== undefined ? <Text className="text-xr-body text-text-muted">{row.hint}</Text> : null}
          <Button
            variant={row.id === 'signOut' ? 'outline' : 'cta'}
            size="lg"
            fullWidth
            title={row.verb}
            onPress={onSelect}
            className="min-h-target"
          />
        </>
      )}
    </View>
  );
}
