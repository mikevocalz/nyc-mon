import { careCopy } from './care-copy.ts';
import { isRealCallKind, type PredictedCall } from './care-notification-plan.ts';

/**
 * The keychain widget's data (contract §7, canon Decision #36). The app builds
 * it from `selectMonCareView` and `predictRealCalls` after every tick and
 * action and writes it as JSON to the App Group (`keychain-widget.native.ts`);
 * the WidgetKit extension (`apps/mobile/targets/keychain-widget`) decodes it
 * as `KeychainSnapshot.swift`. Change both together and bump the version.
 *
 * The widget draws strings the app resolved, so copy lives in one place
 * (COPY_DECK `keychain.*`); Swift only holds the empty-state and gallery text.
 *
 * Attention mirrors the in-app lamp: any open call, real or false, lights it
 * (`keychain.calling` "any open call, real or false"; D20d: the Caller tells
 * them apart by checking status, as on the classic toys). Notifications stay
 * real-calls-only. `nextCallAt` is the next predicted REAL call, so the widget
 * can light up on time while the app is closed.
 */
export const KEYCHAIN_SNAPSHOT_VERSION = 1;
/** After this long without a write the hearts are too old to trust (`keychain.stale`). */
export const KEYCHAIN_STALE_MS = 4 * 60 * 60 * 1000;
const NAME_MAX = 24;

type Hearts = 0 | 1 | 2 | 3 | 4;

/** The fields of contract §3 `MonCareView` the widget reads. */
export interface MonCareViewLike {
  readonly hearts: { readonly fullness: Hearts; readonly social: Hearts; readonly energy: Hearts };
  readonly poop: Hearts;
  readonly cold: { readonly dosesRemaining: number } | null;
  readonly asleep: boolean;
  readonly paused: boolean;
  readonly attention: 'none' | 'call' | 'false-call';
}

export interface KeychainInput {
  readonly monName: string;
  readonly view: MonCareViewLike;
  readonly predictions: readonly PredictedCall[];
  readonly now: number;
}

export interface KeychainSnapshot {
  readonly v: typeof KEYCHAIN_SNAPSHOT_VERSION;
  readonly monName: string;
  readonly hearts: { readonly fullness: Hearts; readonly energy: Hearts; readonly social: Hearts };
  readonly attention: 'none' | 'call';
  readonly poop: Hearts;
  readonly cold: boolean;
  readonly asleep: boolean;
  readonly paused: boolean;
  readonly nextCallAt: number | null;
  readonly updatedAt: number;
  readonly staleAt: number;
  readonly text: {
    readonly title: string;
    readonly status: string;
    /** Status once `nextCallAt` passes. */
    readonly calling: string;
    readonly detail: string | null;
    readonly a11y: string;
    readonly a11yCalling: string;
    readonly stale: string;
    /** Heart-row words, in draw order. */
    readonly meters: { readonly fullness: string; readonly energy: string; readonly social: string };
  };
}

function clampHearts(n: number): Hearts {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(4, Math.floor(n))) as Hearts;
}

function tidyName(raw: string): string {
  const name = raw.trim() || 'Your Mon';
  return name.length > NAME_MAX ? name.slice(0, NAME_MAX) : name;
}

export function buildKeychainSnapshot(input: KeychainInput): KeychainSnapshot {
  const { view, now } = input;
  const name = tidyName(input.monName);
  const hearts = { fullness: clampHearts(view.hearts.fullness), energy: clampHearts(view.hearts.energy), social: clampHearts(view.hearts.social) };
  const calling = !view.paused && view.attention !== 'none';
  const nextCallAt = view.paused
    ? null
    : input.predictions
      .filter((p) => isRealCallKind(p.kind) && p.at > now)
      .reduce<number | null>((min, p) => (min === null || p.at < min ? p.at : min), null);

  const poop = clampHearts(view.poop);
  const details: string[] = [];
  if (view.cold !== null) details.push(careCopy('keychain.cold'));
  if (poop === 1) details.push(careCopy('keychain.poop.one'));
  else if (poop > 1) details.push(careCopy('keychain.poop.many', { count: poop }));

  const callingLine = careCopy('keychain.calling', { name });
  const status = view.paused
    ? careCopy('keychain.paused')
    : calling
      ? callingLine
      : view.asleep
        ? careCopy('keychain.asleep', { name })
        : careCopy('keychain.content', { name });
  const a11y = (state: string) => careCopy('keychain.a11y', { name, state, ...hearts });

  return {
    v: KEYCHAIN_SNAPSHOT_VERSION,
    monName: name,
    hearts,
    attention: calling ? 'call' : 'none',
    poop,
    cold: view.cold !== null,
    asleep: view.asleep,
    paused: view.paused,
    nextCallAt,
    updatedAt: now,
    staleAt: now + KEYCHAIN_STALE_MS,
    text: {
      title: careCopy('keychain.title', { name }),
      status,
      calling: callingLine,
      detail: details.length > 0 ? details.join(' · ') : null,
      a11y: a11y(status),
      a11yCalling: a11y(callingLine),
      stale: careCopy('keychain.stale'),
      meters: {
        fullness: careCopy('monspace.hearts.fullness'),
        energy: careCopy('monspace.hearts.energy'),
        social: careCopy('monspace.hearts.social'),
      },
    },
  };
}

/** Everything the widget draws, without the clock fields. Equal signatures need no reload. */
export function keychainSignature(snapshot: KeychainSnapshot): string {
  const { updatedAt: _u, staleAt: _s, ...drawn } = snapshot;
  return JSON.stringify(drawn);
}

/** Refresh an unchanged snapshot this often so its stale time keeps moving while the app is in use. */
export const KEYCHAIN_HEARTBEAT_MS = 30 * 60 * 1000;

/**
 * Whether to write and reload the widget. WidgetKit budgets reloads, so a
 * minute tick that changes nothing visible only refreshes every
 * {@linkcode KEYCHAIN_HEARTBEAT_MS}.
 */
export function shouldWriteKeychain(previous: { readonly signature: string; readonly at: number } | null, next: KeychainSnapshot): boolean {
  if (previous === null) return true;
  return previous.signature !== keychainSignature(next) || next.updatedAt - previous.at >= KEYCHAIN_HEARTBEAT_MS;
}
