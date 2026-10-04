'use client';
import type { ReactNode } from 'react';
import { createStore } from 'zustand/vanilla';
import { Button } from './Button';
import { Dialog, type DialogCardProps } from './Dialog';
import { useStore } from './use-instance-store';

/** The sonner toaster that hosts modals, apart from the toast stack. */
export const MODAL_TOASTER_ID = 'nyc-modal';

/** How long the fade-out runs before sonner drops the entry, ms. */
export const MODAL_EXIT_MS = 220;

export interface NotifyModalAction {
  label: string;
  /** Runs before the modal closes. Return `false` to keep it open. */
  onPress?: () => void | boolean;
  /** Kit Button look. The last action defaults to primary, the rest to ghost. */
  variant?: 'primary' | 'accent' | 'outline' | 'ghost' | 'danger' | 'cornerCut';
}

export interface NotifyModalOptions
  extends Pick<
    DialogCardProps,
    | 'district' | 'color' | 'size' | 'animation' | 'glow' | 'footerAlign' | 'label' | 'dividers' | 'borderBeam' | 'beamSpeed'
    | 'scrollableBody' | 'beamLength' | 'glowIntensity' | 'bgColor' | 'header' | 'ariaLabel'
  > {
  title: string;
  description?: string;
  /** Anything under the description: a form, a list, an image. */
  body?: ReactNode;
  /** Buttons on the stoop. Each closes the modal after its onPress. */
  actions?: NotifyModalAction[];
  /** neon: the building facade. default: the kit dialog. Default neon. */
  variant?: 'default' | 'neon';
  /** Reuse an id to replace an open modal in place. */
  id?: string | number;
  /** Called once the modal has closed, however it was closed. */
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  backdropOverlay?: boolean;
  backdropBlur?: boolean;
}

// Which modals are fading out. Module-level vanilla zustand store, shared by
// every modal the toaster hosts; not React state.
const closing = createStore<{ ids: ReadonlySet<string | number> }>(() => ({ ids: new Set() }));

export function markClosing(id: string | number) {
  const ids = new Set(closing.getState().ids);
  ids.add(id);
  closing.setState({ ids });
}

export function clearClosing(id: string | number) {
  if (!closing.getState().ids.has(id)) return;
  const ids = new Set(closing.getState().ids);
  ids.delete(id);
  closing.setState({ ids });
}

/**
 * The body of a modal toast. sonner (web) and sonner-native own the queue,
 * ids, replacement and dismissal; this renders the kit Dialog, whose Modal
 * portals out of the toast stack to the centre of the screen with a scrim,
 * a focus trap and Escape/back handling.
 */
export function NotifyModal({
  id, options, requestClose,
}: { id: string | number; options: NotifyModalOptions; requestClose: () => void }) {
  const isClosing = useStore(closing, (s) => s.ids.has(id));
  const {
    title, description, body, actions, variant = 'neon',
    closeOnBackdrop, closeOnEscape, showCloseButton, backdropOverlay, backdropBlur, onClose: _onClose, id: _id,
    ...card
  } = options;
  const last = (actions?.length ?? 0) - 1;
  return (
    <Dialog
      {...card}
      open={!isClosing}
      onClose={requestClose}
      variant={variant}
      title={title}
      description={description}
      closeOnBackdrop={closeOnBackdrop}
      closeOnEscape={closeOnEscape}
      showCloseButton={showCloseButton}
      backdropOverlay={backdropOverlay}
      backdropBlur={backdropBlur}
      actions={
        actions?.length ? (
          <>
            {actions.map((a, i) => (
              <Button
                key={`${a.label}-${i}`}
                title={a.label}
                variant={a.variant ?? (i === last ? (variant === 'neon' ? 'cornerCut' : 'primary') : 'ghost')}
                // Only the cornerCut look reads the district.
                district={card.district}
                onPress={() => {
                  if (a.onPress?.() === false) return;
                  requestClose();
                }}
              />
            ))}
          </>
        ) : undefined
      }
    >
      {body}
    </Dialog>
  );
}
