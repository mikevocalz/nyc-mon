import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Checks the XR contract of the generated Android project.
 *
 * apps/mobile/android is Continuous Native Generation output (gitignored), so
 * this runs after `expo prebuild --platform android`. It fails when a config
 * plugin stops emitting something the Quest or PICO flavor depends on.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const android = join(root, 'apps/mobile/android');
const pkgDir = 'app/src/main/java/com/nycmon/app';

if (!existsSync(join(android, 'settings.gradle'))) {
  console.error(
    '[spatial:verify-android] apps/mobile/android does not exist. It is generated: run\n' +
      '  pnpm --filter mobile exec expo prebuild --platform android --no-install\n' +
      'first.',
  );
  process.exit(1);
}

const read = (relative) => readFileSync(join(android, relative), 'utf8');

// The public Viro 3.0.2 plugin knows AR and QUEST only; the mikevocalz fork
// also registers PICO and wires Meta's spatial layout library. Require those
// only when the fork is installed.
const viroPkg = JSON.parse(
  readFileSync(
    join(root, 'apps/mobile/node_modules/@reactvision/react-viro/package.json'),
    'utf8',
  ),
);
const viroFork = viroPkg.version !== '3.0.2';

const checks = [
  ['settings.gradle', [
    "include ':react_viro', ':arcore_client', ':gvr_common', ':viro_renderer'",
  ]],
  ['app/build.gradle', [
    "implementation project(path: ':react_viro')",
    "implementation project(path: ':viro_renderer')",
    // Meta spatial layout (metaSpatialLayout) is a fork plugin option.
    ...(viroFork
      ? ['com.meta.metavrx:metavrx-bom:1.2026.0.0', 'layout-react-compat', 'layout-window-react-compat']
      : []),
    'flavorDimensions += "device"',
    'mobile { dimension "device" }',
    'pico {',
    'quest {',
  ]],
  ['gradle.properties', [
    'reactNativeArchitectures=arm64-v8a',
    'android.targetSdkVersion=34',
    'android.minSdkVersion=29',
    'picoXrMode=pico-os5',
  ]],
  [`${pkgDir}/MainApplication.kt`, [
    'ReactViroPackage.ViroPlatform.AR',
    'ReactViroPackage.ViroPlatform.QUEST',
    ...(viroFork ? ['ReactViroPackage.ViroPlatform.PICO'] : []),
  ]],
  [`${pkgDir}/VRActivity.kt`, [
    'getMainComponentName(): String = "VRQuestScene"',
  ]],
  ['app/src/main/AndroidManifest.xml', [
    'android:scheme="nycmon"',
    'android:name=".VRActivity"',
    'com.oculus.intent.category.VR',
    'com.oculus.supportedDevices',
    'horizonos.permission.USE_ANCHOR_API',
    'com.oculus.permission.HAND_TRACKING',
    'com.oculus.feature.PASSTHROUGH',
    'android:glEsVersion="0x00030000"',
  ]],
  ['app/src/quest/AndroidManifest.xml', [
    'com.oculus.supportedDevices" android:value="quest2|questpro|quest3|quest3s"',
    'android:defaultWidth="1280dp"',
    'android:defaultHeight="800dp"',
  ]],
  ['app/src/pico/AndroidManifest.xml', [
    'com.pico.intent.category.VR',
    'org.khronos.openxr.intent.category.IMMERSIVE_HMD',
    'libopenxr_loader.so',
    'com.pico.xrMode" android:value="pico-os5"',
    'android:defaultWidth="1280dp"',
    'android:defaultHeight="800dp"',
  ]],
  ['app/src/main/res/values/strings.xml', [
    '<string name="app_name">NYC-MON</string>',
  ]],
];

const failures = [];
for (const [relative, needles] of checks) {
  if (!existsSync(join(android, relative))) {
    failures.push(`${relative}: missing`);
    continue;
  }
  const body = read(relative);
  for (const needle of needles) {
    if (!body.includes(needle)) failures.push(`${relative}: missing ${needle}`);
  }
}

const manifest = read('app/src/main/AndroidManifest.xml');
if (manifest.includes('android.permission.SYSTEM_ALERT_WINDOW') &&
  !read('app/src/quest/AndroidManifest.xml').includes(
    'android.permission.SYSTEM_ALERT_WINDOW" tools:node="remove"',
  )) {
  failures.push('SYSTEM_ALERT_WINDOW must be stripped from the Quest flavor');
}

// One native Skia: the @shopify alias resolves to the same directory, and
// autolinking would register it as a second native project unless disabled.
const rnConfig = join(root, 'apps/mobile/react-native.config.js');
if (!existsSync(rnConfig) || !readFileSync(rnConfig, 'utf8').includes("'@shopify/react-native-skia'")) {
  failures.push('apps/mobile/react-native.config.js: must disable autolinking for the @shopify/react-native-skia alias');
}

if (failures.length) {
  console.error('[spatial:verify-android] Android XR contract drift:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(
  `[spatial:verify-android] mobile, quest and pico flavors match the XR contract (Viro ${viroPkg.version}).`,
);
