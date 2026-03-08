import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

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
    <html lang="en">
      <body>
        <AuthProvider>
          <header className="firecrawl-header">
            <span className="firecrawl-wordmark">Firecrawl</span>
          </header>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
