import { Button, TextField } from '@acme/ui';
import { ArrowUp } from '@acme/ui/icons';
import { Text, View } from '@acme/ui/tw';
import { composerSubmit } from './companionMon.ts';

export interface ComposerProps {
  question: string;
  busy: boolean;
  onChange: (question: string) => void;
  onSend: (question: string) => void;
}

/**
 * The typed half of the conversation, pinned under the transcript. Enter sends
 * (the field's submit), the same as the Send button; a blank question or one
 * typed while a turn runs sends nothing.
 */
export function Composer({ question, busy, onChange, onSend }: ComposerProps) {
  const submit = () => {
    const text = composerSubmit(question, busy);
    if (text) onSend(text);
  };
  return (
    <View className="gap-1.5">
      <View className="flex-row items-end gap-3">
        <View className="min-w-0 flex-1">
          <TextField surface="daylit" label="Ask your Mon" value={question} onChangeText={onChange}
            onSubmitEditing={submit} returnKeyType="send" disabled={busy}/>
        </View>
        <Button title="Send" variant="cta" icon={<ArrowUp size={18} />} onPress={submit} disabled={busy || !question.trim()}/>
      </View>
      <Text className="text-type-caption text-text-muted">Press Enter to send. Typing while your Mon talks cuts it off.</Text>
    </View>
  );
}
