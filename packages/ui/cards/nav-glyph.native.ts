// Slider chevron size. Lucide on native sizes from a prop, so the md breakpoint
// is read through Uniwind: 20 on phones, 32 from md (tablets).
import { useResolveClassNames } from 'uniwind';

export function useNavGlyph(): { size: number; className: string } {
  const { width } = useResolveClassNames('w-[20px] md:w-[32px]') as { width?: number };
  return { size: width ?? 20, className: '' };
}
