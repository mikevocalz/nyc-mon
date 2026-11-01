// Platform resolution anchor; bundlers load the .web/.native forks. It must be
// `.tsx` like its forks: Metro tries every `.ts` variant before any `.tsx`, so
// a `.ts` anchor here wins on native and ships the web <canvas> to the device.
export { ThreeSurface } from './surface.web';
