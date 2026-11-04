import type { NativeDropdownGroup, NativeDropdownOption } from './NativeDropdown.types.ts';

export type DropdownSelection = Readonly<{
  options: readonly NativeDropdownOption[];
  selected: NativeDropdownOption | null;
  groups: readonly NativeDropdownGroup[];
}>;

/** Treat malformed native menu trees as errors, rather than allowing ghost selections. */
export function prepareNativeDropdown(groups: readonly NativeDropdownGroup[], value: string): DropdownSelection {
  if (!Array.isArray(groups) || !groups.length) throw new RangeError('Dropdown requires a group');
  const ids = new Set<string>();
  const optionIds = new Set<string>();
  const options: NativeDropdownOption[] = [];
  for (const group of groups) {
    if (!group.id?.trim() || ids.has(group.id)) throw new RangeError('Duplicate or empty dropdown group');
    ids.add(group.id);
    if (!Array.isArray(group.options) || !group.options.length) throw new RangeError('Dropdown group must have choices');
    for (const item of group.options) {
      if (!item.value?.trim() || !item.label?.trim() || optionIds.has(item.value))
        throw new RangeError('Duplicate or invalid dropdown option');
      optionIds.add(item.value);
      options.push(item);
    }
  }
  return { groups, options, selected: options.find(o => o.value === value) ?? null };
}

/** Exactly one selection callback for a genuine enabled value change. */
export function selectNativeDropdown(
  model: DropdownSelection,
  current: string,
  next: string,
  onValueChange: (value: string) => void,
): boolean {
  const option = model.options.find(item => item.value === next);
  if (!option || option.disabled || current === next) return false;
  onValueChange(next);
  return true;
}
