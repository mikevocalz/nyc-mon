'use client';
import { View, Text } from './tw';
import { ResponsiveDialog } from './ResponsiveDialog';
import { Button } from './Button';
import { TextField } from './TextField';
import { Select, type SelectOption } from './Select';
import { ErrorMessage } from './ErrorMessage';
import { useInstanceStore, useStore } from './use-instance-store';
import type { ControlTone, District } from './district';

/**
 * Type-to-confirm destructive actions (04-components.md G8): the consequences
 * listed plainly, the record's last-six typed into a field, an optional
 * reason Select, and a danger Button that stays disabled until the text
 * matches and a reason is chosen. `onConfirm` is async — the button shows
 * pending and errors land inline with the dialog kept open.
 */
export interface ConfirmDestructiveProps {
  open: boolean;
  title: string;
  /** What will happen, one line each, listed in order. */
  consequences: readonly string[];
  /** The string the staff member types to confirm (e.g. the id's last six). */
  confirmText: string;
  /** The destructive button's label, e.g. "Schedule deletion". */
  confirmLabel: string;
  /** Fixed reason codes; omitting drops the Select. */
  reasonOptions?: readonly SelectOption[];
  /** Runs the endpoint call; reject (or return a message) to show inline. */
  onConfirm: (input: { reasonCode?: string }) => Promise<void>;
  onClose: () => void;
  /** Typed-field label. Default "Type to confirm". */
  inputLabel?: string;
  /** Cancel button label. Default "Cancel". */
  cancelLabel?: string;
  /** Colour family for non-destructive controls. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default midtown (orange). */
  district?: District;
  className?: string;
}

interface ConfirmState {
  typed: string;
  reason: string | undefined;
  pending: boolean;
  error: string | undefined;
}

export function ConfirmDestructive({
  open, title, consequences, confirmText, confirmLabel, reasonOptions,
  onConfirm, onClose, inputLabel = 'Type to confirm', cancelLabel = 'Cancel',
  tone, district, className,
}: ConfirmDestructiveProps) {
  const store = useInstanceStore<ConfirmState>(() => ({ typed: '', reason: undefined, pending: false, error: undefined }));
  const st = useStore(store);
  const matches = st.typed.trim() === confirmText;
  const needsReason = !!reasonOptions?.length;
  const ready = matches && (!needsReason || !!st.reason) && !st.pending;

  const close = () => {
    store.setState({ typed: '', reason: undefined, pending: false, error: undefined });
    onClose();
  };

  const submit = async () => {
    store.setState({ pending: true, error: undefined });
    try {
      await onConfirm({ reasonCode: st.reason });
      store.setState({ pending: false });
      close();
    } catch (cause) {
      store.setState({ pending: false, error: cause instanceof Error ? cause.message : 'Something went wrong. Try again.' });
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={close}
      title={title}
      size="sm"
      footerAlign="right"
      className={className}
      actions={
        <>
          <Button title={cancelLabel} variant="ghost" tone={tone} district={district} onPress={close} />
          <Button
            title={confirmLabel}
            variant="danger"
            disabled={!ready}
            loading={st.pending}
            onPress={() => void submit()}
          />
        </>
      }
    >
      <View className="gap-4">
        <View className="gap-2">
          {consequences.map((line) => (
            <Text key={line} className="text-base leading-snug text-text">{`• ${line}`}</Text>
          ))}
        </View>
        {reasonOptions?.length ? (
          <Select
            label="Reason"
            value={st.reason}
            onValueChange={(v) => store.setState({ reason: v })}
            options={[...reasonOptions]}
            tone={tone}
            district={district}
          />
        ) : null}
        <TextField
          label={inputLabel}
          value={st.typed}
          onChangeText={(text) => store.setState({ typed: text })}
          surface="daylit"
        />
        {st.error ? <ErrorMessage message={st.error} /> : null}
      </View>
    </ResponsiveDialog>
  );
}
