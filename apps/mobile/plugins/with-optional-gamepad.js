// Marks the gamepad optional so the Play listing is not filtered to devices
// with one (docs/implementation/hardware-input.md §5; Expo config has no
// `uses-feature` field). A local config plugin, referenced by path from
// app.config.ts, because ExpoConfig's `plugins` type only takes string entries.
//
// The entry is merged by `android:name` (finding M21): an existing
// `android.hardware.gamepad` entry from another plugin is rewritten to
// `required="false"` in place instead of gaining a duplicate, and every other
// `uses-feature` entry is kept untouched.
const { withAndroidManifest } = require('expo/config-plugins');

const GAMEPAD_FEATURE = 'android.hardware.gamepad';

/**
 * Returns a copy of `manifest` with exactly one gamepad `uses-feature`, marked
 * `android:required="false"`. Pure, so a node test can drive it without Expo.
 * @param {{ 'uses-feature'?: Array<{ $?: Record<string, string> }> }} manifest
 */
function applyOptionalGamepad(manifest) {
  const features = manifest['uses-feature'] ?? [];
  let seen = false;
  const merged = [];
  for (const feature of features) {
    if (feature?.$?.['android:name'] !== GAMEPAD_FEATURE) {
      merged.push(feature);
      continue;
    }
    if (seen) continue;
    seen = true;
    merged.push({ ...feature, $: { ...feature.$, 'android:required': 'false' } });
  }
  if (!seen) merged.push({ $: { 'android:name': GAMEPAD_FEATURE, 'android:required': 'false' } });
  return { ...manifest, 'uses-feature': merged };
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withOptionalGamepad = (config) =>
  withAndroidManifest(config, (mod) => {
    mod.modResults.manifest = applyOptionalGamepad(mod.modResults.manifest);
    return mod;
  });

module.exports = withOptionalGamepad;
module.exports.applyOptionalGamepad = applyOptionalGamepad;
module.exports.GAMEPAD_FEATURE = GAMEPAD_FEATURE;
