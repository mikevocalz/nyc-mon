import { Badge } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { W01_COPY } from './copy';

/**
 * The stand-in for a Mon picture that does not exist yet: the raised surface
 * with the kit's Coming Soon badge, filling its frame so the tile keeps its
 * size. The app draws missing art the same way (EggStill, dex-art). It never
 * borrows another species' picture. `compact` is for tiles about 6rem wide.
 */
export function ComingSoonArt({ compact = false }: { compact?: boolean }) {
  return (
    <View className="bg-surface-raised p-1" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' }}>
      {/* The kit Badge is self-start; this wrapper is what the fill centres. */}
      <View>
        <Badge label={W01_COPY.comingSoon} tone="neutral" size={compact ? 'xs' : 'md'} />
      </View>
    </View>
  );
}
