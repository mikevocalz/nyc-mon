'use client';
import type { ComponentType } from 'react';
import { StyleSheet, type TextInputProps } from 'react-native';
import { Input, Textarea } from '../html';
import { studioDomStyle } from './style';

type WebFieldProps = TextInputProps & { 'aria-description'?: string };

/** Concrete styles cross to the existing semantic HTML input/textarea. */
export function StudioTextInput({ multiline, style, accessibilityLabel, accessibilityHint,
  'aria-label': ariaLabel, 'aria-description': ariaDescription, textAlignVertical: _textAlignVertical, ...props }: WebFieldProps) {
  const Field = (multiline ? Textarea : Input) as ComponentType<WebFieldProps>;
  const resolved = studioDomStyle(StyleSheet.flatten(style) ?? {});
  return <Field {...props} aria-label={ariaLabel ?? accessibilityLabel} aria-description={ariaDescription ?? accessibilityHint} style={resolved as TextInputProps['style']} />;
}
