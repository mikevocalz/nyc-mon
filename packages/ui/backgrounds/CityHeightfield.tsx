'use client';

/**
 * CityHeightfield is HolographicTerrain: the 3D three.js port of NeonBlade
 * UI's Holographic Terrain (three/HolographicTerrain). The name stays for
 * existing screens and stories; the flat 2D version it used to be is
 * CityHeightfieldFlat, now the fallback.
 */
export {
  HolographicTerrain as CityHeightfield,
  type HolographicTerrainProps as CityHeightfieldProps,
} from '../three/HolographicTerrain';
