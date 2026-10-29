'use client';

import { Button, Card, ErrorMessage, FadeIn, Switch, Text, useReducedMotion } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { copy } from '../onboarding/copy';
import { useDevicePrefs } from './device-prefs.store';
import { useNotifyToggle } from './notify-toggle';
import { useMonCallsToggle } from './mon-calls-toggle';

/** One switch with its caption, as the Permission Center lays them out. */
function SwitchRow({ label, caption, value, onChange, testID }: {
  label: string;
  caption: string;
  value: boolean;
  onChange: (next: boolean) => void;
  testID: string;
}) {
  return (
    <View testID={testID} className="gap-1 border-b border-border py-3">
      <Switch value={value} onChange={onChange} label={label} />
      <Text variant="caption" tone="muted">{caption}</Text>
    </View>
  );
}

/**
 * M19 "This device": Egg alerts, Mon calls, Haptics, Sound and Reduce motion. Each
 * switch writes device-prefs.store (MMKV), and the kit obeys at once.
 */
export function DeviceCard({ className }: { className?: string }) {
  const haptics = useDevicePrefs((s) => s.haptics);
  const sound = useDevicePrefs((s) => s.sound);
  const forced = useDevicePrefs((s) => s.forceReducedMotion);
  const set = useDevicePrefs((s) => s.set);
  const reduced = useReducedMotion();
  const notify = useNotifyToggle();
  const monCalls = useMonCallsToggle();
  const native = process.env.EXPO_OS !== 'web';
  return (
    <FadeIn delay={150} className={className}>
      <Card className="gap-1" testID="settings-device">
        <Text variant="heading">{copy('settings.device.title')}</Text>
        {native && notify.available ? (
          <View testID="settings-notify" className="gap-1 border-b border-border py-3">
            <Switch value={notify.on} onChange={(v) => void notify.set(v)} label={copy('settings.notify.label')} />
            <Text variant="caption" tone="muted">
              {copy(notify.denied ? 'settings.notify.caption.denied' : 'settings.notify.caption')}
            </Text>
            {notify.denied ? (
              <View className="flex-row pt-1">
                <Button variant="outline" title={copy('settings.notify.open_settings')} onPress={notify.openSettings} />
              </View>
            ) : null}
          </View>
        ) : null}
        {native && monCalls.available ? (
          <SwitchRow testID="settings-mon-calls" label={copy('settings.mon_calls.label')}
            caption={copy(monCalls.denied ? 'settings.notify.caption.denied' : 'settings.mon_calls.caption')}
            value={monCalls.on} onChange={(v) => void monCalls.set(v)} />
        ) : null}
        {native ? (
          <SwitchRow testID="settings-haptics" label={copy('settings.haptics.label')} caption={copy('settings.haptics.caption')}
            value={haptics} onChange={(v) => set('haptics', v)} />
        ) : null}
        <SwitchRow testID="settings-sound" label={copy('settings.sound.label')} caption={copy('settings.sound.caption')}
          value={sound} onChange={(v) => set('sound', v)} />
        <SwitchRow
          testID="settings-motion"
          label={copy('settings.motion.label')}
          caption={copy(reduced && !forced ? 'settings.motion.caption.system' : 'settings.motion.caption')}
          value={forced || reduced}
          onChange={(v) => set('forceReducedMotion', v)}
        />
      </Card>
    </FadeIn>
  );
}

/** Error line for the export, shared by the 2D card and the Detail pane. */
export function ExportError({ failed }: { failed: boolean }) {
  return failed ? <ErrorMessage message={copy('settings.export.error')} /> : null;
}
