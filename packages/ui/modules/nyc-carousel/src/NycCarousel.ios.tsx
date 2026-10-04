import { Host, RNHostView } from '@expo/ui/swift-ui';
import { createNycCarousel } from './create-nyc-carousel';

// iOS: the SwiftUI carousel (ios/NycCarouselScroll.swift).
export const { NycCarousel, available: isNycCarouselAvailable } = createNycCarousel({ Host, RNHostView });
