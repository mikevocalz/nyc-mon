'use client';
import { useWindowDimensions } from 'react-native';
import { Host, DropdownMenu, RNHostView } from '@expo/ui/jetpack-compose';
import { BottomSheet } from './BottomSheet';
import { PopoverSurface, PopoverTrigger } from './Popover.surface';
import { popoverVessel } from './Popover.geometry';
import { useReservedRegions } from './reserved-regions';
import type { PopoverProps } from './Popover.types';

/**
 * Controlled Jetpack Compose anchored dropdown as a *rich* tool surface.
 * The menu's Items container supports other native views; RNHostView embeds
 * the live React Native instrument. Action-only lists still use @acme/ui/Menu.
 */
export function Popover({
  open, onOpenChange, trigger, children, accessibleLabel, title,
}: PopoverProps) {
  const { width, height } = useWindowDimensions();
  const regions = useReservedRegions();
  const sheet = popoverVessel({ width, height, regions }) === 'sheet';
  const handlePress = () => onOpenChange(!open);
  const contentWidth = Math.max(240, Math.min(344, width - 32));
  const contentHeight = Math.max(200, Math.min(520, height - 96));

  if (sheet) {
    return (
      <>
        <PopoverTrigger label={accessibleLabel} expanded={open} onPress={handlePress}>{trigger}</PopoverTrigger>
        <BottomSheet
          open={open}
          onClose={() => onOpenChange(false)}
          title={title ?? accessibleLabel}
          closeLabel={'Close ' + accessibleLabel}
          scheme="system"
        >
          {children}
        </BottomSheet>
      </>
    );
  }

  return (
    <Host matchContents>
      <DropdownMenu
        expanded={open}
        onDismissRequest={() => onOpenChange(false)}
        cornerRadius={8}
        shadowElevation={4}
      >
        <DropdownMenu.Trigger>
          <RNHostView matchContents>
            <PopoverTrigger label={accessibleLabel} expanded={open} onPress={handlePress}>
              {trigger}
            </PopoverTrigger>
          </RNHostView>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          <RNHostView matchContents>
            <PopoverSurface title={title} width={contentWidth} maxHeight={contentHeight}>
              {children}
            </PopoverSurface>
          </RNHostView>
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}
