'use client';

import type { ComponentType } from 'react';
import { View } from '@acme/ui/tw';
import { Viro3DSceneNavigator } from './viro';
import { DistrictScene } from './DistrictScene';

type WebNavigatorProps = {
  initialScene: { scene: ComponentType<any> };
  webRendererOptions: { assetBaseUrl: string };
  showReticle?: boolean;
  style?: Record<string, unknown>;
};

const WebViro3DSceneNavigator =
  Viro3DSceneNavigator as unknown as ComponentType<WebNavigatorProps>;

/** Viro Web Renderer preview of the same DistrictScene the headsets run. */
export function SpatialViroExperience() {
  return (
    <View className="relative flex-1">
      <WebViro3DSceneNavigator
        initialScene={{ scene: DistrictScene }}
        webRendererOptions={{ assetBaseUrl: '/viro/wasm/' }}
        // The mouse aims on web; the headset's centre gaze dot only covers
        // the street. False is the fork's web default, stated here on purpose.
        showReticle={false}
        // Navigator host props are a style object, not a className target.
        style={{ flex: 1 }}
      />
    </View>
  );
}
