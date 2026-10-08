import { Heading, Paragraph, Section } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { WAITLIST_COPY } from '../waitlist/copy';
import { WaitlistForm } from '../waitlist/WaitlistForm';
import { sectionMarker } from './sections';

/**
 * WAITLIST (PS-023): the page's conversion, right after the hatch. Back on
 * daylight concrete and deliberately quieter than the night band above: one
 * headline, one sentence, one form. The section is server markup; the form is
 * the only client island. No counts, no countdown, no social proof.
 */
export function WaitlistSection() {
  const copy = WAITLIST_COPY.section;
  return (
    <Section
      {...sectionMarker('waitlist')}
      aria-labelledby="w01-waitlist-title"
      data-testid="w01-waitlist"
      id="trg-waitlist"
      className="w-full bg-bg"
    >
      <View className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-20 sm:px-6 md:flex-row md:items-start md:justify-between md:gap-14 md:py-28 lg:px-8">
        <View className="min-w-0 gap-5 md:flex-[5_1_0%]">
          <Heading
            level={2}
            id="w01-waitlist-title"
            className="my-0 font-display text-display-md uppercase leading-heading text-text lg:text-display-lg lg:leading-heading"
          >
            {copy.title}
          </Heading>
          <Paragraph className="my-0 max-w-content-measure text-base leading-7 text-text-secondary md:text-lg md:leading-8">
            {copy.body}
          </Paragraph>
        </View>
        <View className="min-w-0 md:flex-[6_1_0%]">
          <WaitlistForm source="home" />
        </View>
      </View>
    </Section>
  );
}
