// Which DOM key events the web keyboard adapter forwards, pure so node tests
// cover it without a DOM (finding M6). Rules:
// - Auto-repeat and events with no `code` are dropped.
// - A key down inside an editable target (input, textarea, select, or a
//   contenteditable element) is dropped: typing a name must not drive the game.
// - A key down with Ctrl, Meta or Alt held is dropped: browser and OS chords
//   (Cmd+K, Ctrl+L, Alt+arrows) keep their meaning. Shift is allowed.
// - Only mapped codes are forwarded, and those get `preventDefault` so arrows
//   and Space do not scroll the page. Shift is forwarded too (it turns a held
//   direction into a run) but keeps its default: Shift+click and text
//   selection still work.
// - A key up is forwarded whenever its down was, whatever the target or
//   modifiers are by then, so a key can never stay held in the adapter.
import { isKeyboardRunKey, isMappedKeyCode } from './keyboard-mapping.ts';

/** The fields of a `KeyboardEvent` the filter reads. */
export interface KeyEventLike {
  readonly type: string;
  readonly code: string;
  readonly repeat: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  /** True when the event's target accepts text; see {@linkcode isEditableTarget}. */
  readonly editableTarget: boolean;
}

/** What to do with one event. */
export interface KeyDecision {
  readonly forward: boolean;
  readonly preventDefault: boolean;
}

/** The structural slice of an `EventTarget` the editable check reads. */
export interface TargetLike {
  readonly tagName?: string;
  readonly isContentEditable?: boolean;
}

/** True for text inputs, textareas, selects and contenteditable elements. */
export function isEditableTarget(target: TargetLike | null | undefined): boolean {
  if (!target) return false;
  if (target.isContentEditable === true) return true;
  const tag = target.tagName?.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** A stateful filter: it remembers which downs it forwarded so their ups always follow. */
export interface KeyEventFilter {
  decide(event: KeyEventLike): KeyDecision;
  /** Forgets forwarded downs (focus loss already released them upstream). */
  reset(): void;
}

const DROP: KeyDecision = { forward: false, preventDefault: false };

export function createKeyEventFilter(): KeyEventFilter {
  const down = new Set<string>();
  return {
    decide(event) {
      if (event.repeat || event.code === '') return DROP;
      if (event.type === 'keyup') {
        if (!down.delete(event.code)) return DROP;
        return { forward: true, preventDefault: !event.editableTarget && !isKeyboardRunKey(event.code) };
      }
      if (event.type !== 'keydown') return DROP;
      if (event.editableTarget || event.ctrlKey || event.metaKey || event.altKey) return DROP;
      if (isKeyboardRunKey(event.code)) {
        down.add(event.code);
        return { forward: true, preventDefault: false };
      }
      if (!isMappedKeyCode(event.code)) return DROP;
      down.add(event.code);
      return { forward: true, preventDefault: true };
    },
    reset() {
      down.clear();
    },
  };
}
