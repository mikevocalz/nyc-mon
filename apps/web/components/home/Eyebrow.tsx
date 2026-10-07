import { Text, View } from '@acme/ui/tw';

/**
 * The section kicker: a short orange rule and an uppercase label above each
 * section title. `night` flips the text to orange for the dark hatch band.
 */
export function Eyebrow({ children, night = false }: { children: string; night?: boolean }) {
  return (
    <View className="flex-row items-center gap-3" aria-hidden>
      <View className="h-0.5 w-8 bg-orange-500" />
      <Text className={`text-type-tag font-extrabold uppercase ${night ? 'text-orange-500' : 'text-royal-500'}`}>
        {children}
      </Text>
    </View>
  );
}
