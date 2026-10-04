'use client';
import {
  DragDropContentView,
  type DragDropContentViewProps,
} from 'expo-drag-drop-content-view';
import { css } from './html/css';
import { View } from './tw';
import { CloudUpload } from './icons';
import { Text } from './Text';
import { NightScope } from './NightScope';
import { dropZone } from './DropZone.styles';
import { resolveControlTone } from './district';
import type { DropZoneProps, DropAsset, Assets } from './DropZone.types';

export type { DropAsset, Assets };


const CssDragDrop = css(
  DragDropContentView as React.ComponentType<object>,
  'DragDropContentView',
) as React.FC<DragDropContentViewProps & { className?: string }>;

export function DropZone({
  className,
  active,
  title = 'Drag and drop a file here',
  description = 'Or browse from your device. Images, documents and audio.',
  glyph,
  children,
  tone,
  district,
  ...props
}: DropZoneProps) {
  const s = dropZone({ active, tone: resolveControlTone(tone, district) });
  return (
    <CssDragDrop
      className={s.root({ className })}
      {...(props as DragDropContentViewProps)}
    >
      <NightScope>
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
      </NightScope>
    </CssDragDrop>
  );
}
