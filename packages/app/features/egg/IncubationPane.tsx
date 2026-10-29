'use client';

import { Timeline } from '@acme/ui/elements';
import { CompanionPane } from '../companion/CompanionPane';
import { eggCopy } from './copy';
import { incubationTimeline, type IncubationTimelineInput } from './incubation-timeline';

/**
 * M10 and M11's companion pane on tablets: the incubation steps, chosen egg
 * to hatch, with the current one marked (kit Timeline). `null` input while
 * the egg is still loading shows the pane's loading state.
 */
export function IncubationPane({ input, reducedMotion, testID }: {
  readonly input: IncubationTimelineInput | null;
  readonly reducedMotion: boolean;
  readonly testID: string;
}) {
  return (
    <CompanionPane title={eggCopy('pane.incubation.title')} testID={testID} loading={input === null}>
      {input === null ? null : (
        <Timeline
          items={incubationTimeline(input)}
          accessibilityLabel={eggCopy('pane.incubation.a11y')}
          animate={!reducedMotion}
          dotAnim={reducedMotion ? 'none' : 'pulse'}
          align="left"
        />
      )}
    </CompanionPane>
  );
}
