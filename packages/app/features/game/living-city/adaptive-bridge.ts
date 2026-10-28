/**
 * PR09 seam between `city-scene.ts` and the Living City host. `city-scene`
 * cannot import `living-city/bundled-host.ts` statically: that module eagerly
 * pulls the bundled tile (`city-data → harlem-apollo.json`), which makes
 * isolated `node --test` runs on the scene crash on the JSON import and would
 * evaluate the whole living-city stack even with the flag off. Instead
 * `bundled-host` registers `frame` when its own module is evaluated — which
 * only happens through flag-gated call sites — and the scene calls through
 * this bridge. Flag off ⇒ `frame` stays null ⇒ zero-diff.
 */
export const livingCityAdaptiveBridge: { frame: ((scale: number) => void) | null } = { frame: null };
