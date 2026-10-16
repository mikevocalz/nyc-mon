// On-map ODbL attribution (data/README.md: "Any map surface must visibly
// display the attribution and license link"). Text comes from the dataset's
// own provenance so a future tile with different terms cannot ship with stale
// credit. The link target is OSM's copyright page, which carries the ODbL
// terms and the attribution guidance; it is not the editing API.
//
// Placement mirrors map convention (Fresha's Apple Maps "Legal" link,
// https://mobbin.com/screens/7fd4b74d-ab0a-45c3-b90c-438b0778940f, structure
// only): the bottom corner opposite the camera controls, inside one
// hinge-safe region (resolveGameHudLayout).
import { Linking } from 'react-native';
import { Text } from '@acme/ui';
import { Pressable, View } from '@acme/ui/tw';
import type { CityDataset } from './city-dataset.ts';
import type { Rect } from './hud-layout.ts';

export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

/** "ODbL-1.0" -> "ODbL 1.0". Unknown identifiers pass through unchanged. */
export function licenseLabel(license: string): string {
  return license.replace(/^ODbL-/, 'ODbL ');
}

/** The short on-map credit OSM's attribution guidelines accept ("© OpenStreetMap", linked); the full line is the a11y label. */
export function shortCredit(attribution: string): string {
  return attribution.replace(/\s+contributors$/i, '');
}

export function MapAttribution({ source, rect }: { source: CityDataset['source']; rect: Rect }) {
  const label = `${source.attribution}, ${licenseLabel(source.license)}`;
  return (
    <View
      className="absolute justify-end"
      // Computed: rect from resolveGameHudLayout.
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
      pointerEvents="box-none"
    >
      <Pressable
        role="link"
        aria-label={`${label}. Opens the OpenStreetMap copyright page`}
        // 44pt tall hit area even though the text is small. A quiet map credit, not a panel:
        // no backdrop, muted text with a shadow so it reads over sky and street alike.
        className="min-h-11 self-start justify-center px-1"
        onPress={() => void Linking.openURL(OSM_COPYRIGHT_URL)}
      >
        <Text
          className="text-[11px] text-ink-50/70"
          numberOfLines={1}
          style={{ textShadowColor: 'rgba(0,4,28,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}
        >
          {shortCredit(source.attribution)}
        </Text>
      </Pressable>
    </View>
  );
}
