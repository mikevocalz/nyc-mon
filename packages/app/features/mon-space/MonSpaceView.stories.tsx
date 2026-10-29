// M32 Mon Space as the screen draws it, from fixed care views (no store, no
// clock). Typed without @storybook/* because packages/app does not depend on
// it; CSF needs only these plain objects. Fixture names and art are the
// shipped Hood Ratti Baby's.
import type { MonCareView } from '@acme/core/sim';
import { useInstanceStore, useStore } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { artFor } from '../companion/creature-art';
import { companionCopy } from '../companion/copy';
import { MonSpaceView } from './MonSpaceView';
import { initialUi, pressKey, statusLine, tapIcon, type MonSpaceUi } from './mon-space-model';

export default { title: 'Mon Space/M32 screen' };

const BASE: MonCareView = {
  hearts: { fullness: 3, social: 2, energy: 4 },
  poop: 0,
  cold: null,
  discipline: 2,
  weight: 6,
  asleep: false,
  lights: 'on',
  paused: false,
  call: null,
  attention: 'none',
  ageDays: 3,
  stage: 'Baby',
};
const NAME = 'Squeaklet';

function Live({ view, scheme, wide = false, reducedMotion = false, ui: start, moment = null }: {
  view: MonCareView; scheme: 'daylit' | 'night'; wide?: boolean; reducedMotion?: boolean; ui?: MonSpaceUi;
  moment?: { kind: 'evolve' | 'hatch'; text: string } | null;
}) {
  const store = useInstanceStore<{ ui: MonSpaceUi }>(() => ({ ui: start ?? initialUi(view) }));
  const ui = useStore(store, (s) => s.ui);
  const line = statusLine(view);
  return (
    <View style={{ width: wide ? 1194 : 390, height: wide ? 834 : 844 }} className="overflow-hidden">
      <MonSpaceView
        view={view}
        ui={ui}
        name={NAME}
        scheme={scheme}
        wide={wide}
        reducedMotion={reducedMotion}
        status={companionCopy(line.copy, { name: NAME, ...line.tokens })}
        beat={false}
        pose={0}
        art={artFor('baby', 1)}
        moment={moment}
        askOpen={false}
        onIcon={(icon) => store.setState({ ui: tapIcon(store.getState().ui, icon).ui })}
        onKey={(key) => store.setState({ ui: pressKey(store.getState().ui, key).ui })}
        onAsk={() => undefined}
      />
    </View>
  );
}

const HUNGRY: MonCareView = {
  ...BASE, hearts: { fullness: 1, social: 2, energy: 3 }, poop: 2, call: { kind: 'hunger', openedAt: 1, msLeft: 600_000 }, attention: 'call',
};

/** Day: the paper LCD, a hunger call, two piles; the cursor starts on Share a meal. */
export const Day = { render: () => <Live view={HUNGRY} scheme="daylit" /> };
/** Night: the backlit LCD. */
export const Night = { render: () => <Live view={HUNGRY} scheme="night" /> };
/** Lights out: the inverted LCD, the Mon asleep. */
export const LightsOut = { render: () => <Live view={{ ...BASE, asleep: true, lights: 'off' }} scheme="night" /> };
/** Lights out by day. */
export const LightsOutDay = { render: () => <Live view={{ ...BASE, asleep: true, lights: 'off' }} scheme="daylit" /> };
/** A cold: the cold glyph and the sneeze beside the Mon. */
export const Cold = { render: () => <Live view={{ ...BASE, cold: { dosesRemaining: 2 }, call: { kind: 'cold', openedAt: 1, msLeft: 1 }, attention: 'call' }} scheme="daylit" /> };
/** The status page: hearts, boundaries, weight and age in segment numerals, the stage. */
export const Status = { render: () => <Live view={BASE} scheme="daylit" ui={{ focus: 7, layer: 'status' }} /> };
/** Paused: dark lamp, every icon but Resume greyed. */
export const Paused = { render: () => <Live view={{ ...BASE, paused: true }} scheme="daylit" /> };
/** The pause confirm sheet. */
export const PauseConfirm = { render: () => <Live view={BASE} scheme="daylit" ui={{ focus: 8, layer: 'pause-confirm' }} /> };
/** The evolve moment's name plate. */
export const Evolve = { render: () => <Live view={BASE} scheme="night" moment={{ kind: 'evolve', text: `${NAME} is now Ratti` }} /> };
/** iPad landscape: the LCD with the readable twins beside it. */
export const Tablet = { render: () => <Live view={HUNGRY} scheme="daylit" wide /> };
/** Reduce Motion: the lamp holds steady with its dot. */
export const ReducedMotion = { render: () => <Live view={HUNGRY} scheme="daylit" reducedMotion /> };
