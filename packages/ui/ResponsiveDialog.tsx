'use client';
import { useWindowDimensions } from 'react-native';
import { Text, View } from './tw';
import { Dialog, type DialogProps } from './Dialog';
import { BottomSheet } from './BottomSheet';
import { useWindowSizeClass } from './adaptive-panes/use-window-size-class';
import { useReservedRegions } from './reserved-regions';
import type { SheetScheme } from './BottomSheet';

/**
 * One dialog contract, two vessels (04-components.md G9): the kit `Dialog`
 * from the `medium` window class up, the `BottomSheet` at `compact`. On a
 * tabletop fold (a horizontal separating hinge) the desktop dialog pins to
 * the window's foot — the bottom segment — instead of centring across the
 * hinge; a bottom sheet already opens in that segment. On a book fold the
 * dialog stays centred inside its segment because the hinge splits the
 * window, not the overlay.
 *
 * `closeLabel` names the sheet's close control; the dialog's stays "Close".
 */
export interface ResponsiveDialogProps extends Omit<DialogProps, 'position'> {
  /** Sheet scheme on compact: 'system' follows the page (the console), 'night' keeps the facade. Default 'system'. */
  sheetScheme?: SheetScheme;
  /** Accessible name of the sheet's close control. Default "Close". */
  closeLabel?: string;
}

export function ResponsiveDialog({
  open, onClose, sheetScheme = 'system', closeLabel = 'Close', ...dialogProps
}: ResponsiveDialogProps) {
  const sizeClass = useWindowSizeClass();
  const regions = useReservedRegions();
  const { height: windowHeight } = useWindowDimensions();
  // A horizontal separating division = tabletop: the bottom segment is the
  // strip below the hinge, and the dialog belongs inside it.
  const tabletop = regions.some(
    (r) => r.kind === 'division' && r.orientation === 'horizontal' && r.separating !== false,
  );

  if (sizeClass === 'compact') {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        closeLabel={closeLabel}
        title={dialogProps.title}
        scheme={sheetScheme}
      >
        {dialogProps.description ? (
          <Text className="pb-2 text-base leading-snug text-text-muted">{dialogProps.description}</Text>
        ) : null}
        {dialogProps.children}
        {dialogProps.actions ? <View className="mt-4 flex-row flex-wrap items-center justify-end gap-3">{dialogProps.actions}</View> : null}
      </BottomSheet>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      position={tabletop && windowHeight > 0 ? 'bottom' : 'center'}
      {...dialogProps}
    />
  );
}
