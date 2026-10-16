import { NitroModules } from 'react-native-nitro-modules';
import type { GamepadInput } from './specs/GamepadInput.nitro';

/** The name `nitro.json` registers the HybridObject under. */
const HYBRID_OBJECT_NAME = 'GamepadInput';

let instance: GamepadInput | undefined;

/**
 * The process-wide {@linkcode GamepadInput}. Created on first call, not at
 * import time, because a dev client built before this module existed has
 * no native half and `createHybridObject` throws; the kit's carousel takes
 * the same approach with `requireOptionalNativeModule`.
 *
 * @throws when the native library is not in this binary (rebuild the app)
 *   or when running in Expo Go, which cannot load Nitro modules.
 */
export function getGamepadInput(): GamepadInput {
  if (instance === undefined) {
    instance = NitroModules.createHybridObject<GamepadInput>(HYBRID_OBJECT_NAME);
  }
  return instance;
}

/**
 * `true` when {@linkcode getGamepadInput} can succeed in this binary. Never
 * throws and never constructs: `NitroModules.hasHybridObject` reads the
 * registry (react-native-nitro-modules 0.37.1,
 * lib/typescript/NitroModulesProxy.d.ts), and the catch covers Expo Go,
 * where the Nitro TurboModule itself is missing.
 */
export function isGamepadInputInstalled(): boolean {
  try {
    return NitroModules.hasHybridObject(HYBRID_OBJECT_NAME);
  } catch {
    return false;
  }
}
