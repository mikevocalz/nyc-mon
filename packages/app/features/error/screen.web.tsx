'use client';
import { brand } from '@acme/theme';
import { Container, SceneSection, SignRain, SolidPanel, SubwayLines } from '@acme/ui';
import { useRouter } from 'solito/navigation';
import { ErrorMessageBlock, type ErrorScreenProps } from './screen.shared';

/**
 * Web error pages. A missing page gets the subway map (you took a wrong
 * turn; the button is the way back); a failure gets the street-sign rain,
 * the one place the site uses it. Either way the message sits on an ink
 * plate and the scene is dimmed under it.
 */
export function ErrorScreen(props: Omit<ErrorScreenProps, 'onGoHome'>) {
  const router = useRouter();
  const notFound = (props.kind ?? 'not-found') === 'not-found';
  return (
    <Container width="full" className="w-full flex-1">
      <SceneSection
        className="min-h-[80dvh] flex-1 justify-center"
        placeholderColor={brand.night}
        scene={({ paused }) =>
          notFound ? (
            <SubwayLines district="midtown" opacity={0.6} paused={paused} className="absolute inset-0" />
          ) : (
            <SignRain district="harlem" opacity={55} paused={paused} className="absolute inset-0" />
          )
        }
      >
        <Container width="form" className="flex-1 justify-center py-16">
          <SolidPanel tone="ink" depth="lg" className="px-5 py-8 md:px-10 md:py-10">
            <ErrorMessageBlock {...props} surface="night" onGoHome={() => router.push('/')} />
          </SolidPanel>
        </Container>
      </SceneSection>
    </Container>
  );
}
