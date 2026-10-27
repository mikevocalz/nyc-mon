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

export type SettingsRowId = 'caller' | 'theme' | 'timeOfDay' | 'controls' | 'legal' | 'credits' | 'signOut';

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
}

/**
 * The native settings that matter on the H-Lynk, in reading order. Sound has
 * no row: the app has no sound setting yet.
 */
export function settingsRows(input: SettingsRowsInput): SettingsRow[] {
  const change = copy('settings.row.change');
  const open = copy('settings.row.open');
  const rows: SettingsRow[] = [];
  if (input.callerName !== null) {
    rows.push({
      id: 'caller', label: copy('m07.field.label'), value: input.callerName, verb: change,
      hint: input.callerSaved ? copy('settings.caller.saved') : copy('m07.field.hint'),
    });
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
    { id: 'legal', label: copy('settings.legal.label'), verb: open },
    { id: 'credits', label: copy('settings.credits.label'), verb: open },
    { id: 'signOut', label: copy('settings.sign_out.label'), verb: copy('settings.sign_out.label'), hint: copy('settings.sign_out.caption') },
  );
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
