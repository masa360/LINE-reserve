import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/app/providers';
import BottomNav from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'SALON de LUMIÈRE | ご予約',
  description: '美容室のオンライン予約アプリ',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="h-full">
      <body className="h-full">
        <Providers>
          <div className="max-w-[430px] mx-auto h-full flex flex-col bg-[#FAF7F2] shadow-2xl shadow-black/20">
            <main className="flex-1 overflow-y-auto">{children}</main>
            <BottomNav />
          </div>
        </Providers>
      </body>
    </html>
  );
}
