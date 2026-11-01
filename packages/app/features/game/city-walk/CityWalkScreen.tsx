'use client';
// The website's city walk page body: the heading, the stage and the controls key. The heading and the key render on
// the server; the stage (three.js, the scene, the city data) loads in the browser only, behind a lazy import, so the
// page's first HTML carries no renderer and no 1 MB dataset.
import { lazy, Suspense, useSyncExternalStore } from 'react';
import { DescriptionDetails, DescriptionList, DescriptionTerm, Heading, Link, Paragraph, Section } from '@acme/ui/html';
import { LinkButton } from '@acme/ui';
import { ProgressBar } from '@acme/ui/progress';
import { View } from '@acme/ui/tw';
import { OSM_COPYRIGHT_URL } from '../MapAttribution.tsx';
import { CITY_WALK_COPY as COPY } from './copy.ts';

const CityWalkStage = lazy(() => import('./CityWalkStage.tsx'));

const noopSubscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/** The stage before its module has loaded: the same night cover and bar the stage starts with, so nothing jumps. */
function StagePlaceholder() {
  return (
    <View className="scheme-dark absolute inset-0 items-center justify-center bg-ink-950 px-8">
      <View className="w-full max-w-[420px] md:max-w-[560px]">
        <ProgressBar value={0} district="harlem" size="lg" showLabel label={COPY.loading} accessibilityLabel={COPY.loadingA11y} />
      </View>
    </View>
  );
}

export interface CityWalkScreenProps {
  /** Where "Get the app" goes; the website passes its waitlist route. */
  readonly getAppHref: string;
}

export function CityWalkScreen({ getAppHref }: CityWalkScreenProps) {
  const client = useSyncExternalStore(noopSubscribe, onClient, onServer);
  return (
    <Section aria-labelledby="city-walk-title" className="w-full bg-bg" data-testid="city-walk">
      <View className="mx-auto w-full max-w-screen-xl gap-4 px-4 pb-6 pt-10 sm:px-6 md:pt-14 lg:px-8">
        <Heading level={1} id="city-walk-title" className="my-0 font-display text-3xl leading-tight text-text md:text-4xl">
          {COPY.title}
        </Heading>
        <Paragraph className="my-0 max-w-2xl text-base leading-7 text-text-secondary md:text-lg md:leading-8">{COPY.intro}</Paragraph>
      </View>

      {/* The stage: most of the viewport under the sticky header, never shorter than a phone held sideways can show. */}
      <View className="relative mx-auto h-[72dvh] min-h-[360px] w-full max-w-screen-2xl md:h-[78dvh]">
        {client ? (
          <Suspense fallback={<StagePlaceholder />}>
            <CityWalkStage />
          </Suspense>
        ) : (
          <StagePlaceholder />
        )}
      </View>

      <View className="mx-auto w-full max-w-screen-xl gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-start md:justify-between lg:px-8">
        <View className="gap-3">
          <Heading level={2} className="my-0 font-display text-xl text-text">{COPY.keysTitle}</Heading>
          <DescriptionList id="city-walk-keys" className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            {COPY.keys.map((row) => (
              <View key={row.keys} className="contents">
                <DescriptionTerm className="m-0 text-sm font-semibold text-text">{row.keys}</DescriptionTerm>
                <DescriptionDetails className="m-0 text-sm text-text-secondary">{row.action}</DescriptionDetails>
              </View>
            ))}
          </DescriptionList>
          <Paragraph className="my-0 text-sm text-text-secondary">
            <Link href={OSM_COPYRIGHT_URL} aria-label={COPY.creditA11y} className="text-text-secondary underline">
              {COPY.credit}
            </Link>
          </Paragraph>
        </View>
        <LinkButton href={getAppHref} title={COPY.getApp} district="harlem" className="self-start" />
      </View>
    </Section>
  );
}
