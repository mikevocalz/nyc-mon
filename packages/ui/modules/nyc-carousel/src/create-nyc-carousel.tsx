import type { ComponentType, ReactElement, ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { NycCarouselProps } from './NycCarousel.types';

/** The two @expo/ui pieces a platform supplies: its Host and its RNHostView. */
interface HostPieces {
  Host: ComponentType<{ matchContents?: boolean | { vertical?: boolean; horizontal?: boolean }; style?: StyleProp<ViewStyle>; children: ReactNode }>;
  RNHostView: ComponentType<{ matchContents?: boolean | { vertical?: boolean; horizontal?: boolean }; children: ReactElement }>;
}

type NativeProps = Omit<NycCarouselProps, 'slides' | 'onIndexChange' | 'style'> & {
  onIndexChange?: (event: { nativeEvent: { index: number } }) => void;
  children: ReactNode;
};

/**
 * Builds the platform carousel. The native module is optional: Expo Go and
 * binaries built before this module existed don't have it, and iOS below 17
 * reports `isSupported: false`. In those cases `available` is false and the
 * caller keeps its React Native fallback.
 */
export function createNycCarousel({ Host, RNHostView }: HostPieces) {
  const nativeModule = requireOptionalNativeModule<{ isSupported?: boolean }>('NycCarousel');
  const available = nativeModule?.isSupported === true;
  const NativeView = available ? requireNativeView<NativeProps>('NycCarousel', 'NycCarouselView') : null;

  function NycCarousel({ slides, onIndexChange, style, ...rest }: NycCarouselProps) {
    if (!NativeView) return null;
    return (
      // Width comes from the React Native parent; height from the tallest card.
      <Host matchContents={{ vertical: true }} style={style}>
        <NativeView
          {...rest}
          onIndexChange={onIndexChange ? (e) => onIndexChange(e.nativeEvent.index) : undefined}
        >
          {slides.map((slide, i) => (
            <RNHostView key={slide.key ?? i} matchContents={{ vertical: true }}>
              {slide}
            </RNHostView>
          ))}
        </NativeView>
      </Host>
    );
  }

  return { NycCarousel, available };
}
