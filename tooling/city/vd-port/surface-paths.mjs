import{fileURLToPath}from'node:url';
import{join}from'node:path';
// Ignored project storage survives host temporary-directory resets.
export const SURFACE_WORKSPACE=fileURLToPath(new URL('../../../apps/mobile/.expo/game-assets/',import.meta.url));
export const SURFACE_CAPTURE=join(SURFACE_WORKSPACE,'full-source-provenance.json.gz');
export const SURFACE_PAYLOADS=join(SURFACE_WORKSPACE,'source-payloads');
export const SURFACE_BANK=join(SURFACE_WORKSPACE,'source-bank');
export const SURFACE_OUTPUT=join(SURFACE_WORKSPACE,'source-city');
export const SURFACE_SPOOL=join(SURFACE_WORKSPACE,'source-spool');
export const SURFACE_BAKE_DEPS=join(SURFACE_WORKSPACE,'bake-deps');
export const SURFACE_PBR_FOOTPRINT=join(SURFACE_WORKSPACE,'pbr-source-footprint.json');
export const SURFACE_PILOT_BANK=fileURLToPath(new URL('../../../apps/mobile/.expo/surface-pilot/nycmon-surface-pilot-bank-astc/',import.meta.url));
