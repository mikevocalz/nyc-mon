// The Settings list on the 3D H-Lynk's glass (SettingsGlass): which rows
// show, what each says, the page of rows around the highlight, and the
// credits split into glass lines. Pure, so node tests pin it.
import type { ThemePreference } from '../profile/profile.store';
import type { PhysicalPresetId } from '../game/world/physical-look.ts';
import { CITY_MAP_ASSETS, CITY_MAP_DERIVED, CITY_MAP_SOURCES } from '../game/map-data-credit.ts';
import { copy } from '../onboarding/copy.ts';
import { SOFTWARE_CREDITS, SOFTWARE_CREDITS_GROUP } from './software-credits.ts';
import { themeLabel } from './theme-options.ts';
import { TIME_OF_DAY_COPY, TIME_OF_DAY_OPTIONS } from './time-of-day-options.ts';

export type SettingsRowId =
  | 'account' | 'caller' | 'notify' | 'haptics' | 'sound' | 'motion' | 'theme' | 'timeOfDay' | 'controls'
  | 'export' | 'legal' | 'credits' | 'signOut' | 'deleteAccount';

/** The rows whose select flips a switch in place. */
export const SWITCH_ROWS: readonly SettingsRowId[] = ['notify', 'haptics', 'sound', 'motion'];

export interface SettingsRow {
  readonly id: SettingsRowId;
  readonly label: string;
  /** The current value, when the row has one. */
  readonly value?: string;
  /** The select button's label for this row. */
  readonly verb: string;
  /** One caption under the list while this row is highlighted. */
  readonly hint?: string;
}

export interface SettingsRowsInput {
  /** The Caller name, or null before a Caller exists (no row then). */
  readonly callerName: string | null;
  /** Shown under the Caller name row after a rename. */
  readonly callerSaved?: boolean;
  readonly theme: ThemePreference;
  /** The city's light preset, or null when the physically lit city is off (no row then). */
  readonly timeOfDay: PhysicalPresetId | null;
  /** This device has an account (useHasAccount). Without one there is nothing to delete (no row). */
  readonly hasAccount?: boolean;
  /** The signed-in email, or null when signed out (no Account row then). */
  readonly email?: string | null;
  /** Egg alerts on, or null where the app never notifies (web; no row then). */
  readonly notify?: boolean | null;
  /** The OS blocks alerts: the row opens the phone's Settings instead. */
  readonly notifyDenied?: boolean;
  readonly haptics?: boolean;
  readonly sound?: boolean;
  /** Reduced motion in effect (forced or from the OS). */
  readonly motion?: boolean;
}

const onOff = (on: boolean): string => copy(on ? 'settings.on' : 'settings.off');

/**
 * The native settings that matter on the H-Lynk, in reading order: the
 * account, the device switches (M19), appearance, game, data, legal and the
 * session.
 */
export function settingsRows(input: SettingsRowsInput): SettingsRow[] {
  const change = copy('settings.row.change');
  const open = copy('settings.row.open');
  const rows: SettingsRow[] = [];
  if (typeof input.email === 'string') {
    rows.push({ id: 'account', label: copy('settings.account.title'), value: input.email, verb: open, hint: copy('settings.account.methods') });
  }
  if (input.callerName !== null) {
    rows.push({
      id: 'caller', label: copy('m07.field.label'), value: input.callerName, verb: change,
      hint: input.callerSaved ? copy('settings.caller.saved') : copy('m07.field.hint'),
    });
  }
  if (input.notify !== undefined && input.notify !== null) {
    rows.push({
      id: 'notify', label: copy('settings.notify.label'), value: onOff(input.notify),
      verb: input.notifyDenied ? copy('settings.notify.open_settings') : change,
      hint: copy(input.notifyDenied ? 'settings.notify.caption.denied' : 'settings.notify.caption'),
    });
  }
  if (input.haptics !== undefined) {
    rows.push({ id: 'haptics', label: copy('settings.haptics.label'), value: onOff(input.haptics), verb: change, hint: copy('settings.haptics.caption') });
  }
  if (input.sound !== undefined) {
    rows.push({ id: 'sound', label: copy('settings.sound.label'), value: onOff(input.sound), verb: change, hint: copy('settings.sound.caption') });
  }
  if (input.motion !== undefined) {
    rows.push({ id: 'motion', label: copy('settings.motion.label'), value: onOff(input.motion), verb: change, hint: copy('settings.motion.caption') });
  }
  rows.push({ id: 'theme', label: copy('settings.theme.label'), value: themeLabel(input.theme), verb: change });
  if (input.timeOfDay !== null) {
    const preset = input.timeOfDay;
    rows.push({
      id: 'timeOfDay', label: TIME_OF_DAY_COPY.label, value: TIME_OF_DAY_OPTIONS.find((o) => o.value === preset)?.label ?? preset,
      verb: change, hint: TIME_OF_DAY_COPY.hint,
    });
  }
  rows.push(
    { id: 'controls', label: copy('settings.game_controls.label'), verb: open, hint: copy('settings.game_controls.caption') },
    { id: 'export', label: copy('settings.export.label'), verb: copy('settings.export.action'), hint: copy('settings.export.caption') },
    { id: 'legal', label: copy('settings.legal.label'), verb: open },
    { id: 'credits', label: copy('settings.credits.label'), verb: open },
    { id: 'signOut', label: copy('settings.sign_out.label'), verb: copy('settings.sign_out.label'), hint: copy('settings.sign_out.caption') },
  );
  if (input.hasAccount === true) {
    // Last, after Sign out: the one destructive row. Selecting it only opens the question.
    rows.push({ id: 'deleteAccount', label: copy('settings.delete.label'), verb: copy('settings.row.open'), hint: copy('settings.delete.caption') });
  }
  return rows;
}

/** What a row says on one line of the glass: "Theme · Dark". */
export function rowText(row: SettingsRow): string {
  return row.value === undefined ? row.label : `${row.label} · ${row.value}`;
}

/** The highlight kept inside the list. */
export function clampCursor(cursor: number, count: number): number {
  return Math.min(Math.max(0, count - 1), Math.max(0, cursor));
}

/** The page of `size` rows holding the highlight: its first index and the rows. */
export function pageAround<T>(items: readonly T[], cursor: number, size: number): { readonly start: number; readonly items: readonly T[] } {
  const start = Math.floor(clampCursor(cursor, items.length) / size) * size;
  return { start, items: items.slice(start, start + size) };
}

/**
 * Splits text into lines of at most `max` characters on word boundaries, so
 * a long credit wraps instead of being cut off (the glass draws one line per
 * entry). A single word longer than `max` keeps its own line.
 */
export function wrapWords(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter((w) => w !== '')) {
    if (line === '') line = word;
    else if (line.length + 1 + word.length <= max) line = `${line} ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

export interface CreditLine {
  readonly text: string;
  readonly kind: 'group' | 'credit' | 'licence';
}

/** Caption lines at the glass's caption size fit in about this many characters. */
export const CREDIT_LINE_CHARS = 40;

/**
 * Every credit the 2D Legal & credits card lists, in the same order and
 * groups: map data (sources, then the bundled tile's own grant), models and
 * textures, then software. Each attribution wraps; its licence follows.
 */
export function creditLines(max: number = CREDIT_LINE_CHARS): CreditLine[] {
  const entry = (text: string, licence: string): CreditLine[] => [
    ...wrapWords(text, max).map((t): CreditLine => ({ text: t, kind: 'credit' })),
    ...wrapWords(licence, max).map((t): CreditLine => ({ text: t, kind: 'licence' })),
  ];
  return [
    { text: copy('settings.credits.map'), kind: 'group' },
    ...CITY_MAP_SOURCES.flatMap((s) => entry(s.attribution, s.license)),
    ...entry(CITY_MAP_DERIVED.attribution, CITY_MAP_DERIVED.license),
    { text: copy('settings.credits.assets'), kind: 'group' },
    ...CITY_MAP_ASSETS.flatMap((s) => entry(s.attribution, s.license)),
    { text: SOFTWARE_CREDITS_GROUP, kind: 'group' },
    ...SOFTWARE_CREDITS.flatMap((c) => wrapWords(c.line, max).map((t): CreditLine => ({ text: t, kind: 'credit' }))),
  ];
}

/** Caption lines the glass holds under a question (seven body rows hold eight caption lines). */
export const CONFIRM_LINES = 8;

/**
 * The Delete account question on the glass, as caption lines. It shows what
 * gets deleted; after a failure the error takes its place (the Caller has
 * read the warning already, and both together would overflow the glass). The
 * Detail pane and the 2D dialog show both in full.
 */
export function deleteConfirmLines(error: string | undefined, max: number = CREDIT_LINE_CHARS): string[] {
  return wrapWords(error ?? copy('settings.delete.confirm.body'), max).slice(0, CONFIRM_LINES);
}
