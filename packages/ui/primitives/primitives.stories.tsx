import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Page, Main, Header, Footer, Nav, Section, Article, Aside,
  Figure, Figcaption, Address, Details, Summary,
  Heading, Paragraph, Text, Time, List, ListItem,
  Button, Link, Form, Fieldset, Legend, Label, Input, Textarea, Select,
  Table, TableHeader, TableBody, TableRow, TableCell, TableHeaderCell,
} from './index';
import { TONE_CLASSES } from '../district';

// §7: every primitive rendered semantically; the a11y addon audits each story.
// The primitives are unstyled semantic hosts. These stories dress them in the
// NYC-MON grammar the kit components use: night surfaces, heavy ink keylines,
// square corners, solid orange faces on a depth plate, the display face for
// titles, and glow only on keyboard focus.

const o = TONE_CLASSES.orange;

const meta = { title: 'Primitives' } satisfies Meta;
export default meta;
type Story = StoryObj;

export const Landmarks: Story = {
  render: () => (
    <Page className="gap-4 bg-ink-950 p-6">
      <Header className={`border-b-4 ${o.border} pb-3`}>
        <Nav className="flex-row gap-2">
          <Link href="https://example.com" className={`${o.face} px-3 py-1.5 font-display text-sm ${o.onFace}`}>Home</Link>
          <Link href="https://example.com/social" className="px-3 py-1.5 font-display text-sm text-silver-300 hover:bg-ink-800">Instagram</Link>
        </Nav>
      </Header>
      <Main className="gap-4">
        <Section className="gap-3">
          <Heading level={2} className="font-display text-display-sm text-ink-50">Schedule</Heading>
          <Article className="gap-1 border-2 border-ink-800 bg-ink-900 p-4">
            <Heading level={3} className="font-display text-lg text-ink-50">Tuesday standup</Heading>
            <Paragraph className="text-silver-300">Whole team: bring your quarterly notes.</Paragraph>
            <Time className={`font-display text-sm ${o.text}`}>9:00 AM</Time>
          </Article>
        </Section>
        <Aside className="border-l-4 border-royal-500 bg-ink-900 p-4">
          <Paragraph className="text-sm text-silver-300">From the team lead</Paragraph>
        </Aside>
      </Main>
      <Footer className="border-t-2 border-ink-800 pt-3">
        <Address className="text-sm text-silver-300">Harlem, New York</Address>
      </Footer>
    </Page>
  ),
};

export const ContentAndLists: Story = {
  render: () => (
    <Page className="gap-4 bg-ink-950 p-6">
      {([1, 2, 3, 4, 5, 6] as const).map((level) => (
        <Heading key={level} level={level} className="font-display text-ink-50">
          Heading level {level}
        </Heading>
      ))}
      <Paragraph className="text-ink-50">
        Body paragraph with <Text className={`font-semibold ${o.text}`}>inline text</Text> inside.
      </Paragraph>
      <Figure className="gap-1">
        <Text className="text-4xl">🖼️</Text>
        <Figcaption className="text-sm text-silver-300">A caption for the figure</Figcaption>
      </Figure>
      <Details className="border-2 border-ink-800 bg-ink-900 p-3">
        <Summary className="font-display text-ink-50">Release notes (details/summary)</Summary>
        <Paragraph className="pt-2 text-silver-300">Highlights from the latest release.</Paragraph>
      </Details>
      <List className="gap-1 pl-4">
        <ListItem className="text-ink-50">First item</ListItem>
        <ListItem className="text-ink-50">Second item</ListItem>
        <ListItem className="text-ink-50">Third item</ListItem>
      </List>
    </Page>
  ),
};

// NYC-MON form grammar: each field is a label-over-control group in a night
// well with a heavy ink keyline that turns orange (and glows) on focus; the
// fieldset is a night panel whose legend is a solid orange nameplate; the
// action is a solid face that drops into its depth plate when pressed.
const fieldLabel = 'font-display text-sm text-ink-50';
const control =
  `w-full rounded-none border-2 border-ink-800 bg-ink-950 p-3 text-ink-50 placeholder:text-ink-400 ` +
  `transition-colors duration-fast focus:outline-none ${o.focusBorder} ${o.focusGlow} motion-reduce:transition-none`;

export const FormControls: Story = {
  render: () => (
    <Page className="max-w-content-form gap-5 bg-ink-950 p-6">
      <Form className="gap-5">
        <Fieldset className="flex flex-col gap-4 border-2 border-ink-800 bg-ink-900 p-5">
          <Legend className={`${o.face} px-2.5 py-0.5 font-display text-sm ${o.onFace}`}>
            Profile
          </Legend>
          <Label className="flex flex-col gap-1.5">
            <Text className={fieldLabel}>Full name</Text>
            <Input placeholder="Your name" className={control} />
          </Label>
          <Label className="flex flex-col gap-1.5">
            <Text className={fieldLabel}>Bio</Text>
            <Textarea placeholder="A few words about you" className={`min-h-24 ${control}`} />
            <Text className="text-xs text-silver-300">Shown on your public page.</Text>
          </Label>
          <Label className="flex flex-col gap-1.5">
            <Text className={fieldLabel}>Role</Text>
            <Select value="editor" className={control}>
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </Select>
          </Label>
        </Fieldset>
        <Page className="flex-row flex-wrap items-center gap-3">
          <Button
            className={`items-center rounded-none border-2 ${o.controlKeyline} ${o.face} px-5 py-2.5 shadow-[4px_4px_0_0_var(--color-orange-700)] transition-transform duration-fast active:translate-x-[4px] active:translate-y-[4px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg motion-reduce:transition-none`}
          >
            <Text className={`whitespace-nowrap font-display ${o.onFace}`}>Save changes</Text>
          </Button>
          <Button
            aria-disabled
            className="cursor-not-allowed items-center rounded-none border-2 border-ink-700 bg-ink-950 px-5 py-2.5"
          >
            <Text className="whitespace-nowrap font-display text-ink-400">Save changes</Text>
          </Button>
        </Page>
      </Form>
    </Page>
  ),
};

export const DataTable: Story = {
  render: () => (
    <Page className="bg-ink-950 p-6">
      <Table className="w-full border-2 border-ink-800 bg-ink-900">
        <TableHeader>
          <TableRow className={`border-b-4 ${o.border}`}>
            <TableHeaderCell className="p-2 text-left font-display text-ink-50">Item</TableHeaderCell>
            <TableHeaderCell className="p-2 text-left font-display text-ink-50">Status</TableHeaderCell>
            <TableHeaderCell className="p-2 text-left font-display text-ink-50">Count</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="border-b-2 border-ink-800">
            <TableCell className="p-2 text-ink-50">First item</TableCell>
            <TableCell className={`p-2 ${o.text}`}>Active</TableCell>
            <TableCell className="p-2 text-silver-300">63</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="p-2 text-ink-50">Second item</TableCell>
            <TableCell className="p-2 text-silver-300">Draft</TableCell>
            <TableCell className="p-2 text-silver-300">72</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Page>
  ),
};
