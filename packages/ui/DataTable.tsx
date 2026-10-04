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
  type Header as TanStackHeader,
  type Row as TanStackRow,
  type RowData,
  type SortingState,
  type Updater,
} from '@tanstack/react-table';
import { useInstanceStore, useStore } from './use-instance-store';
import { useLayoutSize } from './use-layout-size';
import {
  Table, TableHeader, TableBody, TableRow, TableCell, TableHeaderCell, TableCaption, VisuallyHidden,
} from './primitives';
import { View, Text, Pressable, ScrollView } from './tw';
import { Link } from './html';
import { districtTone, type ChartTone, type District } from './district';
import type { ReactNode } from 'react';

/**
 * The NYC-MON table. `surface="night"` (default) is NeonBlade's NeonTable as
 * a scoreboard: a solid tone title bar on a darker plate, a night body,
 * cornice corner brackets, and a tone bar that slides along the hovered row.
 * `surface="page"` is the ops console's daylit face (04-components.md G1): a
 * `surface-raised` body, `border` keylines, `text`/`text-muted` type, tone
 * only on the selection bar and the sort glyph — no glow, no title plate.
 * Ported from NeonBlade UI (MIT, see THIRD-PARTY-NOTICES.md).
 */
const dataTable = tv({
  slots: {
    root: 'relative w-full overflow-hidden border-2',
    titleBar: 'px-4 py-3',
    titleText: 'font-display text-lg',
    titlePlate: 'flex h-1.5',
    headRow: 'border-b-2',
    headCell: 'flex-1 p-3 text-left font-display text-xs',
    headButton: 'flex-row items-center gap-1.5',
    headLabel: 'font-display text-xs',
    sortGlyph: 'text-xs',
    row:
      'flex-row border-b border-l-4 border-l-transparent transition-colors duration-fast ' +
      'motion-reduce:transition-none',
    rowSelected: '',
    cell: 'flex-1 justify-center p-3 text-sm',
    divider: 'border-r',
    empty: 'items-center p-8',
    emptyText: 'font-display text-sm',
    skeleton: 'h-3 w-3/4',
    corner: 'absolute flex h-4 w-4',
    pager: 'flex-row items-center justify-between gap-3 border-t-2 px-3 py-2',
    pagerText: 'text-xs',
    pagerButton: 'min-h-11 justify-center border-2 px-3 disabled:opacity-40',
    pagerLabel: 'text-sm font-semibold',
    selectCell: 'w-12 items-center justify-center p-3',
    selectBox: 'h-5 w-5 items-center justify-center border-2',
    record: 'gap-2 p-4',
    recordField: 'gap-0.5',
    recordLabel: 'font-display text-xs',
    detailsButton: 'min-h-11 flex-row items-center gap-2 self-start px-1',
    detailsLabel: 'font-display text-xs underline',
    // One cell spans every column in the records layout.
    recordCell: 'flex-1 p-0',
  },
  variants: {
    surface: {
      night: {
        root: 'border-ink-800 bg-ink-950',
        titleText: 'text-ink-950',
        headRow: 'border-l-4 border-l-transparent bg-ink-900',
        headCell: 'text-silver-300',
        headLabel: 'text-silver-300',
        row: 'border-b-ink-800',
        cell: 'text-silver-100',
        divider: 'border-ink-800',
        emptyText: 'text-silver-400',
        skeleton: 'bg-ink-800',
        pager: 'border-ink-800 bg-ink-900',
        pagerText: 'text-silver-400',
        pagerButton: 'border-ink-700 bg-ink-950',
        pagerLabel: 'text-silver-100',
        recordLabel: 'text-silver-400',
        detailsLabel: 'text-silver-200',
        selectBox: 'border-ink-600 bg-ink-950',
      },
      page: {
        root: 'border-border bg-surface-raised',
        titleText: 'text-text',
        headRow: 'border-border bg-surface-sunken',
        headCell: 'text-text-muted',
        headLabel: 'text-text-muted',
        row: 'border-b-border',
        cell: 'text-text',
        divider: 'border-border',
        emptyText: 'text-text-muted',
        skeleton: 'bg-surface-sunken',
        pager: 'border-border bg-surface-sunken',
        pagerText: 'text-text-muted',
        pagerButton: 'border-border-strong bg-surface-raised',
        pagerLabel: 'text-text',
        recordLabel: 'text-text-muted',
        detailsLabel: 'text-text',
        selectBox: 'border-border-strong bg-surface-raised',
      },
    },
    tone: {
      orange: { titleBar: 'bg-orange-500', titlePlate: 'bg-orange-800', headRow: 'border-b-orange-500', row: 'hover:border-l-orange-500 hover:bg-orange-500/10', rowSelected: 'border-l-orange-500 bg-orange-500/10', sortGlyph: 'text-orange-400', corner: 'border-orange-500', selectBox: '' },
      royal: { titleBar: 'bg-royal-500', titlePlate: 'bg-royal-800', headRow: 'border-b-royal-500', row: 'hover:border-l-royal-400 hover:bg-royal-500/15', rowSelected: 'border-l-royal-500 bg-royal-500/10', sortGlyph: 'text-royal-300', corner: 'border-royal-500', titleText: 'text-white' },
      carolina: { titleBar: 'bg-carolina-500', titlePlate: 'bg-carolina-800', headRow: 'border-b-carolina-500', row: 'hover:border-l-carolina-500 hover:bg-carolina-500/10', rowSelected: 'border-l-carolina-500 bg-carolina-500/10', sortGlyph: 'text-carolina-300', corner: 'border-carolina-500' },
      leaf: { titleBar: 'bg-leaf-500', titlePlate: 'bg-leaf-800', headRow: 'border-b-leaf-500', row: 'hover:border-l-leaf-500 hover:bg-leaf-500/10', rowSelected: 'border-l-leaf-500 bg-leaf-500/10', sortGlyph: 'text-leaf-300', corner: 'border-leaf-500' },
      // Night title text: white on apple-500 is 3.96:1, under 4.5 for an 18px title.
      apple: { titleBar: 'bg-apple-500', titlePlate: 'bg-apple-800', headRow: 'border-b-apple-500', row: 'hover:border-l-apple-500 hover:bg-apple-500/10', rowSelected: 'border-l-apple-500 bg-apple-500/10', sortGlyph: 'text-apple-300', corner: 'border-apple-500' },
    },
    compact: {
      true: { headCell: 'px-3 py-2', cell: 'px-3 py-2' },
      false: {},
    },
  },
  defaultVariants: { surface: 'night', tone: 'orange', compact: false },
});

// Corner brackets: the cornice at each corner of the night table.
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

declare module '@tanstack/react-table' {
  // Column metadata the NYC-MON table reads (04-components.md G2): which
  // columns drop first at narrow pane widths and which run right-aligned.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TFeatures, TData extends RowData, TValue> {
    /** 1 never drops; 2–4 drop progressively below ~820 px of pane width. Default 1. */
    priority?: 1 | 2 | 3 | 4;
    /** 'end' right-aligns the cell; numbers take it. Default 'start'. */
    align?: 'start' | 'end';
  }
}

/** Server-side sort state: which column and direction the server applied. */
export type SortState = { columnId: string; direction: 'asc' | 'desc' } | undefined;

/** Row selection for tables with a bulk action. */
export interface DataTableSelection {
  selectedIds: readonly string[];
  onSelectedIdsChange: (ids: string[]) => void;
}

/** Where the rows come from (04-components.md G2). */
export type DataTableMode<T extends RowData> =
  | { kind: 'client'; pageSize?: number }
  | {
      kind: 'server';
      /** The sort the server applied; drives the glyph and `aria-sort`. */
      sort: SortState;
      /** Ask the server for the next sort (toggle semantics on the clicked column). */
      onSortChange: (next: SortState) => void;
      /** The server's rows for this page; overrides `data`. */
      rows: T[];
    };

const PRESETS: Record<string, ChartTone> = { cyan: 'carolina', pink: 'apple', green: 'leaf' };

/** Pane width below which `layout="auto"` renders record rows (04-components.md). */
const RECORDS_BELOW = 600;
/** Pane widths at which `priority` 2/3/4 columns reappear in columns layout. */
const PRIORITY_MIN_WIDTH: Record<number, number> = { 2: 640, 3: 760, 4: 880 };

export interface DataTableProps<T extends RowData> {
  /** Client-mode rows. Ignored when `mode.kind === 'server'` (mode carries them). */
  data?: T[];
  columns: ColumnDef<T, unknown>[];
  /** The table's name (04-components.md G2). Visually hidden by default. */
  caption?: string;
  /** Show the caption instead of hiding it. Default false. */
  showCaption?: boolean;
  /**
   * 'auto' (default): record rows below 600 px of pane width, priority
   * columns above. 'columns': always the column grid. 'records': always
   * record rows.
   */
  layout?: 'auto' | 'columns' | 'records';
  /** Client sort + in-memory paging (default) or server-driven rows/sort. */
  mode?: DataTableMode<T>;
  /** Stable id per row; needed for `getRowHref`, `selectedRowId` and `selection`. */
  getRowId?: (row: T) => string;
  /** Whole row is one link; `selectedRowId` sets `aria-current` on it. */
  getRowHref?: (row: T) => string;
  /** The open record's row id: selection bar, tint and `aria-current="page"`. */
  selectedRowId?: string;
  /** Checkbox column for bulk actions. */
  selection?: DataTableSelection;
  /** Replaces `emptyText` when there are no rows. */
  emptyState?: ReactNode;
  /** Replaces the body when the server read failed. */
  errorState?: ReactNode;
  /** Enable click-to-sort headers (client) / sort buttons (server). Default true. */
  sortable?: boolean;
  /** 'night' (default) is the scoreboard facade; 'page' is the daylit console face. */
  surface?: 'night' | 'page';
  /** Kept for callers: both names render the NYC-MON scoreboard table. */
  variant?: 'default' | 'neon';
  /** Heading bar above the table (night surface only). */
  title?: string;
  /** Neon accent: a tone family or a NeonBlade preset (cyan, pink, green). Default: the district's tone. */
  color?: ChartTone | 'cyan' | 'pink' | 'green';
  /** Neon accent by neighbourhood. Default midtown (orange). */
  district?: District;
  /** Tone bar and tint on the hovered row. Default true. */
  rowHover?: boolean;
  /** Alternate row shading. Default false. */
  striped?: boolean;
  /** Tighter rows. Default false. */
  compact?: boolean;
  /** Lines between columns. Default true. */
  grid?: boolean;
  /** Corner brackets (night surface only). Default true. */
  corners?: boolean;
  /** Rows per page in client mode; 0 shows every row. Default 0. Prefer `mode`. */
  pageSize?: number;
  /** Shown when there are no rows and no `emptyState`. Default "No rows yet". */
  emptyText?: string;
  /** Placeholder rows instead of data. Default false. */
  loading?: boolean;
  /** Placeholder row count. Default 5. */
  loadingRows?: number;
  /** Opt-in rounded corners (rounded-soft). Default false: square. */
  rounded?: boolean;
  className?: string;
}

// The same declarations as Tailwind's `sr-only`, applied to the records-mode
// header row so it still exists for assistive tech (G2).
const VISUALLY_HIDDEN_ROW = {
  position: 'absolute' as const, width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden' as const, whiteSpace: 'nowrap' as const, borderWidth: 0,
};

// Headless @tanstack/react-table rendered through the semantic table
// primitives (real <table> on web, role-mapped views on native).
// Sorting, page, pane width and expanded rows live in per-instance zustand
// stores (repo rule: no useState for component state).
export function DataTable<T extends RowData>({
  data,
  columns,
  caption,
  showCaption = false,
  layout = 'auto',
  mode,
  getRowId,
  getRowHref,
  selectedRowId,
  selection,
  emptyState,
  errorState,
  sortable = true,
  surface = 'night',
  variant: _variant,
  title,
  color,
  district = 'midtown',
  rowHover = true,
  striped = false,
  compact = false,
  grid: gridProp,
  corners = true,
  pageSize: pageSizeProp = 0,
  emptyText = 'No rows yet',
  loading = false,
  loadingRows = 5,
  className, rounded = false,
}: DataTableProps<T>) {
  const server = mode?.kind === 'server' ? mode : undefined;
  const rows_ = server ? server.rows : (data ?? []);
  const pageSize = mode?.kind === 'client' && mode.pageSize !== undefined ? mode.pageSize : pageSizeProp;

  const store = useInstanceStore<{ sorting: SortingState; page: number; expanded: string[] }>(
    () => ({ sorting: [], page: 0, expanded: [] }),
  );
  const sorting = useStore(store, (s) => s.sorting);
  const page = useStore(store, (s) => s.page);
  const expanded = useStore(store, (s) => s.expanded);
  const onSortingChange = (updater: Updater<SortingState>) =>
    store.setState((s) => ({
      sorting: typeof updater === 'function' ? updater(s.sorting) : updater,
      page: 0,
    }));

  // The pane width drives layout="auto" and the column-priority drops.
  const { size: pane, onLayout } = useLayoutSize({ width: 1024, height: 1 });
  const recordsLayout = layout === 'records' || (layout === 'auto' && pane.width < RECORDS_BELOW);

  const table = useTable({
    features,
    data: rows_,
    columns,
    // Server mode hands back sorted rows: keep the local sort state empty so
    // the sorted row model is a pass-through; header clicks go to onSortChange.
    state: { sorting: server ? [] : sorting },
    onSortingChange,
    enableSorting: sortable && !server,
  });

  const tone: ChartTone = color ? (PRESETS[color] ?? (color as ChartTone)) : districtTone(district);
  const s = dataTable({ tone, compact, surface });
  const showGrid = gridProp ?? true;
  const rows = table.getRowModel().rows;
  const pages = pageSize > 0 ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const current = Math.min(page, pages - 1);
  const visible = pageSize > 0 ? rows.slice(current * pageSize, current * pageSize + pageSize) : rows;

  // Column-priority drops: a column with meta.priority p renders only when the
  // pane is wide enough for it. Priority 1 never drops.
  const leafColumns = table.getAllLeafColumns();
  const visibleLeafIds = new Set(
    leafColumns
      .filter((col) => {
        const priority = col.columnDef.meta?.priority ?? 1;
        return recordsLayout || pane.width >= (PRIORITY_MIN_WIDTH[priority] ?? 0);
      })
      .map((col) => col.id),
  );
  const columnCount = visibleLeafIds.size + (selection ? 1 : 0);
  const setPage = (next: number) => store.setState({ page: Math.min(Math.max(0, next), pages - 1) });

  const toggleExpanded = (id: string) =>
    store.setState((s) => ({
      expanded: s.expanded.includes(id) ? s.expanded.filter((e) => e !== id) : [...s.expanded, id],
    }));

  // Server sort toggle: asc -> desc -> cleared, same as the client tri-state.
  const onHeaderPress = (columnId: string, canSort: boolean, toggle: () => void) => {
    if (!canSort) return;
    if (!server) { toggle(); return; }
    const cur = server.sort;
    const next: SortState =
      !cur || cur.columnId !== columnId
        ? { columnId, direction: 'asc' }
        : cur.direction === 'asc'
          ? { columnId, direction: 'desc' }
          : undefined;
    server.onSortChange(next);
  };

  const headerCell = (header: TanStackHeader<typeof features, T, unknown>, i: number, total: number) => {
    const sorted = server
      ? (server.sort?.columnId === header.column.id ? server.sort.direction : false)
      : header.column.getIsSorted();
    const label = header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext());
    const divided = showGrid && i < total - 1;
    const ariaSort = sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none';
    return (
      <TableHeaderCell key={header.id} aria-sort={ariaSort} className={`${s.headCell()} ${divided ? s.divider() : ''}`}>
        {sortable && header.column.getCanSort() ? (
          <Pressable
            onPress={() => onHeaderPress(header.column.id, true, () => header.column.toggleSorting())}
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
  };

  const selectBox = (checked: boolean, onChange: () => void, label: string) => (
    <Pressable
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onPress={onChange}
      className={s.selectBox()}
    >
      {checked ? <Text className="text-sm">✓</Text> : null}
    </Pressable>
  );

  const allIds = visible.map((row) => getRowId?.(row.original) ?? row.id);
  const allSelected = !!selection && allIds.length > 0 && allIds.every((id) => selection.selectedIds.includes(id));
  const toggleAll = () => {
    if (!selection) return;
    selection.onSelectedIdsChange(
      allSelected ? [] : [...new Set([...selection.selectedIds, ...allIds])],
    );
  };

  // Row chrome shared by both layouts: selection state, tint, hover, link.
  const rowState = (row: TanStackRow<typeof features, T>, r: number) => {
    const id = getRowId?.(row.original) ?? row.id;
    const selected = selectedRowId === id || (!!selection && selection.selectedIds.includes(id));
    const hover = rowHover && !selected ? '' : 'hover:border-l-transparent';
    const cls = `${s.row()} ${striped && r % 2 ? (surface === 'night' ? 'bg-ink-900' : 'bg-surface-sunken') : ''} ${selected ? s.rowSelected() : ''} ${hover}`;
    return { id, selected, cls };
  };

  const selectionCell = (row: TanStackRow<typeof features, T>) => {
    if (!selection) return null;
    const { id } = rowState(row, 0);
    const checked = selection.selectedIds.includes(id);
    return (
      <TableCell key="__select" className={s.selectCell()}>
        {selectBox(checked, () => {
          selection.onSelectedIdsChange(
            checked ? selection.selectedIds.filter((x) => x !== id) : [...selection.selectedIds, id],
          );
        }, 'Select row')}
      </TableCell>
    );
  };

  // Record rows print each column's header as the field label; the header
  // template needs its own context, so the headers are indexed by column id.
  const headerById = new Map(
    table.getHeaderGroups().flatMap((g) => g.headers).map((h) => [h.column.id, h]),
  );
  const recordLabel = (cell: TanStackRow<typeof features, T>['getAllCells'] extends () => (infer C)[] ? C : never) => {
    const header = headerById.get(cell.column.id);
    return header ? flexRender(header.column.columnDef.header, header.getContext()) : null;
  };

  const recordFields = (row: TanStackRow<typeof features, T>) => {
    const cells = row.getAllCells().filter((cell) => visibleLeafIds.has(cell.column.id));
    const main = cells.filter((c) => (c.column.columnDef.meta?.priority ?? 1) <= 2);
    const rest = cells.filter((c) => (c.column.columnDef.meta?.priority ?? 1) > 2);
    return { main, rest };
  };

  const recordBlock = (row: TanStackRow<typeof features, T>) => {
    const { id } = rowState(row, 0);
    const { main, rest } = recordFields(row);
    const isOpen = expanded.includes(id);
    return (
      <View className={s.record()}>
        {main.map((cell) => (
          <View key={cell.id} className={s.recordField()}>
            <Text className={s.recordLabel()}>{recordLabel(cell)}</Text>
            <View>{flexRender(cell.column.columnDef.cell, cell.getContext())}</View>
          </View>
        ))}
        {rest.length > 0 ? (
          <>
            {/* The controlled region exists at every state so aria-controls resolves. */}
            <View nativeID={`row-${id}-details`}>
              {isOpen
                ? rest.map((cell) => (
                    <View key={cell.id} className={s.recordField()}>
                      <Text className={s.recordLabel()}>{recordLabel(cell)}</Text>
                      <View>{flexRender(cell.column.columnDef.cell, cell.getContext())}</View>
                    </View>
                  ))
                : null}
            </View>
            <Pressable
              role="button"
              aria-expanded={isOpen}
              aria-controls={`row-${id}-details`}
              onPress={() => toggleExpanded(id)}
              className={s.detailsButton()}
            >
              <Text className={s.detailsLabel()}>{isOpen ? 'Hide details' : 'Details'}</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    );
  };

  const bodyRow = (row: TanStackRow<typeof features, T>, r: number) => {
    const { id, selected, cls } = rowState(row, r);
    const href = getRowHref?.(row.original);
    if (recordsLayout) {
      const block = recordBlock(row);
      return (
        <TableRow key={id} className={cls}>
          {selectionCell(row)}
          <TableCell className={s.recordCell()} colSpan={visibleLeafIds.size}>
            {href ? (
              <Link href={href} aria-current={selected && selectedRowId === id ? 'page' : undefined} className="no-underline">
                {block}
              </Link>
            ) : (
              block
            )}
          </TableCell>
        </TableRow>
      );
    }
    const cells = row.getAllCells().filter((cell) => visibleLeafIds.has(cell.column.id));
    return (
      <TableRow key={id} className={cls}>
        {selectionCell(row)}
        {cells.map((cell, c) => (
          <TableCell
            key={cell.id}
            className={`${s.cell()} ${cell.column.columnDef.meta?.align === 'end' ? 'items-end text-right' : ''} ${showGrid && c < cells.length - 1 ? s.divider() : ''}`}
          >
            {href ? (
              <Link href={href} aria-current={selected && selectedRowId === id ? 'page' : undefined} className="no-underline">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </Link>
            ) : (
              flexRender(cell.column.columnDef.cell, cell.getContext())
            )}
          </TableCell>
        ))}
      </TableRow>
    );
  };

  const body = loading ? (
    Array.from({ length: loadingRows }, (_, r) => (
      <TableRow key={`loading-${r}`} className={s.row()}>
        {selection ? <TableCell className={s.selectCell()} /> : null}
        {Array.from({ length: recordsLayout ? 1 : visibleLeafIds.size }, (__, c) => (
          <TableCell key={c} className={`${s.cell()} ${showGrid && c < visibleLeafIds.size - 1 ? s.divider() : ''}`}>
            <View aria-hidden className={s.skeleton()} />
          </TableCell>
        ))}
      </TableRow>
    ))
  ) : errorState ? (
    <TableRow className="flex-row">
      <TableCell className={`${s.empty()} flex-1`} colSpan={columnCount}>{errorState}</TableCell>
    </TableRow>
  ) : visible.length === 0 ? (
    <TableRow className="flex-row">
      <TableCell className={`${s.empty()} flex-1`} colSpan={columnCount}>
        {emptyState ?? <Text className={s.emptyText()}>{emptyText}</Text>}
      </TableCell>
    </TableRow>
  ) : (
    visible.map(bodyRow)
  );

  const grid = (
    <Table
      className="w-full flex-col"
      aria-busy={loading || undefined}
      // Computed geometry: tables keep ~112px a column and scroll sideways on phones.
      style={recordsLayout ? undefined : { minWidth: columnCount * 112 }}
    >
      {caption ? (
        <TableCaption className={showCaption ? `${s.emptyText()} p-2 text-left` : ''}>
          {showCaption ? caption : <VisuallyHidden>{caption}</VisuallyHidden>}
        </TableCaption>
      ) : null}
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup, gi) => {
          const headers = headerGroup.headers.filter((h) => visibleLeafIds.has(h.column.id));
          return (
            <TableRow key={headerGroup.id} className={s.headRow()} style={recordsLayout && gi === 0 ? VISUALLY_HIDDEN_ROW : undefined}>
              {selection ? (
                <TableHeaderCell className={s.selectCell()}>
                  {selectBox(allSelected, toggleAll, 'Select all rows')}
                </TableHeaderCell>
              ) : null}
              {headers.map((header, i) => headerCell(header, i, headers.length))}
            </TableRow>
          );
        })}
      </TableHeader>
      <TableBody>{body}</TableBody>
    </Table>
  );

  return (
    <View onLayout={onLayout} className={s.root({ className: `${rounded ? 'rounded-soft overflow-hidden' : ''} ${className ?? ''}` })}>
      {title ? (
        <View>
          <View className={s.titleBar()}>
            <Text role="heading" aria-level={2} className={s.titleText()}>{title}</Text>
          </View>
          <View aria-hidden className={s.titlePlate()} />
        </View>
      ) : null}
      {recordsLayout ? grid : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="min-w-full">
          {grid}
        </ScrollView>
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
      {corners && surface === 'night'
        ? CORNERS.map((pos) => <View key={pos} aria-hidden pointerEvents="none" className={`${s.corner()} ${pos}`} />)
        : null}
    </View>
  );
}
