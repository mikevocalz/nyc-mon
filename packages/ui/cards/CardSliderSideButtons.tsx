'use client';
import { ChevronLeft, ChevronRight } from '../icons';
import { IconButton } from '../IconButton';
import { View } from '../tw';
import { stepIndex } from './card-slider-model';
import { TONE_CLASSES, type ControlTone } from './tones';

interface SideButtonsProps {
  index: number;
  maxIndex: number;
  loop: boolean;
  tone: ControlTone;
  onGo: (index: number) => void;
}

/** Previous and next over the track's left and right edges, vertically centred. */
export function CardSliderSideButtons({ index, maxIndex, loop, tone, onGo }: SideButtonsProps) {
  const atStart = !loop && index <= 0;
  const atEnd = !loop && index >= maxIndex;
  return (
    <>
      <View pointerEvents="box-none" className="absolute bottom-0 left-0 top-0 z-20 justify-center">
        <IconButton
          variant="cornerCut"
          tone={tone}
          corner="bottom-left"
          aria-label="Previous card"
          disabled={atStart}
          onPress={() => onGo(stepIndex(index, -1, maxIndex, loop))}
          icon={<ChevronLeft size={20} className={atStart ? 'text-ink-700' : TONE_CLASSES[tone].onFace} />}
        />
      </View>
      <View pointerEvents="box-none" className="absolute bottom-0 right-0 top-0 z-20 justify-center">
        <IconButton
          variant="cornerCut"
          tone={tone}
          corner="bottom-right"
          aria-label="Next card"
          disabled={atEnd}
          onPress={() => onGo(stepIndex(index, 1, maxIndex, loop))}
          icon={<ChevronRight size={20} className={atEnd ? 'text-ink-700' : TONE_CLASSES[tone].onFace} />}
        />
      </View>
    </>
  );
}
