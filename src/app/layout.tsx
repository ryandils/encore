import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Encore — demo / setup milestone',
  description:
    'The Encore application foundation. Synthetic local sign-in is available for setup. Door recording and cash reconciliation are not available yet.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
