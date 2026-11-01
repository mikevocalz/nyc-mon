# Hardware input: keyboards and physical gamepads

Lane C2 of the arcade-control directive (v2 §9 "Keyboard and hardware-gamepad adapters", §10 "XR and hardware gamepads"). Xbox, PlayStation (DualShock 4, DualSense), Nintendo (Switch Pro, Joy-Con) and generic Bluetooth HID pads, plus hardware keyboards, on iOS, Android and web, all dispatching the same semantic commands through `GameInputRouter` (`packages/ui/game-controls/contract.ts`).

Nothing in this lane was run on a device. "Verified" below means a typecheck, a Nitrogen regeneration or a `node --test` run on this machine; §7 lists what still needs hardware.

## 1. Pieces

| Path | Role |
| --- | --- |
| `packages/ui/modules/nyc-gamepad-input/` | Nitro module `GamepadInput` (react-native-nitro-modules 0.37.1). Spec in `src/specs/GamepadInput.nitro.ts`, Nitrogen output committed under `nitrogen/generated/`, Swift in `ios/`, Kotlin in `android/`. Local Expo module like `nyc-carousel`, linked through `apps/mobile/package.json` → `expo.autolinking.nativeModulesDir`. |
| `packages/ui/game-controls/hardware/gamepad-mapping.ts` | Pure: positional button → `ButtonId`, vendor labels, family-from-name, left stick / d-pad → `move` phases, Start short press / hold. Tested. |
| `packages/ui/game-controls/hardware/keyboard-mapping.ts` | Pure: W3C key codes → cluster, WASD/arrows → eight-way stick, Enter / Escape → pause, resume, stop. Tested. |
| `packages/ui/game-controls/hardware/hold-to-stop.ts`, `pill-toggle.ts`, `commands.ts` | The hold timer maths and the pill-state toggle both mappings share, and the two command shapes they return. |
| `packages/ui/game-controls/hardware/gamepad.web.ts` | Web source: `navigator.getGamepads()` polled by `requestAnimationFrame` only while a pad is connected, standard mapping, `keydown`/`keyup` with `repeat` dropped, `blur`/`visibilitychange` as focus loss. |
| `packages/ui/game-controls/hardware/hardware-input-source.ts` + `get-hardware-input-source.{ts,native.ts,web.ts}` | The interface the hook consumes and the platform fork that returns the HybridObject (native) or the web source. Same `.ts` extension on anchor and forks, imported without an extension. |
| `packages/ui/game-controls/hardware/hardware-input.store.ts` | Zustand vanilla store: `isAvailable`, `connectedDevices`, `activeSource`; `selectIsHardwareSourceActive` for the touch overlay. |
| `packages/ui/game-controls/hardware/use-hardware-input.ts` | The adapter hook: subscribes a source to one router, owns the two hold timers and the three cleanups. |
| `packages/ui/game-controls/hardware/index.ts` | Barrel. |

Consumers import `packages/ui/game-controls/hardware` through lane C1's `game-controls/index.ts` once it re-exports `./hardware`, or through a new `"./game-controls/hardware": "./game-controls/hardware/index.ts"` line in `packages/ui/package.json` `exports` (not added here: the file is outside this lane).

## 2. Native boundary: `GamepadInput`

One HybridObject, default-constructible (autolinked through `nitro.json`), five observations, no mechanics:

```ts
interface GamepadInput extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  readonly isAvailable: boolean;
  getConnectedDevices(): GamepadDevice[];                       // { id, name, family }
  addOnConnectionChangedListener((device, connected) => void): ListenerSubscription;
  addOnButtonListener((button, pressed, deviceId, timestampMs) => void): ListenerSubscription;
  addOnAxisListener((axis, value, deviceId, timestampMs) => void): ListenerSubscription;
  addOnKeyListener((keyCode, pressed, timestampMs) => void): ListenerSubscription;
}
```

- `GamepadButton` is positional: `south | east | west | north | left-shoulder | right-shoulder | left-trigger | right-trigger | select | start | left-stick | right-stick | dpad-up | dpad-down | dpad-left | dpad-right | home`. `south` is Xbox A, PlayStation Cross, Nintendo B on every platform.
- `GamepadAxis`: `left-x | left-y | right-x | right-y | dpad-x | dpad-y | left-trigger | right-trigger`. Sticks and d-pad −1…1 with **+y up** after normalization (GameController already reports +y up; Android `AXIS_Y`/`AXIS_RZ`/`AXIS_HAT_Y` and the web `axes[1]`/`axes[3]` are negated). Triggers 0…1. No dead zone in the module: that comes from the controller profile in the adapter.
- `GamepadFamily`: `xbox | playstation | nintendo | generic | keyboard`. Labels only; the mapping table is the same for every family.
- `keyCode` is the W3C `KeyboardEvent.code` string (`KeyW`, `ArrowUp`, `Enter`, `Escape`), produced from `GCKeyCode` on iOS (`ios/WebKeyCode.swift`) and `KeyEvent` key codes on Android (`android/.../WebKeyCode.kt`), so `keyboard-mapping.ts` is one table for native and web. Keys the module cannot name are dropped.
- `timestampMs`: the platform's monotonic event clock in milliseconds (`ProcessInfo.systemUptime` on iOS, `KeyEvent.eventTime`/`MotionEvent.eventTime` on Android, `performance.now()`/`event.timeStamp` on web). Comparable within a platform only; the router only requires a finite number.
- Threading: iOS delivers on a private serial queue (`GCController.handlerQueue`), Android on the main thread (where `KeyEvent`/`MotionEvent` arrive), web on the rAF/event loop. Nitro moves every callback onto the JS thread, in arrival order. Subscriptions are additive; `remove()` is idempotent and a listener removed mid-emission may receive that one event.
- Auto-repeat is filtered on every platform (GameController fires one edge per press; Android drops `repeatCount > 0`; web drops `event.repeat`).

Seams read in the installed sources:

| Seam | File |
| --- | --- |
| Swift `HybridObject` protocol (`memorySize`, `dispose`, `toString` have default implementations) | `apps/mobile/node_modules/react-native-nitro-modules/ios/core/HybridObject.swift` |
| Kotlin `HybridObject` (`createCxxPart`, `@Keep`/`@DoNotStrip`), `NitroModules.applicationContext` | `…/react-native-nitro-modules/android/src/main/java/com/margelo/nitro/core/HybridObject.kt`, `…/NitroModules.kt` |
| `NitroModules.createHybridObject`, `hasHybridObject` | `…/react-native-nitro-modules/lib/typescript/NitroModulesProxy.d.ts` |
| Generated protocol / abstract class the implementations target | `nitrogen/generated/ios/swift/HybridGamepadInputSpec.swift` (`HybridGamepadInputSpec = HybridGamepadInputSpec_protocol & HybridGamepadInputSpec_base`), `nitrogen/generated/android/kotlin/com/margelo/nitro/gamepadinput/HybridGamepadInputSpec.kt` |
| Expo lifecycle hook used instead of a `MainActivity` change | `node_modules/.pnpm/expo@58.0.3_*/node_modules/expo/android/src/main/java/expo/modules/ReactActivityDelegateWrapper.kt` lines 49–50 (`ExpoModulesPackage.packageList.flatMap { it.createReactActivityLifecycleListeners(activity) }`) and 171–173 (`listener.onCreate(activity, savedInstanceState)` after the activity's window exists) |
| `Package` / `ReactActivityLifecycleListener` interfaces | `node_modules/.pnpm/expo-modules-core@58.0.12_*/node_modules/expo-modules-core/android/src/main/java/expo/modules/core/interfaces/{Package,ReactActivityLifecycleListener}.java` |
| Autolinking scans `*Package.kt` for `import expo.modules.core.interfaces.Package` | `node_modules/.pnpm/expo-modules-autolinking@58.0.8_*/…/build/platforms/android/android.js` lines 136–142 |
| Podspec discovery (any top-level `*.podspec`) and `apple.podspecPath` | `…/expo-modules-autolinking/build/platforms/apple/apple.js` lines 75–97, `build/ExpoModuleConfig.js` line 146 |
| Nitro-on-Gradle precedent copied for `android/build.gradle` | `node_modules/.pnpm/react-native-mmkv@4.3.2_*/node_modules/react-native-mmkv/android/build.gradle` |
| GameController symbols (`GCKeyCode.*`, `GCProductCategory*`, `handlerQueue`, `GCKeyboard.coalesced`, `keyChangedHandler`, optional `buttonHome`/`buttonOptions`/`leftThumbstickButton`) | iPhoneOS 27.1 SDK `GameController.framework/Headers/{GCKeyCodes,GCProductCategories,GCDevice,GCKeyboard,GCKeyboardInput,GCExtendedGamepad}.h` |

### iOS

`ios/HybridGamepadInput.swift` is orchestration only: four `ListenerRegistry` instances and one `GameControllerObserver`. The observer watches `GCControllerDidConnect/Disconnect` and `GCKeyboardDidConnect/Disconnect` on its own serial queue, assigns each controller a UUID for the life of the connection, sets `handlerQueue` to that queue and binds `pressedChangedHandler` / `valueChangedHandler` per element (`GCExtendedGamepad+bindHandlers.swift`). `GCKeyboard.coalesced` is one device with id `keyboard`. Family comes from `productCategory` (`GCProductCategoryXboxOne`, `DualShock4`, `DualSense`, `Keyboard`); Nintendo pads arrive as the HID category, so their `vendorName` is the signal (`GamepadFamily+productCategory.swift`).

### Android

`android/.../HybridGamepadInput.kt` registers an `InputManager.InputDeviceListener` on the main looper for connect/disconnect and implements `GamepadEventSink`, which `GamepadWindowCallback` feeds. The window callback wraps the `ReactActivity`'s own `Window.Callback` so `dispatchKeyEvent` and `dispatchGenericMotionEvent` are observed before the view tree, then delegated untouched; Expo's `ReactActivityHandler.onKeyDown/onKeyUp` could not be used because they fire after a view may have consumed the key and nothing forwards joystick `MotionEvent`s. `GamepadActivityLifecycleListener.onCreate` installs the wrapper (idempotent per window) and `NycGamepadInputPackage` (an `expo.modules.core.interfaces.Package`) both registers that listener and loads the Nitro C++ library in its constructor, the way `NitroMmkvPackage`'s static block does. No `MainActivity` change is required.

Devices: `SOURCE_GAMEPAD | SOURCE_JOYSTICK` is a game controller; `SOURCE_KEYBOARD` with `KEYBOARD_TYPE_ALPHABETIC` and not virtual is a hardware keyboard (`InputDevice+gamepad.kt`). Family from USB vendor id (`0x045E` Microsoft, `0x054C` Sony, `0x057E` Nintendo) then product name (`GamepadFamily+fromInputDevice.kt`). Axes: `AXIS_X/Y`, `AXIS_Z/RZ`, `AXIS_HAT_X/Y`, triggers from `AXIS_LTRIGGER|AXIS_BRAKE` and `AXIS_RTRIGGER|AXIS_GAS`, the hardware's own `flat` centre band zeroed, diffed per device and axis so only changes reach JS (`MotionEvent+gamepadAxes.kt`).

Decision (BUILD): events that arrive before JS has created the HybridObject are dropped (`GamepadEventHub.sink` is null), and a second HybridObject (Fast Refresh) replaces the sink. A button pressed during startup is not gameplay.

## 3. Mapping tables

### Gamepad → cluster (`GAMEPAD_BUTTON_BINDINGS`)

Decision (BUILD): keep the pad's own geometry. On every vendor's pad the four face buttons sit in two rows (west and north above south and east), which is the cluster's top row X Y over bottom row A B; the bumpers fill Z (right, top) and C (left, bottom), the shape Street Fighter's pad defaults use. The brief's literal pairwise reading ("A/B/X/Y + LB/RB → a/b/c/x/y/z") would put Xbox X, on the pad's left, at the cluster's bottom-right, so it was not used.

| Position | Xbox | PlayStation | Nintendo | Generic (standard mapping index) | Cluster |
| --- | --- | --- | --- | --- | --- |
| west | X | Square | Y | 2 | **x** |
| north | Y | Triangle | X | 3 | **y** |
| right-shoulder | RB | R1 | R | 5 | **z** |
| south | A | Cross | B | 0 | **a** |
| east | B | Circle | A | 1 | **b** |
| left-shoulder | LB | L1 | L | 4 | **c** |

Unbound, diagnostics only: triggers (digital and analog), right stick, stick clicks, Select / Share / Minus, Home / Guide / PS, the d-pad's own button events (the d-pad drives the stick through `dpad-x`/`dpad-y` instead).

### Stick

`left-x`/`left-y` and `dpad-x`/`dpad-y` go through `gamepadAxisToMove`. The d-pad wins while pressed. The vector is handed to `readStick` from `stick-math.ts` as a finger at `x · clampRadiusDp, −y · clampRadiusDp`, so the profile's `deadZone` (fraction of full deflection), `sensitivity` and the unit-circle clamp apply exactly as they do to touch; `stickMode: 'dpad'` snaps through `toDigitalReading`. First engaged reading → `begin`, changes → `update`, back inside the dead zone → one `end` at (0, 0). Readings that round to the last published one publish nothing.

### Start / Options / Plus

| Edge | Result |
| --- | --- |
| Short press (`< 1000 ms`) while `pill === 'playing'` | `pauseRequest('gamepad')` |
| Short press while `pill === 'paused'` | `resumeRequest('gamepad')` |
| Short press while `start` or `stopConfirm` | nothing (the lobby and the confirm dialog keep their own controls) |
| Held `≥ 1000 ms` (`STOP_HOLD_MS`) | `stopRequest('gamepad')` once, from the hook's timer; the release that follows is silent. If the timer never ran, a release at `≥ 1000 ms` still sends it. The session still confirms; never a bare tap. |

### Keyboard (`keyboard-mapping.ts`)

| Key (`KeyboardEvent.code`) | Result |
| --- | --- |
| `KeyU` / `KeyI` / `KeyO` | x / y / z (top row) |
| `KeyJ` / `KeyK` / `KeyL` | a / b / c (bottom row) |
| `KeyW` `KeyA` `KeyS` `KeyD`, `ArrowUp` `ArrowLeft` `ArrowDown` `ArrowRight` | eight-way stick; a diagonal is (±0.71, ±0.71); opposite keys cancel to centre; `begin` / `update` / `end` as above |
| `Enter` down | pause or resume by pill state (no hold meaning, so it acts on the down edge) |
| `Escape` short press (on release) | pause or resume by pill state |
| `Escape` held `≥ 1000 ms` | `stopRequest('keyboard')`, same rules as Start |

Repeats: the platforms filter auto-repeat; the mapping also ignores a down for a key already held and an up for a key not held, so the held set cannot drift.

## 4. Adapter hook and store

```ts
import { useHardwareInput, useHardwareInputStore, selectIsHardwareSourceActive } from '@acme/ui/game-controls/hardware';

useHardwareInput(router, { profile, pill, enabled: screen === 'game' });
const hideTouch = useHardwareInputStore(selectIsHardwareSourceActive);   // → AdaptiveControlLayout hideTouchControls
```

- The state machine is `hardware/hardware-input-adapter.ts` (pure, node-tested with a fake source); the hook only picks the platform source, mounts the adapter and forwards `AppState`.
- Held buttons are tracked per device. Two pads holding the same button reach the router as one down, and the up goes out when the last pad lets go. The router keeps pairing across sources and owns the stick. A gamepad or keyboard `begin` rejected while touch owns the stick is retried: the next `update` goes out as a `begin` once the router's stick is free (finding M7).
- Only meaningful input marks a source active and hides the touch overlay: a bound button, Start, a mapped key, or an axis event that produced a stick move. Modifiers, unbound keys, triggers and a stick inside its dead zone do not (finding H8).
- `profile` and `pill` are read on every event through a ref the hook refreshes after each render, so changing them never resubscribes.
- Cleanups: a device disconnect releases only what that device held and ends the gamepad stick only if that pad was driving it (finding M8). When the last hardware device leaves while hardware was the active source, one `cancelAll('source-disconnected')` lets the screen speak `g01.cancel.source`, and `activeSource` goes null. Native `AppState` leaving `active` → `cancelAll('background')`; web `blur` / hidden document → `cancelAll('focus-loss')`. Unmount releases only what this adapter holds.
- Web: the pad window listeners and the frame loop run only while a connection, button or axis listener exists (finding M5). Keyboard events go through `web-key-filter.ts`: no typing in inputs, textareas, selects or contenteditable, no Ctrl/Meta/Alt chords, mapped codes only with `preventDefault`, and a key up always follows its forwarded down (finding M6).
- Touch side: when the overlay hides, `ArcadeController` releases only what touch holds (`TouchInputGate.releaseTouch`) and renders "Show touch controls" at the pill's rect, which sets `activeSource` to `touch`.
- Android: `HybridGamepadInput.dispose()` clears the event sink if it is still this instance, unregisters the `InputDeviceListener` and drops every listener (finding H5), mirroring the Swift observer's `deinit`. iOS timestamps are the profile's `lastEventTimestamp` (event time, like Android's `eventTime`) and listeners fire in insertion order (finding L13).
- Store: `hardwareInputStore` (`zustand/vanilla`) with `isAvailable`, `connectedDevices`, `activeSource: InputSource | null`. The touch lane may call `setActiveSource('touch')` when a finger lands so the overlay returns.

## 5. App configuration (outside this lane: write, do not apply)

### `apps/mobile/package.json`

No change. Like `nyc-carousel`, the module is not a dependency; `expo.autolinking.nativeModulesDir: "../../packages/ui/modules"` already makes Expo find `packages/ui/modules/nyc-gamepad-input/expo-module.config.json`, add `NycGamepadInput.podspec` to the Podfile and the `android/` Gradle project (named `nyc-gamepad-input`) to `settings.gradle`, and register `NycGamepadInputPackage`.

### `packages/ui/package.json` (blocker for a clean clone)

`modules/nyc-gamepad-input/src/GamepadInput.ts` imports `react-native-nitro-modules`, which resolves today only through a hand-made `packages/ui/modules/nyc-gamepad-input/node_modules/react-native-nitro-modules` symlink (gitignored). Add to `dependencies`:

```json
"react-native-nitro-modules": "catalog:",
```

then `pnpm install` (not run in this lane). `@rive-app/react-native`, already a dependency, peer-depends on the same package, so the resolved graph gains nothing new.

### `apps/mobile/app.config.ts`

```ts
ios: {
  bundleIdentifier: 'com.nycmon.app',
  supportsTablet: true,
  infoPlist: {
    // Profiles the app handles. Every supported pad (Xbox, DualShock 4, DualSense,
    // Switch Pro, Joy-Con pair, MFi) presents ExtendedGamepad; DirectionalGamepad
    // covers d-pad-only MFi remotes. No MicroGamepad: the Siri Remote is not a game controller here.
    GCSupportedGameControllers: [{ ProfileName: 'ExtendedGamepad' }, { ProfileName: 'DirectionalGamepad' }],
    // false: the pad drives gameplay, not UIKit focus. true would let Start/A move and
    // activate focus in the React Native view tree.
    GCSupportsControllerUserInteraction: false,
  },
},
android: {
  package: 'com.nycmon.app',
  // ...
},
```

and, for Android, a config plugin that marks the gamepad optional so the Play listing is not filtered (Expo config has no `uses-feature` field):

Implemented as the local plugin `apps/mobile/plugins/with-optional-gamepad.js`, referenced from `app.config.ts` as `'./plugins/with-optional-gamepad'`, first in the `plugins` list. ExpoConfig's `plugins` type takes string entries only, and config-plugins run the last-added mod first, so a plugin placed after `expo-horizon-core` runs before it and loses its `uses-feature` entry when that plugin rebuilds the list. Verified 2026-10-15 with `expo prebuild --platform android --no-install`: the generated `AndroidManifest.xml` carries `android.hardware.gamepad` `required="false"`.

```js
const { withAndroidManifest } = require('expo/config-plugins');
module.exports = (config) =>
  withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest['uses-feature'] = [
      ...(manifest['uses-feature'] ?? []),
      { $: { 'android:name': 'android.hardware.gamepad', 'android:required': 'false' } },
    ];
    return mod;
  });
```

`GCSupportedGameControllers` enumerates profiles, not vendors:

| Vendor / pad | Profile it presents | Notes |
| --- | --- | --- |
| Xbox Wireless Controller (Bluetooth), Xbox Series / Elite 2 / Adaptive | `ExtendedGamepad` | `productCategory == GCProductCategoryXboxOne` |
| DualShock 4 | `ExtendedGamepad` | `GCProductCategoryDualShock4` |
| DualSense, DualSense Edge | `ExtendedGamepad` | `GCProductCategoryDualSense`; touchpad and adaptive triggers unused |
| Switch Pro Controller, Joy-Con pair | `ExtendedGamepad` | iOS 16+; arrives as `GCProductCategoryHID`, family from `vendorName` |
| MFi (Backbone, Razer Kishi, SteelSeries Nimbus, Rotor Riot) | `ExtendedGamepad` | `GCProductCategoryMFi` → `generic` family |
| Hardware keyboard | n/a (`GCKeyboard`, not a controller profile) | needs no plist entry |

## 6. Expo autolinking, step by step

1. `expo-modules-autolinking` scans `nativeModulesDir` (`packages/ui/modules`) for directories with `expo-module.config.json`. Ours declares `platforms: ["apple", "android"]`, `apple.podspecPath: "NycGamepadInput.podspec"`, empty `modules` arrays (no Expo module; the HybridObject is Nitro's).
2. Apple: `use_expo_modules!` adds `pod 'NycGamepadInput', :path => '…/packages/ui/modules/nyc-gamepad-input'`. The podspec loads `nitrogen/generated/ios/NycGamepadInput+autolinking.rb` (`add_nitrogen_files`: shared C++ specs, Swift–C++ bridge, `NitroModules` dependency, C++20, `SWIFT_OBJC_INTEROP_MODE=objcxx`), links `GameController.framework`, and `install_modules_dependencies`. `NycGamepadInputAutolinking.swift` constructs `HybridGamepadInput()`; `NycGamepadInputAutolinking.mm` registers the constructor under `GamepadInput`.
3. Android: `useExpoModules()` includes `:nyc-gamepad-input` from `android/build.gradle`, which applies `nitrogen/generated/android/NycGamepadInput+autolinking.gradle` (generated Kotlin source set) and builds `libNycGamepadInput.so` from `CMakeLists.txt` + `NycGamepadInput+autolinking.cmake` (links `fbjni`, `ReactAndroid::jsi`, `react-native-nitro-modules::NitroModules`, `ReactAndroid::reactnative`). Autolinking finds `NycGamepadInputPackage.kt` (imports `expo.modules.core.interfaces.Package`) and lists it in `ExpoModulesPackage.packageList`; constructing it runs `NycGamepadInputOnLoad.initializeNative()` → `System.loadLibrary("NycGamepadInput")` → `JNI_OnLoad` → `registerAllNatives()`, which registers the `GamepadInput` constructor. Its `createReactActivityLifecycleListeners` installs the window callback on activity creation.
4. JS: `getGamepadInput()` calls `NitroModules.createHybridObject<GamepadInput>('GamepadInput')` on first use; `isGamepadInputInstalled()` asks `NitroModules.hasHybridObject` and returns `false` in Expo Go or a stale dev client.
5. After adding the module: `pnpm --filter mobile prebuild` (clean) and a native build. An existing dev client has no native half until rebuilt; the store reports `isAvailable: false` and the touch overlay stays.

## 7. Verification

| Check | Command | Result |
| --- | --- | --- |
| Nitrogen regenerates the committed output byte-for-byte | copy of the module in the scratchpad with `react-native-nitro-modules` linked, `npx -y nitrogen@0.37.1 --log-level=info`, `diff -r` against `nitrogen/generated` | `Generated 1/1 HybridObject`, `GENERATED OUTPUT IDENTICAL` (run twice: before and after the type-file edits) |
| Native package typecheck | `packages/ui/modules/nyc-gamepad-input$ ../../node_modules/.bin/tsc --noEmit -p tsconfig.json` | exit 0 |
| Lane files against the kit tsconfig | `tsc --noEmit -p <scratch tsconfig extending packages/ui/tsconfig.json, include hardware/** + modules/nyc-gamepad-input/src/**>` | exit 0 |
| `pnpm --filter @acme/ui typecheck` | as the preamble prescribes | fails with 61 errors, all in lane C1's `AnalogStick*`, `ArcadeActionButton*`, `ArcadeController.stories.tsx`, `StartStopPill*` (missing `react-native-gesture-handler` types, Storybook `args`); none in `game-controls/hardware/**` or `modules/nyc-gamepad-input/**`. The baseline before those files appeared passed. |
| Pure mappings | `pnpm --filter @acme/ui test` (`node --test '**/*.test.ts'`) | 481 tests, 0 failures (443 before this lane; 38 added across `gamepad-mapping.test.ts` and `keyboard-mapping.test.ts`) |
| Swift against the iOS 27.1 SDK | `xcrun swiftc -typecheck -sdk iphoneos -target arm64-apple-ios16.4` on every `ios/*.swift` except `HybridGamepadInput.swift`, with a stub file standing in for the four generated types | exit 0; every GameController symbol resolves |
| `HybridGamepadInput.swift` | needs `NitroModules` and the C++ bridge, only available inside a pod build | unverified (the editor's SourceKit errors come from that missing module path; every referenced name exists in `nitrogen/generated/ios/swift/` and the extensions are declared in the same target) |
| Kotlin | no `kotlinc` on this machine; Gradle would need a native build | unverified against the compiler; written against `HybridGamepadInputSpec.kt`, `GamepadButton.Companion`, `GamepadFamily.Companion`, `ListenerSubscription(remove: () -> Unit)` as generated |
| On a device | iOS and Android builds, each pad family, hardware keyboard, disconnect mid-hold, background mid-hold | not done in this lane (lane F) |

## 8. Open items

- `packages/ui/package.json` dependency line above (blocker for a clean clone).
- `packages/ui/package.json` export or lane C1's `game-controls/index.ts` re-export so apps can import the barrel.
- `apps/mobile/app.config.ts` plist keys and the Android `uses-feature` plugin above.
- Haptics on a physical pad (`GCDeviceHaptics` / Android `Vibrator` on the device) are not in the spec; the touch lane's `controllerHaptics` runs on the phone. DEFER until a device check says whether pad rumble is wanted.
- Web pads without the `standard` mapping are listed but produce no events. DEFER a per-pad remap UI until a report names a pad that needs it.
