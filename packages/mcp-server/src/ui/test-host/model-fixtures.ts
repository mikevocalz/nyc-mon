import { fileURLToPath } from 'node:url';

/** Authored rigs for offline browser contracts, never published as production model URLs. */
const MODELS: Readonly<Record<string, URL>> = {
  'metro-egg.glb': new URL('../../../../assets/eggs/metro-egg/metro-egg-hatch.glb', import.meta.url),
  'squeaklet.glb': new URL('../../../../ui/three/test-fixtures/mons/squeaklet.glb', import.meta.url),
  'lil-ratti.glb': new URL('../../../../ui/three/test-fixtures/mons/lil-ratti.glb', import.meta.url),
};

export function modelFixturePath(name: string): string {
  const model = MODELS[name];
  if (!model) throw new Error(`No authored model fixture: ${name}`);
  return fileURLToPath(model);
}
