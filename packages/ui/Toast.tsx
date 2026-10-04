import { View } from './tw';
import { Text } from './Text';
import { SlideUp } from './motion';
import { ToastCard, type ToastCardProps } from './ToastCard';
import type { District, Tone } from './elements/tones';
import type { NeonColorInput } from './neon/colors';


export interface ToastProps {
  variant?: ToastCardProps['variant'];
  title: string;
  description?: string;
  className?: string;
  /** The storefront card is the only look; kept so older callers compile. */
  appearance?: 'default' | 'neon';
  /** neon: colour by neighbourhood. Default midtown. */
  district?: District;
  /** neon: brand token or NeonBlade preset; overrides the district. */
  color?: NeonColorInput | Tone;
}

export function Toast({ variant, title, description, className, district, color }: ToastProps) {
  return (
    <SlideUp className="w-full">
      <ToastCard
        variant={variant ?? 'info'}
        title={title}
        description={description}
        district={district}
        color={color}
        className={className}
      />
    </SlideUp>
  );
}
