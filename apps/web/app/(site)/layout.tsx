import type { Metadata } from 'next';
import { SITE_DESCRIPTION } from '@acme/spatial/copy';
import { View } from '@acme/ui/tw';
import { Document } from '../Document';
import { SiteFooterBar, SiteNavBar } from '../../components/site/SiteChrome';
import { CONTENT_ID } from '../../components/site/nav';
import '../rn-globals';
import '../globals.css';

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
      <View id={CONTENT_ID} className="min-h-screen flex-1">
        {children}
      </View>
      <SiteFooterBar />
    </Document>
  );
}
