'use client';

import type { ComponentType } from 'react';
import { palette } from '@acme/theme';
import { View } from '@acme/ui/tw';
import {
  Viro3DObject,
  Viro3DSceneNavigator,
  ViroAmbientLight,
  ViroDirectionalLight,
  ViroOrbitCamera,
  ViroScene,
} from './viro';

type Vec3 = [number, number, number];

export type MonModelViewerProps = {
  /** GLB URL: the Bunny CDN copy, or a blob: URL for a file not saved yet. */
  url: string;
  scale: number;
  position: Vec3;
  rotation: Vec3;
  /** Extra turn on Y for looking around the model, in degrees. */
  yaw?: number;
  /** Measured model height (glb.ts); frames the camera. Defaults to 1 m. */
  heightMeters?: number | null;
  /** Clip to loop; undefined holds the bind pose. */
  clip?: string;
  onLoad?: () => void;
  onError?: (error: unknown) => void;
  /** Where the Viro web renderer's wasm sidecars are served. */
  assetBaseUrl?: string;
};

type SceneProps = Omit<MonModelViewerProps, 'assetBaseUrl'>;

function MonModelScene({ url, scale, position, rotation, yaw = 0, heightMeters, clip, onLoad, onError }: SceneProps) {
  const height = Math.max(0.1, (heightMeters ?? 1) * scale);
  return (
    <ViroScene>
      <ViroOrbitCamera position={[0, height * 0.6, height * 2.4 + 0.4]} focalPoint={[0, height * 0.5, 0]} active />
      <ViroAmbientLight color={palette.white} intensity={300} />
      <ViroDirectionalLight color={palette.white} direction={[-0.5, -1, -0.6]} intensity={900} />
      {/* key: a new file is a new node, so the old model never lingers under the new one. */}
      <Viro3DObject
        key={url}
        source={{ uri: url }}
        type="GLB"
        scale={[scale, scale, scale]}
        position={position}
        rotation={[rotation[0], rotation[1] + yaw, rotation[2]]}
        animation={clip ? { name: clip, run: true, loop: true } : undefined}
        onLoadEnd={() => onLoad?.()}
        onError={(event: unknown) => onError?.(event)}
      />
    </ViroScene>
  );
}

type NavigatorProps = {
  initialScene: { scene: ComponentType<any> };
  viroAppProps: SceneProps;
  webRendererOptions: { assetBaseUrl: string };
  showReticle?: boolean;
  style?: Record<string, unknown>;
};

const Navigator = Viro3DSceneNavigator as unknown as ComponentType<NavigatorProps>;

/** One Mon model on a lit stage, rendered by the same Viro runtime the game uses. */
export function MonModelViewer({ assetBaseUrl = '/viro/wasm/', ...scene }: MonModelViewerProps) {
  return (
    <View className="relative flex-1">
      <Navigator
        initialScene={{ scene: MonModelScene }}
        viroAppProps={scene}
        webRendererOptions={{ assetBaseUrl }}
        showReticle={false}
        // Navigator host props are a style object, not a className target.
        style={{ flex: 1 }}
      />
    </View>
  );
}
