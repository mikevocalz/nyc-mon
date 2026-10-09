import type { ActionId } from './contract.ts';

/**
 * The tools the card's buttons call through the MCP Apps bridge
 * (`tools/call` from the View). Each one is also a voice intent, so every
 * button has a spoken twin and nothing on the card is touch-only.
 *
 * Lane A owns these tools. The View sends only what is listed here:
 *  - feed_mon: no item. "Share a meal" (D-15e) serves no named food, so
 *    `itemId` must be optional on the server.
 *  - rest_mon: puts the Mon to sleep (CareAction 'rest').
 *  - wake_mon: wakes a sleeping Mon (CareAction 'wake'); the Rest button
 *    becomes "Wake {name}" while the Mon is asleep.
 *  - play_with_mon: no `quality`. The card runs no Peek round, so it reports
 *    none and the server's default applies.
 * Each must return `structuredContent` with `mon` and `care` so the card
 * redraws from the result.
 */
export const ACTION_TOOLS: Readonly<Record<ActionId, string>> = {
  feed: 'feed_mon',
  rest: 'rest_mon',
  wake: 'wake_mon',
  play: 'play_with_mon',
};

export function actionArguments(_id: ActionId, monId: string): Record<string, unknown> {
  return { monId };
}
