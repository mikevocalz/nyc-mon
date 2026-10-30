// Every string on the website's city walk (/city/walk). Voice rules: docs/COPY_DECK.md (sentence case, plain verbs,
// errors say what happened and what to do, never apologise). The walk is the website's guest view of the Game
// world: no Caller, no save, no session.
export const CITY_WALK_COPY = {
  title: 'Walk the city',
  intro:
    'This is the New York the Game is built on, starting on 125th Street by the Apollo. Streets, storefronts and towers stream in as you move. Your Caller and Mon join you in the app.',
  stageLabel: '3D map of the city',
  stageHint:
    'Arrow keys or W A S D move, Q and E turn, plus and minus zoom, R goes back to the start. Drag to move, pinch to zoom, twist to turn.',
  keysTitle: 'Controls',
  keys: [
    { keys: 'Arrow keys or W A S D', action: 'Move' },
    { keys: 'Q and E', action: 'Turn' },
    { keys: '+ and −, or the scroll wheel', action: 'Zoom' },
    { keys: 'R', action: 'Back to the start' },
    { keys: 'Drag, pinch, twist', action: 'Move, zoom and turn on a touch screen' },
  ],
  focusPrompt: 'Select the map to use the keyboard',
  loading: 'Building the city',
  loadingA11y: 'Building the city: loading streets, buildings and storefronts',
  ready: 'The city is ready.',
  controls: {
    group: 'Map controls',
    forward: 'Move forward',
    back: 'Move back',
    left: 'Move left',
    right: 'Move right',
    turnLeft: 'Turn left',
    turnRight: 'Turn right',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    reset: 'Back to the start',
  },
  unsupported: {
    title: 'This browser can’t draw the 3D city',
    description:
      'The city needs WebGPU or WebGL 2. Turn on hardware acceleration in your browser settings, or open this page in a current Chrome, Edge, Safari or Firefox.',
  },
  renderError: {
    title: 'The 3D view stopped drawing',
    description: 'The browser’s graphics reported an error. Try again; if it keeps happening, reload the page.',
    action: 'Try again',
  },
  dataError: {
    title: 'The city map didn’t load',
    description: 'The map data in this version of the site is damaged. Reload the page to get a fresh copy.',
  },
  credit: '© OpenStreetMap contributors, ODbL 1.0',
  creditA11y: 'Map data © OpenStreetMap contributors, ODbL 1.0. Opens the OpenStreetMap copyright page',
  getApp: 'Get the app',
} as const;
