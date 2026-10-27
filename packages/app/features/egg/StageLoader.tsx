'use client';

// TODO(RiveLoader): `RiveLoader` (packages/ui/RiveLoader.tsx, the Harlem-Might
// spinner rethemed) is being ported and exported from @acme/ui by another
// lane. Until that export lands, this import does not typecheck.
import { RiveLoader } from '@acme/ui';
import { View } from '@acme/ui/tw';

/**
 * The Suspense fallback while the 3D H-Lynk and its egg models load: the
 * kit's Rive spinner, centred where the device appears, on the stage's ink.
 * No photos, no blank page.
 */
export function StageLoader({ label, testID }: { label: string; testID: string }) {
  return (
    <View
      testID={testID}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="absolute inset-0 items-center justify-center bg-ink-950"
    >
      <RiveLoader phase="loading" scheme="dark" label={label} size={96} />
    </View>
  );
}
