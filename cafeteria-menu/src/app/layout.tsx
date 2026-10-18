import type { Metadata, Viewport } from 'next';
import './globals.css';
import PwaRegister from '@/components/ui/PwaRegister';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const metadata: Metadata = {
  title: 'Yemekhane Menü Planlayıcı',
  description: 'Okul yatakhanesi aylık yemek listesi yönetim sistemi',
  manifest: `${basePath}/manifest.webmanifest`,
  icons: {
    icon: `${basePath}/icons/icon-192.png`,
    apple: `${basePath}/icons/apple-touch-icon.png`,
  },
  appleWebApp: { capable: true, title: 'Menü', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
