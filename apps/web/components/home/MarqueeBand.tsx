import { Text, View } from '@acme/ui/tw';
import { W01_COPY } from './copy';

/**
 * The MTA-ticker strip under the hero: the slogan repeated in display type
 * on signage black. Static — it reads as signage, not a scroll widget.
 */
export function MarqueeBand() {
  const line = Array.from({ length: 6 }, () => W01_COPY.hero.marquee).join('  ✦  ');
  return (
    <View className="w-full overflow-hidden border-y-4 border-orange-500 bg-ink-950 py-3" aria-hidden>
      <Text className="whitespace-nowrap px-6 font-display text-lg uppercase tracking-[0.3em] text-ink-50">
        {`${line}  ✦`}
      </Text>
    </View>
  );
}
