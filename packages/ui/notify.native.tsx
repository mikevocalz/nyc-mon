'use client';
// PLATFORM FORK — sonner-native (Reanimated + Gesture Handler).
import { Toaster as SonnerToaster, toast as sonner } from 'sonner-native';
import { ToastCard } from './ToastCard';
import {
  MODAL_EXIT_MS, MODAL_TOASTER_ID, NotifyModal, clearClosing, markClosing,
  type NotifyModalOptions,
} from './notify-modal';
import {
  dismissibleFor, durationFor, nextToastId,
  type NotifyOptions, type NotifyVariant,
} from './notify.shared';

function show(variant: NotifyVariant, title: string, options: NotifyOptions = {}) {
  const id = options.id ?? nextToastId();
  return sonner.custom(
    <ToastCard
      variant={variant}
      title={title}
      description={options.description}
      action={options.action}
      appearance={options.variant}
      district={options.district}
      onDismiss={dismissibleFor(variant, options.dismissible)
        ? () => sonner.dismiss(id)
        : undefined}
    />,
    { id, duration: durationFor(variant, options.duration) },
  );
}

const onCloseById = new Map<string | number, (() => void) | undefined>();

/** Fade the modal out, then drop it from the toaster. Safe to call twice. */
function closeModal(id: string | number) {
  if (!onCloseById.has(id)) return;
  markClosing(id);
  setTimeout(() => {
    sonner.dismiss(id);
    clearClosing(id);
    const done = onCloseById.get(id);
    onCloseById.delete(id);
    done?.();
  }, MODAL_EXIT_MS);
}

/**
 * A centred modal through the same toaster system: sonner keeps the queue and
 * ids on its own toaster (MODAL_TOASTER_ID), the entry renders the kit Dialog.
 * Defaults to the neon facade. Returns the id and a close function.
 */
function modal(options: NotifyModalOptions) {
  const id = options.id ?? nextToastId();
  clearClosing(id);
  onCloseById.set(id, options.onClose);
  sonner.custom(
    <NotifyModal id={id} options={options} requestClose={() => closeModal(id)} />,
    { id, duration: Infinity, dismissible: false, toasterId: MODAL_TOASTER_ID },
  );
  return { id, close: () => closeModal(id) };
}

export const notify = {
  info: (title: string, options?: NotifyOptions) => show('info', title, options),
  success: (title: string, options?: NotifyOptions) => show('success', title, options),
  warning: (title: string, options?: NotifyOptions) => show('warning', title, options),
  error: (title: string, options?: NotifyOptions) => show('error', title, options),
  loading: (title: string, options?: NotifyOptions) => show('loading', title, options),
  dismiss: (id?: string | number) => sonner.dismiss(id),
  /** Open a modal (neon facade by default) through the toaster. */
  modal,
  /** Close a modal opened with `notify.modal`. */
  closeModal,
};

export type { NotifyModalOptions, NotifyModalAction } from './notify-modal';

/**
 * Mount once, at the app root, INSIDE the gesture handler and safe-area
 * providers — sonner-native's swipe-to-dismiss and top offset need both.
 */
export function Toaster() {
  return (
    <>
    <SonnerToaster
      position="top-center"
      offset={12}
      gap={10}
      visibleToasts={3}
      swipeToDismissDirection="up"
      // The card IS the toast. Without this the library's own padded,
      // rounded container sits behind ours and shows as a pale halo.
      toastOptions={{ unstyled: true, style: { backgroundColor: 'transparent' } }}
    />
    {/* Modal host: each entry is a kit Modal (a native modal window), so this
        stack draws nothing of its own. */}
    <SonnerToaster
      id={MODAL_TOASTER_ID}
      position="top-center"
      visibleToasts={10}
      toastOptions={{ unstyled: true, style: { backgroundColor: 'transparent' } }}
    />
    </>
  );
}
