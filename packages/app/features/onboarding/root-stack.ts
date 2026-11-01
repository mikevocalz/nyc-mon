/**
 * Root stack hygiene. The root layout is a Stack so `(home)` stays mounted
 * (its 3D stage, renderer and Baby with it) while another group is on top,
 * and `(home)` / `(drawer)` are singular there: navigating to one moves the
 * existing copy to the top instead of mounting a second.
 *
 * Two cases the navigator does not clean up by itself:
 *
 * - A signed-out entry (sign-in, Welcome) on top, reached by sign-out or
 *   account deletion with `router.replace`: a `(home)` or `(drawer)` left
 *   under it belongs to the old session. Drop them.
 * - A `replace` into `(home)` or `(drawer)` (the permissions step finishing,
 *   a settings exit) creates a fresh copy without consulting `singular`. Drop
 *   the older copies under it, so one stage and one renderer stay alive.
 *
 * Pure over the navigation state's shape, so it is tested without a navigator.
 */
export interface RouteLike {
  readonly key: string;
  readonly name: string;
  readonly state?: { readonly index?: number; readonly routes: readonly RouteLike[] } | undefined;
}

export interface StackLike {
  readonly index: number;
  readonly routes: readonly RouteLike[];
}

/** The groups that hold a session's shell: one copy each, never under a signed-out entry. */
export const SESSION_GROUPS: readonly string[] = ['(home)', '(drawer)'];

/** Leaf screens that start a signed-out session. */
const SIGNED_OUT_ENTRIES: readonly (readonly [group: string, leaf: string])[] = [
  ['(auth)', 'sign-in'],
  ['(onboarding)', 'welcome'],
];

function leafName(route: RouteLike): string {
  let at = route;
  for (;;) {
    const child = at.state;
    if (child === undefined || child.routes.length === 0) return at.name;
    at = child.routes[child.index ?? child.routes.length - 1]!;
  }
}

function isSignedOutEntry(route: RouteLike): boolean {
  const leaf = leafName(route);
  return SIGNED_OUT_ENTRIES.some(([group, name]) => route.name === group && leaf === name);
}

/**
 * The routes to keep, or null when the stack is already clean. Routes above
 * the focused one (preloads) are kept untouched.
 */
export function cleanRootStack(stack: StackLike): { readonly index: number; readonly routes: readonly RouteLike[] } | null {
  const focused = stack.routes[stack.index];
  if (focused === undefined) return null;
  const below = stack.routes.slice(0, stack.index);
  const above = stack.routes.slice(stack.index + 1);
  const signedOut = isSignedOutEntry(focused);
  const kept = below.filter((route) => {
    if (!SESSION_GROUPS.includes(route.name)) return true;
    if (signedOut) return false;
    return route.name !== focused.name;
  });
  if (kept.length === below.length) return null;
  return { index: kept.length, routes: [...kept, focused, ...above] };
}
