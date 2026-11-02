import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

let packageJsonPath;
try {
  packageJsonPath = require.resolve('@reactvision/react-viro/package.json');
} catch {
  console.error('[Viro] @reactvision/react-viro is not installed.');
  process.exit(1);
}

const root = dirname(packageJsonPath);
const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const platformSource = join(root, 'components/Utilities/ViroPlatform.ts');
const openXRSource = join(root, 'components/Utilities/VRModuleOpenXR.ts');
const metaTargetingSource = join(root, 'plugins/metaTargeting.ts');

const platformBody = existsSync(platformSource)
  ? readFileSync(platformSource, 'utf8')
  : '';
const openXRBody = existsSync(openXRSource)
  ? readFileSync(openXRSource, 'utf8')
  : '';

const hasPico = platformBody.includes('isPico');
const hasMetaHorizonRuntime = platformBody.includes('isMetaHorizonXR');
const hasRivePanel = existsSync(join(root, 'components/ViroRivePanel.tsx'));
const hasSpatialLayout = existsSync(
  join(root, 'components/Spatial/ViroSpatialLayout.tsx'),
);
const hasOpenXRBridge = existsSync(openXRSource);
const hasOpenXRCapabilityProbe =
  openXRBody.includes('getOpenXRRuntimeCapabilities');
const hasMetaVrGlassesTargeting =
  existsSync(metaTargetingSource) &&
  readFileSync(metaTargetingSource, 'utf8').includes(
    'metaVrGlassesCompatible',
  );

const expoPeers = String(pkg.peerDependencies?.expo ?? '');
const rnPeers = String(pkg.peerDependencies?.['react-native'] ?? '');
const sdk58PeerLane =
  expoPeers.includes('<59') &&
  rnPeers.includes('<0.89');

const forkCompatible =
  sdk58PeerLane &&
  hasPico &&
  hasMetaHorizonRuntime &&
  hasRivePanel &&
  hasSpatialLayout &&
  hasOpenXRBridge &&
  hasOpenXRCapabilityProbe &&
  hasMetaVrGlassesTargeting;

if (!forkCompatible) {
  console.error(`
[Viro] Native/headset development requires the mikevocalz SDK-58 fork.

Resolved package:
  ${packageJsonPath}
Resolved version:
  ${pkg.version ?? 'unknown'}

The pnpm-workspace.yaml catalog pins @reactvision/react-viro to
github:mikevocalz/viro at a commit on main. Something resolved a different
copy (an override, a stale install, or the public npm package), and that copy
lacks the capabilities below. The public package is NOT accepted for Expo
SDK 58 native/headset builds.

Restore the catalog pin and its matching allowBuilds entry, then:

  pnpm install

Required fork capabilities:
  Expo <59 peer lane
  React Native <0.89 peer lane
  PICO platform detection
  generalized Meta Horizon runtime detection
  Meta VR Glasses Store targeting
  ViroRivePanel
  ViroSpatialLayout
  VRModuleOpenXR
  typed OpenXR runtime capability probe
`);
  process.exit(1);
}

console.log(
  `[Viro] Native fork verified: ${pkg.version} (${packageJsonPath})`,
);
