import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Pagination, type PaginationProps } from './Pagination';
import { View } from './tw';

const meta = { title: 'UI/Pagination' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const Controlled = (args: Omit<PaginationProps, 'onPageChange' | 'onPageSizeChange'>) => {
  const [page, setPage] = useState(args.page);
  const [size, setSize] = useState(args.pageSize);
  return (
    <Pagination
      {...args}
      page={page}
      pageSize={size}
      onPageChange={setPage}
      onPageSizeChange={(n) => { setSize(n); setPage(1); }}
    />
  );
};

const BASE: Omit<PaginationProps, 'onPageChange' | 'onPageSizeChange'> = {
  page: 2, pageCount: 25, totalCount: 1204, pageSize: 50, pageSizeOptions: [25, 50, 100],
};

/** Middle page: full status line, both buttons, page-size select. */
export const Default: Story = {
  render: () => (
    <View className="max-w-3xl p-4">
      <Controlled {...BASE} />
    </View>
  ),
};

/** Previous disabled on the first page. */
export const FirstPage: Story = {
  render: () => (
    <View className="max-w-3xl p-4">
      <Controlled {...BASE} page={1} />
    </View>
  ),
};

/** Next disabled on the last page. */
export const LastPage: Story = {
  render: () => (
    <View className="max-w-3xl p-4">
      <Controlled {...BASE} page={25} />
    </View>
  ),
};

/** Narrow container: the compact form — Previous/Next plus "Page N of M". */
export const Compact: Story = {
  render: () => (
    <View className="w-80 p-4">
      <Controlled {...BASE} />
    </View>
  ),
};
