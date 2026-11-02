'use client';

import { RiveLoader } from '@acme/ui';
import { View } from '@acme/ui/tw';

/**
 * The Suspense fallback while the 3D H-Lynk and its egg models load: the
 * kit's Rive spinner, centred where the device appears, on the stage's ink.
 * No photos, no blank page. `progress` (0..1) fills the loader's frame when
 * the download size is known; omitted, it spins.
 */
export function StageLoader({ label, testID, progress }: { label: string; testID: string; progress?: number }) {
  return (
    <View
      testID={testID}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="absolute inset-0 items-center justify-center bg-ink-950"
    >
      <RiveLoader phase="loading" scheme="dark" label={label} size={96} progress={progress} />
    </View>
  );
}
