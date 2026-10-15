import { Slot } from 'expo-router';
import { HomeLayout } from '@acme/app/features/companion/HomeLayout.tsx';

/**
 * The `(home)` group: one H-Lynk shell and one creature layer for M11, M12,
 * M09 and M13–M16, so the Mon never hard-cuts between them. M17 and M18 draw
 * full-window over it.
 */
export default function HomeGroupLayout() {
  return (
    <HomeLayout>
      <Slot />
    </HomeLayout>
  );
}
