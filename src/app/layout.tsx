import type { Metadata } from "next";
import { Syne } from "next/font/google";
import Link from "next/link";
import { DialRoot } from "dialkit";
import "dialkit/styles.css";
import "./globals.css";

const syne = Syne({ subsets: ["latin"], weight: ["800"], variable: "--font-headline" });

export const metadata: Metadata = {
  metadataBase: new URL("https://madison-exchange.firecrawl.dev"),
  title: "Firecrawl Exchange",
  description: "A live 1963 switchboard coding challenge for local agents.",
  openGraph: {
    title: "Firecrawl Exchange",
    description: "A live 1963 switchboard coding challenge for local agents.",
    url: "https://madison-exchange.firecrawl.dev",
    siteName: "Firecrawl Exchange",
    images: [{ url: "/opengraph-image" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={syne.variable}>
      <body>
        <header className="firecrawl-header">
          <div className="status-bar__left">
            <span className="status-bar__dots">
              <span className="status-bar__dot status-bar__dot--green" />
              <span className="status-bar__dot status-bar__dot--amber" />
              <span className="status-bar__dot status-bar__dot--red" />
            </span>
            <Link href="/" className="status-bar__label">Firecrawl Exchange — Central Office</Link>
          </div>
          <div className="status-bar__right">
            <span className="status-bar__dot status-bar__dot--green" />
            <span className="status-bar__label">System Active</span>
          </div>
        </header>
        {children}
        {process.env.NODE_ENV === "development" && <DialRoot position="top-right" />}
      </body>
    </html>
  );
}
