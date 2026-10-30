import { sectionFor } from '@acme/content/site-content';
import { Heading, Section } from '@acme/ui/html';
import { PageSections, type WebsitePageProps } from './PageContent';
export function CustomPage({ page, embedOrigins, siteOrigin }: WebsitePageProps) {
  if (!page) return null;
  const title = sectionFor(page, 'hero')?.copy.find((row) => row.key === 'title')?.value ?? page.title;
  return <><Section className="mx-auto w-full max-w-screen-xl px-4 pt-16"><Heading level={1} className="font-display text-display-xl">{title}</Heading></Section><PageSections page={page} embedOrigins={embedOrigins} siteOrigin={siteOrigin} sections={{}} /></>;
}
