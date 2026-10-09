import { createStore } from 'zustand/vanilla';
import type { BootRoute } from '@acme/core/sim';
import { parseReadyNotificationData } from '../mon/ready-notification.ts';

/**
 * Hatch-ready notification → M12 routing, the pure half (M12 handoff B3).
 * The platform half (`notify-response.native.ts`) feeds responses in; this
 * file decides what they mean and holds a link that arrives before M01's
 * boot has resolved. No React, no expo-notifications, so it runs under
 * `node --test`.
 */

/**
 * The parts of an expo-notifications `NotificationResponse` this file reads.
 * Structural, so tests need no native module.
 */
export interface ResponseLike {
  readonly actionIdentifier: string;
  readonly notification: {
    readonly date: number;
    readonly request: { readonly identifier: string; readonly content: { readonly data?: unknown } };
  };
}

/** `Notifications.DEFAULT_ACTION_IDENTIFIER` in expo-notifications 58.0.11: a plain tap on the banner. */
export const DEFAULT_ACTION_IDENTIFIER = 'expo.modules.notifications.actions.DEFAULT';

/** Where a hatch-ready tap goes: M12 with the egg named. */
export interface ReadyLink {
  readonly pathname: '/(home)/hatch';
  readonly params: { readonly eggId: string };
  /** Identifies one tap, so the cold-start read and the listener never route it twice. */
  readonly key: string;
}

export type ReadyLinkResult =
  | { readonly ok: true; readonly link: ReadyLink }
  | { readonly ok: false; readonly reason: 'not-a-tap' | 'not-hatch-ready'; readonly issues?: string };

/** Parses one response. Anything that is not a tap on a valid hatch-ready payload is ignored (Law 5). */
export function readyLinkFromResponse(response: ResponseLike): ReadyLinkResult {
  if (response.actionIdentifier !== DEFAULT_ACTION_IDENTIFIER) return { ok: false, reason: 'not-a-tap' };
  const parsed = parseReadyNotificationData(response.notification.request.content.data);
  if (!parsed.ok) return { ok: false, reason: 'not-hatch-ready', issues: parsed.issues };
  return {
    ok: true,
    link: {
      pathname: parsed.data.url,
      params: { eggId: parsed.data.eggId },
      key: `${response.notification.request.identifier}@${response.notification.date}`,
    },
  };
}

/** Boot routes after which a hatch-ready link still makes sense (M12 handoff B3). Any other route drops it. */
const LINKABLE_BOOT_ROUTES: ReadonlySet<BootRoute['kind']> = new Set(['egg-ready', 'incubating', 'companion']);

/**
 * How many recent tap keys the store remembers. A duplicate only ever comes
 * from the cold-start read and the listener seeing the same tap moments
 * apart, so a short tail is enough and the list never grows with app life.
 */
export const SEEN_KEY_LIMIT = 8;

export interface DeepLinkState {
  /** M01 has resolved its route; links now navigate directly. */
  readonly bootResolved: boolean;
  /** A link that arrived before boot resolved. */
  readonly pending: ReadyLink | null;
  /**
   * A held link that boot cleared for its route. The destination applies it
   * on mount ({@link takeArmed}), so the push lands after boot's
   * `router.replace` has committed rather than in the same tick.
   */
  readonly armed: ReadyLink | null;
  /** Keys of the last {@link SEEN_KEY_LIMIT} taps taken, so one tap routes once. */
  readonly seen: readonly string[];
}

/** Where the app is when a warm tap arrives. `pathname` is expo-router's `usePathname()`, which drops route groups. */
export interface CurrentRoute {
  readonly pathname: string;
  readonly eggId?: string;
}

/** What the caller does with a received link. */
export type ReceiveOutcome = 'navigate' | 'held' | 'duplicate' | 'already-there';

/** `/(home)/hatch` → `/hatch`: the form `usePathname()` reports. */
function withoutGroups(pathname: string): string {
  return pathname.replace(/\/\([^/]+\)/g, '') || '/';
}

/** Whether the app already shows the link's screen for the link's egg. */
export function isOnLink(link: ReadyLink, current: CurrentRoute): boolean {
  return withoutGroups(current.pathname) === withoutGroups(link.pathname) && current.eggId === link.params.eggId;
}

/** A store for the one pending link. The app binds one ({@linkcode deepLinkStore}); tests make their own. */
export function createDeepLinkStore() {
  const store = createStore<DeepLinkState>(() => ({ bootResolved: false, pending: null, armed: null, seen: [] }));

  /**
   * A tap arrived (cold start or warm). Holds it until boot resolves; a repeat
   * of the same tap is a duplicate; a tap for the screen and egg already
   * showing is `already-there` and pushes nothing.
   */
  function receive(link: ReadyLink, current?: CurrentRoute): ReceiveOutcome {
    const s = store.getState();
    if (s.seen.includes(link.key)) return 'duplicate';
    const seen = [...s.seen, link.key].slice(-SEEN_KEY_LIMIT);
    if (s.bootResolved) {
      store.setState({ seen });
      return current !== undefined && isOnLink(link, current) ? 'already-there' : 'navigate';
    }
    store.setState({ seen, pending: link });
    return 'held';
  }

  /**
   * M01 calls this when it replaces itself with the boot route. Arms the held
   * link when the route can carry it and drops it otherwise: a link held
   * across a first run or a consent screen would surprise the Caller later.
   */
  function resolveBoot(route: BootRoute['kind']): void {
    const { pending } = store.getState();
    store.setState({
      bootResolved: true,
      pending: null,
      armed: pending !== null && LINKABLE_BOOT_ROUTES.has(route) ? pending : null,
    });
  }

  /** The boot destination calls this on mount. Returns the armed link once, then clears it. */
  function takeArmed(): ReadyLink | undefined {
    const { armed } = store.getState();
    if (armed === null) return undefined;
    store.setState({ armed: null });
    return armed;
  }

  return { store, receive, resolveBoot, takeArmed };
}

/** The app's one deep-link holder, shared by the root layout and M01. */
export const deepLinkStore = createDeepLinkStore();
