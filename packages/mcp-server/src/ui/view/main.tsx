/// <reference lib="dom" />
/**
 * The MCP App entry for both views (ext-apps vanilla `App` bridge, React
 * rendering of the kit). `__ENTRY__` picks the starting layout: `card`
 * (inline) or `room` (fullscreen). Fullscreen is the same document with more
 * room, so the card's Journal button requests fullscreen and re-renders as the
 * room. State is one zustand store.
 */
import './view.css';
import { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { create } from 'zustand';
import { App, type McpUiHostContext } from '@modelcontextprotocol/ext-apps/app-with-deps';
import { ACTION_TOOLS, actionArguments } from '../actions.ts';
import { careOutcomeText, spokenSummary, toMonViewModel, type ActionId, type MonViewModel } from '../contract.ts';
import { MonView } from './MonView.tsx';
import { StatusRow } from '../../../../ui/StatusRow';
import { View } from '../../../../ui/tw';
import { GridBackdrop as RoomBackdrop } from './GridBackdrop.tsx';

/**
 * Keeps a backdrop failure from taking the room with it: if the grid floor
 * throws while rendering, the room drops the backdrop and keeps its sky
 * (the root's own bg) and every control. React needs a class for this.
 */
class BackdropBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    // Handled: the backdrop is decorative, so nothing is logged as an error.
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** The room build carries the grid floor; the card build drops it as dead code. */
const GridBackdrop = __GRID_BACKDROP__ ? RoomBackdrop : null;

declare const __ENTRY__: 'card' | 'room';
/** True for the mon-room build only (build.ts). */
declare const __GRID_BACKDROP__: boolean;

/** Alexa+ visual foundations: author at 768×480, one root zoom per device class. */
const BASE_WIDTH = 768;
const BASE_HEIGHT = 480;
/** Content width (px) under which the card stacks: the Card column (300) plus the ring group (about 240) and a gap. */
const NARROW_BELOW = 600;

/** One surface table; `deviceClass` wins, size is the fallback for hosts that omit it. */
const SURFACES: readonly { match: RegExp; zoom: 'fit' | 'fluid' | 1 }[] = [
  { match: /show.?(5|8|10|15|21)|echo.?show|hub/i, zoom: 'fit' },
  { match: /mobile|phone|tablet/i, zoom: 'fluid' },
  { match: /web|desktop|browser/i, zoom: 1 },
];

interface ViewState {
  host: McpUiHostContext;
  vm: MonViewModel | null;
  busy: ActionId | null;
  notice: string | null;
  /** When the current result arrived; the journal's Today / Yesterday headings read it. */
  nowMs: number;
  /** True when the last care call failed: the notice is then shown, not only announced. */
  failed: boolean;
  /** The frame's width; a resize re-lays the view out (stacking below NARROW_BELOW). */
  frameWidth: number;
}

/** errors.ts `unavailable`: message plus next step, as the server words it. */
const CALL_FAILED = "NYC-MON can't reach your Mon right now. Try again in a minute.";

const useView = create<ViewState>(() => ({ host: {}, vm: null, busy: null, notice: null, nowMs: Date.now(), frameWidth: window.innerWidth, failed: false }));
window.addEventListener('resize', () => useView.setState({ frameWidth: window.innerWidth }));

// theme.css's own switch: [data-theme] on the root (the persisted-override hook).
useView.subscribe((s) => {
  const theme = s.host.theme;
  document.documentElement.dataset.theme = theme === 'light' || theme === 'dark' ? theme : 'system';
});

function displayMode(host: McpUiHostContext): 'inline' | 'fullscreen' {
  return host.displayMode === 'fullscreen' ? 'fullscreen' : 'inline';
}

/**
 * One root zoom, or 'fluid'. A frame narrower than the 768 px base canvas
 * never zooms below 1: it lays out fluid at 1:1 (and MonView stacks below its
 * breakpoint), so nothing is clipped. The frame's own width (innerWidth) is
 * the truth; maxWidth only narrows it.
 */
function resolveZoom(host: McpUiHostContext, layout: 'card' | 'room', frameWidth: number): number | 'fluid' {
  const deviceClass = typeof host.deviceClass === 'string' ? host.deviceClass : '';
  const width = Math.min(frameWidth, typeof host.maxWidth === 'number' ? host.maxWidth : Infinity);
  const maxHeight = typeof host.maxHeight === 'number' ? host.maxHeight : window.innerHeight;
  if (host.isMobile === true || width < BASE_WIDTH) return 'fluid';
  const byHeight = layout === 'room' && maxHeight > 0 ? maxHeight / BASE_HEIGHT : Infinity;
  const fit = Math.max(1, Math.min(2.5, width / BASE_WIDTH, byHeight));
  const surface = SURFACES.find((s) => s.match.test(deviceClass));
  if (surface) return surface.zoom === 'fit' ? fit : surface.zoom;
  return deviceClass === '' ? 1 : fit;
}

const app = new App(
  { name: `nyc-mon-${__ENTRY__}`, version: '0.0.0' },
  { availableDisplayModes: ['inline', 'fullscreen'] },
  { autoResize: true },
);

async function runAction(id: ActionId): Promise<void> {
  const { vm, busy } = useView.getState();
  if (!vm || busy) return;
  useView.setState({ busy: id, notice: null, failed: false });
  try {
    const result = await app.callServerTool({ name: ACTION_TOOLS[id], arguments: actionArguments(id, vm.monInstanceId) });
    const next = result.isError ? null : toMonViewModel(result.structuredContent);
    if (next) {
      useView.setState({ vm: next, nowMs: Date.now(), notice: careOutcomeText(result.structuredContent, next) });
    } else {
      // Failures carry plain-language text with a next step from the server (errors.ts).
      const text = (result.content ?? []).find((c) => c.type === 'text');
      useView.setState({ notice: text && 'text' in text && text.text.trim() !== '' ? text.text : CALL_FAILED, failed: true });
    }
  } catch {
    // The call never reached the server (bridge or transport failure). Say so
    // in the words the server uses for the same case (src/mcp/errors.ts,
    // `unavailable`); neither companion copy nor M13–M18 05-copy.md has one.
    useView.setState({ notice: CALL_FAILED, failed: true });
  } finally {
    useView.setState({ busy: null });
  }
}

async function toggleRoom(): Promise<void> {
  const host = useView.getState().host;
  const want = displayMode(host) === 'fullscreen' ? 'inline' : 'fullscreen';
  try {
    const { mode } = await app.requestDisplayMode({ mode: want });
    useView.setState({ host: { ...useView.getState().host, displayMode: mode } });
  } catch {
    // The host refused; the current layout stays.
  }
}

function Root() {
  const host = useView((s) => s.host);
  const frameWidth = useView((s) => s.frameWidth);
  const vm = useView((s) => s.vm);
  const notice = useView((s) => s.notice);
  const failed = useView((s) => s.failed);
  const nowMs = useView((s) => s.nowMs);
  const theme: 'light' | 'dark' =
    host.theme === 'dark' || (host.theme === undefined && window.matchMedia?.('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  const mode = displayMode(host);
  const layout = mode === 'fullscreen' ? 'room' : __ENTRY__;
  const zoom = resolveZoom(host, layout, frameWidth);
  const modes = host.availableDisplayModes;
  const canExpand = Array.isArray(modes) && modes.includes('fullscreen');
  const fitted = zoom !== 'fluid';
  const canvasHeight = (typeof host.maxHeight === 'number' ? Math.min(host.maxHeight, window.innerHeight) : window.innerHeight) / (fitted ? zoom : 1);
  // Below this content width the status and rings stack under the Card.
  const narrow = !fitted && frameWidth - 24 < NARROW_BELOW;
  // A narrow room scrolls as one column rather than fitting a fixed height.
  const style = fitted ? { zoom, width: BASE_WIDTH, height: layout === 'room' ? canvasHeight : undefined } : undefined;
  return (
    <div style={style} className={`bg-bg p-3 ${layout === 'room' ? 'relative flex flex-col' : ''}`}>
      {__GRID_BACKDROP__ && layout === 'room' && GridBackdrop ? (
        <BackdropBoundary>
          <GridBackdrop />
        </BackdropBoundary>
      ) : null}
      {vm ? (
        <main aria-label={spokenSummary(vm)} className={layout === 'room' ? 'relative flex min-h-0 flex-1 flex-col' : undefined}>
          <MonView
            vm={vm}
            layout={layout}
            canExpand={canExpand}
            theme={theme}
            narrow={narrow}
            nowMs={nowMs}
            canvasHeight={canvasHeight - 24}
            onAction={(id) => void runAction(id)}
            onToggleRoom={() => void toggleRoom()}
          />
        </main>
      ) : null}
      {failed && notice ? (
        // A failed call is shown as well as announced: StatusRow's Offline story, the kit's error status.
        <View className="relative pt-3">
          <StatusRow items={[{ id: 'call-failed', label: notice, tone: 'offline' }]} />
        </View>
      ) : null}
      <p role="status" aria-live="polite" className="sr-only">{notice ?? ''}</p>
    </div>
  );
}

app.ontoolresult = (params) => {
  // A payload the adapter cannot read keeps the last good view rather than blanking it.
  try {
    const next = toMonViewModel(params.structuredContent);
    if (next) useView.setState({ vm: next, nowMs: Date.now() });
  } catch (err) {
    console.error('nyc-mon view: unreadable tool result', err);
  }
};
app.onhostcontextchanged = (params) => {
  useView.setState({ host: { ...useView.getState().host, ...params } });
};

createRoot(document.getElementById('root') as HTMLElement).render(<Root />);
void app.connect().then(() => {
  useView.setState({ host: app.getHostContext() ?? {} });
});
