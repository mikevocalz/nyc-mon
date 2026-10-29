// Slider chevron size. Web: a CSS class overrides lucide's width/height
// attributes, so no runtime breakpoint read (Uniwind does not run under Next).
export function useNavGlyph(): { size: number; className: string } {
  return { size: 20, className: 'md:size-8' };
}
