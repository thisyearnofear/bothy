import type { Metadata, Viewport } from "next";
import { site } from "../lib/site";
import "./globals.css";

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#1d1f26",
};

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  applicationName: site.name,
  title: {
    default: "Bothy — Accountable winter access decisions",
    template: "%s | Bothy",
  },
  description: site.description,
  keywords: ["winter road access", "decision support", "UK upland roads", "evidence-backed decisions"],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/icon", type: "image/png" }],
    apple: [{ url: "/apple-icon", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "/",
    siteName: site.name,
    title: "Bothy — Accountable winter access decisions",
    description: site.description,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: site.socialImageAlt }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bothy — Accountable winter access decisions",
    description: site.description,
    images: ["/opengraph-image"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: site.name,
  url: site.url,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: site.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </body>
    </html>
  );
}