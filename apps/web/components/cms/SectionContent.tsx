import { blockImage, iframeEmbed, record, safeLink, youtubeEmbed, type SiteBlock, type SiteSection } from '@acme/content/site-content';
import { Image } from '@acme/ui';
import { Figure, Figcaption, Heading, Link, Paragraph, Section } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { SiteEmbed } from '@acme/ui/site-embed';

function Caption({ value }: { value: unknown }) {
  return typeof value === 'string' && value ? <Figcaption className="mt-2 text-sm text-text-secondary">{value}</Figcaption> : null;
}
function InlineImage({ value }: { value: unknown }) {
  const image = blockImage(value);
  if (!image) return null;
  return <Figure className="m-0 w-full">
    <View className="relative w-full" style={{ aspectRatio: image.width / image.height }}><Image src={image.src} alt={image.alt} fill framed={false} unoptimized loading="lazy" sizes="(min-width: 1280px) 1200px, 100vw" className="h-full w-full" /></View>
    <Caption value={image.caption} />
  </Figure>;
}
function Block({ block, origins, siteOrigin }: { block: SiteBlock; origins: string[]; siteOrigin: string }) {
  if (block.blockType === 'image') return block.slot && block.slot !== 'inline' ? null : <InlineImage value={block} />;
  if (block.blockType === 'gallery') return <View className="grid grid-cols-1 gap-6 md:grid-cols-2">{Array.isArray(block.images) ? block.images.slice(0, 24).map((image, index) => <InlineImage key={record(image) && typeof image.id === 'string' ? image.id : index} value={image} />) : null}</View>;
  if (block.blockType === 'text') {
    const href = safeLink(block.link);
    return <View className="gap-4">
      {typeof block.heading === 'string' && block.heading ? <Heading level={2} className="font-display text-display-md">{block.heading}</Heading> : null}
      {typeof block.body === 'string' ? block.body.split(/\n\s*\n/).map((paragraph, index) => <Paragraph key={index} className="whitespace-pre-wrap text-base leading-7">{paragraph}</Paragraph>) : null}
      {href && typeof block.linkLabel === 'string' && block.linkLabel ? <Link href={href}>{block.linkLabel}</Link> : null}
    </View>;
  }
  const src = block.blockType === 'youtube' ? youtubeEmbed(block.url) : block.blockType === 'iframe' ? iframeEmbed(block.url, origins) : null;
  if (!src || typeof block.title !== 'string' || !block.title.trim()) return null;
  let crossOrigin = false;
  try { crossOrigin = new URL(src).origin !== new URL(siteOrigin).origin; } catch { /* Fail closed: preserve sandbox isolation. */ }
  const aspect = ['4:3', '1:1', '9:16'].includes(String(block.aspect)) ? block.aspect as '4:3' | '1:1' | '9:16' : '16:9';
  return <Figure className="m-0 w-full">
    <SiteEmbed src={src} title={block.title} aspect={aspect} crossOrigin={crossOrigin} />
    <Caption value={block.caption} />
    <Link href={src} className="mt-2 text-sm">Open {block.title} separately</Link>
  </Figure>;
}

/** Blocks render only within the page/section which owns them. Never evaluates HTML or JavaScript strings. */
export function SectionContent({ section, origins, siteOrigin }: { section?: SiteSection; origins: string[]; siteOrigin: string }) {
  if (!section || section.hidden) return null;
  const blocks = section.content.filter((block) => block.blockType !== 'image' || !block.slot || block.slot === 'inline');
  if (!blocks.length) return null;
  return <Section aria-label={`${section.label} additional content`} className="mx-auto w-full max-w-screen-xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
    {blocks.map((block, index) => <Block key={typeof block.id === 'string' ? block.id : index} block={block} origins={origins} siteOrigin={siteOrigin} />)}
  </Section>;
}
