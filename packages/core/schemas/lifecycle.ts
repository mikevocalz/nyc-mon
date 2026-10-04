import { z } from 'zod';

/** Bible v11 §Lifecycle: Egg → Baby → Small → Mid → Max. Phase 1 reaches Baby. */
export const LIFECYCLE_STAGES = ['Egg', 'Baby', 'Small', 'Mid', 'Max'] as const;

export const LifecycleStageSchema = z.enum(LIFECYCLE_STAGES);
