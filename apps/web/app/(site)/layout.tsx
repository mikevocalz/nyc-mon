import type { Metadata } from 'next';
import { View } from '@acme/ui/tw';
import { Document } from '../Document';
import { SiteHeader } from '../../components/site/SiteHeader';
import { SiteFooter } from '../../components/site/SiteFooter';
import '../rn-globals';
import '../globals.css';

export const metadata: Metadata = {
  title: {
    default: 'NYC Mon',
    template: '%s — NYC Mon',
  },
  description:
    'Futuristic universal spatial starter — Expo SDK 58, Next.js, Skia, Rive, Viro/OpenXR and a Neon Grid interface.',
};

export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Document>
      <SiteHeader />
      <View className="min-h-screen flex-1">{children}</View>
      <SiteFooter />
    </Document>
  );
}
