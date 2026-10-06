import { Badge, LinkButton, SolidPanel } from '@acme/ui';
import { Article, Heading, List, ListItem, Paragraph, Section } from '@acme/ui/html';
import { Text, View } from '@acme/ui/tw';
import { Eyebrow } from '../home/Eyebrow';
import { W02_COPY } from './copy';
import type { MonsStarter } from './starters';

/** W02 detail: one starter — its Bloodline, its egg and its full line. */
export function MonsDetailPage({ starter }: { starter: MonsStarter }) {
  const copy = W02_COPY.detail;
  const blurb = copy.blurb[starter.slug];
  return (
    <View className="w-full flex-1 bg-bg">
      <Section
        aria-labelledby={`w02-${starter.slug}-title`}
        data-testid={`w02-mon-${starter.slug}`}
        className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:px-8"
      >
        <Article className="max-w-3xl gap-10">
          <View className="gap-4">
            <Eyebrow>{copy.eyebrow(starter.bloodline)}</Eyebrow>
            <Heading
              level={1}
              id={`w02-${starter.slug}-title`}
              className="my-0 font-display text-3xl leading-tight text-text md:text-4xl"
            >
              {starter.babyName}
            </Heading>
            <Badge label={copy.dex(starter.dexId)} tone="neutral" size="sm" />
            <Paragraph className="my-0 text-base leading-7 text-text-secondary md:text-lg md:leading-8">
              {copy.bloodlineBody(starter.bloodline)}
            </Paragraph>
            <Paragraph className="my-0 text-base leading-7 text-text-secondary md:text-lg md:leading-8">
              {copy.eggBody(starter.eggName, starter.babyName)}
            </Paragraph>
            {blurb === undefined ? null : (
              <Paragraph className="my-0 text-base font-semibold leading-7 text-text">{blurb}</Paragraph>
            )}
          </View>
          <View className="gap-4">
            <Heading level={2} className="my-0 font-display text-2xl leading-tight text-text">
              {copy.lineTitle}
            </Heading>
            <SolidPanel surface="page" depth="md" className="px-5 py-6">
              <List className="m-0 list-none gap-3 p-0">
                {starter.line.map((step) => (
                  <ListItem key={step.key} className="flex-row items-center gap-3">
                    <Badge label={step.stage} tone="neutral" size="sm" />
                    <Text className="flex-1 font-semibold text-text">{step.name ?? copy.unnamedForm}</Text>
                    {step.dexId === null ? null : (
                      <Text className="text-sm text-text-muted">{copy.dex(step.dexId)}</Text>
                    )}
                  </ListItem>
                ))}
              </List>
            </SolidPanel>
          </View>
          <Paragraph className="my-0 text-sm leading-6 text-text-muted">
            {starter.cultureNote ?? copy.cultureMissing}
          </Paragraph>
          <LinkButton title={copy.back} href={copy.backHref} testID={`w02-${starter.slug}-back`} />
        </Article>
      </Section>
    </View>
  );
}
