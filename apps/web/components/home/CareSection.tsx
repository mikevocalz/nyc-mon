import { ProgressBar } from '@acme/ui/progress';
import { SolidPanel } from '@acme/ui';
import { Heading, List, ListItem, Paragraph, Section } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { Eyebrow } from './Eyebrow';
import { W01_COPY } from './copy';

/** "How care works": three meters, three verbs (BUILD_PROMPT §2.1). Not a sequence, so no numbers. */
export function CareSection() {
  const copy = W01_COPY.care;
  return (
    <Section
      aria-labelledby="w01-care-title"
      data-testid="w01-care"
      className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:px-8"
    >
      <View className="max-w-2xl gap-4">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <Heading level={2} id="w01-care-title" className="my-0 font-display text-3xl leading-tight text-text md:text-4xl">
          {copy.title}
        </Heading>
        <Paragraph className="my-0 text-base leading-7 text-text-secondary md:text-lg md:leading-8">{copy.body}</Paragraph>
      </View>
      <List className="m-0 list-none gap-10 p-0 md:flex-row md:gap-8">
        {copy.items.map((item) => (
          <ListItem key={item.verb} className="flex-1">
            <SolidPanel surface="page" depth="md" className="h-full gap-3 px-5 py-6">
              <Heading level={3} className="my-0 font-display text-2xl text-text">{item.verb}</Heading>
              <Paragraph className="my-0 text-base leading-7 text-text-secondary">{item.line}</Paragraph>
              <ProgressBar
                value={item.value}
                color={item.color}
                variant="segmented"
                size="sm"
                showLabel
                label={item.meter}
                glow={false}
              />
            </SolidPanel>
          </ListItem>
        ))}
      </List>
      <Paragraph className="my-0 text-sm text-text-muted">{copy.example}</Paragraph>
    </Section>
  );
}
