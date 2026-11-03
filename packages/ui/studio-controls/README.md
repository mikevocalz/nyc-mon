# Studio host bindings

`@acme/ui/studio-controls` is a narrow source-owned export for document editors
hosted inside NYC-MON. It uses this package's existing semantic `html`/`tw`
components and its actual Menu, Select, SegmentedControl, DropZone and Image.
It does not import the root UI barrel, clone controls into another repository,
or substitute another UI package.

```tsx
import { studioControls } from '@acme/ui/studio-controls';
import { StudioUIProvider } from '@nitro-forge/studio-workspace/ui';

<StudioUIProvider components={studioControls}>
  {/* The host supplies its existing document session and editor route. */}
</StudioUIProvider>
```

The exported object is `studioControls`. Its `html` member contains Page,
Main, Header, Footer, Section, Heading, Paragraph and Link, all from canonical
`ui/html`. Menu retains NYC-MON's existing actions/onAction/title contract.
Select accepts readonly options, copied into the existing kit's options API.

Native bundlers must resolve `.native.tsx` before the `.tsx` type anchors. The
native host uses the current NYC-MON Expo 58 / React Native 0.88 stack, with the
existing Uniwind setup and native modules linked. This export does not upgrade
an older consumer or claim compatibility with its native binary. The web host
must compile canonical UI source classes with its existing Tailwind 4 and
react-native-css setup and share one React runtime with the consumer.

The press bridge preserves RN-style pressed render callbacks while rendering
canonical html/Button on web and canonical tw/Pressable on native. The web
bridge normalizes axis spacing into CSS, maps accessible state/test IDs, and
keeps per-instance pressed state in Zustand. It is a compatibility boundary,
not an alternate button design.

Multiline input delegates to the canonical html textarea; on native this is
the existing Expo UI text-input bridge. The image binding accepts URI sources
and delegates to the existing Solito/expo-image component; native numeric
asset handles are deliberately rejected rather than given a false web mapping.
The image's `containerStyle` sizes its existing fill wrapper.

DropZone is operating-system content/file drag and drop. It is not an in-app
row sorter. No sortable-layer or pointer-reorder API is claimed by this export.
Navigation, adaptive-pane policy, document edits, and gesture transaction rules
remain with their established owners.

## Browser file selection

The browser host imports `studioControls` from
`@acme/ui/studio-controls/web`. Its `html.FilePicker` is the existing canonical
`html/dom.web` FilePickerBase, accepting `label`, `accept`, `multiple`,
`disabled`, `onFiles(files)` and `testID`. It opens the real system file picker
and clears its input after each choice so the same file can be chosen again.
The core/native entry does not expose a browser file picker: native document
entry remains a host callback using the host's linked picker implementation.
