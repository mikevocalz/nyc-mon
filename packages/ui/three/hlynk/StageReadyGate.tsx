'use client';

import { use } from 'react';
import type { StageReadyResource } from './stage-ready';

/**
 * Suspends until `resource` settles, then renders nothing. Put it in a
 * `<Suspense fallback={loader}>` BESIDE the DeviceStage, never around it: the
 * stage has to stay mounted to draw the frame that settles the resource.
 */
export function StageReadyGate({ resource }: { resource: StageReadyResource }) {
  use(resource.promise);
  return null;
}
