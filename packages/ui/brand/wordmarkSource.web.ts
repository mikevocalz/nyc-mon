/// <reference path="../../assets/photos/webp.d.ts" />
import wordmark from '../../assets/brand/nyc-mon-wordmark-432.webp';
import type { ImageSourcePropType } from 'react-native';

// 432×144 resample of packages/assets/brand/nyc-mon-wordmark.png (the
// 2172×724 master), re-encoded as near-lossless WebP (0/255 channel error
// against the PNG). Resized only: never recoloured, cropped or filtered.
const uri = typeof wordmark === 'object' ? wordmark.src : String(wordmark);

export const wordmarkSource: ImageSourcePropType = { uri, width: 432, height: 144 };
