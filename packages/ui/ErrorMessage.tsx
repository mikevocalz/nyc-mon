import { View } from './tw';
import { Text } from './Text';
import { NEON_FIELD } from './cards/neon-field';

export interface ErrorMessageProps {
  message?: string;
  className?: string;
}

/**
 * A form-level error: the themed `danger` colour (apple 600 on daylit, apple
 * 400 on night) in the display face, led by a solid apple block so the state
 * is not carried by colour alone. Renders nothing when
 * there is no message, so the row collapses.
 */
export function ErrorMessage({ message, className }: ErrorMessageProps) {
  if (!message) return null;
  return (
    <View className={`flex-row items-start gap-2 ${className ?? ''}`}>
      <View aria-hidden className="mt-1 h-2.5 w-2.5 shrink-0 border-2 border-apple-700 bg-apple-500" />
      <Text role="alert" className={`min-w-0 flex-1 ${NEON_FIELD.message}`}>
        {message}
      </Text>
    </View>
  );
}
