'use client';

import { neon } from '@acme/theme';
import type { GridFloorProps } from './GridFloor.types';
import { View } from '../tw';
import { SkiaWebGate } from './SkiaWebGate';

const loadGridFloor = () => import('./GridFloor.skia');

export function GridFloor(props: GridFloorProps) {
  return (
    <SkiaWebGate
      load={loadGridFloor}
      props={props}
      fallback={
        <View
          className={`flex-1 ${props.className ?? ''}`}
          style={{ backgroundColor: props.bgColor ?? props.backgroundColor ?? neon.bg }}
        >
          {props.children}
        </View>
      }
    />
  );
}
