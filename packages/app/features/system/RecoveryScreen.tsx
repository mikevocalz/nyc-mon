'use client';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { createEmptySave, readBootSave } from '@acme/core/save';
import { Button, ErrorMessage, FadeIn, Heading, ResponsiveDialog, Text, useInstanceStore, useStore } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { retryGlass } from '../companion/home-stage.store';
import { ErrorScreen } from '../error/screen';
import { ScreenPanes } from '../layout/ScreenPanes';
import { useMonStore } from '../mon/mon.store';
import { announcePolitely } from '../onboarding/announce';
import { SAVE_KEY } from '../onboarding/onboarding.store';
import { deviceId, saveIO } from '../onboarding/save-store';
import { saveStorage } from '../onboarding/storage';
import { systemCopy } from './copy';
import { ACTION_COPY, parseRecoveryState, recoveryPlan, type RecoveryAction, type RecoveryPlan } from './recovery-model';

interface RecoveryUi {
  readonly confirming: boolean;
  readonly busy: boolean;
  readonly failed: boolean;
}

const when = (ms: number) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));

/**
 * M22 error / recovery, `/(system)/error?state=…`. Shell: none. Never a dead
 * end: every state has a filled primary action (recovery-model.ts).
 *
 * Layout (ScreenPanes, one tree, class-switched, so a fold or rotation never
 * drops the open confirm dialog):
 * - Phone: title and explanation, then the actions under them, in the
 *   lower half where the thumb reaches.
 * - Tablet portrait (md+): the same order, top-aligned, 560 pt column,
 *   heading one rung larger.
 * - Landscape md+ / open foldable: the explanation on the left two fifths,
 *   the actions on the right, measured inside the content box.
 */
export function RecoveryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ state?: string }>();
  const state = parseRecoveryState(params.state);
  const ui = useInstanceStore<RecoveryUi>(() => ({ confirming: false, busy: false, failed: false }));
  const { confirming, busy, failed } = useStore(ui);

  if (state === undefined) return <ErrorScreen kind="error" />;

  // Read on each render: restore and start-over change both.
  const boot = readBootSave(saveStorage.getString(SAVE_KEY));
  const lastGood = saveIO.lastGood();
  const plan: RecoveryPlan = recoveryPlan(state, {
    lastGood: lastGood.status,
    reason: boot.status === 'unreadable' ? boot.reason : undefined,
    canGoBack: router.canGoBack(),
  });

  const restart = () => router.replace('/');
  const run = (action: RecoveryAction) => {
    switch (action) {
      case 'restore': {
        ui.setState({ busy: true, failed: false });
        const restored = saveIO.restoreLastGood();
        ui.setState({ busy: false, failed: restored === undefined });
        if (restored !== undefined) {
          announcePolitely(systemCopy('m22.done.a11y'));
          restart();
        }
        return;
      }
      case 'start-over':
        ui.setState({ confirming: true });
        return;
      case 'use-2d':
        if (router.canGoBack()) router.back();
        else router.replace('/(home)');
        return;
      case 'retry-3d':
        // A fresh (home) copy: every route's stage and the renderer start again.
        retryGlass();
        router.replace('/(home)');
        return;
      case 'reload':
        useMonStore.getState().hydrate();
        restart();
        return;
      case 'home':
        router.replace('/(home)');
        return;
      case 'back':
        router.back();
        return;
    }
  };

  const confirmStartOver = () => {
    saveIO.startOver(createEmptySave(deviceId(), Date.now()));
    ui.setState({ confirming: false });
    restart();
  };

  const body = systemCopy(plan.bodyId, {
    when: lastGood.status === 'available' ? when(lastGood.save.savedAt) : '',
  });

  return (
    <View className="flex-1 bg-surface" testID={`m22-${state}`}>
      <ScreenPanes
        testID="m22-panes"
        primary={
          <FadeIn>
            <View className="gap-3 md:gap-4">
              <Heading level={1} size="display-sm" className="md:text-display-md">{systemCopy(plan.titleId)}</Heading>
              <Text selectable className="md:text-lg">{body}</Text>
              {plan.noteId !== undefined ? (
                <Text variant="caption" tone="muted" className="md:text-base">{systemCopy(plan.noteId)}</Text>
              ) : null}
            </View>
          </FadeIn>
        }
        secondary={
          <View className="gap-3 md:landscape:pt-2">
            {failed ? <ErrorMessage message={systemCopy('m22.restore.failed')} /> : null}
            <Button
              testID={`m22-action-${plan.primary}`}
              title={systemCopy(ACTION_COPY[plan.primary])}
              variant="cta"
              size="lg"
              fullWidth
              loading={busy && plan.primary === 'restore'}
              disabled={busy}
              onPress={() => run(plan.primary)}
            />
            {plan.secondary.map((action) => (
              <Button
                key={action}
                testID={`m22-action-${action}`}
                title={systemCopy(ACTION_COPY[action])}
                variant="ghost"
                tone="royal"
                fullWidth
                disabled={busy}
                onPress={() => run(action)}
              />
            ))}
            {/* A failed restore always leaves a way forward. */}
            {failed && !plan.secondary.includes('start-over') && plan.primary !== 'start-over' ? (
              <Button testID="m22-action-start-over" title={systemCopy('m22.action.start_over')} variant="ghost" tone="royal" fullWidth onPress={() => run('start-over')} />
            ) : null}
          </View>
        }
      />
      <ResponsiveDialog
        open={confirming}
        onClose={() => ui.setState({ confirming: false })}
        title={systemCopy('m22.start_over.confirm.title')}
        size="sm"
        footerAlign="right"
        actions={
          <>
            {/* Cancel first and in the primary look: the safe answer is the default. */}
            <Button title={systemCopy('m22.start_over.cancel')} variant="cta" onPress={() => ui.setState({ confirming: false })} />
            <Button testID="m22-start-over-confirm" title={systemCopy('m22.start_over.confirm.action')} variant="danger" onPress={confirmStartOver} />
          </>
        }
      >
        <Text>{systemCopy('m22.start_over.confirm.body')}</Text>
      </ResponsiveDialog>
    </View>
  );
}
