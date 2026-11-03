'use client';
import type { ComponentType } from 'react';
import { StyleSheet, type TextInputProps } from 'react-native';
import { Input, Textarea } from '../html';
import { studioDomStyle } from './style';

/** Concrete styles cross to the existing semantic HTML input/textarea. */
export function StudioTextInput({ multiline, style, ...props }: TextInputProps) {
  const Field = (multiline ? Textarea : Input) as ComponentType<TextInputProps>;
  const resolved = studioDomStyle(StyleSheet.flatten(style) ?? {});
  return <Field {...props} style={resolved as TextInputProps['style']} />;
}
