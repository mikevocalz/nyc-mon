'use client';
import { Platform } from 'react-native';
import { IconButton } from './IconButton';
import { Copy } from './icons';
import { notify } from './notify';
import type { ControlTone, District } from './district';

export interface CopyButtonProps {
  /** The string placed on the clipboard (an id, never a revealed value's neighbour). */
  value: string;
  /** Spoken label, e.g. "Copy Caller id". */
  label: string;
  /** Colour family. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default midtown (orange). */
  district?: District;
  className?: string;
}

// The clipboard write is a web API behind a capability check; native callers
// get the same failure toast rather than a crash (the console is web).
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Copies `value` and reports through `notify` (04-components.md G7): "Copied"
 * on success, "Couldn't copy. Select the id and copy it." on failure.
 */
export function CopyButton({ value, label, tone, district, className }: CopyButtonProps) {
  return (
    <IconButton
      variant="ghost"
      size="sm"
      icon={<Copy size={16} />}
      aria-label={label}
      tone={tone}
      district={district}
      className={className}
      onPress={() => {
        void writeClipboard(value).then((ok) => {
          if (ok) notify.success('Copied');
          else notify.error("Couldn't copy. Select the id and copy it.");
        });
      }}
    />
  );
}
