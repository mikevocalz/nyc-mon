import { LinkButton, SolidPanel } from '@acme/ui';
import { Heading, ListItem, OrderedList, Paragraph, Section } from '@acme/ui/html';
import { Text, View } from '@acme/ui/tw';
import { Eyebrow } from '../home/Eyebrow';
import { W04_COPY } from './copy';

/** W04: the Phase-1 companion loop as an ordered journey, then the waitlist band. */
export function HowItWorksPage() {
  const loop = W04_COPY.loop;
  const cta = W04_COPY.cta;
  return (
    <View className="w-full flex-1 bg-bg">
      <Section
        aria-labelledby="w04-loop-title"
        data-testid="w04-loop"
        className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:px-8"
      >
        <View className="max-w-2xl gap-4">
          <Eyebrow>{loop.eyebrow}</Eyebrow>
          <Heading level={1} id="w04-loop-title" className="my-0 font-display text-3xl leading-tight text-text md:text-4xl">
            {loop.title}
          </Heading>
          <Paragraph className="my-0 text-base leading-7 text-text-secondary md:text-lg md:leading-8">{loop.body}</Paragraph>
        </View>
        <OrderedList aria-label={loop.listLabel} className="m-0 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {loop.steps.map((step) => (
            <ListItem key={step.verb}>
              <SolidPanel surface="page" depth="md" className="h-full gap-3 px-5 py-6">
                <Text aria-hidden className="font-display text-5xl leading-none text-orange">
                  {step.numeral}
                </Text>
                <Heading level={2} className="my-0 font-display text-2xl leading-tight text-text">
                  {step.verb}
                </Heading>
                <Paragraph className="my-0 text-base leading-7 text-text-secondary">{step.line}</Paragraph>
              </SolidPanel>
            </ListItem>
          ))}
        </OrderedList>
      </Section>

      {/* The page's one dark band — night in both schemes, like W01's HatchBand. */}
      <Section aria-labelledby="w04-cta-title" data-testid="w04-cta" className="w-full bg-ink-950">
        <View className="h-1 w-full bg-orange-500" aria-hidden />
        <View className="mx-auto w-full max-w-screen-xl gap-5 px-4 py-20 sm:px-6 md:py-28 lg:px-8">
          <Eyebrow night>{cta.eyebrow}</Eyebrow>
          <Heading level={2} id="w04-cta-title" className="my-0 max-w-3xl font-display text-4xl leading-tight text-orange-500 md:text-5xl">
            {cta.title}
          </Heading>
          <Paragraph className="my-0 max-w-2xl text-lg leading-8 text-ink-50">{cta.body}</Paragraph>
          <LinkButton title={cta.cta} href={cta.ctaHref} variant="cta" size="lg" testID="w04-cta" />
        </View>
      </Section>
    </View>
  );
}
