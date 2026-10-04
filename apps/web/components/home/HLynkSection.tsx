import { Heading, Paragraph, Section } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { DeviceStage } from '../DeviceStage';
import { W01_COPY } from './copy';

/** The H-Lynk Core in 3D, in its own section under the hero (D12). */
export function HLynkSection() {
  const copy = W01_COPY.hlynk;
  return (
    <Section
      aria-labelledby="w01-hlynk-title"
      data-testid="w01-hlynk"
      className="mx-auto w-full max-w-screen-xl items-center gap-10 px-4 py-16 sm:px-6 md:flex-row md:py-24 lg:px-8"
    >
      <View className="w-full min-w-0 gap-5 md:flex-1">
        <Heading level={2} id="w01-hlynk-title" className="my-0 font-display text-3xl leading-tight text-text md:text-4xl">
          {copy.title}
        </Heading>
        <Paragraph className="my-0 max-w-[36rem] text-base leading-7 text-text-secondary md:text-lg md:leading-8">{copy.body}</Paragraph>
        <Paragraph className="my-0 max-w-[36rem] text-base leading-7 text-text-secondary md:text-lg md:leading-8">{copy.body2}</Paragraph>
      </View>
      <View className="w-full min-w-0 max-w-md md:flex-1">
        <DeviceStage model="placeholder" caption={copy.caption} />
      </View>
    </Section>
  );
}
