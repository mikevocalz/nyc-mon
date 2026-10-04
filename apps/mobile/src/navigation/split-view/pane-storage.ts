// Pane overrides persist in MMKV: instance `split-view`, key `pane-overrides`,
// the same place they lived before the split view moved into @acme/ui, so a
// saved layout survives the move. MMKV reads are synchronous, so the first
// render already knows the saved layout. Imported for its side effect by every
// platform entry before anything renders.
import { createMMKV } from 'react-native-mmkv';
import { configurePaneOverrideStorage } from '@acme/ui/adaptive-panes';

configurePaneOverrideStorage(createMMKV({ id: 'split-view' }));
