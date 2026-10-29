import type { CallKind, MonCareOutcome, MonCareView } from '@acme/core/sim';
import type { CompanionCopyId } from '../companion/copy.ts';

/**
 * M32 Mon Space (canon v12 "H-Lynk → Active Mon opens Mon Space";
 * docs/design/screens/M32): the classic icon loop on a full-screen LCD. Pure:
 * no React, no store, no clock. The screen feeds it the care view and the
 * Caller's presses and gets back what to draw, what to do and what to say.
 */

/** The icon bar in its fixed order (03-direction "Icon menu"; H4: same place every visit). A steps through it. */
export const MON_SPACE_ICONS = ['meal', 'snack', 'play', 'lights', 'clean', 'medicine', 'boundary', 'status', 'pause'] as const;
export type MonSpaceIcon = (typeof MON_SPACE_ICONS)[number];

/** The classic three buttons: A cycles, B selects, C cancels. */
export type MonSpaceKey = 'next' | 'prev' | 'select' | 'cancel';

/** Screen-local UI state (an instance store, not business state): the A-cursor and the open layer. */
export interface MonSpaceUi {
  /** Index into {@linkcode MON_SPACE_ICONS}. */
  readonly focus: number;
  readonly layer: 'bar' | 'status' | 'pause-confirm';
}

/** Which icon answers a call, so one B press answers it (03-direction "Interaction model"). */
export const ANSWER_ICON: Record<CallKind, MonSpaceIcon> = {
  hunger: 'meal',
  energy: 'lights',
  social: 'play',
  cold: 'medicine',
  bedtime: 'lights',
  'false-call': 'boundary',
};

export function iconIndex(icon: MonSpaceIcon): number {
  return MON_SPACE_ICONS.indexOf(icon);
}

/** The first UI state: focus on the icon that answers the open call, else Meal. */
export function initialUi(view: Pick<MonCareView, 'call' | 'paused'> | undefined): MonSpaceUi {
  if (view?.paused === true) return { focus: iconIndex('pause'), layer: 'bar' };
  const call = view?.call ?? null;
  return { focus: iconIndex(call === null ? 'meal' : (ANSWER_ICON[call.kind] ?? 'meal')), layer: 'bar' };
}

/** What one press asks the screen to do. */
export type MonSpaceEffect =
  | { readonly kind: 'moved' }
  | { readonly kind: 'act'; readonly icon: MonSpaceIcon }
  | { readonly kind: 'closed' }
  | { readonly kind: 'exit' };

export interface PressResult {
  readonly ui: MonSpaceUi;
  readonly effect: MonSpaceEffect;
}

/** One press of A (next/prev), B (select) or C (cancel). C backs out one level, then leaves. */
export function pressKey(ui: MonSpaceUi, key: MonSpaceKey): PressResult {
  const n = MON_SPACE_ICONS.length;
  if (ui.layer !== 'bar') {
    // The status page and the pause confirm: A and C close them; B on the confirm pauses.
    if (key === 'select' && ui.layer === 'pause-confirm') return { ui: { ...ui, layer: 'bar' }, effect: { kind: 'act', icon: 'pause' } };
    if (key === 'select' && ui.layer === 'status') return { ui: { ...ui, layer: 'bar' }, effect: { kind: 'closed' } };
    return { ui: { ...ui, layer: 'bar' }, effect: { kind: 'closed' } };
  }
  switch (key) {
    case 'next':
      return { ui: { ...ui, focus: (ui.focus + 1) % n }, effect: { kind: 'moved' } };
    case 'prev':
      return { ui: { ...ui, focus: (ui.focus - 1 + n) % n }, effect: { kind: 'moved' } };
    case 'select':
      return { ui, effect: { kind: 'act', icon: MON_SPACE_ICONS[ui.focus] ?? 'meal' } };
    case 'cancel':
      return { ui, effect: { kind: 'exit' } };
    default:
      return assertNever(key);
  }
}

/** A direct tap on an icon: the cursor moves there and the icon acts (A and B in one press). */
export function tapIcon(ui: MonSpaceUi, icon: MonSpaceIcon): PressResult {
  return { ui: { focus: iconIndex(icon), layer: 'bar' }, effect: { kind: 'act', icon } };
}

/** Hardware keyboard (iPad, web): arrows cycle, Return or Space selects, Escape cancels. */
export function keyFromKeyboard(key: string): MonSpaceKey | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return 'next';
    case 'ArrowLeft':
    case 'ArrowUp':
      return 'prev';
    case 'Enter':
    case ' ':
    case 'Spacebar':
      return 'select';
    case 'Escape':
    case 'Esc':
      return 'cancel';
    default:
      return null;
  }
}

/** What selecting an icon means now. The screen turns intents into sim actions and routes. */
export type MonSpaceIntent =
  | { readonly kind: 'meal' }
  | { readonly kind: 'snack' }
  | { readonly kind: 'peek' }
  | { readonly kind: 'lights-off'; readonly alsoRest: boolean }
  | { readonly kind: 'lights-on' }
  | { readonly kind: 'clean' }
  | { readonly kind: 'medicine' }
  | { readonly kind: 'boundary' }
  | { readonly kind: 'status' }
  | { readonly kind: 'confirm-pause' }
  | { readonly kind: 'resume' }
  | { readonly kind: 'explain'; readonly copy: CompanionCopyId };

type ViewBits = Pick<MonCareView, 'lights' | 'asleep' | 'paused' | 'poop' | 'cold'>;

/**
 * The intent behind an icon. While paused every icon but Pause explains
 * instead of acting; Clean with no piles explains. Medicine without a cold
 * and Set a boundary without a false call go to the sim, which declines with
 * the reason (no penalty).
 */
export function intentFor(icon: MonSpaceIcon, view: ViewBits): MonSpaceIntent {
  if (icon === 'pause') return view.paused ? { kind: 'resume' } : { kind: 'confirm-pause' };
  if (view.paused) return { kind: 'explain', copy: 'monspace.decline.paused' };
  switch (icon) {
    case 'meal':
      return { kind: 'meal' };
    case 'snack':
      return { kind: 'snack' };
    case 'play':
      return view.asleep ? { kind: 'explain', copy: 'monspace.decline.asleep' } : { kind: 'peek' };
    case 'lights':
      return view.lights === 'on' ? { kind: 'lights-off', alsoRest: !view.asleep } : { kind: 'lights-on' };
    case 'clean':
      return view.poop === 0 ? { kind: 'explain', copy: 'monspace.decline.nothing_to_clean' } : { kind: 'clean' };
    case 'medicine':
      return { kind: 'medicine' };
    case 'boundary':
      return { kind: 'boundary' };
    case 'status':
      return { kind: 'status' };
    default:
      return assertNever(icon);
  }
}

/** Greyed out (still focusable, still answers with its reason): every icon but Pause while paused, Clean with no piles. */
export function iconDisabled(icon: MonSpaceIcon, view: ViewBits): boolean {
  if (icon === 'pause') return false;
  if (view.paused) return true;
  return icon === 'clean' && view.poop === 0;
}

/** Label and hint keys for an icon (Pause reads Resume while paused; Lights flips). */
export function iconCopy(icon: MonSpaceIcon, view: Pick<MonCareView, 'paused' | 'lights'>): { readonly label: CompanionCopyId; readonly hint: CompanionCopyId } {
  switch (icon) {
    case 'meal':
      return { label: 'monspace.menu.meal', hint: 'monspace.menu.meal.hint' };
    case 'snack':
      return { label: 'monspace.menu.snack', hint: 'monspace.menu.snack.hint' };
    case 'play':
      return { label: 'monspace.menu.play', hint: 'monspace.menu.play.hint' };
    case 'lights':
      return { label: view.lights === 'on' ? 'monspace.menu.lights_off' : 'monspace.menu.lights_on', hint: 'monspace.menu.lights.hint' };
    case 'clean':
      return { label: 'monspace.menu.clean', hint: 'monspace.menu.clean.hint' };
    case 'medicine':
      return { label: 'monspace.menu.medicine', hint: 'monspace.menu.medicine.hint' };
    case 'boundary':
      return { label: 'monspace.menu.boundary', hint: 'monspace.menu.boundary.hint' };
    case 'status':
      return { label: 'monspace.menu.status', hint: 'monspace.menu.status.hint' };
    case 'pause':
      return { label: view.paused ? 'monspace.menu.resume' : 'monspace.menu.pause', hint: 'monspace.menu.pause.hint' };
    default:
      return assertNever(icon);
  }
}

/** The attention lamp (MemoryLcd `led`): dark while paused; a false call lights it like a real one. */
export function lampFor(view: Pick<MonCareView, 'attention' | 'paused'>): 'off' | 'call' | 'false-call' {
  if (view.paused) return 'off';
  return view.attention === 'none' ? 'off' : view.attention;
}

export function lampCopy(lamp: 'off' | 'call' | 'false-call'): CompanionCopyId {
  if (lamp === 'call') return 'monspace.a11y.lamp.call';
  if (lamp === 'false-call') return 'monspace.a11y.lamp.false_call';
  return 'monspace.a11y.lamp.off';
}

const CALL_COPY: Record<CallKind, CompanionCopyId> = {
  hunger: 'monspace.call.hunger',
  energy: 'monspace.call.energy',
  social: 'monspace.call.social',
  cold: 'monspace.call.cold',
  bedtime: 'monspace.call.bedtime',
  'false-call': 'monspace.call.false_call',
};

export function callCopy(kind: CallKind): CompanionCopyId {
  return CALL_COPY[kind] ?? 'monspace.call.false_call';
}

/** A copy key and its tokens (filled by the screen with `companionCopy`). */
export interface Line {
  readonly copy: CompanionCopyId;
  readonly tokens?: Record<string, string | number>;
}

/** The one status line (02-handoff "States"). A call outranks everything but pause. */
export function statusLine(view: MonCareView): Line {
  if (view.paused) return { copy: 'monspace.status.paused' };
  if (view.call !== null) return { copy: callCopy(view.call.kind) };
  if (view.asleep && view.lights === 'off') return { copy: 'monspace.status.lights_out' };
  if (view.cold !== null) return { copy: 'monspace.status.cold' };
  if (view.asleep) return { copy: 'monspace.status.asleep' };
  return { copy: 'monspace.status.content' };
}

/** Poop piles in words (0 → none). */
export function poopLine(piles: number): Line | null {
  if (piles <= 0) return null;
  return piles === 1 ? { copy: 'monspace.status.poop.one' } : { copy: 'monspace.status.poop.many', tokens: { count: piles } };
}

export function dosesLine(cold: MonCareView['cold']): Line | null {
  if (cold === null) return null;
  return cold.dosesRemaining === 1
    ? { copy: 'monspace.status.cold.doses.one' }
    : { copy: 'monspace.status.cold.doses.many', tokens: { count: cold.dosesRemaining } };
}

export function ageLine(days: number): Line {
  return days === 1 ? { copy: 'monspace.status.age.one' } : { copy: 'monspace.status.age.many', tokens: { days } };
}

/** The call that is new since the previous view, if any (announce once, buzz once). */
export function newCall(prev: MonCareView['call'] | undefined, next: MonCareView['call']): MonCareView['call'] {
  if (next === null) return null;
  if (prev != null && prev.kind === next.kind && prev.openedAt === next.openedAt) return null;
  return next;
}

/** What the Caller reads, hears and feels after an action: one line, a cue and a haptic. */
export interface Feedback extends Line {
  readonly cue: 'select' | 'cancel' | 'flush' | 'dose' | null;
  readonly haptic: 'success' | 'tap' | 'flush' | null;
}

export function feedbackFor(outcome: MonCareOutcome, intent: MonSpaceIntent): Feedback {
  switch (outcome.kind) {
    case 'eaten':
      return { copy: intent.kind === 'snack' ? 'monspace.result.snack' : 'monspace.result.meal', cue: 'select', haptic: 'success' };
    case 'overfed':
      return { copy: 'monspace.result.overfed', cue: 'select', haptic: 'tap' };
    case 'played':
      return { copy: 'monspace.result.play', cue: 'select', haptic: 'success' };
    case 'fell-asleep':
      return { copy: 'monspace.result.lights_off', cue: 'select', haptic: 'tap' };
    case 'woke':
      return { copy: 'monspace.result.woke', cue: 'select', haptic: 'tap' };
    case 'cleaned':
      return { copy: 'monspace.result.clean', cue: 'flush', haptic: 'flush' };
    case 'dosed':
      return outcome.remaining === 1
        ? { copy: 'monspace.result.dose.one', cue: 'dose', haptic: 'success' }
        : { copy: 'monspace.result.dose.many', tokens: { count: outcome.remaining }, cue: 'dose', haptic: 'success' };
    case 'cured':
      return { copy: 'monspace.result.cured', cue: 'dose', haptic: 'success' };
    case 'disciplined':
      return { copy: 'monspace.result.boundary', cue: 'select', haptic: 'success' };
    case 'nothing-to-discipline':
      return { copy: 'monspace.decline.no_false_call', cue: 'cancel', haptic: null };
    case 'lights':
      return { copy: outcome.on ? 'monspace.result.lights_on' : 'monspace.result.lights_off', cue: 'select', haptic: 'tap' };
    case 'paused':
      return { copy: 'monspace.result.paused', cue: 'select', haptic: 'tap' };
    case 'resumed':
      return { copy: 'monspace.result.resumed', cue: 'select', haptic: 'tap' };
    case 'declined':
      return { copy: declinedCopy(outcome.reason), cue: 'cancel', haptic: null };
    default:
      return { copy: 'monspace.decline.other', cue: 'cancel', haptic: null };
  }
}

function declinedCopy(reason: string): CompanionCopyId {
  switch (reason) {
    case 'paused':
      return 'monspace.decline.paused';
    case 'has-cold':
      return 'monspace.decline.cold';
    case 'no-cold':
      return 'monspace.decline.no_cold';
    case 'asleep':
      return 'monspace.decline.asleep';
    case 'sluggish':
      return 'monspace.decline.sluggish';
    case 'too-tired':
      return 'monspace.decline.tired';
    case 'false-call':
      return 'monspace.decline.no_false_call';
    default:
      return 'monspace.decline.other';
  }
}

/** The LCD field around the Mon. */
export interface LcdField {
  readonly inverted: boolean;
  readonly piles: number;
  readonly cold: boolean;
  readonly asleep: boolean;
  readonly callGlyph: boolean;
}

export function lcdField(view: MonCareView): LcdField {
  return {
    inverted: view.lights === 'off',
    piles: Math.max(0, Math.min(4, view.poop)),
    cold: view.cold !== null,
    asleep: view.asleep,
    callGlyph: view.call !== null && !view.paused,
  };
}

function assertNever(x: never): never {
  throw new Error(`unexpected ${String(x)}`);
}
