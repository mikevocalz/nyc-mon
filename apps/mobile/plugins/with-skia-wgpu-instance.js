// Keeps react-native-skia's `rnskia_getWGPUInstance` in the iOS app binary.
// react-native-webgpu finds Skia's Dawn instance with
// dlsym(RTLD_DEFAULT, "rnskia_getWGPUInstance") (cpp/rnwgpu/WebGPURuntime.cpp).
// Nothing references the symbol at link time, so with CocoaPods static
// linking the linker drops RNDawnInterop.o, webgpu never pumps Skia's
// instance, and mapAsync on an imported device never settles
// (Shopify/react-native-skia#4305). Skia 3.7.3 adds this same flag to its
// podspec (#4306); the installed 3.6.1 does not (ADR 0026).
const { withXcodeProject } = require('expo/config-plugins');

const FORCE_SYMBOL = '-Wl,-u,_rnskia_getWGPUInstance';

/**
 * Returns OTHER_LDFLAGS with the forced symbol appended once, keeping
 * `$(inherited)` and every existing flag. Pure, so a node test can drive it.
 * @param {string | string[] | undefined} flags
 * @returns {string[]}
 */
function addForcedSymbol(flags) {
  const list = flags === undefined ? ['"$(inherited)"'] : Array.isArray(flags) ? [...flags] : [flags];
  const quoted = `"${FORCE_SYMBOL}"`;
  if (!list.some((flag) => flag === FORCE_SYMBOL || flag === quoted)) list.push(quoted);
  return list;
}

const APPLICATION = '"com.apple.product-type.application"';

/**
 * Build configuration ids of the app targets only. An app extension (the
 * keychain widget) links no Skia, and `-u` on a symbol nothing defines fails
 * that link, so extensions are left alone.
 * @param {any} project an `xcode` project
 * @returns {Set<string>}
 */
function appConfigurationIds(project) {
  const ids = new Set();
  const lists = project.pbxXCConfigurationList();
  for (const [key, target] of Object.entries(project.pbxNativeTargetSection())) {
    if (key.endsWith('_comment') || typeof target !== 'object' || target.productType !== APPLICATION) continue;
    for (const ref of lists[target.buildConfigurationList]?.buildConfigurations ?? []) ids.add(ref.value);
  }
  return ids;
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withSkiaWgpuInstance = (config) =>
  withXcodeProject(config, (mod) => {
    const appConfigs = appConfigurationIds(mod.modResults);
    const configurations = mod.modResults.pbxXCBuildConfigurationSection();
    for (const [id, entry] of Object.entries(configurations)) {
      const settings = entry?.buildSettings;
      if (!appConfigs.has(id) || !settings) continue;
      settings.OTHER_LDFLAGS = addForcedSymbol(settings.OTHER_LDFLAGS);
    }
    return mod;
  });

module.exports = withSkiaWgpuInstance;
module.exports.addForcedSymbol = addForcedSymbol;
module.exports.FORCE_SYMBOL = FORCE_SYMBOL;
module.exports.appConfigurationIds = appConfigurationIds;
