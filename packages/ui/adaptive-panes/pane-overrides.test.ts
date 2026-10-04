import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { paneVisibility, WINDOW_SIZE_CLASSES_BY_WIDTH, type WindowSizeClass } from './constants.ts';
import {
  clearPaneOverrides,
  resolvePaneVisibility,
  togglePaneOverride,
  type PaneOverrides,
  type TogglablePane,
} from './pane-overrides.ts';
import { TRANSITIONS } from './transitions.ts';
import { PANE_WIDTH_DP, REM } from './pane-widths.ts';
import { DEFAULT_PRIMARY_WIDTH } from './resize.ts';
import {
  STORAGE_KEY,
  createMemoryPaneOverrideStorage,
  createPaneOverrideStore,
} from './pane-overrides.store.shared.ts';

const CLASSES = WINDOW_SIZE_CLASSES_BY_WIDTH;
const PANES: readonly TogglablePane[] = ['primary', 'supplementary', 'inspector'];
const SHAPES: readonly (1 | 2)[] = [1, 2];

/** Classes with room for a pane the user can toggle on. */
const CAN_SHOW: Record<WindowSizeClass, readonly TogglablePane[]> = {
  compact: [],
  medium: ['primary'],
  expanded: PANES,
  large: PANES,
  extraLarge: PANES,
};

describe('resolvePaneVisibility — no overrides', () => {
  it('matches the automatic policy for every size class and shape', () => {
    for (const sizeClass of CLASSES) {
      for (const columnCount of SHAPES) {
        assert.deepEqual(
          resolvePaneVisibility(sizeClass, columnCount),
          paneVisibility(sizeClass, columnCount),
          `${sizeClass}/${columnCount} should be untouched`,
        );
      }
    }
  });

  it('treats an empty map the same as an absent one', () => {
    for (const sizeClass of CLASSES) {
      assert.deepEqual(
        resolvePaneVisibility(sizeClass, 2, {}),
        resolvePaneVisibility(sizeClass, 2),
      );
    }
  });
});

describe('resolvePaneVisibility — hiding', () => {
  it('honours a hide override in every size class and shape', () => {
    for (const sizeClass of CLASSES) {
      for (const columnCount of SHAPES) {
        for (const pane of PANES) {
          const overrides: PaneOverrides = { [sizeClass]: { [pane]: false } };
          const resolved = resolvePaneVisibility(sizeClass, columnCount, overrides);
          assert.equal(resolved[pane], false, `${sizeClass}/${columnCount}/${pane}`);
        }
      }
    }
  });

  it('does not report the rail step for a hidden primary', () => {
    for (const sizeClass of CLASSES) {
      const resolved = resolvePaneVisibility(sizeClass, 2, {
        [sizeClass]: { primary: false },
      });
      assert.equal(resolved.primaryNarrow, false, sizeClass);
    }
  });
});

describe('resolvePaneVisibility — showing is gated by what fits', () => {
  it('only reveals a pane in a class that can physically show it', () => {
    for (const sizeClass of CLASSES) {
      for (const columnCount of SHAPES) {
        for (const pane of PANES) {
          const resolved = resolvePaneVisibility(sizeClass, columnCount, {
            [sizeClass]: { [pane]: true },
          });
          const auto = paneVisibility(sizeClass, columnCount);
          const expected = CAN_SHOW[sizeClass].includes(pane) ? true : auto[pane];
          assert.equal(resolved[pane], expected, `${sizeClass}/${columnCount}/${pane}`);
        }
      }
    }
  });

  it('never makes any pane visible on compact, whatever the override says', () => {
    for (const columnCount of SHAPES) {
      const allOn = { compact: { primary: true, supplementary: true, inspector: true } };
      assert.deepEqual(
        resolvePaneVisibility('compact', columnCount, allOn),
        paneVisibility('compact', columnCount),
      );
    }
  });

  it('does not open a third column on medium', () => {
    const resolved = resolvePaneVisibility('medium', 2, {
      medium: { supplementary: true, inspector: true },
    });
    assert.equal(resolved.supplementary, paneVisibility('medium', 2).supplementary);
    assert.equal(resolved.inspector, paneVisibility('medium', 2).inspector);
  });
});

describe('resolvePaneVisibility — the detail pane', () => {
  it('is on by default in every size class and shape', () => {
    for (const sizeClass of CLASSES) {
      for (const columnCount of SHAPES) {
        assert.equal(
          resolvePaneVisibility(sizeClass, columnCount).detail,
          true,
          `${sizeClass}/${columnCount}`,
        );
      }
    }
  });

  it('can be hidden wherever another pane is still up', () => {
    // The tutor session's "Natalie" control: she lives in the detail pane, the
    // conversation is the primary one, and hiding her must leave the
    // conversation on screen rather than emptying the window.
    const overrides: PaneOverrides = { large: { detail: false } };
    const resolved = resolvePaneVisibility('large', 2, overrides);
    assert.equal(resolved.detail, false);
    assert.equal(resolved.primary, true);
  });

  it('refuses to hide when it is the last pane on screen', () => {
    // Compact shows one pane and the detail is the one it falls back to; an
    // override that emptied it would leave nothing, and no control to undo it.
    assert.equal(
      resolvePaneVisibility('compact', 1, { compact: { detail: false } }).detail,
      true,
    );
    assert.equal(
      resolvePaneVisibility('large', 2, {
        large: { detail: false, primary: false, supplementary: false, inspector: false },
      }).detail,
      true,
    );
  });

  it('stays scoped to its own size class like every other pane', () => {
    const overrides: PaneOverrides = { large: { detail: false } };
    assert.equal(resolvePaneVisibility('expanded', 2, overrides).detail, true);
  });
});

describe('resolvePaneVisibility — overrides are scoped to one size class', () => {
  it("ignores another class's override", () => {
    for (const owner of CLASSES) {
      const overrides: PaneOverrides = { [owner]: { primary: false } };
      for (const sizeClass of CLASSES) {
        if (sizeClass === owner) continue;
        assert.deepEqual(
          resolvePaneVisibility(sizeClass, 2, overrides),
          paneVisibility(sizeClass, 2),
          `${owner}'s override leaked into ${sizeClass}`,
        );
      }
    }
  });

  it("applies each class's own override when several are recorded", () => {
    const overrides: PaneOverrides = {
      expanded: { supplementary: false },
      large: { inspector: false },
    };
    assert.equal(resolvePaneVisibility('expanded', 2, overrides).supplementary, false);
    assert.equal(
      resolvePaneVisibility('expanded', 2, overrides).inspector,
      paneVisibility('expanded', 2).inspector,
    );
    assert.equal(resolvePaneVisibility('large', 2, overrides).inspector, false);
    assert.equal(
      resolvePaneVisibility('large', 2, overrides).supplementary,
      paneVisibility('large', 2).supplementary,
    );
  });

  it("returns to the new class's default when crossing a breakpoint", () => {
    const hidden = togglePaneOverride({}, 'large', 'supplementary', true);
    assert.equal(resolvePaneVisibility('large', 2, hidden).supplementary, false);
    assert.equal(
      resolvePaneVisibility('expanded', 2, hidden).supplementary,
      paneVisibility('expanded', 2).supplementary,
    );
  });
});

describe('togglePaneOverride', () => {
  it('flips away from what is currently on screen, with no prior override', () => {
    const visible = resolvePaneVisibility('large', 2).supplementary;
    const next = togglePaneOverride({}, 'large', 'supplementary', visible);
    assert.equal(resolvePaneVisibility('large', 2, next).supplementary, !visible);
  });

  it('round-trips back to the automatic value', () => {
    const auto = resolvePaneVisibility('large', 2).inspector;
    const off = togglePaneOverride({}, 'large', 'inspector', auto);
    const on = togglePaneOverride(off, 'large', 'inspector', !auto);
    assert.equal(resolvePaneVisibility('large', 2, on).inspector, auto);
  });

  it('does not mutate the map it is given', () => {
    const before: PaneOverrides = { expanded: { primary: false } };
    const snapshot = JSON.stringify(before);
    togglePaneOverride(before, 'expanded', 'inspector', true);
    assert.equal(JSON.stringify(before), snapshot);
  });

  it('leaves other size classes untouched', () => {
    const next = togglePaneOverride({ medium: { primary: false } }, 'expanded', 'primary', true);
    assert.equal(next.medium?.primary, false);
    assert.equal(next.expanded?.primary, false);
  });
});

describe('clearPaneOverrides', () => {
  it('returns the class to automatic behaviour', () => {
    const overrides = togglePaneOverride({}, 'expanded', 'supplementary', true);
    const cleared = clearPaneOverrides(overrides, 'expanded');
    assert.deepEqual(
      resolvePaneVisibility('expanded', 2, cleared),
      paneVisibility('expanded', 2),
    );
  });

  it("keeps other classes' overrides", () => {
    const overrides: PaneOverrides = {
      expanded: { primary: false },
      large: { inspector: false },
    };
    const cleared = clearPaneOverrides(overrides, 'expanded');
    assert.equal(cleared.expanded, undefined);
    assert.equal(cleared.large?.inspector, false);
  });

  it('does not mutate the map it is given', () => {
    const before: PaneOverrides = { expanded: { primary: false } };
    clearPaneOverrides(before, 'expanded');
    assert.equal(before.expanded?.primary, false);
  });
});

describe('TRANSITIONS', () => {
  it('keeps width on a tween — a spring reflows neighbours on every overshoot frame', () => {
    assert.equal(TRANSITIONS.paneWidth.type, 'timing');
  });

  it('uses a spring only for the native-driven pane slide', () => {
    const springs = Object.entries(TRANSITIONS)
      .filter(([, t]) => t.type === 'spring')
      .map(([name]) => name);
    assert.deepEqual(springs, ['paneSlide']);
  });
});

describe('PANE_WIDTH_DP', () => {
  it('matches the rem basis the resizable primary pane already uses', () => {
    // Both derive from theme tokens at the app's rem polyfill of 14. If the
    // polyfill changes and only one is updated, drags and collapses would
    // disagree about how wide the pane is.
    assert.equal(PANE_WIDTH_DP.primary, DEFAULT_PRIMARY_WIDTH);
    assert.equal(REM, 14);
  });

  it('keeps the rail step narrower than the full sidebar', () => {
    assert.ok(PANE_WIDTH_DP.primaryNarrow < PANE_WIDTH_DP.primary);
  });
});

describe('pane override storage', () => {
  it('starts from what the storage holds and writes every toggle back', () => {
    const storage = createMemoryPaneOverrideStorage();
    storage.set(STORAGE_KEY, JSON.stringify({ large: { primary: false } }));
    const { store } = createPaneOverrideStore(storage);
    assert.deepEqual(store.getState().overrides, { large: { primary: false } });

    store.getState().toggle('large', 'inspector', true);
    assert.deepEqual(JSON.parse(storage.getString(STORAGE_KEY) ?? '{}'), {
      large: { primary: false, inspector: false },
    });
  });

  it('re-reads the saved map when the host app swaps in its own storage', () => {
    const { store, configureStorage } = createPaneOverrideStore(createMemoryPaneOverrideStorage());
    assert.deepEqual(store.getState().overrides, {});

    const persisted = createMemoryPaneOverrideStorage();
    persisted.set(STORAGE_KEY, JSON.stringify({ expanded: { supplementary: false } }));
    configureStorage(persisted);
    assert.deepEqual(store.getState().overrides, { expanded: { supplementary: false } });

    store.getState().reset('expanded');
    assert.equal(persisted.getString(STORAGE_KEY), '{}');
  });

  it('drops a malformed blob instead of keeping panes shut', () => {
    const storage = createMemoryPaneOverrideStorage();
    storage.set(STORAGE_KEY, '{not json');
    const { store } = createPaneOverrideStore(storage);
    assert.deepEqual(store.getState().overrides, {});
    assert.equal(storage.getString(STORAGE_KEY), undefined);
  });
});
