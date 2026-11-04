'use client';
import { Fragment } from 'react';
import { Host, Box, OutlinedButton, DropdownMenuPopup, DropdownMenuGroup,
  SelectableDropdownMenuItem, Spacer, Text as ComposeText } from '@expo/ui/jetpack-compose';
import { height, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { haptics } from './haptics';
import { useInstanceStore, useStore } from './use-instance-store';
import { prepareNativeDropdown, selectNativeDropdown } from './NativeDropdown.model';
import type { NativeDropdownProps } from './NativeDropdown.types';

/**
 * Expo #52598: Material 3 Expressive DropdownMenuPopup is a sibling of the
 * trigger inside Box, NOT a replacement for DropdownMenu or a rich RN Popover.
 * Groups use groupShape and selected items use itemShape automatically.
 */
export function NativeDropdown({
  label, value, groups, onValueChange, disabled = false, testID,
}: NativeDropdownProps) {
  const model = prepareNativeDropdown(groups, value);
  const store = useInstanceStore(() => ({ open: false }));
  const open = useStore(store, state => state.open);
  const close = () => store.setState({ open: false });
  const choose = (next: string) => {
    if (disabled) return;
    if (selectNativeDropdown(model, value, next, onValueChange)) haptics.selection();
    close();
  };
  const show = () => { if (!disabled) store.setState({ open: true }); };

  return (
    <Host matchContents>
      <Box>
        <OutlinedButton
          enabled={!disabled}
          onClick={show}
          testID={testID}
        >
          <ComposeText>{label}: {model.selected?.label ?? 'Choose'}</ComposeText>
        </OutlinedButton>
        <DropdownMenuPopup expanded={open && !disabled} onDismissRequest={close}>
          {model.groups.map((group, groupIndex) => (
            <Fragment key={group.id}>
              {groupIndex > 0 ? <Spacer modifiers={[height(2)]} /> : null}
              <DropdownMenuGroup
                shapes={{ index: groupIndex, count: model.groups.length }}
              >
                {group.label ? <ComposeText modifiers={[paddingAll(8)]}>{group.label}</ComposeText> : null}
                {group.options.map((option, optionIndex) => (
                  <SelectableDropdownMenuItem
                    key={option.value}
                    selected={option.value === value}
                    enabled={!option.disabled}
                    shapes={{ index: optionIndex, count: group.options.length }}
                    onClick={() => choose(option.value)}
                  >
                    <SelectableDropdownMenuItem.Text>
                      <ComposeText>{option.label}</ComposeText>
                    </SelectableDropdownMenuItem.Text>
                    {option.supportingText ? (
                      <SelectableDropdownMenuItem.SupportingText>
                        <ComposeText>{option.supportingText}</ComposeText>
                      </SelectableDropdownMenuItem.SupportingText>
                    ) : null}
                  </SelectableDropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </Fragment>
          ))}
        </DropdownMenuPopup>
      </Box>
    </Host>
  );
}
