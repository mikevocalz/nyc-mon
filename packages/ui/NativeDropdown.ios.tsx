'use client';
import { Host, Menu, Section, Button } from '@expo/ui/swift-ui';
import { disabled as swiftDisabled } from '@expo/ui/swift-ui/modifiers';
import { haptics } from './haptics';
import { prepareNativeDropdown, selectNativeDropdown } from './NativeDropdown.model';
import type { NativeDropdownProps } from './NativeDropdown.types';

/**
 * SwiftUI's genuine Menu and Section, rather than imitating Android's
 * Expressive rounded group artwork. Same option/selection contract on iOS.
 */
export function NativeDropdown({
  label, value, groups, onValueChange, disabled = false,
}: NativeDropdownProps) {
  const model = prepareNativeDropdown(groups, value);
  const pick = (next: string) => {
    if (disabled) return;
    if (selectNativeDropdown(model, value, next, onValueChange)) haptics.selection();
  };
  return (
    <Host matchContents>
      <Menu
        label={label + ': ' + (model.selected?.label ?? 'Choose')}
        modifiers={disabled ? [swiftDisabled(true)] : []}
      >
        {model.groups.map(group => (
          <Section key={group.id} title={group.label}>
            {group.options.map(option => (
              <Button
                key={option.value}
                label={option.label}
                systemImage={option.value === value ? 'checkmark' : undefined}
                modifiers={option.disabled ? [swiftDisabled(true)] : []}
                onPress={() => pick(option.value)}
              />
            ))}
          </Section>
        ))}
      </Menu>
    </Host>
  );
}
