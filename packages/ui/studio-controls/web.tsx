'use client';
/** Browser-only entry: the core bindings plus the canonical file input. */
import { FilePickerBase } from '../html/dom.web';
import { html as coreHtml, studioControls as coreControls } from './index';
export { NightScope, List, ListItem, Card, Toolbar, Button, IconButton, Banner, Badge, EmptyState, KeyValueList, ErrorMessage, FieldGroup, StudioPressable, Menu, SegmentedControl, TabBar, DropZone, Page, Main, Header, Footer, Section, Heading, Paragraph, Link, View, Text, ScrollView, TextInput, Select, Image } from './index';
export type { StudioControls, StudioPressableProps, StudioSelectProps, MenuProps, MenuAction, DropZoneProps, DropAsset, Assets } from './index';
export type { FilePickerBaseProps as StudioFilePickerProps } from '../html/dom.web';

/** System file selection through the existing semantic input; no imperative ref. */
export const FilePicker = FilePickerBase;
export const html = { ...coreHtml, FilePicker };
export const studioControls = { ...coreControls, html };
