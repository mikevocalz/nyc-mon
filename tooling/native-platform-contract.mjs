import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Generated metadata may add entries; existing platform contracts must survive. */
export function assertPreservedContract(expected, actual, path = 'manifest') {
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${path}: missing array`);
    for (const item of expected) {
      assert.ok(actual.some(candidate => {
        try { assertPreservedContract(item, candidate, path); return true; } catch { return false; }
      }), `${path}: existing array entry was lost`);
    }
  } else if (expected && typeof expected === 'object') {
    assert.ok(actual && typeof actual === 'object' && !Array.isArray(actual), `${path}: missing dictionary`);
    for (const [key, value] of Object.entries(expected)) assertPreservedContract(value, actual?.[key], `${path}.${key}`);
  } else assert.ok(Object.is(actual, expected), `${path}: existing value changed`);
}

/** Apple's SDK-only timestamp reason belongs in the SDK, never the app manifest. */
export function assertPrivacyContract(expected, actual, sdkManifests) {
  const baseline = structuredClone(expected);
  for (const entry of baseline.NSPrivacyAccessedAPITypes ?? []) {
    if (entry.NSPrivacyAccessedAPIType !== 'NSPrivacyAccessedAPICategoryFileTimestamp') continue;
    if (!entry.NSPrivacyAccessedAPITypeReasons?.includes('0A2A.1')) continue;
    assert.ok(sdkManifests.some(manifest => manifest.NSPrivacyAccessedAPITypes?.some(sdk =>
      sdk.NSPrivacyAccessedAPIType === entry.NSPrivacyAccessedAPIType &&
      sdk.NSPrivacyAccessedAPITypeReasons?.includes('0A2A.1'))), 'SDK-only timestamp reason must remain in the SDK manifest');
    entry.NSPrivacyAccessedAPITypeReasons = entry.NSPrivacyAccessedAPITypeReasons.filter(reason => reason !== '0A2A.1');
  }
  assertPreservedContract(baseline, actual, 'PrivacyInfo.xcprivacy');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [baseline, generated] = process.argv.slice(2);
  if (!baseline || !generated) throw new Error('Provide baseline and generated iOS app source directories');
  for (const file of ['Info.plist','NYCMON.entitlements','PrivacyInfo.xcprivacy']) {
    const read = root => JSON.parse(execFileSync('plutil',['-convert','json','-o','-',join(root,file)],{encoding:'utf8'}));
    if (file === 'PrivacyInfo.xcprivacy') {
      const sdk = JSON.parse(execFileSync('plutil', ['-convert','json','-o','-',
        new URL('../packages/app/node_modules/expo-file-system/ios/PrivacyInfo.xcprivacy', import.meta.url).pathname], {encoding:'utf8'}));
      assertPrivacyContract(read(baseline), read(generated), [sdk]);
    } else assertPreservedContract(read(baseline),read(generated),file);
  }
  console.log('Existing iOS Info.plist, entitlement and privacy contracts preserved');
}
