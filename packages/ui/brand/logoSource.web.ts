/// <reference path="./png.d.ts" />
import logo from '../../assets/brand/nyc-mon-logo-640.png';
import type { ImageSourcePropType } from 'react-native';

// 640px resample of packages/assets/brand/nyc-mon-logo.png (the master).
// Resized only: never recoloured, cropped or filtered.
const uri = typeof logo === 'object' ? logo.src : String(logo);

export const logoSource: ImageSourcePropType = { uri, width: 640, height: 640 };
