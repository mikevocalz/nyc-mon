'use client';

import { neon } from '@acme/theme';
import type { GridSceneProps } from './GridScene.types';
import { View } from '../tw';
import { SkiaWebGate } from './SkiaWebGate';

const loadGridScene = () => import('./GridScene.skia');

export function GridScene(props: GridSceneProps) {
  return (
    <SkiaWebGate
      load={loadGridScene}
      props={props}
      fallback={
        <View
          className={`flex-1 ${props.className ?? ''}`}
          // Caller colour prop (backgroundColor), not a theme token, so it can't be a class.
          style={{ backgroundColor: props.backgroundColor ?? neon.bg }}
        >
          {props.children}
        </View>
      }
    />
  );
}
