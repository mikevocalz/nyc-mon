'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { CALLER_NAME_MAX_LENGTH } from '@acme/core/sim';
import {
  Button, TextField, useInstanceStore, useStore, type DeviceKey, type GlassAction, type GlassLine, type GlassView,
} from '@acme/ui';
import { haptics } from '@acme/ui/haptics';
import { Pressable, Text, View } from '@acme/ui/tw';
import { GlassStage, useGlassOn, useGlassScreen, useMonGlass } from '../companion/glass';
import { companionCopy } from '../companion/copy';
import { useHomeStage } from '../companion/home-stage.store';
import { monIdentity } from '../companion/mon-identity';
import { EXPERIMENTAL_WORLD_PHYSICAL } from '../game/world/physical-look.ts';
import { timeOfDayStore, useTimeOfDay } from '../game/world/time-of-day.store.ts';
import { hatchCopy } from '../hatch/copy';
import { selectActiveMon, useMonStore } from '../mon/mon.store';
import { announcePolitely } from '../onboarding/announce';
import { copy } from '../onboarding/copy';
import { useProfile } from '../profile/profile.store';
import { useCallerNameEditor } from './caller-name-editor';
import { SettingsScreen } from './screen.native';
import {
  clampCursor, creditLines, pageAround, rowText, settingsRows, type CreditLine, type SettingsRow,
} from './settings-glass-model';
import { SIGNED_OUT_PATH, signOutHere } from './sign-out';
import { nextOf, THEME_OPTIONS, themeLabel } from './theme-options.ts';
import { TIME_OF_DAY_OPTIONS } from './time-of-day-options.ts';

/** The Baby small at the top, seven text rows, one row of buttons. */
const LIST_LAYOUT = { model: 'small', rings: false, lineRows: 7, actionRows: 1, perRow: 3 } as const;
/** Same slots with two buttons (the name field, the sign-out question), so the Baby never moves. */
const FORM_LAYOUT = { ...LIST_LAYOUT, perRow: 2 } as const;
/** Settings rows per page; the seventh line is the highlighted row's caption. */
const ROWS_PER_PAGE = 6;
/** Caption lines per credits page (seven body rows hold eight caption lines). */
const CREDIT_LINES_PER_PAGE = 8;

const GAME_CONTROLS_PATH = '/(drawer)/game-controls';
const LEGAL_PATH = '/legal/terms';

type Mode = 'list' | 'name' | 'signOut' | 'credits';

interface LocalState {
  mode: Mode;
  /** The highlighted row in the list. */
  cursor: number;
  creditPage: number;
  /** Taps on the Baby: each one wobbles it. */
  nudge: number;
  /** Bumped when the name field should take focus (the kit TextField takes no ref). */
  focusKey: number;
  signingOut: boolean;
  signOutFailed: boolean;
  /** The 3D H-Lynk reported it can't run: the 2D page. */
  failed: boolean;
}

const CREDITS = creditLines();
const CREDIT_PAGES = Math.max(1, Math.ceil(CREDITS.length / CREDIT_LINES_PER_PAGE));

function creditGlassLine(line: CreditLine): GlassLine {
  if (line.kind === 'group') return { text: line.text, size: 'caption', tone: 'amber', align: 'left' };
  return { text: line.text, size: 'caption', tone: line.kind === 'credit' ? 'text' : 'dim', align: 'left' };
}

/** The 2D page's Back control: the (home) group has no stack header. */
function BackRow({ onPress }: { onPress: () => void }) {
  const label = companionCopy('m17.back.a11y');
  return (
    <View testID="settings-back" className="self-start px-4 py-2">
      <Pressable
        accessibilityLabel={label}
        onPress={onPress}
        className="min-h-target min-w-target items-start justify-center focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Text className="text-xr-label text-text">{`‹ ${label}`}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Settings at `/(home)/settings`, opened from the H-Lynk menu. On the 3D
 * H-Lynk it is a list on the glass with the Baby small above it: Previous
 * and Next (or the < and > keys) move the highlight, the trackpad or the
 * middle button selects, Back and Home leave. Caller name opens a real text
 * field under the device while the glass previews the name (M09's pattern);
 * Theme and Time of day change in place; Game controls and Legal open their
 * screens; Credits pages through the map, model and software credits on the
 * glass; Sign out asks once, with Cancel as the default. Reduced motion,
 * accessibility text sizes or no GPU get the 2D Settings page instead.
 */
export function SettingsGlass() {
  const router = useRouter();
  const local = useInstanceStore<LocalState>(() => ({
    mode: 'list', cursor: 0, creditPage: 0, nudge: 0, focusKey: 0, signingOut: false, signOutFailed: false, failed: false,
  }));
  const s = useStore(local);
  const glassOn = useGlassOn(s.failed);
  const editor = useCallerNameEditor();
  const theme = useProfile((st) => st.theme);
  const timeOfDay = useTimeOfDay((st) => st.preset);
  const mon = useMonStore(selectActiveMon);
  const { model, monClips } = useMonGlass(mon === undefined ? null : monIdentity(mon).dexId, undefined);

  const rows = settingsRows({
    callerName: editor.available ? editor.name : null,
    callerSaved: editor.saved,
    theme,
    timeOfDay: EXPERIMENTAL_WORLD_PHYSICAL ? timeOfDay : null,
  });
  const cursor = clampCursor(s.cursor, rows.length);
  const current: SettingsRow | undefined = rows[cursor];

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(home)');
  };
  const move = (by: -1 | 1) => {
    const next = clampCursor(cursor + by, rows.length);
    if (next === cursor) return;
    haptics.selection();
    local.setState({ cursor: next });
  };
  const toList = () => local.setState({ mode: 'list', signOutFailed: false });

  const select = (row: SettingsRow | undefined) => {
    if (row === undefined) return;
    haptics.tap();
    switch (row.id) {
      case 'caller':
        editor.reset();
        local.setState((st) => ({ mode: 'name', focusKey: st.focusKey + 1 }));
        return;
      case 'theme': {
        const next = nextOf(THEME_OPTIONS, useProfile.getState().theme);
        useProfile.getState().setTheme(next);
        announcePolitely(copy('settings.value.a11y', { label: row.label, value: themeLabel(next) }));
        return;
      }
      case 'timeOfDay': {
        const next = nextOf(TIME_OF_DAY_OPTIONS, timeOfDayStore.getState().preset);
        timeOfDayStore.getState().setPreset(next);
        const label = TIME_OF_DAY_OPTIONS.find((o) => o.value === next)?.label ?? next;
        announcePolitely(copy('settings.value.a11y', { label: row.label, value: label }));
        return;
      }
      case 'controls':
        router.push(GAME_CONTROLS_PATH);
        return;
      case 'legal':
        router.push(LEGAL_PATH);
        return;
      case 'credits':
        local.setState({ mode: 'credits', creditPage: 0 });
        return;
      case 'signOut':
        local.setState({ mode: 'signOut', signOutFailed: false });
        return;
    }
  };
  const selectAt = (index: number) => {
    local.setState({ cursor: index });
    select(rows[index]);
  };

  const saveName = () => {
    if (!editor.save()) return;
    haptics.success();
    announcePolitely(copy('m07.confirmed.a11y.announce'));
    local.setState((st) => ({ mode: 'list', nudge: st.nudge + 1 }));
  };
  const cancelName = () => {
    editor.reset();
    toList();
  };

  const signOut = async () => {
    local.setState({ signingOut: true, signOutFailed: false });
    if (await signOutHere()) {
      local.setState({ signingOut: false });
      router.replace(SIGNED_OUT_PATH);
      return;
    }
    haptics.warning();
    local.setState({ signingOut: false, signOutFailed: true });
  };

  const turnCredits = (by: -1 | 1) =>
    local.setState((st) => ({ creditPage: Math.min(CREDIT_PAGES - 1, Math.max(0, st.creditPage + by)) }));

  // ---- what the glass shows, per mode ----
  const back = companionCopy('m17.back.a11y');
  const cancel = hatchCopy('m09.edit.cancel');
  const title = companionCopy('m13.menu.settings');
  let view: GlassView;
  let label: string;
  if (s.mode === 'name') {
    label = copy('m07.field.label');
    view = {
      status: { text: title, tone: 'neutral' },
      title: label,
      subtitle: copy('m07.field.hint'),
      rings: [],
      lines: [
        ...(editor.draft === '' ? [] : [{ text: editor.draft, size: 'plate' as const, tone: 'text' as const }]),
        ...(editor.error ? [{ text: editor.error, size: 'caption' as const, tone: 'amber' as const }] : []),
      ],
      actions: [
        { target: 'cancel', label: cancel, tone: 'secondary' },
        { target: 'save', label: copy('m07.continue'), tone: 'primary', disabled: !editor.changed },
      ],
    };
  } else if (s.mode === 'signOut') {
    label = copy('settings.sign_out.confirm.title');
    view = {
      status: { text: title, tone: 'neutral' },
      title: label,
      subtitle: '',
      rings: [],
      lines: [
        { text: copy('settings.sign_out.caption'), size: 'body', tone: 'dim' },
        ...(s.signOutFailed ? [{ text: copy('settings.sign_out.error'), size: 'caption' as const, tone: 'red' as const }] : []),
      ],
      // Cancel is the default (primary, and the trackpad): signing out takes a tap on its own button.
      actions: [
        { target: 'cancel', label: cancel, tone: 'primary', disabled: s.signingOut },
        { target: 'signOut', label: copy('settings.sign_out.label'), tone: 'secondary', disabled: s.signingOut },
      ],
    };
  } else if (s.mode === 'credits') {
    label = copy('settings.credits.label');
    const page = Math.min(s.creditPage, CREDIT_PAGES - 1);
    view = {
      status: { text: title, tone: 'neutral' },
      title: label,
      subtitle: '',
      rings: [],
      lines: CREDITS.slice(page * CREDIT_LINES_PER_PAGE, (page + 1) * CREDIT_LINES_PER_PAGE).map(creditGlassLine),
      actions: [
        { target: 'previous', label: copy('settings.page.previous'), tone: 'secondary', disabled: page === 0 },
        { target: 'back', label: back, tone: 'primary' },
        { target: 'next', label: copy('settings.page.next'), tone: 'secondary', disabled: page >= CREDIT_PAGES - 1 },
      ],
    };
  } else {
    label = title;
    const page = pageAround(rows, cursor, ROWS_PER_PAGE);
    view = {
      status: null,
      title,
      subtitle: '',
      rings: [],
      lines: [
        ...page.items.map((row, i): GlassLine => ({
          text: rowText(row),
          align: 'left',
          tone: page.start + i === cursor ? 'text' : 'dim',
          ...(page.start + i === cursor ? { badge: row.verb } : {}),
        })),
        ...(current?.hint ? [{ text: current.hint, size: 'caption' as const, tone: 'dim' as const, align: 'left' as const }] : []),
      ],
      actions: [
        { target: 'previous', label: copy('settings.page.previous'), tone: 'secondary', disabled: cursor === 0 },
        { target: 'select', label: current?.verb ?? '', tone: 'primary', disabled: current === undefined },
        { target: 'next', label: copy('settings.page.next'), tone: 'secondary', disabled: cursor >= rows.length - 1 },
      ],
    };
  }

  const onAction = (target: string) => {
    if (s.mode === 'name') {
      if (target === 'save') saveName();
      else if (target === 'cancel') cancelName();
    } else if (s.mode === 'signOut') {
      if (target === 'signOut') void signOut();
      else if (target === 'cancel') toList();
    } else if (s.mode === 'credits') {
      if (target === 'previous') turnCredits(-1);
      else if (target === 'next') turnCredits(1);
      else if (target === 'back') toList();
    } else if (target === 'previous') move(-1);
    else if (target === 'next') move(1);
    else if (target === 'select') select(current);
  };
  const onKey = (key: DeviceKey) => {
    const mode = local.getState().mode;
    const leaving = key === 'back' || key === 'home';
    if (mode === 'name') {
      if (leaving) cancelName();
      else if (key === 'activate') {
        if (editor.changed) saveName();
        else local.setState((st) => ({ focusKey: st.focusKey + 1 }));
      }
    } else if (mode === 'signOut') {
      // The trackpad answers the default, Cancel.
      if ((leaving || key === 'activate') && !local.getState().signingOut) toList();
    } else if (mode === 'credits') {
      if (key === 'prev') turnCredits(-1);
      else if (key === 'next') turnCredits(1);
      else if (leaving || key === 'activate') toList();
    } else if (key === 'prev') move(-1);
    else if (key === 'next') move(1);
    else if (key === 'activate') select(current);
    else if (leaving) leave();
  };

  const layout = s.mode === 'name' || s.mode === 'signOut' ? FORM_LAYOUT : LIST_LAYOUT;
  const glass = useGlassScreen({ layout, model: mon === undefined ? null : model, view, nudge: s.nudge });
  useEffect(() => {
    glass.bind({ onAction, monClips, onModel: () => local.setState((st) => ({ nudge: st.nudge + 1 })) });
  });
  const onFailed = useCallback(() => local.setState({ failed: true }), [local]);

  // Shell: none. The glass, or the 2D page full-window over the mounted shell.
  useHomeStage({});

  if (!glassOn) return <SettingsScreen leading={<BackRow onPress={leave} />} />;

  const field = (
    <View testID="settings-field-caller">
      <TextField
        key={s.focusKey}
        autoFocus={s.focusKey > 0}
        surface="well"
        label={copy('m07.field.label')}
        hint={copy('m07.field.hint')}
        error={editor.error}
        value={editor.draft}
        onChangeText={editor.setDraft}
        onSubmitEditing={saveName}
        maxLength={CALLER_NAME_MAX_LENGTH}
        autoCorrect={false}
        autoCapitalize="words"
        textContentType="nickname"
        clearButton={{ accessibilityLabel: copy('m07.field.clear.a11y.label') }}
      />
    </View>
  );

  const actionControls = (actions: readonly GlassAction[]) => actions.map((a) => ({
    key: a.target, label: a.label, disabled: a.disabled, onPress: () => onAction(a.target), testID: `settings-${s.mode}-${a.target}`,
  }));
  const controls = s.mode === 'list'
    ? [
      // Every row as its own button: a screen reader selects a row in one step.
      ...rows.map((row, i) => ({
        key: row.id,
        label: row.value === undefined ? row.label : copy('settings.value.a11y', { label: row.label, value: row.value }),
        hint: row.hint,
        onPress: () => selectAt(i),
        testID: `settings-row-${row.id}`,
      })),
      { key: 'back', label: back, onPress: leave, testID: 'settings-back' },
    ]
    : actionControls(view.actions);

  return (
    <GlassStage
      screen={glass.screen}
      label={label}
      testIDPrefix="settings"
      onKey={onKey}
      onFailed={onFailed}
      a11y={
        <>
          <Text accessibilityRole="header">{view.title}</Text>
          {view.subtitle !== '' ? <Text>{view.subtitle}</Text> : null}
          {s.mode === 'list'
            ? rows.map((row) => <Text key={row.id}>{rowText(row)}</Text>)
            : view.lines.map((line, i) => <Text key={`${i}-${line.text}`}>{line.text}</Text>)}
        </>
      }
      controls={controls}
      // Only while renaming: the field (it can't be drawn on the glass) with its two actions, under the device.
      below={s.mode === 'name' ? (
        <View className="gap-3 bg-ink-950/90 px-4 pb-4 pt-3">
          {field}
          <View className="flex-row gap-target-gap">
            <View className="flex-1">
              <Button variant="outline" size="lg" fullWidth title={cancel} onPress={cancelName} className="min-h-target" />
            </View>
            <View className="flex-1">
              <Button
                variant="cta"
                size="lg"
                fullWidth
                title={copy('m07.continue')}
                disabled={!editor.changed}
                onPress={saveName}
                className="min-h-target"
              />
            </View>
          </View>
        </View>
      ) : undefined}
    />
  );
}
