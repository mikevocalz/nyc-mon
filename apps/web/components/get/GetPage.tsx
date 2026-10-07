import { Badge, SolidPanel } from '@acme/ui';
import { Heading, List, ListItem, Paragraph, Section } from '@acme/ui/html';
import { Text, View } from '@acme/ui/tw';
import { Eyebrow } from '../home/Eyebrow';
import { W05_COPY } from './copy';

/**
 * Sign-ups need the waitlist endpoint (PREMIUM_SITE_DECISIONS.md PS-001). Until
 * it ships the page says so instead of rendering a form that stores nothing.
 */
function WaitlistStatus() {
  const copy = W05_COPY.status;
  return (
    <SolidPanel surface="page" depth="md" className="max-w-xl gap-2 px-5 py-6">
      <Paragraph className="my-0 font-display text-xl text-text">{copy.title}</Paragraph>
      <Paragraph className="my-0 text-base leading-7 text-text-secondary">{copy.body}</Paragraph>
    </SolidPanel>
  );
}

/** W05, the waitlist page. */
export function GetPage() {
  const copy = W05_COPY;
  return (
    <View className="w-full flex-1 bg-bg">
      <Section
        aria-labelledby="w05-get-title"
        data-testid="w05-get"
        className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:px-8"
      >
        <View className="max-w-2xl gap-4">
          <Eyebrow>{copy.hero.eyebrow}</Eyebrow>
          <Heading
            level={1}
            id="w05-get-title"
            className="my-0 font-display text-4xl leading-tight text-text md:text-5xl"
          >
            {copy.hero.title}
          </Heading>
          <Paragraph className="my-0 text-base leading-7 text-text-secondary md:text-lg md:leading-8">
            {copy.hero.body}
          </Paragraph>
        </View>
        <WaitlistStatus />
        <List aria-label={copy.stores.label} className="m-0 list-none gap-6 p-0 sm:flex-row">
          {copy.stores.badges.map((badge) => (
            <ListItem key={badge.name} className="flex-1">
              <SolidPanel
                surface="page"
                depth="sm"
                rim={false}
                className="h-full flex-row items-center justify-between gap-3 px-5 py-4"
              >
                <Text className="font-display text-lg text-text-muted">{badge.name}</Text>
                <Badge label={badge.note} tone="neutral" />
              </SolidPanel>
            </ListItem>
          ))}
        </List>
      </Section>
    </View>
  );
}
