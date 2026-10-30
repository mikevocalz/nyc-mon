import type { ReactNode } from 'react';
import type { View } from './tw';
import type { ControlTone, District } from './district';

export type DropAsset = {
  uri?: string;
  type: string;
  base64?: string;
  path?: string;
  file?: File;
  height?: number;
  width?: number;
  fileName?: string;
  text?: string;
  release?: () => void;
};

export type Assets = { assets: DropAsset[] };

export interface DropZoneProps extends Omit<React.ComponentProps<typeof View>, 'children'> {
  children?: ReactNode;
  onDrop?: (event: Assets) => void;
  onDropListeningStart?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onEnter?: () => void;
  onExit?: () => void;
  includeBase64?: boolean;
  disableObjectUrl?: boolean;
  allowedMimeTypes?: (string | RegExp)[];
  draggableSources?: {
    type: 'text' | 'image' | 'video' | 'file';
    value: string;
  }[];
  className?: string;
  active?: boolean;
  title?: string;
  description?: string;
  glyph?: ReactNode;
  /** Colour family of the dashed border, glyph tile and drag glow. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default Midtown (orange). */
  district?: District;
  /**
   * Web: shows a button that opens the system file picker, the keyboard and
   * pointer path for people who can't drag (WCAG 2.5.7). Picked files arrive
   * through `onDrop` like dropped ones. Native ignores it.
   */
  browseLabel?: string;
  /** Web: the picker's `accept` filter, e.g. ".glb". */
  accept?: string;
}
