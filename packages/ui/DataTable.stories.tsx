import type { Meta, StoryObj } from '@storybook/react-vite';
import { DataTable, type ColumnDef } from './DataTable';
import { Badge } from './Badge';
import { View } from './tw';

type Row = { name: string; role: string; status: 'Active' | 'Invited'; logins: number };

const ROWS: Row[] = [
  { name: 'Maya Rodriguez', role: 'Owner', status: 'Active', logins: 128 },
  { name: 'Daniel Okafor', role: 'Admin', status: 'Active', logins: 94 },
  { name: 'Priya Raman', role: 'Editor', status: 'Invited', logins: 12 },
  { name: 'Marcus Bell', role: 'Editor', status: 'Active', logins: 57 },
  { name: 'Elena Fischer', role: 'Viewer', status: 'Invited', logins: 3 },
];

const COLUMNS: ColumnDef<Row, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'role', header: 'Role' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => (
      <Badge label={String(getValue())} tone={getValue() === 'Active' ? 'success' : 'neutral'} />
    ),
  },
  { accessorKey: 'logins', header: 'Logins' },
];

const meta: Meta = { title: 'UI/DataTable' };
export default meta;
type Story = StoryObj;

export const Sortable: Story = {
  render: () => (
    <View className="max-w-content-detail p-4">
      <DataTable data={ROWS} columns={COLUMNS} />
    </View>
  ),
};

type Legend = { legend: string; borough: string; type: string; catches: number; rarity: number };

const LEGENDS: Legend[] = [
  { legend: 'Bodega Cat', borough: 'Brooklyn', type: 'Street', catches: 1240, rarity: 2 },
  { legend: 'Express Wraith', borough: 'Manhattan', type: 'Subway', catches: 860, rarity: 3 },
  { legend: 'Water Tower Owl', borough: 'Queens', type: 'Rooftop', catches: 512, rarity: 3 },
  { legend: 'Stoop Sphinx', borough: 'Manhattan', type: 'Street', catches: 431, rarity: 4 },
  { legend: 'Harbor Kraken', borough: 'Staten Is.', type: 'Harbor', catches: 98, rarity: 5 },
  { legend: 'Pigeon Prime', borough: 'Bronx', type: 'Park', catches: 2210, rarity: 1 },
  { legend: 'Hydrant Imp', borough: 'Queens', type: 'Street', catches: 1730, rarity: 1 },
  { legend: 'Deco Gargoyle', borough: 'Manhattan', type: 'Rooftop', catches: 204, rarity: 4 },
];

const LEGEND_COLUMNS: ColumnDef<Legend, unknown>[] = [
  { accessorKey: 'legend', header: 'Legend' },
  { accessorKey: 'borough', header: 'Borough' },
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'catches', header: 'Catches' },
  { accessorKey: 'rarity', header: 'Rarity', cell: ({ getValue }) => '★'.repeat(Number(getValue())) },
];

/** variant="neon": NeonBlade's NeonTable as a scoreboard. Hover a row; sort a column; page through. */
export const Neon: StoryObj<typeof DataTable<Legend>> = {
  args: {
    variant: 'neon',
    title: 'Legends board',
    district: 'midtown',
    striped: true,
    compact: false,
    corners: true,
    rowHover: true,
    pageSize: 5,
    loading: false,
  },
  argTypes: {
    district: { control: 'inline-radio', options: ['downtown', 'midtown', 'harlem', 'megacity'] },
    color: { control: 'inline-radio', options: ['orange', 'royal', 'carolina', 'leaf', 'apple'] },
  },
  render: (args) => (
    <View className="min-h-screen gap-8 bg-ink-950 p-4 md:p-8">
      <View className="max-w-content-detail">
        <DataTable {...args} data={LEGENDS} columns={LEGEND_COLUMNS} />
      </View>
      <View className="max-w-content-detail gap-6 md:flex-row">
        <DataTable variant="neon" color="royal" title="Loading" data={LEGENDS} columns={LEGEND_COLUMNS.slice(0, 3)} loading loadingRows={3} className="md:flex-1" />
        <DataTable variant="neon" color="apple" title="Harbor sightings" data={[]} columns={LEGEND_COLUMNS.slice(0, 3)} emptyText="No sightings on the water yet" className="md:flex-1" />
      </View>
    </View>
  ),
};
