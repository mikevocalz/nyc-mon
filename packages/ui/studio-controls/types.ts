import type { ComponentType } from 'react';
import type { ImageProps, PressableProps, ScrollViewProps, TextInputProps, TextProps, ViewProps } from 'react-native';
import type { MenuProps } from '../Menu.types';
import type { SelectOption } from '../Select.types';

/** Props supported by the source-owned studio press bridge on both platforms. */
export type StudioPressableProps = PressableProps & { className?: string };
/** Data-based selection contract consumed by a studio host. */
export interface StudioSelectProps {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
}
/** Portable visual boundary. Runtime behavior stays in this canonical UI package. */
export interface StudioControls {
  NightScope: typeof import('../NightScope')['NightScope'];
  List: typeof import('../List')['List'];
  ListItem: typeof import('../List')['ListItem'];
  Card: typeof import('../Card')['Card'];
  Toolbar: typeof import('../Toolbar')['Toolbar'];
  Button: typeof import('../Button')['Button'];
  IconButton: typeof import('../IconButton')['IconButton'];
  Banner: typeof import('../Banner')['Banner'];
  Badge: typeof import('../Badge')['Badge'];
  EmptyState: typeof import('../EmptyState')['EmptyState'];
  KeyValueList: typeof import('../KeyValueList')['KeyValueList'];
  ErrorMessage: typeof import('../ErrorMessage')['ErrorMessage'];
  FieldGroup: typeof import('../FieldGroup')['FieldGroup'];
  View: ComponentType<ViewProps>;
  Text: ComponentType<TextProps>;
  Pressable: ComponentType<StudioPressableProps>;
  ScrollView: ComponentType<ScrollViewProps>;
  TextInput: ComponentType<TextInputProps>;
  /** URI sources are supported; native numeric asset handles are not portable. */
  Image: ComponentType<ImageProps>;
  Menu: ComponentType<MenuProps>;
  Select: ComponentType<StudioSelectProps>;
  SegmentedControl: typeof import('../SegmentedControl')['SegmentedControl'];
  TabBar: typeof import('../TabBar')['TabBar'];
  DropZone: typeof import('../DropZone')['DropZone'];
  html: Pick<typeof import('../html'), 'Page' | 'Main' | 'Header' | 'Footer' | 'Section' | 'Heading' | 'Paragraph' | 'Link'>;
}
