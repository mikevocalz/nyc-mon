import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const watch = require('../../plugins/with-mon-watch.js');
const widget = require('../../plugins/with-keychain-widget.js');
const skia = require('../../plugins/with-skia-wgpu-instance.js');
const configPlugins = dirname(require.resolve('@expo/config-plugins/package.json', {
  paths: [dirname(require.resolve('expo/package.json'))],
}));
const xcode = require(require.resolve('xcode', { paths: [configPlugins] }));
const fixture = fileURLToPath(new URL('./fixtures/expo-58-app.pbxproj', import.meta.url));
const options = { bundleId: 'com.nycmon.app', version: '0.1.0', buildNumber: '9',
  sources: ['MonWatchApp.swift', 'WatchSnapshot.swift'] };

test('Watch target embeds in the host, keeps native metadata, and receives no iOS Skia flag', () => {
  const project = xcode.project(fixture).parseSync();
  const host = project.getFirstTarget();
  const before = structuredClone(project.pbxXCBuildConfigurationSection());
  watch.addWatchTarget(project, options);
  widget.addKeychainTarget(project, { ...options, sources: ['MonKeychainBundle.swift'] });
  const targets = Object.entries<any>(project.pbxNativeTargetSection()).filter(([id]) => !id.endsWith('_comment'));
  const [watchId, target] = targets.find(([, value]) => value.name?.replace(/"/g, '') === 'MonWatch')!;
  assert.equal(target.productType, '"com.apple.product-type.application"');
  const configs = project.pbxXCConfigurationList()[target.buildConfigurationList].buildConfigurations;
  for (const { value } of configs) {
    const settings = project.pbxXCBuildConfigurationSection()[value].buildSettings;
    assert.equal(settings.SDKROOT, 'watchos');
    assert.equal(settings.TARGETED_DEVICE_FAMILY, '4');
    assert.equal(settings.INFOPLIST_FILE, '"MonWatch/WatchInfo.plist"');
    assert.equal(settings.PRODUCT_BUNDLE_IDENTIFIER, '"com.nycmon.app.watchkitapp"');
    assert.ok(!skia.appConfigurationIds(project).has(value));
  }
  const deps = project.hash.project.objects.PBXTargetDependency;
  assert.ok(host.firstTarget.dependencies.some((ref: any) => deps[ref.value]?.target === watchId));
  const copy = Object.values<any>(project.hash.project.objects.PBXCopyFilesBuildPhase)
    .find((value) => value.name === '"Embed Watch Content"');
  assert.equal(copy.dstPath, '"$(CONTENTS_FOLDER_PATH)/Watch"');
  for (const [id, config] of Object.entries(before)) {
    assert.equal(JSON.stringify(project.pbxXCBuildConfigurationSection()[id]), JSON.stringify(config));
  }
  assert.match(watch.watchInfoPlist(options.bundleId), /WKCompanionAppBundleIdentifier<\/key><string>com.nycmon.app/);
});

test('repeated prebuild reconciles added Watch sources without duplicating targets or phases', () => {
  const project = xcode.project(fixture).parseSync();
  watch.addWatchTarget(project, options);
  watch.addWatchTarget(project, { ...options, sources: [...options.sources, 'MonWatchStage.swift'] });
  const before = project.writeSync();
  watch.addWatchTarget(project, { ...options, sources: [...options.sources, 'MonWatchStage.swift'] });
  assert.equal(project.writeSync(), before);
  assert.match(before, /MonWatchStage.swift in Sources/);
});

test('EAS declarations retain widget credentials and unrelated project configuration', () => {
  const config = widget.withEasExtension({ extra: { eas: { projectId: 'existing' } } }, options.bundleId);
  const once = watch.withWatchCredentials(config, options.bundleId);
  assert.deepEqual(watch.withWatchCredentials(once, options.bundleId), once);
  assert.equal(once.extra.eas.projectId, 'existing');
  assert.deepEqual(once.extra.eas.build.experimental.ios.appExtensions.map((entry: any) => entry.targetName),
    ['MonKeychain', 'MonWatch']);
});

test('repeated prebuild updates Watch and widget versions together', () => {
  const project = xcode.project(fixture).parseSync();
  watch.addWatchTarget(project, options);
  widget.addKeychainTarget(project, { ...options, sources: ['MonKeychainBundle.swift'] });
  const next = { ...options, version: '0.2.0', buildNumber: '12' };
  watch.addWatchTarget(project, next);
  widget.addKeychainTarget(project, { ...next, sources: ['MonKeychainBundle.swift'] });
  for (const target of Object.values<any>(project.pbxNativeTargetSection())) {
    if (!['"MonWatch"','"MonKeychain"'].includes(target?.name)) continue;
    const refs = project.pbxXCConfigurationList()[target.buildConfigurationList].buildConfigurations;
    for (const ref of refs) {
      const settings = project.pbxXCBuildConfigurationSection()[ref.value].buildSettings;
      assert.equal(settings.MARKETING_VERSION, '0.2.0');
      assert.equal(settings.CURRENT_PROJECT_VERSION, '12');
    }
  }
});
