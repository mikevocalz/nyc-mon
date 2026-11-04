// A SwiftUI single-target Watch companion, generated alongside the existing widget.
const fs = require('node:fs');
const path = require('node:path');
const { withXcodeProject } = require('expo/config-plugins');

const TARGET_NAME = 'MonWatch';
const mobileRoot = path.dirname(require.resolve('../package.json'));
const watchBundleId = (bundleId) => `${bundleId}.watchkitapp`;

function watchInfoPlist(bundleId) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleDisplayName</key><string>NYC-MON</string>
<key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
<key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
<key>CFBundleName</key><string>$(PRODUCT_NAME)</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string>
<key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string>
<key>WKApplication</key><true/>
<key>WKCompanionAppBundleIdentifier</key><string>${bundleId}</string>
<key>WKRunsIndependentlyOfCompanionApp</key><false/>
</dict></plist>
`;
}

function withWatchCredentials(config, bundleId) {
  const extra = config.extra ?? {};
  const eas = extra.eas ?? {};
  const build = eas.build ?? {};
  const experimental = build.experimental ?? {};
  const ios = experimental.ios ?? {};
  const extensions = [...(ios.appExtensions ?? [])];
  const index = extensions.findIndex((entry) => entry.targetName === TARGET_NAME);
  const entry = { ...(index < 0 ? {} : extensions[index]), targetName: TARGET_NAME,
    bundleIdentifier: watchBundleId(bundleId), entitlements: {} };
  if (index < 0) extensions.push(entry);
  else extensions[index] = { ...entry, entitlements: extensions[index].entitlements ?? {} };
  return { ...config, extra: { ...extra, eas: { ...eas, build: { ...build, experimental: {
    ...experimental, ios: { ...ios, appExtensions: extensions },
  } } } } };
}

function addWatchTarget(project, { bundleId, version, buildNumber, sources }) {
  const existing = Object.entries(project.pbxNativeTargetSection()).find(([key, value]) =>
    !key.endsWith('_comment') && value.name?.replace(/"/g, '') === TARGET_NAME);
  if (existing) {
    const [uuid, target] = existing;
    const groupId = Object.entries(project.hash.project.objects.PBXGroup).find(([key, value]) =>
      !key.endsWith('_comment') && String(value.path).replace(/"/g, '') === TARGET_NAME)?.[0];
    if (!groupId) throw new Error('MonWatch source group is missing');
    const sourceGroup = project.hash.project.objects.PBXGroup[groupId];
    sourceGroup.children = sourceGroup.children.filter((ref) =>
      !['Info.plist', 'KeychainSnapshot.swift'].includes(String(ref.comment).replace(/"/g, '')));
    const phase = Object.values(objectsFor(project, 'PBXSourcesBuildPhase')).find((phase) =>
      phase && typeof phase === 'object' && target.buildPhases.some((ref) =>
        objectsFor(project, 'PBXSourcesBuildPhase')[ref.value] === phase));
    phase.files = phase.files.filter((ref) => ref.comment?.replace(/"/g, '') !== 'KeychainSnapshot.swift in Sources');
    if (!project.hasFile('WatchInfo.plist')) project.addFile('WatchInfo.plist', groupId);
    for (const name of sources) {
      if (!phase.files.some((file) => file.comment?.replace(/"/g, '') === `${name} in Sources`)) {
        project.addSourceFile(name, { target: uuid }, groupId);
      }
    }
    for (const name of ['squeaklet.usdz', 'lil-ratti.usdz', 'PrivacyInfo.xcprivacy']) {
      project.addResourceFile(name, { target: uuid }, groupId);
    }
    for (const ref of project.pbxXCConfigurationList()[target.buildConfigurationList].buildConfigurations) {
      const settings = project.pbxXCBuildConfigurationSection()[ref.value].buildSettings;
      settings.INFOPLIST_FILE = '"MonWatch/WatchInfo.plist"';
      settings.MARKETING_VERSION = version;
      settings.CURRENT_PROJECT_VERSION = buildNumber;
      settings.PRODUCT_BUNDLE_IDENTIFIER = `"${watchBundleId(bundleId)}"`;
      if (Array.isArray(settings.OTHER_LDFLAGS)) {
        settings.OTHER_LDFLAGS = settings.OTHER_LDFLAGS.filter((flag) => !flag.includes('_rnskia_getWGPUInstance'));
      }
    }
    return project;
  }
  const app = project.getFirstTarget();
  const objects = project.hash.project.objects;
  objects.PBXTargetDependency ??= {};
  objects.PBXContainerItemProxy ??= {};
  const group = project.addPbxGroup([...sources, 'WatchInfo.plist', 'Assets.xcassets',
    'squeaklet.usdz', 'lil-ratti.usdz', 'PrivacyInfo.xcprivacy'], TARGET_NAME, TARGET_NAME);
  project.addToPbxGroup(group.uuid, project.getFirstProject().firstProject.mainGroup);
  // xcode's watch2_app creates the correct host dependency and Watch copy phase.
  // The modern single-target app contains executable Swift rather than an extension.
  const target = project.addTarget(TARGET_NAME, 'watch2_app', TARGET_NAME, watchBundleId(bundleId));
  target.pbxNativeTarget.productType = '"com.apple.product-type.application"';
  const product = project.pbxFileReferenceSection()[target.pbxNativeTarget.productReference];
  product.explicitFileType = '"wrapper.application"';
  project.addBuildPhase(sources, 'PBXSourcesBuildPhase', 'Sources', target.uuid);
  project.addBuildPhase(['Assets.xcassets', 'squeaklet.usdz', 'lil-ratti.usdz', 'PrivacyInfo.xcprivacy'],
    'PBXResourcesBuildPhase', 'Resources', target.uuid);
  project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
  const appConfigs = project.pbxXCConfigurationList()[app.firstTarget.buildConfigurationList];
  const team = appConfigs.buildConfigurations.map((ref) =>
    project.pbxXCBuildConfigurationSection()[ref.value]?.buildSettings.DEVELOPMENT_TEAM).find(Boolean);
  const configs = project.pbxXCConfigurationList()[target.pbxNativeTarget.buildConfigurationList];
  for (const ref of configs.buildConfigurations) {
    const config = project.pbxXCBuildConfigurationSection()[ref.value];
    config.buildSettings = { ...config.buildSettings,
      PRODUCT_NAME: `"${TARGET_NAME}"`, PRODUCT_BUNDLE_IDENTIFIER: `"${watchBundleId(bundleId)}"`,
      INFOPLIST_FILE: `"${TARGET_NAME}/WatchInfo.plist"`, GENERATE_INFOPLIST_FILE: 'NO',
      SDKROOT: 'watchos', SUPPORTED_PLATFORMS: '"watchos watchsimulator"',
      WATCHOS_DEPLOYMENT_TARGET: '10.0', TARGETED_DEVICE_FAMILY: '4',
      ARCHS: '"$(ARCHS_STANDARD)"', SWIFT_VERSION: '5.0',
      CLANG_ENABLE_MODULES: 'YES', CODE_SIGN_STYLE: 'Automatic', SKIP_INSTALL: 'YES',
      ASSETCATALOG_COMPILER_APPICON_NAME: 'AppIcon',
      MARKETING_VERSION: version, CURRENT_PROJECT_VERSION: buildNumber,
      LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks"',
    };
    delete config.buildSettings.IPHONEOS_DEPLOYMENT_TARGET;
    if (team) config.buildSettings.DEVELOPMENT_TEAM = team;
    if (config.name === 'Debug') config.buildSettings.SWIFT_ACTIVE_COMPILATION_CONDITIONS = 'DEBUG';
  }
  return project;
}

function objectsFor(project, section) { return project.hash.project.objects[section] ?? {}; }

function writeWatchFiles(iosRoot, bundleId) {
  const dest = path.join(iosRoot, TARGET_NAME);
  fs.mkdirSync(dest, { recursive: true });
  const source = path.join(mobileRoot, 'targets/mon-watch');
  const names = fs.readdirSync(source).filter((name) => name.endsWith('.swift')).sort();
  for (const name of names) fs.copyFileSync(path.join(source, name), path.join(dest, name));
  // One Swift contract for both Apple surfaces, not a divergent Watch copy.
  fs.copyFileSync(path.join(mobileRoot, 'targets/keychain-widget/KeychainSnapshot.swift'),
    path.join(dest, 'WatchSnapshot.swift'));
  names.push('WatchSnapshot.swift');
  fs.writeFileSync(path.join(dest, 'WatchInfo.plist'), watchInfoPlist(bundleId));
  for (const name of ['squeaklet.usdz', 'lil-ratti.usdz']) {
    fs.copyFileSync(path.join(source, 'Models', name), path.join(dest, name));
  }
  fs.writeFileSync(path.join(dest, 'PrivacyInfo.xcprivacy'), `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict><key>NSPrivacyTracking</key><false/>
<key>NSPrivacyCollectedDataTypes</key><array/>
<key>NSPrivacyAccessedAPITypes</key><array><dict>
<key>NSPrivacyAccessedAPIType</key><string>NSPrivacyAccessedAPICategoryUserDefaults</string>
<key>NSPrivacyAccessedAPITypeReasons</key><array><string>CA92.1</string></array>
</dict></array></dict></plist>`);
  const assets = path.join(dest, 'Assets.xcassets');
  const icons = path.join(assets, 'AppIcon.appiconset');
  fs.mkdirSync(icons, { recursive: true });
  fs.writeFileSync(path.join(assets, 'Contents.json'), JSON.stringify({ info: { author: 'xcode', version: 1 } }));
  fs.copyFileSync(path.join(mobileRoot, 'assets/images/icon.png'), path.join(icons, 'AppIcon.png'));
  fs.writeFileSync(path.join(icons, 'Contents.json'), JSON.stringify({
    images: [{ filename: 'AppIcon.png', idiom: 'universal', platform: 'watchos', size: '1024x1024' }],
    info: { author: 'xcode', version: 1 },
  }));
  return names;
}

const withMonWatch = (config) => {
  const bundleId = config.ios?.bundleIdentifier;
  if (!bundleId) throw new Error('with-mon-watch: ios.bundleIdentifier is required');
  config = withWatchCredentials(config, bundleId);
  return withXcodeProject(config, (mod) => {
    const sources = writeWatchFiles(mod.modRequest.platformProjectRoot, bundleId);
    addWatchTarget(mod.modResults, { bundleId, version: config.version ?? '1.0.0',
      buildNumber: config.ios?.buildNumber ?? '1', sources });
    return mod;
  });
};
module.exports = withMonWatch;
Object.assign(module.exports, { TARGET_NAME, watchBundleId, watchInfoPlist, withWatchCredentials, addWatchTarget });
