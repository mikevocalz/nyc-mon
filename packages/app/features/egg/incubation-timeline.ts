// The incubation steps M10 and M11 list beside the 3D H-Lynk on tablets.
// Pure: the clock formatter is injected so node tests pin the output.
import { eggCopy } from './copy.ts';

export type IncubationStage = 'choosing' | 'incubating' | 'ready';

export interface IncubationTimelineInput {
  readonly eggName: string;
  readonly stage: IncubationStage;
  /** The picked wait as words ("30 minutes"), or null before one is picked. */
  readonly duration: string | null;
  /** When incubation started (M11), or null on M10. */
  readonly startedAt: number | null;
  /** When the egg is ready: the projected time on M10, the real one on M11; null before a pick. */
  readonly readyAt: number | null;
  readonly clock: (ms: number) => string;
}

/** One step, shaped for the kit `Timeline` (`TimelineItemData`). */
export interface IncubationStep {
  readonly title: string;
  readonly date?: string;
  readonly description?: string;
  readonly active: boolean;
}

/** Chosen → incubating → ready → hatch, with the current one marked. Earlier steps read as done. */
export function incubationTimeline({ eggName, stage, duration, startedAt, readyAt, clock }: IncubationTimelineInput): IncubationStep[] {
  const now = eggCopy('pane.incubation.now');
  const wait: IncubationStep = {
    title: eggCopy('pane.incubation.wait'),
    date: startedAt === null ? (stage === 'choosing' ? now : undefined) : eggCopy('pane.incubation.started', { time: clock(startedAt) }),
    description: duration === null ? eggCopy('pane.incubation.wait.pick') : eggCopy('pane.incubation.wait.for', { duration }),
    active: stage === 'choosing' || stage === 'incubating',
  };
  return [
    { title: eggCopy('pane.incubation.chosen', { eggName }), active: false },
    wait,
    {
      title: eggCopy('pane.incubation.ready'),
      date: readyAt === null ? undefined : eggCopy('pane.incubation.ready.at', { time: clock(readyAt) }),
      active: stage === 'ready',
    },
    { title: eggCopy('pane.incubation.hatch'), description: eggCopy('pane.incubation.hatch.body'), active: false },
  ];
}
