// TS resolution anchor; bundlers load the .native/.web forks. Same `.ts`
// extension as both forks, and imported without an extension, so Metro's
// platform resolution is never bypassed.
export { getHardwareInputSource } from './get-hardware-input-source.web';
