// The signal system bound to the bundled Harlem tile, built on first use —
// controllers are derived from the lane topology at load time, never baked.
// Same seam as bundled-topology.ts: keeping the tile JSON import out of the
// pure modules is what lets node tests exercise the maths without the bundle.
import { bundledTopology } from './bundled-topology.ts';
import { buildSignalSystem, type SignalSystem } from './signal-controller.ts';

let bundled: SignalSystem | null = null;

/**
 * Controllers for every signalized junction on the bundled tile (~180, one
 * build ~0.4 s), or null when the tile failed to parse. The vehicle and
 * pedestrian sims (PR05/PR06) hold this reference; signalization is
 * simulated — see the `simulated` flag on every state. Callers needing
 * non-default controller options (LPI, exclusive ped phase, dark) build their
 * own system with `buildSignalSystem`.
 */
export function bundledSignals(): SignalSystem | null {
  if (bundled) return bundled;
  const topo = bundledTopology();
  bundled = topo ? buildSignalSystem(topo) : null;
  return bundled;
}
