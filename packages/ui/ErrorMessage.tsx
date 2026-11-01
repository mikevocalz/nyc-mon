import { View } from './tw';
import { Text } from './Text';
import { NEON_FIELD } from './cards/neon-field';

export interface ErrorMessageProps {
  message?: string;
  className?: string;
  /**
   * 'night' (default) is the game's field message: display face, tracked.
   * 'page' is the ops console's daylit face (04-components.md G1): body face
   * at regular weight, so a sentence-long error on a form reads as a
   * sentence, not a sign.
   */
  surface?: 'night' | 'page';
}

/** The console's form error: themed danger ink in the body face, regular weight. */
const PAGE_MESSAGE = 'font-sans text-sm leading-relaxed text-danger';

/**
 * A form-level error: the themed `danger` colour (apple 600 on daylit, apple
 * 400 on night) in the display face, led by a solid apple block so the state
 * is not carried by colour alone. Renders nothing when
 * there is no message, so the row collapses.
 */
export function ErrorMessage({ message, className, surface = 'night' }: ErrorMessageProps) {
  if (!message) return null;
  return (
    <View className={`flex-row items-start gap-2 ${className ?? ''}`}>
      <View aria-hidden className="mt-1 h-2.5 w-2.5 shrink-0 border-2 border-apple-700 bg-apple-500" />
      <Text role="alert" className={`min-w-0 flex-1 ${surface === 'page' ? PAGE_MESSAGE : NEON_FIELD.message}`}>
        {message}
      </Text>
    </View>
  );
}
