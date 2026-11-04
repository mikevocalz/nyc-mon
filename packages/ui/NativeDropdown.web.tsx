'use client';
import { Popover } from './Popover';
import { Pressable, Text, View } from './tw';
import { useInstanceStore, useStore } from './use-instance-store';
import { prepareNativeDropdown, selectNativeDropdown } from './NativeDropdown.model';
import type { NativeDropdownProps } from './NativeDropdown.types';

/**
 * One web semantic adapter in /ui. The source-owned Popover owns top-layer,
 * focus restoration, Escape, outside dismissal, mobile sheets, and foldables.
 */
export function NativeDropdown({
  label, value, groups, onValueChange, disabled = false, hint,
}: NativeDropdownProps) {
  const model = prepareNativeDropdown(groups, value);
  const store = useInstanceStore(() => ({ open: false }));
  const open = useStore(store, state => state.open);
  const choose = (next: string) => {
    if (disabled) return;
    selectNativeDropdown(model, value, next, onValueChange);
    store.setState({ open: false });
  };
  return (
    <View className="min-w-44">
      <Popover
        open={open && !disabled}
        onOpenChange={next => { if (!disabled) store.setState({ open: next }); }}
        accessibleLabel={label}
        title={label}
        trigger={<View className="min-w-44 flex-row items-center justify-between gap-3 px-3">
          <Text className="text-sm font-semibold text-text">
            {model.selected?.label ?? 'Choose'}
          </Text>
          <Text className="text-xs text-text-muted">⌄</Text>
        </View>}
      >
        <View role={"listbox" as never} className="gap-2">
          {model.groups.map(group => (
            <View key={group.id} className="gap-1 border-b border-border pb-2 last:border-b-0">
              {group.label ? <Text role="heading" className="px-2 py-1 text-xs font-semibold text-text-muted">{group.label}</Text> : null}
              {group.options.map(option => (
                <Pressable
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  disabled={option.disabled}
                  onPress={() => choose(option.value)}
                  className={
                    'min-h-12 rounded-sm border-l-2 px-3 py-2 text-left ' +
                    'transition-colors duration-fast motion-reduce:transition-none ' +
                    (option.disabled ? 'opacity-40 ' : 'hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-primary ') +
                    (option.value === value ? 'border-l-primary bg-surface-sunken' : 'border-l-transparent')
                  }
                >
                  <Text className="text-sm font-semibold text-text">{option.label}</Text>
                  {option.supportingText ? <Text className="text-xs text-text-muted">{option.supportingText}</Text> : null}
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </Popover>
      {hint ? <Text className="pt-1 text-xs text-text-muted">{hint}</Text> : null}
    </View>
  );
}
