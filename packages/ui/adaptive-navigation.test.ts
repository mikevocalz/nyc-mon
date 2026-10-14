import assert from 'node:assert/strict';
import test from 'node:test';
import type { FoldLayout } from './adaptive-panes/fold-layout.ts';
import {
  resolveAdaptiveNavigationPlacement,
  tabBarPositionForPlacement,
  type ResolveAdaptiveNavigationPlacementInput,
} from './adaptive-navigation.ts';

const tabletop: FoldLayout = {
  orientation: 'horizontal',
  state: 'halfOpened',
  posture: 'tabletop',
  separating: true,
  x: 0,
  y: 400,
  width: 900,
  height: 0,
};

const book: FoldLayout = {
  ...tabletop,
  orientation: 'vertical',
  posture: 'book',
  x: 300,
  y: 0,
  width: 20,
  height: 900,
};

function resolve(input: Partial<ResolveAdaptiveNavigationPlacementInput>) {
  return resolveAdaptiveNavigationPlacement({
    platform: 'android',
    sizeClass: 'compact',
    heightDp: 800,
    folds: [],
    isRTL: false,
    ...input,
  });
}

const RIGHT_RAIL = { position: 'right', rail: true } as const;
const BOTTOM_TABS = { position: 'bottom', rail: false } as const;

function assertShell(
  placement: ReturnType<typeof resolve>,
  shell: { position: 'right' | 'bottom'; rail: boolean },
) {
  assert.equal(placement.position, shell.position);
  assert.equal(placement.rail, shell.rail);
}

// Scenario 1: native ordinary phone resized wide.
test('S1 native ordinary phone keeps bottom tabs at every width and height', () => {
  for (const platform of ['android', 'ios'] as const) {
    for (const sizeClass of ['compact', 'medium', 'expanded', 'large', 'extraLarge'] as const) {
      assertShell(resolve({ platform, hardwareFamily: 'phone', sizeClass }), BOTTOM_TABS);
    }
    assertShell(resolve({ platform, hardwareFamily: 'phone', sizeClass: 'expanded', heightDp: 380 }), BOTTOM_TABS);
  }
});

// Scenario 2: native foldable cover, narrow, no active fold feature.
test('S2 foldable cover screen, narrow, with no hinge keeps the physical-right rail', () => {
  for (const platform of ['android', 'ios'] as const) {
    const placement = resolve({ platform, hardwareFamily: 'foldable', sizeClass: 'compact', folds: [] });
    assertShell(placement, RIGHT_RAIL);
    assert.equal(placement.kind, 'rail-collapsed');
  }
});

// Scenario 3: same cover in RTL.
test('S3 foldable cover in RTL: rail stays physically right', () => {
  const placement = resolve({ hardwareFamily: 'foldable', sizeClass: 'compact', isRTL: true });
  assertShell(placement, RIGHT_RAIL);
});

test('S3 the physical right edge maps to the tab navigator flow slot that renders on the right', () => {
  const rail = resolve({ hardwareFamily: 'foldable', sizeClass: 'compact' });
  // React Navigation renders the bar after the scene in a row; Yoga mirrors
  // that row under RTL, so the physically-right slot is `left` in RTL.
  assert.equal(tabBarPositionForPlacement(rail, false), 'right');
  assert.equal(tabBarPositionForPlacement(rail, true), 'left');
  const tabs = resolve({ hardwareFamily: 'phone' });
  assert.equal(tabBarPositionForPlacement(tabs, false), 'bottom');
  assert.equal(tabBarPositionForPlacement(tabs, true), 'bottom');
});

// Scenario 4: native tablet / headset resized narrow.
test('S4 tablet and headset keep the right rail in narrow and short windows', () => {
  for (const hardwareFamily of ['tablet', 'headset'] as const) {
    for (const sizeClass of ['compact', 'medium', 'expanded'] as const) {
      for (const isRTL of [false, true]) {
        assertShell(resolve({ platform: 'android', hardwareFamily, sizeClass, isRTL }), RIGHT_RAIL);
      }
    }
    assertShell(resolve({ hardwareFamily, sizeClass: 'expanded', heightDp: 400 }), RIGHT_RAIL);
  }
  assertShell(resolve({ platform: 'ios', hardwareFamily: 'tablet', sizeClass: 'compact', isRTL: true }), RIGHT_RAIL);
});

// Scenario 5: unknown capability at startup, then verified foldable.
test('S5 unknown keeps the bootstrap bottom tabs, and resolves to the right rail once verified', () => {
  const startup = resolve({ hardwareFamily: 'unknown', sizeClass: 'expanded' });
  assertShell(startup, BOTTOM_TABS);
  assert.equal(startup.family, 'unknown');
  const verified = resolve({ hardwareFamily: 'foldable', sizeClass: 'expanded' });
  assertShell(verified, RIGHT_RAIL);
  assert.equal(verified.family, 'foldable');
});

test('S5 an omitted family is treated as unknown, not as a verified phone', () => {
  const placement = resolve({ sizeClass: 'expanded' });
  assert.equal(placement.family, 'unknown');
  assertShell(placement, BOTTOM_TABS);
});

// Scenario 6: web on the same foldable at phone width.
test('S6 web on a foldable at phone width: bottom tabs, no side rail', () => {
  for (const hardwareFamily of ['foldable', 'tablet', 'headset', 'unknown'] as const) {
    const placement = resolve({ platform: 'web', hardwareFamily, sizeClass: 'compact', folds: [book] });
    assertShell(placement, BOTTOM_TABS);
  }
});

// Scenario 7: wide web / intermediate widths.
test('S7 wide and intermediate web widths never get a side rail', () => {
  for (const platform of ['web', 'other'] as const) {
    for (const sizeClass of ['medium', 'expanded', 'large', 'extraLarge'] as const) {
      const placement = resolve({ platform, hardwareFamily: 'foldable', sizeClass, isRTL: true });
      assert.equal(placement.rail, false);
      assert.notEqual(placement.position, 'left');
      assert.notEqual(placement.position, 'right');
    }
  }
});

test('posture does not change navigation: tabletop and book foldables keep the right rail', () => {
  assertShell(resolve({ hardwareFamily: 'foldable', sizeClass: 'expanded', folds: [tabletop] }), RIGHT_RAIL);
  assertShell(resolve({ hardwareFamily: 'foldable', sizeClass: 'large', folds: [book, tabletop] }), RIGHT_RAIL);
  assertShell(resolve({ hardwareFamily: 'foldable', sizeClass: 'compact', folds: [tabletop], heightDp: 360 }), RIGHT_RAIL);
});

test('extra-large rail windows get the expanded rail, still on the right', () => {
  const placement = resolve({ hardwareFamily: 'tablet', sizeClass: 'extraLarge', isRTL: true });
  assert.equal(placement.kind, 'rail-expanded');
  assert.equal(placement.expanded, true);
  assert.equal(placement.position, 'right');
});

test('Apple hardware column: rail sits right and claims the column width only when the column is on the right', () => {
  const right = resolve({
    platform: 'ios',
    hardwareFamily: 'foldable',
    hardwareEdge: { edge: 'right', width: 84 },
    isRTL: true,
  });
  assertShell(right, RIGHT_RAIL);
  assert.equal(right.hardwareWidth, 84);
  const left = resolve({
    platform: 'ios',
    hardwareFamily: 'foldable',
    hardwareEdge: { edge: 'left', width: 84 },
  });
  assertShell(left, RIGHT_RAIL);
  assert.equal(left.hardwareWidth, 0);
});
