'use client';

import { Button, Card, ErrorMessage, FadeIn, Text, TextField } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { hatchCopy } from '../hatch/copy';
import { copy } from '../onboarding/copy';
import type { AccountController } from './account';
import { useAccount } from './account';
import { providerCopyId } from './account-model.ts';
import { useDataExport } from './data-export';
import { ExportError } from './DeviceCard';

/** The email, the sign-in methods and the two change forms. Shared by the 2D card and the glass's Detail pane. */
export function AccountDetails({ account }: { account: AccountController }) {
  if (!account.signedIn) return <Text variant="caption" tone="muted">{copy('settings.account.signed_out')}</Text>;
  return (
    <View className="gap-4">
      <View className="gap-0.5">
        <Text variant="caption" tone="muted">{copy('settings.account.email')}</Text>
        <Text selectable testID="settings-account-email">{account.email ?? copy('settings.account.email.none')}</Text>
      </View>
      <View className="gap-0.5" testID="settings-account-methods">
        <Text variant="caption" tone="muted">{copy('settings.account.methods')}</Text>
        {account.accounts === null ? (
          account.loadFailed ? (
            <View className="gap-2">
              <ErrorMessage message={copy('settings.account.methods.error')} />
              <View className="flex-row"><Button variant="outline" title={copy('settings.delete.retry')} onPress={account.reload} /></View>
            </View>
          ) : <Text variant="caption" tone="muted">{copy('settings.account.methods.loading')}</Text>
        ) : (
          account.accounts.map((a) => <Text key={a.id}>{copy(providerCopyId(a.providerId))}</Text>)
        )}
      </View>
      <AccountForms account={account} />
    </View>
  );
}

function AccountForms({ account }: { account: AccountController }) {
  const message = account.message;
  const status = message === null ? null : message.kind === 'error'
    ? <ErrorMessage message={copy(message.id)} />
    : <Text accessibilityLiveRegion="polite" variant="caption">{message.text}</Text>;
  if (account.form === 'email') {
    return (
      <View className="gap-3" testID="settings-account-email-form">
        <TextField
          surface="daylit"
          label={copy('settings.account.change_email.field')}
          hint={copy('settings.account.change_email.hint')}
          value={account.newEmail}
          onChangeText={account.setNewEmail}
          onSubmitEditing={account.saveEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        {status}
        <FormButtons account={account} onSave={account.saveEmail} />
      </View>
    );
  }
  if (account.form === 'password') {
    return (
      <View className="gap-3" testID="settings-account-password-form">
        <TextField surface="daylit" label={copy('settings.account.password.current')} value={account.currentPassword}
          onChangeText={account.setCurrentPassword} secureTextEntry textContentType="password" autoCapitalize="none" />
        <TextField surface="daylit" label={copy('settings.account.password.new')} hint={copy('settings.account.password.hint')}
          value={account.newPassword} onChangeText={account.setNewPassword} onSubmitEditing={account.savePassword}
          secureTextEntry textContentType="newPassword" autoCapitalize="none" />
        {status}
        <FormButtons account={account} onSave={account.savePassword} />
      </View>
    );
  }
  return (
    <View className="gap-3">
      {status}
      <View className="flex-row flex-wrap gap-3">
        <Button variant="outline" title={copy('settings.account.change_email')} onPress={() => account.open('email')} />
        {account.canChangePassword ? (
          <Button variant="outline" title={copy('settings.account.change_password')} onPress={() => account.open('password')} />
        ) : null}
      </View>
    </View>
  );
}

function FormButtons({ account, onSave }: { account: AccountController; onSave: () => void }) {
  return (
    <View className="flex-row gap-3">
      {/* Cancel first, as everywhere in Settings. */}
      <Button variant="outline" title={hatchCopy('m09.edit.cancel')} disabled={account.busy} onPress={() => account.open('none')} />
      <Button variant="cta" title={copy('settings.account.save')} loading={account.busy} disabled={account.busy} onPress={onSave} />
    </View>
  );
}

/** The export row, shared by the 2D card and the Detail pane. */
export function ExportRow({ account }: { account: AccountController }) {
  const exporter = useDataExport(account.user);
  return (
    <View className="gap-2" testID="settings-export">
      <Text variant="caption" tone="muted">{copy('settings.export.caption')}</Text>
      <ExportError failed={exporter.failed} />
      <View className="flex-row">
        <Button variant="outline" title={copy('settings.export.action')} loading={exporter.exporting}
          disabled={exporter.exporting} onPress={() => void exporter.run()} />
      </View>
    </View>
  );
}

/** M20 Account (2D): email, sign-in methods, change forms, then M19 Download your data. */
export function AccountCard({ className }: { className?: string }) {
  const account = useAccount();
  return (
    <FadeIn delay={210} className={className}>
      <Card className="gap-4" testID="settings-account">
        <Text variant="heading">{copy('settings.account.title')}</Text>
        <AccountDetails account={account} />
        <View className="gap-1 border-t border-border pt-3">
          <Text variant="heading">{copy('settings.export.label')}</Text>
          <ExportRow account={account} />
        </View>
      </Card>
    </FadeIn>
  );
}
