// The keychain widget config plugin (plugins/with-keychain-widget.js) and the
// Skia link-flag plugin it has to coexist with, driven against the project
// `expo prebuild --platform ios` writes for this app on Expo 58
// (fixtures/expo-58-app.pbxproj, captured with the keychain plugin off).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const plugin = require('../../plugins/with-keychain-widget.js');
const skia = require('../../plugins/with-skia-wgpu-instance.js');
// The `xcode` parser the plugin's mods receive: @expo/config-plugins' own dependency, resolved through expo.
const configPlugins = dirname(require.resolve('@expo/config-plugins/package.json', { paths: [dirname(require.resolve('expo/package.json'))] }));
const xcode = require(require.resolve('xcode', { paths: [configPlugins] }));

const FIXTURE = fileURLToPath(new URL('./fixtures/expo-58-app.pbxproj', import.meta.url));
const BUNDLE = 'com.nycmon.app';

function freshProject() {
  return xcode.project(FIXTURE).parseSync();
}

function addTarget(project: any) {
  return plugin.addKeychainTarget(project, {
    bundleId: BUNDLE,
    version: '0.1.0',
    buildNumber: '1',
    sources: ['MonKeychainBundle.swift', 'KeychainProvider.swift'],
  });
}

function targets(project: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, t] of Object.entries<any>(project.pbxNativeTargetSection())) {
    if (!key.endsWith('_comment')) out[String(t.name).replace(/"/g, '')] = { ...t, uuid: key };
  }
  return out;
}

function configsOf(project: any, target: any): any[] {
  const list = project.pbxXCConfigurationList()[target.buildConfigurationList];
  return list.buildConfigurations.map((ref: any) => project.pbxXCBuildConfigurationSection()[ref.value]);
}

describe('ids', () => {
  it('derives the App Group and widget bundle id from the app bundle id', () => {
    assert.equal(plugin.appGroupId(BUNDLE), 'group.com.nycmon.app');
    assert.equal(plugin.widgetBundleId(BUNDLE), 'com.nycmon.app.keychain');
  });

  it('adds the App Group once and keeps other groups', () => {
    const once = plugin.withAppGroup({}, 'group.a');
    assert.deepEqual(once['com.apple.security.application-groups'], ['group.a']);
    const twice = plugin.withAppGroup({ 'com.apple.security.application-groups': ['group.x', 'group.a'] }, 'group.a');
    assert.deepEqual(twice['com.apple.security.application-groups'], ['group.x', 'group.a']);
  });

  it('writes the group into the widget Info.plist and entitlements', () => {
    const info = plugin.widgetInfoPlist({ version: '0.1.0', buildNumber: '7', group: 'group.com.nycmon.app' });
    assert.match(info, /<string>com\.apple\.widgetkit-extension<\/string>/);
    assert.match(info, /<key>NYCMonAppGroup<\/key>\s*<string>group\.com\.nycmon\.app<\/string>/);
    assert.match(info, /<string>7<\/string>/);
    assert.match(plugin.widgetEntitlements('group.com.nycmon.app'), /<string>group\.com\.nycmon\.app<\/string>/);
  });

  it('finds every widget source, sorted', () => {
    const sources: string[] = plugin.listSwiftSources();
    assert.ok(sources.includes('MonKeychainBundle.swift'));
    assert.ok(sources.includes('Views/KeychainEntryView.swift'));
    assert.deepEqual([...sources].sort(), sources);
  });
});

describe('addKeychainTarget', () => {
  it('adds an app-extension target the app depends on and embeds in PlugIns', () => {
    const project = addTarget(freshProject());
    const all = targets(project);
    const widget = all[plugin.TARGET_NAME];
    assert.ok(widget, 'target exists');
    assert.equal(widget.productType, '"com.apple.product-type.app-extension"');

    const app = all.NYCMON;
    const deps = project.hash.project.objects.PBXTargetDependency;
    assert.ok(app.dependencies.some((d: any) => deps[d.value]?.target === widget.uuid), 'app depends on the widget');

    const copy = project.hash.project.objects.PBXCopyFilesBuildPhase;
    const embed = Object.entries<any>(copy).find(([k, p]) => !k.endsWith('_comment') && p.files?.length > 0);
    assert.ok(embed, 'an embed phase holds the appex');
    assert.equal(embed[1].dstSubfolderSpec, 13, 'PlugIns');
    assert.ok(app.buildPhases.some((p: any) => p.value === embed[0]), 'the embed phase belongs to the app');
  });

  it('compiles the given sources in the widget target', () => {
    const project = addTarget(freshProject());
    const widget = targets(project)[plugin.TARGET_NAME];
    const sources = project.hash.project.objects.PBXSourcesBuildPhase;
    const phase = widget.buildPhases.map((p: any) => sources[p.value]).find(Boolean);
    const names = phase.files.map((f: any) => String(f.comment).replace(/"/g, ''));
    assert.deepEqual(names.sort(), ['KeychainProvider.swift in Sources', 'MonKeychainBundle.swift in Sources']);
  });

  it('sets the widget build settings in Debug and Release', () => {
    const project = addTarget(freshProject());
    const configs = configsOf(project, targets(project)[plugin.TARGET_NAME]);
    assert.equal(configs.length, 2);
    for (const c of configs) {
      assert.equal(c.buildSettings.PRODUCT_BUNDLE_IDENTIFIER, '"com.nycmon.app.keychain"');
      assert.equal(c.buildSettings.INFOPLIST_FILE, '"MonKeychain/Info.plist"');
      assert.equal(c.buildSettings.CODE_SIGN_ENTITLEMENTS, '"MonKeychain/MonKeychain.entitlements"');
      assert.equal(c.buildSettings.IPHONEOS_DEPLOYMENT_TARGET, '17.0');
      assert.equal(c.buildSettings.APPLICATION_EXTENSION_API_ONLY, 'YES');
      assert.equal(c.buildSettings.TARGETED_DEVICE_FAMILY, '"1,2"');
    }
  });

  it('is idempotent: a second prebuild pass adds nothing', () => {
    const project = addTarget(freshProject());
    const before = project.writeSync();
    addTarget(project);
    assert.equal(project.writeSync(), before);
  });
});

describe('with-skia-wgpu-instance next to the widget', () => {
  it('forces the Skia symbol on the app only, never on the extension (it links no Skia)', () => {
    const project = addTarget(freshProject());
    const ids: Set<string> = skia.appConfigurationIds(project);
    const all = targets(project);
    const appConfigs = project.pbxXCConfigurationList()[all.NYCMON.buildConfigurationList].buildConfigurations.map((r: any) => r.value);
    const widgetConfigs = project.pbxXCConfigurationList()[all[plugin.TARGET_NAME].buildConfigurationList].buildConfigurations.map((r: any) => r.value);
    for (const id of appConfigs) assert.ok(ids.has(id));
    for (const id of widgetConfigs) assert.ok(!ids.has(id));
  });
});
