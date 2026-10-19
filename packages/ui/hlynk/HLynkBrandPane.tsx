'use client';
import { GridFloor } from '../backgrounds/GridFloor';
import { SkylineDivider } from '../backgrounds/SkylineDivider';
import { BrandLogo } from '../brand/BrandLogo';
import { View } from '../tw';

export interface HLynkBrandPaneProps {
  widthPt: number;
  heightPt: number;
  scheme: 'daylit' | 'night';
  reducedMotion: boolean;
  testID?: string;
}

/** Badge side: 45% of the pane's short side, between 96 and 280 pt. */
export function brandLogoSizePt(widthPt: number, heightPt: number): number {
  return Math.round(Math.max(96, Math.min(280, Math.min(widthPt, heightPt) * 0.45)));
}

/**
 * The NYC-MON pane beside the H-Lynk on wide and folded windows (Decision
 * H-2, docs/design/hlynk/ADAPTIVE.md). It is the persistent branding the
 * foldable skill puts in the app header: the repo's badge as supplied, never
 * tinted or redrawn, over the kit's backgrounds. Night: the GridFloor street
 * grid under a skyline. Daylit: the page surface with a skyline along the
 * bottom. No controls and no copy, so it adds nothing to the step's task.
 * Reduced motion holds the background still.
 */
export function HLynkBrandPane({ widthPt, heightPt, scheme, reducedMotion, testID }: HLynkBrandPaneProps) {
  const logo = brandLogoSizePt(widthPt, heightPt);
  return (
    <View testID={testID} className="flex-1 overflow-hidden bg-bg">
      {scheme === 'night' ? (
        <GridFloor district="midtown" skyline horizon={0.55} speed={0.3} paused={reducedMotion} className="absolute inset-0" />
      ) : (
        <View className="absolute bottom-0 left-0 right-0">
          <SkylineDivider district="midtown" size="lg" still={reducedMotion} />
        </View>
      )}
      <View className="flex-1 items-center justify-center" style={{ paddingBottom: scheme === 'night' ? heightPt * 0.15 : 0 }}>
        <BrandLogo size={logo} />
      </View>
    </View>
  );
}
