'use client';
import { useWindowDimensions } from 'react-native';
import { Host, Popover as SwiftPopover, RNHostView } from '@expo/ui/swift-ui';
import { BottomSheet } from './BottomSheet';
import { PopoverSurface, PopoverTrigger } from './Popover.surface';
import { popoverVessel } from './Popover.geometry';
import { useReservedRegions } from './reserved-regions';
import type { PopoverProps } from './Popover.types';

/**
 * Fully controlled SwiftUI Popover with live RN instrument content.
 * On compact screens and separating hinges we use our canonical native sheet,
 * rather than drawing a fake popup across an occlusion.
 */
export function Popover({
  open, onOpenChange, trigger, children, accessibleLabel, title, placement = 'auto',
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
      <SwiftPopover
        isPresented={open}
        onIsPresentedChange={onOpenChange}
        attachmentAnchor="center"
        arrowEdge={placement === 'above' ? 'bottom' : placement === 'below' ? 'top' : 'none'}
      >
        <SwiftPopover.Trigger>
          <RNHostView matchContents>
            <PopoverTrigger label={accessibleLabel} expanded={open} onPress={handlePress}>
              {trigger}
            </PopoverTrigger>
          </RNHostView>
        </SwiftPopover.Trigger>
        <SwiftPopover.Content>
          <RNHostView matchContents>
            <PopoverSurface title={title} width={contentWidth} maxHeight={contentHeight}>
              {children}
            </PopoverSurface>
          </RNHostView>
        </SwiftPopover.Content>
      </SwiftPopover>
    </Host>
  );
}
