'use client';
import { ScreenPanes } from '../layout/ScreenPanes';
import { ProfileDetails, ProfileSummary } from './profile-content';

/*
  One tree (ScreenPanes), switched by class only:

  - Phone: the old column, identity first, the way into Settings below it.
  - Tablet portrait (md+): the same column, top-aligned and widened to 560.
  - Landscape (md+): identity on the left, the details on the right
    (docs/design/foldable-arrangements.md, the Profile row).
*/
export function ProfileScreen() {
  return <ScreenPanes primary={<ProfileSummary />} secondary={<ProfileDetails />} />;
}
