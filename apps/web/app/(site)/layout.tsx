import type { Metadata } from 'next';
import { SITE_DESCRIPTION } from '@acme/spatial/copy';
import { Document } from '../Document';
import { SiteFooterBar, SiteNavBar } from '../../components/site/SiteChrome';
import { CONTENT_ID } from '../../components/site/nav';
import '../rn-globals';
import '../globals.css';
import { Main } from '@acme/ui/html';

export const metadata: Metadata = {
  title: {
    default: 'NYC-MON',
    template: '%s | NYC-MON',
  },
  description: SITE_DESCRIPTION,
};

export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Document>
      <SiteNavBar />
      <Main id={CONTENT_ID} tabIndex={-1} className="min-h-screen flex-1 focus:outline-none">
        {children}
      </Main>
      <SiteFooterBar />
    </Document>
  );
}
