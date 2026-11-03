'use client';
import type { ComponentType } from 'react';
import type { TextInputProps } from 'react-native';
import { Input, Textarea } from '../html';

/** Native fields stay on the canonical @expo/ui input bridge. */
export function StudioTextInput({ multiline, ...props }: TextInputProps) {
  const Field = (multiline ? Textarea : Input) as ComponentType<TextInputProps>;
  return <Field {...props} />;
}
