// Static image imports. Vite yields a URL string, Next (Turbopack)
// StaticImageData, Metro a numeric asset id.
declare module '*.webp' {
  const value: string | number | { src: string; width: number; height: number };
  export default value;
}
