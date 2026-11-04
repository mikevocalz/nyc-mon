# NativeDropdown: source-owned native selection, Expo #52598

**Status:** implementation staged in a draft PR, not verified on physical hardware.

## Contract
\`@acme/ui/NativeDropdown\` is a **single-choice**, controlled native dropdown for precision editors and other apps: one label, selected value, grouped options, optional supporting text and disabled choices. No parallel document state and no pretending a picked value was saved.

- Android: Expo's **new** \`@expo/ui/jetpack-compose\` \`DropdownMenuPopup\`, \`DropdownMenuGroup\`, \`SelectableDropdownMenuItem\` from merged [Expo #52598](https://github.com/expo/expo/pull/52598); \`Box\` anchors the native popup to its trigger, group shapes and item shapes come from Material 3 Expressive.
- iOS: Expo SwiftUI \`Menu\`, \`Section\`, \`Button\` and disabled modifiers. SwiftUI controls the menu's presentation; don't draw Android's menu as a pixel-for-pixel facsimile on iOS.
- Web: canonical \`@acme/ui/Popover\` owns overflow, outside/Escape dismissal and focus restoration. The list has grouped, selected and disabled semantics.
- Native action lists continue to use **\`@acme/ui/Menu\`**. Rich brush and Chroma inspector content continues to use **\`@acme/ui/Popover\`**. \`NativeDropdown\` is for a single selection, not a second popup framework.
- Host app adapts its own theme and has its own source-of-truth; pure model prevents duplicate group IDs, duplicate option values, disabled selection and repeated calls on no-op choices.

## Version gate
The previous main branch catalog pinned \`@expo/ui: 58.0.20\`, which **predates Expo PR #52598**. The native Expressive symbols are available in the newer SDK 58 release line, confirmed in Expo's 58.0.26+ release window. Upgrade the catalog and lock together before native builds. Do not import new native names while keeping an old installed native binary. Rebuild the development client with the new Expo UI.

## Required QA
- [ ] npm/catalog and lock coherent and frozen install
- [ ] all package UI TypeScript, browser build, lint
- [ ] Android real Compose popup: open, selection, grouped shapes, supporting text, disabled rows, outside, Back, IME
- [ ] iOS actual SwiftUI Menu and sections, VoiceOver selection, disabled and external hardware keyboard
- [ ] phone/split tablet/Surface Duo hinge, both themes, RTL, reduced motion and dynamic type
- [ ] real Prism blend mode engine operation edit/undo/save/reopen (feature capability permitting), no fake engine modes
- [ ] check menu doesn't overlap the stage or cross the hinge; benchmark pointer/touch latency and screenshot consistency
