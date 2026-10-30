import { BrandWordmark } from '@acme/ui/admin';
import { Link, Nav } from '@acme/ui/html';

/**
 * Navigation for the restored native Payload editing views; the existing
 * operations console is unchanged. Those views do not load the console's
 * Tailwind stylesheet, so spacing is set with inline styles here.
 */
const nav = { gap: 12, paddingHorizontal: 20, paddingVertical: 24 } as const;
const link = { fontSize: 15, lineHeight: 22, paddingVertical: 6, textDecorationLine: 'none' } as const;

export function WebsiteNavigation() {
  return <Nav aria-label="Website editor" style={nav}>
    <BrandWordmark height={32} />
    <Link href="/admin/overview" style={link}>Operations console</Link>
    <Link href="/admin/collections/site-pages" style={link}>Website pages</Link>
    <Link href="/admin/collections/media" style={link}>Media library</Link>
    <Link href="/admin/content" style={link}>Mon content</Link>
  </Nav>;
}
