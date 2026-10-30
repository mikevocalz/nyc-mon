import { BrandWordmark } from '@acme/ui/admin';
import { Link, Nav } from '@acme/ui/html';

/** Navigation for the restored native Payload editing views; the existing operations console is unchanged. */
export function WebsiteNavigation() {
  return <Nav aria-label="Website editor" className="gap-4 px-4 py-6">
    <BrandWordmark height={32} />
    <Link href="/admin/overview">Operations console</Link>
    <Link href="/admin/collections/site-pages">Website pages</Link>
    <Link href="/admin/collections/media">Media library</Link>
    <Link href="/admin/content">Mon content</Link>
  </Nav>;
}
