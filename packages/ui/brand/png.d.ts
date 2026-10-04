// Static image imports. Next (Turbopack) yields StaticImageData, Vite a URL
// string, Metro a numeric asset id; logoSource.* normalises all three.
declare module '*.png' {
  const value: string | number | { src: string; width: number; height: number };
  export default value;
}
