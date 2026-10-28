// M19 Data export, the pure half: what goes in the file and what it is
// called. The device copy is the Caller's whole local save plus this
// device's settings; the account copy is what the server hands a signed-in
// Caller today (their account record and linked sign-in methods). There is
// no fuller server export endpoint yet; the privacy notice's "ask for a copy"
// route (reply to any NYC-MON email) covers the rest.
import type { DevicePrefs } from './device-prefs-model.ts';

export interface ExportAccount {
  readonly email: string | null;
  readonly name: string | null;
  readonly birthYear: number | null;
  readonly createdAt: string | null;
  /** `credential`, `apple`, `google`, `amazon`. */
  readonly signInMethods: readonly string[];
}

export interface DataExportInput {
  /** The raw stored save, parsed, or null when this device has none. */
  readonly save: unknown;
  readonly prefs: DevicePrefs;
  /** Null when signed out or the server could not be reached. */
  readonly account: ExportAccount | null;
  /** True when a signed-in Caller's account copy could not be fetched. */
  readonly accountUnavailable: boolean;
  readonly nowMs: number;
}

export const DATA_EXPORT_FORMAT = 'nyc-mon-export/1';

export interface DataExport {
  readonly format: typeof DATA_EXPORT_FORMAT;
  readonly exportedAt: string;
  readonly device: { readonly save: unknown; readonly settings: DevicePrefs };
  readonly account: ExportAccount | null;
  readonly notes: readonly string[];
}

export function buildDataExport(input: DataExportInput): DataExport {
  const notes: string[] = [];
  if (input.save === null) notes.push('No game save on this device.');
  if (input.account === null) {
    notes.push(input.accountUnavailable ? 'Your account copy could not be fetched. Try again online.' : 'Not signed in: no account copy.');
  }
  return {
    format: DATA_EXPORT_FORMAT,
    exportedAt: new Date(input.nowMs).toISOString(),
    device: { save: input.save, settings: input.prefs },
    account: input.account,
    notes,
  };
}

/** `nyc-mon-export-2026-10-28.json`, in UTC. */
export function dataExportFileName(nowMs: number): string {
  return `nyc-mon-export-${new Date(nowMs).toISOString().slice(0, 10)}.json`;
}

/** Parses the stored save string without the schema: an export carries even a save the app can't load. */
export function rawSaveForExport(raw: string | undefined): unknown {
  if (raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { unreadable: raw };
  }
}
