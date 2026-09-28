import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';

/*
 * Inter matches the phone app, so the two products read as one system. The
 * mono face is for money and IDs — columns of digits must align, and a
 * proportional face makes a payout table unreadable.
 */
const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Dawuro Console',
  description: 'Report inbox, routing and payouts for the Dawuro platform.',
  // This console is never for public consumption.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-canvas text-text-primary antialiased">
        {/* Mounted once. Every consequential action in this console used to
            succeed in silence, which reads exactly like a click that missed. */}
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
