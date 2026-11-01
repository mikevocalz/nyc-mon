import { create } from 'zustand';
import type { MonInstance } from '@acme/core/types';
import { companionCopy } from './copy.ts';

/**
 * Decision #18: a merged account keeps both starters, and Home asks which
 * one is active. The question opens once per app session when the save has
 * more than one Mon; after any answer (a pick, Close, Back) it stays shut
 * until the Caller opens it from the Menu key. Nothing here deletes,
 * releases or hides a Mon (Laws 6 and 8): every Mon stays a choice.
 */

/** One Mon as the chooser lists it. */
export interface ChooserOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Every Mon in the save, in save order. `nameOf` is Home's own naming
 * (`monIdentity(mon).name`: nickname, else form name), passed in so this
 * module stays free of the art bundle.
 */
export function chooserOptions(mons: readonly MonInstance[], nameOf: (mon: MonInstance) => string): ChooserOption[] {
  return mons.map((mon) => ({ value: mon.monInstanceId, label: nameOf(mon) }));
}

/** Whether Home has anything to choose between. With one Mon the chooser never shows. */
export function canChooseMon(monCount: number): boolean {
  return monCount > 1;
}

/** Whether Home opens the question by itself: more than one Mon and no answer yet this session. */
export function shouldAskOnOpen(monCount: number, answeredThisSession: boolean): boolean {
  return canChooseMon(monCount) && !answeredThisSession;
}

/** Glass action target for a Mon in the chooser. */
export const CHOOSE_PREFIX = 'choose:';
export const CHOOSE_MORE = 'choose-more';
export const CHOOSE_CLOSE = 'close';

/** The Mon id a chooser target names, or null for More / Close / anything else. */
export function chosenFromTarget(target: string): string | null {
  return target.startsWith(CHOOSE_PREFIX) ? target.slice(CHOOSE_PREFIX.length) : null;
}

/** One glass action in the chooser (the glass's own GlassAction shape). */
export interface ChooserAction {
  readonly target: string;
  readonly label: string;
  readonly tone: 'primary' | 'secondary' | 'selected';
}

/**
 * The chooser as glass buttons, `slots` per screen (the glass row holds 4).
 * Close is always last and always visible. When every Mon fits beside Close
 * they all show; otherwise each page shows `slots - 2` Mons plus More, which
 * steps through the pages and wraps. The active Mon reads as selected.
 */
export function chooserActions(options: readonly ChooserOption[], activeId: string | undefined, page: number, slots = 4): ChooserAction[] {
  const close: ChooserAction = { target: CHOOSE_CLOSE, label: companionCopy('m14.close'), tone: 'secondary' };
  const mon = (o: ChooserOption): ChooserAction => ({
    target: `${CHOOSE_PREFIX}${o.value}`, label: o.label, tone: o.value === activeId ? 'selected' : 'primary',
  });
  if (options.length <= slots - 1) return [...options.map(mon), close];
  const per = Math.max(1, slots - 2);
  const pages = chooserPages(options.length, slots);
  const at = ((page % pages) + pages) % pages;
  return [
    ...options.slice(at * per, at * per + per).map(mon),
    { target: CHOOSE_MORE, label: companionCopy('m13.choose.more'), tone: 'secondary' },
    close,
  ];
}

/** How many pages the glass chooser has. */
export function chooserPages(count: number, slots = 4): number {
  if (count <= slots - 1) return 1;
  return Math.ceil(count / Math.max(1, slots - 2));
}

interface ChoiceState {
  /** The Caller answered the question this session (picked, closed or went back). Not persisted: a new session asks again. */
  readonly answered: boolean;
  readonly open: boolean;
  /** The glass chooser's page (More). */
  readonly page: number;
}

/** Session state of the Decision #18 question, shared by the glass, the 2D sheet and the tablet pane. */
export const useActiveMonChoice = create<ChoiceState>()(() => ({ answered: false, open: false, page: 0 }));

export function openMonChooser(): void {
  useActiveMonChoice.setState({ open: true, page: 0 });
}

/** Any answer closes the question for the session; the active Mon stays as it is unless one was picked. */
export function closeMonChooser(): void {
  useActiveMonChoice.setState({ open: false, answered: true, page: 0 });
}

export function nextChooserPage(count: number): void {
  const pages = chooserPages(count);
  useActiveMonChoice.setState((s) => ({ page: (s.page + 1) % pages }));
}
