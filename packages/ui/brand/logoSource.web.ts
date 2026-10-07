/// <reference path="../../assets/photos/webp.d.ts" />
import logo from '../../assets/brand/nyc-mon-logo-416.webp';
import type { ImageSourcePropType } from 'react-native';

// 416px resample of packages/assets/brand/nyc-mon-logo.png (the master): 2x
// the largest web render (208 CSS px). Lanczos resize, then near-lossless
// WebP (cwebp -near_lossless 60, alpha kept; max channel error 4/255).
// Never recoloured, cropped or filtered. Native keeps the 640px PNG.
const uri = typeof logo === 'object' ? logo.src : String(logo);

export const logoSource: ImageSourcePropType = { uri, width: 416, height: 416 };
