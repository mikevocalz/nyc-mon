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
export { AuthProviderButton, type AuthIntent, type AuthProvider, type AuthProviderButtonProps } from '../AuthProviderButton';
export { Badge, type BadgeProps } from '../Badge';
export { Banner, type BannerProps } from '../Banner';
export { BottomSheet, SheetSurface, type BottomSheetProps } from '../BottomSheet';
export { BrandLogo, type BrandLogoProps } from '../brand/BrandLogo';
export { BrandWordmark, type BrandWordmarkProps } from '../brand/BrandWordmark';
export { Button, type ButtonProps } from '../Button';
export { Card, type CardProps } from '../Card';
export { Checkbox, type CheckboxProps } from '../Checkbox';
export { Checklist, CheckRow, type ChecklistProps, type CheckResult, type CheckRowProps } from '../Checklist';
export { ConfirmDestructive, type ConfirmDestructiveProps } from '../ConfirmDestructive';
export { CopyButton, type CopyButtonProps } from '../CopyButton';
export { DataTable, type ColumnDef, type DataTableMode, type DataTableProps, type DataTableSelection, type SortState } from '../DataTable';
export { Dialog, DialogCard, type DialogProps } from '../Dialog';
export { EmptyState, type EmptyStateProps } from '../EmptyState';
export { ErrorMessage, type ErrorMessageProps } from '../ErrorMessage';
export { FieldGroup, type FieldGroupProps, type FieldSectionProps } from '../FieldGroup';
export { FilterBar, FilterChip, type FilterBarProps, type FilterChipProps } from '../FilterBar';
export { FormField, type FormFieldProps } from '../FormField';
export { Heading, type HeadingProps } from '../Heading';
export { IconButton, type IconButtonProps } from '../IconButton';
export { KeyValueList, type KeyValueItem, type KeyValueListProps } from '../KeyValueList';
export { List, ListItem, type ListItemProps, type ListProps } from '../List';
export { LoadingSkeleton, type LoadingSkeletonProps } from '../LoadingSkeleton';
export { MaskedValue, type MaskedValueProps } from '../MaskedValue';
export { Menu, type MenuAction, type MenuProps } from '../Menu';
export { notify, Toaster } from '../notify';
export type { NotifyOptions, NotifyVariant } from '../notify.shared';
export { Pagination, type PaginationProps } from '../Pagination';
export { ProgressBar, type ProgressBarProps } from '../progress/ProgressBar';
export { ResponsiveDialog, type ResponsiveDialogProps } from '../ResponsiveDialog';
export { SearchBar, type SearchBarProps } from '../SearchBar';
export { SegmentedControl, type SegmentedControlProps, type SegmentedOption } from '../SegmentedControl';
export { Select, type SelectOption, type SelectProps } from '../Select';
export { SignageBand, type SignageBandProps } from '../SignageBand';
export { Switch, type SwitchProps } from '../Switch';
export { TabBar, type TabBarProps } from '../TabBar';
export { Text, type TextProps } from '../Text';
export { TextField, type TextFieldProps } from '../TextField';
export { Timeline, type TimelineItemData, type TimelineProps } from '../elements/Timeline';
export { Timestamp, type TimestampProps } from '../Timestamp';
export { Toolbar, type ToolbarProps } from '../Toolbar';
