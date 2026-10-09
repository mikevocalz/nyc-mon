/**
 * The two Mon views. Both are the same View (view/main.tsx, view/MonView.tsx)
 * built with a different starting layout; the card expands to the room in place.
 *
 *  - mon-card: Inline. The kit Card (notch, starter tone) holding M13 Home's
 *    care view: picture, name, Bloodline, status chip, care rings, and the
 *    Feed / Rest or Wake / Play / Journal bar.
 *  - mon-room: Fullscreen. The same card filling the canvas, plus M18's
 *    timeline rows when the tool result carries a journal.
 */
export const UI_VIEWS = {
  'mon-card': {
    title: 'NYC-MON status card',
    description: "Your Mon's picture, status and care rings, with Feed, Rest, Play and Journal.",
    preferredMode: 'inline',
  },
  'mon-room': {
    title: 'NYC-MON room',
    description: 'Your Mon full screen: picture, status, care rings, actions and recent journal moments.',
    preferredMode: 'fullscreen',
  },
} as const;

export type UiViewId = keyof typeof UI_VIEWS;
