'use client';
/**
 * Narrow, source-owned binding for portable document studios. Imports stay on
 * the real ui/html, ui/tw and native-control paths, never the large UI barrel.
 * A host injects this object; it does not alias another UI implementation.
 */
import type { ComponentType, ComponentProps } from 'react';
import { StyleSheet, type ImageProps, type ViewProps, type TextProps, type ScrollViewProps } from 'react-native';
import { View as CanonicalView, Text as CanonicalText, ScrollView as CanonicalScrollView } from '../tw';
import { Page, Main, Header, Footer, Section, Heading, Paragraph, Link } from '../html';
import { StudioTextInput } from './TextInput';
import { Image as CanonicalImage } from '../Image';
import { Menu } from '../Menu';
import { Select as CanonicalSelect } from '../Select';
import { SegmentedControl } from '../SegmentedControl';
import { TabBar } from '../TabBar';
import { DropZone } from '../DropZone';
import { Button } from '../Button';
import { IconButton } from '../IconButton';
import { Banner } from '../Banner';
import { Badge } from '../Badge';
import { EmptyState } from '../EmptyState';
import { KeyValueList } from '../KeyValueList';
import { ErrorMessage } from '../ErrorMessage';
import { FieldGroup } from '../FieldGroup';
import { Card } from '../Card';
import { Toolbar } from '../Toolbar';
import { List, ListItem } from '../List';
import { NightScope } from '../NightScope';
import { StudioPressable } from './Pressable';
import type { StudioControls, StudioSelectProps } from './types';

export { NightScope, List, ListItem, Card, Toolbar, Button, IconButton, Banner, Badge, EmptyState, KeyValueList, ErrorMessage, FieldGroup, StudioPressable, Menu, SegmentedControl, TabBar, DropZone, Page, Main, Header, Footer, Section, Heading, Paragraph, Link };
export type { StudioControls, StudioPressableProps, StudioSelectProps } from './types';
export type { MenuProps, MenuAction } from '../Menu.types';
export type { DropZoneProps, DropAsset, Assets } from '../DropZone.types';

// The semantic primitives forward these props to their platform view. RN's
// style augmentation differs from html-elements' intersection at type level;
// this boundary accepts the RN style shape the underlying view already uses.
export const View = CanonicalView as ComponentType<ViewProps>;
export const Text = CanonicalText as ComponentType<TextProps>;
export const ScrollView = CanonicalScrollView as ComponentType<ScrollViewProps>;

export const TextInput = StudioTextInput;

/** Immutable option data is copied into the existing kit Select API. */
export function Select({ options, ...props }: StudioSelectProps) {
  return <CanonicalSelect {...props} rounded tone="royal" options={[...options]} />;
}
/** Adapt portable URI image props to the kit's real Solito/expo-image component. */
export function Image({ source, style, accessibilityLabel, resizeMode, testID, onError }: ImageProps) {
  const candidate = Array.isArray(source) ? source[0] : source;
  if (!candidate || typeof candidate !== 'object' || !('uri' in candidate) || !candidate.uri) {
    throw new Error('Studio Image requires an explicit URI source.');
  }
  const fit = resizeMode === 'contain' || resizeMode === 'center' ? 'contain' : resizeMode === 'stretch' ? 'fill' : 'cover';
  return <CanonicalImage
    src={candidate.uri} alt={accessibilityLabel ?? ''} fill framed={false}
    containerStyle={StyleSheet.flatten(style)} contentFit={fit}
    {...({ unoptimized: true, testID, onError: () => onError?.({ nativeEvent: { error: 'Image could not be decoded' } } as never) } as Partial<ComponentProps<typeof CanonicalImage>>)}
  />;
}

/** Pass this stable object to the studio's strict host UI provider. */
export const html = { Page, Main, Header, Footer, Section, Heading, Paragraph, Link };
export const studioControls = { NightScope, List, ListItem, Card, Toolbar, Button, IconButton, Banner, Badge, EmptyState, KeyValueList, ErrorMessage, FieldGroup, View, Text, Pressable: StudioPressable, ScrollView, TextInput, Image, Menu, Select, SegmentedControl, TabBar, DropZone, html } satisfies StudioControls;
