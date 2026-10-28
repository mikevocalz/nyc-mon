// Bundled GLB files. Vite and Turbopack emit them as assets and yield a URL
// string; Metro (assetExts includes glb) yields a numeric asset id.
declare module '*.glb' {
  const value: string | number;
  export default value;
}
