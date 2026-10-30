import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

// The kit renders through react-native-web, which this node run does not load.
// Stand-ins keep the element tree, so the test reads the props the composer wires.
vi.mock('@acme/ui', () => ({ TextField: function TextField() { return null; }, Button: function Button() { return null; } }));
vi.mock('@acme/ui/tw', () => ({ View: function View() { return null; }, Text: function Text() { return null; } }));
vi.mock('@acme/ui/icons', () => ({ ArrowUp: function ArrowUp() { return null; } }));

const { Composer } = await import('../src/client/CompanionComposer.tsx');

type El = ReactElement<Record<string, unknown> & { children?: ReactNode }>;
function find(node: ReactNode, name: string): El | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const n of node) { const hit = find(n, name); if (hit) return hit; } return null; }
  const el = node as El;
  if (typeof el.type === 'function' && el.type.name === name) return el;
  return find(el.props?.children, name);
}

describe('Ask your Mon', () => {
  it('sends on Enter (the field’s submit), the same as the Send button', () => {
    const onSend = vi.fn();
    const tree = Composer({ question: 'you hungry?', busy: false, onChange: () => {}, onSend });
    const field = find(tree, 'TextField');
    expect(field?.props.returnKeyType).toBe('send');
    (field?.props.onSubmitEditing as () => void)();
    expect(onSend).toHaveBeenCalledWith('you hungry?');
    (find(tree, 'Button')?.props.onPress as () => void)();
    expect(onSend).toHaveBeenCalledTimes(2);
  });

  it('aligns Send to the input’s edge, not the top of the labelled field', () => {
    const tree = Composer({ question: '', busy: false, onChange: () => {}, onSend: () => {} });
    // The kit Button's own root is self-start; without this override it wins
    // over the row's items-end and the button floats at the label's height.
    expect(String(find(tree, 'Button')?.props.className)).toContain('self-end');
  });

  it('does not send a blank question or while a turn is running', () => {
    const onSend = vi.fn();
    (find(Composer({ question: '  ', busy: false, onChange: () => {}, onSend }), 'TextField')?.props.onSubmitEditing as () => void)();
    (find(Composer({ question: 'hi', busy: true, onChange: () => {}, onSend }), 'TextField')?.props.onSubmitEditing as () => void)();
    expect(onSend).not.toHaveBeenCalled();
  });
});
