import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'メモリー | ヘアスタイル',
  description: 'LINEで保存した思い出の写真',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100vh' }}>{children}</div>
      </body>
    </html>
  );
}
