import { bloodlineLabel, eggs, starterBloodlines } from '@acme/content';
import { Badge, SolidPanel } from '@acme/ui';
import { Article, Heading, List, ListItem, Paragraph, Section } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { W01_COPY } from './copy';

export interface StarterCard {
  key: string;
  babyName: string;
  dexId: number;
  bloodline: string;
  eggName: string;
}

/** The three starters from @acme/content: Baby name, its Bloodline, the egg it hatches from. Nothing past Baby. */
export function starterCards(): StarterCard[] {
  return starterBloodlines.map(({ bloodline }, i) => {
    const baby = bloodline.chain.evolvesTo[0];
    const egg = eggs[i];
    if (!baby || baby.formName === null || baby.dexId === null || !egg) {
      throw new Error(`${bloodline.bloodlineId} has no Baby form or egg in @acme/content`);
    }
    return { key: bloodline.bloodlineId, babyName: baby.formName, dexId: baby.dexId, bloodline: bloodlineLabel(bloodline), eggName: egg.eggName };
  });
}

export function StartersSection({ cards }: { cards: readonly StarterCard[] }) {
  const copy = W01_COPY.starters;
  return (
    <Section
      aria-labelledby="w01-starters-title"
      data-testid="w01-starters"
      className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:px-8"
    >
      <View className="max-w-2xl gap-4">
        <Heading level={2} id="w01-starters-title" className="my-0 font-display text-3xl leading-tight text-text md:text-4xl">
          {copy.title}
        </Heading>
        <Paragraph className="my-0 text-base leading-7 text-text-secondary md:text-lg md:leading-8">{copy.body}</Paragraph>
      </View>
      <List className="m-0 list-none gap-6 p-0 md:flex-row">
        {cards.map((card) => (
          <ListItem key={card.key} className="flex-1">
            <SolidPanel surface="page" depth="md" className="h-full gap-3 px-5 py-6">
              <Article className="gap-3">
                <Badge label={copy.dex(card.dexId)} tone="neutral" size="sm" />
                <Heading level={3} className="my-0 font-display text-2xl leading-tight text-text">
                  {card.babyName}
                </Heading>
                <Paragraph className="my-0 text-base font-semibold text-text-secondary">{card.bloodline}</Paragraph>
                <Paragraph className="my-0 text-sm text-text-muted">{copy.hatchesFrom(card.eggName)}</Paragraph>
              </Article>
            </SolidPanel>
          </ListItem>
        ))}
      </List>
    </Section>
  );
}
