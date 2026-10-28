'use client';
// G03 Game-control settings (Master Directive v2 §13; G03 08-handoff.md).
// The screen holds no field state: every control reads the one profile from
// controllerProfileStore and writes one patch through controllerProfileActions,
// which the Zod schema validates before anything persists. The preview at
// the top is the real ArcadeController in `preview` mode, so what the Caller
// sees is what the Game screen draws.
//
// Structure refs (Mobbin, structure only): the settings pattern already in
// this app (settings-content.tsx: Card per group, heading + caption + control)
// is reused rather than a new pattern (R3).
//
// Decisions (2026-10-15):
// - BUILD the value labels as visible text beside each slider label. The
//   kit Slider has no `valueText` yet (G03 08-handoff § Kit changes, B2), so
//   each slider sits inside one `adjustable` element that speaks the label
//   once and the deck's value ("15 percent", "1.5 times") and steps on
//   increment/decrement (review finding M11). The visible label row is part
//   of that element, so it is not announced a second time. When the kit
//   Slider gains `valueText`, this wrapper goes.
// - BUILD reduced motion as a read-only StatusRow mirroring the OS switch,
//   with "Change" opening system settings; there is no in-app toggle (copy
//   deck "Strings deliberately not written").
// - DEFER the position editor (ClusterPlacementEditor): the layout store
//   holds per-profile offsets, but no editor component exists in the kit
//   yet (G03 B3 names a `validate` contract lane D did not ship). Restore
//   defaults still clears saved positions.
// - STRIKE the haptics-unsupported caption: the kit exposes no
//   `haptics.supported` flag (packages/ui/haptics.native.ts), so the four
//   strengths always show; "Off" is the honest fallback.
// - STRIKE the "Show icons" switch while no default binding carries an icon
//   (handoff § States "no icons in bindings"); it returns when one does.
import { useEffect, useMemo } from 'react';
import { AccessibilityInfo, Linking } from 'react-native';
import { useStore } from 'zustand';
import {
  Button,
  Card,
  Heading,
  KeyValueList,
  ResponsiveDialog,
  SegmentedControl,
  Slider,
  StatusRow,
  Text,
  useInstanceStore,
  useReducedMotion,
} from '@acme/ui';
import { ArcadeController, useArcadeRiveFiles } from '@acme/ui/game-controls';
import {
  BUTTON_IDS,
  DEFAULT_CAMERA_BINDINGS,
  DEFAULT_CAMERA_SPOKEN_LABELS,
  createGameInputRouter,
  type ControllerProfile,
} from '@acme/ui/game-controls/parts';
import { View } from '@acme/ui/tw';
import { ScreenPanes } from '../../layout/ScreenPanes';
import { PANE_HEADING_CLASS } from '../../onboarding/OnboardingPanes';
import { controllerLayoutActions } from '../controller-layout.store.ts';
import { controllerProfileActions, useControllerProfile } from '../controller-profile.store.ts';
import {
  G03,
  HANDEDNESS_OPTIONS,
  HAPTICS_OPTIONS,
  SLIDER_RANGES,
  STICK_MODE_OPTIONS,
  STICK_PLACEMENT_OPTIONS,
  percentLabel,
  percentSpoken,
  previewAccessibilityLabel,
  snapToStep,
  stepSlider,
  timesLabel,
  timesSpoken,
} from './controls-settings-copy.ts';

/** Harlem tone, the same district the Game HUD uses. */
const DISTRICT = 'harlem' as const;

interface ScreenState {
  restoreOpen: boolean;
}

/** The preview well: wide enough for the landscape layout at the resolver's shrink-to-fit. */
const PREVIEW_HEIGHT = 200;

function LabelRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline justify-between">
      <Text variant="label">{label}</Text>
      <Text variant="label" className="tabular-nums">{value}</Text>
    </View>
  );
}

type SliderRange = { readonly min: number; readonly max: number; readonly step: number };

/**
 * A labelled slider that a screen reader meets as one adjustable element:
 * name once, the deck's spoken value, a step per swipe. Touch still drags
 * the kit Slider inside it.
 */
function SliderField({ label, visibleValue, spokenValue, range, value, onChange }: {
  label: string;
  visibleValue: string;
  spokenValue: string;
  range: SliderRange;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: spokenValue }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        const action = event.nativeEvent.actionName;
        if (action === 'increment' || action === 'decrement') onChange(stepSlider(value, range, action));
      }}
      className="gap-1"
    >
      <LabelRow label={label} value={visibleValue} />
      <Slider
        district={DISTRICT}
        label={label}
        {...range}
        value={value}
        onValueChange={(next) => onChange(snapToStep(next, range))}
      />
    </View>
  );
}

function ReducedMotionStatus() {
  const reducedMotion = useReducedMotion();
  if (!reducedMotion) return null;
  return (
    <StatusRow
      items={[{
        id: 'reduced-motion',
        label: G03.reduced.on,
        tone: 'neutral',
        action: { label: G03.reduced.action, accessibilityHint: G03.reduced.hint, onPress: () => void Linking.openSettings() },
      }]}
    />
  );
}

function ControllerPreview({ profile, arcadeRive, testID }: {
  profile: ControllerProfile;
  arcadeRive: ReturnType<typeof useArcadeRiveFiles>;
  testID: string;
}) {
  const reducedMotion = useReducedMotion();
  // Preview mode never calls the router; it exists so the kit's props are complete.
  const router = useMemo(() => createGameInputRouter({ bindings: DEFAULT_CAMERA_BINDINGS }), []);
  return (
    <View
      accessible
      accessibilityRole="image"
      aria-label={previewAccessibilityLabel(profile)}
      className="w-full overflow-hidden border-2 border-border bg-surface-sunken"
      // Computed: a fixed well so the resolver lays the controller out at one known size.
      style={{ height: PREVIEW_HEIGHT }}
      {...({ testID } as object)}
    >
      <ArcadeController
        rive={arcadeRive}
        mode="preview"
        profile={profile}
        bindings={DEFAULT_CAMERA_BINDINGS}
        spokenLabels={DEFAULT_CAMERA_SPOKEN_LABELS}
        router={router}
        pill="playing"
        reducedMotion={reducedMotion}
        insets={{ top: 0, right: 0, bottom: 0, left: 0 }}
        hardwareFamily="phone"
        runtime="native"
      />
    </View>
  );
}

export function ControlsSettingsScreen() {
  const profile = useControllerProfile((s) => s.profile);
  const arcadeRive = useArcadeRiveFiles();
  const screen = useInstanceStore<ScreenState>(() => ({ restoreOpen: false }));
  const restoreOpen = useStore(screen, (s) => s.restoreOpen);
  const set = controllerProfileActions.set;

  // A patch to the stick tuning must carry the whole tuning (patchControllerProfile merges it).
  const setStick = (patch: Partial<ControllerProfile['stick']>) => set({ stick: { ...profile.stick, ...patch } });

  // Spoken once when the screen opens, so the "no Save" rule is known before the first edit.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(G03.intro);
  }, []);

  const restore = () => {
    controllerProfileActions.reset();
    controllerLayoutActions.reset();
    screen.setState({ restoreOpen: false });
    AccessibilityInfo.announceForAccessibility(G03.restore.done);
  };

  const bindingItems = BUTTON_IDS.map((id) => ({
    key: id,
    label: id.toUpperCase(),
    value: DEFAULT_CAMERA_SPOKEN_LABELS[id],
  }));

  const intro = (
    <View className="gap-1">
      <Heading level={1} size="title" className={PANE_HEADING_CLASS} {...({ testID: 'g03-title' } as object)}>{G03.title}</Heading>
      <Text tone="muted">{G03.intro}</Text>
    </View>
  );

  const preview = (
    <View className="gap-2">
      <ControllerPreview profile={profile} arcadeRive={arcadeRive} testID="g03-preview" />
      {profile.haptics !== 'off' ? <Text variant="caption" tone="muted">{G03.preview.hint}</Text> : null}
      <ReducedMotionStatus />
    </View>
  );

  const cards = (
    <>
      <View>
        <Card className="gap-4">
          <Text variant="heading">{G03.section.stick}</Text>
          <View className="gap-1">
            <Text variant="label">{G03.stick.mode.label}</Text>
            <SegmentedControl
              aria-label={G03.stick.mode.a11y}
              district={DISTRICT}
              options={STICK_MODE_OPTIONS}
              value={profile.stickMode}
              onChange={(stickMode) => set({ stickMode })}
              className="self-start"
            />
            <Text variant="caption" tone="muted">{G03.stick.mode.caption}</Text>
          </View>
          <View className="gap-1">
            <Text variant="label">{G03.stick.placement.label}</Text>
            <SegmentedControl
              aria-label={G03.stick.placement.a11y}
              district={DISTRICT}
              options={STICK_PLACEMENT_OPTIONS}
              value={profile.stickPlacement}
              onChange={(stickPlacement) => set({ stickPlacement })}
              className="self-start"
            />
            <Text variant="caption" tone="muted">{G03.stick.placement.caption}</Text>
          </View>
          <View className="gap-1">
            <SliderField
              label={G03.stick.deadzone.label}
              visibleValue={percentLabel(profile.stick.deadZone)}
              spokenValue={percentSpoken(profile.stick.deadZone)}
              range={SLIDER_RANGES.deadZone}
              value={profile.stick.deadZone}
              onChange={(deadZone) => setStick({ deadZone })}
            />
            <Text variant="caption" tone="muted">{G03.stick.deadzone.caption}</Text>
          </View>
          <View className="gap-1">
            <SliderField
              label={G03.stick.sensitivity.label}
              visibleValue={timesLabel(profile.stick.sensitivity)}
              spokenValue={timesSpoken(profile.stick.sensitivity)}
              range={SLIDER_RANGES.sensitivity}
              value={profile.stick.sensitivity}
              onChange={(sensitivity) => setStick({ sensitivity })}
            />
            <Text variant="caption" tone="muted">{G03.stick.sensitivity.caption}</Text>
          </View>
        </Card>
      </View>

      <View>
        <Card className="gap-4">
          <Text variant="heading">{G03.section.layout}</Text>
          <View className="gap-1">
            <Text variant="label">{G03.hand.label}</Text>
            <SegmentedControl
              aria-label={G03.hand.a11y}
              district={DISTRICT}
              options={HANDEDNESS_OPTIONS}
              value={profile.handedness}
              onChange={(handedness) => set({ handedness })}
              className="self-start"
            />
            <Text variant="caption" tone="muted">{G03.hand.caption}</Text>
          </View>
          <View className="gap-1">
            <SliderField
              label={G03.size.label}
              visibleValue={percentLabel(profile.scale)}
              spokenValue={percentSpoken(profile.scale)}
              range={SLIDER_RANGES.scale}
              value={profile.scale}
              onChange={(scale) => set({ scale })}
            />
          </View>
          <View className="gap-1">
            <SliderField
              label={G03.opacity.label}
              visibleValue={percentLabel(profile.opacity)}
              spokenValue={percentSpoken(profile.opacity)}
              range={SLIDER_RANGES.opacity}
              value={profile.opacity}
              onChange={(opacity) => set({ opacity })}
            />
            <Text variant="caption" tone="muted">{G03.opacity.caption}</Text>
          </View>
        </Card>
      </View>

      <View>
        <Card className="gap-4">
          <Text variant="heading">{G03.section.feel}</Text>
          <View className="gap-1">
            <Text variant="label">{G03.haptics.label}</Text>
            <SegmentedControl
              aria-label={G03.haptics.a11y}
              district={DISTRICT}
              options={HAPTICS_OPTIONS}
              value={profile.haptics}
              onChange={(haptics) => set({ haptics })}
              segmentClassName="basis-[40%] sm:basis-auto"
            />
          </View>
        </Card>
      </View>

      <View>
        <Card className="gap-3">
          <Text variant="heading">{G03.section.buttons}</Text>
          <Text variant="caption" tone="muted">{G03.bindings.caption}</Text>
          <KeyValueList items={bindingItems} columns={2} />
        </Card>
      </View>
    </>
  );

  const restoreButton = (
    <Button
      title={G03.restore.button}
      variant="outline"
      district={DISTRICT}
      fullWidth
      onPress={() => screen.setState({ restoreOpen: true })}
    />
  );

  /*
    One tree (ScreenPanes), switched by class only:

    - Phone: the old column, preview first, Restore defaults last.
    - Tablet portrait (md+): the same column, top-aligned and widened to 560.
    - Landscape (md+): title and the preview at its authored 200pt height on
      the left; the setting cards, then Restore defaults, on the right.

    One tree means one ArcadeController preview: the earlier two mounted
    arrangements drew two. Every value lives in controllerProfileStore.
  */
  return (
    <View className="flex-1 bg-surface">
      <ScreenPanes
        testID="g03-page"
        primary={
          <>
            {intro}
            {preview}
          </>
        }
        secondary={
          <>
            {cards}
            {restoreButton}
          </>
        }
      />
      <ResponsiveDialog
        open={restoreOpen}
        onClose={() => screen.setState({ restoreOpen: false })}
        title={G03.restore.title}
        description={G03.restore.body}
        actions={
          <>
            <Button title={G03.restore.cancel} variant="outline" district={DISTRICT} onPress={() => screen.setState({ restoreOpen: false })} />
            <Button title={G03.restore.confirm} variant="danger" onPress={restore} />
          </>
        }
      />
    </View>
  );
}
