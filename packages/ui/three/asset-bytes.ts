// The bytes of a bundled binary asset: a Metro asset id on native, a URL on web. The platform split lives in
// hatch/egg-bytes(.native).ts, which the egg and mon rigs already load their GLBs through.
export { fetchEggBytes as fetchAssetBytes } from './hatch/egg-bytes';
