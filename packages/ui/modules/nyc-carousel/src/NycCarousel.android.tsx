import { Host, RNHostView } from '@expo/ui/jetpack-compose';
import { createNycCarousel } from './create-nyc-carousel';

// Android: Material 3 carousels (android/.../NycCarouselContent.kt).
export const { NycCarousel, available: isNycCarouselAvailable } = createNycCarousel({ Host, RNHostView });
