import { breakpoints } from '@acme/theme';
import { DISTRICT_TONES, Image, TONE_CLASSES, type District, type ImageProps } from '@acme/ui';
import { Figcaption, Figure, Heading, List, ListItem, Paragraph, Section, Text, Time } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { DISTRICT_COPY } from '@acme/spatial/copy';
import { Eyebrow } from './Eyebrow';
import { W01_COPY } from './copy';
import { proofDateLabel, publicProof, type ProofAsset, type ProofItem, type ProofKind } from './proof';
import { sectionMarker } from './sections';

const MD_UP = `(min-width: ${breakpoints.md})`;
const LG_UP = `(min-width: ${breakpoints.lg})`;
const XL_UP = `(min-width: ${breakpoints.xl})`;
/** Lead frame: five of twelve columns of the 80rem grid from `lg`. */
const LEAD_SIZES = `${XL_UP} 31rem, ${LG_UP} 38vw, 100vw`;
/** Strip frames: a quarter of seven columns from `lg`, a quarter of the row from `md`, half on phones. */
const STRIP_SIZES = `${XL_UP} 10rem, ${LG_UP} 13vw, ${MD_UP} 22vw, 46vw`;

/** The kind's mark beside the status label. Shape, not just colour, tells the kinds apart. */
const KIND_MARK = {
  render: 'bg-ink-950',
  'concept-art': 'rounded-full bg-orange-700',
  prototype: 'rotate-45 bg-leaf-700',
  'design-artifact': 'border-2 border-royal-700 bg-transparent',
} as const satisfies Record<ProofKind, string>;

/** Route order, north to south, then Mega City, as on the signage board. */
const ROUTE: readonly District[] = ['harlem', 'midtown', 'downtown', 'megacity'];

/**
 * The district color pairs, drawn from the live tokens: a band per district,
 * the main tone wide and the accent narrow, the name on the main tone. One
 * `img` to assistive tech, named by the item's alt.
 */
function DistrictColorSpecimen({ alt }: { alt: string }) {
  return (
    <View role="img" aria-label={alt} className="h-full w-full gap-1.5 bg-surface-raised p-2">
      {ROUTE.map((district) => {
        const { tone, accent } = DISTRICT_TONES[district];
        const face = TONE_CLASSES[tone];
        return (
          <View key={district} aria-hidden className="min-h-0 flex-1 flex-row gap-1.5">
            <View className={`flex-[3] justify-end px-2 pb-1.5 ${face.face}`}>
              <Text className={`font-display text-xs uppercase leading-4 ${face.onFace}`}>{DISTRICT_COPY[district].name}</Text>
            </View>
            <View className={`flex-1 ${TONE_CLASSES[accent].face}`} />
          </View>
        );
      })}
    </View>
  );
}

/** The artifact itself, filling a frame whose ground matches the one it was made on. */
function ProofArt({ asset, alt, sizes }: { asset: ProofAsset; alt: string; sizes: string }) {
  if (asset.type === 'specimen') return <DistrictColorSpecimen alt={alt} />;
  return (
    <Image
      src={asset.src as ImageProps['src']}
      alt={alt}
      fill
      framed={false}
      sizes={sizes}
      loading="lazy"
      {...(asset.blurDataURL ? { placeholder: 'blur' as const, blurDataURL: asset.blurDataURL } : {})}
      className="h-full w-full"
    />
  );
}

function frameGround(asset: ProofAsset): string {
  return asset.type === 'image' && asset.ground === 'ink' ? 'bg-ink-950' : 'bg-surface-raised';
}

/**
 * The date, then the kind mark and the status label: the label the visitor
 * must not miss. `inline` sets them on one line under the lead frame; the
 * strip stacks them, so a long label wraps on its own line.
 */
function ProofMeta({ item, inline = false }: { item: ProofItem; inline?: boolean }) {
  return (
    <View className={inline ? 'flex-row flex-wrap items-center gap-x-4 gap-y-1' : 'gap-1'}>
      <Time dateTime={item.source.committed} className="text-sm tabular-nums leading-5 text-text-muted">
        {proofDateLabel(item.source.committed)}
      </Time>
      <View className="min-w-0 flex-row items-start gap-2">
        <View aria-hidden className={`mt-1.5 h-2.5 w-2.5 shrink-0 ${KIND_MARK[item.kind]}`} />
        <Text className="min-w-0 flex-1 text-sm font-semibold leading-5 text-text">{item.status}</Text>
      </View>
    </View>
  );
}

/** The lead artifact: large, with its full caption under it. */
function LeadFrame({ item }: { item: ProofItem }) {
  return (
    <Figure className="m-0 flex flex-col gap-4 lg:col-span-5 lg:row-span-2 lg:row-start-1">
      <View className={`relative aspect-[4/5] w-full overflow-hidden border-2 border-ink-950 ${frameGround(item.asset)}`}>
        <ProofArt asset={item.asset} alt={item.alt} sizes={LEAD_SIZES} />
      </View>
      <Figcaption className="flex flex-col gap-2">
        <ProofMeta item={item} inline />
        <Heading level={3} className="my-0 font-display text-display-sm uppercase leading-heading text-text">
          {item.title}
        </Heading>
        <Paragraph className="my-0 max-w-content-measure text-base leading-7 text-text-secondary">{item.caption}</Paragraph>
      </Figcaption>
    </Figure>
  );
}

/** One frame of the strip: the art, then the label, the date, the title and a short caption. */
function StripFrame({ item }: { item: ProofItem }) {
  return (
    <ListItem className="min-w-0">
      <Figure className="m-0 flex flex-col gap-3">
        <View className={`relative aspect-[4/5] w-full overflow-hidden border-2 border-ink-950 ${frameGround(item.asset)}`}>
          <ProofArt asset={item.asset} alt={item.alt} sizes={STRIP_SIZES} />
        </View>
        <Figcaption className="flex flex-col gap-1.5">
          <ProofMeta item={item} />
          <Heading level={3} className="my-0 text-base font-bold leading-6 text-text">
            {item.title}
          </Heading>
          <Paragraph className="my-0 text-sm leading-6 text-text-secondary">{item.caption}</Paragraph>
        </Figcaption>
      </Figure>
    </ListItem>
  );
}

/**
 * PROOF (PROOF_OF_CRAFT.md): what the team has made, in place of
 * testimonials, which do not exist. Told as a dated filmstrip after KÖPPEN
 * (MOBBIN_2026-10_ADDENDUM #8): one lead artifact large on the left, the
 * rest as a strip along the bottom right, each with its kind, status label
 * and last-change date. Phones read header, lead, then a two-up strip.
 * Server-rendered and still. With no approved items it renders nothing.
 */
export function ProofSection({ items = publicProof() }: { items?: readonly ProofItem[] }) {
  const [lead, ...strip] = items;
  if (!lead) return null;
  const copy = W01_COPY.proof;
  return (
    <Section
      {...sectionMarker('proof')}
      aria-labelledby="w01-proof-title"
      data-testid="w01-proof"
      id="trg-proof"
      className="w-full border-t-2 border-ink-950 bg-surface-raised"
    >
      <View className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-16 sm:px-6 md:gap-12 md:py-24 lg:grid lg:grid-cols-12 lg:gap-x-12 lg:gap-y-12 lg:px-8">
        <View className="gap-5 lg:col-span-7 lg:col-start-6 lg:row-start-1">
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <Heading
            level={2}
            id="w01-proof-title"
            className="my-0 font-display text-display-md uppercase leading-heading text-text lg:text-display-lg lg:leading-heading xl:text-display-xl xl:leading-heading"
          >
            {copy.title}
          </Heading>
          <Paragraph className="my-0 max-w-content-measure text-base leading-7 text-text-secondary md:text-lg md:leading-8">
            {copy.body}
          </Paragraph>
        </View>
        <LeadFrame item={lead} />
        {strip.length ? (
          <View className="gap-6 lg:col-span-7 lg:col-start-6 lg:row-start-2 lg:self-end">
            <List
              aria-label={copy.stripLabel}
              className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-8 border-t-2 border-ink-950 p-0 pt-6 md:grid-cols-4"
            >
              {strip.map((item) => (
                <StripFrame key={item.id} item={item} />
              ))}
            </List>
            <Paragraph className="my-0 text-sm leading-6 text-text-muted">{copy.note}</Paragraph>
          </View>
        ) : (
          <Paragraph className="my-0 text-sm leading-6 text-text-muted lg:col-span-7 lg:col-start-6 lg:row-start-2 lg:self-end">
            {copy.note}
          </Paragraph>
        )}
      </View>
    </Section>
  );
}
