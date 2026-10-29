// Adds the Mon keychain WidgetKit extension (canon Decision #36) to the iOS
// project at prebuild: an App Group shared by the app and the widget, the
// `NYCMonAppGroup` Info.plist key both sides read, and a `MonKeychain`
// app-extension target built from apps/mobile/targets/keychain-widget/*.swift.
//
// Why a local plugin and not @bacons/apple-targets: that package is not in the
// lockfile, CI installs with --frozen-lockfile, and this needs one static
// target. The `xcode` project API used here is the one @expo/config-plugins
// already ships (xcode@3.0.1, pbxProject.addTarget / addBuildPhase /
// addPbxGroup), the same calls Expo's community notification-extension
// plugins make.
//
// The app writes the snapshot through the local Expo module in
// apps/mobile/modules/keychain-widget. Android has no widget.
const fs = require('node:fs');
const path = require('node:path');
const { withEntitlementsPlist, withInfoPlist, withXcodeProject } = require('expo/config-plugins');

const TARGET_NAME = 'MonKeychain';
// apps/mobile, found through its package.json (the lint config has no CommonJS __dirname).
const SOURCE_DIR = path.join(path.dirname(require.resolve('../package.json')), 'targets', 'keychain-widget');
const DEPLOYMENT_TARGET = '17.0';
const APP_GROUP_KEY = 'NYCMonAppGroup';
const ENTITLEMENT = 'com.apple.security.application-groups';

/** `group.<app bundle id>`: the App Group the app and widget share. */
function appGroupId(bundleId) {
  return `group.${bundleId}`;
}

/** The widget's bundle id, nested under the app's as App Store Connect requires. */
function widgetBundleId(bundleId) {
  return `${bundleId}.keychain`;
}

/** Adds `group` to an entitlements' App Group list once, keeping any others. */
function withAppGroup(entitlements, group) {
  const groups = Array.isArray(entitlements[ENTITLEMENT]) ? [...entitlements[ENTITLEMENT]] : [];
  if (!groups.includes(group)) groups.push(group);
  return { ...entitlements, [ENTITLEMENT]: groups };
}

/** The extension's Info.plist. */
function widgetInfoPlist({ version, buildNumber, group }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleDisplayName</key>
  <string>Mon keychain</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
  <key>CFBundleShortVersionString</key>
  <string>${version}</string>
  <key>CFBundleVersion</key>
  <string>${buildNumber}</string>
  <key>${APP_GROUP_KEY}</key>
  <string>${group}</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.widgetkit-extension</string>
  </dict>
</dict>
</plist>
`;
}

function widgetEntitlements(group) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>${ENTITLEMENT}</key>
  <array>
    <string>${group}</string>
  </array>
</dict>
</plist>
`;
}

/** Every .swift file under the target's source folder, relative to it. Sorted so the project diff is stable. */
function listSwiftSources(dir = SOURCE_DIR) {
  const out = [];
  const walk = (rel) => {
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(child);
      else if (entry.name.endsWith('.swift')) out.push(child);
    }
  };
  walk('');
  return out.sort();
}

/** Build settings for both configurations of the extension target. */
function widgetBuildSettings({ bundleId, version, buildNumber, team }) {
  const settings = {
    PRODUCT_NAME: `"${TARGET_NAME}"`,
    PRODUCT_BUNDLE_IDENTIFIER: `"${widgetBundleId(bundleId)}"`,
    INFOPLIST_FILE: `"${TARGET_NAME}/Info.plist"`,
    CODE_SIGN_ENTITLEMENTS: `"${TARGET_NAME}/${TARGET_NAME}.entitlements"`,
    CODE_SIGN_STYLE: 'Automatic',
    GENERATE_INFOPLIST_FILE: 'NO',
    IPHONEOS_DEPLOYMENT_TARGET: DEPLOYMENT_TARGET,
    TARGETED_DEVICE_FAMILY: '"1,2"',
    SDKROOT: 'iphoneos',
    SWIFT_VERSION: '5.0',
    CLANG_ENABLE_MODULES: 'YES',
    APPLICATION_EXTENSION_API_ONLY: 'YES',
    SKIP_INSTALL: 'YES',
    MARKETING_VERSION: version,
    CURRENT_PROJECT_VERSION: buildNumber,
    LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
  };
  if (team) settings.DEVELOPMENT_TEAM = team;
  return settings;
}

function nativeTargetNamed(project, name) {
  const targets = project.pbxNativeTargetSection();
  return Object.entries(targets).find(([key, t]) => !key.endsWith('_comment') && typeof t === 'object' && t.name?.replace(/"/g, '') === name);
}

/** The app target's DEVELOPMENT_TEAM, so the widget signs with the same team. */
function appDevelopmentTeam(project) {
  const app = project.getFirstTarget().firstTarget;
  const list = project.pbxXCConfigurationList()[app.buildConfigurationList];
  for (const ref of list?.buildConfigurations ?? []) {
    const team = project.pbxXCBuildConfigurationSection()[ref.value]?.buildSettings?.DEVELOPMENT_TEAM;
    if (team) return team;
  }
  return undefined;
}

/**
 * Adds the extension target to an `xcode` project. Idempotent: a project that
 * already has the target is returned unchanged. Pure apart from the project
 * object, so a node test can drive it.
 */
function addKeychainTarget(project, { bundleId, version, buildNumber, sources }) {
  if (nativeTargetNamed(project, TARGET_NAME)) return project;

  // addTargetDependency silently does nothing when these sections are absent,
  // which the Expo template's project does not have until something adds one.
  const objects = project.hash.project.objects;
  objects.PBXTargetDependency ??= {};
  objects.PBXContainerItemProxy ??= {};

  const files = [...sources, 'Info.plist', `${TARGET_NAME}.entitlements`];
  const group = project.addPbxGroup(files, TARGET_NAME, TARGET_NAME);
  const mainGroup = project.getFirstProject().firstProject.mainGroup;
  project.addToPbxGroup(group.uuid, mainGroup);

  const target = project.addTarget(TARGET_NAME, 'app_extension', TARGET_NAME, widgetBundleId(bundleId));
  project.addBuildPhase(sources, 'PBXSourcesBuildPhase', 'Sources', target.uuid);
  project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
  // WidgetKit and SwiftUI link through Swift's module autolinking (`import`), so the phase stays empty.
  project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);

  const settings = widgetBuildSettings({ bundleId, version, buildNumber, team: appDevelopmentTeam(project) });
  const configs = project.pbxXCConfigurationList()[target.pbxNativeTarget.buildConfigurationList];
  for (const ref of configs.buildConfigurations) {
    const config = project.pbxXCBuildConfigurationSection()[ref.value];
    // addTarget seeds INFOPLIST_FILE as "<name>/<name>-Info.plist"; the one written here is "<name>/Info.plist".
    config.buildSettings = { ...config.buildSettings, ...settings };
    if (config.name === 'Debug') config.buildSettings.SWIFT_ACTIVE_COMPILATION_CONDITIONS = 'DEBUG';
  }
  return project;
}

/** Copies the Swift sources (flattened to basenames) and writes Info.plist and the entitlements. Returns the basenames. */
function writeTargetFiles(iosRoot, { group, version, buildNumber }) {
  const dest = path.join(iosRoot, TARGET_NAME);
  fs.mkdirSync(dest, { recursive: true });
  const names = [];
  for (const rel of listSwiftSources()) {
    const name = path.basename(rel);
    if (names.includes(name)) throw new Error(`with-keychain-widget: two Swift files are named ${name}`);
    names.push(name);
    fs.copyFileSync(path.join(SOURCE_DIR, rel), path.join(dest, name));
  }
  fs.writeFileSync(path.join(dest, 'Info.plist'), widgetInfoPlist({ version, buildNumber, group }));
  fs.writeFileSync(path.join(dest, `${TARGET_NAME}.entitlements`), widgetEntitlements(group));
  return names;
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withKeychainWidget = (config) => {
  const bundleId = config.ios?.bundleIdentifier;
  if (!bundleId) throw new Error('with-keychain-widget: ios.bundleIdentifier is required');
  const group = appGroupId(bundleId);
  const version = config.version ?? '1.0.0';
  const buildNumber = config.ios?.buildNumber ?? '1';

  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults = withAppGroup(mod.modResults, group);
    return mod;
  });
  config = withInfoPlist(config, (mod) => {
    mod.modResults[APP_GROUP_KEY] = group;
    return mod;
  });
  config = withXcodeProject(config, (mod) => {
    const sources = writeTargetFiles(mod.modRequest.platformProjectRoot, { group, version, buildNumber });
    addKeychainTarget(mod.modResults, { bundleId, version, buildNumber, sources });
    return mod;
  });
  return config;
};

module.exports = withKeychainWidget;
Object.assign(module.exports, {
  TARGET_NAME,
  APP_GROUP_KEY,
  appGroupId,
  widgetBundleId,
  withAppGroup,
  widgetInfoPlist,
  widgetEntitlements,
  widgetBuildSettings,
  listSwiftSources,
  addKeychainTarget,
});
