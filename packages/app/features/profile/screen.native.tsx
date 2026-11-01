'use client';
import { ScreenPanes } from '../layout/ScreenPanes';
import { ProfileSecondary, ProfileSummary } from './profile-content';

/*
  One tree (ScreenPanes), switched by class only:

  - Phone: one column. Identity (avatar, name, Caller since), the record
    (eggs hatched, journal highlights), the Mons raised, then Settings and
    Account.
  - Tablet portrait (md+): the same order, top-aligned, the column widened to
    560, Mon stills and type one rung larger.
  - Landscape (md+, an open foldable): identity and record on the left two
    fifths, the Mons raised and the entries on the right
    (docs/design/foldable-arrangements.md, the Profile row). A separating
    vertical hinge becomes the seam (ScreenPanes, screen-panes-fold.ts).

  All measured against the content box: left of the rail, under the header.
*/
export function ProfileScreen() {
  return <ScreenPanes testID="caller" primary={<ProfileSummary />} secondary={<ProfileSecondary />} />;
}
