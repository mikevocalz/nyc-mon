import { tv } from 'tailwind-variants';
import { Children, isValidElement, type ReactNode } from 'react';
import { NEON_FIELD, neonErrorVariant, neonFieldCompounds, neonLabelCompounds } from './cards/neon-field';
import { toneVariants } from './district';
import type { SelectOption } from './Select.types';

/** The Select field: nameplate label, night well, kit chevron. Shared by both forks. */
export const selectField = tv({
  slots: {
    root: NEON_FIELD.root,
    label: NEON_FIELD.label,
    select: `${NEON_FIELD.input} cursor-pointer appearance-none pr-14`,
    chevron: 'absolute right-2 top-1/2 -translate-y-1/2',
    message: NEON_FIELD.message,
  },
  variants: {
    error: { true: neonErrorVariant('select'), false: {} },
    disabled: { true: { select: NEON_FIELD.disabled } },
    tone: toneVariants(() => ({})),
  },
  compoundVariants: [...neonFieldCompounds('select'), ...neonLabelCompounds()],
  defaultVariants: { error: false },
});

/** Options from data plus `<option>` children, in render order. */
export function collectOptions(options: SelectOption[] | undefined, children: ReactNode): SelectOption[] {
  const fromChildren = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string; children?: ReactNode; disabled?: boolean }>(child)) return [];
    const { value, children: text, disabled } = child.props;
    if (typeof value !== 'string') return [];
    return [{ value, label: typeof text === 'string' ? text : value, disabled }];
  });
  return [...(options ?? []), ...fromChildren];
}
