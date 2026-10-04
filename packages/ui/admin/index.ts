// `@acme/ui/admin`: the ops console's entry (docs/design/admin/04-components.md
// G19). A barrel and nothing else. It re-exports the components the console
// renders today and never reaches Skia, three.js or WebGPU, which the root
// barrel pulls in through ./gpu, ./three, ./charts and ./backgrounds.
// admin-entry.test.ts walks this file's import graph and fails on any of them.
//
// Semantic HTML primitives stay on `@acme/ui/html`.
//
// Not here yet:
// - StatCard: its NeonSparkline lazy-loads Skia (charts/LinePlot.web.tsx ->
//   backgrounds/SkiaWebGate.tsx -> react-native-skia), so a canvaskit chunk
//   lands in the console build. Add it once the sparkline is split out (G1).
// - AdaptivePanes: add when packages/ui/adaptive-panes is committed.
export { Badge, type BadgeProps } from '../Badge';
export { BottomSheet, SheetSurface, type BottomSheetProps } from '../BottomSheet';
export { BrandLogo, type BrandLogoProps } from '../brand/BrandLogo';
export { BrandWordmark, type BrandWordmarkProps } from '../brand/BrandWordmark';
export { Button, type ButtonProps } from '../Button';
export { Card, type CardProps } from '../Card';
export { Checkbox, type CheckboxProps } from '../Checkbox';
export { DataTable, type ColumnDef, type DataTableProps } from '../DataTable';
export { Dialog, DialogCard, type DialogProps } from '../Dialog';
export { EmptyState, type EmptyStateProps } from '../EmptyState';
export { ErrorMessage, type ErrorMessageProps } from '../ErrorMessage';
export { FieldGroup, type FieldGroupProps, type FieldSectionProps } from '../FieldGroup';
export { FormField, type FormFieldProps } from '../FormField';
export { Heading, type HeadingProps } from '../Heading';
export { IconButton, type IconButtonProps } from '../IconButton';
export { List, ListItem, type ListItemProps, type ListProps } from '../List';
export { LoadingSkeleton, type LoadingSkeletonProps } from '../LoadingSkeleton';
export { Menu, type MenuAction, type MenuProps } from '../Menu';
export { notify, Toaster } from '../notify';
export type { NotifyOptions, NotifyVariant } from '../notify.shared';
export { ProgressBar, type ProgressBarProps } from '../progress/ProgressBar';
export { SearchBar, type SearchBarProps } from '../SearchBar';
export { SegmentedControl, type SegmentedControlProps, type SegmentedOption } from '../SegmentedControl';
export { Select, type SelectOption, type SelectProps } from '../Select';
export { Switch, type SwitchProps } from '../Switch';
export { TabBar, type TabBarProps } from '../TabBar';
export { Text, type TextProps } from '../Text';
export { TextField, type TextFieldProps } from '../TextField';
export { Timeline, type TimelineItemData, type TimelineProps } from '../elements/Timeline';
export { Toolbar, type ToolbarProps } from '../Toolbar';
