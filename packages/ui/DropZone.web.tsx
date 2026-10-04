'use client';

import { useRef } from 'react';
import { DropSurface } from './html/dom.web';
import { View } from './tw';
import { CloudUpload } from './icons';
import { Text } from './Text';
import { dropZone } from './DropZone.styles';
import { resolveControlTone } from './district';
import type { Assets, DropAsset, DropZoneProps } from './DropZone.types';

export type { Assets, DropAsset };


function accepts(type: string, allowed?: (string | RegExp)[]) {
  if (allowed === undefined) return true;
  if (allowed.length === 0) return false;
  return allowed.some((rule) => {
    if (typeof rule === 'string') return rule === type;
    rule.lastIndex = 0;
    return rule.test(type);
  });
}

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read dropped file'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

async function fileToAsset(
  file: File,
  includeBase64: boolean,
  disableObjectUrl: boolean,
): Promise<DropAsset> {
  const uri = disableObjectUrl ? undefined : URL.createObjectURL(file);
  return {
    uri,
    type: file.type || 'application/octet-stream',
    file,
    fileName: file.name,
    base64: includeBase64 ? await toBase64(file) : undefined,
    release: uri ? () => URL.revokeObjectURL(uri) : undefined,
  };
}

/**
 * Web-native drop zone.
 *
 * The published expo-drag-drop-content-view 0.9.2 web bundle contains JSX in a
 * .js file, which Vite 8/Rolldown intentionally parses as JavaScript. Keeping
 * that package native-only avoids a bundler exception while preserving the
 * public payload contract on web.
 */
export function DropZone({
  className,
  active,
  title = 'Drag and drop a file here',
  description = 'Or browse from your device. Images, documents and audio.',
  glyph,
  children,
  tone,
  district,
  onDrop,
  onEnter,
  onExit,
  onDragStart,
  onDragEnd,
  includeBase64 = false,
  disableObjectUrl = false,
  allowedMimeTypes,
  draggableSources,
  style,
  ...rest
}: DropZoneProps) {
  const s = dropZone({ active, tone: resolveControlTone(tone, district) });
  const dragDepth = useRef(0);

  return (
    <DropSurface
      // DropSurface is a plain DOM box, so it needs the flex column RN views get by default.
      className={s.root({ className: `flex flex-col ${className ?? ''}` })}
      style={style as never}
      draggable={Boolean(draggableSources?.length)}
      onDragStart={(event) => {
        onDragStart?.();
        for (const source of draggableSources ?? []) {
          const mime =
            source.type === 'text'
              ? 'text/plain'
              : source.type === 'image'
                ? 'text/uri-list'
                : source.type === 'video'
                  ? 'text/uri-list'
                  : 'text/uri-list';
          event.dataTransfer.setData(mime, source.value);
        }
      }}
      onDragEnd={() => onDragEnd?.()}
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepth.current += 1;
        if (dragDepth.current === 1) onEnter?.();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) onExit?.();
      }}
      onDrop={async (event) => {
        event.preventDefault();
        dragDepth.current = 0;
        onExit?.();

        const files = Array.from(event.dataTransfer.files).filter((file) =>
          accepts(file.type || 'application/octet-stream', allowedMimeTypes),
        );
        const assets = await Promise.all(
          files.map((file) => fileToAsset(file, includeBase64, disableObjectUrl)),
        );

        if (assets.length === 0) {
          const text = event.dataTransfer.getData('text/plain');
          if (text && accepts('text', allowedMimeTypes)) {
            assets.push({ type: 'text', text });
          }
        }

        onDrop?.({ assets });
      }}
      {...(rest as Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>)}
    >
      {children ?? (
        <>
          <View aria-hidden className={s.tile()}>
            {typeof glyph === 'string' || typeof glyph === 'number' ? (
              <Text className="text-2xl">{glyph}</Text>
            ) : (
              glyph ?? <CloudUpload size={28} strokeWidth={2.5} className={s.glyph()} />
            )}
          </View>
          <Text className={s.title()}>{title}</Text>
          <Text className={s.description()}>{description}</Text>
        </>
      )}
    </DropSurface>
  );
}
