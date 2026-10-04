'use client';
import { tv } from 'tailwind-variants';
import {
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
  type ColumnDef as TanStackColumnDef,
  type RowData,
  type SortingState,
  type Updater,
} from '@tanstack/react-table';
import { useInstanceStore, useStore } from './use-instance-store';
import {
  Table, TableHeader, TableBody, TableRow, TableCell, TableHeaderCell,
} from './primitives';
import { View, Text, Pressable, ScrollView } from './tw';
import { districtTone, type ChartTone, type District } from './charts/district-tones';

const dataTable = tv({
  slots: {
    root: 'w-full overflow-hidden rounded-card border-2 border-border bg-surface-raised shadow-card',
    titleBar: 'px-4 py-3',
    titleText: 'text-base font-semibold text-text',
    titlePlate: 'hidden',
    headRow: 'flex-row border-b-2 border-border-strong bg-surface-sunken',
    headCell: 'flex-1 p-3 text-left text-sm font-semibold text-text',
    headButton: 'flex-row items-center gap-1.5',
    // Explicit colour: on web RNW's unlayered default (black) beats the base-layer text colour.
    headLabel: 'text-sm font-semibold text-text',
    sortGlyph: 'text-xs text-text-muted',
    row: 'flex-row border-b-2 border-border transition-colors duration-fast hover:bg-surface-sunken motion-reduce:transition-none',
    stripe: 'bg-surface-sunken',
    cell: 'flex-1 justify-center p-3 text-sm text-text',
    divider: 'border-r-2 border-border',
    empty: 'items-center p-8',
    emptyText: 'text-sm text-text-muted',
    skeleton: 'h-3 w-3/4 bg-surface-sunken',
    corner: 'hidden',
    pager: 'flex-row items-center justify-between gap-3 border-t-2 border-border px-3 py-2',
    pagerText: 'text-xs text-text-muted',
    pagerButton: 'min-h-11 justify-center border-2 border-border px-3 disabled:opacity-40',
    pagerLabel: 'text-sm font-semibold text-text',
  },
  variants: {
    variant: {
      default: {},
      /**
       * NeonBlade's NeonTable as a scoreboard: a solid tone title bar on a
       * darker plate, a night body, cornice corner brackets, and a tone bar
       * that slides along the hovered row.
       */
      neon: {
        root: 'relative rounded-none border-ink-800 bg-ink-950 shadow-none',
        titleBar: 'px-4 py-3',
        titleText: 'font-display text-lg text-ink-950',
        titlePlate: 'flex h-1.5',
        headRow: 'border-b-2 border-l-4 border-l-transparent bg-ink-900',
        headCell: 'font-display text-xs text-silver-300',
        headLabel: 'font-display text-xs text-silver-300',
        row: 'border-b border-l-4 border-b-ink-800 border-l-transparent',
        stripe: 'bg-ink-900',
        cell: 'text-silver-100',
        divider: 'border-r border-ink-800',
        emptyText: 'font-display text-sm text-silver-500',
        skeleton: 'bg-ink-800',
        corner: 'absolute flex h-4 w-4',
        pager: 'border-ink-800 bg-ink-900',
        pagerText: 'text-silver-400',
        pagerButton: 'border-ink-700 bg-ink-950',
        pagerLabel: 'text-silver-100',
      },
    },
    tone: {
      orange: {}, royal: {}, carolina: {}, leaf: {}, apple: {},
    },
    compact: {
      true: { headCell: 'px-3 py-2', cell: 'px-3 py-2' },
      false: {},
    },
  },
  // Tone only colours the neon variant; the default table stays on theme tokens.
  compoundVariants: [
    { variant: 'neon', tone: 'orange', class: { titleBar: 'bg-orange-500', titlePlate: 'bg-orange-800', headRow: 'border-b-orange-500', row: 'hover:border-l-orange-500 hover:bg-orange-500/10', sortGlyph: 'text-orange-400', corner: 'border-orange-500' } },
    { variant: 'neon', tone: 'royal', class: { titleBar: 'bg-royal-500', titlePlate: 'bg-royal-800', headRow: 'border-b-royal-500', row: 'hover:border-l-royal-400 hover:bg-royal-500/15', sortGlyph: 'text-royal-300', corner: 'border-royal-500', titleText: 'text-white' } },
    { variant: 'neon', tone: 'carolina', class: { titleBar: 'bg-carolina-500', titlePlate: 'bg-carolina-800', headRow: 'border-b-carolina-500', row: 'hover:border-l-carolina-500 hover:bg-carolina-500/10', sortGlyph: 'text-carolina-300', corner: 'border-carolina-500' } },
    { variant: 'neon', tone: 'leaf', class: { titleBar: 'bg-leaf-500', titlePlate: 'bg-leaf-800', headRow: 'border-b-leaf-500', row: 'hover:border-l-leaf-500 hover:bg-leaf-500/10', sortGlyph: 'text-leaf-300', corner: 'border-leaf-500' } },
    { variant: 'neon', tone: 'apple', class: { titleBar: 'bg-apple-500', titlePlate: 'bg-apple-800', headRow: 'border-b-apple-500', row: 'hover:border-l-apple-500 hover:bg-apple-500/10', sortGlyph: 'text-apple-300', corner: 'border-apple-500', titleText: 'text-white' } },
  ],
  defaultVariants: { variant: 'default', tone: 'orange', compact: false },
});

// Corner brackets: the cornice at each corner of the neon table.
const CORNERS = [
  'left-0 top-0 border-l-4 border-t-4',
  'right-0 top-0 border-r-4 border-t-4',
  'bottom-0 left-0 border-b-4 border-l-4',
  'bottom-0 right-0 border-b-4 border-r-4',
] as const;

// V9 requires the feature set to be explicit. Keep it module-stable so every
// table instance shares the same feature definition and only sorting code is
// bundled.
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
});

export type ColumnDef<T extends RowData, TValue = unknown> =
  TanStackColumnDef<typeof features, T, TValue>;

const PRESETS: Record<string, ChartTone> = { cyan: 'carolina', pink: 'apple', green: 'leaf' };

export interface DataTableProps<T extends RowData> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  /** Enable click-to-sort headers. */
  sortable?: boolean;
  /** "neon" is NeonBlade's NeonTable in NYC-MON colours. Default "default". */
  variant?: 'default' | 'neon';
  /** Heading bar above the table. */
  title?: string;
  /** Neon accent: a tone family or a NeonBlade preset (cyan, pink, green). Default: the district's tone. */
  color?: ChartTone | 'cyan' | 'pink' | 'green';
  /** Neon accent by neighbourhood. Default midtown (orange). */
  district?: District;
  /** Tone bar and tint on the hovered row (neon). Default true. */
  rowHover?: boolean;
  /** Alternate row shading. Default false. */
  striped?: boolean;
  /** Tighter rows. Default false. */
  compact?: boolean;
  /** Lines between columns. Default true for neon, false otherwise. */
  grid?: boolean;
  /** Corner brackets (neon). Default true. */
  corners?: boolean;
  /** Rows per page; 0 shows every row. Default 0. */
  pageSize?: number;
  /** Shown when there are no rows. Default "No rows yet". */
  emptyText?: string;
  /** Placeholder rows instead of data. Default false. */
  loading?: boolean;
  /** Placeholder row count. Default 5. */
  loadingRows?: number;
  className?: string;
}

// Headless @tanstack/react-table rendered through the semantic table
// primitives (real <table> on web, role-mapped views on native).
// Sorting and page state live in a per-instance zustand store (repo rule).
export function DataTable<T extends RowData>({
  data,
  columns,
  sortable = true,
  variant = 'default',
  title,
  color,
  district = 'midtown',
  rowHover = true,
  striped = false,
  compact = false,
  grid: gridProp,
  corners = true,
  pageSize = 0,
  emptyText = 'No rows yet',
  loading = false,
  loadingRows = 5,
  className,
}: DataTableProps<T>) {
  const store = useInstanceStore<{ sorting: SortingState; page: number }>(() => ({ sorting: [], page: 0 }));
  const sorting = useStore(store, (s) => s.sorting);
  const page = useStore(store, (s) => s.page);
  const onSortingChange = (updater: Updater<SortingState>) =>
    store.setState((s) => ({
      sorting: typeof updater === 'function' ? updater(s.sorting) : updater,
      page: 0,
    }));

  const table = useTable({
    features,
    data,
    columns,
    state: { sorting },
    onSortingChange,
    enableSorting: sortable,
  });

  const neon = variant === 'neon';
  const tone: ChartTone = color ? (PRESETS[color] ?? (color as ChartTone)) : districtTone(district);
  const s = dataTable({ variant, tone, compact });
  const showGrid = gridProp ?? neon;
  const rows = table.getRowModel().rows;
  const pages = pageSize > 0 ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const current = Math.min(page, pages - 1);
  const visible = pageSize > 0 ? rows.slice(current * pageSize, current * pageSize + pageSize) : rows;
  const columnCount = table.getAllLeafColumns().length;
  const setPage = (next: number) => store.setState({ page: Math.min(Math.max(0, next), pages - 1) });

  const grid = (
    <Table
      className="w-full flex-col"
      aria-busy={loading || undefined}
      // Computed geometry: neon tables keep ~112px a column and scroll sideways on phones.
      style={neon ? { minWidth: columnCount * 112 } : undefined}
    >
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} className={s.headRow()}>
            {headerGroup.headers.map((header, i) => {
              const sorted = header.column.getIsSorted();
              const label = header.isPlaceholder
                ? null
                : flexRender(header.column.columnDef.header, header.getContext());
              const divided = showGrid && i < headerGroup.headers.length - 1;
              return (
                <TableHeaderCell key={header.id} className={`${s.headCell()} ${divided ? s.divider() : ''}`}>
                  {sortable && header.column.getCanSort() ? (
                    <Pressable
                      onPress={() => header.column.toggleSorting()}
                      aria-label={`Sort by ${header.column.id}`}
                      className={s.headButton()}
                    >
                      <Text className={s.headLabel()}>{label}</Text>
                      <Text className={`${s.sortGlyph()} ${sorted ? '' : 'opacity-50'}`}>
                        {/* ↕ has no glyph in the brand fonts and renders 3px wide; the triangles do. */}
                        {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '▲▼'}
                      </Text>
                    </Pressable>
                  ) : (
                    label
                  )}
                </TableHeaderCell>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {loading
          ? Array.from({ length: loadingRows }, (_, r) => (
              <TableRow key={`loading-${r}`} className={`${s.row()} ${striped && r % 2 ? s.stripe() : ''}`}>
                {Array.from({ length: columnCount }, (__, c) => (
                  <TableCell key={c} className={`${s.cell()} ${showGrid && c < columnCount - 1 ? s.divider() : ''}`}>
                    <View aria-hidden className={s.skeleton()} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          : visible.length === 0
            ? (
                <TableRow className="flex-row">
                  <TableCell className={`${s.empty()} flex-1`} colSpan={columnCount}>
                    <Text className={s.emptyText()}>{emptyText}</Text>
                  </TableCell>
                </TableRow>
              )
            : visible.map((row, r) => {
                const cells = row.getAllCells();
                return (
                  <TableRow
                    key={row.id}
                    className={`${s.row()} ${striped && r % 2 ? s.stripe() : ''} ${rowHover ? '' : 'hover:bg-transparent'}`}
                  >
                    {cells.map((cell, c) => (
                      <TableCell key={cell.id} className={`${s.cell()} ${showGrid && c < cells.length - 1 ? s.divider() : ''}`}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
      </TableBody>
    </Table>
  );

  return (
    <View className={s.root({ className })}>
      {title ? (
        <View>
          <View className={s.titleBar()}>
            <Text role="heading" aria-level={2} className={s.titleText()}>{title}</Text>
          </View>
          <View aria-hidden className={s.titlePlate()} />
        </View>
      ) : null}
      {neon ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="min-w-full">
          {grid}
        </ScrollView>
      ) : (
        grid
      )}
      {pageSize > 0 && pages > 1 ? (
        <View className={s.pager()}>
          <Text className={s.pagerText()}>{`Page ${current + 1} of ${pages}`}</Text>
          <View className="flex-row gap-2">
            <Pressable aria-label="Previous page" disabled={current === 0} onPress={() => setPage(current - 1)} className={s.pagerButton()}>
              <Text className={s.pagerLabel()}>Previous</Text>
            </Pressable>
            <Pressable aria-label="Next page" disabled={current >= pages - 1} onPress={() => setPage(current + 1)} className={s.pagerButton()}>
              <Text className={s.pagerLabel()}>Next</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {neon && corners
        ? CORNERS.map((pos) => <View key={pos} aria-hidden pointerEvents="none" className={`${s.corner()} ${pos}`} />)
        : null}
    </View>
  );
}
