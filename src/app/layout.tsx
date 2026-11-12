import Link from 'next/link';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nathaniel work pack — Dhun clone and fees portal',
  description:
    'A founding-engineer work pack: a Dhun melody clone, a fees reconciliation portal, a daily reminders skill and a Shruti architecture plan.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="site-header">
          <Link className="brand" href="/">
            <span className="brand__mark">N</span>
            <span className="brand__text">
              Nathaniel work pack
              <small>Idea in the morning. Live by night.</small>
            </span>
          </Link>
          <nav className="nav">
            <Link href="/dhun">Dhun</Link>
            <Link href="/fees">Fees</Link>
            <Link href="/notes">Notes</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <span>Built by Nishant for the Nathaniel School of Music founding-engineer work pack.</span>
          <span>Exercise date 31 October 2026 · Asia/Kolkata</span>
        </footer>
      </body>
    </html>
  );
}
